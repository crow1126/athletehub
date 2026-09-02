'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

import {
  Users, HeartPulse, Trophy, CalendarDays, ShieldCheck,
  ClipboardList, FileSpreadsheet, FileText, User,
  Stethoscope,
} from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const iconProps = { size: 24, strokeWidth: 1.8 }
const ADMIN_REPORT_CARDS = [
  { id:'athletes',    icon:<Users {...iconProps} color="#4A90E2"/>, title:'Athletes Report',         desc:'Full squad roster — positions, clubs, regions, coaches, and status',                   color:'#4A90E2', sheets:'1 sheet'  },
  { id:'injuries',    icon:<HeartPulse {...iconProps} color="#E74C3C"/>, title:'Injury Register',          desc:'Complete injury records with severity, dates, recovery notes and status',               color:'#E74C3C', sheets:'1 sheet'  },
  { id:'performance', icon:<Trophy {...iconProps} color="#9B59B6"/>, title:'Performance Report',      desc:'Match stats per athlete — goals, assists, xG, xA, pass accuracy, distance, ratings',   color:'#9B59B6', sheets:'1 sheet'  },
  { id:'sessions',    icon:<CalendarDays {...iconProps} color="#27AE60"/>, title:'Training Sessions',       desc:'All scheduled training sessions with venue, coach, type and duration',                  color:'#27AE60', sheets:'1 sheet'  },
  { id:'coaches',     icon:<ShieldCheck {...iconProps} color="#E67E22"/>, title:'Staff Report',            desc:'Technical, medical, analytics and scouting staff roster with roles',                    color:'#E67E22', sheets:'1 sheet'  },
  { id:'contracts',   icon:<ClipboardList {...iconProps} color="#1B7A3E"/>, title:'Contracts & Finance',     desc:'Player contracts, wages, bonuses and automatic wage bill summary sheet',                color:'#1B7A3E', sheets:'2 sheets' },
  { id:'summary',     icon:<FileSpreadsheet {...iconProps} color="#0D9488"/>, title:'Full Summary Report',     desc:'Everything in one workbook — all 6 modules combined with an overview cover sheet',      color:'#0D9488', sheets:'7 sheets', featured: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// 1. PLAYER-SPECIFIC CLINICAL & REHABILITATION DOSSIER (PDF)
// Full medical detail: Profile, Diagnostics, Rehab Plan, Session Logs, RTP Clearance
// ─────────────────────────────────────────────────────────────────────────────
async function buildPlayerClinicalDossierPDF({ data, selectedAthlete, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { meta, kpis, injuries, rehabNotes } = data
  const ath = selectedAthlete || (data.athletes && data.athletes[0]) || {}

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210
  const PH  = doc.internal.pageSize.getHeight()  // 297

  const NAVY    = [15,  23,  42]    // #0F172A
  const CRIMSON = [185,  28,  28]   // #B91C1C
  const TEAL    = [13, 148, 136]    // #0D9488
  const GREEN   = [22, 163,  74]    // #16A34A
  const WHITE   = [255, 255, 255]
  const LIGHT   = [248, 250, 252]   // #F8FAFC
  const BORDER  = [226, 232, 240]   // #E2E8F0
  const TEXT    = [15,  23,  42]    // #0F172A
  const TEXT2   = [100, 116, 139]   // #64748B

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return d }
  }

  let y = 0

  // ── Top Header Banner ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 30, 'F')

  // Red/Crimson badge
  doc.setFillColor(...CRIMSON)
  doc.roundedRect(10, 8, 68, 13, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('PLAYER CLINICAL DOSSIER', 44, 16, { align: 'center' })

  // Right-aligned Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('MEDICAL & REHABILITATION REPORT', PW - 12, 13, { align: 'right' })
  doc.setFontSize(11)
  doc.setTextColor(203, 213, 225)
  doc.text((ath.name || 'ATHLETE').toUpperCase(), PW - 12, 21, { align: 'right' })

  y = 40

  // ── Two-column info block ──
  const colL = 12, colR = PW / 2 + 4
  const colW = PW / 2 - 16

  // Left column: Report Scope
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLINICAL REPORT SCOPE', colL, y)
  doc.setDrawColor(...CRIMSON)
  doc.setLineWidth(0.4)
  doc.line(colL, y + 1.5, colL + colW, y + 1.5)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  doc.setTextColor(...TEXT)
  const introText = `Confidential medical evaluation and longitudinal rehabilitation dossier for ${ath.name || 'the player'}. This document details athlete baseline vitals, full injury history, rehabilitation plan, exercise protocols, pain levels, and Return-to-Play (RTP) clearance progression.`
  const introLines = doc.splitTextToSize(introText, colW)
  doc.text(introLines, colL, y)
  y += introLines.length * 4.4

  // Right column: Prepared block
  let ry = 40
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('DOCUMENT METADATA', colR, ry)
  doc.setDrawColor(...CRIMSON)
  doc.setLineWidth(0.4)
  doc.line(colR, ry + 1.5, colR + colW, ry + 1.5)
  ry += 6

  const infoRows = [
    ['CLUB / SQUAD',        meta.clubName || 'Club'],
    ['ATHLETE NAME',        ath.name || '—'],
    ['SQUAD NUMBER',        ath.back_number ? `#${ath.back_number}` : '—'],
    ['REPORTING PERIOD',    period],
    ['ATTENDING PHYSIO',    meta.generatedBy || 'Team Physiotherapist'],
    ['DATE ISSUED',         fmtDate(meta.generatedAt)],
  ]

  doc.setFontSize(8)
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEXT2)
    doc.text(label + ':', colR, ry)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT)
    doc.text(String(value), colR + 42, ry)
    ry += 4.8
  }

  y = Math.max(y, ry) + 5
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12, y, PW - 12, y)
  y += 6

  // ── 1. Athlete Baseline & Profile ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('1. ATHLETE CLINICAL BASELINE', 12, y)
  y += 3.5

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Field', 'Value', 'Field', 'Value']],
    body: [
      ['Full Name',       ath.name || '—',                    'Squad Number',   ath.back_number ? `#${ath.back_number}` : '—'],
      ['Position',        ath.position || '—',                 'Nationality',    ath.nationality || 'Ghana'],
      ['Date of Birth',   fmtDate(ath.date_of_birth),          'Age',            ath.age ? `${ath.age} yrs` : '—'],
      ['Height',          ath.height ? `${ath.height} cm` : '—', 'Weight',        ath.weight ? `${ath.weight} kg` : '—'],
      ['Current Status',  ath.status || 'Active',              'Match Fitness',  ath.status === 'Injured' ? '⚠ Unfit (In Rehab)' : '✔ Match Fit'],
      ['Contact Phone',   ath.phone || '—',                    'Email Address',  ath.email || '—'],
    ],
    styles: { fontSize: 7.5, cellPadding: 2.6, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 36 },
      1: { cellWidth: 59 },
      2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 36 },
      3: { cellWidth: 59 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 7

  // ── 2. Clinical Metrics Summary ──
  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Clinical Metric', 'Value', 'Clinical Metric', 'Value']],
    body: [
      ['Total Injury Incidents',   injuries.length,                    'Total Rehab Sessions Logged', rehabNotes.length],
      ['Active Injuries',          injuries.filter(i => i.status === 'Active').length, 'Recovered & Cleared',         injuries.filter(i => i.status === 'Recovered').length],
      ['Avg Rehab Pain Index',     `${kpis.avgPainLevel} / 10`,        'Latest Clearance Status',     rehabNotes[0]?.clearance_status || (ath.status === 'Injured' ? 'In Rehab' : 'Full Clearance')],
    ],
    styles: { fontSize: 7.5, cellPadding: 2.6, font: 'helvetica' },
    headStyles: { fillColor: CRIMSON, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 48 },
      1: { fontStyle: 'bold', textColor: CRIMSON, cellWidth: 47 },
      2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: 48 },
      3: { fontStyle: 'bold', textColor: TEAL,    cellWidth: 47 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 8

  // ── 3. Injury Incidents & Diagnostics ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`2. INJURY INCIDENTS & DIAGNOSTIC REGISTER (${injuries.length} record${injuries.length === 1 ? '' : 's'})`, 12, y)
  y += 3.5

  if (injuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text('No injury incidents recorded for this athlete.', 12, y + 4)
    y += 12
  } else {
    const injuryRows = injuries.map((inj, idx) => {
      let daysOut = '—'
      if (inj.date_of_injury) {
        const start = new Date(inj.date_of_injury)
        const end   = inj.expected_return ? new Date(inj.expected_return) : new Date()
        const diff  = Math.ceil((end - start) / 86400000)
        daysOut = diff >= 0 ? `${diff} days` : '—'
      }
      return [
        idx + 1,
        inj.injury_type || '—',
        inj.severity || '—',
        fmtDate(inj.date_of_injury),
        fmtDate(inj.expected_return),
        daysOut,
        inj.status || '—',
        inj.notes || '—',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Diagnosis / Injury Type', 'Severity', 'Date Injured', 'Expected Return', 'Days Lost', 'Status', 'Clinical Notes & Mechanism']],
      body: injuryRows,
      styles: { fontSize: 6.8, cellPadding: 2.4, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 34, fontStyle: 'bold' },
        2: { cellWidth: 16 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18 },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          if (data.cell.raw === 'Severe')   { data.cell.styles.textColor = [192, 57, 43]; data.cell.styles.fontStyle = 'bold' }
          if (data.cell.raw === 'Moderate') { data.cell.styles.textColor = [179, 98, 0] }
        }
        if (data.column.index === 6 && data.section === 'body') {
          if (data.cell.raw === 'Active')    { data.cell.styles.textColor = [192, 57, 43]; data.cell.styles.fontStyle = 'bold' }
          if (data.cell.raw === 'Recovered') { data.cell.styles.textColor = [27, 122, 62]; data.cell.styles.fontStyle = 'bold' }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── 4. Detailed Rehabilitation Plan & Session Logs ──
  if (y > PH - 65) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`3. REHABILITATION PLAN & CLINICAL SESSION LOGS (${rehabNotes.length} session${rehabNotes.length === 1 ? '' : 's'})`, 12, y)
  y += 3.5

  if (rehabNotes.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text('No rehabilitation sessions recorded for this athlete.', 12, y + 4)
    y += 12
  } else {
    const rehabRows = rehabNotes.map((r, idx) => [
      idx + 1,
      fmtDate(r.session_date),
      r.rehab_phase || '—',
      `${r.pain_level ?? 0} / 10`,
      r.clearance_status || 'In Rehab',
      r.treatment_summary || '—',
      r.clinical_notes || '—',
      r.target_milestone || '—',
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Date', 'Rehab Phase', 'Pain', 'Clearance Status', 'Treatment Summary / Modalities', 'Clinical Notes & Exercises', 'Milestone Target']],
      body: rehabRows,
      styles: { fontSize: 6.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 26, fontStyle: 'bold' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 26 },
        5: { cellWidth: 32 },
        6: { cellWidth: 'auto' },
        7: { cellWidth: 28 },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const pain = parseInt(String(data.cell.raw || '0'))
          if (pain >= 7) { data.cell.styles.textColor = [192, 57, 43]; data.cell.styles.fontStyle = 'bold' }
          else if (pain >= 4) { data.cell.styles.textColor = [179, 98, 0] }
          else { data.cell.styles.textColor = [27, 122, 62] }
        }
        if (data.column.index === 4 && data.section === 'body') {
          const cs = String(data.cell.raw || '')
          if (cs === 'Full Match Clearance') { data.cell.styles.textColor = [27, 122, 62]; data.cell.styles.fontStyle = 'bold' }
          else if (cs === 'In Rehab')        { data.cell.styles.textColor = [192, 57, 43] }
          else if (cs === 'Restricted Training') { data.cell.styles.textColor = [179, 98, 0] }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── 5. Return-to-Play Evaluation & Sign-off Box ──
  if (y > PH - 58) { doc.addPage(); y = 18 }

  doc.setDrawColor(...CRIMSON)
  doc.setLineWidth(0.5)
  doc.roundedRect(12, y, PW - 24, 30, 2, 2, 'D')

  doc.setFillColor(...CRIMSON)
  doc.roundedRect(12, y, 4, 30, 2, 2, 'F')
  doc.rect(14, y, 2, 30, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('4. CLINICAL CLEARANCE & LEGAL DECLARATION', 21, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.3)
  doc.setTextColor(...TEXT)
  const declText = 'This clinical dossier contains confidential medical information. All rehabilitation protocols and progress assessments are documented in accordance with sports physiotherapy standards. The athlete\'s return-to-play clearance is contingent upon meeting objective functional benchmarks and clinical symptom stability.'
  const declLines = doc.splitTextToSize(declText, PW - 42)
  doc.text(declLines, 21, y + 12.5)

  // Signature line
  y += 35
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12,  y + 6, 80,  y + 6)
  doc.line(110, y + 6, 180, y + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT2)
  doc.text('ATTENDING PHYSIOTHERAPIST SIGNATURE', 12,  y + 10.5)
  doc.text('DATE & CLINICAL STAMP',                110, y + 10.5)

  // Running footer
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 13, PW, 13, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(
      `${(meta.clubName || 'CLUB').toUpperCase()} — CLINICAL DOSSIER: ${(ath.name || 'ATHLETE').toUpperCase()}   |   ${period}   |   Page ${pg} of ${totalPages}`,
      PW / 2, ph - 5, { align: 'center' }
    )
  }

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN GENERAL SQUAD MEDICAL & RECOVERY REPORT (PDF)
// High-level squad health overview, active injuries & RECOVERED ATHLETES
// ─────────────────────────────────────────────────────────────────────────────
async function buildAdminGeneralMedicalPDF({ data, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { meta, kpis, activeInjuries = [], recoveredInjuries = [], rehabNotes = [] } = data

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210
  const PH  = doc.internal.pageSize.getHeight()  // 297

  const NAVY    = [15,  23,  42]    // #0F172A
  const TEAL    = [13, 148, 136]    // #0D9488
  const GREEN   = [22, 163,  74]    // #16A34A
  const WHITE   = [255, 255, 255]
  const LIGHT   = [248, 250, 252]   // #F8FAFC
  const BORDER  = [226, 232, 240]   // #E2E8F0
  const TEXT    = [15,  23,  42]    // #0F172A
  const TEXT2   = [100, 116, 139]   // #64748B

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return d }
  }

  let y = 0

  // ── Top Header Banner ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 30, 'F')

  // Teal badge
  doc.setFillColor(...TEAL)
  doc.roundedRect(10, 8, 64, 13, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE HEALTH OVERVIEW', 42, 16, { align: 'center' })

  // Right Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SQUAD MEDICAL & INJURY REPORT', PW - 12, 13, { align: 'right' })
  doc.setFontSize(10.5)
  doc.setTextColor(203, 213, 225)
  doc.text((meta.clubName || 'CLUB').toUpperCase(), PW - 12, 21, { align: 'right' })

  y = 39

  // ── Two-column info block ──
  const colL = 12, colR = PW / 2 + 4
  const colW = PW / 2 - 16

  // Left column
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE SQUAD SUMMARY', colL, y)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.4)
  doc.line(colL, y + 1.5, colL + colW, y + 1.5)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  doc.setTextColor(...TEXT)
  const execText = `High-level medical and squad health report for ${meta.clubName || 'the club'}. This report details squad fitness availability, current active injuries undergoing rehabilitation, and recovered athletes cleared for match selection during ${period}.`
  const execLines = doc.splitTextToSize(execText, colW)
  doc.text(execLines, colL, y)
  y += execLines.length * 4.4

  // Right column
  let ry = 39
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('REPORT DETAILS', colR, ry)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.4)
  doc.line(colR, ry + 1.5, colR + colW, ry + 1.5)
  ry += 6

  const infoRows = [
    ['ORGANISATION',       meta.clubName || 'Club'],
    ['LOCATION',           meta.clubCity || 'Ghana'],
    ['REPORTING PERIOD',   period],
    ['PREPARED BY',        meta.generatedBy || 'Administration'],
    ['DESIGNATION',        (meta.generatedByRole || 'Admin').toUpperCase()],
    ['GENERATED ON',       fmtDate(meta.generatedAt)],
  ]

  doc.setFontSize(8)
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEXT2)
    doc.text(label + ':', colR, ry)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT)
    doc.text(String(value), colR + 42, ry)
    ry += 4.8
  }

  y = Math.max(y, ry) + 5
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12, y, PW - 12, y)
  y += 6

  // ── Executive KPIs ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('SQUAD AVAILABILITY & HEALTH SCORECARD', 12, y)
  y += 3.5

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
    styles: { fontSize: 7.8, cellPadding: 2.8, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
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

  y = doc.lastAutoTable.finalY + 8

  // ── Section 1: Active Injuries ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`1. CURRENTLY ACTIVE INJURIES (IN REHABILITATION) — ${activeInjuries.length} player${activeInjuries.length === 1 ? '' : 's'}`, 12, y)
  y += 3.5

  if (activeInjuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GREEN)
    doc.text('✔ Excellent: No active injury cases currently recorded. Squad is at 100% availability.', 12, y + 4)
    y += 12
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
      headStyles: { fillColor: [185, 28, 28], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
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
        8: { cellWidth: 14, fontStyle: 'bold', textColor: [185, 28, 28] },
        9: { cellWidth: 'auto' },
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Section 2: Recovered Athletes ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`2. RECOVERED ATHLETES REGISTER (CLEARED TO PLAY) — ${recoveredInjuries.length} athlete${recoveredInjuries.length === 1 ? '' : 's'}`, 12, y)
  y += 3.5

  if (recoveredInjuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT2)
    doc.text('No recovery transitions recorded for this specific period.', 12, y + 4)
    y += 12
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
        'Cleared / Match Fit',
        inj.notes ? inj.notes.slice(0, 50) + (inj.notes.length > 50 ? '…' : '') : 'Full recovery achieved',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Athlete', 'Pos', 'Injury Sustained', 'Severity', 'Date Injured', 'Date Cleared', 'Total Missed', 'Outcome Status', 'Recovery Notes']],
      body: recRows,
      styles: { fontSize: 6.8, cellPadding: 2.3, overflow: 'linebreak' },
      headStyles: { fillColor: [22, 163, 74], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
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
    y = doc.lastAutoTable.finalY + 8
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

  // Footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 13, PW, 13, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(
      `${(meta.clubName || 'CLUB').toUpperCase()} — SQUAD HEALTH & INJURY REPORT   |   ${period}   |   Page ${pg} of ${totalPages}`,
      PW / 2, ph - 5, { align: 'center' }
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
  const [performance,    setPerformance]    = useState([])
  const [sessions,       setSessions]       = useState([])
  const [coaches,        setCoaches]        = useState([])
  const [contracts,      setContracts]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [generating,     setGenerating]     = useState(null)
  const [statusMsg,      setStatusMsg]      = useState({ text:'', type:'' })
  const [currentProfile, setCurrentProfile] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [searchTerm,     setSearchTerm]     = useState('')

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
          scopeTeam(supabase.from('athletes').select('*, coaches(name)'), teamId).order('name', { ascending: true }),
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
  const userRole    = currentProfile?.role || 'staff'
  const isPhysio    = userRole === 'physio' ||
                      currentProfile?.staff_type === 'physio' ||
                      currentProfile?.staff_type === 'medical' ||
                      currentProfile?.staff_type === 'sports_scientist'
  const isAdmin     = userRole === 'admin' || userRole === 'superadmin'

  // If user is pure physio (not admin), they ONLY have the player-specific clinical report
  const isPurePhysio = isPhysio && !isAdmin

  // ── Excel report generator for Admins ────────────────────────────────────
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
      const cardTitle = ADMIN_REPORT_CARDS.find(r => r.id === reportId)?.title || 'Report'
      setStatusMsg({ text: `"${cardTitle}" downloaded successfully!`, type: 'success' })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      setStatusMsg({ text: '' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  // ── Medical PDF generator ────────────────────────────────────────────────
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

      let doc
      let filename

      if (reportScope === 'player') {
        const selectedAth = athletes.find(a => a.id === selectedPlayer) || data.athletes[0]
        doc = await buildPlayerClinicalDossierPDF({ data, selectedAthlete: selectedAth, period })
        const safeAthlete = (selectedAth?.name || 'Player').replace(/\s+/g, '_')
        const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
        filename = `${safeAthlete}_Clinical_Rehabilitation_Report_${safePeriod}.pdf`
      } else {
        doc = await buildAdminGeneralMedicalPDF({ data, period })
        const safeName = (data.meta?.clubName || 'Club').replace(/[^a-zA-Z0-9_-]/g, '_')
        const safePeriod = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
        filename = `${safeName}_Squad_Medical_Report_${safePeriod}.pdf`
      }

      doc.save(filename)

      setStatusMsg({
        text: `Report successfully downloaded as "${filename}"`,
        type: 'success',
      })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 6000)
    } catch (err) {
      setStatusMsg({ text: 'PDF generation failed: ' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  const activeContracts = contracts.filter(c => c.status === 'Active')
  const weeklyWage      = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)
  const period          = reportType === 'monthly' ? `${MONTHS[selMonth]} ${selYear}` : `Full Year ${selYear}`

  const sel = { padding:'9px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', fontSize:14, color:'var(--text)', background:'var(--surface2)', outline:'none', fontFamily:'var(--font)', cursor:'pointer' }

  // Filter athletes for the selector
  const filteredAthletes = athletes.filter(a => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (a.name || '').toLowerCase().includes(q) || (a.position || '').toLowerCase().includes(q)
  })

  const selectedAthleteObj = athletes.find(a => a.id === selectedPlayer)
  const selectedPlayerInjuries = selectedPlayer ? injuries.filter(i => i.athlete_id === selectedPlayer) : []
  const selectedPlayerActiveInj = selectedPlayerInjuries.filter(i => i.status === 'Active')

  return (
    <Layout>
      <div className="page-outer-wide">
        
        {/* Header tailored per role */}
        <PageHeader
          label={isPurePhysio ? 'Medical & Physiotherapy Department' : 'Analytics & Exports'}
          title={isPurePhysio ? 'Player Clinical & Rehab Reports' : 'Reports'}
          subtitle={isPurePhysio
            ? 'Generate comprehensive medical dossiers for specific athletes detailing full injury history, rehab plans, and clearance status.'
            : 'Generate executive squad reports, general medical overviews, and exportable financial data.'}
        />

        {/* ── Status Message Banner ── */}
        {statusMsg.text && (
          <div style={{ background: statusMsg.type==='error' ? 'var(--danger-light)' : '#E8F8EE', border:`1px solid ${statusMsg.type==='error' ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)'}`, borderRadius:'var(--r-md)', padding:'14px 18px', marginBottom:20, fontSize:13, color: statusMsg.type==='error' ? 'var(--danger)' : '#1B7A3E', fontWeight:600 }}>
            {statusMsg.text}
          </div>
        )}

        {/* ── Period Selector (Shared) ── */}
        <div className="card fade-up fade-up-1" style={{ padding:'20px 24px', marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:0 }}>Reporting Window</h2>
              <p style={{ fontSize:12, color:'var(--text3)', margin:'2px 0 0' }}>Data filter applied across all generated reports.</p>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:3 }}>
                {['monthly','yearly'].map(t => (
                  <button key={t} onClick={() => setReportType(t)} style={{ padding:'6px 18px', background: reportType===t ? '#0D9488' : 'transparent', border:'none', borderRadius:'var(--r-md)', fontSize:12, fontWeight:700, color: reportType===t ? '#fff' : 'var(--text2)', cursor:'pointer', transition:'var(--transition)', textTransform:'capitalize', fontFamily:'var(--font)' }}>
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
              <div style={{ fontSize:13, color:'var(--text2)', background:'var(--surface2)', padding:'7px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
                Active: <strong style={{ color:'#0D9488' }}>{period}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PHYSIO DASHBOARD REPORT VIEW (PURE PHYSIO)
            Only Player-Specific Medical & Rehab Dossier
        ══════════════════════════════════════════════════════════════════ */}
        {isPurePhysio && (
          <div className="fade-up">
            <div className="card" style={{ padding:0, overflow:'hidden', border:'2px solid #FCA5A5', background:'#FFFFFF', borderRadius:16, boxShadow:'var(--shadow-md)' }}>
              
              <div style={{ background:'linear-gradient(135deg,#991B1B,#DC2626)', padding:'14px 22px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Stethoscope size={22}/>
                  <div>
                    <div style={{ fontSize:16, fontWeight:900, letterSpacing:'-0.01em' }}>Player Clinical &amp; Rehabilitation Dossier</div>
                    <div style={{ fontSize:11, color:'#FEE2E2', fontWeight:600 }}>Detailed clinical log with prescribed rehabilitation exercises, pain index, and RTP clearance</div>
                  </div>
                </div>
                <span style={{ fontSize:11, background:'rgba(255,255,255,0.2)', padding:'4px 10px', borderRadius:99, fontWeight:700 }}>
                  Confidential Physio Access
                </span>
              </div>

              <div style={{ padding:'24px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.2fr) minmax(0, 1.8fr)', gap:24 }} className="dash-grid">
                  
                  {/* Left: Athlete Picker */}
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                      1. Select Athlete *
                    </label>

                    {/* Search box */}
                    <input
                      type="text"
                      placeholder="Search player name or position…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:13, marginBottom:10, outline:'none', background:'var(--surface2)', color:'var(--text)', boxSizing:'border-box' }}
                    />

                    {/* Player select list */}
                    <select
                      id="physio-player-select"
                      size={8}
                      value={selectedPlayer}
                      onChange={e => setSelectedPlayer(e.target.value)}
                      style={{ width:'100%', padding:'8px', borderRadius:'var(--r-md)', border:'1.5px solid #CBD5E1', fontSize:13, fontWeight:600, color:'var(--text)', background:'#F8FAFC', outline:'none', fontFamily:'var(--font)', cursor:'pointer', minHeight:220 }}>
                      {filteredAthletes.map(a => {
                        const isInjured = a.status === 'Injured'
                        return (
                          <option key={a.id} value={a.id} style={{ padding:'8px 10px', borderRadius:6, margin:'2px 0' }}>
                            {a.name} ({a.position || 'Player'}) {a.back_number ? `#${a.back_number}` : ''} {isInjured ? ' ⚠ Injured' : ' ✔ Fit'}
                          </option>
                        )
                      })}
                    </select>

                    <div style={{ fontSize:11, color:'#64748B', marginTop:6 }}>
                      Showing {filteredAthletes.length} of {athletes.length} squad athletes
                    </div>
                  </div>

                  {/* Right: Selected Player Preview & Action */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:'20px', border:'1px solid #E2E8F0', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                        2. Player Clinical Preview
                      </div>

                      {selectedAthleteObj ? (
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                            <div style={{ width:54, height:54, borderRadius:'50%', background:'#DC2626', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, flexShrink:0 }}>
                              {selectedAthleteObj.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                            </div>
                            <div>
                              <div style={{ fontSize:18, fontWeight:900, color:'#0F172A' }}>{selectedAthleteObj.name}</div>
                              <div style={{ fontSize:13, color:'#64748B', fontWeight:600 }}>
                                {selectedAthleteObj.position || 'Athlete'} · {selectedAthleteObj.back_number ? `Jersey #${selectedAthleteObj.back_number}` : 'No Squad #'} · {selectedAthleteObj.age ? `${selectedAthleteObj.age} yrs` : ''}
                              </div>
                            </div>
                          </div>

                          {/* Mini badges */}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:16 }}>
                            <div style={{ background:'#FFFFFF', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Match Fitness</div>
                              <div style={{ fontSize:13, fontWeight:900, color: selectedAthleteObj.status === 'Injured' ? '#DC2626' : '#16A34A', marginTop:3 }}>
                                {selectedAthleteObj.status === 'Injured' ? '⚠ Injured' : '✔ Match Fit'}
                              </div>
                            </div>
                            <div style={{ background:'#FFFFFF', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Recorded Injuries</div>
                              <div style={{ fontSize:15, fontWeight:900, color:'#0F172A', marginTop:2 }}>
                                {selectedPlayerInjuries.length}
                              </div>
                            </div>
                            <div style={{ background:'#FFFFFF', padding:'10px 12px', borderRadius:8, border:'1px solid #E2E8F0', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Active Episodes</div>
                              <div style={{ fontSize:15, fontWeight:900, color: selectedPlayerActiveInj.length ? '#DC2626' : '#16A34A', marginTop:2 }}>
                                {selectedPlayerActiveInj.length}
                              </div>
                            </div>
                          </div>

                          <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#991B1B', lineHeight:1.5, marginBottom:16 }}>
                            <strong>Report Contents:</strong> Complete diagnostic history, longitudinal rehabilitation session notes, exercise drill protocols, pain levels (0–10), and Return-to-Play criteria.
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign:'center', padding:'36px 16px', color:'#94A3B8' }}>
                          <User size={36} style={{ margin:'0 auto 10px', color:'#CBD5E1' }}/>
                          <p style={{ fontSize:14, fontWeight:600 }}>Please select an athlete from the list on the left.</p>
                        </div>
                      )}
                    </div>

                    {/* Download Button */}
                    <button
                      id="btn-physio-player-pdf"
                      onClick={() => generateMedicalPDF('player')}
                      disabled={generating === 'medical_player' || !selectedPlayer}
                      style={{ width:'100%', padding:'13px 20px', background: generating === 'medical_player' ? 'var(--surface3)' : selectedPlayer ? 'linear-gradient(135deg,#991B1B,#DC2626)' : '#CBD5E1', color: selectedPlayer ? '#fff' : '#64748B', border:'none', borderRadius:10, fontSize:14, fontWeight:800, cursor: selectedPlayer ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'var(--transition)', boxShadow: selectedPlayer ? '0 4px 14px rgba(220,38,38,0.35)' : 'none' }}>
                      {generating === 'medical_player' ? (
                        <>
                          <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                          Generating Clinical Dossier…
                        </>
                      ) : (
                        <>⬇ Download Player Clinical &amp; Rehab Dossier (PDF)</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ADMIN DASHBOARD VIEW (ADMIN / SUPERADMIN)
            General Squad Medical Overview (with RECOVERED athletes) + Club Excel Reports
        ══════════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <div>

            {/* ── Section A: General Medical Report for Admins ── */}
            <div className="fade-up" style={{ marginBottom:30 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#0F766E,#0D9488)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0 }}>
                  <HeartPulse size={18} strokeWidth={2.4}/>
                </div>
                <div>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', margin:0 }}>
                    Squad Medical &amp; Health Overview
                  </h2>
                  <p style={{ fontSize:12, color:'var(--text3)', margin:0 }}>
                    Executive high-level squad report detailing current active injuries and <strong>all recovered athletes</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:16 }} className="card-grid-auto">
                
                {/* General Squad PDF Card */}
                <div className="card" style={{ padding:0, overflow:'hidden', border:'2px solid #99F6E4', transition:'var(--transition)', background:'#FFFFFF' }}>
                  <div style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)', padding:'8px 16px', fontSize:11, fontWeight:800, color:'#fff', letterSpacing:'0.06em', textTransform:'uppercase', textAlign:'center' }}>
                    🏥 Executive Squad Health Report
                  </div>
                  <div style={{ padding:'20px 22px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                      <div style={{ width:50, height:50, borderRadius:14, background:'#CCFBF1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #99F6E4' }}>
                        <FileText size={24} color="#0F766E"/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 }}>General Squad Medical Report</div>
                        <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.55 }}>
                          High-level squad overview: active injury register, <strong>recovered athletes cleared to play</strong>, time lost, and availability metrics for {period}.
                        </div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:'#0F766E', background:'#CCFBF1', padding:'3px 10px', borderRadius:99, fontWeight:700 }}>{period}</span>
                      <span style={{ fontSize:11, color:'#16A34A', background:'#DCFCE7', padding:'3px 10px', borderRadius:99, fontWeight:700 }}>Includes Recovered Athletes</span>
                      <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'3px 10px', borderRadius:99, border:'1px solid var(--border)' }}>PDF Document</span>
                    </div>

                    <button
                      id="btn-admin-general-medical-pdf"
                      onClick={() => generateMedicalPDF('general')}
                      disabled={generating === 'medical_general'}
                      style={{ width:'100%', padding:'11px 18px', background: generating === 'medical_general' ? 'var(--surface3)' : 'linear-gradient(135deg,#0F766E,#0D9488)', color: generating === 'medical_general' ? 'var(--text3)' : '#fff', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, cursor: generating === 'medical_general' ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'var(--transition)', fontFamily:'var(--font)', boxShadow: generating === 'medical_general' ? 'none' : '0 3px 12px rgba(13,148,136,0.35)' }}>
                      {generating === 'medical_general' ? (
                        <>
                          <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
                          Generating PDF…
                        </>
                      ) : <>⬇ Download General Squad Medical Report (PDF)</>}
                    </button>
                  </div>
                </div>

                {/* Optional Player Selector for Admin */}
                <div className="card" style={{ padding:0, overflow:'hidden', border:'1px solid #E2E8F0', transition:'var(--transition)', background:'#FFFFFF' }}>
                  <div style={{ background:'#64748B', padding:'8px 16px', fontSize:11, fontWeight:800, color:'#fff', letterSpacing:'0.06em', textTransform:'uppercase', textAlign:'center' }}>
                    👤 Single Player Clinical Dossier
                  </div>
                  <div style={{ padding:'20px 22px' }}>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Individual Athlete Dossier</div>
                      <div style={{ fontSize:12, color:'var(--text3)' }}>
                        Select a specific player to inspect their granular clinical notes and rehab history.
                      </div>
                    </div>

                    <select
                      id="admin-player-select"
                      value={selectedPlayer}
                      onChange={e => setSelectedPlayer(e.target.value)}
                      style={{ width:'100%', padding:'8px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', fontSize:13, fontWeight:600, color:'var(--text)', background:'var(--surface2)', outline:'none', marginBottom:12, cursor:'pointer' }}>
                      <option value="">— Select an athlete (optional) —</option>
                      {athletes.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.position || 'Player'}){a.status === 'Injured' ? ' ⚠ Injured' : ''}</option>
                      ))}
                    </select>

                    <button
                      id="btn-admin-player-pdf"
                      onClick={() => generateMedicalPDF('player')}
                      disabled={generating === 'medical_player' || !selectedPlayer}
                      style={{ width:'100%', padding:'10px 16px', background: !selectedPlayer ? '#E2E8F0' : '#475569', color: !selectedPlayer ? '#94A3B8' : '#fff', border:'none', borderRadius:'var(--r-md)', fontSize:12, fontWeight:700, cursor: selectedPlayer ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      {generating === 'medical_player' ? 'Generating…' : '⬇ Download Single Player Dossier (PDF)'}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Section B: Standard Club Management Excel Reports ── */}
            <h2 className="fade-up" style={{ fontSize:17, fontWeight:800, marginBottom:16 }}>
              Club Operations &amp; Management Reports <span style={{ fontSize:13, fontWeight:500, color:'var(--text3)', marginLeft:8 }}>{ADMIN_REPORT_CARDS.length} Excel exports</span>
            </h2>

            {loading ? (
              <div style={{ padding:'60px', textAlign:'center' }}>
                <div style={{ width:36, height:36, border:'4px solid #F0FDFA', borderTopColor:'#0D9488', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }} />
                <p style={{ color:'var(--text3)', fontSize:13 }}>Loading data…</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }} className="card-grid-auto">
                {ADMIN_REPORT_CARDS.map((card, idx) => {
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
                          onClick={() => generateExcelReport(card.id)}
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

            {/* Financial Snapshot */}
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
        )}

      </div>
    </Layout>
  )
}
