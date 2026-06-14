// app/api/pay/dev-topup-confirm/route.js
// SIMULATION ONLY: instantly credits wallet without real Moolre payment.
// Requires NEXT_PUBLIC_ENABLE_SIMULATION=true AND valid admin session.
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

export async function POST(req) {
  // Must be explicitly enabled — never runs silently in production
  if (process.env.NEXT_PUBLIC_ENABLE_SIMULATION !== 'true') {
    return NextResponse.json({ error: 'Simulation mode is not enabled' }, { status: 403 })
  }

  // Must be an authenticated team admin
  const db = createServiceClient()
  const requester = await getRequester(req, db)
  if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

  const { reference, amount_ghs, team_id } = await req.json()
  if (!reference || !amount_ghs || !team_id) {
    return NextResponse.json({ error: 'reference, amount_ghs, and team_id required' }, { status: 400 })
  }

  if (!canManageTeam(requester.profile, team_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get or create wallet
  let { data: wallet } = await db.from('pay_wallets').select('*').eq('team_id', team_id).maybeSingle()
  if (!wallet) {
    const { data: w } = await db.from('pay_wallets').insert({ team_id, balance: 0 }).select().single()
    wallet = w
  }

  // Credit wallet
  await db.from('pay_wallets').update({
    balance:    parseFloat(wallet.balance) + parseFloat(amount_ghs),
    updated_at: new Date().toISOString(),
  }).eq('id', wallet.id)

  // Mark or create transaction as success
  const { data: txn } = await db.from('pay_transactions')
    .select('id').eq('reference', reference).maybeSingle()

  if (txn) {
    await db.from('pay_transactions').update({ status: 'success', updated_at: new Date().toISOString() }).eq('id', txn.id)
  } else {
    await db.from('pay_transactions').insert({
      team_id,
      wallet_id: wallet.id,
      type:      'top_up',
      amount:    parseFloat(amount_ghs),
      status:    'success',
      reference,
      metadata:  { simulated: true, initiated_by: requester.profile.id },
    })
  }

  return NextResponse.json({
    ok: true,
    credited: amount_ghs,
    new_balance: parseFloat(wallet.balance) + parseFloat(amount_ghs),
  })
}
