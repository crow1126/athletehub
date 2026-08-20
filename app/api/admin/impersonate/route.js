import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getAdminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * POST /api/admin/impersonate
 *
 * Allows a superadmin to generate a one-time magic-link token for any user,
 * so the browser can exchange it for a real session with that user's RLS context.
 *
 * Body: { user_id: string }
 * Returns: { hashed_token, email, role, club_name, team_id, full_name }
 *
 * SECURITY: Caller must be a verified superadmin. Token is one-time-use and
 * expires within 60 seconds. The raw magic-link URL is never returned.
 */
export async function POST(req) {
  try {
    const db = getAdminDb()
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)

    // Verify caller is a superadmin
    const { data: { user: caller }, error: callerErr } = await db.auth.getUser(token)
    if (callerErr || !caller) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { data: callerProfile } = await db
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden — superadmin only' }, { status: 403 })
    }

    // Get target user
    const body = await req.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (user_id === caller.id) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
    }

    // Fetch target user from auth
    const { data: { user: targetUser }, error: userErr } = await db.auth.admin.getUserById(user_id)
    if (userErr || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Block impersonating another superadmin
    const { data: targetProfile } = await db
      .from('profiles')
      .select('role, full_name, team_id, club_name, club_logo_url, teams(name)')
      .eq('id', user_id)
      .single()

    if (targetProfile?.role === 'superadmin') {
      return NextResponse.json({ error: 'Cannot impersonate another superadmin' }, { status: 403 })
    }

    // Generate one-time magic link token
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard` }
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink error:', linkErr)
      return NextResponse.json({ error: 'Could not generate impersonation token' }, { status: 500 })
    }

    // Log this impersonation event for audit trail
    await db.from('client_logs').insert([{
      level: 'warn',
      message: `Superadmin impersonation: ${caller.email} → ${targetUser.email}`,
      context: {
        impersonator_id: caller.id,
        impersonator_email: caller.email,
        target_id: user_id,
        target_email: targetUser.email,
        target_role: targetProfile?.role,
        target_team_id: targetProfile?.team_id,
      },
      team_id: targetProfile?.team_id || null,
      user_id: user_id,
    }]).catch(() => {}) // non-blocking — logs table may not exist yet

    return NextResponse.json({
      hashed_token: linkData.properties.hashed_token,
      email: targetUser.email,
      full_name: targetProfile?.full_name || targetUser.email,
      role: targetProfile?.role || 'admin',
      club_name: targetProfile?.teams?.name || targetProfile?.club_name || 'Unknown Club',
      team_id: targetProfile?.team_id || null,
    })
  } catch (err) {
    console.error('impersonate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
