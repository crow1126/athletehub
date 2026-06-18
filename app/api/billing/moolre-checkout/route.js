// app/api/billing/moolre-checkout/route.js
// Moolre payment checkout removed. This endpoint is no longer active.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Moolre payment checkout has been removed. Please use manual billing or contact support.' },
    { status: 410 } // 410 Gone
  )
}
