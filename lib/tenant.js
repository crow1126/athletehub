import { supabase } from './supabase'

export const EMPTY_TEAM_ID = '00000000-0000-0000-0000-000000000000'

export async function getTenantProfile(select = 'id,full_name,role,team_id,email') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { session: null, profile: null, teamId: null }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(select)
    .eq('id', session.user.id)
    .single()

  if (error || !profile) {
    return { session, profile: null, teamId: null, error }
  }

  return {
    session,
    profile: { ...profile, email: session.user.email },
    teamId: profile.team_id || null,
  }
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
