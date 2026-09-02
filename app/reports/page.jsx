'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

import {
  Users, HeartPulse, Trophy, CalendarDays, ShieldCheck,
  ClipboardList, FileSpreadsheet, Activity, FileText, User,
} from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const iconProps = { size: 24, strokeWidth: 1.8 }
const REPORT_CARDS = [
  { id:'athletes',    icon:<Users {...iconProps} color="#4A90E2"/>, title:'Athletes Report',         desc:'Full squad roster — positions, clubs, regions, coaches, and status',                   color:'#4A90E2', sheets:'1 sheet'  },
  { id:'injuries',    icon:<HeartPulse {...iconProps} color="#E74C3C"/>, title:'Injury Report',           desc:'Complete injury records with severity, dates, recovery notes and status',               color:'#E74C3C', sheets:'1 sheet'  },
  { id:'performance', icon:<Trophy {...iconProps} color="#9B59B6"/>, title:'Performance Report',      desc:'Match stats per athlete — goals, assists, xG, xA, pass accuracy, distance, ratings',   color:'#9B59B6', sheets:'1 sheet'  },
  { id:'sessions',    icon:<CalendarDays {...iconProps} color="#27AE60"/>, title:'Training Sessions',       desc:'All scheduled training sessions with venue, coach, type and duration',                  color:'#27AE60', sheets:'1 sheet'  },
  { id:'coaches',     icon:<ShieldCheck {...iconProps} color="#E67E22"/>, title:'Staff Report',            desc:'Technical, medical, analytics and scouting staff roster with roles',                    color:'#E67E22', sheets:'1 sheet'  },
  { id:'contracts',   icon:<ClipboardList {...iconProps} color="#1B7A3E"/>, title:'Contracts & Finance',     desc:'Player contracts, wages, bonuses and automatic wage bill summary sheet',                color:'#1B7A3E', sheets:'2 sheets' },
  { id:'summary',     icon:<FileSpreadsheet {...iconProps} color="#0D9488"/>, title:'Full Summary Report',     desc:'Everything in one workbook — all 6 modules combined with an overview cover sheet',      color:'#0D9488', sheets:'7 sheets', featured: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// PDF BUILDER — uses jsPDF + jsPDF-AutoTable (both client-side)
// Layout mirrors the corporate quotation template:
//   • Dark header banner (status pill + title)
//   • Two-column info block (overview left / prepared-by right)
//   • Data table(s) with alternating rows
//   • KPI summary table with totals
//   • Signature / footer banner
// ─────────────────────────────────────────────────────────────────────────────
async function buildMedicalPDF({ data, reportScope, selectedAthleteName, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { meta, kpis, athletes, injuries, rehabNotes } = data

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210
  const PH  = doc.internal.pageSize.getHeight()  // 297

  // ── Colour palette (matching corporate quotation template) ──
  const NAVY   = [26,  43,  79]   // #1A2B4F — dark navy header/footer
  const TEAL   = [13, 148, 136]   // #0D9488 — accent teal
  const WHITE  = [255,255,255]
  const LIGHT  = [248,250,252]    // #F8FAFC — alt row
  const BORDER = [226,232,240]    // #E2E8F0
  const TEXT   = [15,  23,  42]   // #0F172A
  const TEXT2  = [100,116,139]    // #64748B

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return d }
  }

  let y = 0 // current Y cursor

  // ─────────────────────────────────────────
  // PAGE 1: COVER / HEADER
  // ─────────────────────────────────────────

  // ── Top navy banner ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 28, 'F')

  // Status pill (top-left corner of banner)
  const reportLabel = reportScope === 'player' ? 'PLAYER-SPECIFIC REPORT' : 'GENERAL MEDICAL REPORT'
  doc.setFillColor(...TEAL)
  doc.roundedRect(10, 8, 62, 12, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text(reportLabel, 41, 15.5, { align: 'center' })

  // Main title (right-aligned in banner)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('MEDICAL & PHYSIOTHERAPY', PW - 12, 12, { align: 'right' })
  doc.setFontSize(14)
  doc.text('CLINICAL REPORT', PW - 12, 21, { align: 'right' })

  y = 38

  // ── Two-column info block ──
  const colL = 12, colR = PW / 2 + 4
  const colW = PW / 2 - 16

  // Left column — Report Overview
  doc.setTextColor(...NAVY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('REPORT OVERVIEW', colL, y)

  // Thin separator under heading
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.4)
  doc.line(colL, y + 1.5, colL + colW, y + 1.5)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...TEXT)
  const overviewText = reportScope === 'player'
    ? `This report documents the complete medical and rehabilitation history for ${selectedAthleteName || 'the selected athlete'}. It includes all injury incidents, treatment protocols, rehab session logs, pain monitoring, and return-to-play clearance status for the specified period.`
    : `This report provides a comprehensive overview of the medical and physiotherapy activity for ${meta.clubName}. It covers all injury incidents, rehabilitation sessions, pain monitoring data, and player clearance statuses recorded during the specified period.`

  const lines = doc.splitTextToSize(overviewText, colW)
  doc.text(lines, colL, y)
  y += lines.length * 4.5

  // Right column — Prepared For / By block (starts at same Y as left col heading)
  let ry = 38
  doc.setTextColor(...NAVY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('PREPARED FOR & PREPARED BY', colR, ry)
  doc.setDrawColor(...TEAL)
  doc.line(colR, ry + 1.5, colR + colW, ry + 1.5)
  ry += 7

  const infoRows = [
    ['CLUB / ORGANISATION', meta.clubName],
    ['LOCATION',            meta.clubCity || 'Ghana'],
    ['REPORT TYPE',         reportScope === 'player' ? 'Player-Specific (PDF)' : 'General Medical (PDF)'],
    ['REPORT PERIOD',       period],
    ['PREPARED BY',         meta.generatedBy || 'Team Physio'],
    ['DESIGNATION',         (meta.generatedByRole || 'physio').toUpperCase()],
    ['DATE GENERATED',      fmtDate(meta.generatedAt)],
  ]

  doc.setFontSize(8)
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEXT2)
    doc.text(label + ':', colR, ry)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT)
    doc.text(String(value), colR + 45, ry)
    ry += 5
  }

  // Move y to below both columns
  y = Math.max(y, ry) + 6

  // ── Thin divider line ──
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12, y, PW - 12, y)
  y += 8

  // ─────────────────────────────────────────
  // KPI SUMMARY TABLE
  // ─────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('MEDICAL SUMMARY KPIs', 12, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      ['Total Injury Incidents',   kpis.totalInjuries,         'Total Rehab Sessions',    kpis.totalRehabSessions],
      ['Active (Ongoing) Injuries', kpis.activeInjuries,        'Cleared for Full Match',  kpis.clearedPlayers],
      ['Recovered Injuries',        kpis.recoveredInjuries,     'Avg Pain Level (0–10)',   kpis.avgPainLevel],
      ['Severe Cases',              kpis.severeCases,           'Players Affected',        kpis.uniqueInjuredAthletes],
    ],
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: {
      fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 55 },
      1: { fontStyle: 'bold', textColor: TEAL,  cellWidth: 30 },
      2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 55 },
      3: { fontStyle: 'bold', textColor: TEAL,  cellWidth: 30 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 10

  // ─────────────────────────────────────────
  // INJURY LOG TABLE
  // ─────────────────────────────────────────
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`INJURY INCIDENTS REGISTER (${injuries.length} records)`, 12, y)
  y += 4

  if (injuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text(`No injury records found for ${period}.`, 12, y + 5)
    y += 14
  } else {
    const injuryRows = injuries.map((inj, idx) => {
      let daysOut = '—'
      if (inj.date_of_injury) {
        const start = new Date(inj.date_of_injury)
        const end   = inj.expected_return ? new Date(inj.expected_return) : new Date()
        const diff  = Math.ceil((end - start) / 86400000)
        daysOut = diff >= 0 ? `${diff}d` : '—'
      }
      return [
        idx + 1,
        inj.athletes?.name || '—',
        inj.athletes?.position || '—',
        inj.injury_type || '—',
        inj.severity || '—',
        fmtDate(inj.date_of_injury),
        fmtDate(inj.expected_return),
        daysOut,
        inj.status || '—',
        inj.notes ? inj.notes.slice(0, 60) + (inj.notes.length > 60 ? '…' : '') : '—',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Athlete', 'Pos.', 'Injury Type', 'Severity', 'Date Injured', 'Exp. Return', 'Days Out', 'Status', 'Notes']],
      body: injuryRows,
      styles: { fontSize: 6.5, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0:  { cellWidth: 6,  halign: 'center' },
        1:  { cellWidth: 30, fontStyle: 'bold' },
        2:  { cellWidth: 14 },
        3:  { cellWidth: 30 },
        4:  { cellWidth: 16 },
        5:  { cellWidth: 20 },
        6:  { cellWidth: 20 },
        7:  { cellWidth: 14, halign: 'center' },
        8:  { cellWidth: 16 },
        9:  { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const sev = data.cell.raw
          if (sev === 'Severe')   { data.cell.styles.textColor = [192, 57, 43]; data.cell.styles.fontStyle = 'bold' }
          if (sev === 'Moderate') { data.cell.styles.textColor = [179, 98,   0] }
        }
        if (data.column.index === 8 && data.section === 'body') {
          const st = data.cell.raw
          if (st === 'Active')    { data.cell.styles.textColor = [192, 57, 43]; data.cell.styles.fontStyle = 'bold' }
          if (st === 'Recovered') { data.cell.styles.textColor = [27, 122, 62] }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ─────────────────────────────────────────
  // REHABILITATION NOTES TABLE
  // ─────────────────────────────────────────
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`REHABILITATION SESSIONS LOG (${rehabNotes.length} sessions)`, 12, y)
  y += 4

  if (rehabNotes.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text(`No rehabilitation notes recorded for ${period}.`, 12, y + 5)
    y += 14
  } else {
    const rehabRows = rehabNotes.map((r, idx) => [
      idx + 1,
      r.athletes?.name || '—',
      fmtDate(r.session_date),
      (r.rehab_phase || '—').replace('Phase ', 'Ph.'),
      `${r.pain_level ?? '—'} / 10`,
      r.clearance_status || '—',
      r.treatment_summary
        ? r.treatment_summary.slice(0, 55) + (r.treatment_summary.length > 55 ? '…' : '')
        : '—',
      r.target_milestone
        ? r.target_milestone.slice(0, 45) + (r.target_milestone.length > 45 ? '…' : '')
        : '—',
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Athlete', 'Session Date', 'Rehab Phase', 'Pain', 'Clearance', 'Treatment Summary', 'Milestone Target']],
      body: rehabRows,
      styles: { fontSize: 6.5, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [13, 118, 110], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 6,  halign: 'center' },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 28 },
        6: { cellWidth: 'auto' },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const rawPain = String(data.cell.raw || '')
          const pain = parseInt(rawPain)
          if (pain >= 7) data.cell.styles.textColor = [192, 57, 43]
          else if (pain >= 4) data.cell.styles.textColor = [179, 98, 0]
          else data.cell.styles.textColor = [27, 122, 62]
        }
        if (data.column.index === 5 && data.section === 'body') {
          const cs = data.cell.raw
          if (cs === 'Full Match Clearance') { data.cell.styles.textColor = [27, 122, 62]; data.cell.styles.fontStyle = 'bold' }
          else if (cs === 'In Rehab')        { data.cell.styles.textColor = [192, 57, 43] }
          else if (cs === 'Restricted Training') { data.cell.styles.textColor = [179, 98, 0] }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ─────────────────────────────────────────
  // PLAYER PROFILE (player report only)
  // ─────────────────────────────────────────
  if (reportScope === 'player' && athletes.length > 0) {
    if (y > PH - 80) { doc.addPage(); y = 18 }

    const ath = athletes[0]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('ATHLETE PROFILE', 12, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['Field', 'Value', 'Field', 'Value']],
      body: [
        ['Full Name',      ath.name || '—',            'Jersey No.',     ath.back_number || '—'],
        ['Position',       ath.position || '—',         'Nationality',    ath.nationality || '—'],
        ['Date of Birth',  fmtDate(ath.date_of_birth),  'Age',            ath.age || '—'],
        ['Height',         ath.height ? `${ath.height} cm` : '—', 'Weight', ath.weight ? `${ath.weight} kg` : '—'],
        ['Club',           ath.club || '—',             'Status',         ath.status || '—'],
        ['Contact Phone',  ath.phone || '—',            'Email',          ath.email || '—'],
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 40 },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 40 },
        3: { cellWidth: 55 },
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ─────────────────────────────────────────
  // TERMS / DECLARATION BOX
  // ─────────────────────────────────────────
  if (y > PH - 55) { doc.addPage(); y = 18 }

  // Box border
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.5)
  doc.roundedRect(12, y, PW - 24, 34, 2, 2, 'D')

  // Left accent bar
  doc.setFillColor(...TEAL)
  doc.roundedRect(12, y, 4, 34, 2, 2, 'F')
  // Fill left side to square off the right side of accent
  doc.rect(14, y, 2, 34, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('CONFIDENTIALITY & CLINICAL DECLARATION', 21, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...TEXT)
  const termsText = 'This report contains sensitive medical and physiotherapy information protected under patient confidentiality principles. It is intended exclusively for authorised medical staff, club administration, and the named athlete (where applicable). Unauthorised disclosure, distribution, or reproduction of this document is strictly prohibited. All clinical assessments are performed by qualified physiotherapy personnel.'
  const termsLines = doc.splitTextToSize(termsText, PW - 42)
  doc.text(termsLines, 21, y + 13)

  // Signature line
  y += 38
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12,   y + 8, 80, y + 8)
  doc.line(110,  y + 8, 180, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT2)
  doc.text('PHYSIOTHERAPIST SIGNATURE', 12,  y + 13)
  doc.text('DATE',                       110, y + 13)

  y += 20

  // ─────────────────────────────────────────
  // FOOTER BANNER (all pages)
  // ─────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()

    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 14, PW, 14, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(
      `${meta.clubName.toUpperCase()} — CONFIDENTIAL MEDICAL REPORT   |   ${period}   |   Page ${pg} of ${totalPages}`,
      PW / 2, ph - 5.5, { align: 'center' }
    )
  }

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [athletes,       setAthletes]       = useState([])
  const [injuries,       setInjuries]       = useState([])
  const [performance,    setPerformance]    = useState([])
  const [sessions,       setSessions]       = useState([])
  const [coaches,        setCoaches]        = useState([])
  const [contracts,      setContracts]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [generating,     setGenerating]     = useState(null)
  const [statusMsg,      setStatusMsg]      = useState({ text:'', type:'' })
  const [currentProfile, setCurrentProfile] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState('')

  const [reportType, setReportType] = useState('monthly')
  const [selMonth,   setSelMonth]   = useState(new Date().getMonth())
  const [selYear,    setSelYear]    = useState(new Date().getFullYear())

  const years = []
  for (let y = 2022; y <= new Date().getFullYear() + 1; y++) years.push(y)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { teamId, profile } = await getTenantProfile()
        setCurrentProfile(profile)
        const [
          { data: a }, { data: i }, { data: p },
          { data: s }, { data: c }, { data: ct },
        ] = await Promise.all([
          scopeTeam(supabase.from('athletes').select('*, coaches(name)'), teamId),
          scopeTeam(supabase.from('injuries').select('*, athletes(name, club, position)'), teamId),
          scopeTeam(supabase.from('performance_stats').select('*, athletes(name, position, club)'), teamId).order('match_date', { ascending: false }),
          scopeTeam(supabase.from('training_sessions').select('*'), teamId),
          scopeTeam(supabase.from('coaches').select('*'), teamId),
          scopeTeam(supabase.from('contracts').select('*, athletes(name, position, club)'), teamId),
        ])
        setAthletes(a   || [])
        setInjuries(i   || [])
        setPerformance(p|| [])
        setSessions(s   || [])
        setCoaches(c    || [])
        setContracts(ct || [])
      } catch (err) {
        setStatusMsg({ text: 'Failed to load data: ' + err.message, type: 'error' })
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Determine roles ──────────────────────────────────────────────────────
  const userRole  = currentProfile?.role || 'staff'
  const isPhysio  = userRole === 'physio' || userRole === 'superadmin' ||
                    currentProfile?.staff_type === 'physio' ||
                    currentProfile?.staff_type === 'medical' ||
                    currentProfile?.staff_type === 'sports_scientist'
  const isAdmin   = userRole === 'admin' || userRole === 'superadmin'
  const canViewMedical = isPhysio || isAdmin

  // ── Excel report generator (existing) ───────────────────────────────────
  async function generateReport(reportId) {
    setGenerating(reportId)
    setStatusMsg({ text: '', type: '' })
    try {
      const payload = {
        type: reportId, month: selMonth, year: selYear, reportType,
        athletes, injuries, performance, sessions, coaches, contracts,
      }
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try { const j = await res.json(); errMsg = j.error || errMsg } catch (_e) { /* ignore */ }
        throw new Error(errMsg)
      }
      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      const link   = document.createElement('a')
      const period = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
      link.href     = url
      link.download = `ApexTrack_${period}_${reportId}_report.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      const cardTitle = REPORT_CARDS.find(r => r.id === reportId)?.title || 'Report'
      setStatusMsg({ text: `"${cardTitle}" downloaded successfully!`, type: 'success' })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      setStatusMsg({ text: '' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  // ── Medical PDF generator (physio) ───────────────────────────────────────
  async function generateMedicalPDF(reportScope) {
    const jobKey = `medical_${reportScope}`
    setGenerating(jobKey)
    setStatusMsg({ text: '', type: '' })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/reports/medical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reportScope,
          athleteId:  reportScope === 'player' ? selectedPlayer : null,
          month:      selMonth,
          year:       selYear,
          reportType,
        }),
      })

      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try { const j = await res.json(); errMsg = j.error || errMsg } catch (_e) { /* ignore */ }
        throw new Error(errMsg)
      }

      const data = await res.json()
      const period = reportType === 'yearly' ? `Year ${selYear}` : `${MONTHS[selMonth]} ${selYear}`
      const selectedAthleteName = athletes.find(a => a.id === selectedPlayer)?.name || 'Player'

      const doc = await buildMedicalPDF({ data, reportScope, selectedAthleteName, period })

      const safeName = (data.meta?.clubName || 'Club').replace(/[^a-zA-Z0-9_-]/g, '_')
      const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
      const fileSuffix = reportScope === 'player'
        ? `_${selectedAthleteName.replace(/\s+/g, '_')}`
        : '_General'
      const filename = `${safeName}_${safePeriod}_Medical_Report${fileSuffix}.pdf`

      doc.save(filename)

      setStatusMsg({
        text: `Medical Report downloaded as "${filename}"`,
        type: 'success',
      })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 6000)
    } catch (err) {
      setStatusMsg({ text: 'PDF generation failed: ' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  const activeAthletes  = athletes.filter(a => a.status === 'Active').length
  const activeContracts = contracts.filter(c => c.status === 'Active')
  const weeklyWage      = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)
  const period          = reportType === 'monthly' ? `${MONTHS[selMonth]} ${selYear}` : `Full Year ${selYear}`

  const sel = { padding:'9px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', fontSize:14, color:'var(--text)', background:'var(--surface2)', outline:'none', fontFamily:'var(--font)', cursor:'pointer' }

  return (
    <Layout>
      <div className="page-outer-wide">
        <PageHeader label="Analytics & Exports" title="Reports" subtitle="Generate and download reports for any time period" />

        {/* Stats row */}
        <div className="fade-up stat-grid-5" style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14, marginBottom:28 }}>
          {[
            { label:'Total Athletes',   value: loading ? '…' : athletes.length,        icon:<Users size={18} color="#4A90E2"/>, color:'#4A90E2' },
            { label:'Active Athletes',  value: loading ? '…' : activeAthletes,         icon:<Users size={18} color="#27AE60"/>, color:'#27AE60' },
            { label:'Injury Records',   value: loading ? '…' : injuries.length,        icon:<HeartPulse size={18} color="#E74C3C"/>, color:'#E74C3C' },
            { label:'Performance Logs', value: loading ? '…' : performance.length,     icon:<Trophy size={18} color="#9B59B6"/>, color:'#9B59B6' },
            { label:'Active Contracts', value: loading ? '…' : activeContracts.length, icon:<ClipboardList size={18} color="#1B7A3E"/>, color:'#1B7A3E' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:12, transition:'var(--transition)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>
              <div style={{ width:40, height:40, borderRadius:11, background:s.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--text)', lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginTop:4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Period selector */}
        <div className="card fade-up fade-up-1" style={{ padding:'22px 26px', marginBottom:24 }}>
          <h2 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Report Period</h2>
          <p style={{ fontSize:13, color:'var(--text3)', marginBottom:18 }}>All reports filter data based on your selected period.</p>
          <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:4 }}>
              {['monthly','yearly'].map(t => (
                <button key={t} onClick={() => setReportType(t)} style={{ padding:'8px 22px', background: reportType===t ? '#0D9488' : 'transparent', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:600, color: reportType===t ? '#fff' : 'var(--text2)', cursor:'pointer', transition:'var(--transition)', textTransform:'capitalize', fontFamily:'var(--font)' }}>
                  {t}
                </button>
              ))}
            </div>
            {reportType === 'monthly' && (
              <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))} style={sel}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            )}
            <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))} style={sel}>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
            <div style={{ fontSize:14, color:'var(--text2)' }}>
              Reporting on: <strong style={{ color:'#0D9488' }}>{period}</strong>
            </div>
          </div>
        </div>

        {/* Status message */}
        {statusMsg.text && (
          <div style={{ background: statusMsg.type==='error' ? 'var(--danger-light)' : '#E8F8EE', border:`1px solid ${statusMsg.type==='error' ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)'}`, borderRadius:'var(--r-md)', padding:'14px 18px', marginBottom:20, fontSize:13, color: statusMsg.type==='error' ? 'var(--danger)' : '#1B7A3E', fontWeight:600 }}>
            {statusMsg.text}
          </div>
        )}

        {/* ── Excel Report Cards ── */}
        <h2 className="fade-up" style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>
          Available Reports <span style={{ fontSize:13, fontWeight:500, color:'var(--text3)', marginLeft:8 }}>{REPORT_CARDS.length} report types</span>
        </h2>

        {loading ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ width:36, height:36, border:'4px solid #F0FDFA', borderTopColor:'#0D9488', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }} />
            <p style={{ color:'var(--text3)', fontSize:13 }}>Loading data…</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }} className="card-grid-auto">
            {REPORT_CARDS.map((card, idx) => {
              const isGenerating = generating === card.id
              return (
                <div key={card.id} className={`card fade-up fade-up-${idx % 4}`}
                  style={{ padding:0, overflow:'hidden', transition:'var(--transition)', border: card.featured ? `2px solid ${card.color}` : '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>

                  {card.featured && (
                    <div style={{ background:card.color, padding:'5px 16px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>
                      ⭐ Most Comprehensive
                    </div>
                  )}

                  <div style={{ padding:'20px 22px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                      <div style={{ width:50, height:50, borderRadius:14, background:card.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0, border:`1px solid ${card.color}25` }}>
                        {card.icon}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:5 }}>{card.title}</div>
                        <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.55 }}>{card.desc}</div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>{period}</span>
                      <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>{card.sheets}</span>
                      <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>Excel .xlsx</span>
                    </div>

                    <button
                      onClick={() => generateReport(card.id)}
                      disabled={isGenerating || loading}
                      style={{ width:'100%', padding:'11px 18px', background: isGenerating ? 'var(--surface3)' : `linear-gradient(135deg, ${card.color}EE, ${card.color}BB)`, color: isGenerating ? 'var(--text3)' : '#fff', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, cursor: isGenerating ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'var(--transition)', fontFamily:'var(--font)', boxShadow: isGenerating ? 'none' : `0 3px 12px ${card.color}40` }}>
                      {isGenerating ? (
                        <>
                          <div style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.15)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />
                          Generating…
                        </>
                      ) : <>⬇ Download Excel</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MEDICAL & PHYSIOTHERAPY PDF REPORTS — Physio / Admin only
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && canViewMedical && (
          <div className="fade-up" style={{ marginTop:36 }}>

            {/* Section header */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0F766E,#0D9488)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <HeartPulse size={18} color="#fff" strokeWidth={2.2}/>
              </div>
              <div>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', margin:0, letterSpacing:'-0.01em' }}>
                  Medical &amp; Physiotherapy Reports
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginLeft:10, fontSize:11, fontWeight:700, background:'#CCFBF1', color:'#0F766E', padding:'2px 8px', borderRadius:6, textTransform:'uppercase', letterSpacing:'0.04em', verticalAlign:'middle' }}>
                    <Activity size={11}/> {isPhysio && !isAdmin ? 'Physio' : 'Medical Access'}
                  </span>
                </h2>
                <p style={{ fontSize:12, color:'var(--text3)', margin:'2px 0 0', fontWeight:500 }}>
                  Generate confidential clinical PDF reports — injury log, rehab sessions, pain monitoring &amp; clearance status.
                </p>
              </div>
            </div>

            <div style={{ height:1, background:'linear-gradient(to right, #0D9488, transparent)', marginBottom:20 }}/>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>

              {/* ── Card 1: General Medical Report ── */}
              {(() => {
                const jobKey   = 'medical_general'
                const isGen    = generating === jobKey
                return (
                  <div className="card"
                    style={{ padding:0, overflow:'hidden', border:'2px solid #CCFBF1', transition:'var(--transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(13,148,136,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>

                    {/* Top accent bar */}
                    <div style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)', padding:'5px 16px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>
                      🏥 Confidential Clinical Document
                    </div>

                    <div style={{ padding:'20px 22px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                        <div style={{ width:50, height:50, borderRadius:14, background:'#CCFBF1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #99F6E4' }}>
                          <FileText size={24} color="#0F766E"/>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:5 }}>General Medical Report</div>
                          <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.55 }}>
                            Full team injury register, rehabilitation session logs, pain monitoring data, clearance statuses &amp; KPI summary for the selected period.
                          </div>
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#0F766E', background:'#CCFBF1', padding:'3px 10px', borderRadius:99, border:'1px solid #99F6E4', fontWeight:700 }}>{period}</span>
                        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>All Players</span>
                        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>PDF Document</span>
                      </div>

                      <button
                        id="btn-medical-general"
                        onClick={() => generateMedicalPDF('general')}
                        disabled={isGen}
                        style={{ width:'100%', padding:'11px 18px', background: isGen ? 'var(--surface3)' : 'linear-gradient(135deg,#0F766E,#0D9488)', color: isGen ? 'var(--text3)' : '#fff', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, cursor: isGen ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'var(--transition)', fontFamily:'var(--font)', boxShadow: isGen ? 'none' : '0 3px 12px rgba(13,148,136,0.35)' }}>
                        {isGen ? (
                          <>
                            <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
                            Generating PDF…
                          </>
                        ) : <>⬇ Download General Report (PDF)</>}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* ── Card 2: Player-Specific Report ── */}
              {(() => {
                const jobKey  = 'medical_player'
                const isGen   = generating === jobKey
                const canRun  = !!selectedPlayer
                return (
                  <div className="card"
                    style={{ padding:0, overflow:'hidden', border:'2px solid #FEE2E2', transition:'var(--transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(220,38,38,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>

                    <div style={{ background:'linear-gradient(135deg,#B91C1C,#DC2626)', padding:'5px 16px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'center' }}>
                      👤 Player-Specific Clinical Report
                    </div>

                    <div style={{ padding:'20px 22px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                        <div style={{ width:50, height:50, borderRadius:14, background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #FECACA' }}>
                          <User size={24} color="#DC2626"/>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:5 }}>Player Medical Report</div>
                          <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.55 }}>
                            Athlete profile, individual injury history, personal rehab sessions, pain trends &amp; return-to-play clearance timeline.
                          </div>
                        </div>
                      </div>

                      {/* Player selector */}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                          Select Player *
                        </label>
                        <select
                          id="medical-player-select"
                          value={selectedPlayer}
                          onChange={e => setSelectedPlayer(e.target.value)}
                          style={{ width:'100%', padding:'9px 14px', borderRadius:'var(--r-md)', border:`1px solid ${selectedPlayer ? '#FCA5A5' : 'var(--border)'}`, fontSize:13, fontWeight:600, color:'var(--text)', background:'var(--surface2)', outline:'none', fontFamily:'var(--font)', cursor:'pointer' }}>
                          <option value="">— Select an athlete —</option>
                          {athletes.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.position || 'Player'}){a.status === 'Injured' ? ' ⚠ Injured' : ''}</option>
                          ))}
                        </select>
                        {!selectedPlayer && (
                          <p style={{ fontSize:11, color:'#94A3B8', marginTop:4, fontStyle:'italic' }}>Choose a player to enable report generation</p>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#B91C1C', background:'#FEE2E2', padding:'3px 10px', borderRadius:99, border:'1px solid #FECACA', fontWeight:700 }}>{period}</span>
                        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>Single Player</span>
                        <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>PDF Document</span>
                      </div>

                      <button
                        id="btn-medical-player"
                        onClick={() => generateMedicalPDF('player')}
                        disabled={isGen || !canRun}
                        title={!canRun ? 'Select a player first' : ''}
                        style={{ width:'100%', padding:'11px 18px', background: isGen ? 'var(--surface3)' : canRun ? 'linear-gradient(135deg,#B91C1C,#DC2626)' : '#E2E8F0', color: isGen ? 'var(--text3)' : canRun ? '#fff' : '#94A3B8', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, cursor: (isGen || !canRun) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'var(--transition)', fontFamily:'var(--font)', boxShadow: (isGen || !canRun) ? 'none' : '0 3px 12px rgba(220,38,38,0.3)' }}>
                        {isGen ? (
                          <>
                            <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
                            Generating PDF…
                          </>
                        ) : <>⬇ Download Player Report (PDF)</>}
                      </button>
                    </div>
                  </div>
                )
              })()}

            </div>

            {/* Read-only note for admins */}
            {isAdmin && !isPhysio && (
              <div style={{ marginTop:14, background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', fontSize:12, color:'#92400E', display:'flex', gap:8, alignItems:'center' }}>
                <ShieldCheck size={15} color="#D97706"/>
                <span>You are viewing medical reports as <strong>Admin</strong>. These documents contain confidential physiotherapy records.</span>
              </div>
            )}
          </div>
        )}

        {/* Finance snapshot */}
        {!loading && contracts.length > 0 && (
          <div className="card fade-up" style={{ padding:'22px 26px', marginTop:24 }}>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Financial Snapshot</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14 }}>
              {[
                ['Weekly Wage Bill',  `GHS ${weeklyWage.toFixed(2)}`],
                ['Monthly Estimate',  `GHS ${(weeklyWage * 4.33).toFixed(2)}`],
                ['Annual Projection', `GHS ${(weeklyWage * 52).toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={label} style={{ background:'var(--surface2)', borderRadius:'var(--r-md)', padding:'14px 18px', border:'1px solid var(--border)', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:'#1B7A3E' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
