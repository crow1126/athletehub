import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Direct REST helpers (bypasses auth.admin SDK issues) ──────────────────
async function adminFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || 'Auth API error')
  return data
}

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ── POST: Create a new staff login ────────────────────────────────────────
export async function POST(req) {
  try {
    const { email, password, full_name, role, coach_id, team_id, notes } = await req.json()

    if (!email || !password || !team_id) {
      return NextResponse.json({ error: 'email, password and team_id are required' }, { status: 400 })
    }

    // 1. Create auth user via REST
    const newUser = await adminFetch('users', 'POST', {
      email,
      password,
      email_confirm: true,
    })
    const userId = newUser.id

    const db = getDb()

    // 2. Create profile
    const { error: profileError } = await db
      .from('profiles')
      .upsert(
        { id: userId, full_name, role: role || 'physio', team_id, is_active: true, email },
        { onConflict: 'id' }
      )
    if (profileError) console.error('Profile error:', profileError.message)

    // 3. Log in staff_logins
    if (coach_id) {
      const { error: loginError } = await db
        .from('staff_logins')
        .insert([{
          coach_id,
          email,
          role:           role || 'physio',
          team_id,
          is_active:      true,
          notes:          notes || null,
          plain_password: password,
        }])
      if (loginError) console.error('Staff login log error:', loginError.message)
    }

    return NextResponse.json({ success: true, user_id: userId })
  } catch (err) {
    console.error('POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH: revoke / reactivate / reset_password / change_own_password ─────
export async function PATCH(req) {
  try {
    const db = getDb()
    const body = await req.json()
    const { user_id, login_id, action, new_password } = body

    console.log('📥 PATCH action:', action, '| user_id:', user_id)

    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

    // ── REVOKE ─────────────────────────────────────────────────────────────
    if (action === 'revoke') {
      // Ban via REST
      await adminFetch(`users/${user_id}`, 'PUT', { ban_duration: '876600h' })

      // Force sign out all sessions
      try { await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' }) } catch(e) { /* non-fatal */ }

      // Mark profile inactive
      await db.from('profiles').update({ is_active: false }).eq('id', user_id)

      // Mark login record inactive
      if (login_id) {
        await db.from('staff_logins').update({ is_active: false }).eq('id', login_id)
      } else {
        const user = await adminFetch(`users/${user_id}`)
        if (user?.email) {
          await db.from('staff_logins').update({ is_active: false }).eq('email', user.email)
        }
      }

      return NextResponse.json({ success: true, message: 'Login revoked and user signed out immediately.' })
    }

    // ── REACTIVATE ──────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      await adminFetch(`users/${user_id}`, 'PUT', { ban_duration: 'none' })

      await db.from('profiles').update({ is_active: true }).eq('id', user_id)

      if (login_id) {
        await db.from('staff_logins').update({ is_active: true }).eq('id', login_id)
      } else {
        const user = await adminFetch(`users/${user_id}`)
        if (user?.email) {
          await db.from('staff_logins').update({ is_active: true }).eq('email', user.email)
        }
      }

      return NextResponse.json({ success: true, message: 'Login reactivated.' })
    }

    // ── RESET PASSWORD ──────────────────────────────────────────────────────
    if (action === 'reset_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      await adminFetch(`users/${user_id}`, 'PUT', { password: new_password })

      try { await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' }) } catch(e) { /* non-fatal */ }

      const user = await adminFetch(`users/${user_id}`)
      if (user?.email) {
        await db.from('staff_logins').update({ plain_password: new_password }).eq('email', user.email)
      }
      if (login_id) {
        await db.from('staff_logins').update({ plain_password: new_password }).eq('id', login_id)
      }

      return NextResponse.json({ success: true, message: 'Password reset successfully.' })
    }

    // ── CHANGE OWN PASSWORD ─────────────────────────────────────────────────
    if (action === 'change_own_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      await adminFetch(`users/${user_id}`, 'PUT', { password: new_password })

      try { await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' }) } catch(e) { /* non-fatal */ }

      return NextResponse.json({ success: true, message: 'Password changed successfully.' })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (err) {
    console.error('PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}