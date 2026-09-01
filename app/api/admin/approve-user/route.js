import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'

export async function POST(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin privilege required' }, { status: 403 })
    }

    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // 1. Fetch user profile
    const { data: p, error: pError } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (pError || !p) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    let teamId = p.team_id

    // 2. Find or create team if club_name is set
    if (p.club_name && p.club_name.trim()) {
      const trimmedClub = p.club_name.trim()

      if (!teamId) {
        const { data: existingTeam } = await db
          .from('teams')
          .select('id')
          .ilike('name', trimmedClub)
          .maybeSingle()

        if (existingTeam?.id) {
          teamId = existingTeam.id
        } else {
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
              logo_url: p.club_logo_url || null,
            }])
            .select()
            .single()

          if (teamError) {
            console.error('Failed to create team for approved user:', teamError.message)
          } else {
            teamId = newTeam.id
          }
        }
      }

      // 3. Ensure subscription exists for this team
      if (teamId) {
        const { data: existingSub } = await db
          .from('subscriptions')
          .select('id')
          .eq('team_id', teamId)
          .maybeSingle()

        if (!existingSub) {
          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + 30)

          await db
            .from('subscriptions')
            .insert([{
              team_id: teamId,
              plan: 'trial',
              status: 'active',
              athlete_limit: 999,
              staff_limit: 99,
              trial_ends_at: trialEnd.toISOString(),
              current_period_end: trialEnd.toISOString(),
              notes: 'Auto-provisioned on Superadmin approval'
            }])
        }
      }
    }

    // 4. Update profile
    const { error: updateError } = await db
      .from('profiles')
      .update({
        is_active: true,
        registration_status: 'approved',
        approved_at: new Date().toISOString(),
        team_id: teamId || null,
      })
      .eq('id', userId)

    if (updateError) throw updateError

    // 5. Confirm email in auth.users
    try {
      await db.auth.admin.updateUserById(userId, { email_confirm: true })
    } catch (authErr) {
      console.warn('Email auto-confirm notice:', authErr.message)
    }

    // 6. Send welcome email (non-blocking)
    try {
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.apextrackgh.com'
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: p.full_name,
          email: p.email,
          club_name: p.club_name,
          app_url: origin,
        }),
      })
    } catch (emailErr) {
      console.warn('Welcome notification warning:', emailErr.message)
    }

    return NextResponse.json({
      success: true,
      team_id: teamId,
      user_id: userId,
      message: `User ${p.full_name || p.email} approved and team successfully provisioned.`
    })
  } catch (err) {
    console.error('Approve user error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
