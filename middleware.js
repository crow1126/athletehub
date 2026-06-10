import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * Returns the apex domain for cookie scoping.
 * On localhost / Vercel preview URLs / IP addresses we return undefined so
 * the cookie is still set (just not cross-subdomain, which is fine locally).
 */
function getCookieDomain(hostname) {
  if (!hostname || hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return undefined
  }
  // e.g. "pay.apextrackgh.com" → ".apextrackgh.com"
  const parts = hostname.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.')
  }
  return undefined
}

export async function middleware(request) {
  const response = NextResponse.next()
  const hostname = request.headers.get('host')?.split(':')[0] || ''
  const cookieDomain = getCookieDomain(hostname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Ensure every cookie written by Supabase is scoped to the apex domain
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

  // IMPORTANT: getUser() (not getSession()) to validate the JWT server-side.
  // This also silently refreshes the access token when it's near expiry and
  // writes the refreshed cookie back via setAll above.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated users trying to reach protected routes → send to login
  if (!user) {
    // Determine login URL: always on the main domain, never on the pay subdomain
    const isPaySubdomain = hostname.startsWith('pay.')
    const loginBase = isPaySubdomain
      ? `${request.nextUrl.protocol}//apextrackgh.com/login`
      : '/login'

    const loginUrl = new URL(loginBase, request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico, icon.png
     *  - public files with an extension (images, fonts, etc.)
     *  - API routes that handle their own auth (serverAuth.js / Bearer tokens)
     *  - The login page and public pages themselves
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot)$|login|auth|privacy|terms|security|api/).*)',
  ],
}
