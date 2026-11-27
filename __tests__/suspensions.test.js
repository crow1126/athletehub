const { parseSuspensionFromNotes, computeSuspensionProgress } = require('../lib/suspensions')

describe('suspension helpers', () => {
  test('parseSuspensionFromNotes extracts match count', () => {
    expect(parseSuspensionFromNotes('[Red Card: Suspended for 3 matches] Serious foul')).toEqual({
      isRedCard: true,
      games: 3,
    })
    expect(parseSuspensionFromNotes('[Red Card: Suspended for 1 match]')).toEqual({
      isRedCard: true,
      games: 1,
    })
    expect(parseSuspensionFromNotes('Red Card in 88th min')).toEqual({
      isRedCard: true,
      games: 1,
    })
    expect(parseSuspensionFromNotes('Great performance')).toEqual({
      isRedCard: false,
      games: 0,
    })
  })

  test('computeSuspensionProgress counts only completed fixtures after red card date', () => {
    const stats = [
      { athlete_id: 'a1', match_date: '2026-11-01', opponent: 'Hearts of Oak', notes: '[Red Card: Suspended for 2 matches]' },
    ]
    const fixtures = [
      { id: 'f0', match_date: '2026-10-25', status: 'completed' }, // before red card -> ignored
      { id: 'f1', match_date: '2026-11-01', status: 'completed' }, // same day -> ignored
      { id: 'f2', match_date: '2026-11-08', status: 'completed' }, // 1 served
      { id: 'f3', match_date: '2026-11-15', status: 'scheduled' }, // not completed -> ignored
      { id: 'f4', match_date: '2026-11-22', status: 'postponed' }, // postponed -> ignored
    ]

    const prog1 = computeSuspensionProgress('a1', stats, fixtures)
    expect(prog1).toMatchObject({
      totalGames: 2,
      gamesServed: 1,
      remainingGames: 1,
      isServed: false,
    })

    // Once f3 is marked completed by Analyst, suspension is served
    const updatedFixtures = fixtures.map(f => (f.id === 'f3' ? { ...f, status: 'completed' } : f))
    const prog2 = computeSuspensionProgress('a1', stats, updatedFixtures)
    expect(prog2).toMatchObject({
      totalGames: 2,
      gamesServed: 2,
      remainingGames: 0,
      isServed: true,
    })
  })
})
