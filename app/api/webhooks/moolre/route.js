// app/api/webhooks/moolre/route.js
// Handles Moolre payment confirmation webhooks
import { NextResponse }          from 'next/server'
import { createServiceClient }   from '@/lib/serverAuth'
import crypto                    from 'crypto'

const PLANS = {
  starting_xi: { athlete_limit: 40,   staff_limit: 99,  price_ghs: 199 },
  captain:     { athlete_limit: 9999, staff_limit: 999, price_ghs: 499 },
}

export async function POST(req) {
  const body = await req.text()
  const sig  = req.headers.get('x-moolre-signature') || req.headers.get('x-moolre-hmac')

  // ── Signature verification ────────────────────────────────────────────────
  if (process.env.MOOLRE_WEBHOOK_SECRET && sig) {
    const expected = crypto
      .createHmac('sha256', process.env.MOOLRE_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    if (sig !== expected) {
      console.warn('[Moolre Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event
  try { event = JSON.parse(body) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  console.log('[Moolre Webhook] Event:', event?.event)

  // ── Handle successful charge ───────────────────────────────────────────────
  if (event?.event === 'charge.success') {
    const { reference, amount, metadata } = event.data || {}
    const { plan, team_id } = metadata || {}

    if (!team_id || !plan) {
      console.error('[Moolre Webhook] Missing metadata:', metadata)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    let targetPlan = plan
    if (plan === 'starter') targetPlan = 'starting_xi'
    if (plan === 'academy' || plan === 'elite') targetPlan = 'captain'

    const p = PLANS[targetPlan]
    if (!p) {
      console.error('[Moolre Webhook] Unknown plan:', plan)
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const end      = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error: subErr } = await supabase.from('subscriptions').upsert({
      team_id,
      plan:                targetPlan,
      status:              'active',
      athlete_limit:       p.athlete_limit,
      current_period_end:  end,
      trial_ends_at:       null,
    }, { onConflict: 'team_id' })

    if (subErr) {
      console.error('[Moolre Webhook] Subscription upsert error:', subErr)
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    await supabase.from('billing_events').insert({
      team_id,
      type:        'payment',
      plan:        targetPlan,
      amount_ghs:  amount ? Math.round(amount / 100) : p.price_ghs,
      payment_ref: reference || null,
      notes:       `Moolre — ${reference}`,
    })

    console.log('[Moolre Webhook] Subscription activated for team:', team_id, 'plan:', targetPlan)
  }

  return NextResponse.json({ received: true })
}
