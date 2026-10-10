// app/api/admin/backup/export/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req) {
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

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('team_id')
    const exportAll = searchParams.get('all') === 'true'

    const timestamp = new Date().toISOString()
    const backup = {
      apextrack_version: '1.0.5',
      export_date: timestamp,
      scope: exportAll ? 'all_tenants' : (teamId ? `tenant_${teamId}` : 'all_tenants'),
      metadata: {},
      records: {},
      photos_manifest: []
    }

    if (teamId && !exportAll) {
      // 1. Single Tenant Export
      const { data: team } = await db.from('teams').select('*').eq('id', teamId).single()
      if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

      backup.metadata = {
        team_id: team.id,
        team_name: team.name,
        short_name: team.short_name,
        country: team.country,
        plan: team.plan,
        created_at: team.created_at,
      }

      const [
        athletesRes,
        staffRes,
        contractsRes,
        injuriesRes,
        sessionsRes,
        noticesRes,
        subRes
      ] = await Promise.all([
        db.from('athletes').select('*').eq('team_id', teamId),
        db.from('profiles').select('id, full_name, email, role, phone, is_active, created_at').eq('team_id', teamId),
        db.from('contracts').select('*').eq('team_id', teamId),
        db.from('injuries').select('*').eq('team_id', teamId),
        db.from('training_sessions').select('*').eq('team_id', teamId),
        db.from('notices').select('*').eq('team_id', teamId),
        db.from('subscriptions').select('*').eq('team_id', teamId)
      ])

      backup.records = {
        teams: [team],
        athletes: athletesRes.data || [],
        profiles: staffRes.data || [],
        contracts: contractsRes.data || [],
        injuries: injuriesRes.data || [],
        training_sessions: sessionsRes.data || [],
        notices: noticesRes.data || [],
        subscriptions: subRes.data || []
      }

      // Collect photos manifest
      const athletePhotos = (athletesRes.data || [])
        .filter(a => a.photo_url)
        .map(a => ({ athlete_id: a.id, name: a.name, photo_url: a.photo_url }))

      if (team.logo_url) {
        backup.photos_manifest.push({ type: 'team_logo', url: team.logo_url })
      }
      backup.photos_manifest.push(...athletePhotos)

    } else {
      // 2. Full Multi-Tenant System Export
      const [
        teamsRes,
        athletesRes,
        profilesRes,
        contractsRes,
        injuriesRes,
        sessionsRes,
        noticesRes,
        subRes
      ] = await Promise.all([
        db.from('teams').select('*'),
        db.from('athletes').select('*'),
        db.from('profiles').select('id, full_name, email, role, phone, team_id, is_active, created_at'),
        db.from('contracts').select('*'),
        db.from('injuries').select('*'),
        db.from('training_sessions').select('*'),
        db.from('notices').select('*'),
        db.from('subscriptions').select('*')
      ])

      backup.metadata = {
        total_teams: teamsRes.data?.length || 0,
        total_athletes: athletesRes.data?.length || 0,
        total_users: profilesRes.data?.length || 0,
      }

      backup.records = {
        teams: teamsRes.data || [],
        athletes: athletesRes.data || [],
        profiles: profilesRes.data || [],
        contracts: contractsRes.data || [],
        injuries: injuriesRes.data || [],
        training_sessions: sessionsRes.data || [],
        notices: noticesRes.data || [],
        subscriptions: subRes.data || []
      }

      backup.photos_manifest = (athletesRes.data || [])
        .filter(a => a.photo_url)
        .map(a => ({ athlete_id: a.id, name: a.name, photo_url: a.photo_url }))
    }

    return NextResponse.json(backup)
  } catch (err) {
    console.error('[Backup Export Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
