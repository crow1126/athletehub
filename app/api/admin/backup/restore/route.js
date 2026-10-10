// app/api/admin/backup/restore/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req) {
  try {
    const db = getDb()
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await db.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin only' }, { status: 403 })
    }

    const payload = await req.json()
    if (!payload?.records || typeof payload.records !== 'object') {
      return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 })
    }

    const { records } = payload
    const summary = {}

    // 1. Teams
    if (Array.isArray(records.teams) && records.teams.length > 0) {
      const { error: tErr } = await db.from('teams').upsert(records.teams, { onConflict: 'id' })
      if (tErr) console.warn('[Restore] teams warning:', tErr.message)
      summary.teams_restored = records.teams.length
    }

    // 2. Athletes
    if (Array.isArray(records.athletes) && records.athletes.length > 0) {
      const { error: aErr } = await db.from('athletes').upsert(records.athletes, { onConflict: 'id' })
      if (aErr) console.warn('[Restore] athletes warning:', aErr.message)
      summary.athletes_restored = records.athletes.length
    }

    // 3. Contracts
    if (Array.isArray(records.contracts) && records.contracts.length > 0) {
      const { error: cErr } = await db.from('contracts').upsert(records.contracts, { onConflict: 'id' })
      if (cErr) console.warn('[Restore] contracts warning:', cErr.message)
      summary.contracts_restored = records.contracts.length
    }

    // 4. Injuries
    if (Array.isArray(records.injuries) && records.injuries.length > 0) {
      const { error: iErr } = await db.from('injuries').upsert(records.injuries, { onConflict: 'id' })
      if (iErr) console.warn('[Restore] injuries warning:', iErr.message)
      summary.injuries_restored = records.injuries.length
    }

    // 5. Training Sessions
    if (Array.isArray(records.training_sessions) && records.training_sessions.length > 0) {
      const { error: sErr } = await db.from('training_sessions').upsert(records.training_sessions, { onConflict: 'id' })
      if (sErr) console.warn('[Restore] sessions warning:', sErr.message)
      summary.training_sessions_restored = records.training_sessions.length
    }

    // 6. Notices
    if (Array.isArray(records.notices) && records.notices.length > 0) {
      const { error: nErr } = await db.from('notices').upsert(records.notices, { onConflict: 'id' })
      if (nErr) console.warn('[Restore] notices warning:', nErr.message)
      summary.notices_restored = records.notices.length
    }

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
      summary,
    })
  } catch (err) {
    console.error('[Backup Restore Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
