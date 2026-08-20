// Revert payroll and financial system additions
import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password: password,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
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
    return { ...data, email: session.user.email }
  } catch {
    return null
  }
}

// billing added — admin/superadmin only
export const ROLE_PERMISSIONS = {
  superadmin:  ['superadmin','dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers','pay'],
  admin:       ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers','pay'],
  coach:       ['dashboard','athletes','coaches','schedule','injuries','performance','settings','transfers'],
  physio:      ['dashboard','athletes','injuries','settings'],
  analyst:     ['dashboard','athletes','performance','reports','settings','transfers'],
  scout:       ['dashboard','scouting','athletes','settings','transfers'],
  player:      ['player-hub','settings'],
  accountant:  ['settings'],
}

export function canAccess(role, page) {
  return (ROLE_PERMISSIONS[role] || []).includes(page)
}