/**
 * SPORTS INJURY DIAGNOSIS AND REHABILITATION PLAN
 * Individual Physiotherapy Report Module & PDF Engine
 *
 * Implements the 9-section clinical sports physiotherapy framework:
 * 1. Patient Details
 * 2. Sports Injury Diagnosis
 * 3. Baseline Assessment (Injured side vs Uninjured side)
 * 4. Rehabilitation Goals
 * 5. Rehabilitation Plan (Phases 1-4)
 * 6. Prevention and Maintenance
 * 7. Home Exercise Programme
 * 8. Review and Outcome Measures
 * 9. Sign-off
 */

import { getApexTrackLogoBase64, getBase64ImageFromUrl } from '@/lib/pdfLogos'

export const DEFAULT_PHYSIO_TEMPLATE = {
  // 1. Patient Details
  level: '',
  referred_by: '',

  // 2. Sports Injury Diagnosis
  structure_and_side: '',
  grade: '', // Grade I | Grade II | Grade III
  date_of_injury: '',
  mechanism_contact: '', // Contact | Non-contact
  mechanism_timing: '', // Acute | Overuse
  stage: '', // Acute | Sub-acute | Chronic
  contributing_factors: '',
  red_flags: '',
  clinical_impression: '',

  // 3. Baseline Assessment (All blank by default)
  baseline: [
    { measure: 'Pain at rest / activity (0-10)', injured: '', uninjured: '', notes: '' },
    { measure: 'Swelling', injured: '', uninjured: '', notes: '' },
    { measure: 'Range of motion (ROM)', injured: '', uninjured: '', notes: '' },
    { measure: 'Strength (MMT / dynamometer)', injured: '', uninjured: '', notes: '' },
    { measure: 'Balance / single-leg control', injured: '', uninjured: '', notes: '' },
    { measure: 'Special tests', injured: '', uninjured: '', notes: '' },
    { measure: 'Hop tests / functional tests', injured: '', uninjured: '', notes: '' },
  ],

  // 4. Rehabilitation Goals (All blank by default)
  goal_short_term: '',
  goal_long_term: '',

  // 5. Rehabilitation Plan (Phases 1-4)
  phase1: {
    title: 'Phase 1: Protect and Settle',
    duration: '',
    aim: '',
    interventions: '',
    exercises: '',
    progress_when: '',
    notes: '',
    status: 'In Progress',
  },
  phase2: {
    title: 'Phase 2: Restore Strength and Control',
    duration: '',
    aim: '',
    interventions: '',
    exercises: '',
    progress_when: '',
    notes: '',
    status: 'Upcoming',
  },
  phase3: {
    title: 'Phase 3: Power and Sport-Specific',
    duration: '',
    aim: '',
    interventions: '',
    exercises: '',
    progress_when: '',
    notes: '',
    status: 'Upcoming',
  },
  phase4: {
    title: 'Phase 4: Return to Sport',
    duration: '',
    aim: '',
    interventions: '',
    exercises: '',
    progress_when: '',
    notes: '',
    status: 'Upcoming',
  },

  // 6. Prevention and Maintenance
  warmup_routine: '',
  strength_maintenance: '',
  load_management: '',
  recovery: '',

  // 7. Home Exercise Programme
  hep: [],

  // 8. Review and Outcome Measures
  sessions_per_week: '',
  outcome_measures: '',
  review_date: '',
  status_against_goals: '',
  clinical_plan: 'Continue Care', // Continue care | Refer | Discharge / Cleared

  // 9. Sign-off
  therapist_name: '',
  therapist_qualification: '',
  report_date: new Date().toISOString().split('T')[0],
}

function cleanText(v) {
  if (!v) return ''
  return String(v)
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return String(d)
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return String(d)
  }
}

/**
 * Builds the comprehensive Individual Physiotherapy Report (PDF)
 * strictly formatted with all 9 clinical sections.
 */
