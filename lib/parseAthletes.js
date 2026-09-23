/**
 * lib/parseAthletes.js
 *
 * Client-side CSV/Excel parser and column mapper for bulk athlete import.
 * Uses the `xlsx` package (already a production dependency).
 *
 * Supported fields:
 *   full_name | first_name | last_name | status | date_of_birth | age | position | jersey_number |
 *   phone | email | nationality | country | place_of_birth | membership_number | address |
 *   strong_foot | team_section | passport_number | wrist_measurement | height | weight |
 *   current_club | last_club | in_club_since | contract_until | contract_option_until | contract_details |
 *   clothing_size | shoe_size | number_lettering | landline | homepage | facebook | instagram | snapchat |
 *   iban | bic | tax_id
 */

export const EXPECTED_FIELDS = [
  { key: 'full_name',     label: 'Full Name',     required: false, description: "Athlete's full name (or auto-combined from First + Last Name)" },
  { key: 'first_name',    label: 'First Name',    required: false, description: 'Given / first name' },
  { key: 'last_name',     label: 'Last Name',     required: false, description: 'Family / last name' },
  { key: 'status',        label: 'Status',        required: false, description: 'Active, Injured, or Suspended (defaults to Active)' },
  { key: 'position',      label: 'Position',      required: false, description: 'Playing position or role (e.g. Forward, GK, Midfielder)' },
  { key: 'jersey_number', label: 'Jersey #',      required: false, description: 'Squad or kit number' },
  { key: 'date_of_birth', label: 'Date of Birth', required: false, description: 'Birth date (YYYY-MM-DD or DD/MM/YYYY)' },
  { key: 'age',           label: 'Age',           required: false, description: 'Player age' },
  { key: 'nationality',   label: 'Nationality',   required: false, description: 'Primary nationality (e.g. Ghanaian)' },
  { key: 'country',       label: 'Country',       required: false, description: 'Country of origin / residence (e.g. Ghana)' },
  { key: 'place_of_birth',label: 'Place of Birth',required: false, description: 'City/town of birth (e.g. Kumasi)' },
  { key: 'membership_number', label: 'Membership #', required: false, description: 'Club registration / member ID (e.g. MEM-1234)' },
  { key: 'address',       label: 'Address',       required: false, description: 'Residential address / clubhouse' },
  { key: 'phone',         label: 'Mobile Phone',  required: false, description: 'Contact phone number' },
  { key: 'email',         label: 'Email',         required: false, description: 'Contact email address' },
  { key: 'strong_foot',   label: 'Strong Foot',   required: false, description: 'Preferred foot (right, left, both)' },
  { key: 'team_section',  label: 'Team Section',  required: false, description: 'e.g. Defense inside, First Team' },
  { key: 'passport_number', label: 'Passport #',  required: false, description: 'Passport or national ID number' },
  { key: 'wrist_measurement', label: 'Wrist Info',required: false, description: 'Wrist measurement / bio info' },
  { key: 'height',        label: 'Height (cm)',   required: false, description: 'Player height in cm (e.g. 185)' },
  { key: 'weight',        label: 'Weight (kg)',   required: false, description: 'Player weight in kg (e.g. 78)' },
  { key: 'current_club',  label: 'Current Club',  required: false, description: 'Current club or academy name' },
  { key: 'last_club',     label: 'Last Club',     required: false, description: 'Previous / former club' },
  { key: 'in_club_since', label: 'In Club Since', required: false, description: 'Date joined club (YYYY-MM-DD)' },
  { key: 'contract_until',label: 'Contract Until',required: false, description: 'Contract expiration date (YYYY-MM-DD)' },
  { key: 'contract_option_until', label: 'Option Until', required: false, description: 'Contract option date (YYYY-MM-DD)' },
  { key: 'contract_details', label: 'Contract Notes', required: false, description: 'Contract details or clauses' },
  { key: 'clothing_size', label: 'Clothing Size', required: false, description: 'Kit / apparel size (e.g. L, XL)' },
  { key: 'shoe_size',     label: 'Shoe Size',     required: false, description: 'Boot / cleat size (e.g. 43, 45)' },
  { key: 'number_lettering', label: 'Jersey Lettering', required: false, description: 'Custom jersey printing / lettering' },
  { key: 'landline',      label: 'Landline',      required: false, description: 'Landline telephone' },
  { key: 'homepage',      label: 'Homepage',      required: false, description: 'Personal website or profile URL' },
  { key: 'facebook',      label: 'Facebook',      required: false, description: 'Facebook handle / username' },
  { key: 'instagram',     label: 'Instagram',     required: false, description: 'Instagram handle / username' },
  { key: 'snapchat',      label: 'Snapchat',      required: false, description: 'Snapchat handle / username' },
  { key: 'iban',          label: 'IBAN',          required: false, description: 'Bank IBAN' },
  { key: 'bic',           label: 'BIC / SWIFT',   required: false, description: 'Bank BIC / SWIFT code' },
  { key: 'tax_id',        label: 'Tax ID',        required: false, description: 'Tax identification number' },
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
  'winger': 'RW',
  'wide midfielder': 'RM',
  'centre forward': 'CF', 'center forward': 'CF', 'cf': 'CF',
  'second striker': 'SS', 'support striker': 'SS', 'ss': 'SS',
  'striker': 'ST', 'centre striker': 'ST', 'center striker': 'ST',
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

// ── Status Normaliser ─────────────────────────────────────────────────────────
export function normaliseStatus(raw) {
  if (!raw) return 'Active'
  const s = String(raw).trim().toLowerCase()
  if (s.includes('injur')) return 'Injured'
  if (s.includes('suspend') || s.includes('ban') || s.includes('red card')) return 'Suspended'
  if (s.includes('act') || s.includes('fit') || s.includes('avail')) return 'Active'
  return 'Active'
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
 */
export function matchHeadersLocally(headers = []) {
  const mapping = {}
  const matchedTypes = {}
  EXPECTED_FIELDS.forEach(f => {
    mapping[f.key] = null
    matchedTypes[f.key] = null
  })

  // Set of assigned header strings to prevent two fields mapping to the same header
  const usedHeaders = new Set()

  // Specific cleaned aliases mapped to canonical keys
  const EXACT_ALIASES = {
    full_name: new Set([
      'fullname', 'name', 'playername', 'athletename', 'player', 'athlete',
      'athletefullname', 'playerfullname', 'firstandlastname', 'firstlastname',
      'footballername', 'membername'
    ]),
    first_name: new Set([
      'firstname', 'first', 'givenname', 'fname', 'forename'
    ]),
    last_name: new Set([
      'lastname', 'last', 'familyname', 'surname', 'lname'
    ]),
    status: new Set([
      'status', 'playerstatus', 'currentstatus', 'availability', 'athletestatus'
    ]),
    date_of_birth: new Set([
      'dateofbirth', 'dob', 'birthdate', 'birthday', 'birth', 'datebirth',
      'borndate', 'playerdob'
    ]),
    age: new Set([
      'age', 'playerage', 'years'
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
      'contact', 'contactnumber', 'cell', 'cellphone', 'tel', 'phonecontact', 'mobilephone'
    ]),
    email: new Set([
      'email', 'emailaddress', 'mail', 'email', 'electronicmail'
    ]),
    nationality: new Set([
      'nationality', 'citizen', 'citizenship', 'nat'
    ]),
    country: new Set([
      'country', 'countryoforigin', 'nation'
    ]),
    place_of_birth: new Set([
      'placeofbirth', 'birthplace', 'pob', 'cityofbirth'
    ]),
    membership_number: new Set([
      'membershipnumber', 'membershipno', 'memberno', 'memno', 'regno', 'registrationnumber', 'memberid'
    ]),
    address: new Set([
      'address', 'residence', 'homeaddress', 'clubhouse'
    ]),
    strong_foot: new Set([
      'strongfoot', 'preferredfoot', 'foot', 'leg', 'footing'
    ]),
    team_section: new Set([
      'teamsection', 'section', 'squadsection'
    ]),
    passport_number: new Set([
      'passportnumber', 'passportno', 'passport', 'idnumber', 'idno', 'nationalid'
    ]),
    wrist_measurement: new Set([
      'wristmeasurement', 'wristmeasurementinfo', 'wristinfo', 'wrist'
    ]),
    height: new Set([
      'height', 'heightcm', 'ht', 'stature'
    ]),
    weight: new Set([
      'weight', 'weightkg', 'wt'
    ]),
    current_club: new Set([
      'currentclub', 'currentteam', 'club', 'team'
    ]),
    last_club: new Set([
      'lastclub', 'previousclub', 'formerclub', 'priorclub'
    ]),
    in_club_since: new Set([
      'inclubsince', 'joineddate', 'signupdate', 'since'
    ]),
    contract_until: new Set([
      'contractuntil', 'contractexpiry', 'contractend', 'validuntil'
    ]),
    contract_option_until: new Set([
      'contractoptionuntil', 'contractoption', 'optionuntil'
    ]),
    contract_details: new Set([
      'contractdetails', 'contractnotes', 'contractterms'
    ]),
    clothing_size: new Set([
      'clothingsize', 'kitsize', 'jerseysize', 'shirtsize', 'size'
    ]),
    shoe_size: new Set([
      'shoesize', 'bootsize', 'cleatsize'
    ]),
    number_lettering: new Set([
      'numberlettering', 'lettering', 'printing'
    ]),
    landline: new Set([
      'landline', 'homephone'
    ]),
    homepage: new Set([
      'homepage', 'website', 'web'
    ]),
    facebook: new Set([
      'facebook', 'fb'
    ]),
    instagram: new Set([
      'instagram', 'ig'
    ]),
    snapchat: new Set([
      'snapchat', 'snap'
    ]),
    iban: new Set([
      'iban', 'bankaccount'
    ]),
    bic: new Set([
      'bic', 'swift', 'biccode'
    ]),
    tax_id: new Set([
      'taxid', 'tin', 'taxnumber'
    ]),
  }

  // Pass 1: Exact cleaned alias match
  for (const field of EXPECTED_FIELDS) {
    const fieldKey = field.key
    const aliasSet = EXACT_ALIASES[fieldKey]
    if (!aliasSet) continue

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
    { key: 'full_name',     test: c => c.includes('fullname') || c.includes('playername') || (c.includes('name') && !c.includes('first') && !c.includes('last') && !c.includes('club') && !c.includes('team') && !c.includes('member')) },
    { key: 'first_name',    test: c => c.includes('firstname') || c.includes('givenname') || c === 'first' },
    { key: 'last_name',     test: c => c.includes('lastname') || c.includes('surname') || c.includes('familyname') || c === 'last' },
    { key: 'status',        test: c => c.includes('status') || c.includes('availab') },
    { key: 'date_of_birth', test: c => c.includes('birth') || c.includes('dob') || c.includes('born') },
    { key: 'age',           test: c => c === 'age' || c.includes('playerage') },
    { key: 'position',      test: c => c.includes('position') || c === 'pos' },
    { key: 'jersey_number', test: c => c.includes('jersey') || c.includes('shirt') || c.includes('squad') || c.includes('backnum') || c.includes('kit') },
    { key: 'phone',         test: c => c.includes('phone') || c.includes('mobile') || c.includes('teleph') },
    { key: 'email',         test: c => c.includes('email') || (c.includes('mail') && !c.includes('name')) },
    { key: 'nationality',   test: c => c.includes('nation') || c.includes('citizen') },
    { key: 'country',       test: c => c.includes('country') },
    { key: 'membership_number', test: c => c.includes('member') || c.includes('regno') },
    { key: 'strong_foot',   test: c => c.includes('foot') || c.includes('leg') },
    { key: 'passport_number', test: c => c.includes('passport') },
    { key: 'height',        test: c => c.includes('height') || c === 'ht' },
    { key: 'weight',        test: c => c.includes('weight') || c === 'wt' },
    { key: 'current_club',  test: c => c.includes('currentclub') || (c.includes('club') && !c.includes('last') && !c.includes('since')) },
    { key: 'last_club',     test: c => c.includes('lastclub') || c.includes('prevclub') || c.includes('formerclub') },
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
    .filter(Boolean)

  if (headers.length === 0) {
    return { headers: [], rawRows: [], error: 'No column headers found in the first row.' }
  }

  const rawRows = raw.slice(1)
  return { headers, rawRows, error: null }
}

/**
 * Transform raw spreadsheet rows using the confirmed mapping and apply validation rules.
 */
export function transformAndValidateRows(rawRows, headers, mapping) {
  const hasName = mapping && (mapping.full_name || mapping.first_name || mapping.last_name)
  if (!mapping || !hasName) {
    return { rows: [], error: 'Full Name or First Name column must be mapped.' }
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
    const getRaw = key => (colIndexMap[key] !== undefined ? row[colIndexMap[key]] : '')

    let full_name  = get('full_name')
    let first_name = get('first_name')
    let last_name  = get('last_name')

    // If full_name is missing but first_name / last_name exist, assemble full_name
    if (!full_name && (first_name || last_name)) {
      full_name = [first_name, last_name].filter(Boolean).join(' ').trim()
    } else if (full_name && !first_name && !last_name) {
      const parts = full_name.split(' ')
      first_name = parts[0] || ''
      last_name = parts.slice(1).join(' ') || ''
    }

    const raw_dob      = getRaw('date_of_birth')
    const position_raw = get('position')
    const jersey_raw   = get('jersey_number')
    const phone        = get('phone')
    const email        = get('email')
    const raw_status   = get('status')

    const date_of_birth = normaliseDate(raw_dob)
    const { code: position, error: posError } = normalisePosition(position_raw)
    const status = normaliseStatus(raw_status)

    // Other biodata fields
    const nationality         = get('nationality') || null
    const country             = get('country') || null
    const place_of_birth      = get('place_of_birth') || null
    const membership_number   = get('membership_number') || null
    const address             = get('address') || null
    const team_section        = get('team_section') || null
    const passport_number     = get('passport_number') || null
    const wrist_measurement   = get('wrist_measurement') || null
    const current_club        = get('current_club') || null
    const last_club           = get('last_club') || null
    const in_club_since       = normaliseDate(getRaw('in_club_since'))
    const contract_until      = normaliseDate(getRaw('contract_until'))
    const contract_option_until = normaliseDate(getRaw('contract_option_until'))
    const contract_details    = get('contract_details') || null
    const clothing_size       = get('clothing_size') || null
    const shoe_size           = get('shoe_size') || null
    const number_lettering    = get('number_lettering') || null
    const landline            = get('landline') || null
    const homepage            = get('homepage') || null
    const facebook            = get('facebook') || null
    const instagram           = get('instagram') || null
    const snapchat            = get('snapchat') || null
    const iban                = get('iban') || null
    const bic                 = get('bic') || null
    const tax_id              = get('tax_id') || null

    // Strong foot: right, left, both
    let strong_foot = null
    const sfRaw = get('strong_foot').toLowerCase()
    if (sfRaw.includes('right') || sfRaw === 'rf' || sfRaw === 'r') strong_foot = 'right'
    else if (sfRaw.includes('left') || sfRaw === 'lf' || sfRaw === 'l') strong_foot = 'left'
    else if (sfRaw.includes('both') || sfRaw === 'either' || sfRaw === 'two') strong_foot = 'both'

    // Numeric parsing
    const raw_age = get('age')
    const age = raw_age && NUMERIC.test(raw_age) ? parseInt(raw_age, 10) : null
    const raw_ht = get('height')
    const height = raw_ht && !isNaN(parseFloat(raw_ht)) ? parseFloat(raw_ht) : null
    const raw_wt = get('weight')
    const weight = raw_wt && !isNaN(parseFloat(raw_wt)) ? parseFloat(raw_wt) : null

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
      first_name: first_name || null,
      last_name: last_name || null,
      status,
      date_of_birth: date_of_birth || null,
      age,
      position: position || null,
      back_number: jersey_raw && NUMERIC.test(jersey_raw) ? jersey_raw : null,
      phone:  phone  || null,
      email:  email  || null,
      nationality,
      country,
      place_of_birth,
      membership_number,
      address,
      strong_foot,
      team_section,
      passport_number,
      wrist_measurement,
      height,
      weight,
      club: current_club,
      current_club,
      last_club,
      in_club_since,
      contract_until,
      contract_option_until,
      contract_details,
      clothing_size,
      shoe_size,
      number_lettering,
      landline,
      homepage,
      facebook,
      instagram,
      snapchat,
      iban,
      bic,
      tax_id,
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
 */
export async function parseAthleteFile(file, confirmedMapping = null) {
  const { headers, rawRows, error } = await extractSpreadsheetData(file)
  if (error) return { rows: [], headers: [], error }

  let mapping = confirmedMapping
  if (!mapping) {
    const local = matchHeadersLocally(headers)
    mapping = local.mapping
  }

  if (!mapping.full_name && !mapping.first_name) {
    return {
      rows: [],
      headers,
      error: 'Missing required column: Full Name or First Name. Please use the provided template or map columns.',
    }
  }

  const transformed = transformAndValidateRows(rawRows, headers, mapping)
  return { ...transformed, headers }
}
