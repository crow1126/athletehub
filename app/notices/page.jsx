'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '@/components/Layout'
import PlayerLayout from '@/components/PlayerLayout'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import {
  Megaphone, Plus, Pin, Trash2, Send, Radio, Users, CheckCircle2,
  AlertCircle, Trophy, Calendar, HeartPulse, Search, MessageSquare,
  Clock, RefreshCw, X, MapPin, Layers, Check, FileText, ChevronDown,
  ShieldAlert,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'all',      label: 'All Notices',       color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', Icon: Layers },
  { id: 'urgent',   label: 'Urgent Alert',      color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', Icon: AlertCircle },
  { id: 'matchday', label: 'Matchday Call-Up',  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', Icon: Trophy },
  { id: 'training', label: 'Training & Schedule', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', Icon: Calendar },
  { id: 'medical',  label: 'Medical & Physio',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: HeartPulse },
  { id: 'general',  label: 'General Notice',    color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', Icon: Megaphone },
]

const TARGET_GROUPS = [
  { id: 'all',         label: 'Full Squad (All Athletes)' },
  { id: 'goalkeepers', label: 'Goalkeepers (GK)' },
  { id: 'defenders',   label: 'Defenders (DF / Backs)' },
  { id: 'midfielders', label: 'Midfielders (MF)' },
  { id: 'forwards',    label: 'Forwards / Attackers (FW)' },
]

function CategoryPill({ category, size = 'normal' }) {
  const meta = CATEGORIES.find(c => c.id === category) || CATEGORIES.find(c => c.id === 'general')
  const isSmall = size === 'small'
  const IconComponent = meta.Icon || Megaphone

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.border}`,
      borderRadius: 99,
      padding: isSmall ? '2px 8px' : '4px 10px',
      fontSize: isSmall ? 10 : 11,
      fontWeight: 700,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    }}>
      <IconComponent size={isSmall ? 11 : 13} strokeWidth={2.2} />
      <span>{meta.label}</span>
    </span>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: '#F8FAFC',
  border: '1px solid #CBD5E1',
  borderRadius: 10,
  fontSize: 13,
  color: '#0F172A',
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
}

export default function NoticeBoardPage() {
  const [profile, setProfile] = useState(null)
  const [teamId, setTeamId] = useState(null)
  const [notices, setNotices] = useState([])
  const [athletes, setAthletes] = useState([])        // full squad (excluding injured)
  const [injuredIds, setInjuredIds] = useState(new Set()) // ids of currently injured athletes
  const [coaches, setCoaches] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState(null)

  // ── Standard Compose Modal State ────────────────────────────────────────────
  const [composeModal, setComposeModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [targetGroup, setTargetGroup] = useState('all')
  const [isPinned, setIsPinned] = useState(false)
  const [sendSms, setSendSms] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Matchday Call-Up Modal State ─────────────────────────────────────────────
  const [matchdayModal, setMatchdayModal] = useState(false)
  const [mdOpponent, setMdOpponent] = useState('')
  const [mdDate, setMdDate] = useState('')
  const [mdKickoff, setMdKickoff] = useState('15:00')
  const [mdVenue, setMdVenue] = useState('')
  const [mdCompetition, setMdCompetition] = useState('')
  const [mdMeetingPoint, setMdMeetingPoint] = useState('Club House')
  const [mdMeetingTime, setMdMeetingTime] = useState('13:00')
  const [mdFormation, setMdFormation] = useState('')
  const [mdNotes, setMdNotes] = useState('')
  const [mdHeadCoach, setMdHeadCoach] = useState('')
  const [mdSelectedXI, setMdSelectedXI] = useState([])   // player ids in starting XI (max 11)
  const [mdSelectedBench, setMdSelectedBench] = useState([]) // player ids on bench
  const [mdGeneratingPdf, setMdGeneratingPdf] = useState(false)
  const [mdSubmitting, setMdSubmitting] = useState(false)
  const [mdPlayerSearch, setMdPlayerSearch] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const isPrivileged = useMemo(() => {
    return ['admin', 'coach', 'superadmin'].includes(profile?.role)
  }, [profile?.role])

  const getAuthHeaders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      }
    } catch {
      return { 'Content-Type': 'application/json' }
    }
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { profile: p, teamId: tid } = await getTenantProfile('*, club_name, club_logo_url, teams(id, name, short_name, logo_url)')
      setProfile(p)
      setTeamId(tid)

      if (tid) {
        const headers = await getAuthHeaders()

        // 1. Fetch notices
        const res = await fetch(`/api/notices?team_id=${tid}`, { headers })
        const data = await res.json()
        if (data.notices) setNotices(data.notices)

        // 2. Fetch all athletes (with status to detect injured)
        const { data: athList } = await scopeTeam(
          supabase.from('athletes').select('id, name, first_name, last_name, phone, position, back_number, nationality, status'),
          tid
        )
        if (athList) setAthletes(athList)

        // 3. Active injury records to auto-exclude injured players from call-up
        const { data: injuryList } = await scopeTeam(
          supabase.from('injuries').select('athlete_id, status').eq('status', 'Active'),
          tid
        )
        if (injuryList) setInjuredIds(new Set(injuryList.map(i => i.athlete_id)))

        // 4. Coaches list for head coach pre-select
        const { data: coachList } = await scopeTeam(
          supabase.from('coaches').select('id, name, staff_type').eq('is_active', true).order('name'),
          tid
        )
        if (coachList) {
          setCoaches(coachList)
          const hc = coachList.find(c => c.staff_type === 'head_coach' || c.staff_type === 'coach')
          if (hc && !mdHeadCoach) setMdHeadCoach(hc.name)
        }

        // 5. Upcoming sessions for schedule linker
        const todayStr = new Date().toISOString().split('T')[0]
        const { data: sessList } = await scopeTeam(
          supabase.from('training_sessions')
            .select('id, title, type, date, time, venue, duration, notes')
            .gte('date', todayStr)
            .order('date', { ascending: true })
            .limit(10),
          tid
        )
        if (sessList) setSessions(sessList)
      }
    } catch (err) {
      console.error('Failed to load notices:', err)
      showToast('Could not load notices: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  // Eligible athletes for matchday call-up (not injured)
  const eligibleForCallUp = useMemo(() => {
    return athletes.filter(a => {
      const statusIsInjured = (a.status || '').toLowerCase() === 'injured'
      const hasActiveInjury = injuredIds.has(a.id)
      return !statusIsInjured && !hasActiveInjury
    })
  }, [athletes, injuredIds])

  // Filtered by matchday player search
  const filteredEligible = useMemo(() => {
    if (!mdPlayerSearch.trim()) return eligibleForCallUp
    const q = mdPlayerSearch.toLowerCase()
    return eligibleForCallUp.filter(a =>
      (a.name || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase().includes(q) ||
      (a.position || '').toLowerCase().includes(q)
    )
  }, [eligibleForCallUp, mdPlayerSearch])

  function toggleXI(id) {
    if (mdSelectedXI.includes(id)) {
      setMdSelectedXI(prev => prev.filter(x => x !== id))
    } else if (mdSelectedBench.includes(id)) {
      if (mdSelectedXI.length < 11) {
        setMdSelectedBench(prev => prev.filter(x => x !== id))
        setMdSelectedXI(prev => [...prev, id])
      } else {
        showToast('Starting XI is full (11 players). Remove one first.', 'error')
      }
    } else {
      if (mdSelectedXI.length < 11) {
        setMdSelectedXI(prev => [...prev, id])
      } else {
        showToast('Starting XI is full (11 players). Added to Bench instead.', 'error')
      }
    }
  }

  function toggleBench(id) {
    if (mdSelectedBench.includes(id)) {
      setMdSelectedBench(prev => prev.filter(x => x !== id))
    } else if (mdSelectedXI.includes(id)) {
      setMdSelectedXI(prev => prev.filter(x => x !== id))
      setMdSelectedBench(prev => [...prev, id])
    } else {
      setMdSelectedBench(prev => [...prev, id])
    }
  }

  function getPlayerName(a) {
    return a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Player'
  }

  async function handleGenerateTeamSheet() {
    if (!mdOpponent.trim()) { showToast('Enter opponent team name first.', 'error'); return }
    if (mdSelectedXI.length === 0) { showToast('Select at least 1 starting player.', 'error'); return }

    setMdGeneratingPdf(true)
    try {
      const { generateTeamSheetPDF } = await import('@/lib/pdfTeamSheet')
      const team = profile?.teams || {}
      const clubLogoUrl = team?.logo_url || profile?.club_logo_url || null

      const getPlayerObj = id => {
        const a = athletes.find(x => x.id === id)
        if (!a) return null
        return {
          id: a.id,
          name: getPlayerName(a),
          back_number: a.back_number,
          position: a.position,
          nationality: a.nationality,
        }
      }

      await generateTeamSheetPDF({
        clubName: team?.name || profile?.club_name || 'Club',
        clubLogoUrl,
        opponentName: mdOpponent.trim(),
        matchDate: mdDate,
        kickoffTime: mdKickoff,
        venue: mdVenue,
        competition: mdCompetition,
        meetingPoint: mdMeetingPoint,
        meetingTime: mdMeetingTime,
        formation: mdFormation,
        notes: mdNotes,
        headCoachName: mdHeadCoach,
        medicalStaffName: coaches.find(c => c.staff_type === 'physio')?.name || 'Club Physio',
        startingXI: mdSelectedXI.map(getPlayerObj).filter(Boolean),
        substitutes: mdSelectedBench.map(getPlayerObj).filter(Boolean),
      })
      showToast('Team Sheet PDF downloaded successfully!')
    } catch (err) {
      console.error('PDF gen error:', err)
      showToast('Failed to generate PDF: ' + err.message, 'error')
    } finally {
      setMdGeneratingPdf(false)
    }
  }

  async function handlePublishMatchdayCallup() {
    if (!mdOpponent.trim()) { showToast('Enter opponent team name.', 'error'); return }
    if (mdSelectedXI.length === 0 && mdSelectedBench.length === 0) {
      showToast('Select at least one player before publishing.', 'error'); return
    }

    setMdSubmitting(true)
    try {
      const { formatTime12H } = await import('@/lib/pdfTeamSheet')
      const headers = await getAuthHeaders()

      const xiNames = mdSelectedXI.map(id => {
        const a = athletes.find(x => x.id === id)
        return a ? `${getPlayerName(a)}${a.back_number ? ' #' + a.back_number : ''}` : ''
      }).filter(Boolean)

      const benchNames = mdSelectedBench.map(id => {
        const a = athletes.find(x => x.id === id)
        return a ? `${getPlayerName(a)}${a.back_number ? ' #' + a.back_number : ''}` : ''
      }).filter(Boolean)

      const dateFormatted = mdDate
        ? new Date(mdDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        : 'Matchday'

      const formattedKickoff = formatTime12H(mdKickoff) || '3:00 PM'
      const formattedMeeting = formatTime12H(mdMeetingTime)

      const club = profile?.teams?.name || profile?.club_name || 'Club'
      const noticeTitle = `Matchday Call-Up: ${club} vs ${mdOpponent.trim()}`
      
      let noticeContent = `⚽ MATCHDAY SQUAD CALL-UP\n\n`
      noticeContent += `Fixture: ${club} vs ${mdOpponent.trim()}\n`
      noticeContent += `📅 Date: ${dateFormatted}\n`
      noticeContent += `⏰ Kickoff: ${formattedKickoff}\n`
      if (mdVenue) noticeContent += `📍 Venue: ${mdVenue}\n`
      if (mdMeetingPoint) noticeContent += `📍 Meeting Point: ${mdMeetingPoint}\n`
      if (formattedMeeting) noticeContent += `⏱ Meeting Time: ${formattedMeeting}\n`
      if (mdCompetition) noticeContent += `🏆 Competition: ${mdCompetition}\n`

      if (xiNames.length > 0) {
        noticeContent += `\n🟢 STARTING XI (${xiNames.length}):\n${xiNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n')}`
      }
      if (benchNames.length > 0) {
        noticeContent += `\n\n🔵 BENCH / SUBSTITUTES (${benchNames.length}):\n${benchNames.map((n, i) => `  ${mdSelectedXI.length + i + 1}. ${n}`).join('\n')}`
      }
      if (mdFormation) noticeContent += `\n\nFormation: ${mdFormation}`
      if (mdNotes) noticeContent += `\n\nCoach Instructions:\n${mdNotes}`
      noticeContent += `\n\n— Please report promptly in FULL MATCH KIT.\n— Players NOT on this call-up list: report for recovery session.`

      const calledUpIds = [...mdSelectedXI, ...mdSelectedBench]

      const res = await fetch('/api/notices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: noticeTitle,
          content: noticeContent,
          category: 'matchday',
          target_group: 'all',
          is_pinned: true,
          send_sms: true,
          team_id: teamId,
          recipient_ids: calledUpIds,
          match_details: {
            opponent: mdOpponent.trim(),
            matchDate: mdDate,
            kickoffTime: mdKickoff,
            venue: mdVenue,
            meetingPoint: mdMeetingPoint,
            meetingTime: mdMeetingTime,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to publish matchday call-up.')

      if (data.sent > 0) {
        showToast(`Matchday Call-Up published. ${data.sent} called-up players notified via SMS.`)
      } else {
        showToast('Matchday Call-Up published to Notice Board.')
      }

      // Reset matchday state
      setMdOpponent(''); setMdDate(''); setMdKickoff('15:00'); setMdVenue('')
      setMdCompetition(''); setMdMeetingPoint('Club House'); setMdMeetingTime('13:00')
      setMdFormation(''); setMdNotes('')
      setMdSelectedXI([]); setMdSelectedBench([]); setMdPlayerSearch('')
      setMatchdayModal(false)
      loadData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setMdSubmitting(false)
    }
  }

  // ── Standard Notice Submit ───────────────────────────────────────────────────
  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId)
    if (!sessionId) return
    const s = sessions.find(item => item.id === sessionId)
    if (!s) return
    const dateFormatted = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    setTitle(`Schedule Update: ${s.title} (${dateFormatted})`)
    setContent(`Session Details:\n- Event: ${s.type} — "${s.title}"\n- Date & Time: ${dateFormatted} at ${s.time} (${s.duration} min)\n- Venue: ${s.venue}${s.notes ? `\n- Instructions: ${s.notes}` : ''}`)
  }

  const eligibleSmsRecipients = useMemo(() => {
    const withPhone = athletes.filter(a => a.phone && a.phone.trim().length >= 8)
    if (targetGroup === 'all') return withPhone
    const GK_POSITIONS  = new Set(['GK', 'Goalkeeper'])
    const DEF_POSITIONS = new Set(['CB', 'RB', 'LB', 'RWB', 'LWB', 'Defender', 'Centre-Back', 'Right Back', 'Left Back'])
    const MID_POSITIONS = new Set(['CDM', 'CM', 'CAM', 'RM', 'LM', 'Midfielder', 'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder', 'Right Midfielder', 'Left Midfielder'])
    const FWD_POSITIONS = new Set(['RW', 'LW', 'CF', 'SS', 'ST', 'Forward', 'Right Winger', 'Left Winger', 'Centre Forward', 'Second Striker', 'Striker', 'Attacker'])
    if (targetGroup === 'goalkeepers') return withPhone.filter(a => GK_POSITIONS.has(a.position))
    if (targetGroup === 'defenders')   return withPhone.filter(a => DEF_POSITIONS.has(a.position))
    if (targetGroup === 'midfielders') return withPhone.filter(a => MID_POSITIONS.has(a.position))
    if (targetGroup === 'forwards')    return withPhone.filter(a => FWD_POSITIONS.has(a.position))
    return withPhone
  }, [athletes, targetGroup])

  const handleCreateNotice = async (e) => {
    e.preventDefault()
    if (!title.trim()) { showToast('Please enter a notice headline.', 'error'); return }
    if (!content.trim()) { showToast('Please enter the notice details.', 'error'); return }
    setSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: title.trim(), content: content.trim(), category, target_group: targetGroup, is_pinned: isPinned, send_sms: sendSms, team_id: profile?.team_id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to publish notice.')
      if (sendSms && data.sent > 0) showToast(`Notice published. ${data.sent} players notified via Moolre SMS.`)
      else if (sendSms && data.total === 0) showToast('Notice published (No player phone numbers recorded for SMS).')
      else showToast('Notice published successfully to Notice Board.')
      setTitle(''); setContent(''); setCategory('general'); setSelectedSessionId('')
      setTargetGroup('all'); setIsPinned(false); setSendSms(true); setComposeModal(false)
      loadData()
    } catch (err) { showToast(err.message, 'error') }
    finally { setSubmitting(false) }
  }

  const handleTogglePin = async (notice) => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/notices', { method: 'PATCH', headers, body: JSON.stringify({ id: notice.id, is_pinned: !notice.is_pinned }) })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed')
      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_pinned: !notice.is_pinned } : n))
      showToast(notice.is_pinned ? 'Notice unpinned.' : 'Notice pinned to top of board.')
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleDeleteNotice = async (notice) => {
    if (!confirm(`Delete notice "${notice.title}"?`)) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/notices?id=${notice.id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed')
      setNotices(prev => prev.filter(n => n.id !== notice.id))
      showToast('Notice deleted.')
    } catch (err) { showToast(err.message, 'error') }
  }

  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const matchCat = filterCat === 'all' || n.category === filterCat
      const matchQ = !searchQuery.trim() ||
        n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.author_name?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchQ
    })
  }, [notices, filterCat, searchQuery])

  const totalSmsBroadcasts = useMemo(() => notices.reduce((sum, n) => sum + (n.sms_count || 0), 0), [notices])
  const pinnedCount = useMemo(() => notices.filter(n => n.is_pinned).length, [notices])

  const LayoutComponent = profile?.role === 'player' ? PlayerLayout : Layout

  return (
    <LayoutComponent>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, background: toast.type === 'error' ? '#7F1D1D' : '#064E3B', color: toast.type === 'error' ? '#FECACA' : '#A7F3D0', border: `1px solid ${toast.type === 'error' ? '#EF4444' : '#10B981'}`, borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.2s ease' }}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* ── HEADER BANNER ── */}
        <div style={{ background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 60%, #14B8A6 100%)', borderRadius: 20, padding: '28px 32px', color: '#FFFFFF', boxShadow: '0 8px 24px rgba(13, 148, 136, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Megaphone size={20} strokeWidth={2.5} color="#FFFFFF" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Squad Notice Board</h1>
            </div>
            <p style={{ fontSize: 13, color: '#CCFBF1', marginTop: 6, maxWidth: 540, lineHeight: 1.4 }}>
              Broadcast matchday call-ups, schedule adjustments, and club announcements directly to players with integrated <strong>Moolre SMS</strong> notifications.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Matchday Call-Up CTA */}
            {isPrivileged && (
              <button
                id="matchday-callup-btn"
                onClick={() => setMatchdayModal(true)}
                style={{ background: 'linear-gradient(135deg, #059669, #10B981)', color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.15)', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Trophy size={15} strokeWidth={2.5} />
                <span>Matchday Call-Up</span>
              </button>
            )}
            {isPrivileged && (
              <button
                id="post-new-notice-btn"
                onClick={() => setComposeModal(true)}
                style={{ background: '#FFFFFF', color: '#0F766E', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Plus size={16} strokeWidth={3} />
                <span>Post Notice</span>
              </button>
            )}
            <button onClick={loadData} title="Refresh" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#FFFFFF', borderRadius: 12, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── METRIC STAT TILES ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Notices', value: notices.length, sub: 'Active announcements', color: '#0D9488', Icon: Megaphone },
            { label: 'Pinned Notices', value: pinnedCount, sub: 'Sticky notices on board', color: '#D97706', Icon: Pin },
            { label: 'Moolre SMS Broadcasts', value: totalSmsBroadcasts, sub: 'Delivered to player phones', color: '#059669', Icon: Radio },
            { label: 'Reachable Squad', value: athletes.filter(a => a.phone).length, sub: `Players with phone (${athletes.length} total)`, color: '#3B82F6', Icon: Users },
          ].map(({ label, value, sub, color, Icon }) => (
            <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                <Icon size={16} color={color} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── FILTER BAR & SEARCH ── */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const active = filterCat === cat.id
              const IconComp = cat.Icon
              return (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)} style={{ border: `1px solid ${active ? cat.color : '#E2E8F0'}`, background: active ? cat.bg : '#FFFFFF', color: active ? cat.color : '#64748B', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: active ? 800 : 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <IconComp size={13} strokeWidth={2.2} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search notices or author…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 34px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, color: '#0F172A', outline: 'none' }} />
          </div>
        </div>

        {/* ── NOTICES LIST ── */}
        {loading ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTopColor: '#0D9488', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Loading Notice Board…</div>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div style={{ background: '#FFFFFF', border: '1.5px dashed #CBD5E1', borderRadius: 18, padding: '56px 24px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Megaphone size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>No Notices on the Board</h3>
            <p style={{ fontSize: 13, color: '#64748B', maxWidth: 420, margin: '6px auto 18px', lineHeight: 1.4 }}>
              {filterCat !== 'all' || searchQuery ? 'No notices match the selected category or search filter.' : 'Post announcements, training schedule updates, or matchday call-ups to notify your squad.'}
            </p>
            {isPrivileged && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setMatchdayModal(true)} style={{ background: 'linear-gradient(135deg, #059669, #10B981)', color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trophy size={14} /> Matchday Call-Up
                </button>
                <button onClick={() => setComposeModal(true)} style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)', color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  + Post a Notice
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredNotices.map(notice => {
              const isUrgent = notice.category === 'urgent'
              const isPinnedNotice = notice.is_pinned
              const isMatchday = notice.category === 'matchday'

              return (
                <div key={notice.id} style={{ background: isUrgent ? '#FFFDFD' : '#FFFFFF', border: isUrgent ? '1.5px solid #FECACA' : isPinnedNotice ? '1.5px solid #5EEAD4' : '1px solid #E2E8F0', borderRadius: 16, padding: '20px 24px', boxShadow: isPinnedNotice ? '0 6px 20px rgba(13, 148, 136, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: isUrgent ? '#EF4444' : isMatchday ? '#059669' : isPinnedNotice ? '#0D9488' : '#CBD5E1' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isPinnedNotice && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}><Pin size={11} /> Pinned</span>}
                      <CategoryPill category={notice.category} />
                      {notice.target_group && notice.target_group !== 'all' && (
                        <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Target: {notice.target_group}</span>
                      )}
                      {notice.sms_sent ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                          <Radio size={10} /> SMS Sent ({notice.sms_count})
                        </span>
                      ) : (
                        <span style={{ background: '#F8FAFC', color: '#94A3B8', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>Board Only</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /><span>{timeAgo(notice.created_at)}</span>
                      </div>
                      {isPrivileged && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => handleTogglePin(notice)} title={notice.is_pinned ? 'Unpin' : 'Pin to top'} style={{ background: notice.is_pinned ? '#FEF3C7' : '#F1F5F9', border: 'none', color: notice.is_pinned ? '#B45309' : '#64748B', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Pin size={12} />
                          </button>
                          <button onClick={() => handleDeleteNotice(notice)} title="Delete" style={{ background: '#FFF1F2', border: 'none', color: '#E11D48', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 8, lineHeight: 1.3 }}>{notice.title}</h2>
                  <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{notice.content}</p>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E2E8F0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{notice.author_name ? notice.author_name[0].toUpperCase() : 'S'}</div>
                      <span>Posted by <strong>{notice.author_name || 'Staff'}</strong> {notice.author_role ? `(${notice.author_role})` : ''}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>ID: {notice.id?.slice(0, 8)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MATCHDAY CALL-UP MODAL — Individual player selection + Team Sheet PDF
        ══════════════════════════════════════════════════════════════════════ */}
        {matchdayModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 780, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>

              {/* Modal Header */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #ECFDF5, #F0FDFA)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Matchday Call-Up</h3>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Select individual players — injured are automatically excluded</p>
                  </div>
                </div>
                <button onClick={() => setMatchdayModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* ── MATCH DETAILS ── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={13} /> Match Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Opponent Team Name *</label>
                      <input type="text" placeholder="e.g. Accra Hearts of Oak SC" value={mdOpponent} onChange={e => setMdOpponent(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Match Date *</label>
                      <input type="date" value={mdDate} onChange={e => setMdDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Kickoff Time</label>
                      <input type="time" value={mdKickoff} onChange={e => setMdKickoff(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Venue / Pitch</label>
                      <input type="text" placeholder="e.g. Baba Yara Sports Stadium" value={mdVenue} onChange={e => setMdVenue(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Meeting Point</label>
                      <input type="text" placeholder="e.g. Club House / Main Gate" value={mdMeetingPoint} onChange={e => setMdMeetingPoint(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Report / Meeting Time</label>
                      <input type="time" value={mdMeetingTime} onChange={e => setMdMeetingTime(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Competition</label>
                      <input type="text" placeholder="e.g. Ghana Premier League" value={mdCompetition} onChange={e => setMdCompetition(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Formation</label>
                      <input type="text" placeholder="e.g. 4-3-3 / 4-4-2" value={mdFormation} onChange={e => setMdFormation(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Head Coach Name</label>
                      <input type="text" placeholder="Head Coach" value={mdHeadCoach} onChange={e => setMdHeadCoach(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Coach Notes (Optional)</label>
                      <textarea rows={2} placeholder="e.g. Report in full red kit. Bring valid ID. No boots allowed in VIP lounge." value={mdNotes} onChange={e => setMdNotes(e.target.value)} style={{ ...inputStyle, lineHeight: 1.5 }} />
                    </div>
                  </div>
                </div>

                {/* ── INJURED PLAYERS WARNING ── */}
                {injuredIds.size > 0 && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldAlert size={15} color="#D97706" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                      {injuredIds.size} player{injuredIds.size > 1 ? 's are' : ' is'} currently injured and have been automatically excluded from selection below.
                    </span>
                  </div>
                )}

                {/* ── PLAYER SELECTION ── */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={13} /> Select Players
                      <span style={{ fontSize: 11, background: '#ECFDF5', color: '#059669', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                        {mdSelectedXI.length}/11 Starting XI · {mdSelectedBench.length} Bench
                      </span>
                    </div>
                    {/* Search input */}
                    <div style={{ position: 'relative' }}>
                      <Search size={12} color="#94A3B8" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="text" placeholder="Search player…" value={mdPlayerSearch} onChange={e => setMdPlayerSearch(e.target.value)} style={{ padding: '6px 10px 6px 28px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, color: '#0F172A', outline: 'none', width: 180 }} />
                    </div>
                  </div>

                  {eligibleForCallUp.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: 13 }}>
                      No eligible (non-injured) players found in squad.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {filteredEligible.map(a => {
                        const isXI = mdSelectedXI.includes(a.id)
                        const isBench = mdSelectedBench.includes(a.id)
                        const name = getPlayerName(a)

                        return (
                          <div key={a.id} style={{ border: `1.5px solid ${isXI ? '#059669' : isBench ? '#3B82F6' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 12px', background: isXI ? '#ECFDF5' : isBench ? '#EFF6FF' : '#FAFAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Jersey # */}
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: isXI ? '#059669' : isBench ? '#3B82F6' : '#E2E8F0', color: isXI || isBench ? '#FFFFFF' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                              {a.back_number || '—'}
                            </div>
                            {/* Name & position */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                              <div style={{ fontSize: 10, color: '#94A3B8' }}>{a.position || 'Player'}</div>
                            </div>
                            {/* XI / Bench buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <button onClick={() => toggleXI(a.id)} style={{ padding: '3px 7px', fontSize: 9, fontWeight: 800, borderRadius: 5, border: `1px solid ${isXI ? '#059669' : '#D1FAE5'}`, background: isXI ? '#059669' : '#F0FDF4', color: isXI ? '#FFF' : '#059669', cursor: 'pointer', textTransform: 'uppercase' }}>
                                {isXI ? '✓ XI' : 'XI'}
                              </button>
                              <button onClick={() => toggleBench(a.id)} style={{ padding: '3px 7px', fontSize: 9, fontWeight: 800, borderRadius: 5, border: `1px solid ${isBench ? '#3B82F6' : '#DBEAFE'}`, background: isBench ? '#3B82F6' : '#EFF6FF', color: isBench ? '#FFF' : '#3B82F6', cursor: 'pointer', textTransform: 'uppercase' }}>
                                {isBench ? '✓ SUB' : 'Sub'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── SELECTION SUMMARY ── */}
                {(mdSelectedXI.length > 0 || mdSelectedBench.length > 0) && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Selection Summary</div>
                    {mdSelectedXI.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>Starting XI ({mdSelectedXI.length}): </span>
                        <span style={{ fontSize: 11, color: '#047857' }}>
                          {mdSelectedXI.map(id => { const a = athletes.find(x => x.id === id); return a ? `${getPlayerName(a)}${a.back_number ? ' #' + a.back_number : ''}` : '' }).filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                    {mdSelectedBench.length > 0 && (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>Bench ({mdSelectedBench.length}): </span>
                        <span style={{ fontSize: 11, color: '#3B82F6' }}>
                          {mdSelectedBench.map(id => { const a = athletes.find(x => x.id === id); return a ? `${getPlayerName(a)}${a.back_number ? ' #' + a.back_number : ''}` : '' }).filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── MODAL FOOTER ACTIONS ── */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setMatchdayModal(false)} style={{ flex: '0 0 auto', padding: '11px 18px', borderRadius: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>

                {/* Generate Team Sheet PDF */}
                <button
                  type="button"
                  onClick={handleGenerateTeamSheet}
                  disabled={mdGeneratingPdf || !mdOpponent.trim()}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, background: mdOpponent.trim() ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : '#E2E8F0', border: 'none', color: mdOpponent.trim() ? '#FFFFFF' : '#94A3B8', fontSize: 13, fontWeight: 800, cursor: mdOpponent.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: mdGeneratingPdf ? 0.7 : 1 }}
                >
                  <FileText size={15} />
                  <span>{mdGeneratingPdf ? 'Generating PDF…' : 'Download Team Sheet (PDF)'}</span>
                </button>

                {/* Publish Call-Up Notice + SMS */}
                <button
                  type="button"
                  onClick={handlePublishMatchdayCallup}
                  disabled={mdSubmitting || (!mdSelectedXI.length && !mdSelectedBench.length) || !mdOpponent.trim()}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg, #059669, #10B981)', border: 'none', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: (mdSelectedXI.length || mdSelectedBench.length) && mdOpponent.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: mdSubmitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' }}
                >
                  <Send size={15} />
                  <span>{mdSubmitting ? 'Publishing…' : `Publish Call-Up & Notify Squad →`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STANDARD COMPOSE NOTICE MODAL ── */}
        {composeModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #F0FDFA, #FFFFFF)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Publish Squad Notice</h3>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Broadcast to notice board and send Moolre SMS</p>
                  </div>
                </div>
                <button onClick={() => setComposeModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateNotice} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                      <option value="general">General Notice</option>
                      <option value="urgent">Urgent Alert</option>
                      <option value="training">Training &amp; Schedule</option>
                      <option value="medical">Medical &amp; Physio</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Target Audience</label>
                    <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} style={inputStyle}>
                      {TARGET_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </div>

                {category === 'training' && sessions.length > 0 && (
                  <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 10, padding: '10px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <Calendar size={13} /> Link to Scheduled Session (Optional)
                    </label>
                    <select value={selectedSessionId} onChange={e => handleSelectSession(e.target.value)} style={{ ...inputStyle, color: '#0F766E', border: '1px solid #99F6E4' }}>
                      <option value="">-- General training notice (no session) --</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {s.time} — {s.title} ({s.venue})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Notice Headline *</label>
                  <input type="text" placeholder="e.g. Pitch Venue Update / Recovery Session Tomorrow" value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Notice Message *</label>
                    <span style={{ fontSize: 11, color: content.length > 150 ? '#EF4444' : '#94A3B8', fontWeight: 600 }}>{content.length} characters</span>
                  </div>
                  <textarea rows={4} placeholder="Write instructions, reporting times, required kit, or critical updates…" value={content} onChange={e => setContent(e.target.value)} required style={{ ...inputStyle, lineHeight: 1.5 }} />
                </div>

                <div style={{ background: sendSms ? '#F0FDF4' : '#F8FAFC', border: `1.5px solid ${sendSms ? '#86EFAC' : '#E2E8F0'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={16} color={sendSms ? '#15803D' : '#64748B'} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: sendSms ? '#166534' : '#334155' }}>Broadcast via Moolre SMS</span>
                    </div>
                    <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }} />
                  </div>
                  {sendSms ? (
                    <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.4, borderTop: '1px dashed #BBF7D0', paddingTop: 8 }}>
                      Will immediately deliver to <strong>{eligibleSmsRecipients.length} target players</strong> with registered Ghanaian phone numbers via Moolre VAS gateway.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#64748B' }}>Notice will only appear in-app on the Notice Board. No SMS credits will be deducted.</div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Pin size={15} color={isPinned ? '#B45309' : '#64748B'} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Pin this notice to top of board</span>
                  </div>
                  <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#D97706', cursor: 'pointer' }} />
                </div>

                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #F1F5F9', paddingTop: 16, marginTop: 4 }}>
                  <button type="button" onClick={() => setComposeModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg, #0F766E, #0D9488)', border: 'none', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)' }}>
                    <Send size={15} />
                    <span>{submitting ? 'Publishing…' : 'Publish Notice →'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </LayoutComponent>
  )
}
