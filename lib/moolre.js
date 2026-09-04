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

// Known registered club SMS packages (e.g. Young Apostles FC, Kotoko SC)
// senderIdApproved: set to true once Moolre approves the custom sender name at app.moolre.com
// While awaiting approval, all SMS routes through the master ApexTrack SMS API (MOOLRE_VASKEY + MOOLRE_SENDER)
// so that SMS delivery works immediately without "Sender ID not approved" failures.
const REGISTERED_CLUB_SMS_KEYS = {
  // Young Apostles FC
  '324cd849-5c62-4278-9594-97e606439402': {
    vasKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2YXNpZCI6MTMxMjAsImV4cCI6MTk1NjUyNzk5OX0.woIRGPdPX01MihjwzGViTKijuJLhOgxjOtLyOGCw2q4',
    senderId: 'YAFC',
    // Set to false: Moolre dashboard shows Approved, but Ghana telco carrier whitelisting is not yet active (whitelisted: false).
    // Routing through master ApexTrack gateway ensures 100% reliable SMS delivery while appending '— YOUNG APOSTLES FC'.
    senderIdApproved: false
  },
  // Kotoko SC
  '99801a63-c7ba-474d-a664-86de133ff054': {
    vasKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2YXNpZCI6MTMxMzEsImV4cCI6MTk1NjUyNzk5OX0.AuQ_4R20t69fqvZf7fNY63v9JUmpoetfC4fZ90IiE0c',
    senderId: 'KOTOKO SC',
    senderIdApproved: false  // ← set to true once approved at app.moolre.com
  }
}

/**
 * Resolve Moolre VAS SMS key and Sender ID for a specific team.
 * - While awaiting Moolre approval for custom club sender IDs, routes through the active ApexTrack SMS API
 * - Uses club's own VAS key & custom sender ID ONLY IF senderIdApproved = true
 * - Cleanly falls back to default ApexTrack SMS credentials for all messages
 */
