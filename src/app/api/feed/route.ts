import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient, createReadClient } from '@/utils/supabase/server'
import crypto from 'crypto'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  // Auth check must use primary (cookie-aware)
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const filter = searchParams.get('filter') ?? 'public'  // public | connections | group

  // READ: route to nearest regional replica for sub-20ms latency
  const supabase = createReadClient()

  let query = supabase
    .from('posts')
    .select(`
      id, content, media_urls, post_type, visibility, created_at, edited_at,
      author:author_id (id, full_name, username, avatar_url, role),
      reactions:post_reactions (reaction, user_id),
      comments:post_comments (count)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  if (filter === 'connections') {
    query = query.eq('visibility', 'connections')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    posts: data ?? [],
    nextCursor: data && data.length === PAGE_SIZE ? data[data.length - 1].created_at : null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check account is active
  const { data: profile } = await supabase.from('profiles').select('account_status').eq('id', user.id).single()
  if (profile?.account_status !== 'active') {
    return NextResponse.json({ error: 'Your account has been suspended. Contact support.' }, { status: 403 })
  }

  const body = await req.json()
  const { content, media_urls, post_type, visibility, group_id } = body

  if (!content?.trim() || content.length > 2000) {
    return NextResponse.json({ error: 'Content required (max 2000 chars)' }, { status: 400 })
  }

  const svc = await createAdminClient()
  const { data: post, error } = await svc
    .from('posts')
    .insert({
      author_id: user.id,
      content: content.trim(),
      media_urls: media_urls ?? [],
      post_type: post_type ?? 'general',
      visibility: visibility ?? 'public',
      group_id: group_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const ipHash = crypto.createHash('sha256').update(ip + (process.env.IP_HASH_SALT ?? '')).digest('hex')
  await svc.rpc('log_activity', {
    p_user_id: user.id,
    p_action: 'post.create',
    p_resource: 'posts',
    p_resource_id: post.id,
    p_metadata: { visibility, post_type },
    p_ip_hash: ipHash,
  })

  return NextResponse.json({ post }, { status: 201 })
}
