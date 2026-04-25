import { createServerSupabaseClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // next is the path to redirect to after success
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  if (errorParam || errorDesc) {
    const msg = errorDesc || errorParam || 'OAuth authentication failed'
    console.error('[Auth Callback] Provider Error:', msg)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if this is a password recovery flow
      const { data: { user } } = await supabase.auth.getUser()
      const isRecovery = searchParams.get('type') === 'recovery' || !user?.last_sign_in_at

      // Validate redirect path — must be a relative path on same origin (open redirect prevention)
      const rawNext = next
      const isSafeRedirect = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':')
      const safePath = isSafeRedirect ? rawNext : '/dashboard'

      const redirectPath = isRecovery ? '/auth/reset-password' : safePath
      const redirectUrl = new URL(redirectPath, origin).toString()
      return NextResponse.redirect(redirectUrl)
    }
    
    console.error('[Auth Callback] Exchange Error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Invalid or missing authentication code. Visit your Supabase Dashboard to verify Redirect URIs.`)
}
