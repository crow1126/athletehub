// lib/payFetch.js
// Authenticated fetch helper for ApexPay client pages
import { supabase } from '@/lib/supabase'

/**
 * Fetch wrapper that injects the current session's Bearer token.
 * Usage: const { data, res } = await payFetch('/api/pay/wallet?team_id=…')
 */
export async function payFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  }

  const res  = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

/**
 * Convenience: get the current session access_token
 */
export async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}
