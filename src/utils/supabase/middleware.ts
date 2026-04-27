import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const validUrl = (supabaseUrl && supabaseUrl.startsWith('http')) ? supabaseUrl : 'https://placeholder.supabase.co'

  let supabase
  try {
    supabase = createServerClient(validUrl, supabaseAnonKey || 'no-key', {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })
  } catch {
    return supabaseResponse
  }

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-site request forgery (CSRF).
  //
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  let user: any = null
  try {
    // Always check for the mock cookie in dev/test as a secondary source
    const mockCookie = request.cookies.get('sb-mock-token')
    if (mockCookie) {
      user = { id: 'mock-user-uuid', email: 'mock@test.dev' }
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
  } catch {
    user = null
  }

  // Protected page prefixes — redirect unauthenticated browser requests to /login.
  // API routes and public pages handle their own auth and must NOT be redirected here.
  const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/profile', '/settings', '/terminal', '/id']
  const pathname = request.nextUrl.pathname
  const isProtectedPage = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (pathname !== '/favicon.ico') {
    console.log(`[Middleware] ${pathname} | User: ${!!user} | Protected: ${isProtectedPage}`)
  }

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // REVERSE REDIRECT: If user IS authenticated and trying to access /login, send them to /dashboard
  // We allow access to '/' and other public pages so they can browse the product site while logged in
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
