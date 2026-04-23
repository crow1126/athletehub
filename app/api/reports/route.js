import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      type, month, year, reportType = 'monthly',
      athletes = [], injuries = [], performance = [],
      sessions = [], coaches = [], contracts = [],
    } = body

    const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const isYearly   = reportType === 'yearly'
    const periodStr  = isYearly ? `Year ${year}` : `${MONTHS[month]} ${year}`
    const fileLabel  = isYearly ? `Year_${year}` : `${MONTHS[month]}_${year}`

    let XLSX
    try { XLSX = require('xlsx') }
    catch { return NextResponse.json({ error: 'xlsx not installed. Run: npm install xlsx' }, { status: 500 }) }

    const wb = XLSX.utils.book_new()

    function filterPeriod(items, dateField) {
      return (items || []).filter(item => {
        const val = item[dateField]
        if (!val) return true
        try {
          const d = new Date(val)
          if (isNaN(d.getTime())) return true
          return isYearly ? d.getFullYear() === year : (d.getFullYear() === year && d.getMonth() === month)
        } catch { return true }
      })
    }

    function addSheet(name, rows) {
      const safeName = name.slice(0, 31)
      if (!rows || rows.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([[`${name} — ${periodStr}`],[''],['No data for this period.']])
        ws['!cols'] = [{ wch: 50 }]
        XLSX.utils.book_append_sheet(wb, ws, safeName)
        return
      }
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0]).map(k => ({
        wch: Math.max(k.length + 2, ...rows.map(r => String(r[k] == null ? '' : r[k]).length), 10)
      }))
      XLSX.utils.book_append_sheet(wb, ws, safeName)
    }

    // ── ATHLETES ───────────────────────────────────────────────
    if (type === 'athletes' || type === 'summary') {
      addSheet('Athletes', athletes.map(a => ({
        'Name':         a.name          || '',
        'Age':          a.age           || '',
        'Position':     a.position      || '',
        'Club':         a.club          || '',
        'Region':       a.region        || '',
        'Phone':        a.phone         || '',
        'Height (cm)':  a.height        || '',
        'Weight (kg)':  a.weight        || '',
        'Status':       a.status        || '',
        'Coach':        a.coaches?.name || '',
        'Joined':       a.joined_date   || '',
      })))
    }

    // ── INJURIES ────────────────────────────────────────────────
    if (type === 'injuries' || type === 'summary') {
      const rows = filterPeriod(injuries, 'date_of_injury').map(i => ({
        'Athlete':          i.athletes?.name      || '',
        'Club':             i.athletes?.club      || '',
        'Position':         i.athletes?.position  || '',
        'Injury Type':      i.injury_type         || '',
        'Severity':         i.severity            || '',
        'Date of Injury':   i.date_of_injury      || '',
        'Expected Return':  i.expected_return     || '',
        'Status':           i.status              || '',
        'Notes':            i.notes               || '',
      }))
      addSheet('Injuries', rows)
    }

    // ── PERFORMANCE ─────────────────────────────────────────────
    if (type === 'performance' || type === 'summary') {
      const rows = filterPeriod(performance, 'match_date').map(p => ({
        'Athlete':        p.athletes?.name      || '',
        'Position':       p.athletes?.position  || '',
        'Club':           p.athletes?.club      || '',
        'Match Date':     p.match_date          || '',
        'Opponent':       p.opponent            || '',
        'Minutes':        p.minutes_played      || 0,
        'Goals':          p.goals               || 0,
        'Assists':        p.assists             || 0,
        'xG':             parseFloat(p.xg  || 0).toFixed(3),
        'xA':             parseFloat(p.xa  || 0).toFixed(3),
        'Shots':          p.shots               || 0,
        'On Target':      p.shots_on_target     || 0,
        'Passes':         p.passes              || 0,
        'Pass Acc (%)':   parseFloat(p.pass_accuracy  || 0).toFixed(1),
        'Distance (km)':  parseFloat(p.distance_km    || 0).toFixed(2),
        'Sprints':        p.sprint_count        || 0,
        'Duels Won':      p.duels_won           || 0,
        'Duels Total':    p.duels_total         || 0,
        'Rating':         parseFloat(p.rating   || 0).toFixed(1),
        'Notes':          p.notes               || '',
      }))
      addSheet('Performance Stats', rows)
    }

    // ── TRAINING SESSIONS ──────────────────────────────────────
    if (type === 'sessions' || type === 'summary') {
      const rows = filterPeriod(sessions, 'date').map(s => {
        const coach = coaches.find(c => c.id === s.coach_id)
        return {
          'Title':          s.title     || '',
          'Type':           s.type      || '',
          'Date':           s.date      || '',
          'Time':           s.time      || '',
          'Duration (min)': s.duration  || '',
          'Venue':          s.venue     || '',
          'Coach':          coach?.name || '',
          'Notes':          s.notes     || '',
        }
      })
      addSheet('Training Sessions', rows)
    }

    // ── STAFF ──────────────────────────────────────────────────
    if (type === 'coaches' || type === 'summary') {
      addSheet('Staff', coaches.map(c => ({
        'Name':             c.name              || '',
        'Staff Type':       (c.staff_type || '').replace(/_/g, ' '),
        'Speciality':       c.speciality        || '',
        'Experience (yrs)': c.experience_years  || '',
        'Phone':            c.phone             || '',
        'Email':            c.email             || '',
        'Status':           c.is_active !== false ? 'Active' : 'Inactive',
      })))
    }

    // ── CONTRACTS ──────────────────────────────────────────────
    if (type === 'contracts' || type === 'summary') {
      addSheet('Contracts', contracts.map(c => ({
        'Athlete':              c.athletes?.name      || '',
        'Position':             c.athletes?.position  || '',
        'Club':                 c.athletes?.club      || '',
        'Contract Start':       c.contract_start      || '',
        'Contract End':         c.contract_end        || '',
        'Weekly Wage (GHS)':    parseFloat(c.weekly_wage   || 0),
        'Signing Fee (GHS)':    parseFloat(c.signing_fee   || 0),
        'Release Clause (GHS)': c.release_clause ? parseFloat(c.release_clause) : '',
        'Goal Bonus (GHS)':     parseFloat(c.bonus_goals   || 0),
        'Assist Bonus (GHS)':   parseFloat(c.bonus_assists || 0),
        'Status':               c.status  || '',
        'Notes':                c.notes   || '',
      })))

      const active     = contracts.filter(c => c.status === 'Active')
      const weeklyWage = active.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)
      addSheet('Wage Summary', [
        { 'Metric': 'Report Period',           'Value': periodStr },
        { 'Metric': 'Generated',               'Value': new Date().toLocaleDateString('en-GB') },
        { 'Metric': '',                         'Value': '' },
        { 'Metric': 'Total Contracts',         'Value': contracts.length },
        { 'Metric': 'Active Contracts',        'Value': active.length },
        { 'Metric': 'Expired',                 'Value': contracts.filter(c=>c.status==='Expired').length },
        { 'Metric': 'Negotiating',             'Value': contracts.filter(c=>c.status==='Negotiating').length },
        { 'Metric': '',                         'Value': '' },
        { 'Metric': 'Weekly Wage Bill (GHS)',  'Value': weeklyWage.toFixed(2) },
        { 'Metric': 'Monthly Bill (GHS)',      'Value': (weeklyWage * 4.33).toFixed(2) },
        { 'Metric': 'Annual Bill (GHS)',       'Value': (weeklyWage * 52).toFixed(2) },
      ])
    }

    // ── SUMMARY OVERVIEW ───────────────────────────────────────
    if (type === 'summary') {
      const active      = contracts.filter(c => c.status === 'Active')
      const weeklyWage  = active.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)
      const overviewWs  = XLSX.utils.json_to_sheet([
        { 'Section': '📋 REPORT INFO',    'Metric': 'Period',                 'Value': periodStr },
        { 'Section': '',                   'Metric': 'Type',                   'Value': isYearly ? 'Annual' : 'Monthly' },
        { 'Section': '',                   'Metric': 'Generated',              'Value': new Date().toLocaleDateString('en-GB') },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '👥 SQUAD',           'Metric': 'Total Athletes',         'Value': athletes.length },
        { 'Section': '',                   'Metric': 'Active',                 'Value': athletes.filter(a=>a.status==='Active').length },
        { 'Section': '',                   'Metric': 'Injured',                'Value': athletes.filter(a=>a.status==='Injured').length },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '🩺 MEDICAL',         'Metric': 'Total Injury Records',   'Value': injuries.length },
        { 'Section': '',                   'Metric': 'Active Injuries',        'Value': injuries.filter(i=>i.status==='Active').length },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '📊 PERFORMANCE',     'Metric': 'Total Match Logs',       'Value': performance.length },
        { 'Section': '',                   'Metric': 'Total Goals',            'Value': performance.reduce((s,p)=>s+(p.goals||0),0) },
        { 'Section': '',                   'Metric': 'Total Assists',          'Value': performance.reduce((s,p)=>s+(p.assists||0),0) },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '📅 TRAINING',        'Metric': 'Total Sessions',         'Value': sessions.length },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '🎽 STAFF',           'Metric': 'Total Staff',            'Value': coaches.length },
        { 'Section': '',                   'Metric': 'Active Staff',           'Value': coaches.filter(c=>c.is_active!==false).length },
        { 'Section': '',                   'Metric': '',                       'Value': '' },
        { 'Section': '💰 FINANCE',         'Metric': 'Total Contracts',        'Value': contracts.length },
        { 'Section': '',                   'Metric': 'Active Contracts',       'Value': active.length },
        { 'Section': '',                   'Metric': 'Weekly Wage Bill (GHS)', 'Value': weeklyWage.toFixed(2) },
        { 'Section': '',                   'Metric': 'Annual Wage Bill (GHS)', 'Value': (weeklyWage*52).toFixed(2) },
      ])
      overviewWs['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 18 }]
      wb.SheetNames.unshift('Overview')
      wb.Sheets['Overview'] = overviewWs
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="GhanaFootball_${fileLabel}_${type}_report.xlsx"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: err.message || 'Report generation failed' }, { status: 500 })
  }
}