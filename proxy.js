import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * Returns the apex-domain cookie scope, e.g. ".apextrackgh.com".
 * Returns undefined on localhost / IP so cookies still work locally.
 */
function getCookieDomain(hostname) {
  if (!hostname || hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return undefined
  }
  const parts = hostname.split('.')
  return parts.length >= 2 ? '.' + parts.slice(-2).join('.') : undefined
}

// Routes that don't require authentication
const PUBLIC_PREFIXES = ['/login', '/auth', '/privacy', '/terms', '/security', '/api/']
const PUBLIC_EXACT    = ['/']

export async function proxy(request) {
  const url  = request.nextUrl.clone()
  const host = request.headers.get('host') || ''
  const hostname = host.split(':')[0]

  // ── 1. Subdomain rewrite (pay.apextrackgh.com → /pay) ─────────────────────
  const isPaySubdomain =
    hostname === 'pay.apextrackgh.com' ||
    hostname.startsWith('pay.localhost') ||
    hostname.startsWith('pay.127.0.0.1')

  if (isPaySubdomain) {
    const path = url.pathname
    if (
      !path.startsWith('/pay') &&
      !path.startsWith('/_next') &&
      !path.startsWith('/api') &&
      !path.startsWith('/login') &&
      !path.startsWith('/auth') &&
      !path.includes('.')
    ) {
      url.pathname = `/pay${path === '/' ? '' : path}`
      return NextResponse.rewrite(url)
    }
  }

  // ── 2. Skip auth check for public routes & static assets ──────────────────
  const { pathname } = request.nextUrl
  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot|ico)$/)

  if (isPublic) return NextResponse.next()

  // ── 3. Session validation + cookie refresh ─────────────────────────────────
  const cookieDomain = getCookieDomain(hostname)
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Write refreshed tokens back with the apex-domain scope
            response.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
              path:     '/',
              sameSite: 'lax',
              secure:   process.env.NODE_ENV === 'production',
            })
          })
        },
      },
    }
  )

  // getUser() validates the JWT server-side and silently refreshes the token
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Always redirect to the main domain login, never the pay subdomain
    const loginUrl = isPaySubdomain
      ? new URL('https://apextrackgh.com/login', request.url)
      : new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|icon.png).*)',
  ],
}
