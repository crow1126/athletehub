'use client'
import { useState, useEffect, useCallback } from 'react'
import PlayerLayout from '@/components/PlayerLayout'
import { supabase } from '@/lib/supabase'
import { Calendar as CalIcon, MapPin, Clock, Info } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const COLORS = {
  'Squad Training': '#4A90E2',
  'Strength & Conditioning': '#27AE60',
  'Tactical Drills': '#9B59B6',
  'Recovery Session': '#1ABC9C',
  'Match Preparation': '#E67E22',
  'Friendly Match': '#E74C3C',
  'Fitness Test': '#F39C12',
  'Video Analysis': '#7F8C8D'
}

export default function PlayerSchedule() {
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [coaches, setCoaches] = useState([])
  const [today] = useState(new Date())
  const [viewDate, setViewDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(null)
  const [view, setView] = useState('month')

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, team_id')
        .eq('id', session.user.id)
        .single()

      setProfile(prof)

      if (prof?.team_id) {
        const [sessionsRes, coachesRes] = await Promise.all([
          supabase.from('training_sessions').select('*').eq('team_id', prof.team_id).order('date', { ascending: true }),
          supabase.from('coaches').select('id, name').eq('team_id', prof.team_id)
        ])

        setSessions(sessionsRes.data || [])
        setCoaches(coachesRes.data || [])
      }
    } catch (err) {
      console.error('Error loading schedule data:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function getSessionsForDate(y, m, d) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return sessions.filter(s => s.date === dateStr)
  }

  function isToday(y, m, d) {
    return today.getFullYear() === y && today.getMonth() === m && today.getDate() === d
  }

  const upcoming = sessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    const diff = (d - today) / (1000 * 60 * 60 * 24)
    return diff >= -1 && diff <= 14 // Upcoming in next 14 days
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  if (loading) {
    return (
      <PlayerLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--lagoon)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </PlayerLayout>
    )
  }

  return (
    <PlayerLayout>
      <style>{`
        .sch-outer {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .sch-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
          align-items: start;
        }
        .sch-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .list-th {
          display: grid;
          grid-template-columns: 1fr 2fr 1.5fr 1.5fr 1fr;
          gap: 8px;
          padding: 12px 20px;
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
        }
        .list-tr {
          display: grid;
          grid-template-columns: 1fr 2fr 1.5fr 1.5fr 1fr;
          gap: 8px;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .list-tr:hover {
          background: var(--surface2);
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: var(--surface);
        }
        .cal-day-header {
          padding: 10px 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
        }
        .cal-cell {
          min-height: 100px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 6px;
          transition: background 0.15s;
        }
        .cal-cell:hover {
          background: var(--surface2);
        }
        .session-item {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 4px;
          borderRadius: 4px;
          margin-bottom: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
          border-left: 2px solid transparent;
        }
        @media(max-width: 968px) {
          .sch-grid {
            grid-template-columns: 1fr;
          }
        }
        @media(max-width: 768px) {
          .sch-outer {
            padding: 16px;
          }
          .list-th {
            display: none !important;
          }
          .list-tr {
            grid-template-columns: 1fr auto !important;
            padding: 12px !important;
          }
          .list-hide {
            display: none !important;
          }
          .cal-cell {
            min-height: 70px !important;
          }
        }
      `}</style>

      <div className="sch-outer">
        {/* Navigation & Controls */}
        <div className="sch-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>‹</button>
            <h2 style={{ fontSize: 18, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>{MONTHS[month]} {year}</h2>
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>›</button>
            <button onClick={() => setViewDate(new Date())}
              style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--lagoon)' }}>Today</button>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 4 }}>
            {['month', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '7px 18px', background: view === v ? 'var(--lagoon)' : 'transparent', border: 'none', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, color: view === v ? '#fff' : 'var(--text2)', cursor: 'pointer', transition: 'var(--transition)', textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Calendar Workspace */}
        <div className="sch-grid">
          <div>
            {view === 'month' ? (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'linear-gradient(90deg, var(--lagoon-deep), var(--lagoon))' }}>
                  {DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
                </div>
                <div className="cal-grid">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ minHeight: 80, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const daySessions = getSessionsForDate(year, month, day)
                    const isTod = isToday(year, month, day)
                    return (
                      <div key={day} className="cal-cell" style={{ background: isTod ? '#E8F4FF' : '' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: isTod ? 'var(--lagoon)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isTod ? 800 : 500, color: isTod ? '#fff' : 'var(--text)', marginBottom: 4 }}>{day}</div>
                        {daySessions.slice(0, 3).map(s => (
                          <div key={s.id} className="session-item" onClick={() => setSelectedSession(s)}
                            style={{
                              background: (COLORS[s.type] || '#4A90E2') + '18',
                              color: COLORS[s.type] || '#4A90E2',
                              borderLeftColor: COLORS[s.type] || '#4A90E2'
                            }}>
                            {s.time} {s.title}
                          </div>
                        ))}
                        {daySessions.length > 3 && (
                          <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, paddingLeft: 4 }}>+{daySessions.length - 3} more</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="list-th">
                  {['Date', 'Session Title', 'Session Type', 'Venue', 'Duration'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {sessions.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>No sessions scheduled yet.</div>
                ) : sessions.filter(s => {
                  const d = new Date(s.date + 'T00:00:00')
                  return d.getMonth() === month && d.getFullYear() === year
                }).map(s => (
                  <div key={s.id} className="list-tr" onClick={() => setSelectedSession(s)} style={{ cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.time}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.title}</div>
                    <div className="list-hide">
                      <span style={{ fontSize: 11, fontWeight: 700, background: (COLORS[s.type] || '#4A90E2') + '15', color: COLORS[s.type] || '#4A90E2', padding: '3px 8px', borderRadius: 6 }}>
                        {s.type}
                      </span>
                    </div>
                    <div className="list-hide" style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 1.5C5.518 1.5 3.5 3.518 3.5 6c0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.482-2.018-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/></svg> {s.venue}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{s.duration} mins</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Sessions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg, var(--lagoon-deep), var(--lagoon))', padding: '14px 18px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Upcoming (14 days)</h3>
              </div>
              <div style={{ padding: '8px 0' }}>
                {upcoming.length === 0 ? (
                  <p style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No sessions in next 14 days.</p>
                ) : upcoming.map(s => (
                  <div key={s.id} onClick={() => setSelectedSession(s)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: (COLORS[s.type] || '#4A90E2') + '12', color: COLORS[s.type] || '#4A90E2', padding: '2px 6px', borderRadius: 4 }}>
                        {s.type}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{s.date}</span>
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

        {/* Read-Only Detail Modal */}
        {selectedSession && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => setSelectedSession(null)}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 25px 60px -10px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0' }}
              onClick={e => e.stopPropagation()}>
              
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, var(--lagoon-deep), var(--lagoon))', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{selectedSession.type}</span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>{selectedSession.title}</h3>
                </div>
                <button onClick={() => setSelectedSession(null)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ background: 'var(--surface2)', padding: '12px 16px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date & Time</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalIcon size={14} />
                      <span>{selectedSession.date}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} />
                      <span>{selectedSession.time} ({selectedSession.duration} mins)</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface2)', padding: '12px 16px', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location / Venue</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} />
                      <span>{selectedSession.venue}</span>
                    </div>
                  </div>
                </div>

                {selectedSession.notes && (
                  <div style={{ background: 'rgba(13,148,136,0.04)', border: '1px solid rgba(13,148,136,0.12)', padding: '14px 18px', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lagoon)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Info size={14} />
                      <span>Coaches' Notes</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{selectedSession.notes}</p>
                  </div>
                )}

                <button onClick={() => setSelectedSession(null)}
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--lagoon-deep), var(--lagoon))', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(13,148,136,0.2)' }}>
                  Close Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlayerLayout>
  )
}
