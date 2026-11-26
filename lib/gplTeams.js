// Fallback / default 2026/2027 Ghana Premier League clubs with uploaded Supabase Storage crests.
// Used when the `league_teams` table is not yet created or empty; once migrated, Superadmin DB rows take precedence.
const BASE = 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams'

export const DEFAULT_GPL_TEAMS = [
  { id: 'gpl-aduana',          name: 'Aduana FC',              short_name: 'ADU', season: '2026/2027', logo_url: `${BASE}/aduana.png` },
  { id: 'gpl-asantekotoko',    name: 'Asante Kotoko SC',       short_name: 'KOT', season: '2026/2027', logo_url: `${BASE}/asantekotoko.png` },
  { id: 'gpl-ashgold',         name: 'AshantiGold SC',         short_name: 'ASH', season: '2026/2027', logo_url: `${BASE}/ashgold.png` },
  { id: 'gpl-basakeholystars', name: 'Basake Holy Stars FC',   short_name: 'BHS', season: '2026/2027', logo_url: `${BASE}/basakeholystars.png` },
  { id: 'gpl-bechemunited',    name: 'Bechem United FC',       short_name: 'BEC', season: '2026/2027', logo_url: `${BASE}/bechemunited.png` },
  { id: 'gpl-berekumchelsea',  name: 'Berekum Chelsea FC',     short_name: 'BCH', season: '2026/2027', logo_url: `${BASE}/chelsea.png` },
  { id: 'gpl-bibianigoldstars',name: 'Bibiani Gold Stars FC',  short_name: 'BGS', season: '2026/2027', logo_url: `${BASE}/goldstarsfc.png` },
  { id: 'gpl-debibiunited',    name: 'Debibi United FC',       short_name: 'DEB', season: '2026/2027', logo_url: `${BASE}/debibiunited.png` },
  { id: 'gpl-dreamsfc',        name: 'Dreams FC',              short_name: 'DRM', season: '2026/2027', logo_url: `${BASE}/dreamsfc.png` },
  { id: 'gpl-heartsofoak',     name: 'Accra Hearts of Oak SC', short_name: 'AHO', season: '2026/2027', logo_url: `${BASE}/hearts.png` },
  { id: 'gpl-heartoflions',    name: 'Heart of Lions FC',      short_name: 'HOL', season: '2026/2027', logo_url: `${BASE}/heartoflions.png` },
  { id: 'gpl-karelaunited',    name: 'Karela United FC',       short_name: 'KAR', season: '2026/2027', logo_url: `${BASE}/karelaunited.png` },
  { id: 'gpl-legoncities',     name: 'Legon Cities FC',        short_name: 'LEG', season: '2026/2027', logo_url: `${BASE}/legon_cities.png` },
  { id: 'gpl-medeama',         name: 'Medeama SC',             short_name: 'MED', season: '2026/2027', logo_url: `${BASE}/medeamasc.png` },
  { id: 'gpl-nsoatreman',      name: 'Nsoatreman FC',          short_name: 'NSO', season: '2026/2027', logo_url: `${BASE}/nsoatremanfc.png` },
  { id: 'gpl-portcity',        name: 'Port City FC',           short_name: 'PRT', season: '2026/2027', logo_url: `${BASE}/portcity.png` },
  { id: 'gpl-samartex',        name: 'FC Samartex 1996',       short_name: 'SAM', season: '2026/2027', logo_url: `${BASE}/samartex.png` },
  { id: 'gpl-swedruallblacks', name: 'Swedru All Blacks',      short_name: 'SAB', season: '2026/2027', logo_url: `${BASE}/swedruallblacks.png` },
  { id: 'gpl-visionfc',        name: 'Vision FC',              short_name: 'VIS', season: '2026/2027', logo_url: `${BASE}/vision.png` },
]
