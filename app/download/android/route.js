import { NextResponse } from 'next/server'

const APK_URL = 'https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack.apk'

export async function GET() {
  return NextResponse.redirect(APK_URL, 302)
}
