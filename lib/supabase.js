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
 * Cookie-based Supabase browser client.
 *
 * The cookie is scoped to `.apextrackgh.com` (leading dot), which means it is
 * automatically sent on BOTH apextrackgh.com and pay.apextrackgh.com.
 * This is the only config change needed for cross-subdomain SSO — no token
 * passing in URLs, no redirects, no extra backend work.
 *
 * On localhost / IP addresses the domain is omitted so the cookie is still
 * set correctly for local development.
 */
function getCookieDomain() {
  if (typeof window === 'undefined') return undefined
  // Inside Electron desktop app, do not set domain scoping on cookies so session storage works cleanly
  if (window.electronAPI?.isElectron || (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron'))) {
    return undefined
  }
  const hostname = window.location.hostname
  // Don't scope to a domain on localhost or IP addresses
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return undefined
  }
  // Strip any existing subdomain prefix so we always get the apex domain
  const parts = hostname.split('.')
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.')   // e.g. ".apextrackgh.com"
  }
  return undefined
}

const rawClient = createBrowserClient(supabaseUrl, supabaseKey, {
  cookieOptions: {
    domain:   getCookieDomain(),
    path:     '/',
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    // Keep users logged in for 30 days across browser restarts and PWA cold starts
    maxAge:   60 * 60 * 24 * 30,
  },
  auth: {
    // Persist session in both cookies AND localStorage as a fallback
    // This ensures PWA "Add to Home Screen" users stay logged in
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    storageKey: 'apextrack-auth',
  },
  global: {
    fetch: fetchWithTimeout,
  },
})

export const supabase = rawClient