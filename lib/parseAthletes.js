/**
 * lib/parseAthletes.js
 *
 * Client-side CSV/Excel parser and column mapper for bulk athlete import.
 * Uses the `xlsx` package (already a production dependency).
 *
 * Supported expected fields:
 *   full_name (required) | date_of_birth | position | jersey_number | phone | email
 */

export const EXPECTED_FIELDS = [
  { key: 'full_name',     label: 'Full Name',     required: true,  description: "Athlete's full name or display name" },
  { key: 'date_of_birth', label: 'Date of Birth', required: false, description: 'Birth date (YYYY-MM-DD or DD/MM/YYYY)' },
  { key: 'position',      label: 'Position',      required: false, description: 'Playing position or role (e.g. Forward, GK, Midfielder)' },
  { key: 'jersey_number', label: 'Jersey #',      required: false, description: 'Squad or kit number' },
  { key: 'phone',         label: 'Phone',         required: false, description: 'Contact phone number' },
  { key: 'email',         label: 'Email',         required: false, description: 'Email address' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/
const DATE_DMY = /^\d{2}[\/\-.]\d{2}[\/\-.]\d{4}$/
const NUMERIC  = /^\d+$/

// ── Exact codes the DB check constraint allows ───────────────────────────────
export const VALID_POSITIONS = new Set(['GK','CB','RB','LB','RWB','LWB','CDM','CM','CAM','RM','LM','RW','LW','CF','SS','ST'])

// ── Full English name → DB code ───────────────────────────────────────────────
export const POSITION_MAP = {
  // Goalkeeper
  'goalkeeper': 'GK', 'goal keeper': 'GK', 'gk': 'GK',
  // Defenders
  'defender': 'CB', 'defense': 'CB', 'defence': 'CB',
  'centre back': 'CB', 'center back': 'CB', 'central back': 'CB',
  'central defender': 'CB', 'centreback': 'CB', 'cb': 'CB',
  'full back': 'CB', 'fullback': 'CB', 'back': 'CB',
  'right back': 'RB', 'rightback': 'RB', 'rb': 'RB',
  'left back': 'LB', 'leftback': 'LB', 'lb': 'LB',
  'right wing back': 'RWB', 'right wingback': 'RWB', 'rwb': 'RWB',
  'left wing back': 'LWB', 'left wingback': 'LWB', 'lwb': 'LWB',
  // Midfielders
  'midfielder': 'CM', 'midfield': 'CM', 'mid': 'CM',
  'central defensive midfielder': 'CDM', 'defensive midfielder': 'CDM',
  'holding midfielder': 'CDM', 'defensive mid': 'CDM', 'cdm': 'CDM',
  'central midfielder': 'CM', 'centre midfielder': 'CM', 'cm': 'CM',
  'central attacking midfielder': 'CAM', 'attacking midfielder': 'CAM',
  'attacking mid': 'CAM', 'number 10': 'CAM', 'no. 10': 'CAM', 'cam': 'CAM',
  'right midfielder': 'RM', 'right midfield': 'RM', 'rm': 'RM',
  'left midfielder': 'LM', 'left midfield': 'LM', 'lm': 'LM',
  // Forwards / Wingers
  'right winger': 'RW', 'right wing': 'RW', 'winger right': 'RW', 'rw': 'RW',
  'left winger': 'LW', 'left wing': 'LW', 'winger left': 'LW', 'lw': 'LW',
  'winger': 'RW',           // generic winger → RW (most common)
  'wide midfielder': 'RM',  // ambiguous — default RM
  'centre forward': 'CF', 'center forward': 'CF', 'cf': 'CF',
  'second striker': 'SS', 'support striker': 'SS', 'ss': 'SS',
  'striker': 'ST', 'centre striker': 'ST', 'center striker': 'ST',
  'centre forward': 'ST', 'center forward': 'ST',
  'forward': 'ST', 'st': 'ST',
  'attacker': 'ST',
}

const VALID_POS_LIST = [...VALID_POSITIONS].join(', ')

export function normalisePosition(raw) {
  if (!raw) return { code: null, error: null }
  const trimmed = String(raw).trim()
  // Normalise hyphens → spaces so "Centre-Back" matches "centre back"
  const lower = trimmed.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  // Direct map lookup
  if (POSITION_MAP[lower]) return { code: POSITION_MAP[lower], error: null }
  // Already a valid code (case-insensitive)
  const upper = trimmed.toUpperCase()
  if (VALID_POSITIONS.has(upper)) return { code: upper, error: null }
  // Unrecognised
  return { code: null, error: `position "${trimmed}" is not recognised. Valid codes: ${VALID_POS_LIST}` }
}

// Excel serial date epoch
const XL_EPOCH = new Date(Date.UTC(1899, 11, 30))

/**
 * Convert a raw cell value (string, number, Date) to an ISO date string
 * or null if the value is empty / unparseable.
 */
export function normaliseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null

  // Already a JS Date (xlsx parsed it)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    return raw.toISOString().split('T')[0]
  }

  // Excel serial number (number type)
  if (typeof raw === 'number') {
    const d = new Date(XL_EPOCH.getTime() + raw * 86400000)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }

  const s = String(raw).trim()
  if (!s) return null

  // YYYY-MM-DD
  if (DATE_YMD.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : s
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  if (DATE_DMY.test(s)) {
    const [dd, mm, yyyy] = s.split(/[\/\-.]/)
    const d = new Date(`${yyyy}-${mm}-${dd}`)
    return isNaN(d.getTime()) ? null : `${yyyy}-${mm}-${dd}`
  }

  return null
}

/**
 * Clean a string by stripping non-alphanumeric characters and converting to lowercase.
 */
function cleanKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Run fast local fuzzy / case-insensitive matching against expected fields.
 * Ignores spaces, underscores, punctuation, casing.
 *
 * @param {string[]} headers - actual column headers from uploaded file
 * @returns {{
 *   mapping: Record<string, string | null>,
 *   matchedTypes: Record<string, 'local' | null>,
 *   unmappedFields: string[],
 *   unmappedHeaders: string[]
 * }}
 */
export function matchHeadersLocally(headers = []) {
  const mapping = {
    full_name: null,
    date_of_birth: null,
    position: null,
    jersey_number: null,
    phone: null,
    email: null,
  }

  const matchedTypes = {
    full_name: null,
    date_of_birth: null,
    position: null,
    jersey_number: null,
    phone: null,
    email: null,
  }

  // Set of assigned header strings to prevent two fields mapping to the same header
  const usedHeaders = new Set()

  // Specific cleaned aliases mapped to canonical keys
  const EXACT_ALIASES = {
    full_name: new Set([
      'fullname', 'name', 'playername', 'athletename', 'player', 'athlete',
      'athletefullname', 'playerfullname', 'firstandlastname', 'firstlastname',
      'footballername', 'membername'
    ]),
    date_of_birth: new Set([
      'dateofbirth', 'dob', 'birthdate', 'birthday', 'birth', 'datebirth',
      'borndate', 'playerdob'
    ]),
    position: new Set([
      'position', 'pos', 'playingposition', 'role', 'playerposition',
      'fieldposition', 'primaryposition', 'poscode'
    ]),
    jersey_number: new Set([
      'jerseynumber', 'jersey', 'number', 'backnumber', 'shirtnumber',
      'squadnumber', 'jerseyno', 'shirtno', 'squadno', 'no', 'kitnumber',
      'kitno', 'playernumber', 'squad', 'shirt', 'kit'
    ]),
    phone: new Set([
      'phone', 'phonenumber', 'mobile', 'mobilenumber', 'telephone',
      'contact', 'contactnumber', 'cell', 'cellphone', 'tel', 'phonecontact'
    ]),
    email: new Set([
      'email', 'emailaddress', 'mail', 'e-mail', 'electronicmail'
    ]),
  }

  // Pass 1: Exact cleaned alias match
  for (const field of EXPECTED_FIELDS) {
    const fieldKey = field.key
    const aliasSet = EXACT_ALIASES[fieldKey]

    for (const h of headers) {
      if (usedHeaders.has(h)) continue
      const cleaned = cleanKey(h)
      if (aliasSet.has(cleaned)) {
        mapping[fieldKey] = h
        matchedTypes[fieldKey] = 'local'
        usedHeaders.add(h)
        break
      }
    }
  }

  // Pass 2: Substring heuristics for fields still unmapped
  const SUBSTRING_RULES = [
    { key: 'full_name',     test: c => c.includes('fullname') || c.includes('playername') || (c.includes('name') && !c.includes('first') && !c.includes('last') && !c.includes('club') && !c.includes('team')) },
    { key: 'date_of_birth', test: c => c.includes('birth') || c.includes('dob') || c.includes('born') },
    { key: 'position',      test: c => c.includes('position') || c === 'pos' },
    { key: 'jersey_number', test: c => c.includes('jersey') || c.includes('shirt') || c.includes('squad') || c.includes('backnum') || c.includes('kit') },
    { key: 'phone',         test: c => c.includes('phone') || c.includes('mobile') || c.includes('teleph') },
    { key: 'email',         test: c => c.includes('email') || (c.includes('mail') && !c.includes('name')) },
  ]

  for (const rule of SUBSTRING_RULES) {
    if (!mapping[rule.key]) {
      for (const h of headers) {
        if (usedHeaders.has(h)) continue
        const cleaned = cleanKey(h)
        if (rule.test(cleaned)) {
          mapping[rule.key] = h
          matchedTypes[rule.key] = 'local'
          usedHeaders.add(h)
          break
        }
      }
    }
  }

  const unmappedFields = EXPECTED_FIELDS
    .map(f => f.key)
    .filter(k => !mapping[k])

  const unmappedHeaders = headers.filter(h => !usedHeaders.has(h))

  return { mapping, matchedTypes, unmappedFields, unmappedHeaders }
}

/**
 * Extract raw column headers and data rows from a CSV or XLSX file.
 *
 * @param {File | ArrayBuffer} file
 * @returns {Promise<{ headers: string[], rawRows: any[][], error: string | null }>}
 */
export async function extractSpreadsheetData(file) {
  let XLSX
  try {
    XLSX = await import('xlsx')
    XLSX = XLSX.default || XLSX
  } catch {
    return { headers: [], rawRows: [], error: 'Failed to load file parser. Please refresh and try again.' }
  }

  let workbook
  try {
    const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : file
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return { headers: [], rawRows: [], error: 'Could not read file. Make sure it is a valid .csv or .xlsx file.' }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rawRows: [], error: 'The file appears to be empty (no sheets found).' }
  }

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (!raw || raw.length < 2) {
    return { headers: [], rawRows: [], error: 'The file has no data rows. Please ensure it contains header and data rows.' }
  }

  // Row 0 is the header row
  const rawHeaderRow = raw[0] || []
  const headers = rawHeaderRow
    .map(c => String(c || '').trim())
    .filter((h, idx, self) => h !== '' && self.indexOf(h) === idx)

  if (headers.length === 0) {
    return { headers: [], rawRows: [], error: 'No column headers were found in the first row.' }
  }

  // Rows 1 onwards are data rows
  const rawRows = raw.slice(1)

  return { headers, rawRows, error: null }
}

