/**
 * Confirm auth email and activate profile after email verification.
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
    .select('registration_status, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profileGetError || !profile) {
    throw new Error('Profile not found.')
  }

  if (profile.is_active && profile.registration_status === 'approved') {
    return { alreadyActive: true }
  }

  const { error: updateError } = await db
    .from('profiles')
    .update({
      is_active: true,
      registration_status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    throw new Error('Failed to activate profile: ' + updateError.message)
  }

  return { alreadyActive: false }
}
