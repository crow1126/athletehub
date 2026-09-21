import { NextResponse } from 'next/server'
import { getRequester, canManageTeam, createServiceClient } from '@/lib/serverAuth'
import { log } from '@/lib/logger'

const MAX_ROWS = 500

// ── Position normaliser: full English name → short DB code ───────────────────
const POSITION_MAP = {
  // Goalkeeper
  'goalkeeper': 'GK', 'goal keeper': 'GK',
  // Defenders
  'centre back': 'CB', 'center back': 'CB', 'central defender': 'CB', 'centreback': 'CB',
  'right back': 'RB', 'rightback': 'RB',
  'left back': 'LB', 'leftback': 'LB',
  'right wing back': 'RWB', 'right wingback': 'RWB',
  'left wing back': 'LWB', 'left wingback': 'LWB',
  // Midfielders
  'central defensive midfielder': 'CDM', 'defensive midfielder': 'CDM', 'holding midfielder': 'CDM',
  'central midfielder': 'CM', 'centre midfielder': 'CM',
  'central attacking midfielder': 'CAM', 'attacking midfielder': 'CAM', 'number 10': 'CAM',
  'right midfielder': 'RM', 'right midfield': 'RM',
  'left midfielder': 'LM', 'left midfield': 'LM',
  // Forwards
  'right winger': 'RW', 'right wing': 'RW',
  'left winger': 'LW', 'left wing': 'LW',
  'centre forward': 'CF', 'center forward': 'CF',
  'second striker': 'SS', 'support striker': 'SS',
  'striker': 'ST', 'centre striker': 'ST', 'center striker': 'ST',
  'forward': 'ST',
}

// ── Status normaliser → only values the DB accepts ───────────────────────────
const STATUS_MAP = {
  'active': 'Active', 'fit': 'Active', 'available': 'Active',
  'injured': 'Injured', 'injury': 'Injured',
  'suspended': 'Suspended', 'banned': 'Suspended',
  'inactive': 'Suspended',  // closest valid equivalent
}

function normalisePosition(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  if (POSITION_MAP[lower]) return POSITION_MAP[lower]
  // Already a known short code (GK, ST, CM…) — pass through as-is
  return raw.trim() || null
}

function normaliseStatus(raw) {
  if (!raw) return 'Active'
  return STATUS_MAP[raw.toLowerCase().trim()] || 'Active'
}

/**
 * POST /api/athletes/bulk
 *
 * Body: { team_id: string, rows: BulkRow[] }
 *
 * BulkRow (all optional except full_name):
 *   full_name, position, date_of_birth, back_number, phone, email, status
 *
 * Security:
 *   1. Bearer token / session cookie → 401 if missing
 *   2. canManageTeam(profile, team_id) → 403 if not admin/superadmin
 *
 * Response: { added: number, skipped: number, errors: string[] }
 */
export async function POST(req) {
  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const db = createServiceClient()
  const requester = await getRequester(req, db)
  if (requester.error) {
    return NextResponse.json({ error: requester.error }, { status: requester.status })
  }

  const { profile } = requester

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { team_id, rows } = body

  if (!team_id) {
    return NextResponse.json({ error: 'team_id is required.' }, { status: 400 })
  }

  // ── 3. Admin role check ────────────────────────────────────────────────────
  if (!canManageTeam(profile, team_id)) {
    return NextResponse.json(
      { error: 'Forbidden: only admins can perform bulk athlete imports.' },
      { status: 403 }
    )
  }

  // ── 4. Validate rows array ─────────────────────────────────────────────────
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array.' }, { status: 400 })
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Maximum allowed per request is ${MAX_ROWS}.` },
      { status: 400 }
    )
  }

  // ── 5. Build insert payloads ───────────────────────────────────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const NUMERIC  = /^\d+$/
  const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

  const toInsert  = []
  const rowErrors = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const errs = []

    const full_name     = (r.full_name     || '').toString().trim()
    const position_raw  = (r.position      || '').toString().trim()
    const date_of_birth = (r.date_of_birth || '').toString().trim()
    const back_number   = (r.back_number   || '').toString().trim()
    const phone         = (r.phone         || '').toString().trim()
    const email         = (r.email         || '').toString().trim()

    // Only full_name is required
    if (!full_name) errs.push('full_name is required')
    if (date_of_birth && !DATE_ISO.test(date_of_birth)) errs.push('date_of_birth must be YYYY-MM-DD')
    if (back_number   && !NUMERIC.test(back_number))    errs.push('back_number must be numeric')
    if (email         && !EMAIL_RE.test(email))          errs.push('email is invalid')

    if (errs.length) {
      rowErrors.push(`Row ${i + 1} (${full_name || 'unnamed'}): ${errs.join('; ')}`)
      continue
    }

    // Derive first_name / last_name from full_name
    const parts      = full_name.split(' ')
    const first_name = parts[0] || null
    const last_name  = parts.length > 1 ? parts.slice(1).join(' ') : null

    const position = normalisePosition(position_raw)
    const status   = normaliseStatus(r.status || '')

    // Only include fields that have actual values — avoids hitting NOT NULL
    // constraints on columns the DB may not allow nulls for.
    const payload = { name: full_name, first_name, team_id, status }
    if (last_name)    payload.last_name    = last_name
    if (position)     payload.position     = position
    if (date_of_birth)payload.date_of_birth= date_of_birth
    if (back_number)  payload.back_number  = back_number
    if (phone)        payload.phone        = phone
    if (email)        payload.email        = email

    toInsert.push(payload)
  }

  // ── 6. Batch insert ────────────────────────────────────────────────────────
  let added   = 0
  let skipped = rowErrors.length

  if (toInsert.length > 0) {
    const CHUNK = 100
    for (let c = 0; c < toInsert.length; c += CHUNK) {
      const chunk = toInsert.slice(c, c + CHUNK)
      const { data, error } = await db
        .from('athletes')
        .insert(chunk)
        .select('id')

      if (error) {
        console.error('[bulk-athletes] Insert error:', error.message, JSON.stringify(chunk[0]))
        skipped += chunk.length
        rowErrors.push(`DB insert error: ${error.message}`)
      } else {
        added += data?.length ?? chunk.length
      }
    }
  }

  // ── 7. Audit log ───────────────────────────────────────────────────────────
  log.info('bulk_athletes_imported', {
    admin_id: requester.user.id,
    team_id,
    attempted: rows.length,
    added,
    skipped,
  })

  return NextResponse.json({ added, skipped, errors: rowErrors })
}
