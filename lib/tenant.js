import { supabase } from './supabase'

export const EMPTY_TEAM_ID = '00000000-0000-0000-0000-000000000000'
const LOCAL_PROFILE_KEY_PREFIX = 'apex_tenant_profile_'
const LAST_USER_KEY = 'apex_last_user_id'

// Unified cache keyed by user ID and active team so any caller (Layout, Notices, Dashboard, Athletes)
// shares the rich resolved profile without re-fetching from the network.
const profileCache = new Map() // key -> { data, timestamp }
const profilePromises = new Map() // key -> Promise
const CACHE_TTL = 30000 // 30 seconds

let authSessionPromise = null

/**
 * Robustly ensures Supabase client has a valid, active session with a Bearer token.
 * Deduplicates parallel calls so Layout and Pages share one session resolution.
 */
export async function getValidAuthSession() {
  if (typeof window === 'undefined') return null
  if (authSessionPromise) return authSessionPromise

  authSessionPromise = (async () => {
    try {
      // 1. Direct check from client
      const { data } = await supabase.auth.getSession()
      let s = data?.session || null

      // Rehydrate from localStorage backup if cookies were delayed
      if (!s?.user) {
        try {
          const rawBackup = localStorage.getItem('sb-session-backup')
          if (rawBackup) {
            const parsed = JSON.parse(rawBackup)
            if (parsed?.access_token && parsed?.refresh_token) {
              const { data: setRes } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              })
              if (setRes?.session?.user) {
                s = setRes.session
              }
            }
          }
        } catch (_e) {}
      }

      // If session exists but is expired or expiring in < 30 seconds, refresh it
      if (s?.user && s.expires_at && (s.expires_at * 1000 < Date.now() + 30000)) {
        try {
          const { data: refData } = await supabase.auth.refreshSession()
          if (refData?.session?.user) {
            s = refData.session
          }
        } catch (_refErr) {}
      }

      return s?.user ? s : null
    } catch (err) {
      console.warn('[tenant] Auth session resolution error:', err)
      return null
    } finally {
      authSessionPromise = null
    }
  })()

  return authSessionPromise
}

export async function getTenantProfile(select = '', forceRefresh = false) {
  const now = Date.now()

  let superadminActiveTeam = null
  if (typeof window !== 'undefined') {
    try {
      superadminActiveTeam = localStorage.getItem('apex_superadmin_active_team') || null
    } catch {}
  }

  // 1. In-memory warm cache: instantaneous return (0ms)
  if (!forceRefresh) {
    for (const [key, cached] of profileCache.entries()) {
      if (cached && (now - cached.timestamp < CACHE_TTL) && cached.data?.profile && cached.data?.session) {
        if (key.endsWith(`_${superadminActiveTeam || 'default'}`)) {
          return cached.data
        }
      }
    }
  }

  // 2. Deduplicate in-flight requests across concurrent callers (Layout, Page, Header)
  const promiseKey = `profile_${superadminActiveTeam || 'default'}`
  if (!forceRefresh && profilePromises.has(promiseKey)) {
    return profilePromises.get(promiseKey)
  }

  const p = _doFetchProfile(superadminActiveTeam)
  profilePromises.set(promiseKey, p)
  p.finally(() => profilePromises.delete(promiseKey))
  return p
}

