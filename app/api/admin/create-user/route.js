import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── POST: Create a new staff login ─────────────────────────────────────────
export async function POST(req) {
  try {
    const supabaseAdmin = getAdmin()
    const { email, password, full_name, role, coach_id, team_id, notes } = await req.json()

    if (!email || !password || !team_id) {
      return NextResponse.json({ error: 'email, password and team_id are required' }, { status: 400 })
    }

    // 1. Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    const userId = newUser.user.id

    // 2. Create profile — include email so recover lookup works
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: userId, full_name, role: role || 'physio', team_id, is_active: true, email },
        { onConflict: 'id' }
      )
    if (profileError) console.error('Profile error:', profileError.message)

    // 3. Log in staff_logins — store plain_password so admin can recover it
    if (coach_id) {
      const { error: loginError } = await supabaseAdmin
        .from('staff_logins')
        .insert([{
          coach_id,
          email,
          role:           role || 'physio',
          team_id,
          is_active:      true,
          notes:          notes || null,
          plain_password: password, // stored so admin can recover
        }])
      if (loginError) console.error('Staff login log error:', loginError.message)
    }

    return NextResponse.json({ success: true, user_id: userId })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH: revoke / reactivate / reset_password / change_own_password ──────
export async function PATCH(req) {
  try {
    const supabaseAdmin = getAdmin()
    const body          = await req.json()
    const { user_id, login_id, action, new_password } = body

    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

    // ── REVOKE ──────────────────────────────────────────────────────────────
    if (action === 'revoke') {
      // Ban the auth account
      const { error: banError } = await supabaseAdmin.auth.admin.updateUser(user_id, {
        ban_duration: '876600h',
      })
      if (banError) return NextResponse.json({ error: banError.message }, { status: 400 })

      // Force sign out all sessions immediately
      try { await supabaseAdmin.auth.admin.signOut(user_id, 'global') } catch(e) { /* non-fatal */ }

      // Mark profile inactive
      await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', user_id)

      // Mark login record inactive
      if (login_id) {
        await supabaseAdmin.from('staff_logins').update({ is_active: false }).eq('id', login_id)
      } else {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id)
        if (u?.user?.email) {
          await supabaseAdmin.from('staff_logins').update({ is_active: false }).eq('email', u.user.email)
        }
      }

      return NextResponse.json({ success: true, message: 'Login revoked and user signed out immediately.' })
    }

    // ── REACTIVATE ───────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      const { error } = await supabaseAdmin.auth.admin.updateUser(user_id, { ban_duration: 'none' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      await supabaseAdmin.from('profiles').update({ is_active: true }).eq('id', user_id)

      if (login_id) {
        await supabaseAdmin.from('staff_logins').update({ is_active: true }).eq('id', login_id)
      } else {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id)
        if (u?.user?.email) {
          await supabaseAdmin.from('staff_logins').update({ is_active: true }).eq('email', u.user.email)
        }
      }

      return NextResponse.json({ success: true, message: 'Login reactivated.' })
    }

    // ── RESET PASSWORD (admin resets a staff member's password) ─────────────
    if (action === 'reset_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      // Use service role to update any user's password
      const { error } = await supabaseAdmin.auth.admin.updateUser(user_id, { password: new_password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Sign out their old sessions
      try { await supabaseAdmin.auth.admin.signOut(user_id, 'global') } catch(e) { /* non-fatal */ }

      // Update plain_password in staff_logins so admin can see it
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id)
      if (u?.user?.email) {
        await supabaseAdmin
          .from('staff_logins')
          .update({ plain_password: new_password })
          .eq('email', u.user.email)
      }
      if (login_id) {
        await supabaseAdmin
          .from('staff_logins')
          .update({ plain_password: new_password })
          .eq('id', login_id)
      }

      return NextResponse.json({ success: true, message: 'Password reset successfully.' })
    }

    // ── CHANGE OWN PASSWORD (admin changes their own password via service role) ──
    // This bypasses the client SDK limitation that causes "not working" for admins
    if (action === 'change_own_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      const { error } = await supabaseAdmin.auth.admin.updateUser(user_id, { password: new_password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Sign out OTHER sessions (not current) — we sign out all then let current re-authenticate
      try { await supabaseAdmin.auth.admin.signOut(user_id, 'global') } catch(e) { /* non-fatal */ }

      return NextResponse.json({ success: true, message: 'Password changed successfully.' })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (err) {
    console.error('PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}