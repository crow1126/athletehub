// app/api/billing/moolre-checkout/route.js
// Creates a Moolre payment charge and returns the checkout URL
import { NextResponse }                              from 'next/server'
import { canManageTeam, createServiceClient, getRequester } from '@/lib/serverAuth'
import { createCharge }                              from '@/lib/moolre'
import { payLimiter }                                from '@/lib/rateLimit'
import { sanitizeUUID, sanitizeEmail, sanitizeEnum, sanitizeAmount } from '@/lib/sanitize'
import log                                           from '@/lib/logger'

const supabase = createServiceClient()

const PLANS = {
  starting_xi: { athlete_limit: 40,   price_ghs: 199 },
  captain:     { athlete_limit: 9999, price_ghs: 499 },
}

const ALLOWED_PLANS = ['starting_xi', 'captain', 'starter', 'academy', 'elite']

export async function POST(req) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json()

    // ── Input sanitization ─────────────────────────────────────────────────
    const team_id = sanitizeUUID(body.team_id)
    const plan    = sanitizeEnum(body.plan, ALLOWED_PLANS)
    const email   = sanitizeEmail(body.email)

    if (!team_id) return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 })
    if (!plan)    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    if (!email)   return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })

    // Auth check
    const requester = await getRequester(req, supabase)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let targetPlan = plan
    if (plan === 'starter')                     targetPlan = 'starting_xi'
    if (plan === 'academy' || plan === 'elite') targetPlan = 'captain'
    if (!PLANS[targetPlan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    // Validate custom amount if provided
    const rawAmount = body.amount_ghs
    const amount_ghs = rawAmount
      ? sanitizeAmount(rawAmount, { min: 1, max: 10000 }) ?? PLANS[targetPlan].price_ghs
      : PLANS[targetPlan].price_ghs

    const reference = `APEX-M-${team_id.slice(0, 8)}-${Date.now()}`

    const protocol = req.headers.get('x-forwarded-proto') || 'https'
    const host     = req.headers.get('host')
    const origin   = `${protocol}://${host}`

    log.info('billing/moolre-checkout initiated', { team_id, plan: targetPlan, reference, initiated_by: requester.profile.id })

    const result = await createCharge({
      email,
      amount_ghs,
      reference,
      plan:        targetPlan,
      team_id,
      callbackUrl: `${origin}/api/webhooks/moolre`,
      redirectUrl: `${origin}/billing`
    })

    if (!result.ok) {
      log.error('billing/moolre-checkout charge failed', { error: result.error, team_id, reference })
      return NextResponse.json({ error: result.error || 'Moolre charge failed' }, { status: 502 })
    }

    const checkout_url = result.data?.checkout_url || result.data?.authorization_url || null
    log.info('billing/moolre-checkout link created', { reference, checkout_url: !!checkout_url })
    return NextResponse.json({ ok: true, checkout_url, reference, data: result.data })

  } catch (e) {
    log.error('billing/moolre-checkout unhandled exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
