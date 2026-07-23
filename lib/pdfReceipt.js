import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Helper to convert an image URL or path to a base64 data URL
async function getBase64ImageFromUrl(imageUrl) {
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
    console.error('Error fetching image for PDF:', e)
    return null
  }
}

const fmtGHS = (val) => `GHS ${Number(val || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function generatePayrollReceiptPDF({ run, items, team }) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Load Site & Team logos
  const siteLogoBase64 = await getBase64ImageFromUrl('/logo.png')
  let teamLogoBase64 = null
  if (team?.logo_url) {
    teamLogoBase64 = await getBase64ImageFromUrl(team.logo_url)
  }

  // Header background banner
  doc.setFillColor(11, 122, 112) // #0B7A70
  doc.rect(0, 0, pageWidth, 28, 'F')

  // Render Site Logo (Top Left)
  if (siteLogoBase64) {
    doc.addImage(siteLogoBase64, 'PNG', 12, 4, 38, 20)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ApexTrack', 14, 16)
  }

  // Render Team Logo & Team Name (Top Right)
  if (teamLogoBase64) {
    doc.addImage(teamLogoBase64, 'PNG', pageWidth - 26, 4, 18, 18)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(team?.name || 'Club Payroll', pageWidth - 29, 15, { align: 'right' })
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(team?.name || 'Club Payroll', pageWidth - 14, 15, { align: 'right' })
  }

  // Title & Reference Block
  let y = 36
  doc.setTextColor(11, 30, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('OFFICIAL PAYROLL RECEIPT', 14, y)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Reference: ${run.id || 'N/A'}`, pageWidth - 14, y, { align: 'right' })

  y += 7
  doc.setFontSize(11)
  doc.setTextColor(36, 62, 48)
  doc.setFont('helvetica', 'bold')
  doc.text(`Run Description: ${run.description}`, 14, y)

  y += 8
  // Metadata box
  doc.setFillColor(240, 251, 244)
  doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, 'F')
  doc.setDrawColor(130, 194, 154)
  doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, 'D')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(16, 42, 28)

  const createdDate = new Date(run.created_at || Date.now()).toLocaleString('en-GB')
  const approvedDate = run.approved_at ? new Date(run.approved_at).toLocaleString('en-GB') : 'N/A'
  const createdBy = run.created_by_profile?.full_name || 'Administrator'
  const status = (run.status || 'completed').toUpperCase()

  doc.text(`Created Date: ${createdDate}`, 18, y + 6)
  doc.text(`Authorized By: ${createdBy}`, 18, y + 12)
  doc.text(`Status: ${status}`, 18, y + 18)

  doc.text(`Approved Date: ${approvedDate}`, pageWidth / 2 + 10, y + 6)
  doc.text(`Payout Provider: Moolre MoMo`, pageWidth / 2 + 10, y + 12)
  doc.text(`Total Recipients: ${items.length}`, pageWidth / 2 + 10, y + 18)

  y += 28

  // Recipients Table
  const tableData = items.map((item, index) => [
    index + 1,
    item.name,
    item.recipient_type ? item.recipient_type.toUpperCase() : 'MEMBER',
    item.phone ? `****${String(item.phone).slice(-4)}` : '—',
    fmtGHS(item.base_salary),
    fmtGHS(item.bonus),
    fmtGHS(item.allowance),
    fmtGHS(item.total_amount),
    (item.status || 'PAID').toUpperCase(),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Recipient Name', 'Role', 'MoMo Phone', 'Base Salary', 'Bonus', 'Allow.', 'Net Payout', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [11, 122, 112],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [11, 30, 20],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 20 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // Financial Summary Box
  const subtotal = Number(run.total_amount || 0)
  const fee = parseFloat((subtotal * 0.01).toFixed(2))
  const grandTotal = subtotal + fee

  doc.setFillColor(226, 245, 233)
  doc.roundedRect(pageWidth - 94, y, 80, 32, 2, 2, 'F')
  doc.setDrawColor(130, 194, 154)
  doc.roundedRect(pageWidth - 94, y, 80, 32, 2, 2, 'D')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(36, 62, 48)

  doc.text('Payroll Subtotal:', pageWidth - 90, y + 7)
  doc.text(fmtGHS(subtotal), pageWidth - 18, y + 7, { align: 'right' })

  doc.text('Platform Fee (1%):', pageWidth - 90, y + 15)
  doc.text(fmtGHS(fee), pageWidth - 18, y + 15, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(11, 122, 112)
  doc.text('Total Wallet Deduction:', pageWidth - 90, y + 25)
  doc.text(fmtGHS(grandTotal), pageWidth - 18, y + 25, { align: 'right' })

  // Footer & Watermark
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('This is an electronically generated payroll receipt issued by ApexPay.', 14, pageHeight - 12)
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')} — Page 1 of 1`, pageWidth - 14, pageHeight - 12, { align: 'right' })

  const filename = `Payroll-Receipt-${(run.description || 'run').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(filename)
}

export async function generateSingleReceiptPDF({ item, run, team, transaction }) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const siteLogoBase64 = await getBase64ImageFromUrl('/logo.png')
  let teamLogoBase64 = null
  if (team?.logo_url) {
    teamLogoBase64 = await getBase64ImageFromUrl(team.logo_url)
  }

  // Header banner
  doc.setFillColor(11, 122, 112)
  doc.rect(0, 0, pageWidth, 24, 'F')

  if (siteLogoBase64) {
    doc.addImage(siteLogoBase64, 'PNG', 8, 3, 30, 17)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('ApexTrack', 10, 14)
  }

  if (teamLogoBase64) {
    doc.addImage(teamLogoBase64, 'PNG', pageWidth - 20, 3, 15, 15)
  }

  let y = 32
  doc.setTextColor(11, 30, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('DISBURSEMENT RECEIPT', pageWidth / 2, y, { align: 'center' })

  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Ref: ${transaction?.reference || item?.moolre_ref || item?.id || 'N/A'}`, pageWidth / 2, y, { align: 'center' })

  y += 10
  // Recipient Card
  doc.setFillColor(240, 251, 244)
  doc.roundedRect(10, y, pageWidth - 20, 75, 3, 3, 'F')
  doc.setDrawColor(130, 194, 154)
  doc.roundedRect(10, y, pageWidth - 20, 75, 3, 3, 'D')

  let iy = y + 8
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('RECIPIENT DETAILS', 14, iy)
  iy += 6

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(11, 30, 20)
  doc.text(item?.name || transaction?.name || 'Recipient', 14, iy)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`Mobile Money Phone: ${item?.phone || '—'}`, 14, iy + 5)
  doc.text(`Role / Type: ${(item?.recipient_type || 'Athlete').toUpperCase()}`, 14, iy + 10)
  doc.text(`Club: ${team?.name || 'Club'}`, 14, iy + 15)

  iy += 24
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('PAYMENT BREAKDOWN', 14, iy)
  iy += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(16, 42, 28)
  doc.text('Base Salary:', 14, iy)
  doc.text(fmtGHS(item?.base_salary), pageWidth - 14, iy, { align: 'right' })

  iy += 5
  doc.text('Contract Bonus:', 14, iy)
  doc.text(fmtGHS(item?.bonus), pageWidth - 14, iy, { align: 'right' })

  iy += 5
  doc.text('Allowances:', 14, iy)
  doc.text(fmtGHS(item?.allowance), pageWidth - 14, iy, { align: 'right' })

  iy += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(4, 120, 87)
  doc.text('TOTAL PAID:', 14, iy)
  doc.text(fmtGHS(item?.total_amount || transaction?.amount), pageWidth - 14, iy, { align: 'right' })

  y += 82
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Description: ${run?.description || 'Mobile Money Payout'}`, 10, y)
  doc.text(`Date: ${new Date(item?.created_at || Date.now()).toLocaleString('en-GB')}`, 10, y + 5)
  doc.text(`Status: ${(item?.status || transaction?.status || 'SUCCESS').toUpperCase()}`, 10, y + 10)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.text('Official digital payout voucher verified by ApexPay System.', pageWidth / 2, pageHeight - 8, { align: 'center' })

  const filename = `Receipt-${(item?.name || 'payout').replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}