async function _doFetchProfile(superadminActiveTeam) {
  try {
    const session = await getValidAuthSession()
    if (!session?.user) {
      return { session: null, profile: null, teamId: null }
    }

    const userId = session.user.id
    const effectiveCacheKey = `${userId}_${superadminActiveTeam || 'default'}`
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(LAST_USER_KEY, userId) } catch {}
    }

    // 1. Query profile directly without relation joins that can fail if FK schema cache is missing
    let profile = null
    try {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name, role, team_id, email, club_name, club_logo_url, is_active, username, registration_status, athlete_id')
        .eq('id', userId)
        .maybeSingle()
      if (pData) profile = pData
    } catch (_pErr) {}

    // Fallback: check localStorage snapshot for this user
    if (!profile && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${LOCAL_PROFILE_KEY_PREFIX}${userId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed?.id === userId) profile = parsed
        }
      } catch {}
    }

    if (!profile) {
      return { session, profile: null, teamId: null }
    }

    // Enrich role for staff (analyst/scout/physio) who are stored as 'coach' in profiles
    if (profile.role === 'coach') {
      try {
        const userEmail = (session.user.email || profile.email || '').toLowerCase()
        let staffMatch = null

        const { data: coachRecord } = await supabase
          .from('coaches')
          .select('id, staff_type')
          .or(`user_id.eq.${userId},email.eq.${userEmail}`)
          .maybeSingle()

        if (coachRecord?.staff_type) {
          staffMatch = coachRecord.staff_type.toLowerCase()
        }

        if (!staffMatch && (userEmail || profile.username)) {
          const filters = []
          if (userEmail) filters.push(`email.eq.${userEmail}`)
          if (profile.username) filters.push(`username.eq.${profile.username}`)
          const { data: loginRecord } = await supabase
            .from('staff_logins')
            .select('id, role')
            .or(filters.join(','))
            .maybeSingle()

          if (loginRecord?.role) {
            staffMatch = loginRecord.role.toLowerCase()
          }
        }

        if (staffMatch === 'analyst' || staffMatch === 'scout' || staffMatch === 'physio') {
          profile.role = staffMatch
          profile.staff_type = staffMatch
        }
      } catch (enrichErr) {
        console.warn('[tenant] Staff role enrichment warning:', enrichErr?.message)
      }
    }

    let teamId = profile.team_id || null

    if (profile.role === 'superadmin') {
      if (superadminActiveTeam) {
        teamId = superadminActiveTeam
      } else {
        const { data: firstTeam } = await supabase
          .from('teams')
          .select('id, name, short_name, primary_color, logo_url')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (firstTeam?.id) teamId = firstTeam.id
      }
    } else if (!teamId) {
      const { data: firstTeam } = await supabase
        .from('teams')
        .select('id, name, short_name, primary_color, logo_url')
        .limit(1)
        .maybeSingle()
      if (firstTeam?.id) teamId = firstTeam.id
    }

    // Fetch team details separately to guarantee club name/logo is populated
    let teamData = null
    if (teamId) {
      try {
        const { data: t } = await supabase
          .from('teams')
          .select('id, name, short_name, primary_color, logo_url')
          .eq('id', teamId)
          .maybeSingle()
        if (t) teamData = t
      } catch {}
    }

    const resolvedClubName = teamData?.name || (profile.role === 'superadmin' ? 'Superadmin Suite' : profile.club_name) || 'Admin Workspace'
    const resolvedClubLogo = teamData?.logo_url || (profile.role === 'superadmin' ? null : profile.club_logo_url) || null

    const resultProfile = {
      ...profile,
      email: session.user.email || profile.email,
      team_id: teamId,
      teams: teamData || null,
      club_name: resolvedClubName,
      club_logo_url: resolvedClubLogo,
    }

    const result = {
      session,
      profile: resultProfile,
      teamId,
    }

    profileCache.set(effectiveCacheKey, { data: result, timestamp: Date.now() })

    if (typeof window !== 'undefined' && userId) {
      try {
        localStorage.setItem(`${LOCAL_PROFILE_KEY_PREFIX}${userId}`, JSON.stringify(resultProfile))
      } catch {}
    }

    return result
  } catch (err) {
    console.error('[tenant] Unexpected getTenantProfile error:', err)
    return { session: null, profile: null, teamId: null, error: err }
  }
}

export function invalidateTenantProfileCache() {
  profileCache.clear()
  profilePromises.clear()
}

export function setSuperadminActiveTeam(teamId) {
  if (typeof window !== 'undefined') {
    try {
      if (teamId) {
        localStorage.setItem('apex_superadmin_active_team', teamId)
      } else {
        localStorage.removeItem('apex_superadmin_active_team')
      }
    } catch {}
    invalidateTenantProfileCache()
    window.dispatchEvent(new CustomEvent('apex_superadmin_team_changed', { detail: { teamId } }))
  }
}

export function getSuperadminActiveTeam() {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('apex_superadmin_active_team') || null
    } catch {
      return null
    }
  }
  return null
}

export function setSuperadminReadOnly(isReadOnly) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('apex_superadmin_readonly', isReadOnly ? 'true' : 'false')
    } catch {}
    window.dispatchEvent(new CustomEvent('apex_superadmin_readonly_changed', { detail: { isReadOnly } }))
  }
}

export function isSuperadminReadOnly() {
  if (typeof window !== 'undefined') {
    try {
      const val = localStorage.getItem('apex_superadmin_readonly')
      if (val === null) {
        const activeTeam = localStorage.getItem('apex_superadmin_active_team')
        return !!activeTeam && activeTeam !== 'sandbox'
      }
      return val === 'true'
    } catch {
      return false
    }
  }
  return false
}

export function tenantIdOrEmpty(teamId) {
  return teamId || EMPTY_TEAM_ID
}

/**
 * Scope a Supabase query to the current team.
 * If teamId is null/undefined (auth not yet resolved) we use EMPTY_TEAM_ID
 * which guarantees zero rows rather than returning all rows.
 */
export function scopeTeam(query, teamId) {
  return query.eq('team_id', tenantIdOrEmpty(teamId))
}

/**
 * Returns the last-known teamId synchronously from localStorage so pages can
 * pre-populate teamId before getTenantProfile() resolves on cold start.
 */
export function getLastKnownTeamId() {
  if (typeof window === 'undefined') return null
  try {
    const userId = localStorage.getItem(LAST_USER_KEY)
    if (!userId) return null
    const raw = localStorage.getItem(`${LOCAL_PROFILE_KEY_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const superadminTeam = localStorage.getItem('apex_superadmin_active_team')
    return superadminTeam || parsed?.team_id || null
  } catch {
    return null
  }
}

export async function fetchWithAuth(input, init = {}) {
  const session = await getValidAuthSession()
  const headers = new Headers(init.headers || {})

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
