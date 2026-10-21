/**
 * Shared PDF logo & image utilities for all PDF generation modules.
 * Used by physioReport.js, and importable from reports/page.jsx when needed.
 */

/**
 * Fetches a remote or local image URL and converts it to a base64 Data URL
 * suitable for embedding in jsPDF via addImage().
 */
export async function getBase64ImageFromUrl(imageUrl) {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror  = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('[pdfLogos] Could not load image for PDF:', imageUrl, e)
    return null
  }
}

/**
 * Returns the ApexTrack GH platform logo as a base64 Data URL,
 * trying /logo.png first then falling back to /icons/icon-192.png.
 */
export async function getApexTrackLogoBase64() {
  let base64 = await getBase64ImageFromUrl('/logo.png')
  if (!base64) {
    base64 = await getBase64ImageFromUrl('/icons/icon-192.png')
  }
  return base64
}