export async function resolveTeamSMSConfig(teamId, db = null) {
  if (!teamId) {
    return { vasKey: MOOLRE_VASKEY, senderId: MOOLRE_SENDER }
  }

  // 1. Direct memory map for known clubs (instant resolution)
  if (REGISTERED_CLUB_SMS_KEYS[teamId]) {
    const cfg = REGISTERED_CLUB_SMS_KEYS[teamId]
    if (cfg.senderIdApproved) {
      return {
        vasKey: cfg.vasKey,
        senderId: cfg.senderId
      }
    }
    // Custom sender ID awaiting Moolre approval — route through master ApexTrack SMS API
    return {
      vasKey: MOOLRE_VASKEY,
      senderId: MOOLRE_SENDER
    }
  }

  let client = db
  if (!client && typeof window === 'undefined') {
    try {
      const { createServiceClient } = await import('@/lib/serverAuth')
      client = createServiceClient()
    } catch {
      // client not available
    }
  }

  if (client) {
    try {
      // 2. Check teams table (safe select without assuming optional columns exist)
      const { data: teamData } = await client
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle()

      // Name match check (case-insensitive for registered clubs)
      const teamNameLower = (teamData?.name || '').toLowerCase()
      if (teamNameLower.includes('young apostle')) {
        const cfg = REGISTERED_CLUB_SMS_KEYS['324cd849-5c62-4278-9594-97e606439402']
        if (cfg?.senderIdApproved) {
          return { vasKey: cfg.vasKey, senderId: cfg.senderId }
        }
        return { vasKey: MOOLRE_VASKEY, senderId: MOOLRE_SENDER }
      }
      if (teamNameLower.includes('kotoko')) {
        const cfg = REGISTERED_CLUB_SMS_KEYS['99801a63-c7ba-474d-a664-86de133ff054']
        if (cfg?.senderIdApproved) {
          return { vasKey: cfg.vasKey, senderId: cfg.senderId }
        }
        return { vasKey: MOOLRE_VASKEY, senderId: MOOLRE_SENDER }
      }

      // If database has team custom SMS credentials and they are flagged ready:
      if (teamData?.moolre_vas_key && teamData?.sms_sender_id && teamData?.sms_sender_approved) {
        return {
          vasKey: teamData.moolre_vas_key,
          senderId: teamData.sms_sender_id
        }
      }
    } catch (err) {
      console.warn('[Moolre SMS] Failed to query team custom SMS config:', err?.message)
    }
  }

  // 3. Clean fallback to default Apextrack SMS credentials
  return {
    vasKey: MOOLRE_VASKEY,
    senderId: MOOLRE_SENDER
  }
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

/**
 * Send a single SMS via Moolre (uses the bulk endpoint under the hood)
 * @param {string} to - Recipient phone number
 * @param {string} message - Text message content
 * @param {object} [options] - Optional teamId, vasKey, senderId, db
 */
export async function sendSMS(to, message, options = {}) {
  const phone = normalizeGhPhone(to)
  if (!phone) {
    console.warn('[Moolre SMS] Invalid phone number:', to)
    return { ok: false, error: 'Invalid phone number' }
  }
  return sendBulkSMS([{ phone, message }], options)
}

/**
 * Send SMS to multiple recipients (bulk) in a single API call
 * Supports team-scoped custom VAS key & custom sender header.
 * @param {Array<{phone: string, message: string}>} recipients
 * @param {object} [options] - { retryOnServerError, teamId, vasKey, senderId, db }
 */
export async function sendBulkSMS(recipients, options = {}) {
  const { retryOnServerError = true, teamId, db } = options
  let vasKey = options.vasKey
  let senderId = options.senderId

  // If teamId is supplied and no custom vasKey was passed, resolve team configuration
  if (!vasKey && teamId) {
    const teamCfg = await resolveTeamSMSConfig(teamId, db)
    vasKey = teamCfg.vasKey
    if (!senderId) senderId = teamCfg.senderId
  }

  vasKey = vasKey || MOOLRE_VASKEY
  senderId = senderId || MOOLRE_SENDER

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

  const headers = { 'Content-Type': 'application/json' }
  if (vasKey) headers['X-API-VASKEY'] = vasKey

  try {
    const res = await fetch(`${MOOLRE_BASE_URL}/open/sms/send`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        type: 1,
        senderid: senderId,
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
        return sendBulkSMS(recipients, { ...options, retryOnServerError: false })
      }
      return { sent: 0, failed: recipients.length, error: `Moolre server error (${res.status}). Please try again.` }
    }

    if (!res.ok || data.status !== 1) {
      console.error('[Moolre SMS] Error response:', data)

      // Fallback safeguard: If a custom key/sender ID failed (e.g. sender ID pending approval),
      // retry once immediately with the master ApexTrack SMS credentials so the message is never lost.
      const isUsingCustom = (vasKey && vasKey !== MOOLRE_VASKEY) || (senderId && senderId !== MOOLRE_SENDER)
      if (isUsingCustom && MOOLRE_VASKEY && retryOnServerError) {
        console.warn(`[Moolre SMS] Custom sender/key failed ("${data?.message || res.status}"). Retrying via default ApexTrack SMS gateway...`)
        return sendBulkSMS(recipients, {
          ...options,
          vasKey: MOOLRE_VASKEY,
          senderId: MOOLRE_SENDER,
          retryOnServerError: false
        })
      }

      return { sent: 0, failed: recipients.length, error: data?.message || 'SMS send failed' }
    }
    return { sent: messages.length, failed: recipients.length - messages.length, data }
  } catch (err) {
    console.error('[Moolre SMS] Network error:', err)
    const isUsingCustom = (vasKey && vasKey !== MOOLRE_VASKEY) || (senderId && senderId !== MOOLRE_SENDER)
    if (isUsingCustom && MOOLRE_VASKEY && retryOnServerError) {
      console.warn('[Moolre SMS] Network error on custom key. Retrying via default ApexTrack SMS gateway...')
      return sendBulkSMS(recipients, {
        ...options,
        vasKey: MOOLRE_VASKEY,
        senderId: MOOLRE_SENDER,
        retryOnServerError: false
      })
    }
    return { sent: 0, failed: recipients.length, error: err.message }
  }
}

/**
 * Build login credentials SMS for newly created or updated staff/users
 */
