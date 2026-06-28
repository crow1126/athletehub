// lib/sanitize.js
// Centralised input sanitization helpers for all API routes.
// These are lightweight, dependency-free string cleaners — NOT a replacement
// for parameterised queries (Supabase JS handles that) but a defence-in-depth
// layer that strips XSS vectors and caps field lengths before they reach the DB.

/**
 * Trim whitespace and strip the most common HTML / script injection patterns.
 * Safe for text fields (names, descriptions, notes, etc.)
 */
export function sanitizeText(value, { maxLength = 500 } = {}) {
  if (value === null || value === undefined) return ''
  const str = String(value)
    .trim()
    .slice(0, maxLength)
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip javascript: protocol (href injection)
    .replace(/javascript:/gi, '')
    // Strip on* event handlers (onerror=, onclick= etc.)
    .replace(/\bon\w+\s*=/gi, '')
    // Collapse multiple whitespace runs into a single space
    .replace(/\s+/g, ' ')
  return str
}

/**
 * Validate and normalise an email address.
 * Returns the lower-cased email or null if invalid.
 */
export function sanitizeEmail(value) {
  if (!value) return null
  const email = String(value).trim().toLowerCase().slice(0, 254)
  // RFC 5322 simplified check
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  return valid ? email : null
}

/**
 * Parse and validate a positive GHS amount.
 * Returns a number rounded to 2 decimal places, or null if invalid.
 * Enforces a configurable min/max to prevent absurd payment values.
 */
export function sanitizeAmount(value, { min = 0.01, max = 50000 } = {}) {
  const n = parseFloat(value)
  if (isNaN(n) || n < min || n > max) return null
  return Math.round(n * 100) / 100
}

/**
 * Validate a UUID string (v4 format).
 * Returns the UUID or null if invalid.
 */
export function sanitizeUUID(value) {
  if (!value) return null
  const uuid = String(value).trim().toLowerCase()
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)
  return valid ? uuid : null
}

/**
 * Sanitize a phone number — strip everything except digits and leading +.
 * Does not validate format; use normalizeGhPhone from moolre.js for that.
 */
export function sanitizePhone(value, { maxLength = 20 } = {}) {
  if (!value) return ''
  return String(value).replace(/[^\d+]/g, '').slice(0, maxLength)
}

/**
 * Strip potentially dangerous keys from a plain object (shallow).
 * Useful for sanitizing JSONB metadata before DB insertion.
 */
export function sanitizeObject(obj, { maxDepth = 2, maxKeys = 20 } = {}) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {}
  const dangerousKeys = /^(__proto__|constructor|prototype)$/i
  const result = {}
  let count = 0
  for (const [k, v] of Object.entries(obj)) {
    if (count >= maxKeys) break
    if (dangerousKeys.test(k)) continue
    const safeKey = sanitizeText(k, { maxLength: 64 })
    if (maxDepth > 0 && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[safeKey] = sanitizeObject(v, { maxDepth: maxDepth - 1, maxKeys })
    } else if (typeof v === 'string') {
      result[safeKey] = sanitizeText(v, { maxLength: 500 })
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      result[safeKey] = v
    }
    count++
  }
  return result
}

/**
 * Validate an allowed-list enum value.
 * Returns the value if it's in the allowed list, otherwise null.
 */
export function sanitizeEnum(value, allowed = []) {
  if (!value) return null
  const str = String(value).trim().toLowerCase()
  return allowed.includes(str) ? str : null
}
