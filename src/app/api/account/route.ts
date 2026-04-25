import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkBotId } from 'botid/server'

export async function GET() {
  // BotID Verification (only available in Vercel cloud — skip locally)
  try {
    const verification = await checkBotId()
    if (verification.isBot) {
      return new NextResponse('Automated request intercepted. Only verified scholars may export archives.', { status: 403 })
    }
  } catch {
    // checkBotId requires Vercel OIDC token — not available outside Vercel cloud
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

    if (!user) {
      return new NextResponse('Unauthorized Pipeline', { status: 401 })
    }

    // Fetch all data concurrently — avoids 3× sequential round-trips
    const [{ data: profile }, { data: tasks }, { data: artifacts }] = await Promise.all([
      supabase.from('profiles').select('*, groups(*)').eq('id', user.id).single(),
      supabase.from('tasks').select('*').contains('assignees', [user.id]),
      supabase.from('artifacts').select('*').eq('uploaded_by', user.id),
    ])

    // Assemble "Takeout" Package
    const exportData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      identity: profile,
      execution_log: tasks || [],
      evidence_ledger: artifacts || []
    }

    // Deliver as JSON Blob
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="Espeezy-archive-${user.id}.json"`
      }
    })

  } catch (err: unknown) {
    console.error("Export Engine Failure:", err instanceof Error ? err.message : err)
    return new NextResponse('Server Fault: export failed', { status: 500 })
  }
}

export async function DELETE() {
  // BotID Verification
  const verification = await checkBotId()
  if (verification.isBot) {
    return new NextResponse('Automated termination request intercepted. Only verified scholars may obliterate their identity.', { status: 403 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

    if (!user) {
      return new NextResponse('Unauthorized Pipeline', { status: 401 })
    }

    // Initialize Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
       return new NextResponse('Critical Architecture Fault: Missing Service Role Key bounds to perform global trace deletion.', { status: 500 })
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

    // 1. Permanently Obliterate Auth Bounds (This automatically cascades via Database RLS policies deleting the profile)
    const { error } = await adminClient.auth.admin.deleteUser(user.id)
    
    if (error) {
       return new NextResponse(`Admin Deletion Fault: ${error.message}`, { status: 400 })
    }

    // Successfully purged.
    return new NextResponse('Account successfully terminated.', { status: 200 })

  } catch (err: unknown) {
    console.error("Termination Engine Failure:", err instanceof Error ? err.message : err)
    return new NextResponse('Server Fault: deletion failed', { status: 500 })
  }
}
