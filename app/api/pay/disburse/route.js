// app/api/pay/disburse/route.js
// Triggers bulk disbursement for an approved payroll run
// NOTE: Moolre disbursement API removed — simulation mode only until a new provider is wired.
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

const db = createServiceClient()
const PLATFORM_FEE_RATE = 0.01 // 1%

// Disbursement is simulation-only until a payment provider is re-wired.
const SIMULATE = true

export async function POST(req) {
  try {
    const { payroll_run_id } = await req.json()
    if (!payroll_run_id) return NextResponse.json({ error: 'payroll_run_id required' }, { status: 400 })

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    // Fetch run
    const { data: run, error: runErr } = await db.from('pay_payroll_runs')
      .select('*').eq('id', payroll_run_id).single()
    if (runErr || !run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (!canManageTeam(requester.profile, run.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (run.status !== 'approved') {
      return NextResponse.json({ error: `Payroll run must be approved first (current: ${run.status})` }, { status: 400 })
    }

    // Fetch items
    const { data: items } = await db.from('pay_payroll_items')
      .select('*').eq('payroll_run_id', payroll_run_id).eq('status', 'pending')
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No pending payroll items to disburse' }, { status: 400 })
    }

    // Fetch wallet
    const { data: wallet } = await db.from('pay_wallets').select('*').eq('team_id', run.team_id).single()
    const fee = parseFloat((run.total_amount * PLATFORM_FEE_RATE).toFixed(2))
    const totalRequired = run.total_amount + fee

    if (!wallet || wallet.balance < totalRequired) {
      return NextResponse.json({
        error: `Insufficient balance. Need GHS ${totalRequired.toFixed(2)}, have GHS ${(wallet?.balance || 0).toFixed(2)}`,
      }, { status: 400 })
    }

    // Mark run as processing
    await db.from('pay_payroll_runs').update({ status: 'processing' }).eq('id', payroll_run_id)

    // Deduct wallet balance
    await db.from('pay_wallets').update({
      balance: parseFloat(wallet.balance) - totalRequired,
      updated_at: new Date().toISOString(),
    }).eq('team_id', run.team_id)

    // Log platform fee transaction
    await db.from('pay_transactions').insert({
      team_id: run.team_id,
      wallet_id: wallet.id,
      type: 'fee',
      amount: fee,
      status: 'success',
      reference: `APAY-FEE-${payroll_run_id}-${Date.now()}`,
      payroll_run_id,
      metadata: { fee_rate: PLATFORM_FEE_RATE, payroll_total: run.total_amount },
    })

    // Disburse each item
    let successCount = 0
    let failCount = 0
    const results = []

    for (const item of items) {
      const ref = `APAY-PAY-${item.id.slice(0, 8)}-${Date.now()}`
      let itemStatus = 'processing'
      let moolreRef = ref
      let statusMsg = null

      // ── Simulation only — no live transfer provider wired yet ──────────
      itemStatus = 'success'
      statusMsg = 'Simulated disbursement'
      successCount++
      console.log(`[disburse] SIMULATED item ${item.id} (${item.name}): GHS ${item.total_amount}`)

      // Update item status
      await db.from('pay_payroll_items').update({
        status: itemStatus,
        moolre_ref: moolreRef,
        moolre_status_msg: statusMsg,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)

      // Log transaction
      await db.from('pay_transactions').insert({
        team_id: run.team_id,
        wallet_id: wallet.id,
        type: 'payout',
        amount: item.total_amount,
        status: itemStatus,
        reference: moolreRef,
        payroll_run_id,
        payroll_item_id: item.id,
        metadata: { recipient: item.name, phone: item.phone, simulated: SIMULATE },
      })

      if (itemStatus === 'failed') {
        const itemFee = parseFloat((item.total_amount * PLATFORM_FEE_RATE).toFixed(2))
        const refundAmount = item.total_amount + itemFee

        // Refund wallet
        const { data: w } = await db.from('pay_wallets').select('balance').eq('id', wallet.id).single()
        if (w) {
          await db.from('pay_wallets').update({
            balance: parseFloat(w.balance) + refundAmount,
            updated_at: new Date().toISOString(),
          }).eq('id', wallet.id)
        }

        // Log refund transaction
        await db.from('pay_transactions').insert({
          team_id: run.team_id,
          wallet_id: wallet.id,
          type: 'refund',
          amount: refundAmount,
          status: 'success',
          reference: `APAY-REFUND-${item.id.slice(0, 8)}-${Date.now()}`,
          payroll_run_id,
          payroll_item_id: item.id,
          metadata: { reason: statusMsg || 'Transfer failed', original_item_amount: item.total_amount, refunded_fee: itemFee },
        })
      }

      results.push({ id: item.id, name: item.name, status: itemStatus, statusMsg })
    }

    // Update run to completed / partial fail
    const finalStatus = failCount === 0 ? 'completed' : successCount > 0 ? 'completed' : 'failed'
    await db.from('pay_payroll_runs').update({ status: finalStatus }).eq('id', payroll_run_id)

    return NextResponse.json({ ok: true, successCount, failCount, results, simulated: SIMULATE })
  } catch (e) {
    console.error('[pay/disburse]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
