'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import StatCard from '@/components/StatCard'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

import Link from 'next/link'
import { Users, ShieldCheck, CalendarDays, HeartPulse, Flame, UserPlus, Search, BarChart3, ClipboardList, Settings, TrendingUp, Clock, Megaphone, Pin, Radio } from 'lucide-react'

const AV_COLORS = ['#006A6A', '#008080', '#2D6B6B', '#5A9494', '#004F4F', '#5C3058']
function initials(n) { return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

function AthleteAvatar({ ath, size = 40, index = 0 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: AV_COLORS[index % AV_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: '#FFFCF6', border: '2px solid rgba(255,255,255,0.2)' }}>
      {initials(ath?.name)}
    </div>
  )
}

const SESSION_COLORS = {
  'Squad Training': '#008080', 'Strength & Conditioning': '#27AE60', 'Tactical Drills': '#2D6B6B',
  'Recovery Session': '#26C6DA', 'Match Preparation': '#006A6A', 'Friendly Match': '#EF5350',
  'Fitness Test': '#B7770D', 'Video Analysis': '#5A9494',
}

function MiniChart({ data = [40, 55, 48, 62, 58, 72, 68, 75, 70, 80], color = '#006A6A' }) {
  const max = Math.max(...data), min = Math.min(...data)
  const w = 280, h = 70, pad = 8
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const gid = `g${color.replace('#', '')}`
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${pts} ${w - pad},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => {
        if (i !== data.length - 1) return null
        const x = pad + (i / (data.length - 1)) * (w - pad * 2)
        const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
        return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="white" strokeWidth="2" />
      })}
    </svg>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [athletes, setAthletes] = useState([])
  const [injuries, setInjuries] = useState([])
  const [coaches, setCoaches] = useState([])
  const [sessions, setSessions] = useState([])
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { profile: p, teamId } = await getTenantProfile('*, club_name, club_logo_url, teams(id,name,short_name,primary_color,logo_url)')
      if (p?.role === 'player') {
        router.replace('/player-hub')
        return
      }
      setProfile(p)
      setIsAdmin(p?.role === 'admin' || p?.role === 'superadmin' || p?.role === 'coach')
      const [{ data: a }, { data: i }, { data: c }, { data: s }, { data: n }] = await Promise.all([
        scopeTeam(supabase.from('athletes').select('*'), teamId).order('created_at', { ascending: false }),
        scopeTeam(supabase.from('injuries').select('*,athletes(name,club,position,photo_url)'), teamId),
        scopeTeam(supabase.from('coaches').select('*'), teamId),
        scopeTeam(supabase.from('training_sessions').select('*,coaches(name)'), teamId).order('date', { ascending: true }),
        scopeTeam(supabase.from('notices').select('*'), teamId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      ])
      setAthletes(a || []); setInjuries(i || []); setCoaches(c || []); setSessions(s || []); setNotices(n || [])
      setLoading(false)
    }
    load()
  }, [router])

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7 = new Date(); next7.setDate(next7.getDate() + 7)
  const activeInj = injuries.filter(i => i.status === 'Active')
  const recent = athletes.slice(0, 6)
  const todaySess = sessions.filter(s => s.date === todayStr)
  const upcoming = sessions.filter(s => s.date >= todayStr && new Date(s.date) <= next7).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 4)
  const greet = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  // Resolve club name and logo — prefer profiles fields, fall back to teams
  const clubName = profile?.club_name || profile?.teams?.name || null
  const clubLogo = (profile?.club_logo_url && !profile.club_logo_url.startsWith('data:'))
    ? profile.club_logo_url
    : (profile?.teams?.logo_url || null)

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '4px solid var(--milk-muted)', borderTopColor: 'var(--plum)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </Layout>
  )

  const labels = { athletes: 'Athletes', coaches: 'Staff', transfers: 'Transfers', performance: 'Performance Stats' }

  const iconProps = { size: 18, strokeWidth: 2 }
  const stats = [
    { label: labels.athletes || 'Athletes', value: athletes.length, note: `${athletes.filter(a => a.status === 'Active').length} active`, icon: <Users {...iconProps} />, accent: 'var(--lagoon)' },
    { label: labels.coaches || 'Staff', value: coaches.length, note: 'members', icon: <ShieldCheck {...iconProps} />, accent: '#4A90E2' },
    { label: 'Sessions', value: upcoming.length, note: 'next 7 days', icon: <CalendarDays {...iconProps} />, accent: 'var(--success)' },
    { label: 'Injuries', value: activeInj.length, note: 'active', icon: <HeartPulse {...iconProps} />, accent: 'var(--danger)' },
    { label: 'Today', value: todaySess.length, note: 'sessions', icon: <Flame {...iconProps} />, accent: 'var(--warning)' },
  ]

  return (
    <Layout>
      <style>{`
        .dash-hero { padding:32px 40px 26px; }
        .dash-stats-row { grid-template-columns:repeat(5,1fr); }
        .dash-grid { grid-template-columns:65% 35%; }
        .dash-athletes-cols { grid-template-columns:2.2fr 1fr 0.9fr 1fr 0.8fr; }
        .dash-athletes-header { display:grid !important; }
        @media(max-width:900px) {
          .dash-stats-row { grid-template-columns:repeat(3,1fr) !important; }
          .dash-grid { grid-template-columns:1fr !important; }
        }
        @media(max-width:768px) {
          .dash-hero { padding:20px 16px 18px !important; }
          .dash-stats-wrap { padding:14px 12px 0 !important; }
          .dash-stats-row { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
          .dash-grid { gap:14px !important; padding:14px 12px 0 !important; }
          .dash-athletes-cols { grid-template-columns:1fr auto !important; }
          .dash-athletes-header { display:none !important; }
          .dash-hide-mobile { display:none !important; }
          .dash-session-date { min-width:64px !important; }
        }
      `}</style>

      {/* ── Hero banner ── */}
      <div className="dash-hero" style={{ background: 'linear-gradient(135deg, #022C22 0%, #064E3B 45%, #047857 100%)', position: 'relative', overflow: 'hidden', borderRadius: '0 0 20px 20px', boxShadow: '0 8px 32px rgba(2, 44, 34, 0.2)' }}>
        <div style={{ position: 'absolute', top: -100, right: -50, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: 100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: '#ECFDF5', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
            {greet} · {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {/* Club logo + name row in hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {clubLogo && (
              <img src={clubLogo} alt={clubName || 'Club'}
                style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'contain', background: '#FFFFFF', border: '2px solid rgba(255,255,255,0.4)', padding: 4, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
                onError={e => e.target.style.display = 'none'}
              />
            )}
            <div>
              {clubName && (
                <div style={{ fontSize: 13, color: '#A7F3D0', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {clubName}
                </div>
              )}
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                Welcome, <span style={{ color: '#34D399', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{profile?.full_name && profile.full_name !== 'Admin' ? profile.full_name : (profile?.email ? profile.email.split('@')[0] : 'Admin')}</span>
              </h1>
            </div>
          </div>

          {todaySess.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 99, padding: '6px 14px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <Flame size={14} color="#FFD700" />
              <span style={{ fontSize: 12, color: '#F0FDF4', fontWeight: 700 }}>{todaySess.length} session{todaySess.length > 1 ? 's' : ''} today</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="dash-stats-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 40px 0' }}>
        <div className="dash-stats-row" style={{ display: 'grid', gap: 12 }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.value} note={s.note} icon={s.icon} accent={s.accent} />
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="dash-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 40px 0', display: 'grid', gap: 22, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Squad Notice Board Widget ── */}
          <div className="card fade-up" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #CCFBF1' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg, #F0FDFA, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={15} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Squad Notice Board</h2>
                  <div style={{ fontSize: 10, color: '#0D9488', fontWeight: 700 }}>Live Moolre SMS Broadcasts</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href="/notices" style={{ fontSize: 12, color: '#0F766E', fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: '#CCFBF1', textDecoration: 'none' }}>
                  Open Board →
                </Link>
              </div>
            </div>

            {notices.length === 0 ? (
              <div style={{ padding: '24px 18px', textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                <div>No announcements posted yet.</div>
                <Link href="/notices" style={{ display: 'inline-block', marginTop: 6, color: '#0D9488', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                  + Post squad notice &amp; send SMS
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notices.map((n, idx) => (
                  <div key={n.id} style={{
                    padding: '12px 18px',
                    borderBottom: idx < notices.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    background: n.category === 'urgent' ? '#FFFDFD' : '#FFFFFF',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {n.is_pinned && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 4 }}>
                            <Pin size={9} /> PINNED
                          </span>
                        )}
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: n.category === 'urgent' ? '#FEE2E2' : '#F0FDFA',
                          color: n.category === 'urgent' ? '#DC2626' : '#0D9488',
                          padding: '1px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                        }}>
                          {n.category}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{n.title}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.content}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      <span>By {n.author_name || 'Coach'}</span>
                      {n.sms_sent && (
                        <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Radio size={10} /> SMS broadcast ({n.sms_count} players)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Athletes */}
          <div className="card fade-up" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Recent Athletes</h2>
              <Link href="/athletes" style={{ fontSize: 12, color: 'var(--plum)', fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: 'var(--blue-light)', textDecoration: 'none' }}>View All</Link>
            </div>
            <div className="dash-athletes-header dash-athletes-cols" style={{ gap: 8, padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Athlete', 'Position', 'Status', 'Club', ''].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No athletes yet.</div>
            ) : recent.map((ath, i) => (
              <div key={ath.id} className="dash-athletes-cols" style={{ display: 'grid', gap: 8, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--border)', transition: 'var(--transition)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <AthleteAvatar ath={ath} size={34} index={i} />
                  <div>
                    <Link href={`/athletes/${ath.id}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'block', textDecoration: 'none' }}>{ath.name}</Link>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{ath.position || '—'}</span>
                  </div>
                </div>
                <div className="dash-hide-mobile" style={{ fontSize: 12, color: 'var(--text2)' }}>{ath.position || '—'}</div>
                <Badge status={ath.status} />
                <div className="dash-hide-mobile" style={{ fontSize: 12, color: 'var(--text2)' }}>{ath.club || '—'}</div>
                <Link href={`/athletes/${ath.id}`} style={{ fontSize: 11, color: 'var(--plum)', fontWeight: 700, background: 'var(--blue-light)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>View →</Link>
              </div>
            ))}
          </div>

          {/* Upcoming Sessions */}
          <div className="card fade-up fade-up-1" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Upcoming Sessions</h2>
              <Link href="/schedule" style={{ fontSize: 12, color: 'var(--plum)', fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: 'var(--blue-light)', textDecoration: 'none' }}>Schedule</Link>
            </div>
            {upcoming.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                No sessions in next 7 days.
                <Link href="/schedule" style={{ display: 'block', marginTop: 8, color: 'var(--plum)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>+ Add session</Link>
              </div>
            ) : upcoming.map(s => {
              const isToday = s.date === todayStr
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', transition: 'var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div className="dash-session-date" style={{ minWidth: 80, textAlign: 'center', padding: '7px 10px', borderRadius: 10, background: isToday ? 'var(--milk-muted)' : 'var(--surface2)', border: isToday ? '1px solid rgba(0,106,106,0.3)' : '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--plum)', lineHeight: 1.2 }}>{s.time}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'var(--plum)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{isToday ? 'TODAY' : s.date}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: (SESSION_COLORS[s.type] || '#006A6A') + '20', color: SESSION_COLORS[s.type] || '#006A6A', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{s.type}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.518 1.5 3.5 3.518 3.5 6c0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.482-2.018-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="8" cy="6" r="1.5" fill="currentColor" /></svg> {s.venue} · {s.duration}min</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Performance chart */}
          <div className="card fade-up" style={{ padding: '16px 18px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Performance Overview</h2>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Squad trends — last 10 matches</p>
            <MiniChart data={[45, 52, 48, 60, 55, 68, 64, 72, 70, 78]} color="#006A6A" />
            <MiniChart data={[30, 38, 35, 42, 50, 44, 56, 52, 60, 58]} color="#2D6B6B" />
            <MiniChart data={[60, 55, 62, 58, 52, 65, 60, 68, 65, 72]} color="#B7770D" />
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {[['#006A6A', 'Performance'], ['#2D6B6B', 'Endurance'], ['#B7770D', 'Strength']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* Medical alerts */}
          <div className="card fade-up fade-up-1" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#0F766E,#0D9488)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#FFFCF6' }}>Medical Alerts</h3>
              <Link href="/injuries" style={{ fontSize: 11, color: 'rgba(255,252,246,0.85)', fontWeight: 600, background: 'rgba(255,252,246,0.15)', padding: '3px 10px', borderRadius: 99, textDecoration: 'none' }}>View all</Link>
            </div>
            <div style={{ padding: '6px 0' }}>
              {activeInj.length === 0 ? (
                <p style={{ padding: '16px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>No active injuries</p>
              ) : activeInj.slice(0, 4).map((inj, i) => (
                <div key={inj.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AthleteAvatar ath={inj.athletes} size={32} index={i} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.athletes?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{inj.injury_type} · {inj.expected_return || 'TBD'}</div>
                  </div>
                  <Badge status={inj.severity} />
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="card fade-up fade-up-2" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Quick Actions</h3>
                <TrendingUp size={14} color="var(--text3)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icon: <UserPlus size={17} strokeWidth={2} />, label: 'Add Athlete', href: '/athletes', bg: '#EFF8F5', color: '#0D6E5E' },
                  { icon: <CalendarDays size={17} strokeWidth={2} />, label: 'Schedule', href: '/schedule', bg: '#EBF8EE', color: '#1B7A3E' },
                  { icon: <Search size={17} strokeWidth={2} />, label: 'Scouting', href: '/scouting', bg: '#F3E8FD', color: '#7C3AED' },
                  { icon: <BarChart3 size={17} strokeWidth={2} />, label: 'Performance', href: '/performance', bg: '#FEF6E0', color: '#B36200' },
                  { icon: <ClipboardList size={17} strokeWidth={2} />, label: 'Contracts', href: '/contracts', bg: '#E0F7F5', color: '#0E8A7E' },
                  { icon: <Settings size={17} strokeWidth={2} />, label: 'Settings', href: '/settings', bg: 'var(--surface2)', color: 'var(--plum)' },
                ].map(({ icon, label, href, bg, color }) => (
                  <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: bg, border: '1px solid var(--border)', textDecoration: 'none', transition: 'var(--transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.7)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 40 }} />
    </Layout>
  )
}
