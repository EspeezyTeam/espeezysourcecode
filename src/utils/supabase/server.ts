import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── REGIONAL READ REPLICA ROUTING ───────────────────────────────────────────
// Supabase Read Replicas are co-located with each Vercel region so reads hit a
// DB server <20ms away instead of traveling to the primary in us-east-1.
//
// Env vars (set per-region in Vercel dashboard, or globally with all replica URLs):
//   SUPABASE_READ_URL_IAD1  — US East  (Washington DC)
//   SUPABASE_READ_URL_LHR1  — EU West  (London)
//   SUPABASE_READ_URL_SYD1  — AP Southeast (Sydney)
//   SUPABASE_READ_URL_SIN1  — AP Southeast (Singapore)
//   SUPABASE_READ_URL_CDG1  — EU West  (Paris)
//   SUPABASE_READ_URL_BOM1  — AP South  (Mumbai)
//   SUPABASE_READ_URL_GRU1  — SA East  (São Paulo)
//   SUPABASE_READ_URL_HND1  — AP Northeast (Tokyo)
//   SUPABASE_READ_URL_ICN1  — AP Northeast (Seoul)
//   SUPABASE_READ_URL_KIX1  — AP Northeast (Osaka)
//   SUPABASE_READ_URL_SFO1  — US West  (San Francisco)
//   SUPABASE_READ_URL_CLE1  — US East  (Cleveland)
//   SUPABASE_READ_URL_DUB1  — EU West  (Dublin)
//
// Falls back to NEXT_PUBLIC_SUPABASE_URL (primary) when no replica is configured.
// Writes ALWAYS go to the primary — never to a replica.

const REGION_TO_READ_URL: Record<string, string | undefined> = {
  iad1: process.env.SUPABASE_READ_URL_IAD1,
  lhr1: process.env.SUPABASE_READ_URL_LHR1,
  syd1: process.env.SUPABASE_READ_URL_SYD1,
  sin1: process.env.SUPABASE_READ_URL_SIN1,
  cdg1: process.env.SUPABASE_READ_URL_CDG1,
  bom1: process.env.SUPABASE_READ_URL_BOM1,
  gru1: process.env.SUPABASE_READ_URL_GRU1,
  hnd1: process.env.SUPABASE_READ_URL_HND1,
  icn1: process.env.SUPABASE_READ_URL_ICN1,
  kix1: process.env.SUPABASE_READ_URL_KIX1,
  sfo1: process.env.SUPABASE_READ_URL_SFO1,
  cle1: process.env.SUPABASE_READ_URL_CLE1,
  dub1: process.env.SUPABASE_READ_URL_DUB1,
}

function getNearestReadUrl(): string {
  const region = (process.env.VERCEL_REGION ?? '').toLowerCase()
  const rawUrl = REGION_TO_READ_URL[region] ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  
  // Validate URL format to prevent @supabase/ssr from throwing
  if (!rawUrl || !rawUrl.startsWith('http')) {
    return 'https://placeholder.supabase.co'
  }
  return rawUrl
}

// ─── READ CLIENT (replica-routed, anon key) ───────────────────────────────────
// Use for SELECT-only queries: feed, profiles, search, product pages.
// Routes to the nearest regional replica for sub-20ms latency globally.
// Returns the primary when VERCEL_REGION is not set (local dev / CI).
export function createReadClient() {
  const url = getNearestReadUrl()
  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
      global: {
        headers: { 'x-application-name': 'espeezy-read', 'x-read-replica': url !== process.env.NEXT_PUBLIC_SUPABASE_URL! ? '1' : '0' },
      },
    }
  )
}

// ─── ADMIN CLIENT SINGLETON (primary, service-role) ──────────────────────────
// Always points to the primary — writes must never go to a replica.
// Singleton is safe because admin client holds no per-request state.
let _adminClient: ReturnType<typeof createServerClient> | null = null

export async function createAdminClient() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const validUrl = (url && url.startsWith('http')) ? url : 'https://placeholder.supabase.co'
    
    _adminClient = createServerClient(
      validUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'no-key',
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
        global: {
          headers: { 'x-application-name': 'espeezy-admin' },
        },
      }
    )
  }
  return _adminClient
}

// ─── PER-REQUEST AUTH CLIENT (primary, anon key) ──────────────────────────────
// Must be created fresh per-request because it reads/writes auth cookies.
// Uses the primary for any writes or auth-sensitive reads.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const validUrl = (url && url.startsWith('http')) ? url : 'https://placeholder.supabase.co'

  const client = createServerClient(
    validUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'no-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — session middleware handles refresh
          }
        },
      },
    }
  )

  // ─── MOCK TESTING PATCH ──────────────────────────────────────────────────
  // If a mock session cookie is present, return a mock user immediately.
  // This allows E2E tests to run without a live Supabase connection.
  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (async (...args: any[]) => {
    const mockCookie = cookieStore.get('sb-mock-token')
    if (mockCookie) {
      return { data: { user: { id: 'mock-user-uuid', email: 'mock@test.dev' } }, error: null }
    }
    return originalGetUser(...args)
  }) as any

  return client
}

// ─── SAFE AUTH HELPER ─────────────────────────────────────────────────────────
// Wraps getUser() so a network error (ENOTFOUND, fetch failed, etc.) returns
// null instead of throwing — preventing unhandled 500s on API routes.
// Usage: const user = await getAuthUser(); if (!user) return 401;
export async function getAuthUser() {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    return user
  } catch {
    return null
  }
}

