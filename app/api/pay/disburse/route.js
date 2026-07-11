// app/api/pay/disburse/route.js
// Triggers bulk disbursement for an approved payroll run
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { initiateTransfer, normalizeGhPhone, getWalletBalance, MOOLRE_BASE_URL, IS_SANDBOX } from '@/lib/moolre'
import { payLimiter } from '@/lib/rateLimit'
import { sanitizeUUID } from '@/lib/sanitize'
import log from '@/lib/logger'

const db = createServiceClient()
const PLATFORM_FEE_RATE = 0.01 // 1%

/**
 * computeEntitlement — calculates the maximum a team is allowed to disburse
 * based purely on their own confirmed top-up deposits minus all outflows
 * (successful payouts, fees, AND pending/processing payouts).
 *
 * This ensures that even if the DB wallet balance has drifted upward
 * (e.g. double-credit bug), clubs can never disburse more than they
 * themselves deposited — preventing cross-club fund leakage in the shared
 * Moolre account.
 *
 * @returns {{ ok: boolean, allowedBalance: number, totalDeposited: number,
 *             totalOut: number, error?: string }}
 */
async function computeEntitlement(team_id) {
  const { data: txns, error } = await db
    .from('pay_transactions')
    .select('type, amount, status')
    .eq('team_id', team_id)

  if (error) {
    return { ok: false, error: `Could not fetch transactions for reconciliation: ${error.message}` }
  }

  const rows = txns || []

  // Sum of all successfully credited top-ups for this team
  const totalDeposited = rows
    .filter(t => t.type === 'top_up' && t.status === 'success')
    .reduce((s, t) => s + Number(t.amount), 0)

  // Sum of all confirmed + in-flight outflows (payouts + fees)
  // processing payouts are counted as already out — safe default
  const totalOut = rows
    .filter(t =>
      ['payout', 'fee'].includes(t.type) &&
      ['success', 'processing'].includes(t.status)
    )
    .reduce((s, t) => s + Number(t.amount), 0)

  const allowedBalance = parseFloat((totalDeposited - totalOut).toFixed(2))

  return { ok: true, allowedBalance, totalDeposited, totalOut }
}

// Only call real Moolre API when explicitly pointed at sandbox.
// In dev/staging without sandbox URL, simulate locally to avoid accidental real transfers.
const SIMULATE = !IS_SANDBOX && (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_SIMULATION === 'true')

