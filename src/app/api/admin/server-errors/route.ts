import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
    .catch(() => ({ data: { user: null } }))
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr) {
    return { user: null, error: NextResponse.json({ error: 'Failed to verify permissions', details: profileErr.message }, { status: 500 }) }
  }
  if (profile?.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, error: null }
}

// GET /api/admin/server-errors — returns the 100 most-recent logged errors
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const admin = await createAdminClient()
  const { data, error: dbErr } = await admin
    .from('server_error_log')
    .select('id, route, method, message, stack, user_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ errors: data })
}
