import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient, createReadClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/hustle/tasks — list tasks (with filters)
export async function GET(req: NextRequest) {
  // Auth check via primary
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'
  const mine = searchParams.get('mine') === '1'
  const category = searchParams.get('category')
  const cursor = searchParams.get('cursor')
  const PAGE_SIZE = 20

  // READ: route to nearest regional replica
  const svc = createReadClient()

  let query = svc
    .from('hustle_tasks')
    .select(`id, title, description, category, payout_cents, platform_fee_cents, net_payout_cents, status, deadline, connection_only, created_at,
      poster:poster_id(id, full_name, username, avatar_url),
      assignee:assignee_id(id, full_name, username, avatar_url)`)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (mine) {
    query = query.or(`poster_id.eq.${user.id},assignee_id.eq.${user.id}`)
  } else {
    query = query.eq('status', status)
    if (status === 'open') query = query.neq('poster_id', user.id)
  }

  if (category) query = query.eq('category', category)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasMore = (data?.length ?? 0) > PAGE_SIZE
  const tasks = hasMore ? data!.slice(0, PAGE_SIZE) : (data ?? [])
  const nextCursor = hasMore ? tasks[tasks.length - 1].created_at : null

  return NextResponse.json({ tasks, nextCursor })
}

// POST /api/hustle/tasks — create a task
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = await createAdminClient()

  const { data: profile } = await svc.from('profiles').select('account_status').eq('id', user.id).single()
  if (profile?.account_status !== 'active') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }

  const { title, description, category, payout_cents, deadline, connection_only } = await req.json()

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
  }
  if (!payout_cents || payout_cents < 100 || payout_cents > 500000) {
    return NextResponse.json({ error: 'Payout must be between $1 and $5,000' }, { status: 400 })
  }

  const VALID_CATEGORIES = ['design', 'writing', 'coding', 'tutoring', 'research', 'admin', 'marketing', 'video', 'photography', 'other']
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const { data: task, error } = await svc
    .from('hustle_tasks')
    .insert({
      poster_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      payout_cents: Math.round(payout_cents),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      connection_only: !!connection_only,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await svc.rpc('log_activity', {
      p_user_id: user.id, p_action: 'task_posted', p_resource_type: 'hustle_task',
      p_resource_id: task.id, p_metadata: { title, payout_cents },
    })
  } catch { /* non-critical log */ }

  return NextResponse.json({ task }, { status: 201 })
}
