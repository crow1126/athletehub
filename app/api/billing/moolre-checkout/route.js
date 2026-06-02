// app/api/billing/moolre-checkout/route.js
// Creates a Moolre payment charge and returns the checkout URL
import { NextResponse }                      from 'next/server'
import { canManageTeam, createServiceClient, getRequester } from '@/lib/serverAuth'
import { createCharge }                      from '@/lib/moolre'

const supabase = createServiceClient()

const PLANS = {
  starting_xi: { athlete_limit: 40,   price_ghs: 199 },
  captain:     { athlete_limit: 9999, price_ghs: 499 },
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, plan, email, ref, amount_ghs } = body

    if (!team_id || !plan || !email) {
      return NextResponse.json({ error: 'team_id, plan, and email are required' }, { status: 400 })
    }

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

    const reference = ref || `APEX-M-${team_id.slice(0, 8)}-${Date.now()}`
    const price     = amount_ghs || PLANS[targetPlan].price_ghs

    const result = await createCharge({
      email,
      amount_ghs: price,
      reference,
      plan:       targetPlan,
      team_id,
      channels:   ['mobile_money', 'card'],
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Moolre charge failed' }, { status: 502 })
    }

    // Moolre typically returns a checkout_url to redirect the user to
    const checkout_url = result.data?.checkout_url || result.data?.authorization_url || null

    return NextResponse.json({ ok: true, checkout_url, reference, data: result.data })

  } catch (e) {
    console.error('[moolre-checkout]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
