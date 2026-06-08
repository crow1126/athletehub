// app/api/pay/payroll/[id]/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

const db = createServiceClient()

// GET — fetch a single payroll run with all items
export async function GET(req, { params }) {
  try {
    const { id } = await params
    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    const { data: run, error: runErr } = await db.from('pay_payroll_runs')
      .select('*, created_by_profile:created_by(full_name), approved_by_profile:approved_by(full_name)')
      .eq('id', id)
      .single()
    if (runErr || !run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canManageTeam(requester.profile, run.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: items } = await db.from('pay_payroll_items')
      .select('*')
      .eq('payroll_run_id', id)
      .order('name')

    return NextResponse.json({ run, items: items || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — update payroll run (approve / cancel)
export async function PATCH(req, { params }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { action } = body

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    const { data: run, error: runErr } = await db.from('pay_payroll_runs')
      .select('*')
      .eq('id', id)
      .single()
    if (runErr || !run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (!canManageTeam(requester.profile, run.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (action === 'approve') {
      if (run.status !== 'draft' && run.status !== 'pending_approval') {
        return NextResponse.json({ error: `Cannot approve a run with status "${run.status}"` }, { status: 400 })
      }

      // Check wallet has sufficient balance (including 1% platform fee)
      const fee = parseFloat((run.total_amount * 0.01).toFixed(2))
      const totalRequired = run.total_amount + fee

      const { data: wallet } = await db.from('pay_wallets').select('balance').eq('team_id', run.team_id).maybeSingle()
      if (!wallet || wallet.balance < totalRequired) {
        return NextResponse.json({
          error: `Insufficient wallet balance. Required: GHS ${totalRequired.toFixed(2)} (incl. GHS ${fee.toFixed(2)} fee), Available: GHS ${(wallet?.balance || 0).toFixed(2)}`,
        }, { status: 400 })
      }

      const { error: updateErr } = await db.from('pay_payroll_runs').update({
        status:      'approved',
        approved_by: requester.profile.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      return NextResponse.json({ ok: true, fee, totalRequired })
    }

    if (action === 'cancel') {
      if (['completed', 'processing'].includes(run.status)) {
        return NextResponse.json({ error: `Cannot cancel a run with status "${run.status}"` }, { status: 400 })
      }
      await db.from('pay_payroll_runs').update({ status: 'failed' }).eq('id', id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e) {
    console.error('[pay/payroll/[id] PATCH]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
