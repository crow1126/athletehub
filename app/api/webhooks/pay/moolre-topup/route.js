// app/api/webhooks/pay/moolre-topup/route.js
// Handles Moolre payment confirmation for wallet top-ups
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/serverAuth'
import crypto from 'crypto'

export async function POST(req) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-moolre-signature') || req.headers.get('x-moolre-hmac') || ''

  // Verify signature if secret is configured
  if (process.env.MOOLRE_WEBHOOK_SECRET && sig) {
    const expected = crypto
      .createHmac('sha256', process.env.MOOLRE_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')
    if (sig !== expected) {
      console.warn('[pay/topup webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event
  try { event = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Verify secret in JSON payload
  if (process.env.MOOLRE_WEBHOOK_SECRET) {
    const payloadSecret = event.data?.secret || event.secret
    if (payloadSecret && payloadSecret !== process.env.MOOLRE_WEBHOOK_SECRET) {
      console.warn('[pay/topup webhook] Invalid webhook secret')
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }
  }

  console.log('[pay/topup webhook] Event status:', event?.status, 'code:', event?.code)

  // Success: Moolre status=1 or code P01
  if (event?.status === 1 || event?.code === 'P01') {
    const { externalref, reference, amount } = event.data || {}
    const paymentRef = externalref || reference

    if (!paymentRef) {
      console.error('[pay/topup webhook] Missing payment reference')
      return NextResponse.json({ received: true }) // acknowledge anyway
    }

    const db = createServiceClient()

    // Find the pending transaction
    const { data: txn } = await db.from('pay_transactions')
      .select('*, pay_wallets(id, team_id, balance)')
      .eq('reference', paymentRef)
      .eq('type', 'top_up')
      .maybeSingle()

    if (!txn) {
      console.warn('[pay/topup webhook] Transaction not found for ref:', paymentRef)
      return NextResponse.json({ received: true })
    }

    if (txn.status === 'success') {
      console.log('[pay/topup webhook] Already processed:', paymentRef)
      return NextResponse.json({ received: true })
    }

    const creditAmount = amount ? parseFloat(amount) : parseFloat(txn.amount)
    const wallet = txn.pay_wallets

    // Credit the wallet
    const { error: walletErr } = await db.from('pay_wallets').update({
      balance:    parseFloat(wallet.balance) + creditAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', wallet.id)

    if (walletErr) {
      console.error('[pay/topup webhook] Wallet credit error:', walletErr.message)
      return NextResponse.json({ error: walletErr.message }, { status: 500 })
    }

    // Mark transaction as success
    await db.from('pay_transactions').update({
      status:       'success',
      external_ref: paymentRef,
      updated_at:   new Date().toISOString(),
    }).eq('id', txn.id)

    console.log('[pay/topup webhook] Wallet credited GHS', creditAmount, 'for team:', wallet.team_id)
  }

  return NextResponse.json({ received: true })
}
