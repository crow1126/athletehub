// lib/moolre.js
// Moolre API helper — https://moolre.com
// Covers: SMS notifications + Payment charges + Disbursements

export const MOOLRE_BASE_URL = (
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_SIMULATION !== 'true'
    ? 'https://api.moolre.com'
    : (process.env.MOOLRE_BASE_URL || 'https://api.moolre.com')
).trim()
const MOOLRE_USERNAME = (process.env.MOOLRE_API_USERNAME || 'skwobil').trim()
const MOOLRE_USER     = (process.env.MOOLRE_API_USER || process.env.MOOLRE_USER)?.trim()
const MOOLRE_PUBKEY   = (process.env.MOOLRE_PUBLIC_KEY || process.env.MOOLRE_API_PUBKEY)?.trim()
const MOOLRE_SECRET   = (process.env.MOOLRE_SECRET_KEY || process.env.MOOLRE_API_KEY)?.trim()
const MOOLRE_VASKEY   = process.env.MOOLRE_VAS_KEY?.trim()
const MOOLRE_ACCOUNT  = (process.env.MOOLRE_ACCOUNT_NUMBER || process.env.MOOLRE_ACCOUNT)?.trim()
const MOOLRE_SENDER   = (process.env.MOOLRE_SMS_SENDER_ID || 'ApexTrack').trim()
// Fixed reusable POS link — when set, all payments redirect here instead of generating a new link
const MOOLRE_POS_URL  = process.env.MOOLRE_POS_URL?.trim()

export const IS_SANDBOX = MOOLRE_BASE_URL.includes('sandbox.moolre.com')

// Headers for Payments
function paymentHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (MOOLRE_USER) headers['X-API-USER'] = MOOLRE_USER
  if (MOOLRE_PUBKEY) headers['X-API-PUBKEY'] = MOOLRE_PUBKEY
  return headers
}

// Headers for Transfers/Disbursements
function transferHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  headers['X-API-USER'] = MOOLRE_USERNAME
  if (MOOLRE_SECRET) headers['X-API-KEY'] = MOOLRE_SECRET
  return headers
}

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

/**
 * Convert a phone number to local Ghanaian format (0XXXXXXXXX)
 * Moolre transfer endpoint requires numbers starting with '0'
 */
