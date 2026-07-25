import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.redirect('https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack-Setup.exe')
}
