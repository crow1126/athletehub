import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
  )
}

// Custom fetch with 10s timeout — prevents hanging on mobile networks
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

/**
 * Cookie domain helper for cross-subdomain SSO.
 * ONLY set to '.apextrackgh.com' when running on apextrackgh.com.
 * For Electron desktop app, localhost, IP addresses, or Vercel preview domains,
 * return undefined so cookies are set directly for the host origin without being rejected.
 */
function getCookieDomain() {
  if (typeof window === 'undefined') return undefined
  if (
    window.electronAPI?.isElectron ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('ApexTrackDesktop'))
  ) {
    return undefined
  }
  const hostname = window.location.hostname
  if (!hostname || hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return undefined
  }
  if (hostname.endsWith('apextrackgh.com')) {
    return '.apextrackgh.com'
  }
  return undefined
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  isSingleton: true,
  cookieOptions: {
    domain:   getCookieDomain(),
    path:     '/',
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 365, // 1 year cookie persistence
  },
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
})