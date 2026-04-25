import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Security Guard: Detect if a service_role key is accidentally passed
  try {
    if (anonKey) {
      // Check for new Supabase secret key format
      if (anonKey.startsWith('sb_secret_')) {
        throw new Error(`Forbidden use of secret API key in browser (sb_secret_ key detected). Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment settings.`)
      }

      const parts = anonKey.split('.')
      if (parts.length === 3) {
        // Robust base64 decoding to handle missing padding
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) base64 += '='
        const payload = JSON.parse(atob(base64))
        
        if (payload.role === 'service_role' || payload.role === 'supabase_admin') {
          const maskedKey = anonKey.substring(0, 10) + '...'
          console.error(`CRITICAL SECURITY ERROR: Browser client initialized with a SERVICE_ROLE key (starts with: ${maskedKey}). Access blocked.`)
          throw new Error(`Forbidden use of secret API key in browser (Key starts with ${maskedKey}). Please check your NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment settings.`)
        }
      }
    }
  } catch (e) {
    if ((e as Error).message.includes("Forbidden")) throw e
    console.warn("Supabase Security Check: JWT format unrecognized or custom role in use.")
  }

  return createSupabaseBrowserClient(url, anonKey)
}
