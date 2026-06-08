// app/api/pay/dev-topup-confirm/route.js
// DEV-ONLY: instantly credits wallet for simulator mode (no Moolre call)
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/serverAuth'

export async function POST(req) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { reference, amount_ghs, team_id } = await req.json()
  if (!reference || !amount_ghs || !team_id) {
    return NextResponse.json({ error: 'reference, amount_ghs, and team_id required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Get or create wallet
  let { data: wallet } = await db.from('pay_wallets').select('*').eq('team_id', team_id).maybeSingle()
  if (!wallet) {
    const { data: w } = await db.from('pay_wallets').insert({ team_id, balance: 0 }).select().single()
    wallet = w
  }

  // Credit
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
      metadata:  { simulated: true },
    })
  }

  return NextResponse.json({ ok: true, credited: amount_ghs, new_balance: parseFloat(wallet.balance) + parseFloat(amount_ghs) })
}
