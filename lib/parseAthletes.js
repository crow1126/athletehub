/**
 * lib/parseAthletes.js
 *
 * Client-side CSV/Excel parser for bulk athlete import.
 * Uses the `xlsx` package (already a production dependency).
 *
 * Columns expected in the uploaded file (case-insensitive):
 *   full_name | date_of_birth | position | jersey_number | phone | email
 *
 * Returns: { rows: ParsedRow[], error: string | null }
 *
 * Each ParsedRow:
 *   { full_name, date_of_birth, position, back_number, phone, email,
 *     _rowIndex, _valid, _errors }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/
const DATE_DMY = /^\d{2}[\/\-.]\d{2}[\/\-.]\d{4}$/
const NUMERIC  = /^\d+$/

// Excel serial date epoch
const XL_EPOCH = new Date(Date.UTC(1899, 11, 30))

/**
 * Convert a raw cell value (string, number, Date) to an ISO date string
 * or null if the value is empty / unparseable.
 */
function normaliseDate(raw) {
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
 * Normalise a header string to a consistent key.
 * Maps common aliases to our canonical column names.
 */
function normaliseHeader(h) {
  const s = String(h || '').toLowerCase().trim().replace(/[\s_-]+/g, '_')
  const aliases = {
    full_name:      ['full_name', 'name', 'athlete_name', 'player_name', 'fullname'],
    date_of_birth:  ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'birthday'],
    position:       ['position', 'pos', 'playing_position'],
    jersey_number:  ['jersey_number', 'jersey', 'number', 'back_number', 'shirt_number', 'squad_number'],
    phone:          ['phone', 'mobile', 'telephone', 'contact', 'phone_number'],
    email:          ['email', 'email_address', 'e_mail'],
  }
  for (const [canonical, list] of Object.entries(aliases)) {
    if (list.includes(s)) return canonical
  }
  return s
}

/**
 * Parse a File object (.csv or .xlsx) and return validated rows.
 *
 * @param {File} file
 * @returns {Promise<{ rows: object[], error: string | null }>}
 */
export async function parseAthleteFile(file) {
  let XLSX
  try {
    XLSX = await import('xlsx')
    XLSX = XLSX.default || XLSX
  } catch {
    return { rows: [], error: 'Failed to load file parser. Please refresh and try again.' }
  }

  let workbook
  try {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return { rows: [], error: 'Could not read file. Make sure it is a valid .csv or .xlsx file.' }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], error: 'The file appears to be empty (no sheets found).' }
  }

  const sheet = workbook.Sheets[sheetName]
  /** @type {object[]} */
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (raw.length < 2) {
    return { rows: [], error: 'The file has no data rows. Please use the provided template.' }
  }

  // Build header index
  const headerRow = raw[0]
  const colMap = {} // canonical key -> column index
  headerRow.forEach((cell, i) => {
    const key = normaliseHeader(cell)
    if (key && !(key in colMap)) colMap[key] = i
  })

  const required = ['full_name', 'position']
  const missing = required.filter(k => !(k in colMap))
  if (missing.length) {
    return {
      rows: [],
      error: `Missing required column(s): ${missing.join(', ')}. Please use the provided template.`,
    }
  }

  // Track jersey numbers seen within this file (for duplicate detection)
  const jerseysSeen = {} // jersey_number -> first rowIndex (1-based display)

  const rows = []

  for (let ri = 1; ri < raw.length; ri++) {
    const row = raw[ri]

    // Skip completely blank rows
    const hasContent = Object.values(colMap).some(ci => String(row[ci] ?? '').trim() !== '')
    if (!hasContent) continue

    const get = key => String(row[colMap[key]] ?? '').trim()

    const full_name    = colMap.full_name    !== undefined ? get('full_name')    : ''
    const raw_dob      = colMap.date_of_birth !== undefined ? row[colMap.date_of_birth] : ''
    const position     = colMap.position      !== undefined ? get('position')     : ''
    const jersey_raw   = colMap.jersey_number !== undefined ? get('jersey_number'): ''
    const phone        = colMap.phone         !== undefined ? get('phone')        : ''
    const email        = colMap.email         !== undefined ? get('email')        : ''

    const date_of_birth = normaliseDate(raw_dob)
    const back_number   = jersey_raw || null   // keep original string; validate below

    const errors = []

    // Required: full_name
    if (!full_name) errors.push('full_name is required')

    // Required: position
    if (!position) errors.push('position is required')

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
    const displayRow = ri // 1-based sheet row (header is row 1, data starts row 2)
    if (jersey_raw && NUMERIC.test(jersey_raw)) {
      if (jerseysSeen[jersey_raw] !== undefined) {
        errors.push(`jersey_number ${jersey_raw} is a duplicate (first seen at row ${jerseysSeen[jersey_raw] + 1})`)
      } else {
        jerseysSeen[jersey_raw] = ri
      }
    }

    rows.push({
      full_name,
      date_of_birth: date_of_birth || null,
      position,
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
