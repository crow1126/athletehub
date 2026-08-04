import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createEmailVerificationLink } from '@/lib/verificationLink'
import { getSiteUrl } from '@/lib/siteUrl'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * GET /api/signup-provision
 *
 * Check if a team name already exists (case-insensitive)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const clubName = searchParams.get('club_name')
    if (!clubName || !clubName.trim()) {
      return NextResponse.json({ exists: false })
    }

    const db = getDb()
    const { data: existingTeam } = await db
      .from('teams')
      .select('id')
      .ilike('name', clubName.trim())
      .maybeSingle()

    return NextResponse.json({ exists: !!existingTeam })
  } catch (err) {
    console.error('Club check error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/signup-provision
 *
 * Called after supabase.auth.signUp() succeeds.
 * Automatically provisions: team → subscription → profile activation.
 *
 * Body: { user_id, full_name, club_name, email }
 */
export async function POST(req) {
  try {
    const { user_id, full_name, club_name, email, logo_url, sport_type } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const db = getDb()
    let teamId = null
    let assignedRole = 'admin'

    function normalizeSport(s) {
      if (!s) return 'football'
      const low = String(s).toLowerCase().trim()
      if (low === 'soccer') return 'football'
      return low
    }

    const requestedSport = normalizeSport(sport_type)

    // Check if email is already bound to a different sport type
    if (email && email.trim()) {
      const { data: existingProfiles } = await db
        .from('profiles')
        .select('id, team_id, teams(sport_type)')
        .eq('email', email.trim().toLowerCase())

      if (existingProfiles && existingProfiles.length > 0) {
        for (const p of existingProfiles) {
          if (p.id !== user_id && p.teams?.sport_type) {
            const existingSport = normalizeSport(p.teams.sport_type)
            if (existingSport !== requestedSport) {
              const existingName = existingSport === 'basketball' ? 'Basketball' : 'Football'
              const requestedName = requestedSport === 'basketball' ? 'Basketball' : 'Football'
              return NextResponse.json({
                error: `This email is already registered under the ${existingName} platform. Emails used for ${existingName} cannot be used on the ${requestedName} platform.`
              }, { status: 409 })
            }
          }
        }
      }
    }

    // ── Step 1: Find or create team ──────────────────────────────────────
    if (club_name && club_name.trim()) {
      const trimmedClub = club_name.trim()

      // Check if a team with this name already exists (case-insensitive)
      const { data: existingTeam } = await db
        .from('teams')
        .select('id, name')
        .ilike('name', trimmedClub)
        .maybeSingle()

      if (existingTeam?.id) {
        return NextResponse.json({ error: 'A club with this name is already registered.' }, { status: 409 })
      } else {
        // Create new team
        const shortName = trimmedClub
          .split(' ')
          .map(w => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 4)

        const { data: newTeam, error: teamError } = await db
          .from('teams')
          .insert([{
            name: trimmedClub,
            short_name: shortName,
            logo_url: logo_url || null,
            sport_type: requestedSport,
          }])
          .select()
          .single()

        if (teamError) {
          console.error('Team creation failed:', teamError.message)
        } else {
          teamId = newTeam.id
        }
      }
    }

    // ── Step 2: Create trial subscription ────────────────────────────────
    if (teamId) {
      // Check if subscription already exists for this team
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('id')
        .eq('team_id', teamId)
        .maybeSingle()

      if (!existingSub) {
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + 30)

        const { error: subError } = await db
          .from('subscriptions')
          .insert([{
            team_id: teamId,
            plan: 'trial',
            status: 'active',
            trial_ends_at: trialEnd.toISOString(),
            current_period_end: trialEnd.toISOString(),
          }])

        if (subError) {
          console.error('Subscription creation failed:', subError.message)
        }
      }
    }

    // ── Step 3: Create profile ────────────────────────────────────────────
    // New club admins start INACTIVE — they must verify their email first
    // via a dedicated verification landing page (/auth/confirm).
    const origin = req.headers.get('origin') || new URL(req.url).origin
    const siteUrl = getSiteUrl(origin)
    const redirectTo = `${siteUrl}/auth/confirm`
    const actionLink = await createEmailVerificationLink(db, email, redirectTo)

    if (!actionLink) {
      console.error('Failed to generate verification link for:', email)
    }

    const { error: profileError } = await db
      .from('profiles')
      .upsert({
        id: user_id,
        full_name: full_name || email,
        email: email,
        club_name: club_name?.trim() || null,
        club_logo_url: logo_url || null,
        role: assignedRole,
        is_active: false,
        registration_status: 'pending_email_verification',
        approved_at: null,
        team_id: teamId,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile update failed:', profileError.message)
      return NextResponse.json({ error: 'Profile update failed: ' + profileError.message }, { status: 500 })
    }

    // ── Step 4: Send welcome email with verification link (non-blocking) ─
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: full_name || email,
          email: email,
          club_name: club_name?.trim() || null,
          action_link: actionLink,
          app_url: siteUrl,
        }),
      })
    } catch (emailErr) {
      console.warn('Welcome email failed (non-blocking):', emailErr.message)
    }

    return NextResponse.json({
      success: true,
      team_id: teamId,
      role: assignedRole,
      plan: 'trial',
      verification_email_sent: !!actionLink,
      message: teamId
        ? `Team provisioned with 30-day trial. Role: ${assignedRole}`
        : 'Account activated (no club specified)',
    })
  } catch (err) {
    console.error('Signup provision error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
