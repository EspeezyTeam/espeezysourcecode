import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-08-27.basil'

function getStripeClient(): Stripe {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })
}

// POST /api/admin/payout — admin sends money to a user
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = await createAdminClient()

  // Verify admin
  const { data: adminProfile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { recipient_id, amount_cents, note } = body ?? {}

  // Validate recipient_id is a proper UUID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!recipient_id || !UUID_RE.test(String(recipient_id))) {
    return NextResponse.json({ error: 'Invalid recipient_id: must be a valid UUID' }, { status: 400 })
  }

  // Validate amount_cents: must be a positive integer >= 100, no string coercion, no overflow
  const parsedAmount = Number(amount_cents)
  if (
    !amount_cents ||
    typeof amount_cents !== 'number' ||
    !Number.isFinite(parsedAmount) ||
    !Number.isInteger(parsedAmount) ||
    parsedAmount < 100 ||
    parsedAmount > 10_000_000_00 // max $10M
  ) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer >= 100 (min $1)' }, { status: 400 })
  }

  const { data: recipient } = await svc
    .from('profiles')
    .select('stripe_account_id, stripe_account_status, full_name, account_status')
    .eq('id', recipient_id)
    .single()

  if (!recipient) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!recipient.stripe_account_id || recipient.stripe_account_status !== 'active') {
    return NextResponse.json({ error: 'Recipient has no active bank account connected.' }, { status: 400 })
  }

  let stripe: Stripe
  try {
    stripe = getStripeClient()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe is not configured'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let transfer: Stripe.Transfer
  try {
    transfer = await stripe.transfers.create({
      amount: Math.round(amount_cents),
      currency: 'usd',
      destination: recipient.stripe_account_id,
      description: note ?? 'Admin payout from espeezy.com',
      metadata: {
        admin_id: user.id,
        recipient_id,
        note: note ?? '',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe transfer failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  await svc.from('admin_payouts').insert({
    admin_id: user.id,
    recipient_id,
    amount_cents: Math.round(amount_cents),
    stripe_transfer_id: transfer.id,
    note: note ?? null,
  })

  try {
    await svc.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'admin_payout',
      p_resource_type: 'admin_payout',
      p_resource_id: transfer.id,
      p_metadata: { recipient_id, amount_cents, note },
      p_severity: 'warning',
    })
  } catch { /* non-critical log */ }

  return NextResponse.json({ success: true, transfer_id: transfer.id })
}
