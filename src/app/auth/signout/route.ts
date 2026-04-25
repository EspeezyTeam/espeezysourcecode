import { createServerSupabaseClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()

  // Destroy the local authentication session globally on the server.
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  })
}
