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

// Auto-mirror auth session into localStorage so mobile apps (Capacitor/WebView)
// retain authentication even if Android OS kills the process before flushing cookies to disk.
if (typeof window !== 'undefined') {
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (session) {
          localStorage.setItem('sb-session-backup', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: { id: session.user?.id, email: session.user?.email },
            expires_at: session.expires_at,
          }))
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('sb-session-backup')
        }
      } catch (_e) {}
    })

    // Rehydrate session from localStorage if document.cookie was purged by OS
    const hasSbCookie = document.cookie.includes('sb-')
    const rawBackup = localStorage.getItem('sb-session-backup')
    if (!hasSbCookie && rawBackup) {
      const parsed = JSON.parse(rawBackup)
      if (parsed?.access_token && parsed?.refresh_token) {
        supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        }).catch(() => {})
      }
    }
  } catch (_err) {}
}