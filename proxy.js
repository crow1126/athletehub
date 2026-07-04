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
const PUBLIC_PREFIXES = ['/login', '/auth', '/privacy', '/terms', '/security', '/api/', '/forgot-password']
const PUBLIC_EXACT    = ['/']

export async function proxy(request) {
  const url      = request.nextUrl.clone()
  const host     = request.headers.get('host') || ''
  const hostname = host.split(':')[0]

  // ── CORS / Origin protection for API routes (exclude webhooks & crons) ─────
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/') && !pathname.startsWith('/api/cron/')) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    
    try {
      if (origin) {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          console.warn(`[CORS Blocked] Origin: ${origin} does not match Host: ${host}`)
          return new NextResponse('Forbidden (CORS Policy)', { status: 403 })
        }
      } else if (referer) {
        const refererUrl = new URL(referer)
        if (refererUrl.host !== host) {
          console.warn(`[CORS Blocked] Referer: ${referer} does not match Host: ${host}`)
          return new NextResponse('Forbidden (CORS Policy)', { status: 403 })
        }
      }
    } catch (err) {
      console.error('[CORS Check Error]', err.message)
      return new NextResponse('Bad Request', { status: 400 })
    }
  }

  // ── 1. Decide if subdomain rewrite is needed (don't return yet) ───────────
  const isPaySubdomain =
    hostname === 'pay.apextrackgh.com' ||
    hostname.startsWith('pay.localhost') ||
    hostname.startsWith('pay.127.0.0.1')

  let rewriteUrl = null
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
      rewriteUrl = url
    }
  }

  // ── 2. Skip auth check for public routes & static assets ──────────────────
  // Check against the rewritten path so /pay/* routes are also guarded.
  const checkPath = rewriteUrl?.pathname ?? request.nextUrl.pathname
  const isPublic =
    PUBLIC_EXACT.includes(checkPath) ||
    PUBLIC_PREFIXES.some(p => checkPath.startsWith(p)) ||
    checkPath.match(/\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot|ico)$/)

  if (isPublic) {
    return rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next()
  }

  // ── 3. Session validation + cookie refresh ─────────────────────────────────
  // Build the final response object now (rewrite or passthrough) so the
  // refreshed Supabase cookie can be attached to it before we return.
  const response     = rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next()
  const cookieDomain = getCookieDomain(hostname)

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
    // Always redirect to the main domain login, never stay on the pay subdomain
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
