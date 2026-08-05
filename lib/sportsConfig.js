// Football-only sport configuration
export const SPORT = {
  id: 'football',
  name: 'Football',
  jerseyLabel: 'Jersey No.',
  labels: {
    athletes: 'Athletes',
    squad: 'Squad Roster',
    coaches: 'Staff',
    transfers: 'Transfers',
    performance: 'Performance Stats',
    matches: 'Matches & Fixtures',
  },
  positions: {
    'Goalkeeper':  ['GK'],
    'Defenders':   ['CB', 'RB', 'LB', 'RWB', 'LWB'],
    'Midfielders': ['CDM', 'CM', 'CAM', 'RM', 'LM'],
    'Forwards':    ['RW', 'LW', 'CF', 'SS', 'ST'],
  },
  metrics: [
    { key: 'goals',          label: 'Goals',          type: 'number', default: 0 },
    { key: 'assists',        label: 'Assists',         type: 'number', default: 0 },
    { key: 'minutes_played', label: 'Minutes Played',  type: 'number', default: 0 },
    { key: 'clean_sheets',   label: 'Clean Sheets',    type: 'number', default: 0 },
    { key: 'yellow_cards',   label: 'Yellow Cards',    type: 'number', default: 0 },
    { key: 'red_cards',      label: 'Red Cards',       type: 'number', default: 0 },
  ],
}

/** Returns the football config (kept for backward compatibility) */
export function getSportConfig() {
  return SPORT
}
