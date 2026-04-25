import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createServerSupabaseClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const AnswerSchema = z.object({
  answer: z.enum(['a', 'b', 'c', 'd']),
  questionId: z.string().uuid(),
  accessToken: z.string().optional(),
  timeTakenMs: z.number().int().min(0).max(120000).optional(),
})

type Props = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params
  const payload = await req.json().catch(() => null)
  const parsed = AnswerSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 })
  }

  const body = parsed.data
  const admin = await createAdminClient()

  const { data: session } = await admin
    .from('quiz_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session || session.status !== 'active') {
    return NextResponse.json({ error: 'Session not found or inactive' }, { status: 404 })
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await admin.from('quiz_sessions').update({ status: 'expired' }).eq('id', id)
    return NextResponse.json({ error: 'Session expired' }, { status: 410 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

  if (session.play_mode === 'member') {
    if (!user || user.id !== session.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    if (!body.accessToken || body.accessToken !== session.access_token) {
      return NextResponse.json({ error: 'Invalid guest token' }, { status: 401 })
    }
  }

  const questionIds: string[] = session.metadata?.question_ids ?? []
  if (!questionIds.includes(body.questionId)) {
    return NextResponse.json({ error: 'Question does not belong to this session' }, { status: 422 })
  }

  const { data: alreadyAnswered } = await admin
    .from('quiz_session_answers')
    .select('id')
    .eq('session_id', id)
    .eq('question_id', body.questionId)
    .maybeSingle()

  if (alreadyAnswered) {
    return NextResponse.json({ error: 'Question already answered' }, { status: 409 })
  }

  const { data: question } = await admin
    .from('quiz_questions')
    .select('id, correct_answer, points_value, explanation')
    .eq('id', body.questionId)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const isCorrect = body.answer === question.correct_answer
  const pointsEarned = isCorrect ? question.points_value : 0

  await admin.from('quiz_session_answers').insert({
    session_id: id,
    question_id: body.questionId,
    answer_given: body.answer,
    is_correct: isCorrect,
    points_earned: pointsEarned,
    time_taken_ms: body.timeTakenMs ?? null,
  })

  const questionsAnswered = session.questions_answered + 1
  const correctAnswers = session.correct_answers + (isCorrect ? 1 : 0)
  const score = session.score + pointsEarned
  const isComplete = questionsAnswered >= session.questions_total

  const updatePayload: Record<string, unknown> = {
    questions_answered: questionsAnswered,
    correct_answers: correctAnswers,
    score,
  }

  let prizeCentsWon = 0

  if (isComplete) {
    if (session.play_mode === 'member' && session.user_id) {
      const pct = correctAnswers / Math.max(1, session.questions_total)
      const { data: category } = await admin
        .from('quiz_categories')
        .select('difficulty_tier, prize_pool_cents')
        .eq('id', session.category_id)
        .single()

      if (category && pct >= 0.6) {
        const tierMultiplier: Record<string, number> = {
          easy: 0.01,
          medium: 0.03,
          hard: 0.07,
          expert: 0.15,
          legendary: 0.3,
        }
        const mult = tierMultiplier[category.difficulty_tier] ?? 0.01
        prizeCentsWon = Math.floor(category.prize_pool_cents * mult * pct)
      }

      const { data: rule } = await admin
        .from('reward_rules')
        .select('points_awarded')
        .eq('action', 'earned_quiz_win')
        .eq('is_active', true)
        .single()

      if (rule?.points_awarded) {
        await admin.from('reward_ledger').insert({
          user_id: session.user_id,
          type: 'earned_quiz_win',
          points: Math.round(rule.points_awarded * (correctAnswers / Math.max(1, session.questions_total))),
          cash_value_cents: prizeCentsWon,
          description: `Standalone game completed with ${correctAnswers}/${session.questions_total} correct`,
          reference_id: id,
          reference_type: 'quiz_session',
        })
      }

      await admin.from('notifications').insert({
        user_id: session.user_id,
        type: 'games_session_complete',
        title: prizeCentsWon > 0 ? `You won $${(prizeCentsWon / 100).toFixed(2)} in games` : 'Game session completed',
        message: `You scored ${score} points and answered ${correctAnswers}/${session.questions_total} correctly.`,
        link: '/games',
      })
    }

    updatePayload.status = 'completed'
    updatePayload.completed_at = new Date().toISOString()
    updatePayload.prize_cents_won = prizeCentsWon
  }

  await admin.from('quiz_sessions').update(updatePayload).eq('id', id)

  let nextQuestion = null
  if (!isComplete) {
    const nextQuestionId = questionIds[questionsAnswered]
    const { data: nq } = await admin
      .from('quiz_questions')
      .select('id, question, option_a, option_b, option_c, option_d, difficulty, points_value, time_limit_secs')
      .eq('id', nextQuestionId)
      .single()
    nextQuestion = nq
  }

  return NextResponse.json({
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation ?? null,
    pointsEarned,
    score,
    questionsAnswered,
    questionsTotal: session.questions_total,
    isComplete,
    prizeCentsWon,
    nextQuestion,
  })
}
