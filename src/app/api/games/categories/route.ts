import { NextResponse } from 'next/server'
import { createReadClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/games/categories — public categories for standalone games
export async function GET() {
  const db = createReadClient()

  const { data, error } = await db
    .from('quiz_categories')
    .select('id, slug, name, description, icon, difficulty_tier, prize_pool_cents, is_seasonal, season_start, season_end')
    .eq('is_active', true)
    .order('prize_pool_cents', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categories: data ?? [] })
}
