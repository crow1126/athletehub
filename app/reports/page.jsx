'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import { mobileSafeDownload, openDownloadWindow, mobileSafeDownloadIntoWindow } from '@/lib/pdfDownload'
import { getBase64ImageFromUrl, getApexTrackLogoBase64 } from '@/lib/pdfLogos'

import {
  Users, HeartPulse, Trophy, CalendarDays, ShieldCheck,
  ClipboardList, FileSpreadsheet, FileText, User,
  Stethoscope, Search, Download, CheckCircle2, AlertCircle, Activity, X,
  TrendingUp, Star
} from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const iconProps = { size: 24, strokeWidth: 1.8 }
const ADMIN_REPORT_CARDS = [
  { id:'athletes',    icon:<Users {...iconProps} color="#2563EB"/>, title:'Athletes Report',         desc:'Full squad roster — positions, clubs, regions, coaches, and status',                   color:'#2563EB', sheets:'1 sheet'  },
  { id:'injuries',    icon:<HeartPulse {...iconProps} color="#0D9488"/>, title:'Injury Register',          desc:'Complete injury records with severity, dates, recovery notes and status',               color:'#0D9488', sheets:'1 sheet'  },
  { id:'performance', icon:<Trophy {...iconProps} color="#7C3AED"/>, title:'Performance Report',      desc:'Match stats per athlete — goals, assists, xG, xA, pass accuracy, distance, ratings',   color:'#7C3AED', sheets:'1 sheet'  },
  { id:'sessions',    icon:<CalendarDays {...iconProps} color="#059669"/>, title:'Training Sessions',       desc:'All scheduled training sessions with venue, coach, type and duration',                  color:'#059669', sheets:'1 sheet'  },
  { id:'coaches',     icon:<ShieldCheck {...iconProps} color="#D97706"/>, title:'Staff Report',            desc:'Technical, medical, analytics and scouting staff roster with roles',                    color:'#D97706', sheets:'1 sheet'  },
  { id:'contracts',   icon:<ClipboardList {...iconProps} color="#047857"/>, title:'Contracts & Finance',     desc:'Player contracts, wages, bonuses and automatic wage bill summary sheet',                color:'#047857', sheets:'2 sheets' },
  { id:'summary',     icon:<FileSpreadsheet {...iconProps} color="#0F172A"/>, title:'Full Summary Report',     desc:'Everything in one workbook — all 6 modules combined with an overview cover sheet',      color:'#0F172A', sheets:'7 sheets', featured: true },
]

const ANALYST_REPORT_CARDS = [
  { id:'performance', icon:<Trophy {...iconProps} color="#7C3AED"/>, title:'Performance Report',      desc:'Match stats per athlete — goals, assists, xG, xA, pass accuracy, distance, ratings',   color:'#7C3AED', sheets:'1 sheet', featured: true },
  { id:'athletes',    icon:<Users {...iconProps} color="#2563EB"/>, title:'Squad Roster & Profiles',  desc:'Full squad roster — positions, clubs, regions, coaches, and squad status',              color:'#2563EB', sheets:'1 sheet'  },
  { id:'sessions',    icon:<CalendarDays {...iconProps} color="#059669"/>, title:'Training & Load Register', desc:'All scheduled squad training sessions with venue, coach, type and duration',          color:'#059669', sheets:'1 sheet'  },
]

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Logo helpers are imported from @/lib/pdfLogos (shared with physioReport.js)
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_STORAGE_REHAB_KEY = 'apextrack_rehab_notes_fallback'

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DATE FORMATTER — used in JSX previews AND PDF generators
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

