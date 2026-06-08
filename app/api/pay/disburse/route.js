// app/api/pay/disburse/route.js
// Triggers bulk disbursement for an approved payroll run
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { initiateTransfer, normalizeGhPhone } from '@/lib/moolre'

const db = createServiceClient()
const PLATFORM_FEE_RATE = 0.01 // 1%
const SIMULATE = process.env.NODE_ENV !== 'production' // mock mode in dev

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
      balance:    parseFloat(wallet.balance) - totalRequired,
      updated_at: new Date().toISOString(),
    }).eq('team_id', run.team_id)

    // Log platform fee transaction
    await db.from('pay_transactions').insert({
      team_id:        run.team_id,
      wallet_id:      wallet.id,
      type:           'fee',
      amount:         fee,
      status:         'success',
      reference:      `APAY-FEE-${payroll_run_id}-${Date.now()}`,
      payroll_run_id,
      metadata:       { fee_rate: PLATFORM_FEE_RATE, payroll_total: run.total_amount },
    })

    // Disburse each item
    let successCount = 0
    let failCount = 0
    const results = []

    for (const item of items) {
      const ref = `APAY-PAY-${item.id.slice(0, 8)}-${Date.now()}`
      let itemStatus  = 'processing'
      let moolreRef   = ref
      let statusMsg   = null

      if (SIMULATE) {
        // ── Sandbox simulator: instantly mark success ──
        itemStatus = 'success'
        statusMsg  = 'Simulated disbursement (dev mode)'
        successCount++
      } else {
        const phone = normalizeGhPhone(item.phone)
        if (!phone) {
          itemStatus = 'failed'
          statusMsg  = 'Invalid phone number'
          failCount++
        } else {
          const result = await initiateTransfer({
            amount:    item.total_amount,
            recipient: phone,
            reference: ref,
          })
          if (result.ok) {
            itemStatus = 'processing' // Will be confirmed via webhook
            moolreRef  = result.data?.reference || ref
            successCount++
          } else {
            itemStatus = 'failed'
            statusMsg  = result.error
            failCount++
          }
        }
      }

      // Update item status
      await db.from('pay_payroll_items').update({
        status:            itemStatus,
        moolre_ref:        moolreRef,
        moolre_status_msg: statusMsg,
        updated_at:        new Date().toISOString(),
      }).eq('id', item.id)

      // Log transaction
      await db.from('pay_transactions').insert({
        team_id:         run.team_id,
        wallet_id:       wallet.id,
        type:            'payout',
        amount:          item.total_amount,
        status:          itemStatus,
        reference:       moolreRef,
        payroll_run_id,
        payroll_item_id: item.id,
        metadata:        { recipient: item.name, phone: item.phone, simulated: SIMULATE },
      })

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
