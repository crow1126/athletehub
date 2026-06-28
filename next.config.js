/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['10.244.248.115'],

  // ── Security & CORS headers on all routes ─────────────────────────────────
  async headers() {
    // Determine the production origin — falls back to env var or a wildcard
    // that you should tighten once your domain is confirmed.
    const prodOrigin = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || '*'

    return [
      {
        // Apply security headers to every route
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options',           value: 'DENY' },
          // Block MIME sniffing
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          // Force HTTPS for 1 year, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Referrer policy: send origin only across origins
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          // Minimal permissions policy
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          // Basic Content-Security-Policy (permits Next.js inline scripts & Google Fonts)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires inline+eval
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.moolre.com https://pos.moolre.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        // CORS for API routes — restrict to own domain in production
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: prodOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Requested-With' },
          { key: 'Access-Control-Max-Age',       value: '86400' },
        ],
      },
    ]
  },
}

module.exports = nextConfig