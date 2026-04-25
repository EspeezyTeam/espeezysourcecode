import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { paymentWorkflow, type PaymentWorkflowPayload } from '@/workflows/paymentWorkflow'
import { createAdminClient } from '@/utils/supabase/server'
import { sendP2PTransactionEmail } from '@/services/email'
import { getStripeClient, getStripeWebhookSecret } from '@/utils/stripe'
import { start } from '@/utils/workflow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let stripe: Stripe
  let webhookSecret: string
  try {
    stripe = getStripeClient()
    webhookSecret = getStripeWebhookSecret()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe not configured'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const rawBody = Buffer.from(await req.arrayBuffer())

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed'
    return NextResponse.json({ error: `Stripe webhook verification failed: ${message}` }, { status: 400 })
  }

  // Handle donation separately — does not go through payment workflow
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.type === 'donation') {
      await handleDonationWebhook(session)
      return NextResponse.json({ ok: true, handled: 'donation' }, { status: 200 })
    }
    if (session.metadata?.type === 'p2p_transfer') {
      await handleP2PTransferWebhook(session)
      return NextResponse.json({ ok: true, handled: 'p2p_transfer' }, { status: 200 })
    }
  }

  const payload = buildWebhookPayload(event)
  if (!payload) {
    return NextResponse.json({ ok: true, handled: 'ignored' }, { status: 200 })
  }

  try {
    await start(paymentWorkflow, [payload])
    return NextResponse.json({ ok: true, handled: payload.eventType }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Workflow startup failed'
    return NextResponse.json({ error: `Workflow startup failed: ${message}` }, { status: 500 })
  }
}

function buildWebhookPayload(event: Stripe.Event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    return {
      eventType: event.type,
      sessionId: session.id,
      stripeCustomerId: session.customer?.toString() ?? null,
      stripeSubscriptionId: session.subscription?.toString() ?? null,
      userId: session.metadata?.user_id ?? session.client_reference_id ?? null,
      plan: session.metadata?.plan ?? 'pro',
      productLabel: session.metadata?.product_label ?? 'Espeezy pre-registration',
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      mode: session.mode ?? 'payment',
      status: session.payment_status ?? 'unknown',
      metadata: session.metadata ?? {}
    } as PaymentWorkflowPayload
  }

  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null
      subscription?: string | Stripe.Subscription | null
    }
    const firstLine = invoice.lines?.data?.[0]
    const linePlanLabel = firstLine?.description ?? 'Subscription billing'
    return {
      eventType: event.type,
      sessionId: invoice.payment_intent?.toString() ?? invoice.id,
      stripeCustomerId: invoice.customer?.toString() ?? null,
      stripeSubscriptionId: invoice.subscription?.toString() ?? null,
      userId: null,
      plan: 'subscription',
      productLabel: linePlanLabel,
      amountTotal: invoice.amount_paid ?? invoice.amount_due ?? null,
      currency: invoice.currency ?? null,
      mode: invoice.billing_reason === 'subscription_cycle' ? 'subscription' : 'payment',
      status: invoice.status ?? 'unknown',
      invoiceId: invoice.id
    } as PaymentWorkflowPayload
  }

  return null
}

async function handleDonationWebhook(session: Stripe.Checkout.Session) {
  try {
    const supabase = await createAdminClient()
    const meta = session.metadata ?? {}
    await supabase.from('donations').upsert({
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent?.toString() ?? null,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      donor_email: meta.is_anonymous === 'true' ? null : (meta.donor_email || session.customer_email || null),
      donor_name: meta.is_anonymous === 'true' ? null : (meta.donor_name || null),
      message: meta.message || null,
      feature_tag: meta.feature_tag || 'general',
      is_anonymous: meta.is_anonymous === 'true',
      status: session.payment_status === 'paid' ? 'completed' : 'pending',
      completed_at: session.payment_status === 'paid' ? new Date().toISOString() : null,
      metadata: meta,
    }, { onConflict: 'stripe_session_id' })
  } catch (err) {
    console.error('[webhook] donation upsert error:', err)
  }
}

