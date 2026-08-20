/**
 * lib/logger.js
 *
 * Unified tenant-tagged structured logger for ApexTrack.
 * Works both server-side (API routes) and client-side (browser pages).
 *
 * Tags every log entry with { team_id, user_id, role } so that when a club
 * reports a bug you can filter client_logs by team_id to see exactly the
 * sequence of events that preceded the error.
 *
 * Server usage (API routes):
 *   import { log } from '@/lib/logger'
 *   log.info('Payroll loaded', { count: 12 })
 *   log.error('Insert failed', { table: 'contracts', team_id })
 *
 * Client usage (pages/components):
 *   import { logger } from '@/lib/logger'
 *   logger.setContext({ team_id, user_id, role })
 *   logger.info('Dashboard mounted')
 *   logger.error('Query failed', { table: 'athletes' }, err)
 *   logger.event('athlete_created', { athlete_id })
 */

const IS_DEV      = process.env.NODE_ENV !== 'production'
const IS_BROWSER  = typeof window !== 'undefined'
const LOG_ENDPOINT = '/api/admin/client-log'

// ── Server-side logger (API routes) ─────────────────────────────────────────

function emit(level, message, meta = {}) {
  const entry = { time: new Date().toISOString(), level, message, ...meta }
  if (IS_DEV) {
    const prefix  = `[${level.toUpperCase()}]`
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
    const fn      = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`${prefix} ${message}${metaStr}`)
  } else {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(JSON.stringify(entry))
  }
}

/** Server-side structured logger (for API routes). */
export const log = {
  info:  (message, meta = {}) => emit('info',  message, meta),
  warn:  (message, meta = {}) => emit('warn',  message, meta),
  error: (message, meta = {}) => emit('error', message, meta),
}

export default log

// ── Client-side logger (browser pages / components) ─────────────────────────

let _ctx = { team_id: null, user_id: null, role: null }

function _clientLog(level, message, context = {}, stack = null) {
  const entry = {
    level,
    message,
    context: { ..._ctx, ...context },
    stack,
    team_id: _ctx.team_id || context?.team_id || null,
    user_id: _ctx.user_id || context?.user_id || null,
    url: IS_BROWSER ? window.location.pathname : null,
    timestamp: new Date().toISOString(),
  }

  const prefix = entry.team_id
    ? `[${level.toUpperCase()}][team:${String(entry.team_id).slice(0, 8)}]`
    : `[${level.toUpperCase()}]`

  if (level === 'error') {
    console.error(prefix, message, entry.context)
    if (stack) console.error(stack)
  } else if (level === 'warn') {
    console.warn(prefix, message, entry.context)
  } else {
    console.log(prefix, message, entry.context)
  }

  // Send to server for persistence when team context is known or in production
  if (IS_BROWSER && (!IS_DEV || entry.team_id)) {
    _sendToServer(entry).catch(() => {})
  }
}

async function _sendToServer(entry) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true, // survives page navigation
    })
  } catch {
    // Logging failures must never crash the app
  }
}

/** Client-side tenant-tagged logger (for pages and components). */
export const logger = {
  /**
   * Set the global tenant context — call this once after loading user profile.
   * @param {{ team_id: string, user_id: string, role: string }} ctx
   */
  setContext(ctx) { _ctx = { ..._ctx, ...ctx } },

  /** Clear context on sign-out. */
  clearContext() { _ctx = { team_id: null, user_id: null, role: null } },

  info(message, context = {})          { _clientLog('info',  message, context) },
  warn(message, context = {})          { _clientLog('warn',  message, context) },
  error(message, context = {}, err = null) {
    _clientLog('error', message, context, err?.stack || null)
  },
  event(name, context = {})            { _clientLog('event', name, context) },
}