export function buildStaffLoginSMS({ fullName, username, password, role, clubName, loginUrl }) {
  const club = clubName ? ` for ${clubName}` : ''
  const roleDisplay = role ? ` (${role.toUpperCase()})` : ''
  const url = loginUrl || 'https://apextrackgh.com/login'
  return `ApexTrack Login${club}:\nUser: ${username}\nPass: ${password}${roleDisplay}\nLogin: ${url}`
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

// Helper to format time strings (24h -> 12h AM/PM)
function formatTime12H(timeStr) {
  if (!timeStr) return ''
  const trimmed = String(timeStr).trim()
  if (/am|pm/i.test(trimmed)) return trimmed
  const parts = trimmed.split(':')
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1].slice(0, 2)
    if (isNaN(hours)) return trimmed
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes} ${ampm}`
  }
  return trimmed
}

/**
 * Build a dedicated Matchday Call-up SMS
 * Format: Hi Kenan, you have been called up for the match vs Hearts of Oak. Date: Sun, 30 Aug. KO: 3:00 PM. Meet: Club House @ 1:00 PM. — KOTOKO SC
 */
export function buildMatchdayCallupSMS({
  athleteName,
  clubName,
  opponent,
  matchDate,
  kickoffTime,
  venue,
  meetingPoint,
  meetingTime,
  role = 'Athlete',
  staffType = '',
}) {
  const greeting = athleteName ? `Hi ${athleteName}, ` : 'Hi, '
  const club = clubName ? clubName.toUpperCase() : 'ApexTrack Club'
  const dateFormatted = matchDate
    ? new Date(matchDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Matchday'

  const formattedKickoff = formatTime12H(kickoffTime) || '3:00 PM'
  const formattedMeeting = formatTime12H(meetingTime)

  const opponentStr = opponent ? `vs ${opponent}` : 'Matchday'
  const venueStr = venue ? ` | Venue: ${venue}` : ''
  
  let meetStr = ''
  if (meetingPoint && formattedMeeting) {
    meetStr = ` | Meet: ${meetingPoint} @ ${formattedMeeting}`
  } else if (meetingPoint) {
    meetStr = ` | Meet: ${meetingPoint}`
  } else if (formattedMeeting) {
    meetStr = ` | Meet: ${formattedMeeting}`
  }

  const roleLabel = staffType ? staffType.replace(/_/g, ' ') : (role === 'Staff' ? 'Staff' : '')
  const actionText = role === 'Staff' 
    ? `you are assigned${roleLabel ? ` (${roleLabel})` : ''} for match` 
    : 'you have been called up for match'

  const suffix = role === 'Staff' ? ` — ${club}` : ` Report in full kit. — ${club}`

  const base = `${greeting}${actionText} ${opponentStr}. Date: ${dateFormatted} | KO: ${formattedKickoff}${venueStr}${meetStr}.${suffix}`
  
  if (base.length <= 160) return base
  
  // Compact fallback if over 160 chars — preserves venue while trimming filler phrasing
  const shortAction = role === 'Staff' ? 'assigned match' : 'called up for match'
  const vCompact = venue ? ` @ ${venue}` : ''
  const mCompact = (meetingPoint || formattedMeeting) ? ` | Meet: ${meetingPoint || ''}${formattedMeeting ? ` ${formattedMeeting}` : ''}` : ''
  const compact = `${greeting}${shortAction} ${opponentStr}. ${dateFormatted} KO: ${formattedKickoff}${vCompact}${mCompact}. — ${club}`

  if (compact.length <= 160) return compact

  // Ultra-compact safeguard if venue or opponent name is unusually long
  const availForVenue = Math.max(12, 160 - `${greeting}${shortAction} ${opponentStr}. ${dateFormatted} KO: ${formattedKickoff} @ . — ${club}`.length)
  const trimmedVenue = venue ? ` @ ${venue.slice(0, availForVenue).trim()}` : ''
  const ultraCompact = `${greeting}${shortAction} ${opponentStr}. ${dateFormatted} KO: ${formattedKickoff}${trimmedVenue}. — ${club}`
  return ultraCompact.slice(0, 160)
}

/**
 * Build an SMS broadcast message for team notice / announcement board
 */
export function buildNoticeSMS({ athleteName, clubName, title, message, category, authorName, matchDetails, role, staffType }) {
  if (category === 'matchday' && matchDetails) {
    return buildMatchdayCallupSMS({
      athleteName,
      clubName,
      opponent: matchDetails.opponent,
      matchDate: matchDetails.matchDate,
      kickoffTime: matchDetails.kickoffTime,
      venue: matchDetails.venue,
      meetingPoint: matchDetails.meetingPoint,
      meetingTime: matchDetails.meetingTime,
      role,
      staffType,
    })
  }

  const club = clubName ? `${clubName.toUpperCase()}: ` : ''
  const greeting = athleteName ? `Hi ${athleteName}, ` : ''
  
  // Clean line breaks
  const cleanBody = (message || '').replace(/\n+/g, ' ').trim()
  const snippet = cleanBody.length > 85 ? cleanBody.slice(0, 82) + '...' : cleanBody
  
  let msg = `${club}${greeting}${title} — ${snippet}`
  if (msg.length > 160) {
    msg = msg.slice(0, 157) + '...'
  }
  return msg
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
