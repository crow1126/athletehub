import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const db = createServiceClient()

const PHYSIO_ROLES = ['physio', 'admin', 'superadmin']

export async function POST(req) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const profile = requester.profile

    // Check physio/admin access — also check coaches table staff_type for physio staff
    let isAllowed = PHYSIO_ROLES.includes(profile.role)
    if (!isAllowed && profile.id) {
      const { data: staffRow } = await db
        .from('coaches')
        .select('staff_type')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (staffRow && ['physio', 'sports_scientist', 'medical'].includes(staffRow.staff_type)) {
        isAllowed = true
      }
    }
    if (!isAllowed) {
      return NextResponse.json({ error: 'Access restricted to medical staff and administrators' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const {
      reportScope = 'general', // 'general' | 'player'
      athleteId   = null,
      month       = new Date().getMonth(),
      year        = new Date().getFullYear(),
      reportType  = 'monthly',
    } = body

    const targetYear  = parseInt(year, 10)
    const targetMonth = parseInt(month, 10)
    const isYearly    = reportType === 'yearly'

    const teamId = profile.role === 'superadmin' && body.teamId
      ? body.teamId
      : profile.team_id

    if (!teamId && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'User is not assigned to a club' }, { status: 403 })
    }

    // ── 2. Period boundaries ─────────────────────────────────────────────────
    const periodStart = isYearly
      ? new Date(targetYear, 0, 1)
      : new Date(targetYear, targetMonth, 1)

    const periodEnd = isYearly
      ? new Date(targetYear, 11, 31, 23, 59, 59, 999)
      : new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)

    function isInPeriod(dateVal) {
      if (!dateVal) return false
      try {
        const d = new Date(dateVal)
        if (isNaN(d.getTime())) return false
        return d >= periodStart && d <= periodEnd
      } catch { return false }
    }

    // ── 3. Fetch club metadata ───────────────────────────────────────────────
    let clubName = 'Club'
    let clubCity = ''
    if (teamId) {
      const { data: teamData } = await db
        .from('teams')
        .select('name, short_name, city, country')
        .eq('id', teamId)
        .single()
      if (teamData) {
        clubName = teamData.name || teamData.short_name || clubName
        clubCity = teamData.city ? `${teamData.city}, ${teamData.country || 'Ghana'}` : (teamData.country || 'Ghana')
      }
    }

    // ── 4. Fetch data ────────────────────────────────────────────────────────
    let athleteQuery = db
      .from('athletes')
      .select('id, name, position, date_of_birth, age, club, status, photo_url, back_number, nationality, phone, email, height, weight')
      .eq('team_id', teamId)
      .order('name')

    if (reportScope === 'player' && athleteId) {
      athleteQuery = athleteQuery.eq('id', athleteId)
    }

    let injuryQuery = db
      .from('injuries')
      .select('*, athletes(id, name, position, club)')
      .eq('team_id', teamId)
      .order('date_of_injury', { ascending: false })

    if (reportScope === 'player' && athleteId) {
      injuryQuery = injuryQuery.eq('athlete_id', athleteId)
    }

    let rehabQuery = db
      .from('rehabilitation_notes')
      .select('*, athletes(id, name, position), injuries(id, injury_type, severity)')
      .eq('team_id', teamId)
      .order('session_date', { ascending: false })

    if (reportScope === 'player' && athleteId) {
      rehabQuery = rehabQuery.eq('athlete_id', athleteId)
    }

    const [
      { data: athletesRaw },
      { data: injuriesRaw },
      { data: rehabRaw },
    ] = await Promise.all([athleteQuery, injuryQuery, rehabQuery])

    const allAthletes = athletesRaw || []
    const allInjuries = (injuriesRaw || []).filter(i => isInPeriod(i.date_of_injury))
    const allRehab    = (rehabRaw || []).filter(r => isInPeriod(r.session_date))

    // ── 5. Summary KPIs ──────────────────────────────────────────────────────
    const activeInjuries    = allInjuries.filter(i => i.status === 'Active').length
    const recoveredInjuries = allInjuries.filter(i => i.status === 'Recovered').length
    const severeCases       = allInjuries.filter(i => i.severity === 'Severe').length
    const avgPain = allRehab.length
      ? (allRehab.reduce((s, r) => s + (r.pain_level || 0), 0) / allRehab.length).toFixed(1)
      : '0.0'
    const clearedPlayers = allRehab.filter(r => r.clearance_status === 'Full Match Clearance').length

    // Count unique injured athletes
    const uniqueInjuredAthletes = [...new Set(allInjuries.map(i => i.athlete_id))].length

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const periodStr = isYearly ? `Year ${targetYear}` : `${MONTHS[targetMonth]} ${targetYear}`

    return NextResponse.json({
      ok: true,
      meta: {
        clubName,
        clubCity,
        periodStr,
        reportScope,
        reportType,
        generatedAt: new Date().toISOString(),
        generatedBy: profile.full_name || 'Team Physio',
        generatedByRole: profile.role,
      },
      kpis: {
        totalInjuries: allInjuries.length,
        activeInjuries,
        recoveredInjuries,
        severeCases,
        avgPainLevel: avgPain,
        totalRehabSessions: allRehab.length,
        clearedPlayers,
        uniqueInjuredAthletes,
        totalAthletesInScope: allAthletes.length,
      },
      athletes: allAthletes,
      injuries: allInjuries,
      rehabNotes: allRehab,
    })
  } catch (err) {
    console.error('Medical report data error:', err)
    return NextResponse.json({ error: err.message || 'Failed to load report data' }, { status: 500 })
  }
}
