import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { user_id, full_name, club_name, email, logo_url } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const db = getDb()
    let teamId = null
    let assignedRole = 'admin'

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
    // New club admins start INACTIVE — they must confirm their email first.
    // Club joiners (existing team, assigned 'coach') are activated immediately
    // because they are not registering a fresh club, they are joining an existing one.
    const isNewClubAdmin = assignedRole === 'admin'
    
    let actionLink = null
    let autoActivated = false

    if (isNewClubAdmin) {
      try {
        const origin = req.headers.get('origin') || new URL(req.url).origin
        const redirectTo = `${origin}/auth/confirm`
        const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
          type: 'signup',
          email: email.trim().toLowerCase(),
          options: { redirectTo }
        })

        if (linkError) {
          if (linkError.message.includes('already') || linkError.message.includes('registered')) {
            console.log('User is already confirmed in Supabase. Auto-activating profile...')
            autoActivated = true
          } else {
            console.error('Failed to generate verification link:', linkError.message)
          }
        } else {
          actionLink = linkData?.properties?.action_link || null
        }
      } catch (linkErr) {
        console.error('Link generation error:', linkErr.message)
      }
    }

    const shouldBeActive = !isNewClubAdmin || autoActivated
    const { error: profileError } = await db
      .from('profiles')
      .upsert({
        id: user_id,
        full_name: full_name || email,
        email: email,
        club_name: club_name?.trim() || null,
        club_logo_url: logo_url || null,
        role: assignedRole,
        is_active: shouldBeActive,
        registration_status: shouldBeActive ? 'approved' : 'pending_email_verification',
        approved_at: shouldBeActive ? new Date().toISOString() : null,
        team_id: teamId,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile update failed:', profileError.message)
      return NextResponse.json({ error: 'Profile update failed: ' + profileError.message }, { status: 500 })
    }

    // ── Step 4: Send welcome email (non-blocking) ────────────────────────
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
      message: teamId
        ? `Team provisioned with 30-day trial. Role: ${assignedRole}`
        : 'Account activated (no club specified)',
    })
  } catch (err) {
    console.error('Signup provision error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
