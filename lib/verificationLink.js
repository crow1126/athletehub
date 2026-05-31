/**
 * Build a Supabase email verification link for an existing auth user.
 * Prefer signup links for password signups, then magiclink as fallback.
 */
export async function createEmailVerificationLink(db, email, redirectTo) {
  const normalizedEmail = email?.trim()?.toLowerCase()
  if (!normalizedEmail) return null

  const attempts = [
    { type: 'signup', options: { redirectTo } },
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

      if (link) {
        try {
          const urlObj = new URL(link)
          const tokenHash = urlObj.searchParams.get('token')
          const type = urlObj.searchParams.get('type') || attempt.type
          
          if (tokenHash && type) {
            // Reconstruct the link to point directly to our app's confirm page
            // This prevents auto-consumption by mobile email clients / pre-fetch security scanners
            return `${redirectTo}?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`
          }
        } catch (parseErr) {
          console.warn('Failed to parse generateLink URL, returning original link:', parseErr.message)
        }
        return link
      }
    } catch (err) {
      console.warn(`generateLink(${attempt.type}) error:`, err.message)
    }
  }

  return null
}
