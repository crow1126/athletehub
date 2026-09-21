import { NextResponse } from 'next/server'
import { getRequester, canManageTeam, createServiceClient } from '@/lib/serverAuth'
import { log } from '@/lib/logger'

const MAX_ROWS = 500

/**
 * POST /api/athletes/bulk
 *
 * Body: { team_id: string, rows: BulkRow[] }
 *
 * BulkRow: {
 *   full_name:     string   (required)
 *   position:      string   (required)
 *   date_of_birth: string | null
 *   back_number:   string | null   (jersey number)
 *   phone:         string | null
 *   email:         string | null
 * }
 *
 * Security:
 *   1. Bearer token / session cookie validated via getRequester()  → 401 if missing
 *   2. canManageTeam(profile, team_id) → 403 if not admin/superadmin for that team
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

  // ── 3. Admin role check (replaces TODO) ────────────────────────────────────
  // canManageTeam returns true only when:
  //   profile.role === 'superadmin'  (can manage any team)
  //   OR profile.role === 'admin' AND profile.team_id === team_id
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

  // ── 5. Build insert payloads (server-side defence-in-depth validation) ─────
  const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const NUMERIC   = /^\d+$/
  const DATE_ISO  = /^\d{4}-\d{2}-\d{2}$/

  const toInsert  = []
  const rowErrors = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const errs = []

    const full_name    = (r.full_name     || '').toString().trim()
    const position     = (r.position      || '').toString().trim() || null
    const date_of_birth= (r.date_of_birth || '').toString().trim()
    const back_number  = (r.back_number   || '').toString().trim()
    const phone        = (r.phone         || '').toString().trim()
    const email        = (r.email         || '').toString().trim()

    if (!full_name)  errs.push('full_name is required')
    if (date_of_birth && !DATE_ISO.test(date_of_birth)) errs.push('date_of_birth must be YYYY-MM-DD')
    if (back_number  && !NUMERIC.test(back_number))     errs.push('back_number must be numeric')
    if (email        && !EMAIL_RE.test(email))           errs.push('email is invalid')

    if (errs.length) {
      rowErrors.push(`Row ${i + 1} (${full_name || 'unnamed'}): ${errs.join('; ')}`)
      continue
    }

    // Derive first_name / last_name from full_name for consistency with single-add form
    const parts      = full_name.split(' ')
    const first_name = parts[0] || null
    const last_name  = parts.length > 1 ? parts.slice(1).join(' ') : null

    toInsert.push({
      name:          full_name,
      first_name,
      last_name,
      position:      position || null,
      date_of_birth: date_of_birth || null,
      back_number:   back_number   || null,
      phone:         phone         || null,
      email:         email         || null,
      team_id,
      status:        'Active',
      created_by:    requester.user.id,
    })
  }

  // ── 6. Batch insert ────────────────────────────────────────────────────────
  let added   = 0
  let skipped = rowErrors.length  // rows that failed server validation

  if (toInsert.length > 0) {
    // Insert in chunks of 100 to stay within Supabase limits
    const CHUNK = 100
    for (let c = 0; c < toInsert.length; c += CHUNK) {
      const chunk = toInsert.slice(c, c + CHUNK)
      const { data, error } = await db
        .from('athletes')
        .insert(chunk)
        .select('id')

      if (error) {
        console.error('[bulk-athletes] Insert error:', error.message)
        skipped += chunk.length
        rowErrors.push(`Batch insert error: ${error.message}`)
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