export async function buildPhysiotherapyReportPDF({
  athlete = {},
  injury = {},
  rehabNotes = [],
  customPlan = null,
  meta = {},
  period = 'Current Season',
}) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  // Synthesize or merge plan with customPlan & defaults
  const plan = {
    ...DEFAULT_PHYSIO_TEMPLATE,
    ...(customPlan || {}),
  }

  // Prepopulate from live injury record if present
  if (injury?.injury_type) {
    plan.structure_and_side = injury.injury_type
  }
  if (injury?.severity) {
    plan.grade = injury.severity === 'Severe' ? 'Grade III' : (injury.severity === 'Moderate' ? 'Grade II' : 'Grade I')
  }
  if (injury?.date_of_injury) {
    plan.date_of_injury = injury.date_of_injury
  }
  if (injury?.notes) {
    plan.clinical_impression = injury.notes
  }

  // Prepopulate from latest rehabilitation notes if present
  if (rehabNotes && rehabNotes.length > 0) {
    const latest = rehabNotes[0]
    if (latest.pain_level !== undefined) {
      plan.baseline[0].injured = `Pain: ${latest.pain_level}/10`
    }
    if (latest.treatment_summary) {
      plan.phase2.exercises = latest.treatment_summary
    }
    if (latest.clinical_notes) {
      plan.status_against_goals = latest.clinical_notes
    }
    if (latest.author_name) {
      plan.therapist_name = latest.author_name
    }
  }

  // Preload Logos & Athlete Photo
  const [siteLogoBase64, teamLogoBase64, playerPhotoBase64] = await Promise.all([
    getApexTrackLogoBase64(),
    meta.clubLogoUrl ? getBase64ImageFromUrl(meta.clubLogoUrl) : null,
    athlete.photo_url ? getBase64ImageFromUrl(athlete.photo_url) : null,
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()   // 210
  const PH = doc.internal.pageSize.getHeight()  // 297

  const NAVY    = [15, 23, 42]     // #0F172A
  const TEAL    = [13, 148, 136]   // #0D9488
  const TEAL_BG = [240, 253, 250]  // #F0FDFA
  const SLATE   = [51, 65, 85]     // #334155
  const GREEN   = [22, 163, 74]    // #16A34A
  const AMBER   = [217, 119, 6]    // #D97706
  const RED     = [220, 38, 38]    // #DC2626
  const WHITE   = [255, 255, 255]
  const LIGHT   = [248, 250, 252]  // #F8FAFC
  const BORDER  = [226, 232, 240]  // #E2E8F0
  const TEXT    = [15, 23, 42]     // #0F172A
  const TEXT2   = [100, 116, 139]  // #64748B

  function renderPageHeader(pageNum) {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, PW, 32, 'F')

    // Teal brand accent stripe
    doc.setFillColor(...TEAL)
    doc.rect(0, 31, PW * 0.7, 1.0, 'F')
    doc.setFillColor(45, 212, 191) // Teal-300
    doc.rect(PW * 0.7, 31, PW * 0.3, 1.0, 'F')

    // Club logo
    let leftContentX = 12
    if (teamLogoBase64) {
      try {
        doc.setFillColor(...WHITE)
        doc.roundedRect(12, 4.5, 22, 22, 2, 2, 'F')
        doc.addImage(teamLogoBase64, 'PNG', 13, 5.5, 20, 20)
        leftContentX = 38
      } catch (_e) {}
    }

    // Badge
    const badgeW = 62
    const badgeH = 5.2
    doc.setFillColor(15, 118, 110)
    doc.roundedRect(leftContentX, 4.8, badgeW, badgeH, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...WHITE)
    doc.text('INDIVIDUAL PHYSIOTHERAPY REPORT', leftContentX + 3.5, 8.4)

    // Club name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...WHITE)
    doc.text((meta.clubName || athlete.club || 'CLUB').toUpperCase(), leftContentX, 16.5)

    // Subtitle
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(45, 212, 191)
    doc.text('SPORTS INJURY DIAGNOSIS AND REHABILITATION PLAN', leftContentX, 22.5)

    // Right logo & athlete title
    const logoBoxW = 15
    const logoBoxH = 15
    const logoBoxX = PW - 26
    const logoBoxY = 4.8

    if (siteLogoBase64) {
      try {
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 2, 2, 'F')
        doc.addImage(siteLogoBase64, 'PNG', logoBoxX + 1, logoBoxY + 1, logoBoxW - 2, logoBoxH - 2)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.5)
        doc.setTextColor(45, 212, 191)
        doc.text('ApexTrack GH', logoBoxX + (logoBoxW / 2), logoBoxY + logoBoxH + 4, { align: 'center' })
      } catch (_e) {}
    }

    const rightTextX = siteLogoBase64 ? logoBoxX - 4 : PW - 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text('CLINICAL DOSSIER', rightTextX, 9.5, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(45, 212, 191)
    doc.text((athlete.name || 'ATHLETE').toUpperCase(), rightTextX, 16.5, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(203, 213, 225)
    doc.text(`CONFIDENTIAL MEDICAL DOCUMENT  •  ${period}`, rightTextX, 22.5, { align: 'right' })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 1: Sections 1, 2, 3, 4
  // ───────────────────────────────────────────────────────────────────────────
  renderPageHeader(1)
  let y = 38

  // Section 1: Patient Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('1. PATIENT DETAILS & ATHLETE BIO DATA', 12, y)
  y += 3.5

  const photoW = 24
  const photoH = 30
  const photoX = 12
  const photoY = y

  doc.setFillColor(...LIGHT)
  doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'D')

  if (playerPhotoBase64) {
    try {
      doc.addImage(playerPhotoBase64, 'JPEG', photoX + 1, photoY + 1, photoW - 2, photoH - 2)
    } catch (_e) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT2)
      doc.text('ATHLETE', photoX + photoW / 2, photoY + 15, { align: 'center' })
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...TEXT2)
    doc.text((athlete.name || 'ATH').split(' ').map(w => w[0]).join('').slice(0, 3), photoX + photoW / 2, photoY + 13, { align: 'center' })
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text('No Photo', photoX + photoW / 2, photoY + 18, { align: 'center' })
  }

  const tableX = photoX + photoW + 4
  const tableW = PW - tableX - 12

  autoTable(doc, {
    startY: photoY,
    margin: { left: tableX, right: 12 },
    tableWidth: tableW,
    head: [['Field', 'Clinical Profile', 'Field', 'Clinical Profile']],
    body: [
      ['Name', cleanText(athlete.name) || '—', 'Sport / Position', `Football · ${athlete.position || '—'}`],
      ['Age / Sex', `${athlete.age ? `${athlete.age} yrs` : '—'} / ${athlete.sex || 'Male'}`, 'Level', cleanText(plan.level || 'Club / Elite')],
      ['Patient ID / Contact', `${athlete.back_number ? `#${athlete.back_number}  ` : ''}${athlete.phone || athlete.email || '—'}`, 'Date of Report', fmtDate(plan.report_date || meta.generatedAt)],
      ['Nationality', athlete.nationality || 'Ghana', 'Referred By', cleanText(plan.referred_by || 'Head Coach / Team Doctor')],
      ['Height / Weight', `${athlete.height ? `${athlete.height} cm` : '—'} / ${athlete.weight ? `${athlete.weight} kg` : '—'}`, 'Preferred Foot', athlete.preferred_foot || 'Right'],
      ['Club Status', athlete.status === 'Injured' ? 'In Rehabilitation' : 'Cleared / Active', 'Attending Physio', cleanText(plan.therapist_name || meta.generatedBy || 'Physiotherapist')],
    ],
    styles: { fontSize: 6.8, cellPadding: 1.6, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
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

  y = Math.max(photoY + photoH, doc.lastAutoTable.finalY) + 5

  // Section 2: Sports Injury Diagnosis
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('2. SPORTS INJURY DIAGNOSIS', 12, y)
  y += 3.5

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [[
      { content: 'DIAGNOSTIC CRITERIA & PATHOLOGY CLASSIFICATION', colSpan: 4 }
    ]],
    body: [
      [
        { content: 'Injury (structure & side):', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.structure_and_side) || '—', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Grade:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.grade) || 'Grade II', styles: { fontStyle: 'bold', textColor: AMBER } },
      ],
      [
        { content: 'Date of Injury:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: fmtDate(plan.date_of_injury), styles: { fontStyle: 'normal' } },
        { content: 'Mechanism:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: `${plan.mechanism_contact || 'Non-contact'}  •  ${plan.mechanism_timing || 'Acute'}`, styles: { fontStyle: 'normal' } },
      ],
      [
        { content: 'Stage:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.stage) || 'Sub-acute', styles: { fontStyle: 'normal' } },
        { content: 'Contributing Factors:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.contributing_factors) || 'Training load, surface, biomechanics', styles: { fontStyle: 'normal' } },
      ],
      [
        { content: 'Red Flags / Precautions:', styles: { fontStyle: 'bold', textColor: RED } },
        { content: cleanText(plan.red_flags) || 'None flagged; monitor neurovascular status', colSpan: 3, styles: { textColor: RED, fontStyle: 'bold' } },
      ],
      [
        { content: 'Clinical Impression:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.clinical_impression) || 'Sports injury under active clinical management.', colSpan: 3, styles: { textColor: TEXT } },
      ],
    ],
    styles: { fontSize: 6.8, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: SLATE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 51 },
      2: { cellWidth: 38 },
      3: { cellWidth: 55 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 5

  // Section 3: Baseline Assessment (Table)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('3. BASELINE ASSESSMENT (BILATERAL COMPARISON)', 12, y)
  y += 3.5

  const baselineRows = (plan.baseline || []).map(b => [
    cleanText(b.measure),
    cleanText(b.injured),
    cleanText(b.uninjured),
    cleanText(b.notes),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Measure', 'Injured Side', 'Uninjured Side', 'Clinical Notes / Deficit']],
    body: baselineRows,
    styles: { fontSize: 6.5, cellPadding: 1.6, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', textColor: TEXT2 },
      1: { cellWidth: 48, fontStyle: 'bold', textColor: NAVY },
      2: { cellWidth: 44, textColor: GREEN },
      3: { cellWidth: 42 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 5

  // Section 4: Rehabilitation Goals
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('4. REHABILITATION GOALS', 12, y)
  y += 3.5

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Time Horizon', 'Target Clinical Milestones & Return-to-Play Criteria']],
    body: [
      [
        { content: 'Short-term\n(1–4 weeks)', styles: { fontStyle: 'bold', textColor: TEAL, halign: 'center' } },
        { content: cleanText(plan.goal_short_term) || 'Control pain and swelling; restore full ROM; activate isometrics.' },
      ],
      [
        { content: 'Long-term\n(Full Clearance)', styles: { fontStyle: 'bold', textColor: GREEN, halign: 'center' } },
        { content: cleanText(plan.goal_long_term) || 'Full return to sport at pre-injury level; reduced re-injury risk (<5%).' },
      ],
    ],
    styles: { fontSize: 6.8, cellPadding: 2.0, font: 'helvetica' },
    headStyles: { fillColor: SLATE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: PW - 24 - 32 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 2: Section 5 (Rehabilitation Plan: 4 Phases) & Section 6
  // ───────────────────────────────────────────────────────────────────────────
  doc.addPage()
  renderPageHeader(2)
  y = 38

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('5. REHABILITATION PLAN (4-PHASE PROGRESSION FRAMEWORK)', 12, y)
  y += 3.5

  const phases = [plan.phase1, plan.phase2, plan.phase3, plan.phase4].filter(Boolean)

  phases.forEach((ph, idx) => {
    const isCompleted = ph.status === 'Completed'
    const isInProg    = ph.status === 'In Progress'
    const statusColor = isCompleted ? GREEN : (isInProg ? TEAL : SLATE)

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [[
        { content: `${ph.title || `Phase ${idx+1}`}`.toUpperCase(), colSpan: 2, styles: { fillColor: NAVY } },
        { content: `Duration: ${ph.duration || 'Weeks __ to __'}`, styles: { fillColor: NAVY, halign: 'center' } },
        { content: `Status: ${(ph.status || 'Active').toUpperCase()}`, styles: { fillColor: statusColor, halign: 'right', fontStyle: 'bold' } },
      ]],
      body: [
        [
          { content: 'Aim:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
          { content: cleanText(ph.aim) || '—', colSpan: 3 },
        ],
        [
          { content: 'Interventions:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
          { content: cleanText(ph.interventions) || '—', colSpan: 3 },
        ],
        [
          { content: 'Exercises (sets x reps):', styles: { fontStyle: 'bold', textColor: TEXT2 } },
          { content: cleanText(ph.exercises) || '—', colSpan: 3, styles: { fontStyle: 'bold', textColor: NAVY } },
        ],
        [
          { content: 'Progress When:', styles: { fontStyle: 'bold', textColor: GREEN } },
          { content: cleanText(ph.progress_when) || '—', colSpan: 3, styles: { textColor: GREEN } },
        ],
        ...(ph.notes ? [
          [
            { content: 'Notes / Progress:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
            { content: cleanText(ph.notes), colSpan: 3, styles: { textColor: SLATE } },
          ]
        ] : []),
      ],
      styles: { fontSize: 6.5, cellPadding: 1.6, font: 'helvetica', overflow: 'linebreak' },
      headStyles: { textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 60 },
        2: { cellWidth: 44 },
        3: { cellWidth: 44 },
      },
      tableLineColor: BORDER,
      tableLineWidth: 0.2,
    })
    y = doc.lastAutoTable.finalY + 4
  })

  // Section 6: Prevention and Maintenance
  y += 2
  if (y > PH - 45) { doc.addPage(); renderPageHeader(3); y = 38 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('6. PREVENTION AND MAINTENANCE', 12, y)
  y += 3.5

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Domain', 'Clinical Protocol & Long-Term Squad Maintenance']],
    body: [
      [
        { content: 'Warm-up routine', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.warmup_routine) || 'FIFA 11+ warm-up routine, dynamic mobility' },
      ],
      [
        { content: 'Strength & mobility', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.strength_maintenance) || 'Nordic hamstring curls, Copenhagen adductor, eccentric calf loading' },
      ],
      [
        { content: 'Load management', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.load_management) || 'ACWR tracking (0.8–1.3), GPS sprint distance management' },
      ],
      [
        { content: 'Recovery protocol', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.recovery) || 'Sleep hygiene (8+ hrs), post-match nutrition, active recovery, cold water therapy' },
      ],
    ],
    styles: { fontSize: 6.8, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: PW - 24 - 42 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 3: Sections 7, 8, 9 + Longitudinal Session Log
  // ───────────────────────────────────────────────────────────────────────────
  doc.addPage()
  renderPageHeader(3)
  y = 38

  // Section 7: Home Exercise Programme
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('7. HOME EXERCISE PROGRAMME (HEP)', 12, y)
  y += 3.5

  const hepRows = (plan.hep || []).map(h => [
    cleanText(h.exercise),
    cleanText(h.sets_reps),
    cleanText(h.frequency),
    cleanText(h.precautions),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Prescribed Exercise', 'Sets x Reps', 'Frequency', 'Precautions / Form Focus']],
    body: hepRows,
    styles: { fontSize: 6.6, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: 'bold', textColor: NAVY },
      1: { cellWidth: 38 },
      2: { cellWidth: 32 },
      3: { cellWidth: 62 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 5

  // Section 8: Review and Outcome Measures
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('8. REVIEW AND OUTCOME MEASURES', 12, y)
  y += 3.5

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [[
      { content: 'CLINICAL REVIEW & DISCHARGE PLANNING', colSpan: 4 }
    ]],
    body: [
      [
        { content: 'Sessions per week:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.sessions_per_week) || '3 sessions/week' },
        { content: 'Review Date:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: fmtDate(plan.review_date), styles: { fontStyle: 'bold', textColor: NAVY } },
      ],
      [
        { content: 'Outcome Measures:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.outcome_measures) || 'Pain (NRS), ROM, strength, hop tests, functional score', colSpan: 3 },
      ],
      [
        { content: 'Status Against Goals:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        { content: cleanText(plan.status_against_goals) || 'On track towards functional clearance milestones.', colSpan: 3 },
      ],
      [
        { content: 'Care Plan Recommendation:', styles: { fontStyle: 'bold', textColor: TEXT2 } },
        {
          content: `${cleanText(plan.clinical_plan || 'Continue Care').toUpperCase()}`,
          colSpan: 3,
          styles: {
            fontStyle: 'bold',
            textColor: (plan.clinical_plan || '').toLowerCase().includes('discharge') ? GREEN : TEAL,
          }
        },
      ],
    ],
    styles: { fontSize: 6.8, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: SLATE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 51 },
      2: { cellWidth: 38 },
      3: { cellWidth: 55 },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
  })

  y = doc.lastAutoTable.finalY + 6

  // Section 9: Sign-off
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text('9. CLINICAL SIGN-OFF & STAMP', 12, y)
  y += 3.5

  // Sign-off Card Box
  const signBoxH = 26
  doc.setFillColor(...LIGHT)
  doc.roundedRect(12, y, PW - 24, signBoxH, 2, 2, 'F')
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.4)
  doc.roundedRect(12, y, PW - 24, signBoxH, 2, 2, 'D')

  // Accent vertical pill
  doc.setFillColor(...TEAL)
  doc.roundedRect(12, y, 3, signBoxH, 1, 1, 'F')

  // Therapist details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text(`Therapist Name:  ${cleanText(plan.therapist_name) || 'Attending Physiotherapist'}`, 18, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...SLATE)
  doc.text(`Qualification:      ${cleanText(plan.therapist_qualification) || 'Licensed Sports Physical Therapist'}`, 18, y + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT2)
  doc.text(`Report Date:        ${fmtDate(plan.report_date || new Date())}`, 18, y + 16)

  // Signature line
  const sigX = 125
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(sigX, y + 15, PW - 20, y + 15)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(...TEAL)
  doc.text('AUTHORIZED PHYSIOTHERAPIST SIGNATURE & CLINICAL STAMP', sigX, y + 19)

  // Running footers across all pages
  const totalPages = doc.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const ph = doc.internal.pageSize.getHeight()

    doc.setFillColor(...NAVY)
    doc.rect(0, ph - 10, PW, 10, 'F')

    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text(
      `${(meta.clubName || athlete.club || 'CLUB').toUpperCase()}  •  SPORTS INJURY & REHABILITATION PLAN: ${(athlete.name || 'ATHLETE').toUpperCase()}  •  Page ${pg} of ${totalPages}`,
      PW / 2, ph - 3.8, { align: 'center' }
    )
  }

  return doc
}
