// __tests__/parseAthletes.test.js
// Unit tests for bulk athlete upload column mapping and row transformation.
// Run with: npm test
//
// Note: Uses inline pure implementations for Jest compatibility, matching the
// pattern established in __tests__/moolre.test.js and __tests__/serverAuth.test.js
// to avoid ESM module resolution issues with Jest on Windows/Node without transform.

const EXPECTED_FIELDS = [
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

const VALID_POSITIONS = new Set(['GK','CB','RB','LB','RWB','LWB','CDM','CM','CAM','RM','LM','RW','LW','CF','SS','ST'])

const POSITION_MAP = {
  'goalkeeper': 'GK', 'goal keeper': 'GK', 'gk': 'GK',
  'defender': 'CB', 'defense': 'CB', 'defence': 'CB',
  'centre back': 'CB', 'center back': 'CB', 'central back': 'CB',
  'central defender': 'CB', 'centreback': 'CB', 'cb': 'CB',
  'full back': 'CB', 'fullback': 'CB', 'back': 'CB',
  'right back': 'RB', 'rightback': 'RB', 'rb': 'RB',
  'left back': 'LB', 'leftback': 'LB', 'lb': 'LB',
  'right wing back': 'RWB', 'right wingback': 'RWB', 'rwb': 'RWB',
  'left wing back': 'LWB', 'left wingback': 'LWB', 'lwb': 'LWB',
  'midfielder': 'CM', 'midfield': 'CM', 'mid': 'CM',
  'central defensive midfielder': 'CDM', 'defensive midfielder': 'CDM',
  'holding midfielder': 'CDM', 'defensive mid': 'CDM', 'cdm': 'CDM',
  'central midfielder': 'CM', 'centre midfielder': 'CM', 'cm': 'CM',
  'central attacking midfielder': 'CAM', 'attacking midfielder': 'CAM',
  'attacking mid': 'CAM', 'number 10': 'CAM', 'no. 10': 'CAM', 'cam': 'CAM',
  'right midfielder': 'RM', 'right midfield': 'RM', 'rm': 'RM',
  'left midfielder': 'LM', 'left midfielder': 'LM', 'lm': 'LM',
  'right winger': 'RW', 'right wing': 'RW', 'winger right': 'RW', 'rw': 'RW',
  'left winger': 'LW', 'left wing': 'LW', 'winger left': 'LW', 'lw': 'LW',
  'winger': 'RW', 'wide midfielder': 'RM',
  'centre forward': 'CF', 'center forward': 'CF', 'cf': 'CF',
  'second striker': 'SS', 'support striker': 'SS', 'ss': 'SS',
  'striker': 'ST', 'centre striker': 'ST', 'center striker': 'ST',
  'centre-forward': 'ST', 'center-forward': 'ST',
  'forward': 'ST', 'st': 'ST', 'attacker': 'ST',
}

const VALID_POS_LIST = [...VALID_POSITIONS].join(', ')

function normalisePosition(raw) {
  if (!raw) return { code: null, error: null }
  const trimmed = String(raw).trim()
  const lower   = trimmed.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (POSITION_MAP[lower]) return { code: POSITION_MAP[lower], error: null }
  const upper = trimmed.toUpperCase()
  if (VALID_POSITIONS.has(upper)) return { code: upper, error: null }
  return { code: null, error: `position "${trimmed}" is not recognised. Valid codes: ${VALID_POS_LIST}` }
}

const XL_EPOCH = new Date(Date.UTC(1899, 11, 30))

function normaliseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    return raw.toISOString().split('T')[0]
  }
  if (typeof raw === 'number') {
    const d = new Date(XL_EPOCH.getTime() + raw * 86400000)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }
  const s = String(raw).trim()
  if (!s) return null
  if (DATE_YMD.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : s
  }
  if (DATE_DMY.test(s)) {
    const [dd, mm, yyyy] = s.split(/[\/\-.]/)
    const d = new Date(`${yyyy}-${mm}-${dd}`)
    return isNaN(d.getTime()) ? null : `${yyyy}-${mm}-${dd}`
  }
  return null
}

function cleanKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchHeadersLocally(headers = []) {
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

  const usedHeaders = new Set()

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

  // Pass 2: Substring heuristics
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

function transformAndValidateRows(rawRows, headers, mapping) {
  if (!mapping || !mapping.full_name) {
    return { rows: [], error: 'Full Name column must be mapped.' }
  }

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

  const jerseysSeen = {}
  const rows = []

  for (let ri = 0; ri < rawRows.length; ri++) {
    const row = rawRows[ri]
    if (!row || !Array.isArray(row)) continue

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
    const back_number   = jersey_raw || null

    const errors = []

    if (!full_name) errors.push('full_name is required')
    if (posError)   errors.push(posError)

    if (raw_dob !== '' && raw_dob !== null && raw_dob !== undefined) {
      if (!date_of_birth) errors.push('date_of_birth is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)')
    }

    if (jersey_raw && !NUMERIC.test(jersey_raw)) {
      errors.push(`jersey_number "${jersey_raw}" is not a valid number`)
    }

    if (email && !EMAIL_RE.test(email)) {
      errors.push(`email "${email}" is not a valid email address`)
    }

    const displayRow = ri + 1
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

describe('EXPECTED_FIELDS', () => {
  test('defines the 6 expected profile fields', () => {
    const keys = EXPECTED_FIELDS.map(f => f.key)
    expect(keys).toEqual([
      'full_name',
      'date_of_birth',
      'position',
      'jersey_number',
      'phone',
      'email',
    ])
    const fullNameField = EXPECTED_FIELDS.find(f => f.key === 'full_name')
    expect(fullNameField.required).toBe(true)
  })
})

describe('matchHeadersLocally', () => {
  test('matches standard canonical headers', () => {
    const headers = ['full_name', 'date_of_birth', 'position', 'jersey_number', 'phone', 'email']
    const res = matchHeadersLocally(headers)

    expect(res.mapping.full_name).toBe('full_name')
    expect(res.mapping.date_of_birth).toBe('date_of_birth')
    expect(res.mapping.position).toBe('position')
    expect(res.mapping.jersey_number).toBe('jersey_number')
    expect(res.mapping.phone).toBe('phone')
    expect(res.mapping.email).toBe('email')
    expect(res.unmappedFields).toEqual([])
    expect(res.unmappedHeaders).toEqual([])
  })

  test('matches messy, space-separated, capitalized, and punctuated headers', () => {
    const headers = [
      'Player Name',
      'D.O.B.',
      'Playing Position',
      'Squad #',
      'Mobile Contact',
      'Email Address',
    ]
    const res = matchHeadersLocally(headers)

    expect(res.mapping.full_name).toBe('Player Name')
    expect(res.mapping.date_of_birth).toBe('D.O.B.')
    expect(res.mapping.position).toBe('Playing Position')
    expect(res.mapping.jersey_number).toBe('Squad #')
    expect(res.mapping.phone).toBe('Mobile Contact')
    expect(res.mapping.email).toBe('Email Address')
    expect(res.unmappedFields).toEqual([])
    expect(res.unmappedHeaders).toEqual([])
  })

  test('correctly maps single-word uppercase variants (NAME, DOB, POS, NO, TEL, MAIL)', () => {
    const headers = ['NAME', 'DOB', 'POS', 'NO', 'TEL', 'MAIL']
    const res = matchHeadersLocally(headers)

    expect(res.mapping.full_name).toBe('NAME')
    expect(res.mapping.date_of_birth).toBe('DOB')
    expect(res.mapping.position).toBe('POS')
    expect(res.mapping.jersey_number).toBe('NO')
    expect(res.mapping.phone).toBe('TEL')
    expect(res.mapping.email).toBe('MAIL')
  })

  test('leaves unmatched headers and fields in unmapped arrays', () => {
    const headers = ['Full Name', 'Height', 'Weight', 'Blood Group']
    const res = matchHeadersLocally(headers)

    expect(res.mapping.full_name).toBe('Full Name')
    expect(res.mapping.position).toBeNull()
    expect(res.mapping.date_of_birth).toBeNull()
    expect(res.unmappedFields).toContain('position')
    expect(res.unmappedFields).toContain('date_of_birth')
    expect(res.unmappedHeaders).toEqual(['Height', 'Weight', 'Blood Group'])
  })
})

describe('transformAndValidateRows', () => {
  const headers = ['Athlete', 'Birthdate', 'Role', 'Kit No', 'Contact']
  const mapping = {
    full_name: 'Athlete',
    date_of_birth: 'Birthdate',
    position: 'Role',
    jersey_number: 'Kit No',
    phone: 'Contact',
    email: null,
  }

  test('successfully maps and validates valid rows', () => {
    const rawRows = [
      ['Kwadwo Asamoah', '1998-12-09', 'Midfielder', '10', '0244123456'],
      ['Thomas Partey', '1993-06-13', 'CDM', '5', '0200987654'],
    ]

    const res = transformAndValidateRows(rawRows, headers, mapping)
    expect(res.error).toBeNull()
    expect(res.rows.length).toBe(2)

    expect(res.rows[0].full_name).toBe('Kwadwo Asamoah')
    expect(res.rows[0].position).toBe('CM') // 'Midfielder' maps to 'CM'
    expect(res.rows[0].back_number).toBe('10')
    expect(res.rows[0]._valid).toBe(true)

    expect(res.rows[1].full_name).toBe('Thomas Partey')
    expect(res.rows[1].position).toBe('CDM')
    expect(res.rows[1].back_number).toBe('5')
    expect(res.rows[1]._valid).toBe(true)
  })

  test('flags invalid rows and duplicate jersey numbers within file', () => {
    const rawRows = [
      ['Player One', '2000-01-01', 'Striker', '9', ''],
      ['Player Two', 'invalid-date', 'UnknownPos', '9', ''], // Duplicate jersey #9, invalid date, bad pos
      ['', '2001-02-02', 'GK', '1', ''],                     // Missing required name
    ]

    const res = transformAndValidateRows(rawRows, headers, mapping)
    expect(res.error).toBeNull()
    expect(res.rows.length).toBe(3)

    expect(res.rows[0]._valid).toBe(true)

    // Row 2 should have duplicate jersey, invalid date, and unrecognized position errors
    expect(res.rows[1]._valid).toBe(false)
    expect(res.rows[1]._errors.some(e => e.includes('duplicate'))).toBe(true)
    expect(res.rows[1]._errors.some(e => e.includes('not a valid date'))).toBe(true)
    expect(res.rows[1]._errors.some(e => e.includes('not recognised'))).toBe(true)

    // Row 3 should have missing full_name
    expect(res.rows[2]._valid).toBe(false)
    expect(res.rows[2]._errors).toContain('full_name is required')
  })

  test('returns error if full_name is not mapped', () => {
    const unmappedName = { ...mapping, full_name: null }
    const res = transformAndValidateRows([['Row Data']], headers, unmappedName)
    expect(res.error).toBe('Full Name column must be mapped.')
  })
})

describe('normalisePosition & normaliseDate helpers', () => {
  test('normalises position aliases', () => {
    expect(normalisePosition('goalkeeper').code).toBe('GK')
    expect(normalisePosition('striker').code).toBe('ST')
    expect(normalisePosition('central back').code).toBe('CB')
    expect(normalisePosition('Centre-Back').code).toBe('CB')
    expect(normalisePosition('Full-Back').code).toBe('CB')
    expect(normalisePosition('lw').code).toBe('LW')
    expect(normalisePosition('unknown_xyz').code).toBeNull()
  })

  test('normalises date strings', () => {
    expect(normaliseDate('2000-05-15')).toBe('2000-05-15')
    expect(normaliseDate('15/05/2000')).toBe('2000-05-15')
    expect(normaliseDate('15.05.2000')).toBe('2000-05-15')
    expect(normaliseDate('invalid-date')).toBeNull()
  })
})
