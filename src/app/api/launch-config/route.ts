import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createAdminClient()
    const keys = ['launch_date', 'launch_message', 'preregister_goal', 'preregister_open', 'brand_name', 'platform_version']
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value, description, updated_at')
      .in('key', keys)

    if (error) throw error
    const config: Record<string, string> = {}
    for (const row of data ?? []) {
      config[row.key] = row.value
    }
    return NextResponse.json({ config }, {
      headers: {
        // App config is rarely updated — cache at CDN for 5 min, stale for 1 min
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    console.error('[launch-config] GET error:', err)
    return NextResponse.json({ config: {} })
  }
}
