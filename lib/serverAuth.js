import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getToken(req) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export async function getRequester(req, db = createServiceClient()) {
  const token = getToken(req)
  if (!token) {
    return { error: 'Missing authorization token', status: 401 }
  }

  const { data: userData, error: userError } = await db.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) {
    return { error: 'Invalid authorization token', status: 401 }
  }

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,email,full_name,role,team_id,is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.is_active === false) {
    return { error: 'Inactive or missing profile', status: 403 }
  }

  return { user, profile, db }
}

export function isSuperadmin(profile) {
  return profile?.role === 'superadmin'
}

export function isTeamAdmin(profile) {
  return profile?.role === 'admin' || profile?.role === 'superadmin'
}

export function canAccessTeam(profile, teamId) {
  return isSuperadmin(profile) || (!!teamId && profile?.team_id === teamId)
}

export function canManageTeam(profile, teamId) {
  return isSuperadmin(profile) || (profile?.role === 'admin' && !!teamId && profile.team_id === teamId)
}

// Allows admin, superadmin, AND accountant to use ApexPay portal
export function canAccessPay(profile, teamId) {
  if (isSuperadmin(profile)) return true
  if (!teamId || profile?.team_id !== teamId) return false
  return ['admin', 'accountant'].includes(profile?.role)
}

/**
 * Enforce UID-locking: a user may only act on their own record.
 * Superadmins are exempt.
 * Returns { error, status } if denied, or null if allowed.
 *
 * Usage:
 *   const denied = requireSelf(requester.profile, uid)
 *   if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
 */
export function requireSelf(profile, uid) {
  if (!uid) return { error: 'uid is required', status: 400 }
  if (isSuperadmin(profile)) return null
  if (profile?.id !== uid) return { error: 'Forbidden: you may only modify your own record', status: 403 }
  return null
}
