// app/api/webhooks/pay/moolre-disburse/route.js
// Handles Moolre status callbacks for disbursement payouts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/serverAuth'
import crypto from 'crypto'

export async function POST(req) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-moolre-signature') || req.headers.get('x-moolre-hmac') || ''

  if (process.env.MOOLRE_WEBHOOK_SECRET && sig) {
    const expected = crypto
      .createHmac('sha256', process.env.MOOLRE_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')
    if (sig !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event
  try { event = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { externalref, reference, status: moolreStatus } = event.data || {}
  const paymentRef = externalref || reference
  if (!paymentRef) return NextResponse.json({ received: true })

  const db = createServiceClient()

  // Find the matching payout transaction
  const { data: txn } = await db.from('pay_transactions')
    .select('*, pay_payroll_items(id, payroll_run_id)')
    .eq('reference', paymentRef)
    .eq('type', 'payout')
    .maybeSingle()

  if (!txn) return NextResponse.json({ received: true })

  // Determine final status
  const isSuccess = event?.status === 1 || event?.code === 'P01' || moolreStatus === 'success'
  const finalStatus = isSuccess ? 'success' : 'failed'
  const statusMsg = event?.message || (isSuccess ? 'Completed via Moolre' : 'Failed via Moolre')

  // Update transaction
  await db.from('pay_transactions').update({
    status:     finalStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', txn.id)

  // Update payroll item
  if (txn.pay_payroll_items?.id) {
    await db.from('pay_payroll_items').update({
      status:            finalStatus,
      moolre_status_msg: statusMsg,
      updated_at:        new Date().toISOString(),
    }).eq('id', txn.pay_payroll_items.id)

    // Check if all items for the run are resolved and update run status
    const runId = txn.pay_payroll_items.payroll_run_id
    if (runId) {
      const { data: allItems } = await db.from('pay_payroll_items')
        .select('status').eq('payroll_run_id', runId)
      const allDone = allItems?.every(i => i.status === 'success' || i.status === 'failed')
      if (allDone) {
        const allSuccess = allItems?.every(i => i.status === 'success')
        await db.from('pay_payroll_runs').update({
          status:     allSuccess ? 'completed' : 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', runId)
      }
    }
  }

  console.log('[pay/disburse webhook] Ref:', paymentRef, 'Status:', finalStatus)
  return NextResponse.json({ received: true })
}
