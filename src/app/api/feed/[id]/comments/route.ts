import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data } = await supabase
    .from('post_comments')
    .select('id, content, created_at, parent_id, author:author_id(id, full_name, username, avatar_url)')
    .eq('post_id', id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('account_status').eq('id', user.id).single()
  if (profile?.account_status !== 'active') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }

  const { content, parent_id } = await req.json()
  if (!content?.trim() || content.length > 500) {
    return NextResponse.json({ error: 'Comment required (max 500 chars)' }, { status: 400 })
  }

  const { id } = await params
  const svc = await createAdminClient()
  const { data: comment, error } = await svc
    .from('post_comments')
    .insert({ post_id: id, author_id: user.id, content: content.trim(), parent_id: parent_id ?? null })
    .select('id, content, created_at, parent_id, author:author_id(id, full_name, username, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment }, { status: 201 })
}
