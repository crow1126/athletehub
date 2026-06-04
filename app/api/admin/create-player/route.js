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
    const { username, password, athlete_id } = await req.json()

    if (!username || !password || !athlete_id) {
      return NextResponse.json({ error: 'username, password and athlete_id are required' }, { status: 400 })
    }

    const email = `${username.trim().toLowerCase()}@players.apextrack.internal`

    const db = getDb()
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    // Fetch the athlete record to verify existence and team ownership
    const { data: athlete, error: athleteError } = await db
      .from('athletes')
      .select('id, name, team_id')
      .eq('id', athlete_id)
      .maybeSingle()

    if (athleteError || !athlete) {
      return NextResponse.json({ error: 'Athlete not found.' }, { status: 404 })
    }

    const resolvedTeamId = athlete.team_id
    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Athlete is not assigned to a club team.' }, { status: 400 })
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

    return NextResponse.json({
      success: true,
      user_id: userId,
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