export function toLocalPhone(raw) {
  const intl = normalizeGhPhone(raw)
  if (!intl) return null
  return '0' + intl.slice(3) // 233XXXXXXXXX → 0XXXXXXXXX
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

/**
 * Build an SMS broadcast message for team notice / announcement board
 */
export function buildNoticeSMS({ athleteName, clubName, title, message, category, authorName }) {
  const catTag = category === 'urgent' ? '[URGENT NOTICE]' : (category === 'matchday' ? '[MATCHDAY CALL-UP]' : '[TEAM NOTICE]')
  const club = clubName ? `${clubName}: ` : ''
  const name = athleteName ? `Hi ${athleteName}, ` : ''
  let msg = `${catTag} ${club}${name}${title} — ${message}`
  if (authorName) msg += ` (by ${authorName})`
  msg += ' — ApexTrack'
  return msg.length > 160 ? msg.slice(0, 157) + '…' : msg
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * Initiate a Moolre payment charge (creates a hosted checkout page URL).
 * If MOOLRE_POS_URL is set, returns the fixed reusable POS link directly
 * without making an API call — every account hits the same POS terminal.
 */
export async function createCharge({ email, amount_ghs, reference, plan, team_id, callbackUrl, redirectUrl }) {
  // ── Fixed POS URL shortcut ────────────────────────────────────────────────
  if (MOOLRE_POS_URL) {
    console.log('[Moolre] Using fixed POS URL for charge. ref:', reference, 'plan:', plan)
    // Append context as query params so the redirect/callback can identify the payment
    const posUrl = new URL(MOOLRE_POS_URL)
    posUrl.searchParams.set('ref', reference)
    if (plan)    posUrl.searchParams.set('plan', plan)
    if (team_id) posUrl.searchParams.set('team_id', team_id)
    if (redirectUrl) posUrl.searchParams.set('redirect', redirectUrl)
    return { ok: true, data: { authorization_url: posUrl.toString(), reference } }
  }

  try {
    const body = {
      type: 1,
      amount: amount_ghs.toString(),
      email,
      externalref: reference,
      callback: callbackUrl,
      redirect: redirectUrl,
      reusable: "0",
      currency: 'GHS',
      accountnumber: MOOLRE_ACCOUNT,
      metadata: { plan, team_id }
    }

    // Securely log request metadata to help diagnose Vercel environment issues
    const rawHeaders = paymentHeaders()
    const debugHeaders = { ...rawHeaders }
    if (debugHeaders['X-API-PUBKEY']) {
      const val = debugHeaders['X-API-PUBKEY']
      debugHeaders['X-API-PUBKEY'] = val.substring(0, 10) + '...' + val.substring(val.length - 10)
    }
    console.log('[Moolre API debug] createCharge request:', {
      url: `${MOOLRE_BASE_URL}/embed/link`,
      headers: debugHeaders,
      body
    })

    const res = await fetch(`${MOOLRE_BASE_URL}/embed/link`, {
      method:  'POST',
      headers: paymentHeaders(),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    console.log('[Moolre API debug] createCharge response:', JSON.stringify(data))

    if (!res.ok || data.status !== 1) {
      return { ok: false, error: data?.message || 'Generate payment link failed' }
    }
    return { ok: true, data: data.data }
  } catch (err) {
    console.error('[Moolre API debug] createCharge exception:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Verify a Moolre payment by reference
 */
export async function verifyCharge(reference) {
  try {
    const body = {
      type: 1,
      idtype: "1", // 1 = externalref
      id: reference,
      accountnumber: MOOLRE_ACCOUNT
    }

    const res  = await fetch(`${MOOLRE_BASE_URL}/open/transact/status`, {
      method: 'POST',
      headers: paymentHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok || data.status !== 1) {
      return { ok: false, error: data?.message || 'Verification failed' }
    }
    return { ok: true, data: data.data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Resolve Moolre channel code from a Ghanaian phone number.
 * Moolre uses numeric channel codes: 1=MTN, 6=Telecel, 7=AT
 */
export function resolveGhProvider(rawPhone) {
  const phone = normalizeGhPhone(rawPhone)
  if (!phone) return '1' // default MTN
  // Extract 2-digit network prefix (after country code 233)
  const prefix = phone.substring(3, 5)
  const mtnPrefixes    = ['24', '54', '55', '59', '25', '53']
  const telecelPrefixes = ['20', '50']
  const atPrefixes     = ['26', '56', '27', '57']

  if (mtnPrefixes.includes(prefix))    return '1'  // MTN
  if (telecelPrefixes.includes(prefix)) return '6'  // Telecel
  if (atPrefixes.includes(prefix))     return '7'  // AirtelTigo

  return '1' // default MTN
}

/**
 * Initiate Moolre Transfer (disbursement) to a mobile wallet
 * Endpoint: POST /open/transact/transfer
 * Docs: type=1, receiver, channel (1=MTN, 6=Telecel, 7=AT)
 */
export async function initiateTransfer({ amount, recipient, provider, reference }) {
  try {
    const channel = provider || resolveGhProvider(recipient)
    const body = {
      type:          1,
      channel,
      currency:      'GHS',
      amount:        amount.toString(),
      receiver:      toLocalPhone(recipient),
      externalref:   reference,
      accountnumber: MOOLRE_ACCOUNT,
    }

    const res = await fetch(`${MOOLRE_BASE_URL}/open/transact/transfer`, {
      method:  'POST',
      headers: transferHeaders(),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || (data.status !== 1 && data.status !== '1')) {
      return { ok: false, error: Array.isArray(data?.message) ? data.message.join(' ') : (data?.message || 'Transfer request failed') }
    }
    return { ok: true, data: data.data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Fetch live Moolre wallet balance
 * Returns { ok: true, balance: number } or { ok: false, error: string }
 */
export async function getWalletBalance() {
  try {
    // Correct endpoint: /open/account/status (type:1) with Public Key
    const res = await fetch(`${MOOLRE_BASE_URL}/open/account/status`, {
      method:  'POST',
      headers: paymentHeaders(),
      body: JSON.stringify({
        type:          1,
        accountnumber: MOOLRE_ACCOUNT,
      }),
    })
    const data = await res.json()
    if (!res.ok || (data.status !== 1 && data.status !== '1')) {
      return { ok: false, error: data?.message || 'Balance fetch failed' }
    }
    const balance = parseFloat(data?.data?.balance ?? data?.balance ?? 0)
    return { ok: true, balance }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Verify Moolre Transfer Status by reference
 * Docs: type=1, idtype=1 (externalref)
 */
export async function verifyTransferStatus(reference) {
  try {
    const body = {
      type:          1,
      idtype:        '1', // 1 = externalref
      id:            reference,
      accountnumber: MOOLRE_ACCOUNT,
    }

    const res  = await fetch(`${MOOLRE_BASE_URL}/open/transact/status`, {
      method:  'POST',
      headers: transferHeaders(),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || data.status !== 1) {
      return { ok: false, error: data?.message || 'Transfer verification failed' }
    }
    return { ok: true, data: data.data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