/**
 * Apply confirmed column mapping to transform raw rows into validated athlete records.
 *
 * @param {any[][]} rawRows
 * @param {string[]} headers
 * @param {Record<string, string | null>} mapping - e.g. { full_name: 'Player Name', ... }
 * @returns {{ rows: object[], error: string | null }}
 */
export function transformAndValidateRows(rawRows, headers, mapping) {
  if (!mapping || !mapping.full_name) {
    return { rows: [], error: 'Full Name column must be mapped.' }
  }

  // Map each canonical key to column index in raw data
  const colIndexMap = {}
  headers.forEach((h, i) => {
    for (const [key, mappedHeader] of Object.entries(mapping)) {
      if (mappedHeader && mappedHeader === h) {
        colIndexMap[key] = i
      }
    }
  })

  if (colIndexMap.full_name === undefined) {
    return { rows: [], error: `Mapped header "${mapping.full_name}" for Full Name was not found in headers.` }
  }

  // Track jersey numbers seen within this file for duplicate detection
  const jerseysSeen = {} // jersey_number -> rowIndex
  const rows = []

  for (let ri = 0; ri < rawRows.length; ri++) {
    const row = rawRows[ri]
    if (!row || !Array.isArray(row)) continue

    // Skip completely blank rows across all mapped columns
    const hasContent = Object.values(colIndexMap).some(ci => String(row[ci] ?? '').trim() !== '')
    if (!hasContent) continue

    const get = key => (colIndexMap[key] !== undefined ? String(row[colIndexMap[key]] ?? '').trim() : '')

    const full_name    = get('full_name')
    const raw_dob      = colIndexMap.date_of_birth !== undefined ? row[colIndexMap.date_of_birth] : ''
    const position_raw = get('position')
    const jersey_raw   = get('jersey_number')
    const phone        = get('phone')
    const email        = get('email')

    const date_of_birth = normaliseDate(raw_dob)
    const { code: position, error: posError } = normalisePosition(position_raw)

    const errors = []

    // Required: full_name only
    if (!full_name) errors.push('full_name is required')
    if (posError)   errors.push(posError)

    // date_of_birth: if provided, must parse successfully
    if (raw_dob !== '' && raw_dob !== null && raw_dob !== undefined) {
      if (!date_of_birth) errors.push('date_of_birth is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)')
    }

    // jersey_number: if provided, must be numeric
    if (jersey_raw && !NUMERIC.test(jersey_raw)) {
      errors.push(`jersey_number "${jersey_raw}" is not a valid number`)
    }

    // email: if provided, must look valid
    if (email && !EMAIL_RE.test(email)) {
      errors.push(`email "${email}" is not a valid email address`)
    }

    // Duplicate jersey_number within this file
    const displayRow = ri + 1 // 1-based data row (header was row 1, data starts row 2)
    if (jersey_raw && NUMERIC.test(jersey_raw)) {
      if (jerseysSeen[jersey_raw] !== undefined) {
        errors.push(`jersey_number ${jersey_raw} is a duplicate (first seen at row ${jerseysSeen[jersey_raw] + 1})`)
      } else {
        jerseysSeen[jersey_raw] = ri + 1
      }
    }

    rows.push({
      full_name,
      date_of_birth: date_of_birth || null,
      position: position || null,
      back_number: jersey_raw && NUMERIC.test(jersey_raw) ? jersey_raw : null,
      phone:  phone  || null,
      email:  email  || null,
      _rowIndex: displayRow,
      _valid:  errors.length === 0,
      _errors: errors,
    })
  }

  if (rows.length === 0) {
    return { rows: [], error: 'No data rows were found in the file.' }
  }

  return { rows, error: null }
}

/**
 * Backward-compatible parseAthleteFile function.
 * If mapping is not provided, runs fast local fuzzy matching.
 *
 * @param {File} file
 * @param {Record<string, string | null>} [confirmedMapping]
 * @returns {Promise<{ rows: object[], headers?: string[], error: string | null }>}
 */
export async function parseAthleteFile(file, confirmedMapping = null) {
  const { headers, rawRows, error } = await extractSpreadsheetData(file)
  if (error) return { rows: [], headers: [], error }

  let mapping = confirmedMapping
  if (!mapping) {
    const local = matchHeadersLocally(headers)
    mapping = local.mapping
  }

  if (!mapping.full_name) {
    return {
      rows: [],
      headers,
      error: 'Missing required column: full_name. Please use the provided template or map columns.',
    }
  }

  const transformed = transformAndValidateRows(rawRows, headers, mapping)
  return { ...transformed, headers }
}
