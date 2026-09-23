import { NextResponse } from 'next/server'
import { getRequester, canManageTeam, createServiceClient } from '@/lib/serverAuth'
import { log } from '@/lib/logger'

const MAX_ROWS = 500

// ── Exact codes the DB check constraint allows ────────────────────────────────
const VALID_POSITIONS = new Set(['GK','CB','RB','LB','RWB','LWB','CDM','CM','CAM','RM','LM','RW','LW','CF','SS','ST'])

// ── Full English name → DB code ───────────────────────────────────────────────
const POSITION_MAP = {
  'goalkeeper': 'GK', 'goal keeper': 'GK', 'gk': 'GK',
  'centre back': 'CB', 'center back': 'CB', 'central back': 'CB',
  'central defender': 'CB', 'centreback': 'CB', 'cb': 'CB',
  'full back': 'CB', 'fullback': 'CB', 'back': 'CB',
  'right back': 'RB', 'rightback': 'RB', 'rb': 'RB',
  'left back': 'LB', 'leftback': 'LB', 'lb': 'LB',
  'right wing back': 'RWB', 'right wingback': 'RWB', 'rwb': 'RWB',
  'left wing back': 'LWB', 'left wingback': 'LWB', 'lwb': 'LWB',
  'central defensive midfielder': 'CDM', 'defensive midfielder': 'CDM',
  'holding midfielder': 'CDM', 'defensive mid': 'CDM', 'cdm': 'CDM',
  'central midfielder': 'CM', 'centre midfielder': 'CM', 'cm': 'CM',
  'central attacking midfielder': 'CAM', 'attacking midfielder': 'CAM',
  'attacking mid': 'CAM', 'number 10': 'CAM', 'no. 10': 'CAM', 'cam': 'CAM',
  'right midfielder': 'RM', 'right midfield': 'RM', 'rm': 'RM',
  'left midfielder': 'LM', 'left midfield': 'LM', 'lm': 'LM',
  'right winger': 'RW', 'right wing': 'RW', 'winger right': 'RW', 'rw': 'RW',
  'left winger': 'LW', 'left wing': 'LW', 'winger left': 'LW', 'lw': 'LW',
  'winger': 'RW', 'wide midfielder': 'RM',
  'centre forward': 'CF', 'center forward': 'CF', 'cf': 'CF',
  'second striker': 'SS', 'support striker': 'SS', 'ss': 'SS',
  'striker': 'ST', 'centre striker': 'ST', 'center striker': 'ST',
  'forward': 'ST', 'st': 'ST', 'attacker': 'ST',
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
  // Normalise hyphens → spaces so "Centre-Back" matches "centre back"
  const lower = raw.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (POSITION_MAP[lower]) return POSITION_MAP[lower]
  // Pass through if it's already a valid code (case-insensitive)
  const upper = raw.trim().toUpperCase()
  if (VALID_POSITIONS.has(upper)) return upper
  // Unknown — omit rather than send a bad value to the DB
  return null
}

function parseModelJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) return JSON.parse(match[1])
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1))
    }
    throw new Error('Invalid JSON format in model output.')
  }
}

const FIELD_DESCRIPTIONS = {
  full_name: "Athlete's full name, player name, or athlete display name",
  date_of_birth: "Date of birth, birth date, DOB, or birthday",
  position: "Football/soccer playing position (e.g. Forward, Midfielder, Defender, Goalkeeper, Winger)",
  jersey_number: "Shirt number, squad number, jersey number, or kit number",
  phone: "Mobile phone number, telephone, or contact phone",
  email: "Email address or electronic mail",
}

function heuristicHeaderMatch(unmappedHeaders, unmappedFields) {
  const suggestions = {}
  const usedHeaders = new Set()

  const rules = {
    full_name: ['surname', 'given name', 'player', 'athlete', 'member', 'first name', 'last name'],
    date_of_birth: ['dob', 'birth', 'born', 'bday'],
    position: ['role', 'pos', 'field', 'lineup'],
    jersey_number: ['kit', 'squad', 'shirt', 'back', 'no', 'num'],
    phone: ['cell', 'tel', 'contact', 'mobile', 'whatsapp'],
    email: ['mail'],
  }

  for (const field of unmappedFields) {
    const keywords = rules[field] || []
    for (const h of unmappedHeaders) {
      if (usedHeaders.has(h)) continue
      const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (keywords.some(k => lower.includes(k.replace(/[^a-z0-9]/g, '')))) {
        suggestions[field] = h
        usedHeaders.add(h)
        break
      }
    }
  }

  return suggestions
}

