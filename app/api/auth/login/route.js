import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getAdminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAuthClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/auth/login
 *
 * Robust server-side authentication route.
 * Accepts username or email (`identifier`) + `password`.
 * Resolves usernames using admin privileges, then authenticates with Supabase.
 * Bypasses mobile cellular carrier CGNAT IP rate limiting that blocks mobile devices.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const identifier = (body.identifier || body.email || '').trim().toLowerCase()
    const password   = body.password

    if (!identifier) {
      return NextResponse.json({ error: 'Username or email address is required.' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    let canonicalEmail = identifier

    // If identifier is not an email address, resolve username
    if (!canonicalEmail.includes('@')) {
      const { data: profile } = await adminDb
        .from('profiles')
        .select('id, email, is_active, role')
        .ilike('username', canonicalEmail)
        .maybeSingle()

      if (profile?.email) {
        if (profile.is_active === false) {
          return NextResponse.json({ error: 'Your account is currently disabled. Please contact your administrator.' }, { status: 403 })
        }
        canonicalEmail = profile.email
      } else {
        // Fallback: check staff_logins table
        const { data: staffLogin } = await adminDb
          .from('staff_logins')
          .select('email, is_active')
          .ilike('username', canonicalEmail)
          .maybeSingle()

        if (staffLogin?.email) {
          if (staffLogin.is_active === false) {
            return NextResponse.json({ error: 'Your account is currently disabled. Please contact your administrator.' }, { status: 403 })
          }
          canonicalEmail = staffLogin.email
        } else {
          canonicalEmail = `${canonicalEmail}@players.apextrack.internal`
        }
      }
    }

    // Authenticate with Supabase Auth
    const authClient = getAuthClient()
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: canonicalEmail,
      password,
    })

    if (authError) {
      const msg = authError.message || ''
      if (msg.toLowerCase().includes('invalid')) {
        return NextResponse.json({ error: 'Incorrect username, email or password.' }, { status: 401 })
      }
      if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('not confirmed')) {
        return NextResponse.json({
          error: 'Please confirm your email before signing in. Check your inbox for the activation link.',
          needsVerification: true,
        }, { status: 403 })
      }
      if (msg.toLowerCase().includes('rate limit')) {
        return NextResponse.json({
          error: 'Too many sign-in attempts. Please wait 1 to 2 minutes before trying again.',
        }, { status: 429 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!authData?.session || !authData?.user) {
      return NextResponse.json({ error: 'Authentication failed. Please try again.' }, { status: 500 })
    }

    // Fetch user profile
    const { data: profile } = await adminDb
      .from('profiles')
      .select('id, full_name, role, team_id, registration_status, is_active, club_name, club_logo_url')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profile?.is_active === false) {
      return NextResponse.json({ error: 'Your account is currently inactive. Contact your club administrator.' }, { status: 403 })
    }

    // Record login activity in database immediately
    const nowIso = new Date().toISOString()
    try {
      await adminDb.from('profiles').update({ last_login: nowIso }).eq('id', authData.user.id)
      if (profile?.team_id) {
        await adminDb.from('notification_logs').insert({
          team_id: profile.team_id,
          type: 'user_login',
          sent_count: 1,
          fail_count: 0,
          created_by: authData.user.id,
        })
      }
    } catch (logErr) {
      console.warn('[api/auth/login] Could not log access record:', logErr?.message)
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
        user: authData.user,
      },
      profile: profile || null,
    })
  } catch (err) {
    console.error('Server login error:', err)
    return NextResponse.json({ error: err.message || 'Unexpected login error.' }, { status: 500 })
  }
}

