// app/api/billing/verify-moolre/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'
import { verifyCharge } from '@/lib/moolre'
import { payLimiter } from '@/lib/rateLimit'
import log from '@/lib/logger'

const supabase = createServiceClient()

const PLANS = {
  starting_xi: { athlete_limit: 40,   staff_limit: 99,  price_ghs: 199 },
  captain:     { athlete_limit: 9999, staff_limit: 999, price_ghs: 499 },
}

export async function POST(req) {
  // Rate limiting
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json()
    const { reference, plan, team_id } = body

    if (!reference || !plan || !team_id) {
      return NextResponse.json({ error: 'reference, plan, and team_id are required' }, { status: 400 })
    }

    // Authenticate user
    const requester = await getRequester(req, supabase)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Map plan names
    let targetPlan = plan
    if (plan === 'starter') targetPlan = 'starting_xi'
    if (plan === 'academy' || plan === 'elite') targetPlan = 'captain'

    const p = PLANS[targetPlan]
    if (!p) {
      return NextResponse.json({ error: 'Invalid plan: ' + plan }, { status: 400 })
    }

    // Check if the payment reference was already processed to prevent double activation
    const { data: existingEvent } = await supabase
      .from('billing_events')
      .select('id')
      .eq('payment_ref', reference)
      .eq('type', 'payment')
      .maybeSingle()

    if (existingEvent) {
      log.info('billing/verify-moolre: payment reference already processed', { reference })
      return NextResponse.json({ ok: true, message: 'Subscription is already active.' })
    }

    // Call Moolre to verify the payment status
    log.info('billing/verify-moolre: verifying status with Moolre API', { reference })
    const result = await verifyCharge(reference)

    if (!result.ok) {
      log.warn('billing/verify-moolre: verification failed', { reference, error: result.error })
      return NextResponse.json({ error: result.error || 'Verification check failed' }, { status: 400 })
    }

    const payload = result.data
    const txStatus = payload?.txstatus ?? payload?.status

    // Check if successfully completed (1 or '1' or code 'SS01')
    if (txStatus === 1 || txStatus === '1' || result.code === 'SS01') {
      const amount = payload?.amount ?? payload?.value
      const amountGhs = amount ? Math.round(parseFloat(amount)) : p.price_ghs
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      // Update or insert subscription
      const { error: subErr } = await supabase
        .from('subscriptions')
        .upsert({
          team_id,
          plan: targetPlan,
          status: 'active',
          athlete_limit: p.athlete_limit,
          current_period_end: end,
          trial_ends_at: null,
        }, { onConflict: 'team_id' })

      if (subErr) {
        log.error('billing/verify-moolre subscription update error', { error: subErr.message, team_id })
        return NextResponse.json({ error: subErr.message }, { status: 500 })
      }

      // Log billing event
      await supabase.from('billing_events').insert({
        team_id,
        type: 'payment',
        plan: targetPlan,
        amount_ghs: amountGhs,
        payment_ref: reference,
        notes: `Moolre — verified on return (${reference})`,
        created_by: requester.profile.id,
      })

      log.info('billing/verify-moolre subscription activated successfully', { team_id, plan: targetPlan, reference })

      return NextResponse.json({
        ok: true,
        message: 'Subscription successfully activated!'
      })
    } else {
      log.info('billing/verify-moolre transaction not successful yet', { reference, txStatus })
      return NextResponse.json({
        ok: false,
        error: 'Payment transaction is not completed/successful on Moolre.'
      }, { status: 400 })
    }
  } catch (e) {
    log.error('billing/verify-moolre exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
