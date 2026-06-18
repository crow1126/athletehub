// app/api/pay/topup/route.js
// Wallet top-up — Moolre payment API removed.
// Use the simulation bypass for dev/test; wire a new payment provider here when ready.
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

const db = createServiceClient()

export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, amount_ghs, email } = body

    if (!team_id || !amount_ghs || !email) {
      return NextResponse.json({ error: 'team_id, amount_ghs, and email are required' }, { status: 400 })
    }

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Ensure wallet exists
    const { data: wallet } = await db.from('pay_wallets').select('id').eq('team_id', team_id).maybeSingle()
    if (!wallet) {
      await db.from('pay_wallets').insert({ team_id, balance: 0 })
    }

    const reference = `APAY-TOPUP-${team_id.slice(0, 8)}-${Date.now()}`

    // ── Simulation bypass ────────────────────────────────────────────────────
    if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION === 'true') {
      console.log('[pay/topup] Simulation mode — reference:', reference)
      return NextResponse.json({ ok: true, checkout_url: null, reference, simulated: true })
    }
    // ────────────────────────────────────────────────────────────────────────

    // Moolre payment API removed — return informative error until a replacement is wired
    return NextResponse.json(
      { error: 'Online wallet top-up is temporarily unavailable. Please contact support to top up manually.' },
      { status: 503 }
    )
  } catch (e) {
    console.error('[pay/topup]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
