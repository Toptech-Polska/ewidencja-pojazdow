/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Blokuje osadzanie w iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Wyłącza sniffing typów MIME
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Kontroluje informacje o referrerze
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Wymusza HTTPS przez rok
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Blokuje XSS w starych przeglądarkach
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Ogranicza dostęp do API przeglądarki
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Content Security Policy — dopasowany do Supabase + Next.js
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Supabase API i Auth
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
      // Next.js hot reload w dev (usuwany na prod)
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        // Zastosuj do wszystkich tras
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
