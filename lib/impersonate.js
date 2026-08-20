/**
 * lib/impersonate.js
 *
 * Client-side impersonation lifecycle manager.
 *
 * Flow:
 *   1. startImpersonation(userId) saves superadmin session to sessionStorage,
 *      calls /api/admin/impersonate to get a one-time magic-link token,
 *      then exchanges it for a real user session via supabase.auth.verifyOtp.
 *
 *   2. stopImpersonation() restores the saved superadmin session.
 *
 * The impersonated session has the target user's real JWT → all Supabase RLS
 * policies apply as if that user is logged in. This reproduces bugs that are
 * invisible when querying with service_role (which bypasses RLS entirely).
 */
import { supabase } from './supabase'

const STORAGE_KEY_INFO      = 'apex_impersonation_info'   // who we are impersonating
const STORAGE_KEY_SA_ACCESS = 'apex_sa_access_token'      // saved superadmin access token
const STORAGE_KEY_SA_REFRESH= 'apex_sa_refresh_token'     // saved superadmin refresh token

// ── Read / write helpers ─────────────────────────────────────────────────────

export function getImpersonationInfo() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_INFO)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isImpersonating() {
  return getImpersonationInfo() !== null
}

function saveImpersonationInfo(info) {
  sessionStorage.setItem(STORAGE_KEY_INFO, JSON.stringify(info))
}

function clearImpersonationInfo() {
  sessionStorage.removeItem(STORAGE_KEY_INFO)
  sessionStorage.removeItem(STORAGE_KEY_SA_ACCESS)
  sessionStorage.removeItem(STORAGE_KEY_SA_REFRESH)
}

// ── Core actions ─────────────────────────────────────────────────────────────

/**
 * Assume a user's real RLS session.
 * @param {string} userId  - The auth.uid() of the user to impersonate
 * @returns {{ ok: boolean, error?: string, info?: object }}
 */
export async function startImpersonation(userId) {
  if (typeof window === 'undefined') return { ok: false, error: 'Browser only' }

  try {
    // 1. Save current (superadmin) session so we can restore it later
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession) return { ok: false, error: 'No active session' }

    sessionStorage.setItem(STORAGE_KEY_SA_ACCESS,  currentSession.access_token)
    sessionStorage.setItem(STORAGE_KEY_SA_REFRESH, currentSession.refresh_token)

    // 2. Ask the server to generate a one-time magic-link token for the target user
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    })

    const data = await res.json()
    if (!res.ok) {
      // Restore on failure
      clearImpersonationInfo()
      return { ok: false, error: data.error || 'Impersonation failed' }
    }

    const { hashed_token, email, full_name, role, club_name, team_id } = data

    // 3. Exchange the one-time token for a real user session
    const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: hashed_token,
      email,
    })

    if (otpErr || !otpData?.session) {
      clearImpersonationInfo()
      return { ok: false, error: otpErr?.message || 'Token exchange failed' }
    }

    // 4. Store who we are impersonating
    const info = { userId, email, full_name, role, club_name, team_id, startedAt: Date.now() }
    saveImpersonationInfo(info)

    // 5. Signal the rest of the app to reload with the new session
    window.dispatchEvent(new CustomEvent('apex_impersonation_started', { detail: info }))

    return { ok: true, info }
  } catch (err) {
    clearImpersonationInfo()
    return { ok: false, error: err.message }
  }
}

/**
 * Restore the superadmin session and end impersonation.
 * @returns {{ ok: boolean, error?: string }}
 */
export async function stopImpersonation() {
  if (typeof window === 'undefined') return { ok: false, error: 'Browser only' }

  try {
    const savedAccess  = sessionStorage.getItem(STORAGE_KEY_SA_ACCESS)
    const savedRefresh = sessionStorage.getItem(STORAGE_KEY_SA_REFRESH)

    if (!savedAccess || !savedRefresh) {
      // Fallback: sign out completely and redirect to login
      clearImpersonationInfo()
      await supabase.auth.signOut()
      window.location.href = '/login'
      return { ok: true }
    }

    // Restore the superadmin session
    const { error } = await supabase.auth.setSession({
      access_token:  savedAccess,
      refresh_token: savedRefresh,
    })

    clearImpersonationInfo()

    if (error) {
      // Token expired — fall back to sign out
      await supabase.auth.signOut()
      window.location.href = '/login'
      return { ok: true }
    }

    window.dispatchEvent(new CustomEvent('apex_impersonation_ended'))
    return { ok: true }
  } catch (err) {
    clearImpersonationInfo()
    return { ok: false, error: err.message }
  }
}
