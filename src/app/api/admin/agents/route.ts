import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const svc = await createAdminClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return { user, svc }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: agents } = await auth.svc
    .from('agents')
    .select('*, pair:pair_id(id, name)')
    .order('specialisation')

  const { data: tasks } = await auth.svc
    .from('agent_tasks')
    .select('id, title, status, priority, assigned_agent_id, created_at')
    .neq('status', 'done')
    .order('created_at', { ascending: false })

  return NextResponse.json({ agents: agents ?? [], tasks: tasks ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, specialisation, role, status, system_prompt, capabilities } = body

  if (!name || !specialisation || !role) {
    return NextResponse.json({ error: 'name, specialisation, and role are required' }, { status: 400 })
  }

  const { data, error } = await auth.svc
    .from('agents')
    .insert({ name, specialisation, role, status: status ?? 'active', system_prompt, capabilities })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agent: data }, { status: 201 })
}
