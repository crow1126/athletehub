/**
 * Mobile-Safe File Downloader & Sharing Engine
 *
 * Supports:
 *   - iOS Safari (Share Sheet / Save to Files / Native PDF Viewer)
 *   - iOS WKWebView / Capacitor (Native Share Sheet)
 *   - Android Chrome & Firefox (Standard Download + Share Sheet)
 *   - Android WebView / Capacitor (Share Sheet & Fallback)
 *   - Desktop Chrome, Edge, Safari, Firefox, Electron (Direct Download)
 *
 * File Types: PDF, XLSX, CSV, images, and arbitrary binary blobs.
 */

function getBlob(blobOrDoc, filename) {
  if (!blobOrDoc) return null
  if (blobOrDoc instanceof Blob) return blobOrDoc

  if (typeof blobOrDoc === 'string') {
    if (blobOrDoc.startsWith('data:')) {
      try {
        const parts = blobOrDoc.split(',')
        const mimeMatch = parts[0].match(/:(.*?);/)
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
        const byteStr = atob(parts[1])
        const u8 = new Uint8Array(byteStr.length)
        for (let i = 0; i < byteStr.length; i++) u8[i] = byteStr.charCodeAt(i)
        return new Blob([u8], { type: mime })
      } catch (e) {
        console.warn('[pdfDownload] Failed parsing data URL:', e)
      }
    }
    const isCsv = filename?.toLowerCase().endsWith('.csv')
    return new Blob([blobOrDoc], { type: isCsv ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;' })
  }

  if (blobOrDoc instanceof ArrayBuffer || blobOrDoc instanceof Uint8Array) {
    const mime = getMimeType(filename)
    return new Blob([blobOrDoc], { type: mime })
  }

  if (typeof blobOrDoc.output === 'function') {
    return new Blob([blobOrDoc.output('arraybuffer')], { type: 'application/pdf' })
  }

  return null
}

function getMimeType(filename, blob) {
  if (blob?.type && blob.type !== 'application/octet-stream') return blob.type
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'xls': return 'application/vnd.ms-excel'
    case 'csv': return 'text/csv;charset=utf-8'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'txt': return 'text/plain;charset=utf-8'
    default: return 'application/octet-stream'
  }
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = (navigator.userAgent || '').toLowerCase()
  return /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /android/.test((navigator.userAgent || '').toLowerCase())
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = (navigator.userAgent || '').toLowerCase()
  return isIOS() || isAndroid() || /mobile|tablet|silk|kindle/i.test(ua)
}

function isCapacitorApp() {
  if (typeof window === 'undefined') return false
  return !!(window.Capacitor || window.capacitor)
}

/**
 * Creates and displays an elegant floating toast pill for saving, sharing, or previewing files.
 * Replaces the old full-screen dark modal sheet with a clean, lightweight floating action bar.
 */
function showMobileDownloadSheet(blob, filename, mimeType) {
  if (typeof document === 'undefined') return

  // Remove existing toast if present
  const existing = document.getElementById('apextrack-download-sheet')
  if (existing) {
    try { existing.remove() } catch {}
  }

  const url = URL.createObjectURL(blob)
  const sizeText = formatFileSize(blob.size)
  const isPdf = mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf')

  // Inject keyframe animation if not already present
  if (!document.getElementById('apextrack-toast-styles')) {
    const styleEl = document.createElement('style')
    styleEl.id = 'apextrack-toast-styles'
    styleEl.innerHTML = `
      @keyframes apexToastSlideIn {
        from { transform: translate(-50%, 20px) scale(0.96); opacity: 0; }
        to { transform: translate(-50%, 0) scale(1); opacity: 1; }
      }
    `
    document.head.appendChild(styleEl)
  }

  // Floating Pill Container — NO dark overlay, NO screen blur, strictly non-intrusive
  const toast = document.createElement('div')
  toast.id = 'apextrack-download-sheet'
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 460px;
    background: #0F172A;
    color: #F8FAFC;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(13, 148, 136, 0.3);
    padding: 12px 16px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: apexToastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `

  // File Icon + Title info
  const infoWrap = document.createElement('div')
  infoWrap.style.cssText = 'display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;'

  const iconEl = document.createElement('div')
  iconEl.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(13, 148, 136, 0.25);
    border: 1px solid rgba(13, 148, 136, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `
  iconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`

  const textWrap = document.createElement('div')
  textWrap.style.cssText = 'min-width: 0; flex: 1;'

  const titleEl = document.createElement('div')
  titleEl.style.cssText = 'font-size: 13px; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 6px;'
  titleEl.innerHTML = `<span>Ready to View</span> <span style="font-size: 10px; background: rgba(13,148,136,0.3); color: #2DD4BF; padding: 1px 6px; border-radius: 99px;">Saved</span>`

  const subEl = document.createElement('div')
  subEl.style.cssText = 'font-size: 11px; color: #94A3B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;'
  subEl.innerText = `${filename}${sizeText ? ` • ${sizeText}` : ''}`

  textWrap.appendChild(titleEl)
  textWrap.appendChild(subEl)
  infoWrap.appendChild(iconEl)
  infoWrap.appendChild(textWrap)

  // Action Buttons row
  const actionsWrap = document.createElement('div')
  actionsWrap.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;'

  // Preview Button
  if (isPdf) {
    const previewBtn = document.createElement('button')
    previewBtn.type = 'button'
    previewBtn.style.cssText = `
      background: #0D9488;
      background: linear-gradient(135deg, #0D9488, #059669);
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
    `
    previewBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview`
    previewBtn.onclick = () => {
      try {
        const win = window.open(url, '_blank')
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = url
        }
      } catch {
        window.location.href = url
      }
    }
    actionsWrap.appendChild(previewBtn)
  }

  // Share Button (Mobile / Web Share)
  if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
    const shareBtn = document.createElement('button')
    shareBtn.type = 'button'
    shareBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.08);
      color: #E2E8F0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    `
    shareBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`
    shareBtn.title = 'Share'
    shareBtn.onclick = async () => {
      try {
        const file = new File([blob], filename, { type: mimeType })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename })
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[pdfDownload] Share error:', err)
      }
    }
    actionsWrap.appendChild(shareBtn)
  }

  // Close Button
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #94A3B8;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  `
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  
  const cleanup = () => {
    try {
      toast.remove()
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 30000)
    } catch {}
  }

  closeBtn.onclick = cleanup
  actionsWrap.appendChild(closeBtn)

  toast.appendChild(infoWrap)
  toast.appendChild(actionsWrap)
  document.body.appendChild(toast)

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (document.getElementById('apextrack-download-sheet') === toast) {
      cleanup()
    }
  }, 8000)
}