async function handleP2PTransferWebhook(session: Stripe.Checkout.Session) {
  const transferId = session.metadata?.transfer_id
  if (!transferId) return

  const paid = session.payment_status === 'paid'
  const admin = await createAdminClient()

  const { data: transfer } = await admin
    .from('p2p_transfers')
    .select('id, sender_id, recipient_id, amount_cents, fee_cents, net_cents, note, status')
    .eq('id', transferId)
    .single()

  if (!transfer) return

  if (paid) {
    await admin
      .from('p2p_transfers')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent?.toString() ?? null,
      })
      .eq('id', transfer.id)

    const { data: sender } = await admin
      .from('profiles')
      .select('id, full_name, username, email, espeezy_email')
      .eq('id', transfer.sender_id)
      .single()

    const { data: recipient } = await admin
      .from('profiles')
      .select('id, full_name, username, email, espeezy_email')
      .eq('id', transfer.recipient_id)
      .single()

    if (sender && recipient) {
      const { data: sendRule } = await admin
        .from('reward_rules')
        .select('points_awarded')
        .eq('action', 'earned_payment_sent')
        .eq('is_active', true)
        .single()

      const { data: receiveRule } = await admin
        .from('reward_rules')
        .select('points_awarded')
        .eq('action', 'earned_payment_received')
        .eq('is_active', true)
        .single()

      if (sendRule?.points_awarded) {
        await admin.from('reward_ledger').insert({
          user_id: sender.id,
          type: 'earned_payment_sent',
          points: sendRule.points_awarded,
          description: `Sent $${(transfer.amount_cents / 100).toFixed(2)} to @${recipient.username}`,
          reference_id: transfer.id,
          reference_type: 'p2p_transfer',
        })
      }

      if (receiveRule?.points_awarded) {
        await admin.from('reward_ledger').insert({
          user_id: recipient.id,
          type: 'earned_payment_received',
          points: receiveRule.points_awarded,
          description: `Received $${(transfer.net_cents / 100).toFixed(2)} from @${sender.username}`,
          reference_id: transfer.id,
          reference_type: 'p2p_transfer',
        })
      }

      await admin.from('notifications').insert([
        {
          user_id: sender.id,
          type: 'payment_sent',
          title: `Payment sent to @${recipient.username}`,
          message: `You sent $${(transfer.amount_cents / 100).toFixed(2)} to ${recipient.full_name ?? recipient.username}.`,
          link: '/dashboard/wallet',
        },
        {
          user_id: recipient.id,
          type: 'payment_received',
          title: `Payment received from @${sender.username}`,
          message: `You received $${(transfer.net_cents / 100).toFixed(2)} from ${sender.full_name ?? sender.username}.`,
          link: '/dashboard/wallet',
        },
      ])

      const senderTargets = [sender.email, sender.espeezy_email].filter((v): v is string => Boolean(v))
      const recipientTargets = [recipient.email, recipient.espeezy_email].filter((v): v is string => Boolean(v))

      if (senderTargets.length > 0) {
        await sendP2PTransactionEmail({
          to: senderTargets,
          role: 'sender',
          transferId: transfer.id,
          counterpartyName: recipient.full_name ?? recipient.username ?? 'Recipient',
          counterpartyUsername: recipient.username ?? 'member',
          amountCents: transfer.amount_cents,
          feeCents: transfer.fee_cents,
          netCents: transfer.net_cents,
          note: transfer.note,
        })
      }

      if (recipientTargets.length > 0) {
        await sendP2PTransactionEmail({
          to: recipientTargets,
          role: 'recipient',
          transferId: transfer.id,
          counterpartyName: sender.full_name ?? sender.username ?? 'Sender',
          counterpartyUsername: sender.username ?? 'member',
          amountCents: transfer.amount_cents,
          feeCents: transfer.fee_cents,
          netCents: transfer.net_cents,
          note: transfer.note,
        })
      }
    }
  } else {
    await admin
      .from('p2p_transfers')
      .update({ status: 'failed', failed_at: new Date().toISOString() })
      .eq('id', transfer.id)
  }
}
