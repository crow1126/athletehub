// Revert payroll and financial system additions
import { supabase } from './supabase.js'
import { invalidateTenantProfileCache } from './tenant.js'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password: password,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  invalidateTenantProfileCache()
  await supabase.auth.signOut()
}

export async function getProfile() {
  try {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*, teams(id, name, short_name, primary_color, logo_url)')
      .eq('id', session.user.id)
      .single()
    if (error || !data) return null
    const profile = { ...data, email: session.user.email }

    if (profile.role === 'coach') {
      try {
        const userEmail = (session.user.email || profile.email || '').toLowerCase()
        let staffMatch = null

        const { data: coachRecord } = await supabase
          .from('coaches')
          .select('id, staff_type, user_id')
          .or(`user_id.eq.${session.user.id}${userEmail ? `,email.eq.${userEmail}` : ''}`)
          .maybeSingle()

        if (coachRecord?.staff_type) staffMatch = coachRecord.staff_type.toLowerCase()

        if (!staffMatch && (userEmail || profile.username)) {
          const filters = []
          if (userEmail) filters.push(`email.eq.${userEmail}`)
          if (profile.username) filters.push(`username.eq.${profile.username}`)
          const { data: loginRecord } = await supabase
            .from('staff_logins')
            .select('id, role')
            .or(filters.join(','))
            .maybeSingle()
          if (loginRecord?.role) staffMatch = loginRecord.role.toLowerCase()
        }

        if (staffMatch === 'analyst' || staffMatch === 'scout' || staffMatch === 'physio') {
          profile.role = staffMatch
          profile.staff_type = staffMatch
        }
      } catch {
        // preserve coach fallback
      }
    }

    return profile
  } catch {
    return null
  }
}

// billing added — admin/superadmin only; pay removed (Coming Soon)
export const ROLE_PERMISSIONS = {
  superadmin:  ['superadmin','dashboard','notices','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers'],
  admin:       ['dashboard','notices','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers'],
  coach:       ['dashboard','notices','athletes','coaches','schedule','injuries','performance','settings','transfers'],
  physio:      ['dashboard','notices','athletes','injuries','reports','settings'],
  analyst:     ['dashboard','notices','athletes','performance','reports','settings','transfers'],
  scout:       ['dashboard','notices','scouting','athletes','settings','transfers'],
  player:      ['player-hub','notices','settings'],
  accountant:  ['dashboard','notices','reports','billing','settings'],
}

export function canAccess(role, page) {
  return (ROLE_PERMISSIONS[role] || []).includes(page)
}