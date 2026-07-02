// app/api/pay/topup/verify/route.js
// Verifies top-up status directly with Moolre and updates DB state
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { verifyCharge } from '@/lib/moolre'
import { payLimiter } from '@/lib/rateLimit'
import log from '@/lib/logger'

const db = createServiceClient()

export async function POST(req) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json()
    const { reference } = body

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    // Fetch the pending transaction
    const { data: txn, error: txnErr } = await db.from('pay_transactions')
      .select('*, pay_wallets(id, team_id, balance)')
      .eq('reference', reference)
      .eq('type', 'top_up')
      .maybeSingle()

    if (txnErr || !txn) {
      log.warn('pay/topup/verify transaction not found', { reference })
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Auth check: User must belong to the team of this transaction/wallet
    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, txn.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // If transaction is already success, return early
    if (txn.status === 'success') {
      return NextResponse.json({
        ok: true,
        status: 'success',
        wallet_balance: txn.pay_wallets.balance,
        message: 'Payment already verified'
      })
    }

    // Otherwise, verify with Moolre
    log.info('pay/topup/verify: calling Moolre status API', { reference })
    const result = await verifyCharge(reference)

    if (!result.ok) {
      log.warn('pay/topup/verify: Moolre verification returned failure', { reference, error: result.error })
      return NextResponse.json({ error: result.error || 'Verification check failed' }, { status: 400 })
    }

    const payload = result.data
    const txStatus = payload?.txstatus ?? payload?.status

    // Check if successfully completed/paid
    // status=1 or txstatus=1 indicates successful/paid transaction
    if (txStatus === 1 || txStatus === '1' || result.code === 'SS01') {
      const amount = payload?.amount ?? payload?.value ?? txn.amount
      const creditAmount = parseFloat(amount)

      const wallet = txn.pay_wallets
      const newBalance = parseFloat(wallet.balance) + creditAmount

      // Credit the wallet in DB
      const { error: walletErr } = await db.from('pay_wallets').update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      }).eq('id', wallet.id)

      if (walletErr) {
        log.error('pay/topup/verify wallet credit error', { error: walletErr.message, wallet_id: wallet.id })
        return NextResponse.json({ error: walletErr.message }, { status: 500 })
      }

      // Mark transaction as success in DB
      await db.from('pay_transactions').update({
        status: 'success',
        external_ref: payload?.transactionid || null,
        updated_at: new Date().toISOString(),
      }).eq('id', txn.id)

      log.info('pay/topup/verify wallet credited successfully', { reference, creditAmount, newBalance, team_id: txn.team_id })

      return NextResponse.json({
        ok: true,
        status: 'success',
        wallet_balance: newBalance,
        message: `Successfully verified and credited GHS ${creditAmount.toFixed(2)} to wallet.`
      })
    } else {
      log.info('pay/topup/verify transaction is not successful on Moolre yet', { reference, txStatus })
      return NextResponse.json({
        ok: false,
        status: 'pending',
        message: 'Transaction is still pending'
      })
    }
  } catch (e) {
    log.error('pay/topup/verify unhandled exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
