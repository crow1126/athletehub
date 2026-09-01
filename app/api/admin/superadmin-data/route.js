import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * GET /api/admin/superadmin-data
 *
 * Returns profiles, teams, and recent activity data for the superadmin dashboard.
 * Uses service role key to bypass RLS policies entirely.
 * Verifies the caller is a superadmin before returning data.
 *
 * Query params:
 *   ?section=all       → profiles + teams + activities
 *   ?section=profiles  → profiles only
 *   ?section=teams     → teams only
 *   ?section=activities → recent activity feed
 *   ?table=TABLE_NAME  → raw table data (for database console)
 */
export async function GET(req) {
  try {
    const db = getDb()
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section') || 'all'
    const tableName = searchParams.get('table')

    // Extract user session from Authorization header or cookie
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the caller is a superadmin
    const { data: { user }, error: authError } = await db.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: superadmin only' }, { status: 403 })
    }

    // Handle raw table query (for database console)
    if (tableName) {
      const allowedTables = ['profiles', 'athletes', 'teams', 'training_sessions', 'injuries', 'transfers', 'subscriptions', 'coaches', 'contracts', 'scouting_reports', 'staff_logins', 'billing_events', 'performance_stats', 'site_clicks']
      if (!allowedTables.includes(tableName)) {
        return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
      }
      const { data, error } = await db.from(tableName).select('*').limit(50)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    const result = {}

    // Analytics
    if (section === 'all' || section === 'analytics') {
      const { data, error } = await db
        .from('site_clicks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) console.error('Clicks fetch error:', error.message)
      result.clicks = data || []
    }

    // Profiles
    if (section === 'all' || section === 'profiles') {
      const { data, error } = await db
        .from('profiles')
        .select('id,full_name,email,club_name,role,is_active,registration_status,created_at,club_logo_url,phone,team_id')
        .order('created_at', { ascending: false })
      if (error) console.error('Profiles fetch error:', error.message)
      result.profiles = data || []

      // Also return athletes list for client-side ID resolving
      const { data: athletes, error: athletesError } = await db
        .from('athletes')
        .select('id,name,team_id')
      if (athletesError) console.error('Athletes fetch error:', athletesError.message)
      result.athletes = athletes || []
    }

    // Teams & Subscriptions & Profile reconciliation
    if (section === 'all' || section === 'teams' || section === 'profiles') {
      // 1. Fetch current teams and profiles
      const [teamsRes, profilesRaw] = await Promise.all([
        db.from('teams').select('*').order('created_at', { ascending: false }),
        db.from('profiles').select('id,full_name,email,club_name,role,is_active,registration_status,created_at,club_logo_url,phone,team_id')
      ])

      let currentTeams = teamsRes.data || []
      const currentProfiles = profilesRaw.data || []

      // 2. Auto-reconcile: find any profiles with club_name that have no team_id or team row
      for (const p of currentProfiles) {
        if (p.club_name && p.club_name.trim() && p.role !== 'superadmin') {
          const clubNameClean = p.club_name.trim()
          let matchingTeam = currentTeams.find(t => t.id === p.team_id || t.name?.toLowerCase() === clubNameClean.toLowerCase())

          if (!matchingTeam) {
            // Create team for this club
            const shortName = clubNameClean
              .split(' ')
              .map(w => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 4)

            const { data: newTeam, error: teamCreateErr } = await db
              .from('teams')
              .insert([{
                name: clubNameClean,
                short_name: shortName,
                logo_url: p.club_logo_url || null,
              }])
              .select()
              .single()

            if (!teamCreateErr && newTeam) {
              matchingTeam = newTeam
              currentTeams.unshift(newTeam)
            }
          }

          // Link profile to team if unlinked or logo mismatch
          if (matchingTeam?.id) {
            const updates = {}
            if (p.team_id !== matchingTeam.id) updates.team_id = matchingTeam.id
            if (matchingTeam.logo_url && !p.club_logo_url) updates.club_logo_url = matchingTeam.logo_url
            if (!matchingTeam.logo_url && p.club_logo_url) {
              await db.from('teams').update({ logo_url: p.club_logo_url }).eq('id', matchingTeam.id)
              matchingTeam.logo_url = p.club_logo_url
            }

            if (Object.keys(updates).length > 0) {
              await db.from('profiles').update(updates).eq('id', p.id)
              p.team_id = matchingTeam.id
              if (updates.club_logo_url) p.club_logo_url = updates.club_logo_url
            }
          }
        }
      }

      // 3. Ensure Apex Test Sandbox exists
      const existingSandbox = currentTeams.find(t => t.name?.toLowerCase().includes('sandbox'))
      if (!existingSandbox) {
        const { data: newSandbox } = await db.from('teams').insert([{
          name: 'Apex Test Sandbox',
          short_name: 'TEST',
          primary_color: '#0D9488'
        }]).select().single()
        if (newSandbox?.id) {
          currentTeams.push(newSandbox)
        }
      }

      // 4. Ensure all teams have a subscription row
      const { data: existingSubs } = await db.from('subscriptions').select('*')
      const currentSubs = existingSubs || []

      for (const t of currentTeams) {
        const hasSub = currentSubs.some(s => s.team_id === t.id)
        if (!hasSub) {
          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + 30)
          const isSandbox = t.name?.toLowerCase().includes('sandbox')
          if (isSandbox) trialEnd.setFullYear(trialEnd.getFullYear() + 10)

          const { data: createdSub } = await db.from('subscriptions').insert([{
            team_id: t.id,
            plan: isSandbox ? 'captain' : 'trial',
            status: 'active',
            athlete_limit: isSandbox ? 999999 : 999,
            staff_limit: isSandbox ? 99999 : 99,
            trial_ends_at: trialEnd.toISOString(),
            current_period_end: trialEnd.toISOString(),
            notes: isSandbox ? 'Test Sandbox VIP' : 'Auto-provisioned initial trial',
          }]).select().single()

          if (createdSub) {
            currentSubs.push(createdSub)
          }
        }
      }

      result.teams = currentTeams
      result.subscriptions = currentSubs
      result.profiles = currentProfiles
    }

    // Activities
    if (section === 'all' || section === 'activities') {
      const [profilesRes, athletesRes, teamsRes] = await Promise.all([
        db.from('profiles').select('full_name, email, club_name, created_at').order('created_at', { ascending: false }).limit(6),
        db.from('athletes').select('name, created_at').order('created_at', { ascending: false }).limit(6),
        db.from('teams').select('name, created_at').order('created_at', { ascending: false }).limit(6),
      ])
      result.recentProfiles = profilesRes.data || []
      result.recentAthletes = athletesRes.data || []
      result.recentTeams = teamsRes.data || []
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Superadmin data error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
