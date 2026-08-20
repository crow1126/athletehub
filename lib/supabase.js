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
  },
  global: {
    fetch: fetchWithTimeout,
  },
})

// Safe Read-Only Mutation Interceptor for Superadmin Inspection Mode
function wrapClientWithReadOnlyGuard(client) {
  const originalFrom = client.from.bind(client)

  client.from = function(table) {
    const builder = originalFrom(table)

    const isReadOnlyActive = () => {
      if (typeof window === 'undefined') return false
      try {
        const val = localStorage.getItem('apex_superadmin_readonly')
        const activeTeam = localStorage.getItem('apex_superadmin_active_team')
        // Read-only applies if explicitly 'true' OR if inspecting a real club and not explicitly set to 'false'
        if (val === 'true' || (val === null && activeTeam && activeTeam !== 'sandbox')) {
          return true
        }
      } catch {
        return false
      }
      return false
    }

    const blockedError = (action) => ({
      message: `[Read-Only Mode] Database ${action} on "${table}" was blocked to protect club data. Switch to 'Live Action Access' in the top header to make changes.`
    })

    const notifyBlocked = (action) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('apex_readonly_blocked', {
          detail: { table, action }
        }))
      }
    }

    const createBlockedChain = (action) => {
      const err = blockedError(action)
      const chain = {
        eq: () => chain,
        neq: () => chain,
        gt: () => chain,
        gte: () => chain,
        lt: () => chain,
        lte: () => chain,
        like: () => chain,
        ilike: () => chain,
        is: () => chain,
        in: () => chain,
        match: () => chain,
        filter: () => chain,
        not: () => chain,
        or: () => chain,
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        single: () => chain,
        maybeSingle: () => chain,
        then: (onFulfilled) => Promise.resolve({ data: null, error: err }).then(onFulfilled),
        catch: (onRejected) => Promise.resolve({ data: null, error: err }).catch(onRejected),
      }
      return chain
    }

    // Guard insert
    const origInsert = builder.insert.bind(builder)
    builder.insert = function(...args) {
      if (isReadOnlyActive()) {
        notifyBlocked('insert')
        return createBlockedChain('insert')
      }
      return origInsert(...args)
    }

    // Guard update
    const origUpdate = builder.update.bind(builder)
    builder.update = function(...args) {
      if (isReadOnlyActive()) {
        notifyBlocked('update')
        return createBlockedChain('update')
      }
      return origUpdate(...args)
    }

    // Guard delete
    const origDelete = builder.delete.bind(builder)
    builder.delete = function(...args) {
      if (isReadOnlyActive()) {
        notifyBlocked('delete')
        return createBlockedChain('delete')
      }
      return origDelete(...args)
    }

    // Guard upsert
    const origUpsert = builder.upsert.bind(builder)
    builder.upsert = function(...args) {
      if (isReadOnlyActive()) {
        notifyBlocked('upsert')
        return createBlockedChain('upsert')
      }
      return origUpsert(...args)
    }

    return builder
  }

  return client
}

export const supabase = wrapClientWithReadOnlyGuard(rawClient)