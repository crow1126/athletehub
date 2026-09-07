import { NextResponse } from 'next/server'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKiVGNcwBQrFshg6dgzpFbAbhayE_2MXXb3x5C-oMGU61pxM0w2xPJiGER834qbOER0sN_KdSDt0nR35kS-b7vA'

export async function GET() {
  return NextResponse.json({ vapidKey: VAPID_PUBLIC_KEY })
}
