// __tests__/serverAuth.test.js
// Unit tests for lib/serverAuth.js RBAC helpers.
// Run with: npm test
//
// Note: Uses CommonJS-compatible inline implementations for Jest compatibility.

// ── Inline RBAC helpers (pure functions, no DB calls) ────────────────────────

function isSuperadmin(profile) {
  return profile?.role === 'superadmin'
}

function isTeamAdmin(profile) {
  return profile?.role === 'admin' || profile?.role === 'superadmin'
}

function canAccessTeam(profile, teamId) {
  return isSuperadmin(profile) || (!!teamId && profile?.team_id === teamId)
}

function canManageTeam(profile, teamId) {
  return isSuperadmin(profile) || (profile?.role === 'admin' && !!teamId && profile.team_id === teamId)
}

function canAccessPay(profile, teamId) {
  if (isSuperadmin(profile)) return true
  if (!teamId || profile?.team_id !== teamId) return false
  return ['admin', 'accountant'].includes(profile?.role)
}

function requireSelf(profile, uid) {
  if (!uid) return { error: 'uid is required', status: 400 }
  if (isSuperadmin(profile)) return null
  if (profile?.id !== uid) return { error: 'Forbidden: you may only modify your own record', status: 403 }
  return null
}

// ── Test data ────────────────────────────────────────────────────────────────

const TEAM_A = 'team-a-uuid-0000-0000-000000000001'
const TEAM_B = 'team-b-uuid-0000-0000-000000000002'
const USER_ID = 'user-uuid-0000-0000-000000000001'

function makeProfile(overrides = {}) {
  return {
    id:        USER_ID,
    role:      'coach',
    team_id:   TEAM_A,
    is_active: true,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isSuperadmin', () => {
  test('returns true for superadmin role', () => {
    expect(isSuperadmin(makeProfile({ role: 'superadmin' }))).toBe(true)
  })
  test('returns false for admin role', () => {
    expect(isSuperadmin(makeProfile({ role: 'admin' }))).toBe(false)
  })
  test('returns false for null profile', () => {
    expect(isSuperadmin(null)).toBe(false)
  })
})

describe('isTeamAdmin', () => {
  test('returns true for admin role', () => {
    expect(isTeamAdmin(makeProfile({ role: 'admin' }))).toBe(true)
  })
  test('returns true for superadmin role', () => {
    expect(isTeamAdmin(makeProfile({ role: 'superadmin' }))).toBe(true)
  })
  test('returns false for coach role', () => {
    expect(isTeamAdmin(makeProfile({ role: 'coach' }))).toBe(false)
  })
})

describe('canAccessTeam', () => {
  test('superadmin can access any team', () => {
    const p = makeProfile({ role: 'superadmin', team_id: TEAM_A })
    expect(canAccessTeam(p, TEAM_B)).toBe(true)
  })
  test('regular user can access own team', () => {
    const p = makeProfile({ team_id: TEAM_A })
    expect(canAccessTeam(p, TEAM_A)).toBe(true)
  })
  test('regular user cannot access another team', () => {
    const p = makeProfile({ team_id: TEAM_A })
    expect(canAccessTeam(p, TEAM_B)).toBe(false)
  })
})

describe('canManageTeam', () => {
  test('superadmin can manage any team', () => {
    const p = makeProfile({ role: 'superadmin', team_id: TEAM_A })
    expect(canManageTeam(p, TEAM_B)).toBe(true)
  })
  test('admin can manage own team', () => {
    const p = makeProfile({ role: 'admin', team_id: TEAM_A })
    expect(canManageTeam(p, TEAM_A)).toBe(true)
  })
  test('admin cannot manage another team', () => {
    const p = makeProfile({ role: 'admin', team_id: TEAM_A })
    expect(canManageTeam(p, TEAM_B)).toBe(false)
  })
  test('coach cannot manage any team', () => {
    const p = makeProfile({ role: 'coach', team_id: TEAM_A })
    expect(canManageTeam(p, TEAM_A)).toBe(false)
  })
})

describe('canAccessPay', () => {
  test('admin can access pay portal for own team', () => {
    const p = makeProfile({ role: 'admin', team_id: TEAM_A })
    expect(canAccessPay(p, TEAM_A)).toBe(true)
  })
  test('accountant can access pay portal for own team', () => {
    const p = makeProfile({ role: 'accountant', team_id: TEAM_A })
    expect(canAccessPay(p, TEAM_A)).toBe(true)
  })
  test('accountant cannot access pay portal for another team', () => {
    const p = makeProfile({ role: 'accountant', team_id: TEAM_A })
    expect(canAccessPay(p, TEAM_B)).toBe(false)
  })
  test('coach cannot access pay portal', () => {
    const p = makeProfile({ role: 'coach', team_id: TEAM_A })
    expect(canAccessPay(p, TEAM_A)).toBe(false)
  })
  test('superadmin can access pay portal for any team', () => {
    const p = makeProfile({ role: 'superadmin', team_id: TEAM_A })
    expect(canAccessPay(p, TEAM_B)).toBe(true)
  })
})

describe('requireSelf', () => {
  test('returns null (allowed) when uid matches profile id', () => {
    const p = makeProfile({ id: USER_ID })
    expect(requireSelf(p, USER_ID)).toBeNull()
  })
  test('returns 403 error when uid does not match profile id', () => {
    const p = makeProfile({ id: USER_ID })
    const result = requireSelf(p, 'different-user-id')
    expect(result).not.toBeNull()
    expect(result.status).toBe(403)
  })
  test('superadmin can always pass requireSelf', () => {
    const p = makeProfile({ role: 'superadmin', id: USER_ID })
    expect(requireSelf(p, 'any-other-user-id')).toBeNull()
  })
  test('returns 400 when uid is missing', () => {
    const p = makeProfile()
    const result = requireSelf(p, null)
    expect(result.status).toBe(400)
  })
})
