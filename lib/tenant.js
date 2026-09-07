import { supabase } from './supabase'

export const EMPTY_TEAM_ID = '00000000-0000-0000-0000-000000000000'
const LOCAL_PROFILE_KEY_PREFIX = 'apex_tenant_profile_'

// Unified cache keyed by user ID and active team so any caller (Layout, Notices, Dashboard, Athletes)
// shares the rich resolved profile without re-fetching from the network.
const profileCache = new Map() // key -> { data, timestamp }
const profilePromises = new Map() // key -> Promise
const CACHE_TTL = 30000 // 30 seconds

export async function getTenantProfile(select = '*, club_name, club_logo_url, teams(id, name, short_name, primary_color, logo_url)', forceRefresh = false) {
  const now = Date.now()

  let superadminActiveTeam = null
  if (typeof window !== 'undefined') {
    try {
      superadminActiveTeam = localStorage.getItem('apex_superadmin_active_team') || null
    } catch {
      // ignore
    }
  }

  // Quick read of current user ID from in-memory session
  let quickUserId = null
  try {
    const { data: { session: _s } } = await supabase.auth.getSession()
    quickUserId = _s?.user?.id || null
  } catch {
    // ignore
  }

  const cacheKey = `${quickUserId || 'current'}_${superadminActiveTeam || 'default'}`

  if (!forceRefresh && quickUserId) {
    const cached = profileCache.get(cacheKey)
    if (cached && (now - cached.timestamp < CACHE_TTL) && cached.data.profile) {
      return cached.data
    }
    if (profilePromises.has(cacheKey)) {
      return profilePromises.get(cacheKey)
    }
  }

  const promise = (async () => {
    try {
      // 1. Resolve auth session with retries for cold page loads / browser refreshes
      let session = null
      for (let sAttempt = 0; sAttempt < 4; sAttempt++) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.user) {
            session = data.session
            break
          }
        } catch (_e) {}
        if (sAttempt < 3) {
          await new Promise(r => setTimeout(r, 150 * (sAttempt + 1)))
        }
      }

      // Rehydrate from localStorage backup if cookies were delayed
      if (!session?.user && typeof window !== 'undefined') {
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
                session = setRes.session
              }
            }
          }
        } catch (_e) {}
      }

      if (!session?.user) {
        return { session: null, profile: null, teamId: null }
      }

      // Check if session access token is expired or expiring soon (within 30 seconds)
      if (session.expires_at && (session.expires_at * 1000 < Date.now() + 30000)) {
        try {
          const { data: refData } = await supabase.auth.refreshSession()
          if (refData?.session?.user) {
            session = refData.session
          }
        } catch (_refErr) {}
      }

      const userId = session.user.id
      const effectiveCacheKey = `${userId}_${superadminActiveTeam || 'default'}`

      // 2. Fetch profile from database with retry loop and backoff
      let profile = null
      let lastError = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select(select)
            .eq('id', userId)
            .maybeSingle()

          if (data) {
            profile = data
            lastError = null
            break
          }

          if (error) {
            lastError = error
            // If token expired during request, refresh session before retry
            if (error.message?.includes('JWT') || error.code === 'PGRST301' || error.message?.includes('token')) {
              try {
                const { data: refData } = await supabase.auth.refreshSession()
                if (refData?.session) session = refData.session
              } catch (_e) {}
            }
          }
        } catch (queryErr) {
          lastError = queryErr
        }

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)))
        }
      }

      // 3. Fallback: if complex select (e.g. relation join with teams) failed, query profiles directly
      if (!profile) {
        try {
          const { data: fallbackData } = await supabase
            .from('profiles')
            .select('id, full_name, role, team_id, email, club_name, club_logo_url, is_active, username, registration_status, athlete_id')
            .eq('id', userId)
            .maybeSingle()

          if (fallbackData) {
            profile = fallbackData
            lastError = null
          }
        } catch (_fbErr) {}
      }

      // 4. Last resort safety net: check localStorage snapshot for this user
      if (!profile && typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(`${LOCAL_PROFILE_KEY_PREFIX}${userId}`)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed?.id === userId) {
              profile = parsed
            }
          }
        } catch (_lsErr) {}
      }

      if (!profile) {
        console.error('getTenantProfile persistent failure:', lastError?.message)
        return { session, profile: null, teamId: null, error: lastError }
      }

      // Enrich role for staff (analyst/scout/physio) who are stored as 'coach' in profiles
      if (profile.role === 'coach') {
        try {
          const userEmail = (session.user.email || profile.email || '').toLowerCase()
          let staffMatch = null

          // 1. Check coaches table by user_id or email
          const { data: coachRecord } = await supabase
            .from('coaches')
            .select('id, staff_type, user_id')
            .or(`user_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ''}`)
            .maybeSingle()

          if (coachRecord?.staff_type) {
            staffMatch = coachRecord.staff_type.toLowerCase()
          }

          // 2. Check staff_logins table by email or username
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

      // If user is superadmin, allow inspecting any selected club or fallback to first available team
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
          if (firstTeam?.id) {
            teamId = firstTeam.id
          }
        }
      } else if (!teamId) {
        const { data: firstTeam } = await supabase.from('teams').select('id, name, short_name, primary_color, logo_url').limit(1).maybeSingle()
        if (firstTeam?.id) {
          teamId = firstTeam.id
        }
      }

      // Fetch team details if missing or not an object
      let teamData = profile.teams || null
      if (teamId && (!teamData || typeof teamData !== 'object' || !teamData.name)) {
        try {
          const { data: t } = await supabase
            .from('teams')
            .select('id, name, short_name, primary_color, logo_url')
            .eq('id', teamId)
            .maybeSingle()
          if (t) teamData = t
        } catch (_tErr) {}
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
        teamId: teamId,
      }

      // Only cache successful results that have a real profile
      profileCache.set(effectiveCacheKey, { data: result, timestamp: Date.now() })

      // Persist in localStorage for instant recovery across page refreshes
      if (typeof window !== 'undefined' && userId) {
        try {
          localStorage.setItem(`${LOCAL_PROFILE_KEY_PREFIX}${userId}`, JSON.stringify(resultProfile))
        } catch (_lsWriteErr) {}
      }

      return result
    } catch (err) {
      console.error('[tenant] Unexpected getTenantProfile error:', err)
      return { session: null, profile: null, teamId: null, error: err }
    } finally {
      if (quickUserId) {
        profilePromises.delete(cacheKey)
      }
      profilePromises.delete('current_default')
    }
  })()

  if (quickUserId) {
    profilePromises.set(cacheKey, promise)
  }
  return promise
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
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
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

export function scopeTeam(query, teamId) {
  return query.eq('team_id', tenantIdOrEmpty(teamId))
}

export async function fetchWithAuth(input, init = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers || {})

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
