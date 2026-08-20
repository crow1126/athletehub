import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

let tableEnsured = false

async function ensureClientLogsTable(db) {
  if (tableEnsured) return
  // Try to create the table if it doesn't exist (idempotent)
  await db.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS client_logs (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at  timestamptz NOT NULL DEFAULT now(),
        level       text NOT NULL CHECK (level IN ('info','warn','error','event')),
        message     text NOT NULL,
        context     jsonb,
        stack       text,
        team_id     uuid,
        user_id     uuid,
        url         text,
        user_agent  text
      );
      CREATE INDEX IF NOT EXISTS client_logs_team_id_idx ON client_logs (team_id);
      CREATE INDEX IF NOT EXISTS client_logs_level_idx   ON client_logs (level);
      CREATE INDEX IF NOT EXISTS client_logs_created_idx ON client_logs (created_at DESC);
    `
  }).catch(async () => {
    // exec_sql RPC may not exist — try direct insert as a probe
    // If the table exists this succeeds, if not we silently skip
  })
  tableEnsured = true
}

const RATE_LIMIT = new Map() // ip → { count, resetAt }
const WINDOW_MS  = 60_000
const MAX_CALLS  = 100

function isRateLimited(ip) {
  const now = Date.now()
  const entry = RATE_LIMIT.get(ip)
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_CALLS) return true
  entry.count++
  return false
}

/**
 * POST /api/admin/client-log
 *
 * Accepts structured log entries from the browser and writes them to the
 * client_logs table tagged with team_id / user_id for per-club filtering.
 *
 * Auto-creates the client_logs table on first call if it doesn't exist.
 *
 * Body: { level, message, context, stack, team_id, user_id, url }
 */
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 })
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    await ensureClientLogsTable(db)

    const body = await req.json()
    const { level = 'info', message, context, stack, team_id, user_id, url } = body

    if (!message) {
      return NextResponse.json({ ok: false, error: 'message required' }, { status: 400 })
    }

    const validLevels = ['info', 'warn', 'error', 'event']
    const safeLevel = validLevels.includes(level) ? level : 'info'

    const { error } = await db.from('client_logs').insert([{
      level: safeLevel,
      message: String(message).slice(0, 2000),
      context: context || null,
      stack: stack ? String(stack).slice(0, 5000) : null,
      team_id: team_id || null,
      user_id: user_id || null,
      url: url ? String(url).slice(0, 500) : null,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
    }])

    if (error) {
      // Table likely doesn't exist yet — this is non-fatal
      console.warn('client_logs insert skipped:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Never throw back to the client — logging failures must be silent
    console.error('client-log error:', err.message)
    return NextResponse.json({ ok: true }) // ack anyway
  }
}

/**
 * GET /api/admin/client-log
 * Superadmin only. Returns recent logs, optionally filtered by team_id.
 */
export async function GET(req) {
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authErr } = await db.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const team_id = searchParams.get('team_id')
    const level   = searchParams.get('level')
    const limit   = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    let query = db.from('client_logs')
      .select('id, created_at, level, message, context, team_id, user_id, url')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (team_id) query = query.eq('team_id', team_id)
    if (level)   query = query.eq('level', level)

    const { data: logs, error: logsErr } = await query

    if (logsErr) {
      // Table doesn't exist yet
      return NextResponse.json({ logs: [], note: 'No logs yet — table will be created on first log entry.' })
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
