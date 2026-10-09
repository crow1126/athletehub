/**
 * Mobile-Safe PDF & File Downloader
 * Works reliably on:
 * - iOS Safari & WKWebView (where <a download> is ignored and blob downloads fail silently)
 * - Android Chrome, Firefox, Samsung Internet, and Android WebView
 * - Capacitor / Cordova hybrid mobile shells
 * - Desktop Chrome, Safari, Firefox, Edge
 */
export function mobileSafeDownload(blobOrDoc, filename = 'document.pdf') {
  if (typeof window === 'undefined') return

  let blob
  if (blobOrDoc && typeof blobOrDoc.output === 'function') {
    blob = new Blob([blobOrDoc.output('arraybuffer')], { type: 'application/pdf' })
  } else if (blobOrDoc instanceof Blob) {
    blob = blobOrDoc
  } else if (blobOrDoc instanceof ArrayBuffer || blobOrDoc instanceof Uint8Array) {
    blob = new Blob([blobOrDoc], { type: 'application/pdf' })
  } else {
    console.error('Invalid document or blob passed to mobileSafeDownload', blobOrDoc)
    return
  }

  const ua = (navigator.userAgent || '').toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /android/.test(ua)
  const isCapacitor = !!(window.Capacitor)

  const url = URL.createObjectURL(blob)

  if (isIOS || (isAndroid && isCapacitor)) {
    // iOS Safari / WKWebView ignores the `download` attribute on blob URLs.
    // Opening it in a new window/tab displays the PDF viewer directly, where the
    // user can tap the native iOS Share sheet to "Save to Files", print, AirDrop, etc.
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else {
    // Desktop and Android standard browsers:
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Revoke object URL after delay so the browser has finished reading it
  setTimeout(() => {
    try { URL.revokeObjectURL(url) } catch {}
  }, 12000)
}
