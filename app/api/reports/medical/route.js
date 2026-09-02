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
    let clubLogoUrl = null
    if (teamId) {
      const { data: teamData } = await db
        .from('teams')
        .select('name, short_name, city, country, logo_url')
        .eq('id', teamId)
        .single()
      if (teamData) {
        clubName = teamData.name || teamData.short_name || clubName
        clubCity = teamData.city ? `${teamData.city}, ${teamData.country || 'Ghana'}` : (teamData.country || 'Ghana')
        clubLogoUrl = teamData.logo_url || null
      }
    }
    if (!clubLogoUrl && profile.club_logo_url) {
      clubLogoUrl = profile.club_logo_url
    }

    // ── 4. Fetch data ────────────────────────────────────────────────────────
    let athleteQuery = db
      .from('athletes')
      .select('id, name, position, date_of_birth, age, club, status, photo_url, back_number, nationality, phone, email, height, weight, preferred_foot')
      .eq('team_id', teamId)
      .order('name')

    if (reportScope === 'player' && athleteId) {
      athleteQuery = athleteQuery.eq('id', athleteId)
    }

    let injuryQuery = db
      .from('injuries')
      .select('*, athletes(id, name, position, club, photo_url)')
      .eq('team_id', teamId)
      .order('date_of_injury', { ascending: false })

    if (reportScope === 'player' && athleteId) {
      injuryQuery = injuryQuery.eq('athlete_id', athleteId)
    }

    let rehabQuery = db
      .from('rehabilitation_notes')
      .select('*, athletes(id, name, position, photo_url), injuries(id, injury_type, severity, notes, date_of_injury, expected_return)')
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
    
    // For single-player clinical dossier, include all historical or period injuries & notes
    // For general squad report, include all injuries in period (both active and recovered)
    const isSinglePlayer = reportScope === 'player' && athleteId
    
    const allInjuries = isSinglePlayer
      ? (injuriesRaw || [])
      : (injuriesRaw || []).filter(i => isInPeriod(i.date_of_injury) || isInPeriod(i.updated_at) || isInPeriod(i.expected_return))

    const allRehab = isSinglePlayer
      ? (rehabRaw || [])
      : (rehabRaw || []).filter(r => isInPeriod(r.session_date) || isInPeriod(r.created_at))

    // ── 5. Summary KPIs ──────────────────────────────────────────────────────
    const activeInjuriesList    = allInjuries.filter(i => i.status === 'Active')
    const recoveredInjuriesList = allInjuries.filter(i => i.status === 'Recovered')
    const severeCases           = allInjuries.filter(i => i.severity === 'Severe').length
    const avgPain = allRehab.length
      ? (allRehab.reduce((s, r) => s + (r.pain_level || 0), 0) / allRehab.length).toFixed(1)
      : '0.0'
    const clearedPlayers = allRehab.filter(r => r.clearance_status === 'Full Match Clearance').length

    // Count unique injured athletes
    const uniqueInjuredAthletes = [...new Set(allInjuries.map(i => i.athlete_id))].length
    const totalSquad = allAthletes.length
    const fitSquadCount = Math.max(0, totalSquad - activeInjuriesList.length)
    const squadFitnessRate = totalSquad > 0 ? Math.round((fitSquadCount / totalSquad) * 100) : 100

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const periodStr = isYearly ? `Year ${targetYear}` : `${MONTHS[targetMonth]} ${targetYear}`

    return NextResponse.json({
      ok: true,
      meta: {
        clubName,
        clubCity,
        clubLogoUrl,
        periodStr,
        reportScope,
        reportType,
        generatedAt: new Date().toISOString(),
        generatedBy: profile.full_name || (profile.role === 'physio' ? 'Team Physiotherapist' : 'Club Administrator'),
        generatedByRole: profile.role,
      },
      kpis: {
        totalInjuries: allInjuries.length,
        activeInjuries: activeInjuriesList.length,
        recoveredInjuries: recoveredInjuriesList.length,
        severeCases,
        avgPainLevel: avgPain,
        totalRehabSessions: allRehab.length,
        clearedPlayers,
        uniqueInjuredAthletes,
        totalAthletesInScope: totalSquad,
        fitSquadCount,
        squadFitnessRate,
      },
      athletes: allAthletes,
      injuries: allInjuries,
      activeInjuries: activeInjuriesList,
      recoveredInjuries: recoveredInjuriesList,
      rehabNotes: allRehab,
    })
  } catch (err) {
    console.error('Medical report data error:', err)
    return NextResponse.json({ error: err.message || 'Failed to load report data' }, { status: 500 })
  }
}
