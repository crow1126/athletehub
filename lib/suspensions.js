// Helper utilities for tracking and auto-clearing red-card match suspensions
// based on completed official season fixtures.

function parseSuspensionFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return { isRedCard: false, games: 0 }
  const match = notes.match(/\[Red Card:\s*Suspended for\s*(\d+)\s*match(?:es)?\]/i)
  if (match) {
    return { isRedCard: true, games: Math.max(1, parseInt(match[1], 10) || 1) }
  }
  if (/red card/i.test(notes)) {
    return { isRedCard: true, games: 1 }
  }
  return { isRedCard: false, games: 0 }
}

/**
 * Computes how many games of an athlete's latest red-card suspension have been
 * served based on official fixtures marked `status === 'completed'` with a
 * `match_date` strictly after the red card's `match_date`.
 */
function computeSuspensionProgress(athleteId, stats = [], fixtures = []) {
  if (!athleteId) return null

  const redCardLogs = (stats || [])
    .filter(s => s.athlete_id === athleteId && parseSuspensionFromNotes(s.notes).isRedCard)
    .sort((a, b) => String(b.match_date || '').localeCompare(String(a.match_date || '')))

  if (redCardLogs.length === 0) return null

  const latest = redCardLogs[0]
  const { games: totalGames } = parseSuspensionFromNotes(latest.notes)
  const redCardDate = latest.match_date || ''

  const completedAfter = (fixtures || []).filter(fx =>
    fx.status === 'completed' &&
    fx.match_date &&
    redCardDate &&
    String(fx.match_date) > String(redCardDate)
  )

  const gamesServed = completedAfter.length
  const remainingGames = Math.max(0, totalGames - gamesServed)

  return {
    totalGames,
    gamesServed: Math.min(gamesServed, totalGames),
    rawGamesServed: gamesServed,
    remainingGames,
    isServed: gamesServed >= totalGames,
    redCardDate,
    redCardOpponent: latest.opponent || '',
  }
}

module.exports = {
  parseSuspensionFromNotes,
  computeSuspensionProgress,
}
