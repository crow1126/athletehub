export const SPORTS = {
  football: {
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
      'Forwards':    ['RW', 'LW', 'CF', 'SS', 'ST']
    },
    metrics: [
      { key: 'goals', label: 'Goals', type: 'number', default: 0 },
      { key: 'assists', label: 'Assists', type: 'number', default: 0 },
      { key: 'minutes_played', label: 'Minutes Played', type: 'number', default: 0 },
      { key: 'clean_sheets', label: 'Clean Sheets', type: 'number', default: 0 },
      { key: 'yellow_cards', label: 'Yellow Cards', type: 'number', default: 0 },
      { key: 'red_cards', label: 'Red Cards', type: 'number', default: 0 }
    ]
  },
  basketball: {
    id: 'basketball',
    name: 'Basketball',
    jerseyLabel: 'Jersey Number',
    labels: {
      athletes: 'Roster',
      squad: 'Team Roster',
      coaches: 'Coaching Staff',
      transfers: 'Trade Board',
      performance: 'Game Statistics',
      matches: 'Games & Schedule',
    },
    positions: {
      'Guards':   ['Point Guard (PG)', 'Shooting Guard (SG)'],
      'Forwards': ['Small Forward (SF)', 'Power Forward (PF)'],
      'Center':   ['Center (C)']
    },
    metrics: [
      { key: 'points', label: 'Points (PTS)', type: 'number', default: 0 },
      { key: 'rebounds', label: 'Rebounds (REB)', type: 'number', default: 0 },
      { key: 'assists', label: 'Assists (AST)', type: 'number', default: 0 },
      { key: 'steals', label: 'Steals (STL)', type: 'number', default: 0 },
      { key: 'blocks', label: 'Blocks (BLK)', type: 'number', default: 0 },
      { key: 'fg_pct', label: 'Field Goal % (FG%)', type: 'number', default: 0 },
      { key: 'three_pt_pct', label: '3-Point % (3P%)', type: 'number', default: 0 },
      { key: 'ft_pct', label: 'Free Throw % (FT%)', type: 'number', default: 0 },
      { key: 'turnovers', label: 'Turnovers (TO)', type: 'number', default: 0 },
      { key: 'minutes_played', label: 'Minutes Played (MIN)', type: 'number', default: 0 }
    ]
  },
  american_football: {
    id: 'american_football',
    name: 'American Football',
    jerseyLabel: 'Jersey Number',
    labels: {
      athletes: 'Roster',
      squad: 'Team Roster',
      coaches: 'Coaching Staff',
      transfers: 'Roster Moves',
      performance: 'Game Stats',
      matches: 'Games & Schedule',
    },
    positions: {
      'Offense': ['Quarterback (QB)', 'Running Back (RB)', 'Wide Receiver (WR)', 'Tight End (TE)', 'Offensive Tackle (OT)', 'Guard (OG)', 'Center (C)'],
      'Defense': ['Defensive End (DE)', 'Defensive Tackle (DT)', 'Linebacker (LB)', 'Cornerback (CB)', 'Safety (S)'],
      'Special Teams': ['Kicker (K)', 'Punter (P)', 'Long Snapper (LS)']
    },
    metrics: [
      { key: 'passing_yards', label: 'Passing Yards', type: 'number', default: 0 },
      { key: 'passing_tds', label: 'Passing Touchdowns', type: 'number', default: 0 },
      { key: 'rushing_yards', label: 'Rushing Yards', type: 'number', default: 0 },
      { key: 'rushing_tds', label: 'Rushing Touchdowns', type: 'number', default: 0 },
      { key: 'receiving_yards', label: 'Receiving Yards', type: 'number', default: 0 },
      { key: 'tackles', label: 'Tackles', type: 'number', default: 0 },
      { key: 'sacks', label: 'Sacks', type: 'number', default: 0 },
      { key: 'interceptions', label: 'Interceptions', type: 'number', default: 0 }
    ]
  }
}

export function getSportConfig(sportId = 'football') {
  let normalized = (sportId || 'football').toLowerCase().trim()
  if (normalized === 'soccer') normalized = 'football'
  return SPORTS[normalized] || SPORTS.football
}
