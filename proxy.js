import { NextResponse } from 'next/server'

export function proxy(request) {
  const url = request.nextUrl.clone()
  const host = request.headers.get('host') || ''

  // Subdomain match: pay.apextrackgh.com or local testing pay.localhost:3000
  const isPaySubdomain = host.startsWith('pay.apextrackgh.com') || host.startsWith('pay.localhost')

  if (isPaySubdomain) {
    const path = url.pathname
    
    // Rewrite path to the /pay route group
    if (
      !path.startsWith('/pay') &&
      !path.startsWith('/_next') &&
      !path.startsWith('/api') &&
      !path.includes('.')
    ) {
      url.pathname = `/pay${path}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Apply proxy to all pages, excluding specific static assets
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)',
  ],
}
