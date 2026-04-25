import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/payments/history?page=0&limit=20&direction=all
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
    .catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page      = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const limit     = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const direction = searchParams.get('direction') ?? 'all' // 'sent' | 'received' | 'all'
  const offset    = page * limit

  const admin = await createAdminClient()

  let query = admin
    .from('p2p_transfers')
    .select(`
      id, amount_cents, fee_cents, net_cents, note, status, currency,
      sender_espeezy_email, recipient_espeezy_email,
      created_at, completed_at,
      sender:profiles!p2p_transfers_sender_id_fkey(id, username, full_name, avatar_url),
      recipient:profiles!p2p_transfers_recipient_id_fkey(id, username, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (direction === 'sent') {
    query = query.eq('sender_id', user.id)
  } else if (direction === 'received') {
    query = query.eq('recipient_id', user.id)
  } else {
    query = query.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
  }

  const { data: transfers, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transfers: transfers ?? [], page, limit })
}
