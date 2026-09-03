import { supabase } from './supabase'

export const EMPTY_TEAM_ID = '00000000-0000-0000-0000-000000000000'

// Cache keyed by select string so different callers don't stomp each other
const profileCache = new Map() // key -> { data, timestamp }
const profilePromises = new Map() // key -> Promise
const CACHE_TTL = 15000 // 15 seconds

export async function getTenantProfile(select = 'id,full_name,role,team_id,email', forceRefresh = false) {
  const now = Date.now()

  // Resolve current user ID to prevent cross-user cache pollution
  // (e.g., admin logs out → physio logs in and gets admin's stale profile)
  let currentUserId = null
  try {
    // This is a synchronous read from the in-memory session – no network call
    const { data: { session: _s } } = await supabase.auth.getSession()
    currentUserId = _s?.user?.id || null
  } catch {
    // ignore – will fall back to unauthenticated
  }

  let superadminActiveTeam = null
  if (typeof window !== 'undefined') {
    try {
      superadminActiveTeam = localStorage.getItem('apex_superadmin_active_team') || null
    } catch {
      // ignore localstorage errors
    }
  }

  // Key includes user ID so two different users on the same browser session
  // never share a cached profile entry.
  const cacheKey = `${currentUserId || 'anon'}_${select}_${superadminActiveTeam || 'default'}`

  if (!forceRefresh) {
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return { session: null, profile: null, teamId: null }
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select(select)
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        console.error('getTenantProfile error:', error?.message)
        return { session, profile: null, teamId: null, error }
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

      // Fetch team details if available
      let teamData = profile.teams || null
      if (teamId && (!teamData || typeof teamData !== 'object')) {
        const { data: t } = await supabase.from('teams').select('id, name, short_name, primary_color, logo_url').eq('id', teamId).maybeSingle()
        if (t) teamData = t
      }

      const resolvedClubName = teamData?.name || (profile.role === 'superadmin' ? 'Superadmin Suite' : profile.club_name) || 'Admin Workspace'
      const resolvedClubLogo = teamData?.logo_url || (profile.role === 'superadmin' ? null : profile.club_logo_url) || null

      const result = {
        session,
        profile: {
          ...profile,
          email: session.user.email,
          team_id: teamId,
          teams: teamData || null,
          club_name: resolvedClubName,
          club_logo_url: resolvedClubLogo,
        },
        teamId: teamId,
      }
      // Only cache successful results that have a profile
      profileCache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (err) {
      return { session: null, profile: null, teamId: null, error: err }
    } finally {
      profilePromises.delete(cacheKey)
    }
  })()

  profilePromises.set(cacheKey, promise)
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
