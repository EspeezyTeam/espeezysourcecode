import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params
  const accessToken = new URL(req.url).searchParams.get('accessToken')
  const admin = await createAdminClient()

  const { data: session } = await admin
    .from('quiz_sessions')
    .select('id, user_id, play_mode, guest_display_name, access_token, status, score, correct_answers, questions_total, prize_cents_won, started_at, completed_at, category:quiz_categories(name, slug)')
    .eq('id', id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.play_mode === 'member') {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    if (!user || user.id !== session.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!accessToken || accessToken !== session.access_token) {
    return NextResponse.json({ error: 'Invalid guest token' }, { status: 401 })
  }

  return NextResponse.json({ session })
}