function cleanPdfText(str) {
  if (!str) return ''
  return String(str)
    .replace(/[•●■◆▶►]/g, '- ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\r\n/g, '\n')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SPORTS INJURY DIAGNOSIS AND REHABILITATION PLAN (INDIVIDUAL PHYSIOTHERAPY REPORT)
// Full clinical detail: Profile + Photo, Team Logo, ApexTrack Logo, 9-Section Medical Framework
// ─────────────────────────────────────────────────────────────────────────────
async function buildPlayerClinicalDossierPDF({ data, selectedAthlete, period }) {
  const { buildPhysiotherapyReportPDF } = await import('@/lib/physioReport')
  const { meta, injuries = [], rehabNotes = [] } = data
  const ath = selectedAthlete || (data.athletes && data.athletes[0]) || {}
  const activeInjury = injuries.find(i => i.athlete_id === ath.id) || injuries[0] || null

  let customPlan = null
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`apextrack_physio_plan_${ath.id}`)
      if (raw) customPlan = JSON.parse(raw)
    } catch (_e) {}
  }

  return await buildPhysiotherapyReportPDF({
    athlete: ath,
    injury: activeInjury,
    rehabNotes,
    customPlan,
    meta,
    period,
  })
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. PLAYER PERFORMANCE & MATCH ANALYTICS DOSSIER (PDF)
// Full technical detail: Profile + Photo, Team Logo, ApexTrack Logo, Seasonal Stats, Match Log, Ratings
// ─────────────────────────────────────────────────────────────────────────────
async function buildPlayerPerformanceDossierPDF({ athlete, athleteStats, meta, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const [siteLogoBase64, teamLogoBase64, playerPhotoBase64] = await Promise.all([
    getApexTrackLogoBase64(),
    meta.clubLogoUrl ? getBase64ImageFromUrl(meta.clubLogoUrl) : null,
    athlete.photo_url ? getBase64ImageFromUrl(athlete.photo_url) : null,
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()  // 210
  const PH = doc.internal.pageSize.getHeight() // 297

  const NAVY    = [15, 23, 42]     // #0F172A
  const PURPLE  = [124, 58, 237]   // #7C3AED
  const TEAL    = [13, 148, 136]   // #0D9488
  const SLATE   = [51, 65, 85]     // #334155
  const LIGHT   = [248, 250, 252]  // #F8FAFC
  const BORDER  = [226, 232, 240]  // #E2E8F0
  const WHITE   = [255, 255, 255]

  // Top Header Banner
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 33, 'F')

  // Dual Accent line
  doc.setFillColor(...PURPLE)
  doc.rect(0, 32, PW * 0.65, 1.0, 'F')
  doc.setFillColor(...TEAL)
  doc.rect(PW * 0.65, 32, PW * 0.35, 1.0, 'F')

  // Team Logo
  let leftContentX = 12
  if (teamLogoBase64) {
    try {
      doc.setFillColor(...WHITE)
      doc.roundedRect(12, 5.2, 21, 21, 2, 2, 'F')
      doc.addImage(teamLogoBase64, 'PNG', 13, 6.2, 19, 19)
      leftContentX = 37
    } catch (_e) { /* fallback */ }
  }

  // Purple Capsule Badge: "PLAYER PERFORMANCE DOSSIER"
  doc.setFillColor(109, 40, 217)
  doc.roundedRect(leftContentX, 5.2, 54, 5.6, 1.4, 1.4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...WHITE)
  doc.text('PLAYER PERFORMANCE DOSSIER', leftContentX + 3.5, 9.1)

  // Club Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(...WHITE)
  doc.text(cleanPdfText(meta.clubName || 'ApexTrack Football Club').toUpperCase(), leftContentX, 17.5)

  // Scope & Window
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Performance & Analytics Department · Window: ${period}`, leftContentX, 23)

  // Right: ApexTrack logo
  if (siteLogoBase64) {
    try {
      doc.addImage(siteLogoBase64, 'PNG', PW - 26, 6, 16, 16)
    } catch (_e) { /* fallback */ }
  }

  let curY = 38

  // Player Bio Card
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(12, curY, PW - 24, 34, 3, 3, 'FD')

  // Player Photo
  const photoX = 16
  const photoY = curY + 3.5
  if (playerPhotoBase64) {
    try {
      doc.addImage(playerPhotoBase64, 'JPEG', photoX, photoY, 27, 27)
    } catch (_e) {
      doc.setFillColor(203, 213, 225)
      doc.rect(photoX, photoY, 27, 27, 'F')
    }
  } else {
    doc.setFillColor(241, 245, 249)
    doc.rect(photoX, photoY, 27, 27, 'F')
    doc.setFontSize(12)
    doc.setTextColor(...SLATE)
    doc.text((athlete.name || 'P').slice(0, 2).toUpperCase(), photoX + 8, photoY + 16)
  }

  // Bio Text
  const bioX = photoX + 32
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  doc.text(cleanPdfText(athlete.name || 'Athlete Name'), bioX, curY + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  const posText = `Position: ${athlete.position || 'Player'}   |   Squad No: #${athlete.back_number || '—'}   |   Club: ${athlete.club || meta.clubName || '—'}`
  doc.text(cleanPdfText(posText), bioX, curY + 16)

  const footText = `Preferred Foot: ${athlete.preferred_foot || '—'}   |   Status: ${athlete.status || 'Active'}   |   Generated: ${fmtDate(new Date())}`
  doc.text(cleanPdfText(footText), bioX, curY + 22)

  curY += 40

  // Summary KPI Cards (Matches, Goals, Assists, Minutes, Rating, xG)
  const statsList = athleteStats || []
  const matches = statsList.length
  const goals = statsList.reduce((s, p) => s + (parseInt(p.goals) || 0), 0)
  const assists = statsList.reduce((s, p) => s + (parseInt(p.assists) || 0), 0)
  const mins = statsList.reduce((s, p) => s + (parseInt(p.minutes_played) || 0), 0)
  const avgR = matches > 0
    ? (statsList.reduce((s, p) => s + (parseFloat(p.rating) || 0), 0) / matches).toFixed(1)
    : '—'
  const xg = statsList.reduce((s, p) => s + (parseFloat(p.xg) || 0), 0).toFixed(2)

  const kpiCols = [
    { label: 'MATCHES', val: String(matches) },
    { label: 'GOALS', val: String(goals) },
    { label: 'ASSISTS', val: String(assists) },
    { label: 'MINUTES', val: `${mins}'` },
    { label: 'AVG RATING', val: String(avgR) },
    { label: 'TOTAL xG', val: String(xg) },
  ]

  const cardW = (PW - 24 - (kpiCols.length - 1) * 3) / kpiCols.length
  kpiCols.forEach((kpi, idx) => {
    const cx = 12 + idx * (cardW + 3)
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(cx, curY, cardW, 16, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cx + cardW / 2, curY + 5.5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...PURPLE)
    doc.text(kpi.val, cx + cardW / 2, curY + 12.5, { align: 'center' })
  })

  curY += 22

  // Match Performance Table Section Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('MATCH-BY-MATCH PERFORMANCE RECORD', 12, curY)
  curY += 4

  const tableRows = statsList.map(st => [
    fmtDate(st.match_date),
    cleanPdfText(st.opponent || '—'),
    String(st.minutes_played || 0) + "'",
    String(st.goals || 0),
    String(st.assists || 0),
    `${st.shots || 0} (${st.shots_on_target || 0})`,
    `${st.passes || 0} (${st.pass_accuracy || 0}%)`,
    st.xg !== undefined && st.xg !== null ? String(st.xg) : '—',
    st.rating ? `${st.rating}/10` : '—',
  ])

  if (tableRows.length === 0) {
    tableRows.push(['—', 'No match performance entries for this period', '—', '—', '—', '—', '—', '—', '—'])
  }

  autoTable(doc, {
    startY: curY,
    margin: { left: 12, right: 12 },
    head: [['Date', 'Opponent', 'Mins', 'Goals', 'Assists', 'Shots (OT)', 'Passes (Acc)', 'xG', 'Rating']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: SLATE,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 26 },
      1: { halign: 'left', cellWidth: 38 },
    },
    alternateRowStyles: { fillColor: LIGHT },
  })

  curY = doc.lastAutoTable.finalY + 10

  // Technical Assessment / Analyst Observations Box
  if (curY < PH - 45) {
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(12, curY, PW - 24, 28, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...NAVY)
    doc.text('ANALYST PERFORMANCE SUMMARY & TACTICAL EVALUATION', 16, curY + 6.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    const evalText = statsList.length > 0 && statsList[0].notes
      ? cleanPdfText(statsList[0].notes)
      : `Player demonstrated consistent match engagement with ${matches} appearance(s) totaling ${mins} minutes played in this window. Overall impact: ${goals} goal(s), ${assists} assist(s), average performance rating of ${avgR}/10. Approved for tactical review and coaching staff briefing.`

    doc.text(doc.splitTextToSize(evalText, PW - 32), 16, curY + 13)
  }

  // Running footer
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 11, PW, 11, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(
      `${(meta.clubName || 'CLUB').toUpperCase()}  •  PERFORMANCE DOSSIER: ${(athlete.name || 'ATHLETE').toUpperCase()}  •  ${period}  •  Page ${pg} of ${totalPages}`,
      PW / 2, ph - 4.5, { align: 'center' }
    )
  }

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADMIN GENERAL SQUAD MEDICAL & RECOVERY REPORT (PDF)
// ─────────────────────────────────────────────────────────────────────────────
async function buildAdminGeneralMedicalPDF({ data, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { meta, kpis, activeInjuries = [], recoveredInjuries = [] } = data

  const [siteLogoBase64, teamLogoBase64] = await Promise.all([
    getApexTrackLogoBase64(),
    meta.clubLogoUrl ? getBase64ImageFromUrl(meta.clubLogoUrl) : null,
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210
  const PH  = doc.internal.pageSize.getHeight()  // 297

  const NAVY    = [15,  23,  42]    // #0F172A
  const TEAL    = [13, 148, 136]    // #0D9488
  const SLATE   = [51,  65,  85]    // #334155
  const GREEN   = [22, 163,  74]    // #16A34A
  const AMBER   = [217, 119,  6]    // #D97706
  const WHITE   = [255, 255, 255]
  const LIGHT   = [248, 250, 252]   // #F8FAFC
  const BORDER  = [226, 232, 240]   // #E2E8F0
  const TEXT    = [15,  23,  42]    // #0F172A
  const TEXT2   = [100, 116, 139]   // #64748B


  let y = 0

  // ── Top Header Banner (33mm) ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 33, 'F')

  // Dual Accent line at bottom of header
  doc.setFillColor(...TEAL)
  doc.rect(0, 32, PW * 0.65, 1.0, 'F')
  doc.setFillColor(45, 212, 191)
  doc.rect(PW * 0.65, 32, PW * 0.35, 1.0, 'F')

  // ── Left Side: Team Logo & Classy Badge Pill ──
  let leftContentX = 12
  if (teamLogoBase64) {
    try {
      doc.setFillColor(...WHITE)
      doc.roundedRect(12, 5.2, 21, 21, 2, 2, 'F')
      doc.addImage(teamLogoBase64, 'PNG', 13, 6.2, 19, 19)
      leftContentX = 37
    } catch (_e) { /* fallback */ }
  }

  // Classy Squad Health Badge Pill
  const badgeW = 46
  const badgeH = 5.6
  doc.setFillColor(15, 118, 110) // Rich Teal-700
  doc.roundedRect(leftContentX, 5.2, badgeW, badgeH, 1.4, 1.4, 'F')
  doc.setDrawColor(45, 212, 191)
  doc.setLineWidth(0.25)
  doc.roundedRect(leftContentX, 5.2, badgeW, badgeH, 1.4, 1.4, 'D')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('EXECUTIVE SQUAD AUDIT', leftContentX + (badgeW / 2), 9.0, { align: 'center' })

  // Club Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...WHITE)
  doc.text((meta.clubName || 'CLUB').toUpperCase(), leftContentX, 17.5)

  // Department Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(45, 212, 191)
  doc.text('SPORTS MEDICINE & SQUAD RECOVERY UNIT', leftContentX, 23.5)

  // ── Right Side: Small Visible ApexTrack GH Logo + Title & Period ──
  const logoBoxW = 15
  const logoBoxH = 15
  const logoBoxX = PW - 26
  const logoBoxY = 5.2

  if (siteLogoBase64) {
    try {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 2, 2, 'F')
      doc.setDrawColor(45, 212, 191)
      doc.setLineWidth(0.3)
      doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 2, 2, 'D')
      doc.addImage(siteLogoBase64, 'PNG', logoBoxX + 1, logoBoxY + 1, logoBoxW - 2, logoBoxH - 2)

      // Brand caption underneath logo
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(45, 212, 191)
      doc.text('ApexTrack GH', logoBoxX + (logoBoxW / 2), logoBoxY + logoBoxH + 4.2, { align: 'center' })
    } catch (_e) { /* fallback */ }
  }

  const rightTextX = siteLogoBase64 ? logoBoxX - 4 : PW - 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('MEDICAL & REHABILITATION REPORT', rightTextX, 10.0, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(45, 212, 191)
  doc.text('EXECUTIVE SQUAD OVERVIEW', rightTextX, 17.0, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`MONTHLY SQUAD AUDIT  •  ${period}`, rightTextX, 23.5, { align: 'right' })

  y = 40

  // ── Executive KPIs ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('SQUAD AVAILABILITY & HEALTH SCORECARD', 12, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      ['Total Squad Athletes',       kpis.totalAthletesInScope,          'Squad Match Fitness Rate', `${kpis.squadFitnessRate}%`],
      ['Total Injuries in Period',   kpis.totalInjuries,                 'Total Rehab Sessions Held', kpis.totalRehabSessions],
      ['Currently in Rehabilitation', kpis.activeInjuries,               'Recovered Athletes (Cleared)', kpis.recoveredInjuries],
      ['Severe Cases',               kpis.severeCases,                   'Squad Avg Pain Index',     `${kpis.avgPainLevel} / 10`],
    ],
    styles: { fontSize: 7.6, cellPadding: 2.5, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 52 },
      1: { fontStyle: 'bold', textColor: TEAL,  cellWidth: 43 },
      2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 52 },
      3: { fontStyle: 'bold', textColor: GREEN, cellWidth: 43 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 7

  // ── Section 1: Active Injuries ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`1. CURRENTLY ACTIVE INJURIES (IN REHABILITATION) — ${activeInjuries.length} player${activeInjuries.length === 1 ? '' : 's'}`, 12, y)
  y += 4

  if (activeInjuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GREEN)
    doc.text('All Clear: No active injury cases recorded. Squad is at 100% availability.', 12, y + 3)
    y += 10
  } else {
    const activeRows = activeInjuries.map((inj, idx) => {
      let daysOut = '—'
      if (inj.date_of_injury) {
        const start = new Date(inj.date_of_injury)
        const diff  = Math.ceil((new Date() - start) / 86400000)
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
        inj.status || 'Active',
        inj.notes ? inj.notes.slice(0, 50) + (inj.notes.length > 50 ? '…' : '') : '—',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Athlete', 'Pos', 'Injury Type', 'Severity', 'Date Injured', 'Exp. Return', 'Days Out', 'Status', 'Rehab Notes']],
      body: activeRows,
      styles: { fontSize: 6.8, cellPadding: 2.3, overflow: 'linebreak' },
      headStyles: { fillColor: SLATE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 32, fontStyle: 'bold' },
        2: { cellWidth: 14 },
        3: { cellWidth: 30 },
        4: { cellWidth: 16 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 14, fontStyle: 'bold', textColor: [217, 119, 6] },
        9: { cellWidth: 'auto' },
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 7
  }

  // ── Section 2: Recovered Athletes ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`2. RECOVERED ATHLETES REGISTER (CLEARED TO PLAY) — ${recoveredInjuries.length} athlete${recoveredInjuries.length === 1 ? '' : 's'}`, 12, y)
  y += 4

  if (recoveredInjuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text('No recovery transitions recorded for this specific period.', 12, y + 3)
    y += 10
  } else {
    const recRows = recoveredInjuries.map((inj, idx) => {
      let duration = '—'
      if (inj.date_of_injury && (inj.expected_return || inj.updated_at)) {
        const start = new Date(inj.date_of_injury)
        const end   = new Date(inj.expected_return || inj.updated_at)
        const diff  = Math.ceil((end - start) / 86400000)
        duration = diff >= 0 ? `${diff} days` : '—'
      }
      return [
        idx + 1,
        inj.athletes?.name || '—',
        inj.athletes?.position || '—',
        inj.injury_type || '—',
        inj.severity || '—',
        fmtDate(inj.date_of_injury),
        fmtDate(inj.expected_return || inj.updated_at),
        duration,
        'Cleared / Fit',
        inj.notes ? inj.notes.slice(0, 50) + (inj.notes.length > 50 ? '…' : '') : 'Full recovery achieved',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Athlete', 'Pos', 'Injury Sustained', 'Severity', 'Date Injured', 'Date Cleared', 'Total Missed', 'Outcome Status', 'Recovery Notes']],
      body: recRows,
      styles: { fontSize: 6.8, cellPadding: 2.3, overflow: 'linebreak' },
      headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 32, fontStyle: 'bold' },
        2: { cellWidth: 14 },
        3: { cellWidth: 30 },
        4: { cellWidth: 16 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 22, fontStyle: 'bold', textColor: [22, 163, 74] },
        9: { cellWidth: 'auto' },
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 7
  }

  // ── Section 3: Executive Sign-off ──
  if (y > PH - 48) { doc.addPage(); y = 18 }

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12,  y + 12, 80,  y + 12)
  doc.line(110, y + 12, 180, y + 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT2)
  doc.text('CLUB MEDICAL DIRECTOR / PHYSIOTHERAPIST', 12,  y + 16)
  doc.text('HEAD COACH / EXECUTIVE ADMINISTRATOR',    110, y + 16)

  // Running footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 11, PW, 11, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(
      `${(meta.clubName || 'CLUB').toUpperCase()}  •  SQUAD HEALTH & INJURY REPORT  •  ${period}  •  Page ${pg} of ${totalPages}`,
      PW / 2, ph - 4.5, { align: 'center' }
    )
  }

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REPORTS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [athletes,       setAthletes]       = useState([])
  const [injuries,       setInjuries]       = useState([])
  const [rehabNotes,     setRehabNotes]     = useState([])
  const [performance,    setPerformance]    = useState([])
  const [sessions,       setSessions]       = useState([])
  const [coaches,        setCoaches]        = useState([])
  const [contracts,      setContracts]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [generating,     setGenerating]     = useState(null)
  const [statusMsg,      setStatusMsg]      = useState({ text:'', type:'' })
  const [currentProfile, setCurrentProfile] = useState(null)

  // ── 3-STEP FLOW: Category -> Time -> Target Scope ──────────────────────────
  // 1. Category: 'analytics' | 'medical' | 'overall' | 'finance'
  const [activeCategory, setActiveCategory] = useState('analytics')
  
  // 2. Time: 'monthly' | 'yearly'
  const [reportType, setReportType] = useState('monthly')
  const [selMonth,   setSelMonth]   = useState(new Date().getMonth())
  const [selYear,    setSelYear]    = useState(new Date().getFullYear())

  // 3. Target Scope: 'squad' (Full Squad / Club) | 'individual' (Specific Player)
  const [targetScope, setTargetScope] = useState('squad')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')

  const years = []
  for (let y = 2022; y <= new Date().getFullYear() + 1; y++) years.push(y)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { session, teamId, profile } = await getTenantProfile()
        if (!session || !teamId) {
          setLoading(false)
          return
        }
        setCurrentProfile(profile)

        // Use Promise.allSettled so if rehabilitation_notes table does not exist,
        // it fails gracefully and falls back to local storage cache
        const results = await Promise.allSettled([
          scopeTeam(supabase.from('athletes').select('*, coaches(name)'), teamId).order('name', { ascending: true }),
          scopeTeam(supabase.from('injuries').select('*, athletes(name, club, position, photo_url)'), teamId),
          scopeTeam(supabase.from('rehabilitation_notes').select('*, athletes(name, position, photo_url)'), teamId).order('session_date', { ascending: false }),
          scopeTeam(supabase.from('performance_stats').select('*, athletes(name, position, club)'), teamId).order('match_date', { ascending: false }),
          scopeTeam(supabase.from('training_sessions').select('*'), teamId),
          scopeTeam(supabase.from('coaches').select('*'), teamId),
          scopeTeam(supabase.from('contracts').select('*, athletes(name, position, club)'), teamId),
        ])

        const a  = results[0].status === 'fulfilled' ? (results[0].value?.data || []) : []
        const i  = results[1].status === 'fulfilled' ? (results[1].value?.data || []) : []
        const r  = results[2].status === 'fulfilled' ? (results[2].value?.data || []) : []
        const p  = results[3].status === 'fulfilled' ? (results[3].value?.data || []) : []
        const s  = results[4].status === 'fulfilled' ? (results[4].value?.data || []) : []
        const c  = results[5].status === 'fulfilled' ? (results[5].value?.data || []) : []
        const ct = results[6].status === 'fulfilled' ? (results[6].value?.data || []) : []

        // Read local storage cache for rehab notes
        let localRehab = []
        try {
          const raw1 = localStorage.getItem(`apextrack_rehab_notes_fallback_${teamId}`)
          const raw2 = localStorage.getItem('apextrack_rehab_notes_fallback')
          const parsed1 = raw1 ? JSON.parse(raw1) : []
          const parsed2 = raw2 ? JSON.parse(raw2) : []
          localRehab = [...parsed1, ...parsed2]
        } catch {
          localRehab = []
        }

        const combinedRehab = [...(r || [])]
        for (const lr of localRehab) {
          if (!combinedRehab.some(cr => cr.id === lr.id || (cr.athlete_id === lr.athlete_id && cr.session_date === lr.session_date && cr.treatment_summary === lr.treatment_summary))) {
            combinedRehab.push(lr)
          }
        }
        combinedRehab.sort((x, y) => new Date(y.session_date || y.created_at || 0) - new Date(x.session_date || x.created_at || 0))

        setAthletes(a   || [])
        setInjuries(i   || [])
        setRehabNotes(combinedRehab)
        setPerformance(p|| [])
        setSessions(s   || [])
        setCoaches(c    || [])
        setContracts(ct || [])

        if (a && a.length > 0) {
          setSelectedPlayer(prev => (prev && a.some(ath => ath.id === prev) ? prev : a[0].id))
        }
      } catch (err) {
        setStatusMsg({ text: 'Failed to load report data: ' + err.message, type: 'error' })
      }
      setLoading(false)
    }
    load()
  }, [])

  const userRole     = currentProfile?.role || 'staff'
  const isPhysio     = userRole === 'physio' ||
                       currentProfile?.staff_type === 'physio' ||
                       currentProfile?.staff_type === 'medical' ||
                       currentProfile?.staff_type === 'sports_scientist'
  const isAnalyst    = userRole === 'analyst' ||
                       currentProfile?.staff_type === 'analyst' ||
                       userRole === 'scout' ||
                       currentProfile?.staff_type === 'scout'
  const isAdmin      = userRole === 'admin' || userRole === 'superadmin'

  const isPurePhysio  = isPhysio && !isAdmin
  const isPureAnalyst = isAnalyst && !isAdmin

  useEffect(() => {
    if (isPurePhysio) {
      setActiveCategory('medical')
    } else if (isPureAnalyst) {
      setActiveCategory('analytics')
    }
  }, [isPurePhysio, isPureAnalyst])

  // ── Performance PDF generator ─────────────────────────────────────────────
  async function generatePerformancePDF(athleteId) {
    const targetId = athleteId || selectedPlayer
    const athlete = athletes.find(a => a.id === targetId)
    if (!athlete) {
      setStatusMsg({ text: 'Please select an athlete first.', type: 'error' })
      return
    }
    const isDesk = typeof window !== 'undefined' && !(/iphone|ipad|ipod|android/i.test(navigator.userAgent || ''))
    const win = isDesk ? openDownloadWindow(`Performance Dossier — ${athlete.name}`) : null
    const jobKey = `perf_${targetId}`
    setGenerating(jobKey)
    setStatusMsg({ text: '', type: '' })
    try {
      const athleteStats = performance.filter(p => p.athlete_id === targetId)
      const periodStr = reportType === 'yearly' ? `Year ${selYear}` : `${MONTHS[selMonth]} ${selYear}`
      const meta = {
        clubName: currentProfile?.club_name || currentProfile?.teams?.name || 'Club',
        clubLogoUrl: currentProfile?.club_logo_url || currentProfile?.teams?.logo_url || null,
      }
      const doc = await buildPlayerPerformanceDossierPDF({ athlete, athleteStats, meta, period: periodStr })
      const safeAthlete = (athlete.name || 'Player').replace(/\s+/g, '_')
      const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
      const filename = `${safeAthlete}_Performance_Dossier_${safePeriod}.pdf`
      if (win) {
        await mobileSafeDownloadIntoWindow(win, doc, filename)
      } else {
        await mobileSafeDownload(doc, filename)
      }
      setStatusMsg({ text: `Performance Dossier ready for ${athlete.name}.`, type: 'success' })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      if (win) try { win.close() } catch {}
      setStatusMsg({ text: 'PDF generation failed: ' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  // ── Excel report generator ────────────────────────────────────────────────
  async function generateExcelReport(reportId) {
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
        try { const j = await res.json(); errMsg = j.error || errMsg } catch (_e) {}
        throw new Error(errMsg)
      }
      const blob   = await res.blob()
      const periodStr = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
      await mobileSafeDownload(blob, `ApexTrack_${periodStr}_${reportId}_report.xlsx`)
      const cardTitle = ADMIN_REPORT_CARDS.find(r => r.id === reportId)?.title || 'Report'
      setStatusMsg({ text: `"${cardTitle}" downloaded successfully!`, type: 'success' })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      setStatusMsg({ text: '' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  // ── Medical PDF generator ────────────────────────────────────────────────
  async function generateMedicalPDF(reportScope, targetAthleteId) {
    const isDesk = typeof window !== 'undefined' && !(/iphone|ipad|ipod|android/i.test(navigator.userAgent || ''))
    const effectiveAthleteId = targetAthleteId || selectedPlayer
    const selectedAth = reportScope === 'player' ? (athletes.find(a => a.id === effectiveAthleteId) || athletes[0]) : null
    const winTitle = reportScope === 'player'
      ? `Physiotherapy & Rehabilitation Plan — ${selectedAth?.name || 'Athlete'}`
      : 'Squad Medical & Clinical Health Report'
    const win = isDesk ? openDownloadWindow(winTitle) : null

    const jobKey = reportScope === 'player' ? `medical_player_${effectiveAthleteId}` : 'medical_general'
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
          athleteId:  reportScope === 'player' ? effectiveAthleteId : null,
          month:      selMonth,
          year:       selYear,
          reportType,
          clientRehabNotes: rehabNotes,
        }),
      })

      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try { const j = await res.json(); errMsg = j.error || errMsg } catch (_e) {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      const periodStr = reportType === 'yearly' ? `Year ${selYear}` : `${MONTHS[selMonth]} ${selYear}`

      let doc
      let filename

      if (reportScope === 'player') {
        const targetAth = athletes.find(a => a.id === effectiveAthleteId) || data.athletes[0]
        const playerRehabs = rehabNotes.filter(r => r.athlete_id === effectiveAthleteId)
        const combinedPlayerRehab = [...(data.rehabNotes || [])]
        for (const pr of playerRehabs) {
          if (!combinedPlayerRehab.some(dr => dr.id === pr.id)) {
            combinedPlayerRehab.push(pr)
          }
        }
        data.rehabNotes = combinedPlayerRehab

        doc = await buildPlayerClinicalDossierPDF({ data, selectedAthlete: targetAth, period: periodStr })
        const safeAthlete = (targetAth?.name || 'Player').replace(/\s+/g, '_')
        const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
        filename = `${safeAthlete}_Physiotherapy_Rehab_Plan_${safePeriod}.pdf`
      } else {
        doc = await buildAdminGeneralMedicalPDF({ data, period: periodStr })
        const safeName = (data.meta?.clubName || 'Club').replace(/[^a-zA-Z0-9_-]/g, '_')
        const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
        filename = `${safeName}_Squad_Medical_Report_${safePeriod}.pdf`
      }

      if (win) {
        await mobileSafeDownloadIntoWindow(win, doc, filename)
      } else {
        await mobileSafeDownload(doc, filename)
      }

      setStatusMsg({
        text: reportScope === 'player' ? `Medical Dossier ready for ${selectedAth?.name || 'Athlete'}.` : 'Squad Medical Report ready.',
        type: 'success',
      })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      if (win) try { win.close() } catch {}
      setStatusMsg({ text: 'PDF generation failed: ' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  // Derived period label
  const period = reportType === 'monthly' ? `${MONTHS[selMonth]} ${selYear}` : `Full Year ${selYear}`
  const activeContracts = contracts.filter(c => c.status === 'Active')
  const weeklyWage      = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)

  // Derived selected athlete
  const currentAthlete = athletes.find(a => a.id === selectedPlayer) || athletes[0] || null
  const filteredAthletes = athletes.filter(a => {
    if (!playerSearchQuery.trim()) return true
    const q = playerSearchQuery.toLowerCase()
    return (a.name || '').toLowerCase().includes(q) || (a.position || '').toLowerCase().includes(q)
  })

  // Selected player stats
  const athleteStats = currentAthlete ? performance.filter(p => p.athlete_id === currentAthlete.id) : []
  const athMatches = athleteStats.length
  const athGoals   = athleteStats.reduce((s, p) => s + (parseInt(p.goals) || 0), 0)
  const athAssists = athleteStats.reduce((s, p) => s + (parseInt(p.assists) || 0), 0)
  const athMins    = athleteStats.reduce((s, p) => s + (parseInt(p.minutes_played) || 0), 0)
  const athRating  = athMatches > 0 ? (athleteStats.reduce((s, p) => s + (parseFloat(p.rating) || 0), 0) / athMatches).toFixed(1) : '—'
  const athXg      = athleteStats.reduce((s, p) => s + (parseFloat(p.xg) || 0), 0).toFixed(2)

  // Selected player medical
  const athleteInjuries = currentAthlete ? injuries.filter(i => i.athlete_id === currentAthlete.id) : []
  const athleteActiveInj = athleteInjuries.filter(i => i.status === 'Active')
  const athleteRehabs   = currentAthlete ? rehabNotes.filter(r => r.athlete_id === currentAthlete.id) : []
  const latestRehab     = athleteRehabs[0]

  // Squad active injuries
  const squadActiveInjuries = injuries.filter(i => i.status === 'Active')

  // Available categories based on role
  const categoryOptions = [
    ...(!isPurePhysio ? [{ id: 'analytics', label: 'Analytics & Performance', icon: <TrendingUp size={16}/>, color: '#7C3AED', badge: 'Performance' }] : []),
    ...(!isPureAnalyst ? [{ id: 'medical', label: 'Medical & Physio', icon: <HeartPulse size={16}/>, color: '#0D9488', badge: `${squadActiveInjuries.length} Active` }] : []),
    ...(!isPurePhysio && !isPureAnalyst ? [
      { id: 'overall', label: 'Overall Club Operations', icon: <FileSpreadsheet size={16}/>, color: '#2563EB', badge: 'Club Workbooks' },
      { id: 'finance', label: 'Finance & Contracts', icon: <ClipboardList size={16}/>, color: '#059669', badge: 'Payroll' },
    ] : []),
  ]

  return (
    <Layout>
      <div className="page-outer-wide" style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 80px' }}>
        
        {/* ── Page Header ── */}
        <PageHeader
          label="Reports & Data Export"
          title="Club Reports Center"
          subtitle="Generate official match performance dossiers, clinical rehabilitation dossiers, and club spreadsheets in 3 simple steps."
        />

        {/* ── Toast status message ── */}
        {statusMsg.text && (
          <div style={{
            background: statusMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${statusMsg.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: statusMsg.type === 'error' ? '#B91C1C' : '#166534',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP-BY-STEP FILTER CONSOLE (Clean, Simple, Uncluttered)
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 20px',
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>

          {/* STEP 1: CATEGORY SELECTION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Step 1 · Choose Category
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {categoryOptions.map(cat => {
                const isSelected = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: isSelected ? cat.color : 'var(--surface2)',
                      color: isSelected ? '#FFFFFF' : 'var(--text)',
                      border: isSelected ? `1.5px solid ${cat.color}` : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontFamily: 'var(--font)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : `${cat.color}15`,
                        color: isSelected ? '#FFFFFF' : cat.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {cat.icon}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* STEP 2 & STEP 3: TIME PERIOD & TARGET SCOPE (SIDE BY SIDE) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            
            {/* STEP 2: TIME SCOPE */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Step 2 · Time Period (Month / Year)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
                  {['monthly', 'yearly'].map(t => (
                    <button
                      key={t}
                      onClick={() => setReportType(t)}
                      style={{
                        padding: '6px 14px',
                        background: reportType === t ? '#0D9488' : 'transparent',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: reportType === t ? '#FFFFFF' : 'var(--text2)',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {reportType === 'monthly' && (
                  <select
                    value={selMonth}
                    onChange={e => setSelMonth(parseInt(e.target.value))}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 12.5,
                      color: 'var(--text)',
                      background: 'var(--surface2)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      fontWeight: 600,
                    }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                )}

                <select
                  value={selYear}
                  onChange={e => setSelYear(parseInt(e.target.value))}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12.5,
                    color: 'var(--text)',
                    background: 'var(--surface2)',
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    fontWeight: 600,
                  }}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <span style={{ fontSize: 11.5, fontWeight: 700, background: '#F0FDFA', color: '#0D9488', padding: '5px 10px', borderRadius: 6, border: '1px solid #CCFBF1' }}>
                  Scope: {period}
                </span>
              </div>
            </div>

            {/* STEP 3: REPORT TARGET SCOPE (Full Squad vs Individual) */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Step 3 · Report Target Scope
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setTargetScope('squad')}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: targetScope === 'squad' ? 'var(--text)' : 'var(--surface2)',
                    color: targetScope === 'squad' ? '#FFFFFF' : 'var(--text2)',
                    border: targetScope === 'squad' ? '1px solid var(--text)' : '1px solid var(--border)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Users size={14}/>
                  Full Squad / Club
                </button>

                <button
                  onClick={() => setTargetScope('individual')}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: targetScope === 'individual' ? '#0D9488' : 'var(--surface2)',
                    color: targetScope === 'individual' ? '#FFFFFF' : 'var(--text2)',
                    border: targetScope === 'individual' ? '1px solid #0D9488' : '1px solid var(--border)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <User size={14}/>
                  Individual Player
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            REPORT ACTION CARDS BASED ON CATEGORY & SCOPE
        ══════════════════════════════════════════════════════════════════════ */}

        {/* ──────────────────────────────────────────────────────────────────
            VIEW A: INDIVIDUAL PLAYER SCOPE
        ────────────────────────────────────────────────────────────────── */}
        {targetScope === 'individual' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Player Selection Bar */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Select Individual Player</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Choose the athlete to generate individual dossiers</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={selectedPlayer}
                  onChange={e => setSelectedPlayer(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    color: 'var(--text)',
                    background: 'var(--surface2)',
                    minWidth: 240,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                  }}
                >
                  {athletes.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.position || 'Player'}{a.back_number ? ` · #${a.back_number}` : ''}) {a.status === 'Injured' ? '• [Injured]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Individual Athlete Dossier Card */}
            {currentAthlete ? (
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              }}>
                {/* Header Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  borderBottom: activeCategory === 'medical' ? '2.5px solid #0D9488' : '2.5px solid #7C3AED',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {currentAthlete.photo_url ? (
                      <img
                        src={currentAthlete.photo_url}
                        alt={currentAthlete.name}
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '2px solid #2DD4BF' }}
                      />
                    ) : (
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: '#0F766E',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 800,
                      }}>
                        {currentAthlete.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 800 }}>
                        {currentAthlete.name} {currentAthlete.back_number ? `· #${currentAthlete.back_number}` : ''}
                      </div>
                      <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                        {currentAthlete.position || 'Athlete'} · {currentAthlete.club || currentProfile?.club_name || 'ApexTrack GH'}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: currentAthlete.status === 'Injured' ? '#FEF2F2' : '#F0FDF4',
                    color: currentAthlete.status === 'Injured' ? '#DC2626' : '#16A34A',
                    border: currentAthlete.status === 'Injured' ? '1px solid #FECACA' : '1px solid #BBF7D0',
                  }}>
                    {currentAthlete.status === 'Injured' ? 'In Rehabilitation' : 'Match Fit'}
                  </span>
                </div>

                {/* Body Content tailored to category */}
                <div style={{ padding: '20px' }}>
                  
                  {/* CATEGORY: ANALYTICS */}
                  {activeCategory === 'analytics' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                            Match Performance Profile ({period})
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            Official match statistics and performance rating metrics
                          </div>
                        </div>

                        <button
                          onClick={() => generatePerformancePDF(currentAthlete.id)}
                          disabled={generating === `perf_${currentAthlete.id}`}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 8,
                            background: generating === `perf_${currentAthlete.id}` ? '#E2E8F0' : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                            color: generating === `perf_${currentAthlete.id}` ? '#94A3B8' : '#FFFFFF',
                            border: 'none',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: generating === `perf_${currentAthlete.id}` ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                          }}
                        >
                          {generating === `perf_${currentAthlete.id}` ? (
                            <>
                              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                              Generating PDF…
                            </>
                          ) : (
                            <>
                              <Download size={14}/>
                              Download Performance Dossier (PDF)
                            </>
                          )}
                        </button>
                      </div>

                      {/* KPI Stat Chips */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 16 }}>
                        {[
                          { label: 'Apps', val: athMatches, color: '#0F172A' },
                          { label: 'Goals', val: athGoals, color: '#7C3AED' },
                          { label: 'Assists', val: athAssists, color: '#2563EB' },
                          { label: 'Minutes', val: `${athMins}'`, color: '#0D9488' },
                          { label: 'Avg Rating', val: athRating, color: '#D97706' },
                          { label: 'xG', val: athXg, color: '#059669' },
                        ].map((k, i) => (
                          <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.val}</div>
                          </div>
                        ))}
                      </div>

                      {athMatches === 0 && (
                        <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B' }}>
                          No match statistics logged for {currentAthlete.name} in {period}. The PDF dossier will include their baseline athlete profile.
                        </div>
                      )}
                    </div>
                  )}

                  {/* CATEGORY: MEDICAL */}
                  {activeCategory === 'medical' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                            Clinical &amp; Rehabilitation Dossier ({period})
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            Complete physiotherapy notes, recovery protocol, and return-to-play timeline
                          </div>
                        </div>

                        <button
                          onClick={() => generateMedicalPDF('player', currentAthlete.id)}
                          disabled={generating === `medical_player_${currentAthlete.id}`}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 8,
                            background: generating === `medical_player_${currentAthlete.id}` ? '#E2E8F0' : 'linear-gradient(135deg, #0D9488, #0F766E)',
                            color: generating === `medical_player_${currentAthlete.id}` ? '#94A3B8' : '#FFFFFF',
                            border: 'none',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: generating === `medical_player_${currentAthlete.id}` ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
                          }}
                        >
                          {generating === `medical_player_${currentAthlete.id}` ? (
                            <>
                              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                              Generating PDF…
                            </>
                          ) : (
                            <>
                              <Download size={14}/>
                              Download Medical &amp; Rehab Dossier (PDF)
                            </>
                          )}
                        </button>
                      </div>

                      {/* Active Case or Clear Status */}
                      {athleteActiveInj.length > 0 ? (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                          <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: 13, marginBottom: 4 }}>
                            Active Injury: {athleteActiveInj[0].injury_type || 'Injury'} ({athleteActiveInj[0].severity || 'Active'})
                          </div>
                          <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
                            Sustained on {fmtDate(athleteActiveInj[0].date_of_injury)} · Expected Return: {fmtDate(athleteActiveInj[0].expected_return)}
                          </div>
                          {latestRehab?.treatment_summary && (
                            <div style={{ fontSize: 11.5, color: '#991B1B', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #FECACA' }}>
                              Latest Rehab: {latestRehab.treatment_summary} (Pain: {latestRehab.pain_level ?? 0}/10)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginBottom: 14, color: '#166534', fontSize: 12.5 }}>
                          <strong>Match Fit:</strong> No active injury on record for this period. Download the clinical dossier above for full historical records.
                        </div>
                      )}
                    </div>
                  )}

                  {/* CATEGORY: OVERALL OR FINANCE */}
                  {(activeCategory === 'overall' || activeCategory === 'finance') && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                            Player Record &amp; Contract Terms
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            Contract breakdown and club administrative data
                          </div>
                        </div>

                        <button
                          onClick={() => generateExcelReport('contracts')}
                          disabled={generating === 'contracts'}
                          style={{
                            padding: '9px 16px',
                            borderRadius: 8,
                            background: '#047857',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Download size={13}/> Export Contracts (Excel)
                        </button>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#334155' }}>
                        <div><strong>Squad Status:</strong> {currentAthlete.status || 'Active'}</div>
                        <div style={{ marginTop: 4 }}><strong>Position:</strong> {currentAthlete.position || 'Player'}</div>
                        <div style={{ marginTop: 4 }}><strong>Club:</strong> {currentAthlete.club || currentProfile?.club_name || 'ApexTrack GH'}</div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
                No athlete records found. Please ensure players are registered in Squad &amp; Athletes.
              </div>
            )}

          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            VIEW B: FULL SQUAD / CLUB SCOPE
        ────────────────────────────────────────────────────────────────── */}
        {targetScope === 'squad' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── B1: SQUAD MEDICAL & PHYSIO REPORTS ── */}
            {activeCategory === 'medical' && (
              <div>
                
                {/* KPI scorecards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total Squad', val: athletes.length, sub: 'registered athletes', color: '#0F172A', bg: '#F8FAFC', brd: '#E2E8F0' },
                    { label: 'Match Fit', val: Math.max(0, athletes.length - squadActiveInjuries.length), sub: 'cleared for selection', color: '#16A34A', bg: '#F0FDF4', brd: '#BBF7D0' },
                    { label: 'Active Injuries', val: squadActiveInjuries.length, sub: 'undergoing care', color: '#DC2626', bg: '#FEF2F2', brd: '#FECACA' },
                    { label: 'Rehab Sessions', val: rehabNotes.length, sub: 'logged clinical entries', color: '#0D9488', bg: '#F0FDFA', brd: '#CCFBF1' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.brd}`, borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                {/* 2 Primary Medical Download Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
                  
                  {/* Card 1: Executive Medical PDF */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #0D9488',
                    borderRadius: 12,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(13,148,136,0.08)',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20}/>
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Squad Medical &amp; Clinical Health Report</div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0D9488', background: '#F0FDFA', padding: '2px 8px', borderRadius: 99 }}>PDF Document</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                        Official board-level medical audit covering squad availability, active injury logs, recovered athletes, days missed, and physiotherapist clearance sign-offs for {period}.
                      </p>
                    </div>

                    <button
                      onClick={() => generateMedicalPDF('general')}
                      disabled={generating === 'medical_general'}
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        borderRadius: 8,
                        background: generating === 'medical_general' ? '#E2E8F0' : 'linear-gradient(135deg, #0F766E, #0D9488)',
                        color: generating === 'medical_general' ? '#94A3B8' : '#FFFFFF',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: generating === 'medical_general' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 2px 8px rgba(15,118,110,0.25)',
                      }}
                    >
                      {generating === 'medical_general' ? (
                        <>
                          <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                          Generating PDF…
                        </>
                      ) : (
                        <>
                          <Download size={14}/>
                          Download Squad Medical Report (PDF)
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card 2: Injury Register Excel */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 12,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileSpreadsheet size={20}/>
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Injury Register &amp; Clinical Data</div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0D9488', background: '#F0FDFA', padding: '2px 8px', borderRadius: 99 }}>Excel (.xlsx)</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
                        Complete spreadsheet workbook of all logged injuries, diagnoses, recovery timelines, and historical physiotherapy notes for {period}.
                      </p>
                    </div>

                    <button
                      onClick={() => generateExcelReport('injuries')}
                      disabled={generating === 'injuries'}
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        borderRadius: 8,
                        background: '#0D9488',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: generating === 'injuries' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {generating === 'injuries' ? (
                        <>
                          <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                          Exporting…
                        </>
                      ) : (
                        <>
                          <Download size={14}/>
                          Export Injury Register (Excel)
                        </>
                      )}
                    </button>
                  </div>

                </div>

                {/* Active Cases Quick List */}
                {squadActiveInjuries.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
                      Current Active Rehabilitation Cases ({squadActiveInjuries.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                      {squadActiveInjuries.map(inj => {
                        const ath = athletes.find(a => a.id === inj.athlete_id) || inj.athletes
                        return (
                          <div
                            key={inj.id}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: 8,
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ath?.name || 'Athlete'}
                              </div>
                              <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>
                                {inj.injury_type || 'Injury'} · Expected {fmtDate(inj.expected_return)}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedPlayer(inj.athlete_id)
                                generateMedicalPDF('player', inj.athlete_id)
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: '#0D9488',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                flexShrink: 0
                              }}
                            >
                              <Download size={11}/> Dossier PDF
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── B2: SQUAD MATCH ANALYTICS & PERFORMANCE ── */}
            {activeCategory === 'analytics' && (
              <div>
                
                {/* Primary Card: Performance Register Excel */}
                <div style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #7C3AED',
                  borderRadius: 12,
                  padding: '20px',
                  marginBottom: 20,
                  boxShadow: '0 2px 8px rgba(124,58,237,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={20}/>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Squad Match Performance Register</div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 99 }}>Excel (.xlsx)</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
                      Export complete match logs, goals, assists, pass accuracy, distance, and ratings for all players in {period}.
                    </p>
                  </div>

                  <button
                    onClick={() => generateExcelReport('performance')}
                    disabled={generating === 'performance'}
                    style={{
                      padding: '11px 20px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: generating === 'performance' ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                    }}
                  >
                    {generating === 'performance' ? (
                      <>
                        <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                        Exporting…
                      </>
                    ) : (
                      <>
                        <Download size={14}/>
                        Export Match Register (Excel)
                      </>
                    )}
                  </button>
                </div>

                {/* Squad Quick Download Table */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
                    Squad Match Appearances ({athletes.length} Players)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {athletes.map(a => {
                      const stats = performance.filter(p => p.athlete_id === a.id)
                      const goals = stats.reduce((s, p) => s + (parseInt(p.goals) || 0), 0)
                      return (
                        <div
                          key={a.id}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>
                              {a.position || 'Player'} · {stats.length} apps · {goals} goals
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedPlayer(a.id)
                              generatePerformancePDF(a.id)
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: '#7C3AED',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              flexShrink: 0
                            }}
                          >
                            <Download size={11}/> Dossier PDF
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ── B3: OVERALL CLUB OPERATIONS & WORKBOOKS ── */}
            {activeCategory === 'overall' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                  Official Club Operations Workbooks ({period})
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
                  {ADMIN_REPORT_CARDS.map(card => {
                    const isGen = generating === card.id
                    return (
                      <div
                        key={card.id}
                        style={{
                          background: 'var(--surface)',
                          border: card.featured ? `1.5px solid ${card.color}` : '1px solid var(--border)',
                          borderRadius: 12,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        }}
                      >
                        {card.featured && (
                          <div style={{ background: card.color, padding: '4px 12px', fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Star size={11} fill="currentColor"/> Complete Club Workbook
                          </div>
                        )}
                        <div style={{ padding: '16px', display: 'flex', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}15`, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {card.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                              {card.title}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.45 }}>
                              {card.desc}
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: card.color }}>{card.sheets}</span>
                          <button
                            onClick={() => generateExcelReport(card.id)}
                            disabled={isGen || loading}
                            style={{
                              padding: '6px 12px',
                              background: card.color,
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isGen ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isGen ? 'Exporting…' : <><Download size={12}/> Export Excel</>}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── B4: FINANCE & CONTRACTS ── */}
            {activeCategory === 'finance' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    ['Weekly Wage Bill',  `GHS ${weeklyWage.toFixed(2)}`, '#059669'],
                    ['Monthly Estimate',  `GHS ${(weeklyWage * 4.33).toFixed(2)}`, '#2563EB'],
                    ['Annual Projection', `GHS ${(weeklyWage * 52).toFixed(2)}`, '#7C3AED'],
                  ].map(([label, value, col]) => (
                    <div key={label} style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: col, marginTop: 4 }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Active contracts: {activeContracts.length}</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Squad Contracts &amp; Payroll Register</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Export salary breakdowns, allowances, and contract expiry dates in .xlsx</div>
                  </div>

                  <button
                    onClick={() => generateExcelReport('contracts')}
                    disabled={generating === 'contracts'}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      background: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14}/> Export Contracts Excel
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </Layout>
  )
}
