'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function distributeTaskScore(taskId: string, assignees: string[]) {
  // Validate Security Credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Critical Error: Admin Node keys fundamentally missing. Score scaling aborted.')
  }

  // Construct absolute admin client bypassing RLS restrictions
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // 1. Verify mathematically if score_awarded is false
  const { data: taskStr, error: taskErr } = await adminClient
    .from('tasks')
    .select('score_awarded')
    .eq('id', taskId)
    .single()

  if (taskErr || !taskStr) throw new Error('Task node validation failed')
  if (taskStr.score_awarded) {
    return { success: false, reason: 'Already awarded' }
  }

  // 2. Safely traverse all assignees and globally inject +15 Validity Score internally
  if (assignees && assignees.length > 0) {
    for (const userId of assignees) {
      // Manual internal update because Supabase RPC might not exist
      const { data: profile } = await adminClient.from('profiles').select('total_score').eq('id', userId).single()
      if (profile) {
         await adminClient.from('profiles').update({ total_score: (profile.total_score || 0) + 15 }).eq('id', userId)
      }
    }
  }

  // 3. Close the physical lock permanently
  await adminClient.from('tasks').update({ score_awarded: true }).eq('id', taskId)

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function updateUserGameStats(userId: string, xpEarned: number, won: boolean) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Admin Node keys missing.')
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Fetch current stats
  const { data: stats } = await adminClient
    .from('user_game_stats')
    .select('total_xp, wins, games_played')
    .eq('user_id', userId)
    .single()

  const currentStats = stats || { total_xp: 0, wins: 0, games_played: 0 }

  // 2. Update stats
  const { data, error } = await adminClient
    .from('user_game_stats')
    .upsert({
      user_id: userId,
      total_xp: currentStats.total_xp + xpEarned,
      wins: currentStats.wins + (won ? 1 : 0),
      games_played: currentStats.games_played + 1,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard/chillout', 'page')
  return { success: true, stats: data }
}
