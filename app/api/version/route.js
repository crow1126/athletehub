import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/version
 * Returns the current build ID and app version.
 * Used by the Electron desktop app to detect when a new web release is deployed
 * and trigger an automatic reload to pull the latest build.
 */
export async function GET() {
  return NextResponse.json({
    buildId: process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()),
    version: process.env.npm_package_version || '1.0.5',
  })
}