export async function POST(req) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json()
    const payroll_run_id = sanitizeUUID(body.payroll_run_id)
    if (!payroll_run_id) return NextResponse.json({ error: 'Valid payroll_run_id (UUID) is required' }, { status: 400 })

    // Diagnostic logging for keys in production Vercel logs
    const k1 = process.env.MOOLRE_SECRET_KEY?.trim()
    const k2 = process.env.MOOLRE_API_KEY?.trim()
    const pub = process.env.MOOLRE_PUBLIC_KEY?.trim()
    const user = process.env.MOOLRE_API_USER?.trim()
    console.log('[disburse env diagnostic] env check:', {
      base_url: MOOLRE_BASE_URL,
      user,
      has_k1: !!k1,
      has_k2: !!k2,
      k1_snippet: k1 ? `${k1.substring(0, 5)}...${k1.substring(k1.length - 5)}` : 'none',
      k2_snippet: k2 ? `${k2.substring(0, 5)}...${k2.substring(k2.length - 5)}` : 'none',
      pub_snippet: pub ? `${pub.substring(0, 5)}...${pub.substring(pub.length - 5)}` : 'none',
    })

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

    // ── DB balance guard ───────────────────────────────────────────────────────
    if (!wallet || wallet.balance < totalRequired) {
      return NextResponse.json({
        error: `Insufficient balance. Need GHS ${totalRequired.toFixed(2)}, have GHS ${(wallet?.balance || 0).toFixed(2)}`,
      }, { status: 400 })
    }

    // ── Per-club entitlement reconciliation ───────────────────────────────────
    // Each club can only disburse funds THEY deposited via top-up.
    // Since all clubs share one physical Moolre account, we compute
    // allowedBalance = SUM(their successful top-ups) - SUM(their outflows).
    // If wallet.balance > allowedBalance, the DB has drifted (double-credit
    // bug, manual edit, etc.) and we block to protect other clubs' funds.
    const entitlement = await computeEntitlement(run.team_id)
    if (!entitlement.ok) {
      log.error('disburse: reconciliation query failed', { team_id: run.team_id, error: entitlement.error })
      return NextResponse.json({
        error: `Internal error during balance reconciliation. Please contact support.`,
      }, { status: 500 })
    }

    const { allowedBalance, totalDeposited, totalOut } = entitlement

    if (wallet.balance > allowedBalance + 0.01) {
      // DB balance is higher than what deposits justify — drift detected.
      // Block completely and log for admin investigation.
      log.error('disburse: BALANCE DRIFT DETECTED — blocking disbursement to protect other clubs', {
        team_id:        run.team_id,
        wallet_balance: wallet.balance,
        allowedBalance,
        totalDeposited,
        totalOut,
        drift_amount:   parseFloat((wallet.balance - allowedBalance).toFixed(2)),
      })
      return NextResponse.json({
        error:
          `Wallet balance discrepancy detected. Your recorded balance (GHS ${wallet.balance.toFixed(2)}) ` +
          `exceeds your deposit entitlement (GHS ${allowedBalance.toFixed(2)}). ` +
          `Disbursements are blocked until this is resolved. Please contact admin@apextrackgh.com.`,
        code: 'BALANCE_DRIFT',
      }, { status: 400 })
    }

    if (totalRequired > allowedBalance) {
      log.warn('disburse: entitlement insufficient', {
        team_id:      run.team_id,
        totalRequired,
        allowedBalance,
        totalDeposited,
        totalOut,
      })
      return NextResponse.json({
        error:
          `Insufficient deposited funds. You need GHS ${totalRequired.toFixed(2)} ` +
          `but your deposit entitlement is GHS ${allowedBalance.toFixed(2)} ` +
          `(Total deposited: GHS ${totalDeposited.toFixed(2)}, Already disbursed/pending: GHS ${totalOut.toFixed(2)}). ` +
          `Please top up your wallet before disbursing.`,
        code: 'ENTITLEMENT_EXCEEDED',
      }, { status: 400 })
    }

    log.info('disburse: entitlement check passed', {
      team_id: run.team_id,
      allowedBalance,
      totalRequired,
      headroom: parseFloat((allowedBalance - totalRequired).toFixed(2)),
    })

    // ── Live Moolre pre-flight balance check (skip in simulation mode) ─────────
    if (!SIMULATE) {
      const liveBalance = await getWalletBalance()
      if (!liveBalance.ok) {
        log.warn('disburse: could not fetch live Moolre balance — proceeding with DB balance only', { error: liveBalance.error })
      } else if (liveBalance.balance < totalRequired) {
        log.error('disburse: live Moolre balance insufficient', { live: liveBalance.balance, required: totalRequired })
        return NextResponse.json({
          error: `Live Moolre wallet balance insufficient. Need GHS ${totalRequired.toFixed(2)}, Moolre reports GHS ${liveBalance.balance.toFixed(2)}. Please top up your Moolre account.`,
        }, { status: 400 })
      } else {
        log.info('disburse: live Moolre balance check passed', { live: liveBalance.balance, required: totalRequired })
      }
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
        log.info('disburse simulated item', { item_id: item.id, name: item.name, amount: item.total_amount })
      } else {
        const phone = normalizeGhPhone(item.phone)
        if (!phone) {
          itemStatus = 'failed'
          statusMsg = 'Invalid phone number'
          failCount++
          log.error('disburse invalid phone', { name: item.name })
        } else {
          log.info('disburse initiating transfer', { name: item.name, amount: item.total_amount, ref })
          const result = await initiateTransfer({
            amount:    item.total_amount,
            recipient: phone,
            reference: ref,
          })
          log.info('disburse Moolre response', { name: item.name, ok: result.ok })
          if (result.ok) {
            itemStatus = 'processing' // Confirmed via Moolre webhook
            moolreRef = result.data?.reference || ref
            successCount++
          } else {
            itemStatus = 'failed'
            statusMsg = result.error
            failCount++
            log.error('disburse transfer failed', { name: item.name, error: result.error })
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

      // Log transaction with masked phone number
      const maskedPhone = item.phone && item.phone.length > 4 ? `****${item.phone.slice(-4)}` : (item.phone || '')
      await db.from('pay_transactions').insert({
        team_id: run.team_id,
        wallet_id: wallet.id,
        type: 'payout',
        amount: item.total_amount,
        status: itemStatus,
        reference: moolreRef,
        payroll_run_id,
        payroll_item_id: item.id,
        metadata: { recipient: item.name, phone: maskedPhone, simulated: SIMULATE },
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

    log.info('disburse completed', { payroll_run_id, successCount, failCount, finalStatus, simulated: SIMULATE })

    return NextResponse.json({ ok: true, successCount, failCount, results, simulated: SIMULATE })
  } catch (e) {
    log.error('pay/disburse unhandled exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
