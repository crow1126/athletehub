/**
 * Confirm auth email and activate profile after email verification.
 * Automatically ensures team and trial subscription exist so user is 100% ready to use the app.
 */
export async function activateUserProfile(db, userId) {
  if (!userId) {
    throw new Error('user_id is required')
  }

  const { data: authData, error: authError } = await db.auth.admin.getUserById(userId)
  if (authError || !authData?.user) {
    throw new Error('Verification failed: User auth record not found.')
  }

  const user = authData.user
  const isEmailConfirmed = !!(user.email_confirmed_at || user.confirmed_at)
  if (!isEmailConfirmed) {
    const { error: confirmError } = await db.auth.admin.updateUserById(userId, { email_confirm: true })
    if (confirmError) {
      throw new Error('Please confirm your email address before activating your account.')
    }
  }

  const { data: profile, error: profileGetError } = await db
    .from('profiles')
    .select('id, registration_status, is_active, club_name, club_logo_url, team_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileGetError || !profile) {
    throw new Error('Profile not found.')
  }

  let teamId = profile.team_id

  // If user has a club name, ensure team and subscription exist
  if (profile.club_name && profile.club_name.trim()) {
    const trimmedClub = profile.club_name.trim()

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

        const { data: newTeam, error: teamErr } = await db
          .from('teams')
          .insert([{
            name: trimmedClub,
            short_name: shortName,
            logo_url: profile.club_logo_url || null,
            sport_type: 'football',
          }])
          .select()
          .single()

        if (!teamErr && newTeam) {
          teamId = newTeam.id
        }
      }
    }

    if (teamId) {
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('id')
        .eq('team_id', teamId)
        .maybeSingle()

      if (!existingSub) {
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + 30)

        await db.from('subscriptions').insert([{
          team_id: teamId,
          plan: 'trial',
          status: 'active',
          athlete_limit: 999,
          staff_limit: 99,
          trial_ends_at: trialEnd.toISOString(),
          current_period_end: trialEnd.toISOString(),
          notes: 'Auto-provisioned on email verification'
        }])
      }
    }
  }

  const { error: updateError } = await db
    .from('profiles')
    .update({
      is_active: true,
      registration_status: 'approved',
      approved_at: new Date().toISOString(),
      team_id: teamId || null,
    })
    .eq('id', userId)

  if (updateError) {
    throw new Error('Failed to activate profile: ' + updateError.message)
  }

  return { alreadyActive: false, team_id: teamId }
}

