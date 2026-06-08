// app/api/pay/topup/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { createCharge } from '@/lib/moolre'

const db = createServiceClient()

export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, amount_ghs, email } = body

    if (!team_id || !amount_ghs || !email) {
      return NextResponse.json({ error: 'team_id, amount_ghs, and email are required' }, { status: 400 })
    }

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Ensure wallet exists
    const { data: wallet } = await db.from('pay_wallets').select('id').eq('team_id', team_id).maybeSingle()
    if (!wallet) {
      await db.from('pay_wallets').insert({ team_id, balance: 0 })
    }

    const reference = `APAY-TOPUP-${team_id.slice(0, 8)}-${Date.now()}`

    const protocol = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host')

    const result = await createCharge({
      email,
      amount_ghs: parseFloat(amount_ghs),
      reference,
      plan:        'wallet_topup',
      team_id,
      callbackUrl: `${protocol}://${host}/api/webhooks/pay/moolre-topup`,
      redirectUrl: `${protocol}://${host}/pay`,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to create payment link' }, { status: 502 })
    }

    // Log pending transaction
    const { data: wData } = await db.from('pay_wallets').select('id').eq('team_id', team_id).maybeSingle()
    await db.from('pay_transactions').insert({
      team_id,
      wallet_id:   wData?.id,
      type:        'top_up',
      amount:      parseFloat(amount_ghs),
      status:      'pending',
      reference,
      metadata:    { email, initiated_by: requester.profile.id },
    })

    const checkout_url = result.data?.checkout_url || result.data?.authorization_url || null
    return NextResponse.json({ ok: true, checkout_url, reference, data: result.data })
  } catch (e) {
    console.error('[pay/topup]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
