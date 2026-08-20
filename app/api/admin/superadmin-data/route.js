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

    // Teams & Subscriptions
    if (section === 'all' || section === 'teams' || section === 'profiles') {
      // Ensure Apex Test Sandbox exists
      const { data: existingSandbox } = await db.from('teams').select('id').ilike('name', '%sandbox%').maybeSingle()
      if (!existingSandbox) {
        const { data: newSandbox } = await db.from('teams').insert([{
          name: 'Apex Test Sandbox',
          short_name: 'TEST',
          primary_color: '#0D9488'
        }]).select().single()
        if (newSandbox?.id) {
          const trialEnd = new Date(); trialEnd.setFullYear(trialEnd.getFullYear() + 10)
          await db.from('subscriptions').insert([{
            team_id: newSandbox.id,
            plan: 'captain',
            status: 'active',
            current_period_end: trialEnd.toISOString()
          }])
        }
      }

      const [teamsRes, subsRes] = await Promise.all([
        db.from('teams').select('*').order('created_at', { ascending: false }),
        db.from('subscriptions').select('*'),
      ])
      if (teamsRes.error) console.error('Teams fetch error:', teamsRes.error.message)
      if (subsRes.error) console.error('Subscriptions fetch error:', subsRes.error.message)
      result.teams = teamsRes.data || []
      result.subscriptions = subsRes.data || []
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