async function suggestHeaderMapping(unmappedHeaders, unmappedFields) {
  const validFields = unmappedFields.filter(f => FIELD_DESCRIPTIONS[f])
  if (validFields.length === 0 || unmappedHeaders.length === 0) {
    return {}
  }

  const fieldsListStr = validFields
    .map(f => `- ${f}: ${FIELD_DESCRIPTIONS[f]}`)
    .join('\n')

  const headersListStr = unmappedHeaders.map(h => `"${h}"`).join(', ')

  const systemPrompt = `You are an expert data migration assistant for a football club management app.
We have spreadsheet column headers that need to be mapped to athlete profile fields.
Expected athlete fields:
${fieldsListStr}

Spreadsheet column headers from uploaded file:
[${headersListStr}]

Match each expected field to the closest matching spreadsheet column header.
If no spreadsheet column header clearly corresponds to an expected field, return "no match" for that field.
Do NOT map multiple fields to the same column header.
Return ONLY a valid JSON object in this exact structure:
{
  "matches": {
    "<expected_field_name>": "<matching_column_header_or_no_match>"
  }
}`

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  // 1. Try Google Gemini first
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const parsed = parseModelJson(text)
          return sanitizeSuggestions(parsed, unmappedHeaders, validFields)
        }
      }
    } catch (err) {
      console.warn('[bulk-athletes] Gemini header mapping failed, falling back:', err.message)
    }
  }

  // 2. Try Anthropic Claude Haiku
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Suggest mappings for the given column headers.' }],
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.content?.[0]?.text
        if (text) {
          const parsed = parseModelJson(text)
          return sanitizeSuggestions(parsed, unmappedHeaders, validFields)
        }
      }
    } catch (err) {
      console.warn('[bulk-athletes] Claude header mapping failed, falling back:', err.message)
    }
  }

  // 3. Try Groq
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Suggest mappings for the given column headers.' },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 300,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.choices?.[0]?.message?.content
        if (text) {
          const parsed = parseModelJson(text)
          return sanitizeSuggestions(parsed, unmappedHeaders, validFields)
        }
      }
    } catch (err) {
      console.warn('[bulk-athletes] Groq header mapping failed, falling back:', err.message)
    }
  }

  // 4. Deterministic heuristic fallback
  return heuristicHeaderMatch(unmappedHeaders, validFields)
}

function sanitizeSuggestions(parsed, unmappedHeaders, validFields) {
  const matches = parsed.matches || parsed
  const cleanSuggestions = {}
  const headerSet = new Set(unmappedHeaders)
  const usedHeaders = new Set()

  for (const field of validFields) {
    const rawVal = matches[field]
    if (typeof rawVal === 'string') {
      const val = rawVal.trim()
      if (val && val.toLowerCase() !== 'no match' && headerSet.has(val) && !usedHeaders.has(val)) {
        cleanSuggestions[field] = val
        usedHeaders.add(val)
      }
    }
  }

  return cleanSuggestions
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

  // ── 3a. Action: AI Column Mapping Suggestion ───────────────────────────────
  if (body.action === 'suggest_mapping') {
    const unmappedHeaders = Array.isArray(body.unmappedHeaders) ? body.unmappedHeaders : []
    const unmappedFields  = Array.isArray(body.unmappedFields)  ? body.unmappedFields  : []

    if (unmappedHeaders.length === 0 || unmappedFields.length === 0) {
      return NextResponse.json({ suggestions: {} })
    }

    try {
      const suggestions = await suggestHeaderMapping(unmappedHeaders, unmappedFields)
      return NextResponse.json({ suggestions })
    } catch (err) {
      console.error('[bulk-athletes] suggest_mapping failed:', err.message)
      return NextResponse.json({ suggestions: {} })
    }
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

  // Pre-fetch jersey numbers already taken by existing athletes on this team
  const { data: existingAthletes } = await db
    .from('athletes')
    .select('back_number')
    .eq('team_id', team_id)
    .not('back_number', 'is', null)

  const takenJerseys = new Set((existingAthletes || []).map(a => String(a.back_number).trim()))

  // Track jersey numbers used within this batch to catch within-file duplicates
  const batchJerseys = {} // jersey → row index (1-based)

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

    // Jersey uniqueness checks
    if (back_number && NUMERIC.test(back_number)) {
      if (takenJerseys.has(back_number)) {
        errs.push(`jersey #${back_number} is already assigned to an existing athlete on this team`)
      } else if (batchJerseys[back_number] !== undefined) {
        errs.push(`jersey #${back_number} is a duplicate within this import (first seen at row ${batchJerseys[back_number]})`)
      } else {
        batchJerseys[back_number] = i + 1
      }
    }

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
    // ── Probe: try the first row alone to surface any DB constraint error ──
    const { error: probeErr } = await db
      .from('athletes')
      .insert([toInsert[0]])
      .select('id')

    if (probeErr) {
      console.error('[bulk-athletes] Probe insert failed:', probeErr.message, JSON.stringify(toInsert[0]))
      return NextResponse.json({
        added: 0,
        skipped: toInsert.length + rowErrors.length,
        errors: [`DB constraint error: ${probeErr.message}`, `First row payload: ${JSON.stringify(toInsert[0])}`],
      }, { status: 422 })
    }

    // Probe succeeded — count it and insert the rest
    added = 1
    const CHUNK = 100
    for (let c = 1; c < toInsert.length; c += CHUNK) {
      const chunk = toInsert.slice(c, c + CHUNK)
      const { data, error } = await db
        .from('athletes')
        .insert(chunk)
        .select('id')

      if (error) {
        console.error('[bulk-athletes] Chunk insert error:', error.message)
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
