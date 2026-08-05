import { supabase } from './supabase'

export const EMPTY_TEAM_ID = '00000000-0000-0000-0000-000000000000'

// Cache keyed by select string so different callers don't stomp each other
const profileCache = new Map() // key -> { data, timestamp }
const profilePromises = new Map() // key -> Promise
const CACHE_TTL = 15000 // 15 seconds

export async function getTenantProfile(select = 'id,full_name,role,team_id,email', forceRefresh = false) {
  const now = Date.now()
  const key = select

  if (!forceRefresh) {
    const cached = profileCache.get(key)
    if (cached && (now - cached.timestamp < CACHE_TTL) && cached.data.profile) {
      return cached.data
    }
    if (profilePromises.has(key)) {
      return profilePromises.get(key)
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
      if (!teamId) {
        const { data: firstTeam } = await supabase.from('teams').select('id').limit(1).maybeSingle()
        if (firstTeam?.id) {
          teamId = firstTeam.id
        }
      }

      const result = {
        session,
        profile: { ...profile, email: session.user.email, team_id: teamId },
        teamId: teamId,
      }
      // Only cache successful results that have a profile
      profileCache.set(key, { data: result, timestamp: Date.now() })
      return result
    } catch (err) {
      return { session: null, profile: null, teamId: null, error: err }
    } finally {
      profilePromises.delete(key)
    }
  })()

  profilePromises.set(key, promise)
  return promise
}

export function invalidateTenantProfileCache() {
  profileCache.clear()
  profilePromises.clear()
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
