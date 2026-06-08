// app/api/pay/payroll/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam, canAccessPay } from '@/lib/serverAuth'

const db = createServiceClient()

// GET - list all payroll runs for a team
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const team_id = searchParams.get('team_id')
    if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canAccessPay(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: runs, error } = await db.from('pay_payroll_runs')
      .select('*, created_by_profile:created_by(full_name), approved_by_profile:approved_by(full_name)')
      .eq('team_id', team_id)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ runs: runs || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST - create a new payroll run
export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, description, recipients } = body
    // recipients: [{ recipient_type, recipient_id, name, phone, base_salary, bonus, allowance }]

    if (!team_id || !description) {
      return NextResponse.json({ error: 'team_id and description are required' }, { status: 400 })
    }
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 })
    }

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Validate that each recipient has a phone number
    const invalid = recipients.filter(r => !r.phone)
    if (invalid.length > 0) {
      return NextResponse.json({
        error: `${invalid.length} recipient(s) missing MoMo phone number: ${invalid.map(r => r.name).join(', ')}`,
      }, { status: 400 })
    }

    // Calculate totals
    const items = recipients.map(r => ({
      ...r,
      base_salary: Number(r.base_salary || 0),
      bonus:       Number(r.bonus || 0),
      allowance:   Number(r.allowance || 0),
      total_amount: Number(r.base_salary || 0) + Number(r.bonus || 0) + Number(r.allowance || 0),
    }))
    const total_amount = items.reduce((sum, r) => sum + r.total_amount, 0)

    // Create the payroll run
    const { data: run, error: runErr } = await db.from('pay_payroll_runs').insert({
      team_id,
      description,
      total_amount,
      status:     'draft',
      created_by: requester.profile.id,
    }).select().single()
    if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })

    // Create payroll items
    const itemRows = items.map(r => ({
      payroll_run_id: run.id,
      recipient_type: r.recipient_type,
      recipient_id:   r.recipient_id,
      name:           r.name,
      phone:          r.phone,
      base_salary:    r.base_salary,
      bonus:          r.bonus,
      allowance:      r.allowance,
      total_amount:   r.total_amount,
      status:         'pending',
    }))
    const { error: itemErr } = await db.from('pay_payroll_items').insert(itemRows)
    if (itemErr) {
      // Rollback the run
      await db.from('pay_payroll_runs').delete().eq('id', run.id)
      return NextResponse.json({ error: itemErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run })
  } catch (e) {
    console.error('[pay/payroll POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
