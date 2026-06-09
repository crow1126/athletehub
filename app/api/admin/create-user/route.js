import { NextResponse } from 'next/server'
import { canManageTeam, createServiceClient, getRequester } from '@/lib/serverAuth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function adminFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json()
  if (!res.ok) {
    // Supabase Auth Admin API uses `msg` (not `message`) for error text
    const errMsg =
      data.msg ||
      data.message ||
      data.error_description ||
      data.error ||
      `Auth API error (HTTP ${res.status})`
    console.error('[create-user] adminFetch error:', res.status, JSON.stringify(data))
    throw new Error(errMsg)
  }
  return data
}

function getDb() {
  return createServiceClient()
}

export async function POST(req) {
  try {
    const { username, email: inputEmail, password, full_name, role, coach_id, team_id, notes } = await req.json()

    let email = inputEmail
    if (username) {
      email = `${username.trim().toLowerCase()}@apex.local`
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'username/email and password are required' }, { status: 400 })
    }

    const db = getDb()
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const safeRole = role === 'superadmin' ? 'physio' : (role || 'physio')
    let resolvedTeamId = requester.profile.role === 'superadmin'
      ? (team_id || null)
      : requester.profile.team_id

    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Your account is not linked to a club. Contact the system administrator.' }, { status: 403 })
    }

    if (coach_id) {
      let coachQuery = db
        .from('coaches')
        .select('team_id')
        .eq('id', coach_id)

      if (resolvedTeamId) coachQuery = coachQuery.eq('team_id', resolvedTeamId)

      const { data: coach } = await coachQuery.single()
      if (!coach) {
        return NextResponse.json({ error: 'Coach is not available for this team' }, { status: 403 })
      }
      resolvedTeamId = coach.team_id || null
    }

    if (!resolvedTeamId || !canManageTeam(requester.profile, resolvedTeamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Duplicate-username guard
    if (username) {
      const { data: existingUsername } = await db
        .from('profiles')
        .select('id')
        .ilike('username', username.trim())
        .maybeSingle()

      if (existingUsername) {
        return NextResponse.json({ error: 'A login with this username already exists on the platform.' }, { status: 409 })
      }
    }

    // Duplicate-email guard — gives a clear message instead of a raw Supabase Auth error
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, team_id')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      const sameClub = existingProfile.team_id === resolvedTeamId
      return NextResponse.json({
        error: sameClub
          ? 'A login with this email/username already exists in your club.'
          : 'This email/username is already registered to a user in another club.',
      }, { status: 409 })
    }

    // Fetch team name and logo to inherit them automatically in the user's profile
    let teamName = null
    let teamLogoUrl = null
    if (resolvedTeamId) {
      const { data: teamData } = await db
        .from('teams')
        .select('name, logo_url')
        .eq('id', resolvedTeamId)
        .maybeSingle()
      if (teamData) {
        teamName = teamData.name
        teamLogoUrl = teamData.logo_url
      }
    }

    const newUser = await adminFetch('users', 'POST', {
      email,
      password,
      email_confirm: true,
    })
    const userId = newUser.id

    const allowedDbRoles = ['superadmin', 'admin', 'coach', 'physio', 'player', 'accountant']
    const profileDbRole = allowedDbRoles.includes(safeRole) ? safeRole : 'coach'

    const { error: profileError } = await db
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name,
          role: profileDbRole,
          team_id: resolvedTeamId,
          is_active: true,
          email,
          username: username || null,
          club_name: teamName,
          club_logo_url: teamLogoUrl
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('Profile error:', profileError.message)
      try {
        await adminFetch(`users/${userId}`, 'DELETE')
      } catch (cleanupErr) {
        console.error('Failed to cleanup auth user after profile failure:', cleanupErr.message)
      }
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    if (coach_id || safeRole === 'accountant') {
      const { error: loginError } = await db
        .from('staff_logins')
        .insert([{
          coach_id: coach_id || null,
          email,
          username: username || null,
          role: safeRole,
          team_id: resolvedTeamId,
          is_active: true,
          notes: notes || null,
          plain_password: password,
        }])

      if (loginError) {
        console.error('Staff login log error:', loginError.message)
        return NextResponse.json({ error: 'Failed to create staff login record' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, user_id: userId })
  } catch (err) {
    console.error('POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const db = getDb()
    const body = await req.json()
    const { user_id, login_id, action, new_password } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    let targetProfile = null
    let targetTeamId = null

    if (action === 'change_own_password') {
      if (requester.profile.id !== user_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { data: profile } = await db
        .from('profiles')
        .select('id,email,team_id')
        .eq('id', user_id)
        .single()

      targetProfile = profile
      targetTeamId = profile?.team_id || null

      if (!targetTeamId || !canManageTeam(requester.profile, targetTeamId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (login_id) {
        const { data: login } = await db
          .from('staff_logins')
          .select('id,team_id')
          .eq('id', login_id)
          .single()

        if (!login || login.team_id !== targetTeamId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    if (action === 'revoke') {
      await adminFetch(`users/${user_id}`, 'PUT', { ban_duration: '876600h' })
      try {
        await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' })
      } catch (error) {
        console.warn('Logout warning:', error.message)
      }

      await db.from('profiles').update({ is_active: false }).eq('id', user_id).eq('team_id', targetTeamId)

      if (login_id) {
        await db.from('staff_logins').update({ is_active: false }).eq('id', login_id).eq('team_id', targetTeamId)
      } else if (targetProfile?.email) {
        await db.from('staff_logins').update({ is_active: false }).eq('email', targetProfile.email).eq('team_id', targetTeamId)
      }

      return NextResponse.json({ success: true, message: 'Login revoked and user signed out immediately.' })
    }

    if (action === 'reactivate') {
      await adminFetch(`users/${user_id}`, 'PUT', { ban_duration: 'none' })

      await db.from('profiles').update({ is_active: true }).eq('id', user_id).eq('team_id', targetTeamId)

      if (login_id) {
        await db.from('staff_logins').update({ is_active: true }).eq('id', login_id).eq('team_id', targetTeamId)
      } else if (targetProfile?.email) {
        await db.from('staff_logins').update({ is_active: true }).eq('email', targetProfile.email).eq('team_id', targetTeamId)
      }

      return NextResponse.json({ success: true, message: 'Login reactivated.' })
    }

    if (action === 'reset_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      await adminFetch(`users/${user_id}`, 'PUT', { password: new_password })
      try {
        await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' })
      } catch (error) {
        console.warn('Logout warning:', error.message)
      }

      if (targetProfile?.email) {
        await db.from('staff_logins').update({ plain_password: new_password }).eq('email', targetProfile.email).eq('team_id', targetTeamId)
      }
      if (login_id) {
        await db.from('staff_logins').update({ plain_password: new_password }).eq('id', login_id).eq('team_id', targetTeamId)
      }

      return NextResponse.json({ success: true, message: 'Password reset successfully.' })
    }

    if (action === 'change_own_password') {
      if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }

      await adminFetch(`users/${user_id}`, 'PUT', { password: new_password })
      try {
        await adminFetch(`users/${user_id}/logout`, 'POST', { scope: 'global' })
      } catch (error) {
        console.warn('Logout warning:', error.message)
      }

      return NextResponse.json({ success: true, message: 'Password changed successfully.' })
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
  } catch (err) {
    console.error('PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
