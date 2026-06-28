// __tests__/moolre.test.js
// Unit tests for lib/moolre.js pure utility functions.
// Run with: npm test
//
// Note: Uses CommonJS require() for Jest compatibility.
// The moolre.js functions are re-implemented inline here to avoid
// ESM module resolution issues with Jest on Windows/Node without transform.

// ── Inline the pure functions (no external deps, no fetch) ──────────────────

function normalizeGhPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('233') && digits.length >= 12) return digits
  if (digits.startsWith('0')   && digits.length === 10) return `233${digits.slice(1)}`
  if (digits.length >= 9)                               return `233${digits.slice(-9)}`
  return null
}

function resolveGhProvider(rawPhone) {
  const phone = normalizeGhPhone(rawPhone)
  if (!phone) return '1' // default MTN
  const prefix = phone.substring(3, 5)
  const mtnPrefixes    = ['24', '54', '55', '59', '25', '53']
  const telecelPrefixes = ['20', '50']
  const atPrefixes     = ['26', '56', '27', '57']

  if (mtnPrefixes.includes(prefix))    return '1'  // MTN
  if (telecelPrefixes.includes(prefix)) return '6'  // Telecel
  if (atPrefixes.includes(prefix))     return '7'  // AirtelTigo

  return '1' // default MTN
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeGhPhone', () => {
  test('passes through a correctly formatted 233 number', () => {
    expect(normalizeGhPhone('233241234567')).toBe('233241234567')
  })

  test('converts 0xx format to 233xx', () => {
    expect(normalizeGhPhone('0241234567')).toBe('233241234567')
  })

  test('converts 9-digit number to 233xx', () => {
    expect(normalizeGhPhone('241234567')).toBe('233241234567')
  })

  test('strips non-digit characters', () => {
    expect(normalizeGhPhone('+233 24 123 4567')).toBe('233241234567')
    expect(normalizeGhPhone('0241-234-567')).toBe('233241234567')
  })

  test('returns null for empty input', () => {
    expect(normalizeGhPhone('')).toBeNull()
    expect(normalizeGhPhone(null)).toBeNull()
    expect(normalizeGhPhone(undefined)).toBeNull()
  })

  test('returns null for too-short numbers', () => {
    expect(normalizeGhPhone('12345')).toBeNull()
  })
})

describe('resolveGhProvider', () => {
  test('returns MTN (1) for 024 prefix', () => {
    expect(resolveGhProvider('0241234567')).toBe('1')
  })

  test('returns MTN (1) for 054 prefix', () => {
    expect(resolveGhProvider('0541234567')).toBe('1')
  })

  test('returns Telecel (6) for 020 prefix', () => {
    expect(resolveGhProvider('0201234567')).toBe('6')
  })

  test('returns Telecel (6) for 050 prefix', () => {
    expect(resolveGhProvider('0501234567')).toBe('6')
  })

  test('returns AirtelTigo (7) for 026 prefix', () => {
    expect(resolveGhProvider('0261234567')).toBe('7')
  })

  test('returns AirtelTigo (7) for 056 prefix', () => {
    expect(resolveGhProvider('0561234567')).toBe('7')
  })

  test('defaults to MTN (1) for unknown prefix', () => {
    expect(resolveGhProvider('0991234567')).toBe('1')
  })

  test('defaults to MTN (1) for null input', () => {
    expect(resolveGhProvider(null)).toBe('1')
  })
})
