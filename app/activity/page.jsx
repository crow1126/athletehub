'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import { mobileSafeDownload } from '@/lib/pdfDownload'
import {
  Activity, HeartPulse, TrendingUp, CalendarDays, Users, Search,
  Megaphone, ShieldAlert, FileText, Download, Filter, RefreshCw,
  Clock, CheckCircle2, ChevronRight, UserCheck
} from 'lucide-react'

// Map roles to friendly labels & badge styling
const ROLE_BADGES = {
  superadmin:       { label: 'Superadmin', bg: '#EDE9FE', color: '#6D28D9' },
  admin:            { label: 'Club Admin', bg: '#E0F2FE', color: '#0369A1' },
  physio:           { label: 'Physiotherapist', bg: '#FEE2E2', color: '#B91C1C' },
  medical:          { label: 'Medical Staff', bg: '#FEE2E2', color: '#B91C1C' },
  sports_scientist: { label: 'Sports Scientist', bg: '#FEF3C7', color: '#B45309' },
  coach:            { label: 'Coach', bg: '#ECFDF5', color: '#047857' },
  analyst:          { label: 'Analyst', bg: '#F3E8FF', color: '#7E22CE' },
  scout:            { label: 'Scout', bg: '#FEF9C3', color: '#A16207' },
  player:           { label: 'Player', bg: '#F1F5F9', color: '#475569' },
  staff:            { label: 'Staff Member', bg: '#F1F5F9', color: '#475569' },
}

