import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canAccessPay } from '@/lib/serverAuth'

const db = createServiceClient()

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const team_id = searchParams.get('team_id')
    if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canAccessPay(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get or create wallet
    let { data: wallet } = await db.from('pay_wallets').select('*').eq('team_id', team_id).maybeSingle()
    if (!wallet) {
      const { data: newWallet, error: createErr } = await db.from('pay_wallets')
        .insert({ team_id, balance: 0 })
        .select().single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      wallet = newWallet
    }

    // Aggregate stats
    const { data: stats } = await db.from('pay_transactions')
      .select('type, amount, status')
      .eq('team_id', team_id)

    const totalTopUps   = (stats || []).filter(t => t.type === 'top_up'  && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0)
    const totalDisbursed = (stats || []).filter(t => t.type === 'payout'  && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0)
    const totalFees     = (stats || []).filter(t => t.type === 'fee'     && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0)
    const pendingAmount = (stats || []).filter(t => t.type === 'payout'  && t.status === 'processing').reduce((s, t) => s + Number(t.amount), 0)

    // Recent payroll runs
    const { data: recentRuns } = await db.from('pay_payroll_runs')
      .select('id, description, total_amount, status, created_at')
      .eq('team_id', team_id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      wallet,
      stats: { totalTopUps, totalDisbursed, totalFees, pendingAmount },
      recentRuns: recentRuns || [],
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
