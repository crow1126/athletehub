'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

import {
  Users, HeartPulse, Trophy, CalendarDays, ShieldCheck,
  ClipboardList, FileSpreadsheet, FileText, User,
  Stethoscope, Search, Download, CheckCircle2, AlertCircle, Activity
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

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE HELPER FOR PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────────
async function getBase64ImageFromUrl(imageUrl) {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('Could not load image for PDF:', imageUrl, e)
    return null
  }
}

async function getApexTrackLogoBase64() {
  let base64 = await getBase64ImageFromUrl('/logo.png')
  if (!base64) {
    base64 = await getBase64ImageFromUrl('/icons/icon-192.png')
  }
  return base64
}

const LOCAL_STORAGE_REHAB_KEY = 'apextrack_rehab_notes_fallback'

// ─────────────────────────────────────────────────────────────────────────────
// 1. PLAYER-SPECIFIC CLINICAL & REHABILITATION DOSSIER (PDF)
// Full medical detail: Profile + Photo, Team Logo, ApexTrack GH Logo, Rehabilitation Plan, Diagnostics, Logs
// ─────────────────────────────────────────────────────────────────────────────
async function buildPlayerClinicalDossierPDF({ data, selectedAthlete, period }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { meta, kpis, injuries = [], rehabNotes = [] } = data
  const ath = selectedAthlete || (data.athletes && data.athletes[0]) || {}

  // 1. Preload Logos & Player Photo
  const [siteLogoBase64, teamLogoBase64, playerPhotoBase64] = await Promise.all([
    getApexTrackLogoBase64(),
    meta.clubLogoUrl ? getBase64ImageFromUrl(meta.clubLogoUrl) : null,
    ath.photo_url ? getBase64ImageFromUrl(ath.photo_url) : null,
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

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return d }
  }

  let y = 0

  // ── Top Header Banner (33mm) ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 33, 'F')

  // Dual Accent line at bottom of header
  doc.setFillColor(...TEAL)
  doc.rect(0, 32, PW * 0.65, 1.0, 'F')
  doc.setFillColor(45, 212, 191) // Teal-300 bright
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

  // Classy Teal Capsule Badge: "PLAYER CLINICAL DOSSIER" (No Red UI)
  const badgeW = 46
  const badgeH = 5.6
  doc.setFillColor(15, 118, 110) // Rich Teal-700
  doc.roundedRect(leftContentX, 5.2, badgeW, badgeH, 1.4, 1.4, 'F')
  doc.setDrawColor(45, 212, 191) // Teal-300
  doc.setLineWidth(0.25)
  doc.roundedRect(leftContentX, 5.2, badgeW, badgeH, 1.4, 1.4, 'D')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('PLAYER CLINICAL DOSSIER', leftContentX + (badgeW / 2), 9.0, { align: 'center' })

  // Club Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...WHITE)
  doc.text((meta.clubName || 'CLUB').toUpperCase(), leftContentX, 17.5)

  // Department Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(45, 212, 191) // Teal-300
  doc.text('SPORTS MEDICINE & PHYSIOTHERAPY UNIT', leftContentX, 23.5)

  // ── Right Side: Small Visible ApexTrack GH Logo + Report Title & Athlete Name ──
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
      doc.setTextColor(45, 212, 191) // Teal-300
      doc.text('ApexTrack GH', logoBoxX + (logoBoxW / 2), logoBoxY + logoBoxH + 4.2, { align: 'center' })
    } catch (_e) { /* fallback */ }
  }

  const rightTextX = siteLogoBase64 ? logoBoxX - 4 : PW - 12

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('MEDICAL & REHABILITATION REPORT', rightTextX, 10.0, { align: 'right' })

  // Athlete Name (Distinguished high-contrast typography)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(45, 212, 191) // Teal-300
  doc.text((ath.name || 'ATHLETE').toUpperCase(), rightTextX, 17.0, { align: 'right' })

  // Subtitle / Confidential stamp
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(203, 213, 225) // Slate-300
  doc.text(`CONFIDENTIAL MEDICAL RECORD  •  ${period}`, rightTextX, 23.5, { align: 'right' })

  y = 40

  // ── 1. Athlete Clinical Baseline (With Player Photo) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('1. ATHLETE CLINICAL PROFILE & BASELINE', 12, y)
  y += 4

  const photoWidth  = 26
  const photoHeight = 32
  const photoX      = 12
  const photoY      = y

  // Draw Photo Container Box
  doc.setFillColor(...LIGHT)
  doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 2, 2, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 2, 2, 'D')

  if (playerPhotoBase64) {
    try {
      doc.addImage(playerPhotoBase64, 'JPEG', photoX + 1, photoY + 1, photoWidth - 2, photoHeight - 2)
    } catch (_e) {
      // Fallback text if corrupted
      doc.setTextColor(...TEXT2)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('ATHLETE', photoX + photoWidth/2, photoY + 14, { align: 'center' })
      doc.text('PHOTO', photoX + photoWidth/2, photoY + 19, { align: 'center' })
    }
  } else {
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(photoX + 2, photoY + 2, photoWidth - 4, photoHeight - 4, 1.5, 1.5, 'F')
    doc.setTextColor(...TEXT2)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text((ath.name || 'ATHLETE').split(' ').map(w=>w[0]).join('').slice(0, 3) || 'ATH', photoX + photoWidth/2, photoY + 14, { align: 'center' })
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text('No Photo', photoX + photoWidth/2, photoY + 20, { align: 'center' })
  }

  // Baseline table alongside the player photo
  const tableX = photoX + photoWidth + 4
  const tableW = PW - tableX - 12

  autoTable(doc, {
    startY: photoY,
    margin: { left: tableX, right: 12 },
    tableWidth: tableW,
    head: [['Field', 'Clinical Record', 'Field', 'Clinical Record']],
    body: [
      ['Full Name',       ath.name || '—',                      'Squad Number',   ath.back_number ? `#${ath.back_number}` : '—'],
      ['Position',        ath.position || '—',                   'Nationality',    ath.nationality || 'Ghana'],
      ['Date of Birth',   fmtDate(ath.date_of_birth),            'Age',            ath.age ? `${ath.age} yrs` : '—'],
      ['Height / Weight', `${ath.height ? ath.height + ' cm' : '—'} / ${ath.weight ? ath.weight + ' kg' : '—'}`, 'Preferred Foot', ath.preferred_foot || 'Right'],
      ['Current Status',  ath.status || 'Active',                'Match Fitness',  ath.status === 'Injured' ? 'In Rehabilitation' : 'Cleared / Match Fit'],
      ['Attending Physio', meta.generatedBy || 'Physiotherapist', 'Report Issued',  fmtDate(meta.generatedAt)],
    ],
    styles: { fontSize: 7.2, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.2 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: TEXT2, cellWidth: tableW * 0.22 },
      1: { cellWidth: tableW * 0.28 },
      2: { fontStyle: 'bold', textColor: TEXT2, cellWidth: tableW * 0.22 },
      3: { cellWidth: tableW * 0.28 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = Math.max(photoY + photoHeight, doc.lastAutoTable.finalY) + 6

  // ── 2. Active Rehabilitation Plan & Clinical Protocols ──
  if (y > PH - 70) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`2. REHABILITATION PLAN & CLINICAL PROTOCOLS (${rehabNotes.length} session record${rehabNotes.length === 1 ? '' : 's'})`, 12, y)
  y += 4

  // Highlight Box: Latest Prescribed Rehabilitation Plan (Structured Table - No text overlap)
  const latestRehab = rehabNotes[0]
  const activeInjuryWithNotes = !latestRehab ? injuries.find(i => i.notes && i.notes.trim()) : null

  if (latestRehab) {
    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['CURRENT REHABILITATION STRATEGY & ACTIVE PLAN', '', '']],
      body: [
        [
          { content: `Active Phase:\n${latestRehab.rehab_phase || 'Phase 1 - Acute Protection'}`, styles: { fontStyle: 'bold', textColor: TEAL } },
          { content: `Pain Scale:\n${latestRehab.pain_level ?? 0} / 10`, styles: { halign: 'center', fontStyle: 'bold', textColor: NAVY } },
          { content: `RTP Status:\n${latestRehab.clearance_status || 'In Rehab'}`, styles: { halign: 'right', fontStyle: 'bold', textColor: latestRehab.clearance_status === 'Full Match Clearance' ? GREEN : AMBER } },
        ],
        [
          { content: `Prescribed Protocol & Modalities:\n${latestRehab.treatment_summary || 'Ongoing clinical protocols'}`, colSpan: 3, styles: { textColor: TEXT, fontStyle: 'normal' } }
        ],
        ...(latestRehab.clinical_notes ? [
          [{ content: `Clinical Notes & Exercise Progression:\n${latestRehab.clinical_notes}`, colSpan: 3, styles: { textColor: SLATE, fontStyle: 'normal' } }]
        ] : []),
        ...(latestRehab.target_milestone ? [
          [{ content: `Milestone Target: ${latestRehab.target_milestone}`, colSpan: 3, styles: { fontStyle: 'bold', textColor: TEAL } }]
        ] : [])
      ],
      styles: { fontSize: 7.2, cellPadding: 2.4, overflow: 'linebreak', lineColor: [153, 246, 228], lineWidth: 0.2 },
      headStyles: { fillColor: [240, 253, 250], textColor: NAVY, fontStyle: 'bold', fontSize: 7.8, lineColor: TEAL, lineWidth: 0.3 },
      bodyStyles: { fillColor: WHITE },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 44 },
        2: { cellWidth: 50 },
      }
    })
    y = doc.lastAutoTable.finalY + 6
  } else if (activeInjuryWithNotes) {
    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [[`INJURY TREATMENT PROTOCOL & CLINICAL NOTES: ${(activeInjuryWithNotes.injury_type || 'INJURY').toUpperCase()}`, '', '']],
      body: [
        [
          { content: `Severity:\n${activeInjuryWithNotes.severity || 'Mild'}`, styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: `Status:\n${activeInjuryWithNotes.status || 'Active'}`, styles: { halign: 'center', fontStyle: 'bold', textColor: activeInjuryWithNotes.status === 'Active' ? AMBER : GREEN } },
          { content: `Expected Return:\n${fmtDate(activeInjuryWithNotes.expected_return)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: NAVY } },
        ],
        [
          { content: `Clinical Protocol & Treatment Notes:\n${activeInjuryWithNotes.notes}`, colSpan: 3, styles: { textColor: TEXT, fontStyle: 'normal' } }
        ]
      ],
      styles: { fontSize: 7.2, cellPadding: 2.4, overflow: 'linebreak', lineColor: [254, 215, 170], lineWidth: 0.2 },
      headStyles: { fillColor: [254, 243, 199], textColor: NAVY, fontStyle: 'bold', fontSize: 7.8, lineColor: AMBER, lineWidth: 0.3 },
      bodyStyles: { fillColor: WHITE },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 62 },
        2: { cellWidth: 62 },
      }
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Full Longitudinal Table of Rehab Sessions
  if (rehabNotes.length === 0) {
    if (!activeInjuryWithNotes) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.8)
      doc.setTextColor(...TEXT2)
      doc.text('No rehabilitation session records logged for this athlete yet.', 12, y + 4)
      y += 10
    }
  } else {
    const rehabRows = rehabNotes.map((r, idx) => [
      idx + 1,
      fmtDate(r.session_date),
      `${r.rehab_phase || '—'}\n[${r.clearance_status || 'In Rehab'}]`,
      `${r.pain_level ?? 0}/10`,
      r.treatment_summary || '—',
      `${r.clinical_notes || '—'}${r.target_milestone ? `\n\nTarget: ${r.target_milestone}` : ''}`,
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Date', 'Rehab Phase & Status', 'Pain', 'Prescribed Treatment / Modalities', 'Clinical Notes & Milestone Target']],
      body: rehabRows,
      styles: { fontSize: 6.8, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: SLATE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.0 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 38, fontStyle: 'bold' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 54 },
        5: { cellWidth: 55 },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const cs = String(data.cell.raw || '')
          if (cs.includes('Full Match Clearance')) { data.cell.styles.textColor = [22, 163, 74] }
          else if (cs.includes('In Rehab'))        { data.cell.styles.textColor = [217, 119, 6] }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 7
  }

  // ── 3. Injury Incidents & Diagnostics ──
  if (y > PH - 60) { doc.addPage(); y = 18 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(`3. INJURY INCIDENTS & DIAGNOSTIC REGISTER (${injuries.length} incident${injuries.length === 1 ? '' : 's'})`, 12, y)
  y += 4

  if (injuries.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.8)
    doc.setTextColor(...GREEN)
    doc.text('✔ No injury incidents recorded for this athlete.', 12, y + 3)
    y += 10
  } else {
    const injuryRows = injuries.map((inj, idx) => {
      let daysLost = '—'
      if (inj.date_of_injury) {
        const start = new Date(inj.date_of_injury)
        const end   = inj.expected_return ? new Date(inj.expected_return) : new Date()
        const diff  = Math.ceil((end - start) / 86400000)
        daysLost = diff >= 0 ? `${diff} days` : '—'
      }
      return [
        idx + 1,
        inj.injury_type || '—',
        inj.severity || '—',
        fmtDate(inj.date_of_injury),
        fmtDate(inj.expected_return),
        daysLost,
        inj.status || '—',
        inj.notes || '—',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['#', 'Diagnosis / Injury Type', 'Severity', 'Date Injured', 'Expected Return', 'Days Lost', 'Status', 'Clinical Notes & Mechanism']],
      body: injuryRows,
      styles: { fontSize: 6.8, cellPadding: 2.2, overflow: 'linebreak' },
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
        if (data.column.index === 6 && data.section === 'body') {
          if (data.cell.raw === 'Active')    { data.cell.styles.textColor = [217, 119, 6]; data.cell.styles.fontStyle = 'bold' }
          if (data.cell.raw === 'Recovered') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold' }
        }
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 7
  }

  // ── 4. Clinical Declaration & Sign-off Box ──
  if (y > PH - 48) { doc.addPage(); y = 18 }

  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.4)
  doc.roundedRect(12, y, PW - 24, 22, 2, 2, 'D')

  doc.setFillColor(...TEAL)
  doc.roundedRect(12, y, 3.5, 22, 1.5, 1.5, 'F')
  doc.rect(14, y, 1.5, 22, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('4. CLINICAL CLEARANCE & LEGAL DECLARATION', 19, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT)
  const declText = 'This clinical dossier contains confidential medical records. All rehabilitation protocols, pain progression, and Return-to-Play criteria are documented in accordance with sports physiotherapy standards.'
  const declLines = doc.splitTextToSize(declText, PW - 38)
  doc.text(declLines, 19, y + 10)

  // Signature lines
  y += 26
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(12,  y + 4, 80,  y + 4)
  doc.line(110, y + 4, 180, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(...TEXT2)
  doc.text('ATTENDING PHYSIOTHERAPIST / MEDICAL OFFICER', 12,  y + 8)
  doc.text('DATE & CLINICAL STAMP',                        110, y + 8)

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
      `${(meta.clubName || 'CLUB').toUpperCase()}  •  CLINICAL DOSSIER: ${(ath.name || 'ATHLETE').toUpperCase()}  •  ${period}  •  Page ${pg} of ${totalPages}`,
      PW / 2, ph - 4.5, { align: 'center' }
    )
  }

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN GENERAL SQUAD MEDICAL & RECOVERY REPORT (PDF)
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

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return d }
  }

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
    doc.text('✔ Excellent: No active injury cases recorded. Squad is at 100% availability.', 12, y + 3)
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
          { data: a }, { data: i }, { data: r }, { data: p },
          { data: s }, { data: c }, { data: ct },
        ] = await Promise.all([
          scopeTeam(supabase.from('athletes').select('*, coaches(name)'), teamId).order('name', { ascending: true }),
          scopeTeam(supabase.from('injuries').select('*, athletes(name, club, position, photo_url)'), teamId),
          scopeTeam(supabase.from('rehabilitation_notes').select('*, athletes(name, position, photo_url)'), teamId).order('session_date', { ascending: false }),
          scopeTeam(supabase.from('performance_stats').select('*, athletes(name, position, club)'), teamId).order('match_date', { ascending: false }),
          scopeTeam(supabase.from('training_sessions').select('*'), teamId),
          scopeTeam(supabase.from('coaches').select('*'), teamId),
          scopeTeam(supabase.from('contracts').select('*, athletes(name, position, club)'), teamId),
        ])

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
          setSelectedPlayer(prev => {
            if (prev && a.some(ath => ath.id === prev)) return prev
            const injuredAth = a.find(ath => ath.status === 'Injured')
            return injuredAth ? injuredAth.id : a[0].id
          })
        }
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
          clientRehabNotes: rehabNotes,
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
        // Ensure data.rehabNotes incorporates any client-side / local notes for this player
        const playerRehabs = rehabNotes.filter(r => r.athlete_id === selectedPlayer)
        const combinedPlayerRehab = [...(data.rehabNotes || [])]
        for (const pr of playerRehabs) {
          if (!combinedPlayerRehab.some(dr => dr.id === pr.id)) {
            combinedPlayerRehab.push(pr)
          }
        }
        data.rehabNotes = combinedPlayerRehab

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

  const sel = { padding:'8px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', fontSize:13, color:'var(--text)', background:'var(--surface2)', outline:'none', fontFamily:'var(--font)', cursor:'pointer' }

  // Filter athletes for the selector
  const filteredAthletes = athletes.filter(a => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (a.name || '').toLowerCase().includes(q) || (a.position || '').toLowerCase().includes(q)
  })

  const selectedAthleteObj = athletes.find(a => a.id === selectedPlayer)
  const selectedPlayerInjuries = selectedPlayer ? injuries.filter(i => i.athlete_id === selectedPlayer) : []
  const selectedPlayerActiveInj = selectedPlayerInjuries.filter(i => i.status === 'Active')
  const selectedPlayerRehabNotes = selectedPlayer ? rehabNotes.filter(r => r.athlete_id === selectedPlayer) : []
  const latestPlayerRehab = selectedPlayerRehabNotes[0]
  const playerInjuryWithNotes = !latestPlayerRehab ? selectedPlayerInjuries.find(i => i.notes && i.notes.trim()) : null

  return (
    <Layout>
      <div className="page-outer-wide">
        
        {/* Header */}
        <PageHeader
          label={isPurePhysio ? 'Medical & Physiotherapy' : 'Reports & Analytics'}
          title={isPurePhysio ? 'Player Clinical & Rehab Reports' : 'Club Reports'}
          subtitle={isPurePhysio
            ? 'Generate official clinical dossiers with team logo, player photo, entered rehabilitation plan, and return-to-play status.'
            : 'Generate executive squad health overviews, player clinical dossiers, and exportable club data.'}
        />

        {/* ── Status Message Toast ── */}
        {statusMsg.text && (
          <div style={{
            background: statusMsg.type==='error' ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${statusMsg.type==='error' ? '#FECACA' : '#BBF7D0'}`,
            borderRadius: 'var(--r-md)',
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: statusMsg.type==='error' ? '#B91C1C' : '#166534',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* ── Reporting Window Filter ── */}
        <div className="card fade-up" style={{ padding:'16px 20px', marginBottom:20, border:'1px solid var(--border)', background:'var(--surface)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', margin:0 }}>Reporting Window</div>
              <div style={{ fontSize:12, color:'var(--text3)', margin:'2px 0 0' }}>Select date scope applied to generated reports</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:2 }}>
                {['monthly','yearly'].map(t => (
                  <button key={t} onClick={() => setReportType(t)} style={{ padding:'5px 14px', background: reportType===t ? '#0D9488' : 'transparent', border:'none', borderRadius:6, fontSize:12, fontWeight:700, color: reportType===t ? '#fff' : 'var(--text2)', cursor:'pointer', transition:'var(--transition)', textTransform:'capitalize', fontFamily:'var(--font)' }}>
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
              <div style={{ fontSize:12, color:'var(--text2)', background:'var(--surface2)', padding:'6px 10px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', fontWeight:600 }}>
                Period: <span style={{ color:'#0D9488' }}>{period}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PHYSIO / CLINICAL DOSSIER SECTION (CLEAN THEME)
            Displays Player Photo, Team Logo, Website Logo & Entered Rehab Plan
        ══════════════════════════════════════════════════════════════════ */}
        <div className="fade-up" style={{ marginBottom:28 }}>
          <div className="card" style={{ padding:0, overflow:'hidden', border:'1px solid #CBD5E1', background:'#FFFFFF', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            
            {/* Header Banner - Clean Dark Navy & Teal (NO harsh red) */}
            <div style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', padding:'16px 22px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, borderBottom:'2px solid #0D9488' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'rgba(13,148,136,0.2)', border:'1px solid rgba(45,212,191,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'#2DD4BF' }}>
                  <Stethoscope size={20}/>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, letterSpacing:'-0.01em' }}>Player Clinical &amp; Rehabilitation Dossier</div>
                  <div style={{ fontSize:11, color:'#94A3B8', fontWeight:500 }}>Comprehensive dossier featuring team &amp; website logos, player picture, entered rehabilitation plan, and RTP progression</div>
                </div>
              </div>
              <span style={{ fontSize:11, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', padding:'4px 10px', borderRadius:99, fontWeight:600, color:'#CBD5E1' }}>
                Medical Department
              </span>
            </div>

            <div style={{ padding:'20px 22px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.1fr) minmax(0, 1.9fr)', gap:20 }} className="dash-grid">
                
                {/* Left: Player Selector & Search */}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                    1. Select Athlete
                  </label>

                  {/* Search box */}
                  <div style={{ position:'relative', marginBottom:8 }}>
                    <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
                    <input
                      type="text"
                      placeholder="Search by name or position…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width:'100%', padding:'8px 10px 8px 30px', border:'1px solid #CBD5E1', borderRadius:8, fontSize:12, outline:'none', background:'#F8FAFC', color:'#0F172A', boxSizing:'border-box' }}
                    />
                  </div>

                  {/* Player select list */}
                  <div style={{ border:'1px solid #E2E8F0', borderRadius:8, maxHeight:300, overflowY:'auto', background:'#F8FAFC' }}>
                    {filteredAthletes.length === 0 ? (
                      <div style={{ padding:16, textAlign:'center', color:'#94A3B8', fontSize:12 }}>No players found</div>
                    ) : (
                      filteredAthletes.map(a => {
                        const isSelected = selectedPlayer === a.id
                        const isInjured = a.status === 'Injured'
                        const athRehabs = rehabNotes.filter(r => r.athlete_id === a.id)
                        const athInjs = injuries.filter(i => i.athlete_id === a.id)
                        const latestRehabDate = athRehabs[0]?.session_date
                        const latestInjDate = athInjs[0]?.date_of_injury
                        const mostRecentDate = latestRehabDate || latestInjDate

                        return (
                          <div
                            key={a.id}
                            onClick={() => setSelectedPlayer(a.id)}
                            style={{
                              padding:'9px 10px',
                              display:'flex',
                              alignItems:'center',
                              justifyContent:'space-between',
                              gap:8,
                              cursor:'pointer',
                              borderBottom:'1px solid #F1F5F9',
                              background: isSelected ? '#EFF6FF' : 'transparent',
                              borderLeft: isSelected ? '3px solid #0D9488' : '3px solid transparent',
                              transition:'background 0.15s ease',
                            }}
                          >
                            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                              {a.photo_url ? (
                                <img
                                  src={a.photo_url}
                                  alt={a.name}
                                  style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'1px solid #CBD5E1' }}
                                />
                              ) : (
                                <div style={{ width:30, height:30, borderRadius:'50%', background:'#E2E8F0', color:'#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                                  {a.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                                </div>
                              )}
                              <div style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                                <div style={{ fontSize:12, fontWeight: isSelected ? 700 : 600, color: isSelected ? '#0F766E' : '#0F172A', display:'flex', alignItems:'center', gap:4 }}>
                                  <span>{a.name}</span>
                                  {a.back_number && <span style={{ fontSize:10.5, color:'#64748B' }}>#{a.back_number}</span>}
                                </div>
                                <div style={{ fontSize:10.5, color:'#64748B', display:'flex', alignItems:'center', gap:5, marginTop:1, flexWrap:'wrap' }}>
                                  <span>{a.position || 'Player'}</span>
                                  {mostRecentDate && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: isSelected ? '#0F766E' : '#0D9488', fontWeight:600 }}>
                                        {latestRehabDate ? `Rehab: ${fmtDate(latestRehabDate)}` : `Injured: ${fmtDate(latestInjDate)}`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span style={{
                              fontSize:9.5,
                              padding:'2px 6px',
                              borderRadius:4,
                              fontWeight:700,
                              background: isInjured ? '#FEF3C7' : '#DCFCE7',
                              color: isInjured ? '#B45309' : '#15803D',
                              flexShrink:0
                            }}>
                              {isInjured ? 'Injured' : 'Fit'}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div style={{ fontSize:11, color:'#64748B', marginTop:6 }}>
                    Showing {filteredAthletes.length} of {athletes.length} athletes
                  </div>
                </div>

                {/* Right: Selected Player Preview & Entered Rehabilitation Plan */}
                <div style={{ background:'#F8FAFC', borderRadius:10, padding:'16px', border:'1px solid #E2E8F0', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>
                      2. Player Clinical &amp; Rehab Preview
                    </div>

                    {selectedAthleteObj ? (
                      <div>
                        {/* Classy Dossier Header Banner Preview (Teal & Navy - No Red UI) */}
                        <div style={{
                          background:'linear-gradient(135deg, #0B132B 0%, #0F172A 100%)',
                          borderRadius:8,
                          padding:'12px 14px',
                          marginBottom:14,
                          border:'1px solid #1E293B',
                          boxShadow:'0 4px 12px rgba(15,23,42,0.12)',
                          position:'relative',
                          overflow:'hidden'
                        }}>
                          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'linear-gradient(90deg, #0D9488 0%, #2DD4BF 60%, #38BDF8 100%)' }} />
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                            {/* Left: Classy Teal Badge & Club Info */}
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{
                                background:'#0F766E',
                                border:'1px solid #2DD4BF',
                                color:'#FFFFFF',
                                fontSize:9.5,
                                fontWeight:800,
                                padding:'3px 9px',
                                borderRadius:6,
                                letterSpacing:'0.04em',
                                textTransform:'uppercase',
                                boxShadow:'0 2px 6px rgba(15,118,110,0.3)',
                                whiteSpace:'nowrap'
                              }}>
                                PLAYER CLINICAL DOSSIER
                              </span>
                            </div>

                            {/* Right: Medical Report & Athlete Name */}
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontSize:11, fontWeight:800, color:'#FFFFFF', letterSpacing:'0.02em' }}>
                                MEDICAL &amp; REHABILITATION REPORT
                              </div>
                              <div style={{ fontSize:12, fontWeight:800, color:'#2DD4BF', marginTop:1 }}>
                                {selectedAthleteObj.name.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Athlete Details Bar */}
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                          {selectedAthleteObj.photo_url ? (
                            <img
                              src={selectedAthleteObj.photo_url}
                              alt={selectedAthleteObj.name}
                              style={{ width:48, height:48, borderRadius:8, objectFit:'cover', flexShrink:0, border:'1.5px solid #CBD5E1' }}
                            />
                          ) : (
                            <div style={{ width:48, height:48, borderRadius:8, background:'#0F172A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>
                              {selectedAthleteObj.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                            </div>
                          )}
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#0F172A' }}>{selectedAthleteObj.name}</div>
                            <div style={{ fontSize:11.5, color:'#64748B', fontWeight:500 }}>
                              {selectedAthleteObj.position || 'Athlete'} · {selectedAthleteObj.back_number ? `Jersey #${selectedAthleteObj.back_number}` : 'No Squad #'} · {selectedAthleteObj.age ? `${selectedAthleteObj.age} yrs` : ''}
                            </div>
                          </div>
                          <span style={{
                            fontSize:11,
                            fontWeight:700,
                            padding:'4px 10px',
                            borderRadius:6,
                            background: selectedAthleteObj.status === 'Injured' ? '#FEF3C7' : '#DCFCE7',
                            color: selectedAthleteObj.status === 'Injured' ? '#B45309' : '#15803D',
                            border: `1px solid ${selectedAthleteObj.status === 'Injured' ? '#FDE68A' : '#BBF7D0'}`
                          }}>
                            {selectedAthleteObj.status === 'Injured' ? 'In Rehab' : 'Match Fit'}
                          </span>
                        </div>

                        {/* Mini Clinical Stat Badges */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:12 }}>
                          <div style={{ background:'#FFFFFF', padding:'8px 10px', borderRadius:6, border:'1px solid #E2E8F0', textAlign:'center' }}>
                            <div style={{ fontSize:9.5, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Injuries Logged</div>
                            <div style={{ fontSize:14, fontWeight:800, color:'#0F172A', marginTop:1 }}>
                              {selectedPlayerInjuries.length}
                            </div>
                          </div>
                          <div style={{ background:'#FFFFFF', padding:'8px 10px', borderRadius:6, border:'1px solid #E2E8F0', textAlign:'center' }}>
                            <div style={{ fontSize:9.5, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Active Cases</div>
                            <div style={{ fontSize:14, fontWeight:800, color: selectedPlayerActiveInj.length ? '#D97706' : '#16A34A', marginTop:1 }}>
                              {selectedPlayerActiveInj.length}
                            </div>
                          </div>
                          <div style={{ background:'#FFFFFF', padding:'8px 10px', borderRadius:6, border:'1px solid #E2E8F0', textAlign:'center' }}>
                            <div style={{ fontSize:9.5, color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Rehab Sessions</div>
                            <div style={{ fontSize:14, fontWeight:800, color:'#0D9488', marginTop:1 }}>
                              {selectedPlayerRehabNotes.length}
                            </div>
                          </div>
                        </div>

                        {/* Entered Rehabilitation Plan Details */}
                        <div style={{ background:'#FFFFFF', border:'1px solid #CBD5E1', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                          <div style={{ fontSize:11, fontWeight:800, color:'#0D9488', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <Activity size={13}/>
                              Active Rehabilitation Plan &amp; Protocol
                            </span>
                            {latestPlayerRehab?.session_date && (
                              <span style={{ fontSize:10.5, color:'#64748B', fontWeight:600 }}>
                                Logged: {fmtDate(latestPlayerRehab.session_date)}
                              </span>
                            )}
                          </div>
                          {latestPlayerRehab ? (
                            <div style={{ fontSize:12, color:'#334155', lineHeight:1.45 }}>
                              <div style={{ marginBottom:3 }}>
                                <strong style={{ color:'#0F172A' }}>Current Phase:</strong> {latestPlayerRehab.rehab_phase || 'Phase 1 - Acute Protection'}
                              </div>
                              <div style={{ marginBottom:3 }}>
                                <strong style={{ color:'#0F172A' }}>Treatment Protocol:</strong> {latestPlayerRehab.treatment_summary || 'Ongoing clinical protocols'}
                              </div>
                              {latestPlayerRehab.clinical_notes && (
                                <div style={{ marginBottom:3, fontSize:11.5, color:'#475569' }}>
                                  <strong style={{ color:'#0F172A' }}>Clinical Notes:</strong> {latestPlayerRehab.clinical_notes}
                                </div>
                              )}
                              {latestPlayerRehab.target_milestone && (
                                <div style={{ marginBottom:3, fontSize:11.5, color:'#0D9488' }}>
                                  <strong style={{ color:'#0F172A' }}>Target Milestone:</strong> {latestPlayerRehab.target_milestone}
                                </div>
                              )}
                              <div style={{ display:'flex', gap:12, fontSize:11, color:'#64748B', marginTop:5, paddingTop:4, borderTop:'1px dashed #E2E8F0', flexWrap:'wrap' }}>
                                <span>Pain Scale: <strong style={{ color:'#0F172A' }}>{latestPlayerRehab.pain_level ?? 0} / 10</strong></span>
                                <span>Status: <strong style={{ color: latestPlayerRehab.clearance_status === 'Full Match Clearance' ? '#16A34A' : '#D97706' }}>{latestPlayerRehab.clearance_status || 'In Rehab'}</strong></span>
                                <span>Session Date: <strong style={{ color:'#0F172A' }}>{fmtDate(latestPlayerRehab.session_date)}</strong></span>
                              </div>
                            </div>
                          ) : playerInjuryWithNotes ? (
                            <div style={{ fontSize:12, color:'#334155', lineHeight:1.45 }}>
                              <div style={{ marginBottom:3 }}>
                                <strong style={{ color:'#0F172A' }}>Diagnosis:</strong> {playerInjuryWithNotes.injury_type} ({playerInjuryWithNotes.severity})
                              </div>
                              <div style={{ marginBottom:3 }}>
                                <strong style={{ color:'#0F172A' }}>Prescribed Protocol &amp; Notes:</strong> {playerInjuryWithNotes.notes}
                              </div>
                              <div style={{ display:'flex', gap:12, fontSize:11, color:'#64748B', marginTop:5, paddingTop:4, borderTop:'1px dashed #E2E8F0' }}>
                                <span>Status: <strong style={{ color: playerInjuryWithNotes.status === 'Active' ? '#D97706' : '#16A34A' }}>{playerInjuryWithNotes.status}</strong></span>
                                <span>Date Injured: <strong style={{ color:'#0F172A' }}>{fmtDate(playerInjuryWithNotes.date_of_injury)}</strong></span>
                                <span>Expected Return: <strong style={{ color:'#0F172A' }}>{fmtDate(playerInjuryWithNotes.expected_return)}</strong></span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize:11, color:'#64748B', fontStyle:'italic' }}>
                              No active rehabilitation note recorded yet for this athlete. The PDF will include baseline clinical data and injury history.
                            </div>
                          )}
                        </div>

                        {/* Recent History / Entry Dates Timeline */}
                        {selectedPlayerRehabNotes.length > 0 && (
                          <div style={{ background:'#FFFFFF', border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
                            <div style={{ fontSize:10.5, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span>Clinical Entries &amp; Dates ({selectedPlayerRehabNotes.length})</span>
                              <span style={{ fontSize:10, color:'#0D9488', fontWeight:600 }}>Most Recent: {fmtDate(selectedPlayerRehabNotes[0]?.session_date)}</span>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:140, overflowY:'auto' }}>
                              {selectedPlayerRehabNotes.map((rn, idx) => (
                                <div key={rn.id || idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', padding:'6px 10px', borderRadius:6, border:'1px solid #F1F5F9', fontSize:11 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <span style={{ fontSize:9.5, background: idx === 0 ? '#CCFBF1' : '#E2E8F0', color: idx === 0 ? '#0F766E' : '#475569', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>
                                      {idx === 0 ? 'Latest' : `#${idx + 1}`}
                                    </span>
                                    <span style={{ fontWeight:700, color:'#0F172A' }}>{fmtDate(rn.session_date)}</span>
                                    <span style={{ color:'#64748B' }}>· {rn.rehab_phase ? rn.rehab_phase.split('-')[0].trim() : 'Phase 1'}</span>
                                  </div>
                                  <span style={{ fontSize:10, fontWeight:700, color: rn.clearance_status === 'Full Match Clearance' ? '#16A34A' : '#D97706' }}>
                                    {rn.clearance_status || 'In Rehab'} (Pain {rn.pain_level ?? 0}/10)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'28px 14px', color:'#94A3B8' }}>
                        <User size={32} style={{ margin:'0 auto 8px', color:'#CBD5E1' }}/>
                        <p style={{ fontSize:13, fontWeight:600, margin:0 }}>Select an athlete from the list on the left to preview their dossier</p>
                      </div>
                    )}
                  </div>

                  {/* Download Button */}
                  <button
                    id="btn-physio-player-pdf"
                    onClick={() => generateMedicalPDF('player')}
                    disabled={generating === 'medical_player' || !selectedPlayer}
                    style={{
                      width:'100%',
                      padding:'11px 16px',
                      background: generating === 'medical_player' ? '#E2E8F0' : selectedPlayer ? 'linear-gradient(135deg, #0D9488, #0F766E)' : '#E2E8F0',
                      color: selectedPlayer ? '#FFFFFF' : '#94A3B8',
                      border:'none',
                      borderRadius:8,
                      fontSize:13,
                      fontWeight:700,
                      cursor: selectedPlayer ? 'pointer' : 'not-allowed',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:8,
                      transition:'all 0.15s ease',
                      boxShadow: selectedPlayer ? '0 2px 8px rgba(13,148,136,0.3)' : 'none'
                    }}
                  >
                    {generating === 'medical_player' ? (
                      <>
                        <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                        Generating Clinical Dossier PDF…
                      </>
                    ) : (
                      <>
                        <Download size={15}/>
                        Download Player Clinical &amp; Rehab Dossier (PDF)
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ADMIN DASHBOARD VIEW (ADMIN / SUPERADMIN)
            Executive Squad Overview & Club Excel Exports
        ══════════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <div>

            {/* ── Section A: General Squad Health Report ── */}
            <div className="fade-up" style={{ marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'#F0FDFA', border:'1px solid #99F6E4', display:'flex', alignItems:'center', justifyContent:'center', color:'#0D9488', flexShrink:0 }}>
                  <HeartPulse size={18} strokeWidth={2.2}/>
                </div>
                <div>
                  <h2 style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:0 }}>
                    Executive Squad Medical Overview
                  </h2>
                  <p style={{ fontSize:12, color:'var(--text3)', margin:0 }}>
                    High-level squad report with active injuries, recovered players, and availability scorecards.
                  </p>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:14 }} className="card-grid-auto">
                
                {/* General Squad PDF Card */}
                <div className="card" style={{ padding:0, overflow:'hidden', border:'1px solid #CBD5E1', background:'#FFFFFF', borderRadius:10 }}>
                  <div style={{ background:'linear-gradient(135deg, #0F766E, #0D9488)', padding:'8px 14px', fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    Executive Squad Health Audit
                  </div>
                  <div style={{ padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                      <div style={{ width:42, height:42, borderRadius:10, background:'#F0FDFA', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #CCFBF1' }}>
                        <FileText size={20} color="#0D9488"/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:3 }}>Squad Medical &amp; Recovery Report</div>
                        <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.45 }}>
                          Detailed squad availability audit: active injuries, recovered players cleared for selection, time lost, and physio clearance metrics.
                        </div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10.5, color:'#0D9488', background:'#F0FDFA', padding:'2px 8px', borderRadius:99, fontWeight:600, border:'1px solid #CCFBF1' }}>{period}</span>
                      <span style={{ fontSize:10.5, color:'#15803D', background:'#F0FDF4', padding:'2px 8px', borderRadius:99, fontWeight:600, border:'1px solid #DCFCE7' }}>Includes Recovered Athletes</span>
                      <span style={{ fontSize:10.5, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border)' }}>PDF</span>
                    </div>

                    <button
                      id="btn-admin-general-medical-pdf"
                      onClick={() => generateMedicalPDF('general')}
                      disabled={generating === 'medical_general'}
                      style={{
                        width:'100%',
                        padding:'9px 14px',
                        background: generating === 'medical_general' ? 'var(--surface3)' : 'linear-gradient(135deg, #0F766E, #0D9488)',
                        color: generating === 'medical_general' ? 'var(--text3)' : '#fff',
                        border:'none',
                        borderRadius:'var(--r-md)',
                        fontSize:12,
                        fontWeight:700,
                        cursor: generating === 'medical_general' ? 'not-allowed' : 'pointer',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:6,
                        transition:'var(--transition)'
                      }}
                    >
                      {generating === 'medical_general' ? (
                        <>
                          <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
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
                </div>

              </div>
            </div>

            {/* ── Section B: Club Management Excel Reports ── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h2 style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:0 }}>
                Club Operations &amp; Data Exports
              </h2>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{ADMIN_REPORT_CARDS.length} Excel workbooks</span>
            </div>

            {loading ? (
              <div style={{ padding:'40px', textAlign:'center' }}>
                <div style={{ width:30, height:30, border:'3px solid #F0FDFA', borderTopColor:'#0D9488', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 10px' }} />
                <p style={{ color:'var(--text3)', fontSize:12 }}>Loading records…</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }} className="card-grid-auto">
                {ADMIN_REPORT_CARDS.map((card, idx) => {
                  const isGenerating = generating === card.id
                  return (
                    <div
                      key={card.id}
                      className={`card fade-up fade-up-${idx % 4}`}
                      style={{
                        padding:0,
                        overflow:'hidden',
                        transition:'all 0.15s ease',
                        border: card.featured ? `1.5px solid ${card.color}` : '1px solid var(--border)',
                        borderRadius:10,
                        background:'var(--surface)'
                      }}
                    >
                      {card.featured && (
                        <div style={{ background:card.color, padding:'4px 12px', fontSize:10.5, fontWeight:700, color:'#fff', letterSpacing:'0.06em', textTransform:'uppercase', textAlign:'center' }}>
                          ★ Complete Club Overview
                        </div>
                      )}

                      <div style={{ padding:'16px 18px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                          <div style={{ width:42, height:42, borderRadius:10, background:card.color+'14', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${card.color}25` }}>
                            {card.icon}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{card.title}</div>
                            <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.45 }}>{card.desc}</div>
                          </div>
                        </div>

                        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                          <span style={{ fontSize:10.5, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border)' }}>{period}</span>
                          <span style={{ fontSize:10.5, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border)' }}>{card.sheets}</span>
                          <span style={{ fontSize:10.5, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border)' }}>.xlsx</span>
                        </div>

                        <button
                          onClick={() => generateExcelReport(card.id)}
                          disabled={isGenerating || loading}
                          style={{
                            width:'100%',
                            padding:'9px 14px',
                            background: isGenerating ? 'var(--surface3)' : `linear-gradient(135deg, ${card.color}, ${card.color}DD)`,
                            color: isGenerating ? 'var(--text3)' : '#fff',
                            border:'none',
                            borderRadius:'var(--r-md)',
                            fontSize:12,
                            fontWeight:700,
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'center',
                            gap:6,
                            transition:'var(--transition)',
                            fontFamily:'var(--font)'
                          }}
                        >
                          {isGenerating ? (
                            <>
                              <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'var(--text3)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                              Exporting…
                            </>
                          ) : (
                            <>
                              <Download size={13}/>
                              Export Excel Sheet
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Financial Snapshot */}
            {!loading && contracts.length > 0 && (
              <div className="card fade-up" style={{ padding:'18px 20px', marginTop:20, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:'var(--text)' }}>Financial Overview</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                  {[
                    ['Weekly Wage Bill',  `GHS ${weeklyWage.toFixed(2)}`],
                    ['Monthly Estimate',  `GHS ${(weeklyWage * 4.33).toFixed(2)}`],
                    ['Annual Projection', `GHS ${(weeklyWage * 52).toFixed(2)}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background:'var(--surface2)', borderRadius:'var(--r-md)', padding:'12px 14px', border:'1px solid var(--border)', textAlign:'center' }}>
                      <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:'#059669' }}>{value}</div>
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
