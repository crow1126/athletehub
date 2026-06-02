// lib/moolre.js
// Moolre API helper — https://moolre.com
// Covers: SMS notifications + Payment charges
// Update MOOLRE_BASE_URL once you have the real API endpoint from Moolre

const MOOLRE_BASE_URL = process.env.MOOLRE_BASE_URL || 'https://api.moolre.com/v1'
const MOOLRE_SECRET   = process.env.MOOLRE_SECRET_KEY
const MOOLRE_SENDER   = process.env.MOOLRE_SMS_SENDER_ID || 'ApexTrack'

// ─── helpers ─────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    'Authorization': `Bearer ${MOOLRE_SECRET}`,
    'Content-Type':  'application/json',
  }
}

/**
 * Normalize a Ghanaian phone number to international format (+233...)
 * Accepts: 0241234567, 233241234567, +233241234567
 */
export function normalizeGhPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('233') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0')   && digits.length === 10) return `+233${digits.slice(1)}`
  if (digits.length >= 9)                               return `+233${digits.slice(-9)}`
  return null
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

/**
 * Send a single SMS via Moolre
 * @param {string} to    - recipient phone (will be normalized)
 * @param {string} message - SMS body (max 160 chars recommended)
 */
export async function sendSMS(to, message) {
  const phone = normalizeGhPhone(to)
  if (!phone) {
    console.warn('[Moolre SMS] Invalid phone number:', to)
    return { ok: false, error: 'Invalid phone number' }
  }

  try {
    const res = await fetch(`${MOOLRE_BASE_URL}/sms/send`, {
      method:  'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        to,
        message,
        sender_id: MOOLRE_SENDER,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[Moolre SMS] Error:', data)
      return { ok: false, error: data?.message || 'SMS send failed' }
    }
    return { ok: true, data }
  } catch (err) {
    console.error('[Moolre SMS] Network error:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Send SMS to multiple recipients (bulk)
 * @param {Array<{phone: string, message: string}>} recipients
 */
export async function sendBulkSMS(recipients) {
  const results = await Promise.allSettled(
    recipients.map(({ phone, message }) => sendSMS(phone, message))
  )
  const sent   = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length
  const failed = results.length - sent
  return { sent, failed, results }
}

/**
 * Build the schedule SMS message for an athlete
 */
export function buildScheduleSMS({ athleteName, sessionTitle, sessionType, date, time, venue, duration, notes }) {
  const dateStr = new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  let msg = `Hi ${athleteName}, you have a ${sessionType}: "${sessionTitle}" on ${dateStr} at ${time} (${duration}min) — ${venue}.`
  if (notes) msg += ` Note: ${notes.slice(0, 60)}${notes.length > 60 ? '…' : ''}`
  msg += ' — ApexTrack'
  return msg.slice(0, 160) // keep within single SMS
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * Initiate a Moolre payment charge
 */
export async function createCharge({ email, amount_ghs, reference, plan, team_id, channels = ['mobile_money', 'card'] }) {
  try {
    const res = await fetch(`${MOOLRE_BASE_URL}/charges`, {
      method:  'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount:    Math.round(amount_ghs * 100), // pesewas
        currency:  'GHS',
        email,
        reference,
        channels,
        metadata:  { plan, team_id },
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.message || 'Charge failed' }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Verify a Moolre payment by reference
 */
export async function verifyCharge(reference) {
  try {
    const res  = await fetch(`${MOOLRE_BASE_URL}/charges/verify/${encodeURIComponent(reference)}`, {
      headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.message || 'Verification failed' }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
