// app/api/pay/topup/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { createCharge } from '@/lib/moolre'
import { payLimiter } from '@/lib/rateLimit'
import { sanitizeUUID, sanitizeAmount, sanitizeEmail } from '@/lib/sanitize'
import log from '@/lib/logger'

const db = createServiceClient()

export async function POST(req) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json()

    // ── Input sanitization ─────────────────────────────────────────────────
    const team_id    = sanitizeUUID(body.team_id)
    const amount_ghs = sanitizeAmount(body.amount_ghs, { min: 1, max: 10000 })
    const email      = sanitizeEmail(body.email)

    if (!team_id) {
      return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 })
    }
    if (!amount_ghs) {
      return NextResponse.json({ error: 'amount_ghs must be a valid number between 1 and 10,000' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })
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

    log.info('pay/topup initiated', { team_id, amount_ghs, reference, initiated_by: requester.profile.id })

    const result = await createCharge({
      email,
      amount_ghs,
      reference,
      plan:        'wallet_topup',
      team_id,
      callbackUrl: `${protocol}://${host}/api/webhooks/pay/moolre-topup`,
      redirectUrl: `${protocol}://${host}/pay`,
    })

    if (!result.ok) {
      log.error('pay/topup Moolre charge failed', { error: result.error, team_id, reference })
      return NextResponse.json({ error: result.error || 'Failed to create payment link' }, { status: 502 })
    }

    // Log pending transaction
    const { data: wData } = await db.from('pay_wallets').select('id').eq('team_id', team_id).maybeSingle()
    await db.from('pay_transactions').insert({
      team_id,
      wallet_id:   wData?.id,
      type:        'top_up',
      amount:      amount_ghs,
      status:      'pending',
      reference,
      metadata:    { email, initiated_by: requester.profile.id },
    })

    const checkout_url = result.data?.checkout_url || result.data?.authorization_url || null
    log.info('pay/topup checkout created', { reference, checkout_url: !!checkout_url })
    return NextResponse.json({ ok: true, checkout_url, reference, data: result.data })
  } catch (e) {
    log.error('pay/topup unhandled exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
