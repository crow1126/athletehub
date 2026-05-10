// app/api/billing/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse }  from 'next/server'

// Use service role if available, otherwise fall back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey
)

const PLANS = {
  starter: { athlete_limit:40,   staff_limit:3,   price_ghs:350  },
  academy: { athlete_limit:100,  staff_limit:10,  price_ghs:600  },
  elite:   { athlete_limit:9999, staff_limit:999, price_ghs:1000 },
  trial:   { athlete_limit:999,  staff_limit:99,  price_ghs:0    },
}

// GET — fetch subscription + history
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const team_id = searchParams.get('team_id')
  if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

  const [{ data: sub }, { data: history }] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('team_id', team_id).single(),
    supabase.from('billing_events').select('*').eq('team_id', team_id)
      .order('created_at', { ascending: false }).limit(20),
  ])
  return NextResponse.json({ subscription: sub, history: history || [] })
}

// POST — activate a plan after payment
export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, plan, payment_method, payment_ref, notes, requested_by } = body

    console.log('Billing POST:', { team_id, plan, payment_method, payment_ref })

    if (!team_id || !plan) return NextResponse.json({ error: 'team_id and plan required' }, { status: 400 })
    if (!PLANS[plan])      return NextResponse.json({ error: 'Invalid plan: ' + plan }, { status: 400 })

    const p   = PLANS[plan]
    const now = new Date()
    const end = new Date(now); end.setDate(end.getDate() + 30)

    // Check if subscription exists
    const { data: existing, error: fetchErr } = await supabase
      .from('subscriptions').select('id').eq('team_id', team_id).maybeSingle()

    console.log('Existing sub:', existing, 'fetchErr:', fetchErr)

    let sub, subErr
    if (existing) {
      const result = await supabase.from('subscriptions')
        .update({
          plan, status:'active',
          athlete_limit: p.athlete_limit, staff_limit: p.staff_limit, price_ghs: p.price_ghs,
          payment_method: payment_method || 'paystack',
          payment_ref:    payment_ref    || null,
          notes:          notes          || null,
          current_period_start: now.toISOString(),
          current_period_end:   end.toISOString(),
          trial_ends_at: null,
        })
        .eq('team_id', team_id)
        .select().single()
      sub = result.data; subErr = result.error
    } else {
      const result = await supabase.from('subscriptions')
        .insert({
          team_id, plan, status:'active',
          athlete_limit: p.athlete_limit, staff_limit: p.staff_limit, price_ghs: p.price_ghs,
          payment_method: payment_method || 'paystack',
          payment_ref:    payment_ref    || null,
          notes:          notes          || null,
          current_period_start: now.toISOString(),
          current_period_end:   end.toISOString(),
        })
        .select().single()
      sub = result.data; subErr = result.error
    }

    console.log('Sub result:', sub, 'subErr:', subErr)

    if (subErr) return NextResponse.json({ error: subErr.message, details: subErr }, { status: 500 })

    // Log billing event
    const { error: evErr } = await supabase.from('billing_events').insert({
      team_id, type:'payment', plan,
      amount_ghs:  p.price_ghs,
      payment_ref: payment_ref || null,
      notes,
      created_by:  requested_by || null,
    })

    console.log('Billing event error:', evErr)

    return NextResponse.json({ ok: true, subscription: sub })
  } catch (e) {
    console.error('Billing POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — cancel subscription
export async function PATCH(req) {
  try {
    const { team_id, action, requested_by } = await req.json()
    if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

    if (action === 'cancel') {
      const { data: sub } = await supabase.from('subscriptions').select('plan').eq('team_id', team_id).single()
      await supabase.from('subscriptions').update({ status:'cancelled' }).eq('team_id', team_id)
      await supabase.from('billing_events').insert({
        team_id, type:'cancellation', plan: sub?.plan || 'unknown',
        amount_ghs: 0, created_by: requested_by || null,
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}