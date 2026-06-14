// app/api/pay/disburse/route.js
// Triggers bulk disbursement for an approved payroll run
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { initiateTransfer, normalizeGhPhone } from '@/lib/moolre'

const db = createServiceClient()
const PLATFORM_FEE_RATE = 0.01 // 1%

const MOOLRE_BASE_URL = (process.env.MOOLRE_BASE_URL || 'https://api.moolre.com').trim()
const IS_SANDBOX = MOOLRE_BASE_URL.includes('sandbox.moolre.com')

// Only call real Moolre API when explicitly pointed at sandbox.
// In dev/staging without sandbox URL, simulate locally to avoid accidental real transfers.
const SIMULATE = !IS_SANDBOX && (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_SIMULATION === 'true')

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

      if (SIMULATE) {
        // ── Simulator: instantly mark success (no Moolre call) ──
        itemStatus = 'success'
        statusMsg = 'Simulated disbursement'
        successCount++
        console.log(`[disburse] SIMULATED item ${item.id} (${item.name}): GHS ${item.total_amount}`)
      } else {
        const phone = normalizeGhPhone(item.phone)
        if (!phone) {
          itemStatus = 'failed'
          statusMsg = 'Invalid phone number'
          failCount++
          console.error(`[disburse] Invalid phone for ${item.name}: "${item.phone}"`)
        } else {
          console.log(`[disburse] Initiating transfer → ${item.name} | phone: ${phone} | amount: GHS ${item.total_amount} | ref: ${ref}`)
          const result = await initiateTransfer({
            amount:    item.total_amount,
            recipient: phone,
            reference: ref,
          })
          console.log(`[disburse] Moolre response for ${item.name}:`, JSON.stringify(result))
          if (result.ok) {
            itemStatus = 'processing' // Confirmed via Moolre webhook
            moolreRef = result.data?.reference || ref
            successCount++
          } else {
            itemStatus = 'failed'
            statusMsg = result.error
            failCount++
            console.error(`[disburse] Transfer FAILED for ${item.name}:`, result.error)
          }
        }
      }

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

    const moolreErrors = results
      .filter(r => r.status === 'failed' && r.statusMsg)
      .map(r => `${r.name}: "${r.statusMsg}"`)

    const debugEnv = {
      MOOLRE_BASE_URL,
      MOOLRE_API_USER:       process.env.MOOLRE_API_USER ? `set(${process.env.MOOLRE_API_USER.trim()})` : '(not set)',
      MOOLRE_SECRET_KEY_LEN: process.env.MOOLRE_SECRET_KEY?.length ?? 'not set',
      MOOLRE_SECRET_KEY_TRIMMED_LEN: process.env.MOOLRE_SECRET_KEY?.trim().length ?? 'not set',
      MOOLRE_API_KEY:        process.env.MOOLRE_API_KEY ? `set(len:${process.env.MOOLRE_API_KEY.length})` : '(not set)',
      MOOLRE_ACCOUNT_NUMBER: process.env.MOOLRE_ACCOUNT_NUMBER ? `set(${process.env.MOOLRE_ACCOUNT_NUMBER})` : '(not set)',
      moolre_errors: moolreErrors,
    }

    return NextResponse.json({ ok: true, successCount, failCount, results, simulated: SIMULATE, _debug: debugEnv })
  } catch (e) {
    console.error('[pay/disburse]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
