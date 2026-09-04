import { NextResponse } from 'next/server'
import { canManageTeam, createServiceClient, getRequester } from '@/lib/serverAuth'
import { sendSMS, buildStaffLoginSMS, normalizeGhPhone } from '@/lib/moolre'

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
    const { username, email: inputEmail, password, full_name, role, coach_id, team_id, notes, phone } = await req.json()

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

    let coachPhone = null
    if (coach_id) {
      let coachQuery = db
        .from('coaches')
        .select('team_id, phone, name')
        .eq('id', coach_id)

      if (resolvedTeamId) coachQuery = coachQuery.eq('team_id', resolvedTeamId)

      const { data: coach } = await coachQuery.single()
      if (!coach) {
        return NextResponse.json({ error: 'Coach is not available for this team' }, { status: 403 })
      }
      resolvedTeamId = coach.team_id || null
      coachPhone = coach.phone || null
    }

    const recipientPhone = (phone || coachPhone)?.trim() || null

    if (!recipientPhone) {
      return NextResponse.json({
        error: 'A registered phone number is required to send login credentials to the staff member via SMS.'
      }, { status: 400 })
    }

    const normalizedPhone = normalizeGhPhone(recipientPhone)
    if (!normalizedPhone) {
      return NextResponse.json({
        error: 'Please enter a valid Ghanaian phone number (e.g. 0244123456 or +233244123456) to receive login credentials via SMS.'
      }, { status: 400 })
    }

    // If staff member has a coach record and phone is updated or provided, sync back to coaches table
    if (coach_id && recipientPhone) {
      try {
        await db.from('coaches').update({ phone: recipientPhone }).eq('id', coach_id)
      } catch (cErr) {
        console.warn('[create-user] Failed to sync coach phone:', cErr?.message)
      }
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
          phone: recipientPhone || null,
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

    // Send login credentials via SMS to staff member's registered phone
    let smsSent = false
    let smsError = null
    if (recipientPhone) {
      try {
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
        const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1')
        const loginUrl = !isLocal ? `https://${host}/login` : 'https://apextrackgh.com/login'

        const smsMessage = buildStaffLoginSMS({
          fullName: full_name,
          username: username || email,
          password,
          role: safeRole,
          clubName: teamName,
          loginUrl
        })

        const smsRes = await sendSMS(recipientPhone, smsMessage, {
          teamId: resolvedTeamId,
          db
        })
        smsSent = Boolean(smsRes?.sent > 0 || smsRes?.ok === true)
        if (smsRes?.error) smsError = smsRes.error
        console.log(`[create-user] Credentials SMS sent to ${recipientPhone}:`, smsRes)
      } catch (err) {
        console.error('[create-user] Failed to dispatch login credentials SMS:', err?.message)
        smsError = err?.message
      }
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      sms_sent: smsSent,
      phone: recipientPhone || null,
      sms_error: smsError
    })
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
        .select('id,email,team_id,phone,full_name')
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

      // Dispatch updated password via SMS if phone is available
      let resetPhone = targetProfile?.phone || null
      if (!resetPhone && login_id) {
        const { data: sl } = await db.from('staff_logins').select('coach_id').eq('id', login_id).maybeSingle()
        if (sl?.coach_id) {
          const { data: c } = await db.from('coaches').select('phone').eq('id', sl.coach_id).maybeSingle()
          if (c?.phone) resetPhone = c.phone
        }
      }

      if (!resetPhone && targetProfile?.id) {
        const { data: c2 } = await db.from('coaches').select('phone').or(`email.eq.${targetProfile.email},name.eq.${targetProfile.full_name}`).maybeSingle()
        if (c2?.phone) resetPhone = c2.phone
      }

      let resetSmsSent = false
      if (resetPhone) {
        try {
          const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
          const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1')
          const loginUrl = !isLocal ? `https://${host}/login` : 'https://apextrackgh.com/login'
          const resetMsg = `ApexTrack: Your staff login password has been reset.\nNew Password: ${new_password}\nLogin: ${loginUrl}`
          const smsRes = await sendSMS(resetPhone, resetMsg, { teamId: targetTeamId, db })
          resetSmsSent = Boolean(smsRes?.sent > 0 || smsRes?.ok === true)
        } catch (smsErr) {
          console.error('[create-user] Failed to send password reset SMS:', smsErr?.message)
        }
      }

      return NextResponse.json({ success: true, message: 'Password reset successfully.', sms_sent: resetSmsSent, phone: resetPhone || null })
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
