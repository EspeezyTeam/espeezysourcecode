import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const AnswerSchema = z.object({
  question_id:  z.string().uuid(),
  answer:       z.enum(['a', 'b', 'c', 'd']),
  time_taken_ms: z.number().int().min(0).max(120_000).optional(),
})

type Props = { params: Promise<{ id: string }> }

// POST /api/quiz/sessions/[id]/answer — submit an answer, get next question or final result
export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
    .catch(() => ({ data: { user: null } }))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: session_id } = await params

  const body = await req.json().catch(() => null)
  const parsed = AnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 })
  }

  const { question_id, answer, time_taken_ms } = parsed.data

  const admin = await createAdminClient()

  // Load session — must belong to user and be active
  const { data: session } = await admin
    .from('quiz_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found or already completed' }, { status: 404 })
  if (new Date(session.expires_at) < new Date()) {
    await admin.from('quiz_sessions').update({ status: 'expired' }).eq('id', session_id)
    return NextResponse.json({ error: 'Session expired' }, { status: 410 })
  }

  // Verify this question belongs to the session order
  const questionIds: string[] = session.metadata?.question_ids ?? []
  if (!questionIds.includes(question_id)) {
    return NextResponse.json({ error: 'Question does not belong to this session' }, { status: 422 })
  }

  // Prevent re-answering
  const { data: existing } = await admin
    .from('quiz_session_answers')
    .select('id')
    .eq('session_id', session_id)
    .eq('question_id', question_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already answered this question' }, { status: 409 })

  // Fetch correct answer server-side
  const { data: question } = await admin
    .from('quiz_questions')
    .select('correct_answer, points_value, explanation, option_a, option_b, option_c, option_d, question')
    .eq('id', question_id)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const is_correct = answer === question.correct_answer
  const points_earned = is_correct ? question.points_value : 0

  // Record answer
  await admin.from('quiz_session_answers').insert({
    session_id,
    question_id,
    answer_given: answer,
    is_correct,
    points_earned,
    time_taken_ms: time_taken_ms ?? null,
  })

  // Update session counters
  const newAnswered = session.questions_answered + 1
  const newCorrect  = session.correct_answers + (is_correct ? 1 : 0)
  const newScore    = session.score + points_earned
  const isLastQuestion = newAnswered >= session.questions_total

  let sessionUpdate: Record<string, unknown> = {
    questions_answered: newAnswered,
    correct_answers: newCorrect,
    score: newScore,
  }

  let prizeInfo: { prize_cents: number; rank?: number } | null = null

  if (isLastQuestion) {
    // Compute prize — based on % correct vs difficulty tier
    const pct = newCorrect / session.questions_total
    const { data: category } = await admin
      .from('quiz_categories')
      .select('difficulty_tier, prize_pool_cents')
      .eq('id', session.category_id)
      .single()

    let prize_cents = 0
    if (category && pct >= 0.6) { // minimum 60% to win any prize
      const tierMultiplier: Record<string, number> = {
        easy: 0.01, medium: 0.03, hard: 0.07, expert: 0.15, legendary: 0.30,
      }
      const mult = tierMultiplier[category.difficulty_tier] ?? 0.01
      prize_cents = Math.floor(category.prize_pool_cents * mult * pct)
    }

    sessionUpdate = {
      ...sessionUpdate,
      status: 'completed',
      completed_at: new Date().toISOString(),
      prize_cents_won: prize_cents,
    }

    // Grant reward points
    const { data: rule } = await admin
      .from('reward_rules')
      .select('points_awarded, cash_bonus_cents')
      .eq('action', 'earned_quiz_win')
      .eq('is_active', true)
      .single()

    if (pct >= 0.6 && rule) {
      await admin.from('reward_ledger').insert({
        user_id: user.id,
        type: 'earned_quiz_win',
        points: Math.round(rule.points_awarded * (pct)),
        cash_value_cents: prize_cents,
        description: `Quiz completed — ${Math.round(pct * 100)}% correct`,
        reference_id: session_id,
        reference_type: 'quiz_session',
      })
    }

    // In-app notification
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'quiz_result',
      title: prize_cents > 0 ? `🏆 You won $${(prize_cents / 100).toFixed(2)}!` : `Quiz complete — ${Math.round(pct * 100)}% correct`,
      message: `You answered ${newCorrect}/${session.questions_total} questions correctly.${prize_cents > 0 ? ` Prize: $${(prize_cents / 100).toFixed(2)}` : ''}`,
      link: `/dashboard/wallet`,
    })

    prizeInfo = { prize_cents }
  }

  await admin.from('quiz_sessions').update(sessionUpdate).eq('id', session_id)

  // Get next question if not last
  let next_question = null
  if (!isLastQuestion) {
    const nextQuestionId = questionIds[newAnswered]
    const { data: nq } = await admin
      .from('quiz_questions')
      .select('id, question, option_a, option_b, option_c, option_d, difficulty, points_value, time_limit_secs')
      .eq('id', nextQuestionId)
      .single()
    next_question = nq
  }

  return NextResponse.json({
    is_correct,
    correct_answer: question.correct_answer,
    explanation: question.explanation ?? null,
    points_earned,
    session_score: newScore,
    questions_answered: newAnswered,
    questions_total: session.questions_total,
    is_complete: isLastQuestion,
    prize: prizeInfo,
    next_question,
  })
}
