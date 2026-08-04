import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function normalizeSport(s) {
  if (!s) return 'football'
  const low = String(s).toLowerCase().trim()
  if (low === 'soccer') return 'football'
  return low
}

export async function POST(req) {
  try {
    const { email, sport_type } = await req.json()

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    const db = getDb()
    const cleanEmail = email.trim().toLowerCase()

    const { data: profiles, error } = await db
      .from('profiles')
      .select('id, team_id, teams(sport_type)')
      .eq('email', cleanEmail)

    if (error) {
      console.error('Check email DB error:', error.message)
      return NextResponse.json({ error: 'Database lookup error' }, { status: 500 })
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ exists: false, conflict: false })
    }

    // Find the sport associated with existing profile/team
    let existingSport = 'football'
    for (const p of profiles) {
      if (p.teams?.sport_type) {
        existingSport = normalizeSport(p.teams.sport_type)
        break
      }
    }

    if (sport_type) {
      const requestedSport = normalizeSport(sport_type)
      if (existingSport !== requestedSport) {
        const existingName = existingSport === 'basketball' ? 'Basketball' : 'Football'
        const requestedName = requestedSport === 'basketball' ? 'Basketball' : 'Football'
        return NextResponse.json({
          exists: true,
          conflict: true,
          existingSport,
          requestedSport,
          error: `This email is already registered under the ${existingName} platform. Emails used for ${existingName} cannot be used on the ${requestedName} platform.`,
        })
      }
    }

    return NextResponse.json({ exists: true, conflict: false, existingSport })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
