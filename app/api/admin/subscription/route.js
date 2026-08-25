import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

async function verifySuperadmin(req, db) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return null

  const { data: profile } = await db
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') return null
  return { user, profile }
}

/**
 * GET /api/admin/subscription?team_id=...
 */
export async function GET(req) {
  try {
    const db = getDb()
    const superadmin = await verifySuperadmin(req, db)
    if (!superadmin) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('team_id')
    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    const { data: sub, error } = await db
      .from('subscriptions')
      .select('*, teams(id, name, short_name, logo_url)')
      .eq('team_id', teamId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ ok: true, subscription: sub })
  } catch (err) {
    console.error('Error fetching subscription:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/subscription
 * Upserts or updates a team's subscription with custom limits, plan, and duration.
 */
export async function POST(req) {
  try {
    const db = getDb()
    const superadmin = await verifySuperadmin(req, db)
    if (!superadmin) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const body = await req.json()
    const {
      team_id,
      plan = 'captain',
      status = 'active',
      athlete_limit,
      staff_limit,
      current_period_end,
      trial_ends_at = null,
      notes = null,
    } = body

    if (!team_id) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    // Determine default limits based on plan if not specified
    let finalAthleteLimit = athlete_limit
    let finalStaffLimit = staff_limit

    if (finalAthleteLimit === undefined || finalAthleteLimit === null) {
      if (plan === 'starting_xi') finalAthleteLimit = 40
      else if (plan === 'trial') finalAthleteLimit = 999
      else finalAthleteLimit = 999999 // Captain / Unlimited
    }

    if (finalStaffLimit === undefined || finalStaffLimit === null) {
      if (plan === 'starting_xi') finalStaffLimit = 15
      else if (plan === 'trial') finalStaffLimit = 99
      else finalStaffLimit = 99999 // Captain / Unlimited
    }

    // Default period end: 100 years for unlimited/captain, 30 days for trial, 1 month for starting_xi
    let finalPeriodEnd = current_period_end
    if (!finalPeriodEnd) {
      const now = new Date()
      if (plan === 'trial') {
        now.setDate(now.getDate() + 30)
      } else if (plan === 'captain') {
        now.setFullYear(now.getFullYear() + 100)
      } else {
        now.setMonth(now.getMonth() + 1)
      }
      finalPeriodEnd = now.toISOString()
    }

    const subPayload = {
      team_id,
      plan,
      status,
      athlete_limit: Number(finalAthleteLimit),
      staff_limit: Number(finalStaffLimit),
      current_period_start: new Date().toISOString(),
      current_period_end: finalPeriodEnd,
      trial_ends_at: trial_ends_at || (plan === 'trial' ? finalPeriodEnd : null),
      notes: notes || `Updated by Superadmin (${superadmin.profile.full_name || 'Console'}) on ${new Date().toLocaleDateString()}`,
      updated_at: new Date().toISOString()
    }

    // 1. Check if subscription exists
    const { data: existing } = await db
      .from('subscriptions')
      .select('id')
      .eq('team_id', team_id)
      .maybeSingle()

    let resultSub = null
    if (existing?.id) {
      const { data, error } = await db
        .from('subscriptions')
        .update(subPayload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      resultSub = data
    } else {
      const { data, error } = await db
        .from('subscriptions')
        .insert({ ...subPayload, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      resultSub = data
    }

    // 2. Also sync teams plan
    await db
      .from('teams')
      .update({ plan: plan === 'starting_xi' ? 'starter' : (plan === 'captain' ? 'elite' : 'trial') })
      .eq('id', team_id)

    return NextResponse.json({
      ok: true,
      message: `Subscription successfully updated to ${plan.toUpperCase()} (${status}).`,
      subscription: resultSub
    })
  } catch (err) {
    console.error('Error updating subscription:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
