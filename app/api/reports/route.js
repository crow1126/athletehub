import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const db = createServiceClient()

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function POST(req) {
  try {
    // ── 1. Multitenant Auth Verification ─────────────────────────────────────
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const body = await req.json().catch(() => ({}))
    const {
      type = 'summary',
      month = new Date().getMonth(),
      year = new Date().getFullYear(),
      reportType = 'monthly',
    } = body

    // Enforce multitenant isolation: regular staff can ONLY access their own team_id
    const teamId = requester.profile.role === 'superadmin' && body.teamId
      ? body.teamId
      : requester.profile.team_id

    if (!teamId && requester.profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'User is not assigned to a club' }, { status: 403 })
    }

    // ── 2. Fetch Club Metadata ───────────────────────────────────────────────
    let clubName = 'ApexTrack Club'
    let clubCity = ''
    if (teamId) {
      const { data: teamData } = await db
        .from('teams')
        .select('name, short_name, city, country')
        .eq('id', teamId)
        .single()
      if (teamData) {
        clubName = teamData.name || teamData.short_name || clubName
        clubCity = teamData.city ? `${teamData.city}, ${teamData.country || 'Ghana'}` : (teamData.country || '')
      }
    }

    // ── 3. Fetch Scoped Multitenant Data from DB ──────────────────────────────
    const [
      { data: athletesRaw },
      { data: injuriesRaw },
      { data: performanceRaw },
      { data: sessionsRaw },
      { data: coachesRaw },
      { data: contractsRaw },
      { data: transfersRaw },
    ] = await Promise.all([
      db.from('athletes').select('*, coaches(name)').eq('team_id', teamId).order('name', { ascending: true }),
      db.from('injuries').select('*, athletes(name, club, position)').eq('team_id', teamId).order('date_of_injury', { ascending: false }),
      db.from('performance_stats').select('*, athletes(name, position, club)').eq('team_id', teamId).order('match_date', { ascending: false }),
      db.from('training_sessions').select('*').eq('team_id', teamId).order('date', { ascending: false }),
      db.from('coaches').select('*').eq('team_id', teamId).order('name', { ascending: true }),
      db.from('contracts').select('*, athletes(name, position, club)').eq('team_id', teamId).order('created_at', { ascending: false }),
      db.from('transfers').select('*, athletes(name, position, club)').eq('team_id', teamId).order('created_at', { ascending: false }),
    ])

    const athletes    = athletesRaw    || []
    const injuries    = injuriesRaw    || []
    const performance = performanceRaw || []
    const sessions    = sessionsRaw    || []
    const coaches     = coachesRaw     || []
    const contracts   = contractsRaw   || []
    const transfers   = transfersRaw   || []

    const isYearly  = reportType === 'yearly'
    const periodStr = isYearly ? `Year ${year}` : `${MONTHS[month]} ${year}`
    const fileDate  = isYearly ? `Year_${year}` : `${MONTHS[month]}_${year}`
    const safeClub  = clubName.replace(/[^a-zA-Z0-9_-]/g, '_')

    let XLSX
    try {
      XLSX = require('xlsx')
    } catch {
      return NextResponse.json({ error: 'xlsx library is required' }, { status: 500 })
    }

    const wb = XLSX.utils.book_new()

    // ── Date Filtering Helper ────────────────────────────────────────────────
    function filterPeriod(items, dateField) {
      return items.filter(item => {
        const val = item[dateField]
        if (!val) return true
        try {
          const d = new Date(val)
          if (isNaN(d.getTime())) return true
          return isYearly
            ? d.getFullYear() === year
            : (d.getFullYear() === year && d.getMonth() === month)
        } catch {
          return true
        }
      })
    }

    function addSheet(name, rows) {
      const safeName = name.slice(0, 31)
      if (!rows || rows.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([
          [`${clubName.toUpperCase()} — ${name.toUpperCase()}`],
          [`Period: ${periodStr} | Generated: ${new Date().toLocaleDateString('en-GB')}`],
          [''],
          ['No records found for this period.']
        ])
        ws['!cols'] = [{ wch: 45 }]
        XLSX.utils.book_append_sheet(wb, ws, safeName)
        return
      }

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0]).map(k => ({
        wch: Math.max(k.length + 3, ...rows.map(r => String(r[k] == null ? '' : r[k]).length), 10)
      }))
      XLSX.utils.book_append_sheet(wb, ws, safeName)
    }

    // ── 4. Build Detailed Report Sheets ──────────────────────────────────────

    // ── SQUAD / ATHLETES SHEET ──
    if (type === 'athletes' || type === 'summary') {
      const athleteRows = athletes.map((a, idx) => ({
        '#':                 idx + 1,
        'Jersey No':         a.back_number || '-',
        'Full Name':         a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Unnamed Athlete',
        'Position':          a.position || '-',
        'Status':            a.status || 'Active',
        'Age':               a.age || (a.date_of_birth ? Math.floor((new Date() - new Date(a.date_of_birth)) / 31557600000) : '-'),
        'Date of Birth':     a.date_of_birth || '-',
        'Nationality':       a.nationality || 'Ghanaian',
        'Height (cm)':       a.height || '-',
        'Weight (kg)':       a.weight || '-',
        'Strong Foot':       a.strong_foot || '-',
        'Assigned Coach':    a.coaches?.name || '-',
        'Team Section':      a.team_section || 'Senior Team',
        'Transfer Status':   a.transfer_status || 'Registered',
        'In Club Since':     a.in_club_since || a.joined_date || '-',
        'Contract Until':    a.contract_until || '-',
        'Phone Number':      a.phone || '-',
        'Email Address':     a.email || '-',
        'Region':            a.region || '-',
        'Passport / ID No':  a.passport_number || a.membership_number || '-',
      }))
      addSheet('Squad Roster', athleteRows)

      // Position breakdown
      const posCounts = { 'Goalkeepers (GK)': 0, 'Defenders (DF)': 0, 'Midfielders (MF)': 0, 'Forwards (FW)': 0, 'Other': 0 }
      athletes.forEach(a => {
        const p = (a.position || '').toUpperCase()
        if (p.includes('GK') || p.includes('GOAL')) posCounts['Goalkeepers (GK)']++
        else if (p.includes('DF') || p.includes('CB') || p.includes('LB') || p.includes('RB') || p.includes('BACK')) posCounts['Defenders (DF)']++
        else if (p.includes('MF') || p.includes('CM') || p.includes('DM') || p.includes('AM') || p.includes('MID')) posCounts['Midfielders (MF)']++
        else if (p.includes('FW') || p.includes('ST') || p.includes('LW') || p.includes('RW') || p.includes('ATT')) posCounts['Forwards (FW)']++
        else posCounts['Other']++
      })

      if (type === 'athletes') {
        const breakdownRows = Object.entries(posCounts).map(([pos, count]) => ({
          'Position Group': pos,
          'Total Players': count,
          'Squad Share (%)': athletes.length ? `${((count / athletes.length) * 100).toFixed(1)}%` : '0%'
        }))
        addSheet('Position Breakdown', breakdownRows)
      }
    }

    // ── INJURY & MEDICAL LOG ──
    if (type === 'injuries' || type === 'summary') {
      const filteredInjuries = filterPeriod(injuries, 'date_of_injury')
      const injuryRows = filteredInjuries.map(i => {
        let daysMissed = '-'
        if (i.date_of_injury) {
          const start = new Date(i.date_of_injury)
          const end = i.expected_return ? new Date(i.expected_return) : new Date()
          const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          daysMissed = diff >= 0 ? `${diff} days` : '-'
        }

        return {
          'Athlete':             i.athletes?.name || 'Unknown Athlete',
          'Position':            i.athletes?.position || '-',
          'Injury Type':         i.injury_type || 'General Injury',
          'Severity':            i.severity || 'Moderate',
          'Date of Injury':      i.date_of_injury || '-',
          'Expected Return':     i.expected_return || 'TBD',
          'Est. Days Out':       daysMissed,
          'Status':              i.status || 'Active',
          'Medical & Rehab Notes': i.notes || '-',
        }
      })
      addSheet('Medical & Injuries', injuryRows)
    }

    // ── PERFORMANCE ANALYTICS ──
    if (type === 'performance' || type === 'summary') {
      const filteredPerf = filterPeriod(performance, 'match_date')
      const perfRows = filteredPerf.map(p => ({
        'Match Date':          p.match_date || '-',
        'Athlete':             p.athletes?.name || 'Unknown Athlete',
        'Position':            p.athletes?.position || '-',
        'Opponent':            p.opponent || 'Friendly Match',
        'Minutes Played':      p.minutes_played || 0,
        'Goals':               p.goals || 0,
        'Assists':             p.assists || 0,
        'G + A':               (p.goals || 0) + (p.assists || 0),
        'Expected Goals (xG)': parseFloat(p.xg || 0).toFixed(2),
        'Expected Assists (xA)': parseFloat(p.xa || 0).toFixed(2),
        'Shots Total':         p.shots || 0,
        'Shots on Target':     p.shots_on_target || 0,
        'Passes Completed':    p.passes || 0,
        'Pass Accuracy (%)':   parseFloat(p.pass_accuracy || 0).toFixed(1),
        'Distance (km)':       parseFloat(p.distance_km || 0).toFixed(2),
        'Sprints':             p.sprint_count || 0,
        'Duels Won':           p.duels_won || 0,
        'Duels Total':         p.duels_total || 0,
        'Match Rating (1-10)': parseFloat(p.rating || 0).toFixed(1),
        'Notes':               p.notes || '-',
      }))
      addSheet('Performance Stats', perfRows)

      // Aggregated season totals per athlete
      if (type === 'performance' && filteredPerf.length > 0) {
        const byAthlete = {}
        filteredPerf.forEach(p => {
          const name = p.athletes?.name || 'Unknown'
          if (!byAthlete[name]) {
            byAthlete[name] = { matches: 0, minutes: 0, goals: 0, assists: 0, ratings: [], passes: [] }
          }
          byAthlete[name].matches++
          byAthlete[name].minutes += (p.minutes_played || 0)
          byAthlete[name].goals   += (p.goals || 0)
          byAthlete[name].assists += (p.assists || 0)
          if (p.rating) byAthlete[name].ratings.push(parseFloat(p.rating))
          if (p.pass_accuracy) byAthlete[name].passes.push(parseFloat(p.pass_accuracy))
        })

        const leaderRows = Object.entries(byAthlete).map(([name, stat]) => ({
          'Athlete':        name,
          'Matches Logged': stat.matches,
          'Total Minutes':  stat.minutes,
          'Total Goals':    stat.goals,
          'Total Assists':  stat.assists,
          'Total G+A':      stat.goals + stat.assists,
          'Avg Rating':     stat.ratings.length ? (stat.ratings.reduce((a,b)=>a+b,0)/stat.ratings.length).toFixed(1) : '-',
          'Avg Pass Acc %': stat.passes.length ? (stat.passes.reduce((a,b)=>a+b,0)/stat.passes.length).toFixed(1) : '-',
        })).sort((a,b) => (b['Total G+A'] - a['Total G+A']))

        addSheet('Player Totals Leaderboard', leaderRows)
      }
    }

    // ── TRAINING SESSIONS ──
    if (type === 'sessions' || type === 'summary') {
      const filteredSessions = filterPeriod(sessions, 'date')
      const sessionRows = filteredSessions.map(s => {
        const leadCoach = coaches.find(c => c.id === s.coach_id)
        return {
          'Session Date':    s.date || '-',
          'Start Time':      s.time || '-',
          'Session Focus':   s.title || 'General Training',
          'Session Type':    s.type || 'Tactical',
          'Duration (mins)': s.duration || 90,
          'Venue / Pitch':   s.venue || 'Main Training Ground',
          'Lead Coach':      leadCoach?.name || 'Staff',
          'Coaching Notes':  s.notes || '-',
        }
      })
      addSheet('Training Schedule', sessionRows)
    }

    // ── TECHNICAL & SUPPORT STAFF ──
    if (type === 'coaches' || type === 'summary') {
      const staffRows = coaches.map(c => ({
        'Staff Name':          c.name || 'Unnamed Staff',
        'Role / Designation':  (c.staff_type || 'Coach').replace(/_/g, ' ').toUpperCase(),
        'Speciality Area':     c.speciality || 'General Coaching',
        'Experience (Years)':  c.experience_years || '-',
        'Contact Phone':       c.phone || '-',
        'Email Address':       c.email || '-',
        'Contract Status':     c.contract_status || 'Active',
        'Monthly Salary (GHS)': parseFloat(c.monthly_salary || 0).toFixed(2),
        'Win Bonus (GHS)':     parseFloat(c.win_bonus || 0).toFixed(2),
        'Contract Period':     c.contract_start ? `${c.contract_start} to ${c.contract_end || 'Present'}` : '-',
        'Account Status':      c.is_active !== false ? 'Active' : 'Inactive',
      }))
      addSheet('Technical Staff', staffRows)
    }

    // ── CONTRACTS & FINANCIALS ──
    if (type === 'contracts' || type === 'summary') {
      const contractRows = contracts.map(c => ({
        'Athlete / Signee':      c.athletes?.name || 'Contract Record',
        'Position':              c.athletes?.position || '-',
        'Contract Start':        c.contract_start || '-',
        'Contract End':          c.contract_end || '-',
        'Contract Status':       c.status || 'Active',
        'Weekly Wage (GHS)':     parseFloat(c.weekly_wage || 0).toFixed(2),
        'Monthly Wage (GHS)':    (parseFloat(c.weekly_wage || 0) * 4.33).toFixed(2),
        'Annual Projection (GHS)': (parseFloat(c.weekly_wage || 0) * 52).toFixed(2),
        'Signing Fee (GHS)':     parseFloat(c.signing_fee || 0).toFixed(2),
        'Release Clause (GHS)':  c.release_clause ? parseFloat(c.release_clause).toFixed(2) : 'None',
        'Goal Bonus (GHS)':      parseFloat(c.bonus_goals || 0).toFixed(2),
        'Assist Bonus (GHS)':    parseFloat(c.bonus_assists || 0).toFixed(2),
        'Contract Notes / Terms': c.notes || '-',
      }))
      addSheet('Player Contracts', contractRows)

      // Wage summary
      const activeContracts = contracts.filter(c => c.status === 'Active' || !c.status)
      const weeklyWageTotal = activeContracts.reduce((sum, c) => sum + parseFloat(c.weekly_wage || 0), 0)

      const wageSummaryRows = [
        { 'Financial Metric': 'Club / Organisation',             'Amount / Value': clubName },
        { 'Financial Metric': 'Report Period',                  'Amount / Value': periodStr },
        { 'Financial Metric': 'Report Generated On',            'Amount / Value': new Date().toLocaleDateString('en-GB') },
        { 'Financial Metric': '--------------------------------', 'Amount / Value': '--------------------' },
        { 'Financial Metric': 'Total Player Contracts on File', 'Amount / Value': contracts.length },
        { 'Financial Metric': 'Active Contracts',               'Amount / Value': activeContracts.length },
        { 'Financial Metric': 'Expired Contracts',              'Amount / Value': contracts.filter(c => c.status === 'Expired').length },
        { 'Financial Metric': 'In Active Negotiation',          'Amount / Value': contracts.filter(c => c.status === 'Negotiating').length },
        { 'Financial Metric': '--------------------------------', 'Amount / Value': '--------------------' },
        { 'Financial Metric': 'Total Weekly Wage Bill (GHS)',   'Amount / Value': `GHS ${weeklyWageTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Financial Metric': 'Est. Monthly Wage Bill (GHS)',   'Amount / Value': `GHS ${(weeklyWageTotal * 4.33).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { 'Financial Metric': 'Est. Annual Wage Bill (GHS)',    'Amount / Value': `GHS ${(weeklyWageTotal * 52).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      ]
      addSheet('Payroll & Wage Summary', wageSummaryRows)
    }

    // ── EXECUTIVE COVER SHEET (SUMMARY REPORT) ──
    if (type === 'summary') {
      const activeAthletes   = athletes.filter(a => a.status === 'Active' || !a.status).length
      const injuredAthletes  = athletes.filter(a => a.status === 'Injured').length
      const activeInjuries   = injuries.filter(i => i.status === 'Active').length
      const totalGoals       = performance.reduce((s, p) => s + (p.goals || 0), 0)
      const totalAssists     = performance.reduce((s, p) => s + (p.assists || 0), 0)
      const activeContracts  = contracts.filter(c => c.status === 'Active' || !c.status)
      const weeklyWageTotal  = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)

      const overviewWs = XLSX.utils.json_to_sheet([
        { 'Section': 'CLUB INFORMATION', 'Executive KPI': 'Club Name',                'Value': clubName },
        { 'Section': '',                 'Executive KPI': 'Location',                 'Value': clubCity || 'Ghana' },
        { 'Section': '',                 'Executive KPI': 'Reporting Period',         'Value': periodStr },
        { 'Section': '',                 'Executive KPI': 'Report Generated',         'Value': new Date().toLocaleDateString('en-GB') },
        { 'Section': '',                 'Executive KPI': '',                         'Value': '' },
        { 'Section': 'SQUAD SUMMARY',    'Executive KPI': 'Total Registered Squad',   'Value': athletes.length },
        { 'Section': '',                 'Executive KPI': 'Active Match-Fit Players', 'Value': activeAthletes },
        { 'Section': '',                 'Executive KPI': 'Currently Injured',        'Value': injuredAthletes },
        { 'Section': '',                 'Executive KPI': '',                         'Value': '' },
        { 'Section': 'MEDICAL & HEALTH', 'Executive KPI': 'Total Injury Incidents',   'Value': injuries.length },
        { 'Section': '',                 'Executive KPI': 'Currently in Rehab',       'Value': activeInjuries },
        { 'Section': '',                 'Executive KPI': '',                         'Value': '' },
        { 'Section': 'MATCH ANALYTICS',  'Executive KPI': 'Total Matches Logged',     'Value': performance.length },
        { 'Section': '',                 'Executive KPI': 'Total Squad Goals Scored', 'Value': totalGoals },
        { 'Section': '',                 'Executive KPI': 'Total Squad Assists',      'Value': totalAssists },
        { 'Section': '',                 'Executive KPI': '',                         'Value': '' },
        { 'Section': 'TECHNICAL STAFF',  'Executive KPI': 'Total Staff & Coaches',    'Value': coaches.length },
        { 'Section': '',                 'Executive KPI': 'Active Coaching Staff',    'Value': coaches.filter(c => c.is_active !== false).length },
        { 'Section': '',                 'Executive KPI': '',                         'Value': '' },
        { 'Section': 'FINANCE & WAGES',  'Executive KPI': 'Active Player Contracts',  'Value': activeContracts.length },
        { 'Section': '',                 'Executive KPI': 'Weekly Wage Commitment',   'Value': `GHS ${weeklyWageTotal.toFixed(2)}` },
        { 'Section': '',                 'Executive KPI': 'Monthly Wage Commitment',  'Value': `GHS ${(weeklyWageTotal * 4.33).toFixed(2)}` },
        { 'Section': '',                 'Executive KPI': 'Annual Projected Wage',    'Value': `GHS ${(weeklyWageTotal * 52).toFixed(2)}` },
      ])
      overviewWs['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 26 }]
      wb.SheetNames.unshift('Executive Overview')
      wb.Sheets['Executive Overview'] = overviewWs
    }

    // ── 5. Generate & Return Binary XLSX ─────────────────────────────────────
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `${safeClub}_${fileDate}_${type}_report.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status: 500 })
  }
}