'use client'
import { useState, useEffect } from 'react'
import PlayerLayout from '@/components/PlayerLayout'
import { supabase } from '@/lib/supabase'
import { Zap, Calendar, TrendingUp, Award, Activity, MapPin, Megaphone, Pin, Clock } from 'lucide-react'
import Link from 'next/link'

export default function PlayerDashboard() {
  const [profile, setProfile] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [stats, setStats] = useState([])
  const [sessions, setSessions] = useState([])
  const [notices, setNotices] = useState([])
  const [activeInjury, setActiveInjury] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: prof } = await supabase
          .from('profiles')
          .select('*, teams(id, name, logo_url)')
          .eq('id', session.user.id)
          .single()

        setProfile(prof)

        if (prof?.team_id) {
          const { data: notifList } = await supabase
            .from('notices')
            .select('*')
            .eq('team_id', prof.team_id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(4)
          if (notifList) setNotices(notifList)
        }

        if (prof?.athlete_id) {
          const todayStr = new Date().toISOString().split('T')[0]

          const [athRes, statsRes, sessionsRes, injuriesRes] = await Promise.all([
            supabase.from('athletes').select('*').eq('id', prof.athlete_id).single(),
            supabase.from('performance_stats').select('*').eq('athlete_id', prof.athlete_id).order('match_date', { ascending: false }),
            supabase.from('training_sessions').select('*').eq('team_id', prof.team_id).gte('date', todayStr).order('date', { ascending: true }).limit(3),
            supabase.from('injuries').select('*').eq('athlete_id', prof.athlete_id).eq('status', 'Active').order('date_of_injury', { ascending: false }).limit(1)
          ])

          setAthlete(athRes.data)
          setStats(statsRes.data || [])
          setSessions(sessionsRes.data || [])
          if (injuriesRes.data && injuriesRes.data.length > 0) {
            setActiveInjury(injuriesRes.data[0])
          }
        }
      } catch (err) {
        console.error('Error loading player data:', err)
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
            Your player login has not been linked to a player card yet. Please contact your club administrator to link this account to your athlete record.
          </p>
        </div>
      </PlayerLayout>
    )
  }

  // Calculate Aggregates
  const totalMatches = stats.length
  const totalGoals = stats.reduce((acc, s) => acc + (s.goals || 0), 0)
  const totalAssists = stats.reduce((acc, s) => acc + (s.assists || 0), 0)
  const totalContributions = totalGoals + totalAssists

  const validRatings = stats.filter(s => (s.rating || 0) > 0)
  const avgRating = validRatings.length > 0 
    ? (validRatings.reduce((acc, s) => acc + (s.rating || 0), 0) / validRatings.length).toFixed(2)
    : '—'

  // Sparkline coordinates
  const lastRatings = [...stats].slice(0, 8).reverse().map(s => s.rating || 0)
  let sparklinePoints = ''
  if (lastRatings.length > 1) {
    const width = 240
    const height = 60
    const minRating = 4.0
    const maxRating = 10.0
    const xStep = width / (lastRatings.length - 1)
    
    sparklinePoints = lastRatings.map((r, i) => {
      const x = i * xStep
      // Invert Y because SVG 0 is at top
      const clamped = Math.max(minRating, Math.min(maxRating, r))
      const y = height - ((clamped - minRating) / (maxRating - minRating)) * (height - 10) - 5
      return `${x},${y}`
    }).join(' ')
  }

  const nextSession = sessions[0] || null

  return (
    <PlayerLayout>
      <style>{`
        .player-dashboard {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .hero-card {
          background: linear-gradient(135deg, var(--lagoon-deep) 0%, #032424 100%);
          border-radius: 20px;
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid rgba(255,255,255,0.06);
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        .hero-card::before {
          content: '';
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, var(--lagoon) 0%, transparent 70%);
          opacity: 0.15;
          right: -50px;
          top: -50px;
          pointer-events: none;
        }
        .hero-profile {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .hero-photo-placeholder {
          width: 90px;
          height: 90px;
          border-radius: 16px;
          background: rgba(255,255,255,0.08);
          border: 2px solid rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: #fff;
        }
        .hero-photo-img {
          width: 90px;
          height: 90px;
          border-radius: 16px;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.2);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.8fr 1.2fr;
          gap: 24px;
        }
        .section-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }
        .session-card {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media(max-width: 968px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        @media(max-width: 640px) {
          .player-dashboard {
            padding: 16px;
          }
          .hero-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
            padding: 24px;
          }
          .hero-profile {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
        }
      `}</style>

      <div className="player-dashboard">
        {/* Active Injury Alert */}
        {activeInjury && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, color: '#991B1B' }}>
            <Activity size={24} style={{ color: '#DC2626' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Active Injury Registered</div>
              <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>
                {activeInjury.injury_type || 'Injury'} ({activeInjury.severity || 'Moderate'}). Diagnosed on {new Date(activeInjury.date_of_injury).toLocaleDateString('en-GB')}. Undergoing recovery.
              </div>
            </div>
          </div>
        )}

        {/* Hero Card */}
        <div className="hero-card">
          <div className="hero-profile">
            {athlete?.photo_url ? (
              <img src={athlete.photo_url} alt={athlete.name} className="hero-photo-img" />
            ) : (
              <div className="hero-photo-placeholder">
                {athlete?.name ? athlete.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PL'}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{athlete?.name}</span>
                {athlete?.back_number && (
                  <span style={{ fontSize: 14, fontWeight: 800, background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '3px 10px', borderRadius: 8 }}>
                    #{athlete.back_number}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--lagoon-light)', fontWeight: 600 }}>{athlete?.position || 'Field Player'}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Strong Foot: <strong style={{ color: '#fff' }}>{athlete?.strong_foot || 'Both'}</strong></span>
                {athlete?.nationality && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{athlete.nationality}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Squad Status</span>
            <span style={{
              fontSize: 12, fontWeight: 700, 
              background: athlete?.status === 'Active' ? 'rgba(16,185,129,0.18)' : athlete?.status === 'Injured' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)', 
              color: athlete?.status === 'Active' ? '#34D399' : athlete?.status === 'Injured' ? '#FCA5A5' : '#FBBF24', 
              padding: '4px 12px', borderRadius: 99, border: `1px solid ${athlete?.status === 'Active' ? '#059669' : athlete?.status === 'Injured' ? '#DC2626' : '#D97706'}33`
            }}>
              ● {athlete?.status || 'Active'}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="stats-grid">
          {[
            { label: 'Total Matches', val: totalMatches, icon: <TrendingUp size={20} />, color: '#0D9488' },
            { label: 'Total Goals', val: totalGoals, icon: <Award size={20} />, color: '#10B981' },
            { label: 'Assists', val: totalAssists, icon: <TrendingUp size={20} />, color: '#F59E0B' },
            { label: 'Avg Rating', val: avgRating, icon: <TrendingUp size={20} />, color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} className="section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>{s.val}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + '15', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ── Squad Notice Board for Players ── */}
        {notices.length > 0 && (
          <div className="section-card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #CCFBF1', marginTop: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg, #F0FDFA, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Team Notice Board</h3>
                  <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 600 }}>Announcements from Coach &amp; Staff</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notices.map((n, idx) => (
                <div key={n.id} style={{
                  padding: '14px 20px',
                  borderBottom: idx < notices.length - 1 ? '1px solid #F1F5F9' : 'none',
                  background: n.category === 'urgent' ? '#FFFDFD' : '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {n.is_pinned && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: 99 }}>
                          <Pin size={10} /> PINNED
                        </span>
                      )}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        background: n.category === 'urgent' ? '#FEE2E2' : '#F0FDFA',
                        color: n.category === 'urgent' ? '#DC2626' : '#0D9488',
                        padding: '2px 8px',
                        borderRadius: 99,
                        textTransform: 'uppercase',
                      }}>
                        {n.category}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{n.title}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>

                  <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, margin: 0 }}>
                    {n.content}
                  </p>

                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span>Posted by <strong>{n.author_name || 'Coach'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard split */}
        <div className="dashboard-grid">
          {/* Performance chart / Match ratings */}
          <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Performance Rating Sparkline</h3>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Match ratings over the last 8 appearances</p>
              </div>
              <Link href="/player-hub/performance" style={{ fontSize: 12, color: 'var(--lagoon)', fontWeight: 700, textDecoration: 'none' }}>
                Full Stats ➔
              </Link>
            </div>

            {lastRatings.length > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface2)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                  <svg width="100%" height="60" style={{ overflow: 'visible' }}>
                    {/* Gridlines */}
                    <line x1="0" y1="5" x2="100%" y2="5" stroke="var(--border)" strokeDasharray="3,3" />
                    <line x1="0" y1="55" x2="100%" y2="55" stroke="var(--border)" strokeDasharray="3,3" />
                    
                    {/* Gradient under sparkline */}
                    {sparklinePoints && (
                      <>
                        <path
                          d={`M 0,60 L ${sparklinePoints} L 240,60 Z`}
                          fill="url(#sparkline-grad)"
                          style={{ transform: 'scaleX(calc(100% / 240))', transformOrigin: 'left' }}
                        />
                        <polyline
                          fill="none"
                          stroke="var(--lagoon)"
                          strokeWidth="2.5"
                          points={sparklinePoints}
                          style={{ transform: 'scaleX(calc(100% / 240))', transformOrigin: 'left' }}
                        />
                      </>
                    )}
                    
                    <defs>
                      <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--lagoon)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--lagoon)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
                  <span>Oldest Match</span>
                  <span>Latest Match</span>
                </div>
              </div>
            ) : (
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)', fontSize: 13 }}>
                Need at least 2 match appearances to show sparkline
              </div>
            )}

            {/* Next Match / Performance table preview */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Recent Match Logs</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.slice(0, 3).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>vs {s.opponent || 'Unknown Opponent'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{new Date(s.match_date).toLocaleDateString('en-GB')} · {s.match_type || 'League Match'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {s.goals > 0 && `${s.goals}G `}{s.assists > 0 && `${s.assists}A`}
                          {!(s.goals > 0 || s.assists > 0) && '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Contributions</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: 'var(--lagoon)', padding: '4px 8px', borderRadius: 6 }}>
                        {s.rating?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  </div>
                ))}
                {stats.length === 0 && (
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text3)', padding: 12 }}>No match logs available yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Schedule preview / Next Session countdown */}
          <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Upcoming Team Schedule</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Next sessions and training calendar</p>
            </div>

            {nextSession ? (
              <div style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.06) 0%, rgba(20,184,166,0.02) 100%)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 12, padding: 16 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--lagoon)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>NEXT UP</span>
                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{nextSession.title}</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <Calendar size={14} style={{ color: 'var(--text3)' }} />
                    <span>{new Date(nextSession.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {nextSession.time || '09:00'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <MapPin size={14} style={{ color: 'var(--text3)' }} />
                    <span>{nextSession.venue || 'Training Ground'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)', border: '1px solid var(--border)' }}>
                No training sessions scheduled.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Upcoming list</h4>
              {sessions.slice(1, 3).map(s => (
                <div key={s.id} className="session-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lagoon)' }}>{s.type}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} />
                    <span>{s.venue} · {s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PlayerLayout>
  )
}
