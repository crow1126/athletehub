// lib/moolre.js
// Moolre API helper — https://moolre.com
// SMS notifications only (disbursement/payment APIs removed)

const MOOLRE_BASE_URL = (process.env.MOOLRE_BASE_URL || 'https://api.moolre.com').trim()
const MOOLRE_VASKEY   = process.env.MOOLRE_VAS_KEY?.trim()
const MOOLRE_SENDER   = (process.env.MOOLRE_SMS_SENDER_ID || 'ApexTrack').trim()

// Headers for SMS (X-API-VASKEY always required, even in sandbox)
function smsHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (MOOLRE_VASKEY) headers['X-API-VASKEY'] = MOOLRE_VASKEY
  return headers
}

/**
 * Normalize a Ghanaian phone number to international format (233...)
 * Moolre SMS expects numbers starting with 233 without '+'
 */
export function normalizeGhPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('233') && digits.length >= 12) return digits
  if (digits.startsWith('0')   && digits.length === 10) return `233${digits.slice(1)}`
  if (digits.length >= 9)                               return `233${digits.slice(-9)}`
  return null
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

/**
 * Send a single SMS via Moolre (uses the bulk endpoint under the hood)
 */
export async function sendSMS(to, message) {
  const phone = normalizeGhPhone(to)
  if (!phone) {
    console.warn('[Moolre SMS] Invalid phone number:', to)
    return { ok: false, error: 'Invalid phone number' }
  }
  return sendBulkSMS([{ phone, message }])
}

/**
 * Send SMS to multiple recipients (bulk) in a single API call
 * @param {Array<{phone: string, message: string}>} recipients
 */
export async function sendBulkSMS(recipients, { retryOnServerError = true } = {}) {
  // Map to Moolre structure
  const messages = recipients
    .map(({ phone, message }, idx) => {
      const normalized = normalizeGhPhone(phone)
      if (!normalized) return null
      return {
        recipient: normalized,
        message,
        ref: `msg-${Date.now()}-${idx}`
      }
    })
    .filter(Boolean)

  if (messages.length === 0) {
    return { sent: 0, failed: recipients.length, error: 'No valid phone numbers' }
  }

  try {
    const res = await fetch(`${MOOLRE_BASE_URL}/open/sms/send`, {
      method:  'POST',
      headers: smsHeaders(),
      body: JSON.stringify({
        type: 1,
        senderid: MOOLRE_SENDER,
        messages,
      }),
    })

    // Always read text first — Moolre may return PHP errors as HTML/text on server faults
    const text = await res.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      // Non-JSON response (e.g. PHP PDOException) — retry once on server errors
      const snippet = text.slice(0, 120)
      console.error('[Moolre SMS] Non-JSON response:', snippet)
      if (retryOnServerError && res.status >= 500) {
        console.warn('[Moolre SMS] Retrying after 2s...')
        await new Promise(r => setTimeout(r, 2000))
        return sendBulkSMS(recipients, { retryOnServerError: false })
      }
      return { sent: 0, failed: recipients.length, error: `Moolre server error (${res.status}). Please try again.` }
    }

    if (!res.ok || data.status !== 1) {
      console.error('[Moolre SMS] Error response:', data)
      return { sent: 0, failed: recipients.length, error: data?.message || 'SMS send failed' }
    }
    return { sent: messages.length, failed: recipients.length - messages.length, data }
  } catch (err) {
    console.error('[Moolre SMS] Network error:', err)
    return { sent: 0, failed: recipients.length, error: err.message }
  }
}

/**
 * Build the schedule SMS message for an athlete (immediate notification)
 */
export function buildScheduleSMS({ athleteName, sessionTitle, sessionType, date, time, venue, duration, notes }) {
  const dateStr = new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  let msg = `Hi ${athleteName}, you have a ${sessionType}: "${sessionTitle}" on ${dateStr} at ${time} (${duration}min) — ${venue}.`
  if (notes) msg += ` Note: ${notes.slice(0, 60)}${notes.length > 60 ? '…' : ''}`
  msg += ' — ApexTrack'
  return msg.slice(0, 160) // keep within single SMS
}

/**
 * Build a 3-hour reminder SMS message for an athlete
 */
export function buildReminderSMS({ athleteName, sessionTitle, sessionType, time, venue }) {
  const msg = `Reminder: Hi ${athleteName}, your ${sessionType} "${sessionTitle}" starts in ~3 hours at ${time} — ${venue}. Get ready! — ApexTrack`
  return msg.slice(0, 160)
}
