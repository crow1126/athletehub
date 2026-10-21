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
 * Creates and displays an elegant mobile Bottom Sheet for saving or viewing files.
 * This guarantees a synchronous user tap which is required by iOS Safari & Android
 * to trigger Web Share API, window.open, or download after long async file generation.
 */
function showMobileDownloadSheet(blob, filename, mimeType) {
  if (typeof document === 'undefined') return

  // Remove existing sheet if present
  const existing = document.getElementById('apextrack-download-sheet')
  if (existing) {
    try { existing.remove() } catch {}
  }

  const url = URL.createObjectURL(blob)
  const sizeText = formatFileSize(blob.size)
  const isPdf = mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf')

  const overlay = document.createElement('div')
  overlay.id = 'apextrack-download-sheet'
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding: 0 16px;
    animation: apextrackFadeIn 0.2s ease-out;
  `

  const sheet = document.createElement('div')
  sheet.style.cssText = `
    width: 100%;
    max-width: 480px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
    padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `

  // Header row
  const header = document.createElement('div')
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `

  const iconAndInfo = document.createElement('div')
  iconAndInfo.style.cssText = 'display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;'

  const iconBadge = document.createElement('div')
  iconBadge.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(13, 148, 136, 0.2);
    border: 1px solid rgba(13, 148, 136, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  `
  const fileIconSvg = isPdf
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
    : filename.endsWith('.xlsx')
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect width="4" height="7" x="7" y="10" rx="1"/><rect width="4" height="12" x="15" y="5" rx="1"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
  iconBadge.innerHTML = fileIconSvg

  const infoText = document.createElement('div')
  infoText.style.cssText = 'min-width: 0; flex: 1;'

  const title = document.createElement('div')
  title.style.cssText = 'font-size: 15px; font-weight: 700; color: #ffffff;'
  title.innerText = 'Document Ready'

  const nameSub = document.createElement('div')
  nameSub.style.cssText = 'font-size: 12px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;'
  nameSub.innerText = `${filename}${sizeText ? ` • ${sizeText}` : ''}`

  infoText.appendChild(title)
  infoText.appendChild(nameSub)
  iconAndInfo.appendChild(iconBadge)
  iconAndInfo.appendChild(infoText)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  header.appendChild(iconAndInfo)
  header.appendChild(closeBtn)

  // Actions row
  const actions = document.createElement('div')
  actions.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 4px;'

  // Primary Button: Native Share / Save to Files
  const shareBtn = document.createElement('button')
  shareBtn.type = 'button'
  shareBtn.style.cssText = `
    width: 100%;
    background: #0d9488;
    background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
    color: #ffffff;
    border: none;
    border-radius: 14px;
    padding: 14px 18px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4);
  `
  shareBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> <span>Save to Files / Share</span>`

  // Secondary Button: View in Browser (if PDF or text)
  let viewBtn = null
  if (isPdf) {
    viewBtn = document.createElement('button')
    viewBtn.type = 'button'
    viewBtn.style.cssText = `
      width: 100%;
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `
    viewBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> <span>View / Preview Document</span>`
  }

  actions.appendChild(shareBtn)
  if (viewBtn) actions.appendChild(viewBtn)

  sheet.appendChild(header)
  sheet.appendChild(actions)
  overlay.appendChild(sheet)

  const cleanup = () => {
    try {
      overlay.remove()
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 30000)
    } catch {}
  }

  closeBtn.onclick = cleanup
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup()
  }

  // Handle Share / Save click
  shareBtn.onclick = async () => {
    // Attempt Web Share API with fresh user gesture
    if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
      try {
        const file = new File([blob], filename, { type: mimeType })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
          })
          cleanup()
          return
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // User dismissed native share sheet, leave modal for them to retry or preview
          return
        }
        console.warn('[pdfDownload] Share sheet error:', err)
      }
    }

    // Fallback: standard anchor download or direct window open
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { try { document.body.removeChild(a) } catch {} }, 1000)
    } catch {
      window.open(url, '_blank')
    }
  }

  // Handle View / Preview click
  if (viewBtn) {
    viewBtn.onclick = () => {
      try {
        const win = window.open(url, '_blank')
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = url
        }
      } catch {
        window.location.href = url
      }
    }
  }

  document.body.appendChild(overlay)

  // Auto dismiss after 60 seconds of inactivity
  setTimeout(() => {
    if (document.getElementById('apextrack-download-sheet') === overlay) {
      cleanup()
    }
  }, 60000)
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

  // 3. Android fast-path:
  // In standard Android browsers, trigger an anchor click directly as well.
  if (isAndroid() && !isCapacitorApp()) {
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
  }

  // 4. Show the Mobile Download Sheet:
  // This guarantees a clean, synchronous tap for iOS Safari and Android WebViews
  // to save to Files or open in browser with zero blocked popups.
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
