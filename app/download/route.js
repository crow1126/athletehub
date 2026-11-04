import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REPO = 'crow1126/athletehub'
const FALLBACK_URL = 'https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack-Setup.exe'

/**
 * GET /download
 * Resolves the direct CDN asset download link (bypassing github.com web session / 2FA verification gates).
 * Redirects the user directly to CDN storage with proper Content-Disposition attachment headers.
 */
export async function GET() {
  try {
    // 1. Query the latest release assets via GitHub API
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        'User-Agent': 'ApexTrack-Download-Router',
        'Accept': 'application/vnd.github.v3+json',
      },
      next: { revalidate: 300 }, // cache release lookup for 5 minutes
    })

    if (!releaseRes.ok) {
      return NextResponse.redirect(FALLBACK_URL, 302)
    }

    const releaseData = await releaseRes.json()
    const exeAsset = releaseData.assets?.find(
      (a) => a.name?.toLowerCase().endsWith('.exe')
    )

    if (!exeAsset?.id) {
      return NextResponse.redirect(FALLBACK_URL, 302)
    }

    // 2. Request the asset with octet-stream to get GitHub's direct CDN storage URL (release-assets / objects)
    const assetRedirectRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${exeAsset.id}`,
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

    // If no direct CDN location header was returned, fallback to browser_download_url
    return NextResponse.redirect(exeAsset.browser_download_url || FALLBACK_URL, 302)
  } catch (err) {
    console.error('Download route resolution error:', err)
    return NextResponse.redirect(FALLBACK_URL, 302)
  }
}
