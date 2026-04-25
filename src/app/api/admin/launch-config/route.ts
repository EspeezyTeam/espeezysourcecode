import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export async function GET() {
  // Public endpoint — returns non-sensitive config needed by pre-reg page
  const svc = await createAdminClient()
  const { data } = await svc
    .from('app_config')
    .select('key, value')
    .in('key', ['launch_date', 'launch_message', 'preregister_goal', 'preregister_open', 'brand_name'])

  const config: Record<string, string> = {}
  for (const row of data ?? []) config[row.key] = row.value
  return NextResponse.json({ config })
}

export async function PUT(req: Request) {
  // Admin-only write
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = await createAdminClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Array<{ key: string; value: string }> = await req.json()
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'Expected array of {key, value} pairs.' }, { status: 400 })
  }

  const ALLOWED_KEYS = ['launch_date', 'launch_message', 'preregister_goal', 'preregister_open', 'brand_name', 'platform_version']
  const filtered = updates.filter(u => ALLOWED_KEYS.includes(u.key) && typeof u.value === 'string')

  const rows = filtered.map(u => ({
    key: u.key,
    value: u.value,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }))

  const { error } = await svc.from('app_config').upsert(rows, { onConflict: 'key' })
  if (error) {
    console.error('[admin-config] upsert error:', error)
    return NextResponse.json({ error: 'Failed to save configuration.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
