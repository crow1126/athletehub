import { NextResponse } from 'next/server'

export function proxy(request) {
  const url = request.nextUrl.clone()
  const host = request.headers.get('host') || ''

  // Match pay.apextrackgh.com and pay.localhost:PORT (any port)
  const isPaySubdomain =
    host === 'pay.apextrackgh.com' ||
    host.startsWith('pay.apextrackgh.com:') ||
    host.startsWith('pay.localhost') ||
    host.startsWith('pay.127.0.0.1')

  if (isPaySubdomain) {
    const path = url.pathname
    
    // Rewrite path to the /pay route group
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|icon.png).*)',
  ],
}
