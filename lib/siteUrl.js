/**
 * Canonical public site URL used in auth redirect links.
 */
export function getSiteUrl(fallbackOrigin) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
  if (configured) return configured.replace(/\/$/, '')

  if (fallbackOrigin) {
    try {
      return new URL(fallbackOrigin).origin
    } catch {
      return fallbackOrigin.replace(/\/$/, '')
    }
  }

  return 'https://apextrackgh.com'
}

export function getAuthCallbackUrl(fallbackOrigin) {
  return `${getSiteUrl(fallbackOrigin)}/auth/callback`
}