/**
 * Universal Mobile-Safe File Downloader
 *
 * @param {Blob|Object|ArrayBuffer|string} blobOrDoc - jsPDF doc, Blob, ArrayBuffer, or string
 * @param {string} filename - Target filename (e.g. "team-sheet.pdf")
 * @param {string} [customMimeType] - Optional override MIME type
 */
export async function mobileSafeDownload(blobOrDoc, filename = 'document.pdf', customMimeType) {
  if (typeof window === 'undefined') return

  const blob = getBlob(blobOrDoc, filename)
  if (!blob) {
    console.error('[mobileSafeDownload] Invalid blob or document passed:', blobOrDoc)
    return
  }

  const mimeType = customMimeType || getMimeType(filename, blob)
  const isMobile = isMobileDevice() || isCapacitorApp()

  // 1. DESKTOP PATH:
  // For PDFs on desktop (analytics, medical, reports, etc.):
  // Open directly in a new tab so users can review the dossier/report and save or print via the native PDF viewer.
  if (!isMobile) {
    const url = URL.createObjectURL(blob)
    const isPdf = mimeType.includes('pdf') || (filename && filename.toLowerCase().endsWith('.pdf'))

    if (isPdf) {
      try {
        const win = window.open(url, '_blank')
        if (!win || win.closed || typeof win.closed === 'undefined') {
          // If browser popup blocker intervened, fallback to anchor download so the file is not lost
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          setTimeout(() => { try { document.body.removeChild(a) } catch {} }, 1000)
        }
      } catch (err) {
        console.warn('[pdfDownload] Failed window.open, fallback to download:', err)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { try { document.body.removeChild(a) } catch {} }, 1000)
      }

      // Allow 3 minutes for user to view, print, or click Save in the browser viewer before revoking
      setTimeout(() => {
        try { URL.revokeObjectURL(url) } catch {}
      }, 180000)
      return
    }

    // Non-PDF files (Excel .xlsx, CSV, etc.): trigger direct file download
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
      try { URL.revokeObjectURL(url) } catch {}
    }, 15000)
    return
  }

  // 2. MOBILE PATH (iOS Safari, Android Chrome, Capacitor WebViews):
  // Attempt immediate Web Share API if transient user activation is still intact.
  if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: mimeType })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        return // Successfully opened native share sheet!
      }
    } catch (err) {
      // If user dismissed native share sheet, they deliberately cancelled.
      if (err.name === 'AbortError') return
      // If NotAllowedError / SecurityError, the user gesture expired during async generation.
      // Fall through to show the Action Sheet modal!
    }
  }

  // 3. Automatic Download trigger across mobile & tablets
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { try { document.body.removeChild(a) } catch {} }, 1000)
  } catch {}

  // 4. Show the sleek non-intrusive floating toast pill (Preview / Share)
  showMobileDownloadSheet(blob, filename, mimeType)
}

/**
 * Pre-opens a blank window during a user click event to prevent popup blockers
 * from blocking long-running async PDF generation on desktop browsers.
 */
export function openDownloadWindow(title = 'Preparing Document…') {
  if (typeof window === 'undefined') return null
  if (isIOS() || isMobileDevice()) return null
  try {
    const win = window.open('', '_blank')
    if (win) {
      try {
        win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ApexTrack GH — ${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 36px 40px;
      text-align: center;
      max-width: 440px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      backdrop-filter: blur(12px);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin: 0 auto 18px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 17px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.01em; color: #fff; }
    p { font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5; }
    .badge {
      display: inline-block;
      margin-top: 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(13, 148, 136, 0.2);
      color: #2dd4bf;
      padding: 4px 12px;
      border-radius: 99px;
      border: 1px solid rgba(45, 212, 191, 0.3);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Generating Dossier &amp; Report…</h2>
    <p>Compiling high-resolution analytics and clinical data. Your document will load in this window automatically.</p>
    <div class="badge">ApexTrack GH Official Engine</div>
  </div>
</body>
</html>`)
      } catch (_e) {}
    }
    return win
  } catch {
    return null
  }
}

/**
 * Loads generated document into a pre-opened window or falls back safely.
 */
export async function mobileSafeDownloadIntoWindow(win, blobOrDoc, filename = 'document.pdf') {
  if (typeof window === 'undefined') return
  const blob = getBlob(blobOrDoc, filename)
  if (!blob) {
    if (win) try { win.close() } catch {}
    return
  }

  if (!win || isIOS() || isMobileDevice()) {
    if (win) try { win.close() } catch {}
    await mobileSafeDownload(blob, filename)
    return
  }

  try {
    const url = URL.createObjectURL(blob)
    win.location.href = url
    try { win.document.title = filename } catch {}
    setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 180000)
  } catch {
    try { win.close() } catch {}
    await mobileSafeDownload(blob, filename)
  }
}
