// lib/pdfTeamSheet.js
// Generates official broadcast-grade Matchday Team Sheet PDFs with Club Logo, Opponent Name, Starting XI, Bench, and Staff

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

async function getBase64ImageFromUrl(imageUrl) {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Error loading image for Team Sheet PDF:', e)
    return null
  }
}

export async function generateTeamSheetPDF({
  clubName = 'ApexTrack Club',
  clubLogoUrl = null,
  opponentName = 'Opponent Team',
  matchDate = '',
  kickoffTime = '15:00',
  venue = 'Main Stadium',
  competition = 'Official Match',
  meetingTime = '',
  startingXI = [],
  substitutes = [],
  headCoachName = 'Head Coach',
  medicalStaffName = 'Team Physio',
  formation = '',
  notes = '',
}) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // 1. Fetch Club and App logos
  const [siteLogoBase64, teamLogoBase64] = await Promise.all([
    getBase64ImageFromUrl('/logo.png'),
    clubLogoUrl ? getBase64ImageFromUrl(clubLogoUrl) : null,
  ])

  // ── Header Background Banner ──────────────────────────────────────────────
  doc.setFillColor(13, 148, 136) // #0D9488 (Emerald Teal)
  doc.rect(0, 0, pageWidth, 28, 'F')

  // Render Club Logo (Top Left)
  if (teamLogoBase64) {
    doc.addImage(teamLogoBase64, 'PNG', 12, 4, 20, 20)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(clubName.toUpperCase(), 36, 14)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('OFFICIAL MATCHDAY SQUAD SHEET', 36, 20)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(clubName.toUpperCase(), 14, 14)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('OFFICIAL MATCHDAY SQUAD SHEET', 14, 20)
  }

  // Render ApexTrack Watermark (Top Right)
  if (siteLogoBase64) {
    doc.addImage(siteLogoBase64, 'PNG', pageWidth - 32, 5, 20, 18)
  }

  // ── Match Header Information Card ─────────────────────────────────────────
  let y = 33
  doc.setFillColor(240, 253, 250) // #F0FDFA
  doc.roundedRect(12, y, pageWidth - 24, 26, 2.5, 2.5, 'F')
  doc.setDrawColor(153, 246, 228) // #99F6E4
  doc.setLineWidth(0.4)
  doc.roundedRect(12, y, pageWidth - 24, 26, 2.5, 2.5, 'D')

  // Match Fixture Title (e.g. ASANTE KOTOKO SC vs HEARTS OF OAK)
  doc.setTextColor(15, 23, 42) // #0F172A
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const fixtureTitle = `${clubName}  VS  ${opponentName || 'Opponent Team'}`.toUpperCase()
  doc.text(fixtureTitle, 16, y + 7)

  // Fixture Meta Details Grid
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)

  const dateFormatted = matchDate
    ? new Date(matchDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Matchday'

  doc.text(`Date: `, 16, y + 14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${dateFormatted}`, 26, y + 14)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`Kickoff: `, 72, y + 14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${kickoffTime || '15:00'}`, 84, y + 14)

  if (meetingTime) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Report: `, 115, y + 14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 148, 136)
    doc.text(`${meetingTime}`, 127, y + 14)
  }

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`Venue: `, 16, y + 21)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`${venue || 'Main Pitch'}`, 28, y + 21)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`Competition: `, 100, y + 21)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 148, 136)
  doc.text(`${competition || 'League Match'}`, 122, y + 21)

  y += 31

  // ── STARTING XI SECTION ───────────────────────────────────────────────────
  doc.setTextColor(13, 148, 136)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`STARTING ELEVEN (XI)${formation ? ` — FORMATION: ${formation}` : ''}`, 12, y)

  const startingData = startingXI.map((player, idx) => [
    idx + 1,
    player.back_number ? `#${player.back_number}` : '-',
    player.name || player.full_name || 'Player Name',
    player.position || 'Player',
    player.nationality || 'Ghanaian',
    player.is_captain ? 'CAPTAIN (C)' : '',
  ])

  // If less than 11 filled, pad with empty rows so coaches can write on clipboard
  if (startingData.length === 0) {
    for (let i = 1; i <= 11; i++) {
      startingData.push([i, '-', '—', '—', '—', ''])
    }
  }

  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'No.', 'Player Full Name', 'Pos.', 'Nationality', 'Notes']],
    body: startingData,
    theme: 'striped',
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 1.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 80, fontStyle: 'bold' },
      3: { cellWidth: 24 },
      4: { cellWidth: 32 },
      5: { cellWidth: 30, textColor: [13, 148, 136], fontStyle: 'bold' },
    },
    margin: { left: 12, right: 12 },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── SUBSTITUTES / BENCH SECTION ───────────────────────────────────────────
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`SUBSTITUTES & RESERVES (${substitutes.length} PLAYERS)`, 12, y)

  const subsData = substitutes.map((player, idx) => [
    idx + 12,
    player.back_number ? `#${player.back_number}` : '-',
    player.name || player.full_name || 'Player Name',
    player.position || 'Substitute',
    player.nationality || 'Ghanaian',
    '',
  ])

  if (subsData.length === 0) {
    subsData.push(['12', '-', 'No substitutes selected', '—', '—', ''])
  }

  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'No.', 'Substitute Name', 'Pos.', 'Nationality', 'Notes']],
    body: subsData,
    theme: 'grid',
    headStyles: {
      fillColor: [100, 116, 139],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 80 },
      3: { cellWidth: 24 },
      4: { cellWidth: 32 },
      5: { cellWidth: 30 },
    },
    margin: { left: 12, right: 12 },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── TECHNICAL STAFF & SIGN-OFF BOX ────────────────────────────────────────
  // Check if we have enough room on page, otherwise addPage
  if (y > pageHeight - 38) {
    doc.addPage()
    y = 15
  }

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(12, y, pageWidth - 24, 22, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(12, y, pageWidth - 24, 22, 2, 2, 'D')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('OFFICIAL TEAM OFFICIALS & SIGN-OFF', 16, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(`Head Coach: ${headCoachName || 'Head Coach'}`, 16, y + 11)
  doc.text(`Medical Lead: ${medicalStaffName || 'Physiotherapist'}`, 16, y + 17)

  // Signature lines on right
  doc.setTextColor(148, 163, 184)
  doc.text('Coach Signature: _______________________', pageWidth / 2 + 10, y + 11)
  doc.text('Match Official: _______________________', pageWidth / 2 + 10, y + 17)

  // ── FOOTER WATERMARK ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated by ApexTrack Football Management Platform — ${clubName} vs ${opponentName}`, 12, pageHeight - 6)
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth - 12, pageHeight - 6, { align: 'right' })

  const safeClub = clubName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeOpponent = (opponentName || 'Opponent').replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `${safeClub}_vs_${safeOpponent}_Team_Sheet.pdf`

  doc.save(filename)
  return filename
}
