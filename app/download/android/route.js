import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REPO = 'crow1126/athletehub'
const FALLBACK_URL = 'https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack.apk'

/**
 * GET /download/android
 * Resolves the direct CDN asset download link for the Android APK.
 */
export async function GET() {
  try {
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        'User-Agent': 'ApexTrack-Download-Router',
        'Accept': 'application/vnd.github.v3+json',
      },
      next: { revalidate: 300 },
    })

    if (!releaseRes.ok) {
      return NextResponse.redirect(FALLBACK_URL, 302)
    }

    const releaseData = await releaseRes.json()
    const apkAsset = releaseData.assets?.find(
      (a) => a.name?.toLowerCase().endsWith('.apk')
    )

    if (!apkAsset?.id) {
      return NextResponse.redirect(FALLBACK_URL, 302)
    }

    const assetRedirectRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${apkAsset.id}`,
      {
        headers: {
          'Accept': 'application/octet-stream',
          'User-Agent': 'ApexTrack-Download-Router',
        },
        redirect: 'manual',
      }
    )

    const directCdnUrl = assetRedirectRes.headers.get('location')
    if (directCdnUrl) {
      return NextResponse.redirect(directCdnUrl, 302)
    }

    return NextResponse.redirect(apkAsset.browser_download_url || FALLBACK_URL, 302)
  } catch (err) {
    console.error('Android download route error:', err)
    return NextResponse.redirect(FALLBACK_URL, 302)
  }
}
