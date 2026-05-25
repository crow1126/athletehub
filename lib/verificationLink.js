/**
 * Build a Supabase email verification link for an existing auth user.
 * Tries magiclink first (works after client signUp), then invite.
 */
export async function createEmailVerificationLink(db, email, redirectTo) {
  const normalizedEmail = email?.trim()?.toLowerCase()
  if (!normalizedEmail) return null

  const attempts = [
    { type: 'magiclink', options: { redirectTo } },
    { type: 'invite', options: { redirectTo } },
  ]

  for (const attempt of attempts) {
    try {
      const { data, error } = await db.auth.admin.generateLink({
        type: attempt.type,
        email: normalizedEmail,
        options: attempt.options,
      })

      if (error) {
        console.warn(`generateLink(${attempt.type}) failed:`, error.message)
        continue
      }

      const link =
        data?.properties?.action_link ||
        data?.action_link ||
        data?.properties?.actionLink ||
        null

      if (link) return link
    } catch (err) {
      console.warn(`generateLink(${attempt.type}) error:`, err.message)
    }
  }

  return null
}
