import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,


  experimental: {},

  // Silence the Next.js 16 Turbopack "webpack config but no turbopack config"
  // warning so the default Turbopack production build succeeds cleanly.
  turbopack: {},

  // ── Image optimisation ───────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'othntbcrtmemavfsslrb.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com'},
    ],
  },

  // ── HTTP response caching ────────────────────────────────────────────────
  // API routes that are safe to cache at the CDN edge
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/health',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' }],
      },
      {
        source: '/api/product/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
      },
      // Service worker — never cache at CDN so updates propagate immediately
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ]
  },

  // Explicit webpack config ensures Next.js uses webpack (not Turbopack) for
  // production builds, avoiding workspace-root inference issues.
  webpack(config) {
    return config
  },

  typescript: { ignoreBuildErrors: false },
}

export default nextConfig

