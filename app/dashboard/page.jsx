'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import StatCard from '@/components/StatCard'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

import { Users, ShieldCheck, CalendarDays, HeartPulse, Flame, UserPlus, Search, BarChart3, ClipboardList, Settings, TrendingUp, Clock, Megaphone, Pin, Radio, Activity, Plus } from 'lucide-react'
import RehabilitationNotes from '@/components/RehabilitationNotes'

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
  const [performanceStats, setPerformanceStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [teamId, setTeamId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { profile: p, teamId: tid } = await getTenantProfile('*, club_name, club_logo_url, teams(id,name,short_name,primary_color,logo_url)')
      if (p?.role === 'player') {
        router.replace('/player-hub')
        return
      }
      setProfile(p)
      setTeamId(tid)
      const uRole = p?.role || 'staff'
      const isAn = uRole === 'analyst' || p?.staff_type === 'analyst'
      setIsAdmin((uRole === 'admin' || uRole === 'superadmin' || uRole === 'coach') && !isAn)

      const [{ data: a }, { data: i }, { data: c }, { data: s }, { data: n }, { data: ps }] = await Promise.all([
        scopeTeam(supabase.from('athletes').select('*'), tid).order('created_at', { ascending: false }),
        scopeTeam(supabase.from('injuries').select('*,athletes(name,club,position,photo_url)'), tid),
        scopeTeam(supabase.from('coaches').select('*'), tid),
        scopeTeam(supabase.from('training_sessions').select('*,coaches(name)'), tid).order('date', { ascending: true }),
        scopeTeam(supabase.from('notices').select('*'), tid).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
        scopeTeam(supabase.from('performance_stats').select('*,athletes(id,name,position,photo_url)'), tid).order('match_date', { ascending: false }).limit(50),
      ])
      setAthletes(a || []); setInjuries(i || []); setCoaches(c || []); setSessions(s || []); setNotices(n || []); setPerformanceStats(ps || [])
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

  // Analyst metrics
  const uniqueMatchesCount = new Set((performanceStats || []).map(s => `${s.opponent || ''}_${s.match_date || ''}`).filter(Boolean)).size || (performanceStats || []).length
  const ratedStats = (performanceStats || []).filter(s => typeof s.rating === 'number' && !isNaN(s.rating))
  const avgSquadRating = ratedStats.length > 0 
    ? (ratedStats.reduce((sum, s) => sum + s.rating, 0) / ratedStats.length).toFixed(1)
    : null
  const totalGoals = (performanceStats || []).reduce((sum, s) => sum + (Number(s.goals) || 0), 0)
  const totalAssists = (performanceStats || []).reduce((sum, s) => sum + (Number(s.assists) || 0), 0)
  const totalGoalsAssists = totalGoals + totalAssists
  const pendingReviews = (performanceStats || []).filter(s => s.notified === false || s.notified === null)
  const pendingReviewsCount = pendingReviews.length

  // Top Performers based on rating
  const topPerformers = [...(performanceStats || [])]
    .filter(s => s.athletes?.name && typeof s.rating === 'number')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5)

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

  const userRole = profile?.role || 'staff'
  const isPhysio = userRole === 'physio' || profile?.staff_type === 'physio' || profile?.staff_type === 'medical' || profile?.staff_type === 'sports_scientist'
  const isAnalyst = userRole === 'analyst' || profile?.staff_type === 'analyst'
  const isFullAdmin = userRole === 'admin' || userRole === 'superadmin'
  // Admin accesses rehab notes via Medical tab (/injuries); keep main dashboard uncluttered
  const canViewRehab = isPhysio && !isFullAdmin

  const iconProps = { size: 18, strokeWidth: 2 }
  const stats = isPhysio ? [
    { label: 'Athletes', value: athletes.length, note: `${athletes.filter(a => a.status === 'Active').length} fit & active`, icon: <Users {...iconProps} />, accent: 'var(--lagoon)' },
    { label: 'In Rehabilitation', value: activeInj.length, note: 'active injuries', icon: <HeartPulse {...iconProps} />, accent: 'var(--danger)' },
    { label: 'Recovered', value: injuries.filter(i => i.status === 'Recovered').length, note: 'cleared to play', icon: <ShieldCheck {...iconProps} />, accent: 'var(--success)' },
    { label: 'Upcoming Sessions', value: upcoming.length, note: 'next 7 days', icon: <CalendarDays {...iconProps} />, accent: '#4A90E2' },
    { label: 'Today', value: todaySess.length, note: 'sessions', icon: <Flame {...iconProps} />, accent: 'var(--warning)' },
  ] : isAnalyst ? [
    { label: 'Squad Tracked', value: athletes.length, note: `${athletes.filter(a => a.status === 'Active').length} active squad`, icon: <Users {...iconProps} />, accent: 'var(--lagoon)' },
    { label: 'Matches Evaluated', value: uniqueMatchesCount, note: `${performanceStats.length} logged player stats`, icon: <BarChart3 {...iconProps} />, accent: '#3B82F6' },
    { label: 'Squad Avg Rating', value: avgSquadRating ? `${avgSquadRating} / 10` : '—', note: 'recent match form', icon: <TrendingUp {...iconProps} />, accent: '#10B981' },
    { label: 'Total G + A', value: totalGoalsAssists, note: `${totalGoals}G · ${totalAssists}A logged`, icon: <Flame {...iconProps} />, accent: '#F59E0B' },
    { label: 'Unpublished Reviews', value: pendingReviewsCount, note: pendingReviewsCount > 0 ? 'drafts awaiting SMS' : 'all published', icon: <ClipboardList {...iconProps} />, accent: pendingReviewsCount > 0 ? 'var(--danger)' : 'var(--success)' },
  ] : [
    { label: labels.athletes || 'Athletes', value: athletes.length, note: `${athletes.filter(a => a.status === 'Active').length} active`, icon: <Users {...iconProps} />, accent: 'var(--lagoon)' },
    { label: labels.coaches || 'Staff', value: coaches.length, note: 'members', icon: <ShieldCheck {...iconProps} />, accent: '#4A90E2' },
    { label: 'Sessions', value: upcoming.length, note: 'next 7 days', icon: <CalendarDays {...iconProps} />, accent: 'var(--success)' },
    { label: 'Injuries', value: activeInj.length, note: 'active', icon: <HeartPulse {...iconProps} />, accent: 'var(--danger)' },
    { label: 'Today', value: todaySess.length, note: 'sessions', icon: <Flame {...iconProps} />, accent: 'var(--warning)' },
  ]

  // Helper to extract clean structured info from matchday / general notices
  function renderNoticeContent(n) {
    // Strip raw emojis from legacy or generated strings
    const cleanText = (n.content || '')
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/MATCHDAY SQUAD CALL-UP/gi, '')
      .replace(/MATCHDAY CALL-UP NOTICE/gi, '')
      .trim()

    if (n.category === 'matchday') {
      // Extract key fields if present
      const dateMatch = cleanText.match(/Date:\s*([^\|\n⏰]+)/i)
      const koMatch = cleanText.match(/Kickoff:\s*([^\|\n📍Report]+)/i) || cleanText.match(/KO:\s*([^\|\n📍]+)/i)
      const venueMatch = cleanText.match(/Venue:\s*([^\|\n⏱Meet]+)/i)
      const meetMatch = cleanText.match(/Meeting Point:\s*([^\|\n⏱]+)/i) || cleanText.match(/Meet:\s*([^\|\n@]+)/i)

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {dateMatch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#0F766E', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '2px 8px', borderRadius: 6 }}>
              <CalendarDays size={11} /> {dateMatch[1].trim()}
            </span>
          )}
          {koMatch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '2px 8px', borderRadius: 6 }}>
              <Clock size={11} /> KO: {koMatch[1].trim()}
            </span>
          )}
          {(venueMatch || meetMatch) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 6 }}>
              <Search size={11} /> {venueMatch ? venueMatch[1].trim() : meetMatch[1].trim()}
            </span>
          )}
        </div>
      )
    }

    // Standard preview: 1-line clean snippet
    const snippet = cleanText.split('\n')[0].replace(/\s+/g, ' ').trim()
    return (
      <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
        {snippet || 'Notice details…'}
      </div>
    )
  }

  return (
    <Layout>
      <style>{`
        .dash-hero { padding:28px 32px 24px; }
        .dash-stats-row { grid-template-columns:repeat(5,1fr); }
        .dash-grid { grid-template-columns:minmax(0, 1.8fr) minmax(0, 1.2fr); width:100%; }
        .dash-athletes-cols { grid-template-columns:minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto; }
        .dash-athletes-header { display:grid !important; }
        .dash-rehab-wrap { padding: 0 32px; }
        @media(max-width:1100px) {
          .dash-stats-row { grid-template-columns:repeat(3,1fr) !important; }
          .dash-grid { grid-template-columns:1fr !important; }
        }
        @media(max-width:768px) {
          .dash-hero { padding:18px 16px 16px !important; }
          .dash-stats-wrap { padding:14px 12px 0 !important; }
          .dash-rehab-wrap { padding: 0 12px !important; }
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

        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <div style={{ fontSize: 13, color: '#ECFDF5', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
            {greet} · {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {/* Club logo + name row in hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
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
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                Welcome, <span style={{ color: '#34D399', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{profile?.full_name && profile.full_name !== 'Admin' ? profile.full_name : (profile?.email ? profile.email.split('@')[0] : (isPhysio ? 'Team Physio' : isAnalyst ? 'Performance Analyst' : 'Admin'))}</span>
              </h1>
              {isPhysio && (
                <div style={{ fontSize: 12, color: '#A7F3D0', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} /> Physiotherapy &amp; Medical Dashboard
                </div>
              )}
              {isAnalyst && (
                <div style={{ fontSize: 12, color: '#A7F3D0', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={14} /> Performance &amp; Tactical Analysis Hub
                </div>
              )}
            </div>
          </div>

          {isAnalyst ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 99, padding: '6px 14px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <TrendingUp size={14} color="#34D399" />
              <span style={{ fontSize: 12, color: '#F0FDF4', fontWeight: 700 }}>{performanceStats.length} Match logs · {uniqueMatchesCount} Fixture{uniqueMatchesCount === 1 ? '' : 's'} Evaluated</span>
            </div>
          ) : todaySess.length > 0 ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: 99, padding: '6px 14px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <Flame size={14} color="#FFD700" />
              <span style={{ fontSize: 12, color: '#F0FDF4', fontWeight: 700 }}>{todaySess.length} session{todaySess.length > 1 ? 's' : ''} today</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="dash-stats-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 0', width: '100%' }}>
        <div className="dash-stats-row" style={{ display: 'grid', gap: 12 }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.value} note={s.note} icon={s.icon} accent={s.accent} />
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="dash-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 0', display: 'grid', gap: 20, alignItems: 'start', boxSizing: 'border-box' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* ── Squad Notice Board Widget ── */}
          <div className="card fade-up" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #CCFBF1', background: '#FFFFFF', borderRadius: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg, #F0FDFA, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Megaphone size={15} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Squad Notice Board</h2>
                  <div style={{ fontSize: 10, color: '#0D9488', fontWeight: 700 }}>Live Moolre SMS Broadcasts</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href="/notices" style={{ fontSize: 12, color: '#0F766E', fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: '#CCFBF1', textDecoration: 'none', transition: 'all 0.15s' }}>
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
                {notices.map((n, idx) => {
                  const isMatchday = n.category === 'matchday'
                  const isUrgent = n.category === 'urgent'

                  return (
                    <Link
                      key={n.id}
                      href="/notices"
                      style={{
                        padding: '12px 18px',
                        borderBottom: idx < notices.length - 1 ? '1px solid #F1F5F9' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        background: isUrgent ? '#FFFDFD' : isMatchday ? '#FAFDFB' : '#FFFFFF',
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                        minWidth: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = isUrgent ? '#FFFDFD' : isMatchday ? '#FAFDFB' : '#FFFFFF'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                          {n.is_pinned && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4 }}>
                              <Pin size={9} /> PINNED
                            </span>
                          )}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 9,
                            fontWeight: 800,
                            background: isMatchday ? '#ECFDF5' : isUrgent ? '#FEE2E2' : '#F0FDFA',
                            color: isMatchday ? '#059669' : isUrgent ? '#DC2626' : '#0D9488',
                            padding: '2px 7px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {isMatchday ? <ClipboardList size={10} /> : <Megaphone size={10} />}
                            {n.category}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.title}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                          {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Structured Preview */}
                      {renderNoticeContent(n)}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#64748B', marginTop: 4 }}>
                        <span>By <strong>{n.author_name || 'Coach'}</strong></span>
                        {n.sms_sent && (
                          <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Radio size={10} /> SMS sent ({n.sms_count || 0})
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Top Match Performers Widget (Analyst Exclusive) ── */}
          {isAnalyst && (
            <div className="card fade-up" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #BAE6FD', background: '#FFFFFF', borderRadius: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg, #F0F9FF, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>Top Match Performers</h2>
                    <div style={{ fontSize: 10, color: '#0284C7', fontWeight: 700 }}>Highest Rated Player Ratings &amp; Match Form</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link href="/performance" style={{ fontSize: 12, color: '#0369A1', fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: '#E0F2FE', textDecoration: 'none' }}>
                    + Log Performance →
                  </Link>
                </div>
              </div>

              {topPerformers.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  <div>No player match performance records logged yet.</div>
                  <Link href="/performance" style={{ display: 'inline-block', marginTop: 8, color: '#0284C7', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                    + Start logging player ratings &amp; match stats
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {topPerformers.map((stat, idx) => {
                    const r = stat.rating || 0
                    const ratingColor = r >= 8.0 ? '#059669' : r >= 7.0 ? '#2563EB' : r >= 6.0 ? '#D97706' : '#DC2626'
                    const ratingBg = r >= 8.0 ? '#ECFDF5' : r >= 7.0 ? '#EFF6FF' : r >= 6.0 ? '#FEF3C7' : '#FEE2E2'

                    return (
                      <div
                        key={stat.id || idx}
                        style={{
                          padding: '12px 18px',
                          borderBottom: idx < topPerformers.length - 1 ? '1px solid #F1F5F9' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 22, fontSize: 12, fontWeight: 800, color: '#94A3B8', textAlign: 'center' }}>
                            #{idx + 1}
                          </div>
                          <AthleteAvatar ath={stat.athletes} size={36} index={idx} />
                          <div style={{ minWidth: 0 }}>
                            <Link href={`/athletes/${stat.athlete_id}`} style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {stat.athletes?.name}
                            </Link>
                            <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                              <span style={{ fontWeight: 600 }}>{stat.athletes?.position || 'Player'}</span>
                              {stat.opponent && <span>vs {stat.opponent}</span>}
                              {stat.match_date && <span>({new Date(stat.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
                              {stat.goals ? `${stat.goals}G ` : ''}{stat.assists ? `${stat.assists}A ` : ''}{!stat.goals && !stat.assists ? `${stat.minutes_played || 90}m` : ''}
                            </div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>
                              {stat.passes ? `${stat.passes} passes` : stat.minutes_played ? `${stat.minutes_played} min` : 'Match rating'}
                            </div>
                          </div>

                          <div style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: ratingBg,
                            color: ratingColor,
                            fontWeight: 900,
                            fontSize: 13,
                            minWidth: 42,
                            textAlign: 'center',
                            border: `1px solid ${ratingColor}33`,
                          }}>
                            {typeof stat.rating === 'number' ? stat.rating.toFixed(1) : '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

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

          {/* Upcoming Sessions — only shown for admin/coach (physio sees it in right column, analyst hides it) */}
          {!isPhysio && !isAnalyst && (
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
          )}
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

          {/* Medical alerts — shown for physio and coach/admin */}
          {!isAnalyst && (
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
          )}

          {/* ── Match Evaluations & Drafts Widget (Analyst Exclusive) ── */}
          {isAnalyst && (
            <div className="card fade-up fade-up-1" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #CBD5E1', background: '#FFFFFF', borderRadius: 16 }}>
              <div style={{ background: 'linear-gradient(90deg, #1E293B, #334155)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ClipboardList size={15} color="#38BDF8" />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#FFFCF6', margin: 0 }}>Evaluations &amp; Drafts</h3>
                </div>
                <Link href="/performance" style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 600, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 99, textDecoration: 'none' }}>
                  Manage
                </Link>
              </div>
              <div style={{ padding: '6px 0' }}>
                {performanceStats.length === 0 ? (
                  <p style={{ padding: '16px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>No match reviews logged yet</p>
                ) : performanceStats.slice(0, 4).map((st, idx) => (
                  <div key={st.id || idx} style={{ padding: '10px 14px', borderBottom: idx < 3 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {st.athletes?.name || 'Player'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        vs {st.opponent || 'Opponent'} · {st.match_date ? new Date(st.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Recent'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: st.notified ? '#ECFDF5' : '#FEF3C7',
                        color: st.notified ? '#059669' : '#B45309',
                        border: `1px solid ${st.notified ? '#A7F3D0' : '#FDE68A'}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {st.notified ? 'Published' : 'Draft'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                        {typeof st.rating === 'number' ? `${st.rating.toFixed(1)}★` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Sessions — shown in right column for physio only */}
          {isPhysio && (
            <div className="card fade-up fade-up-1" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>Upcoming Sessions</h2>
                <Link href="/schedule" style={{ fontSize: 12, color: 'var(--plum)', fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: 'var(--blue-light)', textDecoration: 'none' }}>Schedule</Link>
              </div>
              {upcoming.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No sessions in next 7 days.</div>
              ) : upcoming.slice(0, 3).map(s => {
                const isToday = s.date === todayStr
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--border)', transition: 'var(--transition)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div style={{ minWidth: 56, textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: isToday ? 'var(--milk-muted)' : 'var(--surface2)', border: isToday ? '1px solid rgba(0,106,106,0.3)' : '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--plum)' }}>{s.time}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: isToday ? 'var(--plum)' : 'var(--text3)', textTransform: 'uppercase' }}>{isToday ? 'TODAY' : s.date}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.type}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick Actions */}
          {(isAdmin || isPhysio || isAnalyst) && (
            <div className="card fade-up fade-up-2" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>{isPhysio ? 'Physio Quick Actions' : isAnalyst ? 'Analyst Quick Actions' : 'Quick Actions'}</h3>
                <TrendingUp size={14} color="var(--text3)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {isPhysio ? [
                  { icon: <HeartPulse size={17} strokeWidth={2} />, label: 'Log Injury', href: '/injuries', bg: '#FDEDEC', color: '#C0392B' },
                  { icon: <Activity size={17} strokeWidth={2} />, label: 'Medical Hub', href: '/injuries', bg: '#EFF8F5', color: '#0D6E5E' },
                  { icon: <Users size={17} strokeWidth={2} />, label: 'Athletes', href: '/athletes', bg: '#EBF4FF', color: '#1D4ED8' },
                  { icon: <BarChart3 size={17} strokeWidth={2} />, label: 'Reports', href: '/reports', bg: '#FEF6E0', color: '#B36200' },
                  { icon: <Settings size={17} strokeWidth={2} />, label: 'Settings', href: '/settings', bg: 'var(--surface2)', color: 'var(--plum)' },
                ].map(({ icon, label, href, bg, color }) => (
                  <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: bg, border: '1px solid var(--border)', textDecoration: 'none', transition: 'var(--transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.7)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{label}</span>
                  </Link>
                )) : isAnalyst ? [
                  { icon: <BarChart3 size={17} strokeWidth={2} />, label: 'Log Performance', href: '/performance', bg: '#EFF8F5', color: '#0D6E5E' },
                  { icon: <TrendingUp size={17} strokeWidth={2} />, label: 'Analytics Reports', href: '/reports', bg: '#FEF6E0', color: '#B36200' },
                  { icon: <Users size={17} strokeWidth={2} />, label: 'Squad Analytics', href: '/athletes', bg: '#EBF4FF', color: '#1D4ED8' },
                  { icon: <Search size={17} strokeWidth={2} />, label: 'Transfer Radar', href: '/transfers', bg: '#F3E8FD', color: '#7C3AED' },
                  { icon: <Settings size={17} strokeWidth={2} />, label: 'Settings', href: '/settings', bg: 'var(--surface2)', color: 'var(--plum)' },
                ].map(({ icon, label, href, bg, color }) => (
                  <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: bg, border: '1px solid var(--border)', textDecoration: 'none', transition: 'var(--transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.7)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{label}</span>
                  </Link>
                )) : [
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

      {/* ── Rehabilitation Hub — full-width below the grid (physio & admin only) ── */}
      {canViewRehab && (
        <div className="fade-up dash-rehab-wrap" style={{ maxWidth: 1280, margin: '20px auto 0', boxSizing: 'border-box' }}>
          <RehabilitationNotes
            currentUser={profile}
            teamId={teamId}
            title={isPhysio ? 'Rehabilitation Hub & Clinical Notes' : 'Rehabilitation Notes (Physio Confidential — Read Only)'}
          />
        </div>
      )}

      <div style={{ height: 40 }} />
    </Layout>
  )
}

