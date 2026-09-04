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
    const errMsg =
      data.msg ||
      data.message ||
      data.error_description ||
      data.error ||
      `Auth API error (HTTP ${res.status})`
    console.error('[create-player] adminFetch error:', res.status, JSON.stringify(data))
    throw new Error(errMsg)
  }
  return data
}

function getDb() {
  return createServiceClient()
}

export async function POST(req) {
  try {
    const { username, password, athlete_id, phone } = await req.json()

    if (!username || !password || !athlete_id) {
      return NextResponse.json({ error: 'username, password and athlete_id are required' }, { status: 400 })
    }

    const email = `${username.trim().toLowerCase()}@players.apextrack.internal`

    const db = getDb()
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    // Fetch the athlete record to verify existence, team ownership, and registered phone
    const { data: athlete, error: athleteError } = await db
      .from('athletes')
      .select('id, name, team_id, phone')
      .eq('id', athlete_id)
      .maybeSingle()

    if (athleteError || !athlete) {
      return NextResponse.json({ error: 'Athlete not found.' }, { status: 404 })
    }

    const resolvedTeamId = athlete.team_id
    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Athlete is not assigned to a club team.' }, { status: 400 })
    }

    const recipientPhone = (phone || athlete.phone)?.trim() || null

    if (!recipientPhone) {
      return NextResponse.json({
        error: 'A registered phone number is required to send login credentials to the player via SMS.'
      }, { status: 400 })
    }

    const normalizedPhone = normalizeGhPhone(recipientPhone)
    if (!normalizedPhone) {
      return NextResponse.json({
        error: 'Please enter a valid Ghanaian phone number (e.g. 0244123456 or +233244123456) to receive credentials via SMS.'
      }, { status: 400 })
    }

    // Sync phone back to athletes table if newly entered or updated
    if (athlete_id && recipientPhone) {
      try {
        await db.from('athletes').update({ phone: recipientPhone }).eq('id', athlete_id)
      } catch (syncErr) {
        console.warn('[create-player] Failed to sync athlete phone:', syncErr?.message)
      }
    }

    // Permission guard
    if (!canManageTeam(requester.profile, resolvedTeamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Guard: Check if athlete already has a login profile linked
    const { data: existingAthleteLogin } = await db
      .from('profiles')
      .select('id, username')
      .eq('athlete_id', athlete_id)
      .maybeSingle()

    if (existingAthleteLogin) {
      return NextResponse.json({
        error: `This athlete already has a login profile (username: ${existingAthleteLogin.username}).`
      }, { status: 409 })
    }

    // Guard: Duplicate username check
    const { data: existingUsername } = await db
      .from('profiles')
      .select('id')
      .ilike('username', username.trim())
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json({ error: 'A login with this username already exists on the platform.' }, { status: 409 })
    }

    // Guard: Duplicate email check
    const { data: existingEmail } = await db
      .from('profiles')
      .select('id')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json({ error: 'A login with this email already exists on the platform.' }, { status: 409 })
    }

    // Fetch team name and logo
    let teamName = null
    let teamLogoUrl = null
    const { data: teamData } = await db
      .from('teams')
      .select('name, logo_url')
      .eq('id', resolvedTeamId)
      .maybeSingle()

    if (teamData) {
      teamName = teamData.name
      teamLogoUrl = teamData.logo_url
    }

    // Create user in Supabase Auth via Admin API
    const newUser = await adminFetch('users', 'POST', {
      email,
      password,
      email_confirm: true,
    })
    const userId = newUser.id

    // Upsert the profile record
    const { error: profileError } = await db
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: athlete.name,
          role: 'player',
          team_id: resolvedTeamId,
          athlete_id: athlete_id,
          is_active: true,
          email,
          username: username.trim(),
          phone: recipientPhone || null,
          club_name: teamName,
          club_logo_url: teamLogoUrl
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('[create-player] Profile upsert error:', profileError.message)
      // Attempt clean up of auth user
      try {
        await adminFetch(`users/${userId}`, 'DELETE')
      } catch (cleanupErr) {
        console.error('[create-player] Clean up auth user failed:', cleanupErr.message)
      }
      return NextResponse.json({ error: 'Failed to create player profile record.' }, { status: 500 })
    }

    // Send player login credentials via SMS to registered phone
    let smsSent = false
    let smsError = null
    if (recipientPhone) {
      try {
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
        const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1')
        const loginUrl = !isLocal ? `https://${host}/login` : 'https://apextrackgh.com/login'

        const smsText = buildStaffLoginSMS({
          fullName: athlete.name,
          username: username.trim(),
          password,
          role: 'player',
          clubName: teamName,
          loginUrl
        })

        const smsRes = await sendSMS(recipientPhone, smsText, {
          teamId: resolvedTeamId,
          db
        })
        smsSent = Boolean(smsRes?.sent > 0 || smsRes?.ok === true)
        if (smsRes?.error) smsError = smsRes.error
        console.log(`[create-player] Credentials SMS sent to ${recipientPhone} (sent=${smsSent}):`, smsRes)
      } catch (smsErr) {
        console.error('[create-player] Error sending player credentials SMS:', smsErr?.message)
        smsError = smsErr?.message
      }
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      sms_sent: smsSent,
      phone: recipientPhone || null,
      sms_error: smsError,
      credentials: {
        username: username.trim(),
        password
      }
    })
  } catch (err) {
    console.error('POST create-player error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
