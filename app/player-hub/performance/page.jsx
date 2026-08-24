'use client'
import { useState, useEffect } from 'react'
import PlayerLayout from '@/components/PlayerLayout'
import { supabase } from '@/lib/supabase'
import { Award, ShieldAlert, Zap, Calendar, TrendingUp } from 'lucide-react'

export default function MyPerformance() {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, team_id, athlete_id')
          .eq('id', session.user.id)
          .single()

        setProfile(prof)

        let effectiveAthleteId = prof?.athlete_id
        if (!effectiveAthleteId && prof?.team_id && prof?.full_name) {
          const { data: matchedAth } = await supabase
            .from('athletes')
            .select('id')
            .eq('team_id', prof.team_id)
            .ilike('name', prof.full_name.trim())
            .limit(1)
            .maybeSingle()
          if (matchedAth?.id) {
            effectiveAthleteId = matchedAth.id
            setProfile(p => ({ ...p, athlete_id: matchedAth.id }))
            supabase.from('profiles').update({ athlete_id: matchedAth.id }).eq('id', prof.id).then(() => {})
          }
        }

        if (effectiveAthleteId) {
          const { data: statsData } = await supabase
            .from('performance_stats')
            .select('*')
            .eq('athlete_id', effectiveAthleteId)
            .order('match_date', { ascending: false })

          setStats(statsData || [])
        }
      } catch (err) {
        console.error('Error loading performance stats:', err)
      }
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <PlayerLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--lagoon)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </PlayerLayout>
    )
  }

  if (!profile?.athlete_id) {
    return (
      <PlayerLayout>
        <div style={{ padding: '40px', maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}></div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>No Linked Athlete Profile</h2>
          <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
            Your player login has not been linked to a player card yet. Contact your club administrator.
          </p>
        </div>
      </PlayerLayout>
    )
  }

  // Calculate Aggregates
  const totalMatches = stats.length
  const totalMinutes = stats.reduce((acc, s) => acc + (s.minutes_played || 0), 0)
  const totalGoals = stats.reduce((acc, s) => acc + (s.goals || 0), 0)
  const totalAssists = stats.reduce((acc, s) => acc + (s.assists || 0), 0)
  
  const validRatings = stats.filter(s => (s.rating || 0) > 0)
  const avgRating = validRatings.length > 0 
    ? (validRatings.reduce((acc, s) => acc + (s.rating || 0), 0) / validRatings.length).toFixed(2)
    : '—'

  const passAccuracyStats = stats.filter(s => (s.pass_accuracy || 0) > 0)
  const avgPassAcc = passAccuracyStats.length > 0
    ? (passAccuracyStats.reduce((acc, s) => acc + (s.pass_accuracy || 0), 0) / passAccuracyStats.length).toFixed(1)
    : '—'

  const totalXg = stats.reduce((acc, s) => acc + (s.xg || 0), 0).toFixed(2)
  const totalXa = stats.reduce((acc, s) => acc + (s.xa || 0), 0).toFixed(2)
  const totalDistance = stats.reduce((acc, s) => acc + (s.distance_km || 0), 0).toFixed(1)
  const totalSprints = stats.reduce((acc, s) => acc + (s.sprint_count || 0), 0)
  
  const totalDuelsWon = stats.reduce((acc, s) => acc + (s.duels_won || 0), 0)
  const totalDuelsTotal = stats.reduce((acc, s) => acc + (s.duels_total || 0), 0)
  const duelSuccessRate = totalDuelsTotal > 0
    ? ((totalDuelsWon / totalDuelsTotal) * 100).toFixed(1)
    : '—'

  return (
    <PlayerLayout>
      <style>{`
        .perf-outer {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .aggregates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .agg-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 20px;
        }
        .agg-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text3);
          letter-spacing: 0.05em;
        }
        .agg-val {
          font-size: 24px;
          font-weight: 800;
          color: var(--text);
          margin-top: 6px;
        }
        .agg-sub {
          font-size: 10px;
          color: var(--text3);
          margin-top: 4px;
        }
        .match-logs-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }
        .match-logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .match-logs-th {
          font-size: 10px;
          font-weight: 700;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .match-logs-td {
          padding: 16px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          color: var(--text2);
        }
        .match-logs-row {
          transition: background 0.15s;
        }
        .match-logs-row:hover {
          background: var(--surface2);
        }
        @media(max-width: 768px) {
          .perf-outer {
            padding: 16px;
          }
          .match-logs-th-hide {
            display: none !important;
          }
          .match-logs-td-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="perf-outer">
        {/* Season Aggregates */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Season Aggregate Statistics</h2>
          <div className="aggregates-grid">
            {[
              { label: 'Appearances', val: totalMatches, sub: `${totalMinutes} Min Played` },
              { label: 'Goals', val: totalGoals, sub: `Expected Goals (xG): ${totalXg}` },
              { label: 'Assists', val: totalAssists, sub: `Expected Assists (xA): ${totalXa}` },
              { label: 'Avg Rating', val: avgRating, sub: 'All-time performance' },
              { label: 'Pass Accuracy', val: avgPassAcc === '—' ? '—' : `${avgPassAcc}%`, sub: 'Successful passes' },
              { label: 'Distance Covered', val: `${totalDistance} km`, sub: `${totalSprints} Total Sprints` },
              { label: 'Duels Win Rate', val: duelSuccessRate === '—' ? '—' : `${duelSuccessRate}%`, sub: `${totalDuelsWon} of ${totalDuelsTotal} won` },
            ].map((agg, idx) => (
              <div key={idx} className="agg-card">
                <div className="agg-label">{agg.label}</div>
                <div className="agg-val">{agg.val}</div>
                <div className="agg-sub">{agg.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Match Logs Table */}
        <div className="match-logs-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Match History Logs</h2>

          {stats.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
              No performance logs found. Match stats will appear here once logged by coaches.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="match-logs-table">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th className="match-logs-th">Date & Opponent</th>
                    <th className="match-logs-th match-logs-th-hide">Minutes</th>
                    <th className="match-logs-th">G / A</th>
                    <th className="match-logs-th match-logs-th-hide">xG / xA</th>
                    <th className="match-logs-th match-logs-th-hide">Passes (Acc)</th>
                    <th className="match-logs-th match-logs-th-hide">Distance & Sprints</th>
                    <th className="match-logs-th match-logs-th-hide">Duels (Won)</th>
                    <th className="match-logs-th" style={{ textAlign: 'right' }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.id} className="match-logs-row">
                      <td className="match-logs-td">
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>vs {s.opponent || 'Unknown Opponent'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{new Date(s.match_date).toLocaleDateString('en-GB')} · {s.match_type || 'Match'}</div>
                      </td>
                      <td className="match-logs-td match-logs-td-hide" style={{ fontWeight: 600 }}>{s.minutes_played}'</td>
                      <td className="match-logs-td">
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: s.goals > 0 ? 'var(--lagoon)' : 'inherit' }}>{s.goals}G</span>
                          <span style={{ color: 'var(--text3)' }}>/</span>
                          <span style={{ fontWeight: 700, color: s.assists > 0 ? 'var(--lagoon)' : 'inherit' }}>{s.assists}A</span>
                        </div>
                      </td>
                      <td className="match-logs-td match-logs-td-hide">
                        <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                          <span>{s.xg?.toFixed(2) || '0.00'} <span style={{ fontSize: 10, color: 'var(--text3)' }}>xG</span></span>
                          <span>{s.xa?.toFixed(2) || '0.00'} <span style={{ fontSize: 10, color: 'var(--text3)' }}>xA</span></span>
                        </div>
                      </td>
                      <td className="match-logs-td match-logs-td-hide">
                        <div style={{ fontWeight: 600 }}>{s.passes || '—'} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>({s.pass_accuracy || 0}%)</span></div>
                      </td>
                      <td className="match-logs-td match-logs-td-hide">
                        <div style={{ fontWeight: 600 }}>{s.distance_km?.toFixed(1) || '0.0'} km <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>({s.sprint_count || 0} Sprints)</span></div>
                      </td>
                      <td className="match-logs-td match-logs-td-hide">
                        <div style={{ fontWeight: 600 }}>{s.duels_won || 0} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>/ {s.duels_total || 0} ({s.duels_total > 0 ? ((s.duels_won / s.duels_total) * 100).toFixed(0) : 0}%)</span></div>
                      </td>
                      <td className="match-logs-td" style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 13, fontWeight: 800, color: '#fff', background: 'var(--lagoon)', padding: '4px 10px', borderRadius: 6, display: 'inline-block'
                        }}>
                          {s.rating?.toFixed(1) || '0.0'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PlayerLayout>
  )
}