const MODULE_CONFIG = {
  all:         { label: 'All Activities', icon: Activity, color: '#0D9488' },
  medical:     { label: 'Medical & Physio', icon: HeartPulse, color: '#EF4444' },
  performance: { label: 'Performance', icon: TrendingUp, color: '#8B5CF6' },
  schedule:    { label: 'Training & Schedule', icon: CalendarDays, color: '#3B82F6' },
  athletes:    { label: 'Squad & Athletes', icon: Users, color: '#10B981' },
  scouting:    { label: 'Scouting', icon: Search, color: '#F59E0B' },
  notices:     { label: 'Announcements', icon: Megaphone, color: '#6366F1' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

function fmtTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getDayHeader(iso) {
  if (!iso) return 'Earlier'
  const target = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (target.toDateString() === today.toDateString()) return 'Today'
  if (target.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return target.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminActivityLogPage() {
  const [currentUser, setCurrentUser] = useState(null)
  const [teamId, setTeamId]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [activities, setActivities]   = useState([])
  
  // Filters
  const [activeModule, setActiveModule] = useState('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [roleFilter, setRoleFilter]     = useState('all')
  const [timeRange, setTimeRange]       = useState('30d') // 'today' | '7d' | '30d' | 'all'

  const fetchActivities = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const { profile, teamId: currentTeamId } = await getTenantProfile('id,full_name,role,staff_type')
      setCurrentUser(profile)
      setTeamId(currentTeamId)

      const events = []

      // 1. Fetch Injury Records
      try {
        const { data: injData } = await scopeTeam(
          supabase
            .from('injuries')
            .select('id, injury_type, body_part, severity, status, logged_at, created_at, updated_at, logged_by, updated_by, athletes(id, name, squad_number)')
            .order('created_at', { ascending: false })
            .limit(100),
          currentTeamId
        )

        // Resolve staff names if available
        const staffIds = new Set()
        ;(injData || []).forEach(i => {
          if (i.logged_by) staffIds.add(i.logged_by)
          if (i.updated_by) staffIds.add(i.updated_by)
        })

        let profileMap = {}
        if (staffIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', Array.from(staffIds))
          if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p })
          }
        }

        ;(injData || []).forEach(i => {
          const author = profileMap[i.logged_by]
          const updater = profileMap[i.updated_by]
          const athName = i.athletes?.name || 'Athlete'

          // Created event
          events.push({
            id: `inj-create-${i.id}`,
            module: 'medical',
            action: `Logged Injury: ${i.injury_type || 'Injury'} (${i.severity || 'Status: ' + i.status})`,
            target: athName,
            actorName: author?.full_name || 'Physiotherapy Staff',
            actorRole: author?.role || 'physio',
            timestamp: i.logged_at || i.created_at || new Date().toISOString(),
            details: `Body part: ${i.body_part || 'Unspecified'} • Status: ${i.status} • Player: ${athName}`,
            link: '/injuries',
            badgeBg: '#FEE2E2',
            badgeColor: '#B91C1C',
          })

          // Updated event if different timestamp
          if (i.updated_at && i.updated_at !== i.created_at && updater) {
            events.push({
              id: `inj-update-${i.id}`,
              module: 'medical',
              action: `Updated Injury Record: ${i.injury_type}`,
              target: athName,
              actorName: updater?.full_name || 'Medical Staff',
              actorRole: updater?.role || 'physio',
              timestamp: i.updated_at,
              details: `Latest status: ${i.status} • Player: ${athName}`,
              link: '/injuries',
              badgeBg: '#FEF3C7',
              badgeColor: '#B45309',
            })
          }
        })
      } catch (err) {
        console.warn('Could not load injury activities:', err)
      }

      // 2. Fetch Rehabilitation Notes
      try {
        const { data: rehabData } = await scopeTeam(
          supabase
            .from('rehabilitation_notes')
            .select('id, note_type, session_date, created_at, author_name, author_role, treatment_performed, athletes(name)')
            .order('created_at', { ascending: false })
            .limit(100),
          currentTeamId
        )

        ;(rehabData || []).forEach(r => {
          const athName = r.athletes?.name || 'Athlete'
          events.push({
            id: `rehab-${r.id}`,
            module: 'medical',
            action: `Added Rehab Note (${r.note_type || 'Daily Treatment'})`,
            target: athName,
            actorName: r.author_name || 'Physiotherapist',
            actorRole: r.author_role || 'physio',
            timestamp: r.created_at || r.session_date,
            details: r.treatment_performed ? `Treatment: ${r.treatment_performed.slice(0, 100)}` : `Session on ${r.session_date}`,
            link: '/injuries',
            badgeBg: '#FEE2E2',
            badgeColor: '#B91C1C',
          })
        })
      } catch (err) {
        console.warn('Could not load rehab notes:', err)
      }

      // 3. Fetch Performance Stats
      try {
        const { data: perfData } = await scopeTeam(
          supabase
            .from('performance_stats')
            .select('id, match_date, opponent, goals, assists, rating, minutes_played, created_at, athletes(name, position)')
            .order('created_at', { ascending: false })
            .limit(100),
          currentTeamId
        )

        ;(perfData || []).forEach(p => {
          const athName = p.athletes?.name || 'Player'
          const opp = p.opponent ? ` vs ${p.opponent}` : ''
          events.push({
            id: `perf-${p.id}`,
            module: 'performance',
            action: `Logged Match Stats${opp} (Rating: ${p.rating || '—'}/10)`,
            target: athName,
            actorName: 'Technical Analyst',
            actorRole: 'analyst',
            timestamp: p.created_at || (p.match_date ? `${p.match_date}T12:00:00Z` : new Date().toISOString()),
            details: `Goals: ${p.goals || 0} • Assists: ${p.assists || 0} • Min: ${p.minutes_played || 90}m • Match: ${fmtDate(p.match_date)}`,
            link: '/performance',
            badgeBg: '#F3E8FF',
            badgeColor: '#7E22CE',
          })
        })
      } catch (err) {
        console.warn('Could not load performance stats:', err)
      }

      // 4. Fetch Training Sessions
      try {
        const { data: sesData } = await scopeTeam(
          supabase
            .from('training_sessions')
            .select('id, title, date, time, type, duration, created_at, coaches(name)')
            .order('created_at', { ascending: false })
            .limit(100),
          currentTeamId
        )

        ;(sesData || []).forEach(s => {
          const coachName = s.coaches?.name || 'Head Coach'
          events.push({
            id: `sch-${s.id}`,
            module: 'schedule',
            action: `Scheduled Session: ${s.title || s.type}`,
            target: `${s.type} (${s.duration || 90} mins)`,
            actorName: coachName,
            actorRole: 'coach',
            timestamp: s.created_at || (s.date ? `${s.date}T${s.time || '09:00'}:00Z` : new Date().toISOString()),
            details: `Date: ${fmtDate(s.date)} at ${s.time || 'TBD'} • Type: ${s.type}`,
            link: '/schedule',
            badgeBg: '#E0F2FE',
            badgeColor: '#0369A1',
          })
        })
      } catch (err) {
        console.warn('Could not load training sessions:', err)
      }

      // 5. Fetch Athletes (Squad registrations)
      try {
        const { data: athData } = await scopeTeam(
          supabase
            .from('athletes')
            .select('id, name, position, club, status, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          currentTeamId
        )

        ;(athData || []).forEach(a => {
          events.push({
            id: `ath-${a.id}`,
            module: 'athletes',
            action: `Registered Squad Player: ${a.name}`,
            target: a.name,
            actorName: 'Club Administration',
            actorRole: 'admin',
            timestamp: a.created_at || new Date().toISOString(),
            details: `Position: ${a.position || 'Player'} • Status: ${a.status || 'Active'}`,
            link: '/athletes',
            badgeBg: '#ECFDF5',
            badgeColor: '#047857',
          })
        })
      } catch (err) {
        console.warn('Could not load athletes:', err)
      }

      // 6. Fetch Scouting Reports
      try {
        const { data: scoutData } = await scopeTeam(
          supabase
            .from('scouting_reports')
            .select('id, player_name, position, overall_rating, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          currentTeamId
        )

        ;(scoutData || []).forEach(sc => {
          events.push({
            id: `scout-${sc.id}`,
            module: 'scouting',
            action: `Filed Scouting Report on ${sc.player_name}`,
            target: sc.player_name,
            actorName: 'Talent Scout',
            actorRole: 'scout',
            timestamp: sc.created_at || new Date().toISOString(),
            details: `Position: ${sc.position || 'Prospect'} • Overall Grade: ${sc.overall_rating || '—'}/10`,
            link: '/scouting',
            badgeBg: '#FEF9C3',
            badgeColor: '#A16207',
          })
        })
      } catch (err) {
        console.warn('Could not load scouting reports:', err)
      }

      // 7. Fetch Notice Board Announcements
      try {
        const { data: noticeData } = await scopeTeam(
          supabase
            .from('notices')
            .select('id, title, priority, created_at, profiles(full_name, role)')
            .order('created_at', { ascending: false })
            .limit(30),
          currentTeamId
        )

        ;(noticeData || []).forEach(n => {
          const author = n.profiles
          events.push({
            id: `notice-${n.id}`,
            module: 'notices',
            action: `Posted Team Notice: "${n.title}"`,
            target: n.title,
            actorName: author?.full_name || 'Staff Member',
            actorRole: author?.role || 'coach',
            timestamp: n.created_at || new Date().toISOString(),
            details: `Priority: ${n.priority || 'Normal'}`,
            link: '/notices',
            badgeBg: '#EEF2FF',
            badgeColor: '#4F46E5',
          })
        })
      } catch (err) {
        console.warn('Could not load notices:', err)
      }

      // Sort all events in descending chronological order
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivities(events)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Filter activities
  const filteredActivities = useMemo(() => {
    const now = new Date()
    return activities.filter(act => {
      // Module filter
      if (activeModule !== 'all' && act.module !== activeModule) return false

      // Role filter
      if (roleFilter !== 'all' && act.actorRole !== roleFilter) return false

      // Time range filter
      if (timeRange !== 'all') {
        const actDate = new Date(act.timestamp)
        const diffMs = now.getTime() - actDate.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (timeRange === 'today' && diffHours > 24) return false
        if (timeRange === '7d' && diffHours > 24 * 7) return false
        if (timeRange === '30d' && diffHours > 24 * 30) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchAction = (act.action || '').toLowerCase().includes(q)
        const matchActor  = (act.actorName || '').toLowerCase().includes(q)
        const matchTarget = (act.target || '').toLowerCase().includes(q)
        const matchDetail = (act.details || '').toLowerCase().includes(q)
        if (!matchAction && !matchActor && !matchTarget && !matchDetail) return false
      }

      return true
    })
  }, [activities, activeModule, roleFilter, timeRange, searchQuery])

  // Group filtered activities by Day
  const groupedActivities = useMemo(() => {
    const groups = {}
    filteredActivities.forEach(act => {
      const header = getDayHeader(act.timestamp)
      if (!groups[header]) groups[header] = []
      groups[header].push(act)
    })
    return groups
  }, [filteredActivities])

  // Summary counts
  const summaryCounts = useMemo(() => {
    const counts = { all: activities.length, medical: 0, performance: 0, schedule: 0, athletes: 0, scouting: 0, notices: 0 }
    activities.forEach(a => {
      if (counts[a.module] !== undefined) counts[a.module]++
    })
    return counts
  }, [activities])

  // Export to CSV
  const handleExportCSV = async () => {
    if (filteredActivities.length === 0) return
    const headers = ['Timestamp', 'Date', 'Time', 'Staff/Player Name', 'Role', 'Module', 'Action', 'Target', 'Details']
    const rows = filteredActivities.map(a => [
      `"${a.timestamp}"`,
      `"${fmtDate(a.timestamp)}"`,
      `"${fmtTime(a.timestamp)}"`,
      `"${(a.actorName || '').replace(/"/g, '""')}"`,
      `"${(a.actorRole || '').replace(/"/g, '""')}"`,
      `"${(a.module || '').replace(/"/g, '""')}"`,
      `"${(a.action || '').replace(/"/g, '""')}"`,
      `"${(a.target || '').replace(/"/g, '""')}"`,
      `"${(a.details || '').replace(/"/g, '""')}"`,
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    await mobileSafeDownload(csv, `ApextrackGH_Activity_Log_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'

  return (
    <Layout>
      <div className="page-outer" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        
        {/* Header */}
        <PageHeader
          label="Governance & Compliance"
          title="Activity Log"
          subtitle="Real-time chronological audit trail of all staff and player actions"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fetchActivities(true)}
                disabled={refreshing || loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '8px 14px', borderRadius: 'var(--r-md)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                title="Refresh log activities"
              >
                <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={filteredActivities.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--floral)', border: 'none',
                  color: '#fff', padding: '8px 14px', borderRadius: 'var(--r-md)',
                  fontSize: 13, fontWeight: 600, cursor: filteredActivities.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filteredActivities.length === 0 ? 0.6 : 1
                }}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          }
        />

        {/* Security / Admin Only Notice */}
        {!isAdminOrSuper && !loading && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
            padding: 18, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, color: '#991B1B'
          }}>
            <ShieldAlert size={22} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Restricted Admin View</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Only club administrators and system operators have access to the full staff & player audit log.</div>
            </div>
          </div>
        )}

        {/* ── KPI Metrics Cards ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14, marginBottom: 24
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#E0F2FE',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.04em' }}>Total Events</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{activities.length}</div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#FEE2E2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626'
            }}>
              <HeartPulse size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.04em' }}>Medical Logs</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{summaryCounts.medical}</div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#F3E8FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE'
            }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.04em' }}>Performance</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{summaryCounts.performance}</div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#ECFDF5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669'
            }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.04em' }}>Sessions Scheduled</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{summaryCounts.schedule}</div>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14
        }}>
          {/* Top row: search + role filter + time filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{
              position: 'relative', flex: 1, minWidth: 260
            }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                type="text"
                placeholder="Search by staff name, player, keyword, or action..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 13,
                  color: 'var(--text)', outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all">All Roles</option>
              <option value="physio">Physiotherapist / Medical</option>
              <option value="coach">Coach</option>
              <option value="analyst">Analyst</option>
              <option value="scout">Scout</option>
              <option value="admin">Admin</option>
              <option value="player">Player</option>
            </select>

            {/* Time Filter */}
            <div style={{ display: 'flex', background: 'var(--surface2)', padding: 3, borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              {[
                { id: 'today', label: 'Today' },
                { id: '7d',    label: '7 Days' },
                { id: '30d',   label: '30 Days' },
                { id: 'all',   label: 'All Time' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeRange(t.id)}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: timeRange === t.id ? 700 : 500,
                    background: timeRange === t.id ? 'var(--surface)' : 'transparent',
                    color: timeRange === t.id ? 'var(--text)' : 'var(--text3)',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    boxShadow: timeRange === t.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module Pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {Object.entries(MODULE_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              const isSelected = activeModule === key
              const count = summaryCounts[key] !== undefined ? summaryCounts[key] : activities.length

              return (
                <button
                  key={key}
                  onClick={() => setActiveModule(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    borderRadius: 20, fontSize: 12, fontWeight: isSelected ? 700 : 500,
                    background: isSelected ? 'var(--text)' : 'var(--surface2)',
                    color: isSelected ? 'var(--surface)' : 'var(--text2)',
                    border: '1px solid', borderColor: isSelected ? 'var(--text)' : 'transparent',
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={13} style={{ color: isSelected ? 'var(--surface)' : config.color }} />
                  <span>{config.label}</span>
                  <span style={{
                    fontSize: 10.5, padding: '1px 6px', borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                    fontWeight: 700
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main Activity Feed ── */}
        {loading ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '60px 20px', textAlign: 'center', color: 'var(--text3)'
          }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Loading club activity feed…</div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '60px 20px', textAlign: 'center', color: 'var(--text3)'
          }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No activities found</div>
            <div style={{ fontSize: 13, marginTop: 4, maxWidth: 380, margin: '4px auto 0' }}>
              No logged events match the selected criteria. Try adjusting your search query or filters.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.entries(groupedActivities).map(([dayHeader, dayItems]) => (
              <div key={dayHeader}>
                {/* Day Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                  paddingLeft: 4
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--text2)', background: 'var(--surface2)', padding: '3px 10px',
                    borderRadius: 6, border: '1px solid var(--border)'
                  }}>
                    {dayHeader}
                  </div>
                  <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                    {dayItems.length} event{dayItems.length === 1 ? '' : 's'}
                  </div>
                </div>

                {/* Timeline Items */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                  overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  {dayItems.map((item, idx) => {
                    const badgeInfo = ROLE_BADGES[item.actorRole] || ROLE_BADGES.staff
                    const modInfo   = MODULE_CONFIG[item.module] || MODULE_CONFIG.all
                    const ModIcon   = modInfo.icon

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 14,
                          padding: '16px 20px',
                          borderBottom: idx === dayItems.length - 1 ? 'none' : '1px solid var(--border)',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Module Icon Avatar */}
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: item.badgeBg || '#F1F5F9',
                          color: item.badgeColor || '#475569',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 2
                        }}>
                          <ModIcon size={18} />
                        </div>

                        {/* Content Body */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            {/* Action text */}
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                              {item.action}
                            </span>

                            {/* Role Badge */}
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                              background: badgeInfo.bg, color: badgeInfo.color
                            }}>
                              {badgeInfo.label}
                            </span>
                          </div>

                          {/* Extra details snippet */}
                          {item.details && (
                            <div style={{
                              fontSize: 12.5, color: 'var(--text2)', marginBottom: 6,
                              background: 'var(--surface2)', padding: '5px 10px', borderRadius: 6,
                              display: 'inline-block', maxWidth: '100%'
                            }}>
                              {item.details}
                            </div>
                          )}

                          {/* Timestamp Signature Stamp */}
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                            fontSize: 11, color: 'var(--text3)'
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ opacity: 0.6 }}>✍</span>
                              <strong>{item.actorName || 'Staff Member'}</strong>
                            </span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} />
                              <span>{fmtDate(item.timestamp)} at {fmtTime(item.timestamp)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Link to module page */}
                        {item.link && (
                          <Link
                            href={item.link}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 11.5, fontWeight: 600, color: 'var(--floral)',
                              padding: '6px 10px', borderRadius: 6, background: 'var(--surface2)',
                              textDecoration: 'none', flexShrink: 0, alignSelf: 'center'
                            }}
                          >
                            <span>View</span>
                            <ChevronRight size={13} />
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </Layout>
  )
}
