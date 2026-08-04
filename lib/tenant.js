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

export async function getUserTeams(email) {
  if (!email) return []
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, team_id, club_name, role, teams(id, name, short_name, logo_url, sport_type)')
      .ilike('email', email.trim())

    if (!profiles) return []

    // Deduplicate by team_id
    const teamsMap = new Map()
    profiles.forEach(p => {
      if (p.teams?.id) {
        teamsMap.set(p.teams.id, {
          id: p.teams.id,
          name: p.teams.name || p.club_name || 'Team',
          shortName: p.teams.short_name || '',
          logoUrl: p.teams.logo_url || null,
          sportType: p.teams.sport_type || 'football',
          profileId: p.id,
          role: p.role || 'admin',
        })
      }
    })

    return Array.from(teamsMap.values())
  } catch (e) {
    console.error('Error fetching user teams:', e)
    return []
  }
}

export async function switchActiveTeam(teamId) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('active_team_id', teamId)
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    await supabase.from('profiles').update({ team_id: teamId }).eq('id', session.user.id)
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
