'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import {
  Megaphone, Plus, Pin, Trash2, Send, Radio, Users, CheckCircle2,
  AlertCircle, Trophy, Calendar, HeartPulse, Search, MessageSquare,
  Clock, RefreshCw, X, MapPin, Layers, Check
} from 'lucide-react'

const CATEGORIES = [
  { id: 'all',      label: 'All Notices',      color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', Icon: Layers },
  { id: 'urgent',   label: 'Urgent Alert',     color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', Icon: AlertCircle },
  { id: 'matchday', label: 'Matchday Call-Up', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', Icon: Trophy },
  { id: 'training', label: 'Training & Schedule', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', Icon: Calendar },
  { id: 'medical',  label: 'Medical & Physio', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: HeartPulse },
  { id: 'general',  label: 'General Notice',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', Icon: Megaphone },
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

export default function NoticeBoardPage() {
  const [profile, setProfile] = useState(null)
  const [notices, setNotices] = useState([])
  const [athletes, setAthletes] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState(null)

  // Composer Modal State
  const [composeModal, setComposeModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('general')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [targetGroup, setTargetGroup] = useState('all')
  const [isPinned, setIsPinned] = useState(false)
  const [sendSms, setSendSms] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const isPrivileged = useMemo(() => {
    return ['admin', 'coach', 'superadmin'].includes(profile?.role)
  }, [profile?.role])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { profile: p, teamId } = await getTenantProfile('*, club_name, club_logo_url, teams(id, name, short_name)')
      setProfile(p)

      if (teamId) {
        // 1. Fetch notices
        const res = await fetch(`/api/notices?team_id=${teamId}`)
        const data = await res.json()
        if (data.notices) setNotices(data.notices)

        // 2. Fetch squad athletes for phone numbers count
        const { data: athList } = await scopeTeam(supabase.from('athletes').select('id, name, phone, position'), teamId)
        if (athList) setAthletes(athList)

        // 3. Fetch upcoming sessions from schedule to link seamlessly
        const todayStr = new Date().toISOString().split('T')[0]
        const { data: sessList } = await scopeTeam(
          supabase.from('training_sessions')
            .select('id, title, type, date, time, venue, duration, notes')
            .gte('date', todayStr)
            .order('date', { ascending: true })
            .limit(10),
          teamId
        )
        if (sessList) setSessions(sessList)
      }
    } catch (err) {
      console.error('Failed to load notices:', err)
      showToast('Could not load notices: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // When coach links a scheduled session in composer, pre-fill title & content to avoid contradictions
  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId)
    if (!sessionId) return
    const s = sessions.find(item => item.id === sessionId)
    if (!s) return

    const dateFormatted = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    setTitle(`Schedule Update: ${s.title} (${dateFormatted})`)
    setContent(`Session Details:\n- Event: ${s.type} — "${s.title}"\n- Date & Time: ${dateFormatted} at ${s.time} (${s.duration} min)\n- Venue: ${s.venue}${s.notes ? `\n- Instructions: ${s.notes}` : ''}`)
  }

  // Count recipients with phone for selected target group in composer
  const eligibleSmsRecipients = useMemo(() => {
    const withPhone = athletes.filter(a => a.phone && a.phone.trim().length >= 8)
    if (targetGroup === 'all') return withPhone
    if (targetGroup === 'goalkeepers') {
      return withPhone.filter(a => (a.position || '').toLowerCase().includes('goalkeeper') || (a.position || '').toLowerCase() === 'gk')
    }
    if (targetGroup === 'defenders') {
      return withPhone.filter(a => {
        const p = (a.position || '').toLowerCase()
        return p.includes('defender') || p.includes('back') || p === 'cb' || p === 'lb' || p === 'rb'
      })
    }
    if (targetGroup === 'midfielders') {
      return withPhone.filter(a => {
        const p = (a.position || '').toLowerCase()
        return p.includes('midfield') || p === 'cm' || p === 'dm' || p === 'am'
      })
    }
    if (targetGroup === 'forwards') {
      return withPhone.filter(a => {
        const p = (a.position || '').toLowerCase()
        return p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('attacker') || p === 'st' || p === 'rw' || p === 'lw'
      })
    }
    return withPhone
  }, [athletes, targetGroup])

  const handleCreateNotice = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast('Please enter a notice headline.', 'error')
      return
    }
    if (!content.trim()) {
      showToast('Please enter the notice details.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          target_group: targetGroup,
          is_pinned: isPinned,
          send_sms: sendSms,
          team_id: profile?.team_id,
        })
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to publish notice.')
      }

      if (sendSms && data.sent > 0) {
        showToast(`Notice published. ${data.sent} players notified via Moolre SMS.`)
      } else if (sendSms && data.total === 0) {
        showToast('Notice published (No player phone numbers recorded for SMS).')
      } else {
        showToast('Notice published successfully to Notice Board.')
      }

      // Reset modal
      setTitle('')
      setContent('')
      setCategory('general')
      setSelectedSessionId('')
      setTargetGroup('all')
      setIsPinned(false)
      setSendSms(true)
      setComposeModal(false)

      // Refresh notices
      loadData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePin = async (notice) => {
    try {
      const res = await fetch('/api/notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notice.id,
          is_pinned: !notice.is_pinned,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed')

      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_pinned: !notice.is_pinned } : n))
      showToast(notice.is_pinned ? 'Notice unpinned.' : 'Notice pinned to top of board.')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDeleteNotice = async (notice) => {
    if (!confirm(`Delete notice "${notice.title}"?`)) return
    try {
      const res = await fetch(`/api/notices?id=${notice.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed')

      setNotices(prev => prev.filter(n => n.id !== notice.id))
      showToast('Notice deleted.')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Filtered notices
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

  const totalSmsBroadcasts = useMemo(() => {
    return notices.reduce((sum, n) => sum + (n.sms_count || 0), 0)
  }, [notices])

  const pinnedCount = useMemo(() => {
    return notices.filter(n => n.is_pinned).length
  }, [notices])

  return (
    <Layout>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 48px' }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99999,
            background: toast.type === 'error' ? '#7F1D1D' : '#064E3B',
            color: toast.type === 'error' ? '#FECACA' : '#A7F3D0',
            border: `1px solid ${toast.type === 'error' ? '#EF4444' : '#10B981'}`,
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 0.2s ease',
          }}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* ── HEADER BANNER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 60%, #14B8A6 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          color: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(13, 148, 136, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 24,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Megaphone size={20} strokeWidth={2.5} color="#FFFFFF" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
                Squad Notice Board
              </h1>
            </div>
            <p style={{ fontSize: 13, color: '#CCFBF1', marginTop: 6, maxWidth: 540, lineHeight: 1.4 }}>
              Broadcast matchday call-ups, schedule adjustments, and club announcements directly to players with integrated <strong>Moolre SMS</strong> notifications.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPrivileged && (
              <button
                id="post-new-notice-btn"
                onClick={() => setComposeModal(true)}
                style={{
                  background: '#FFFFFF',
                  color: '#0F766E',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)' }}
              >
                <Plus size={16} strokeWidth={3} />
                <span>+ Post Notice</span>
              </button>
            )}

            <button
              onClick={loadData}
              title="Refresh Notices"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#FFFFFF',
                borderRadius: 12,
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── METRIC STAT TILES ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Notices</span>
              <Megaphone size={16} color="#0D9488" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{notices.length}</div>
            <div style={{ fontSize: 11, color: '#0D9488', marginTop: 2 }}>Active announcements</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pinned Notices</span>
              <Pin size={16} color="#D97706" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{pinnedCount}</div>
            <div style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>Sticky notices on board</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Moolre SMS Broadcasts</span>
              <Radio size={16} color="#059669" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginTop: 4 }}>{totalSmsBroadcasts}</div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>Delivered to player phones</div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reachable Squad</span>
              <Users size={16} color="#3B82F6" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>
              {athletes.filter(a => a.phone).length} <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>/ {athletes.length}</span>
            </div>
            <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>Players with phone registered</div>
          </div>
        </div>

        {/* ── FILTER BAR & SEARCH ── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* Category Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const active = filterCat === cat.id
              const IconComp = cat.Icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(cat.id)}
                  style={{
                    border: `1px solid ${active ? cat.color : '#E2E8F0'}`,
                    background: active ? cat.bg : '#FFFFFF',
                    color: active ? cat.color : '#64748B',
                    borderRadius: 99,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <IconComp size={13} strokeWidth={2.2} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search notices or author…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                fontSize: 12,
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* ── NOTICES LIST ── */}
        {loading ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTopColor: '#0D9488', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Loading Notice Board…</div>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div style={{
            background: '#FFFFFF',
            border: '1.5px dashed #CBD5E1',
            borderRadius: 18,
            padding: '56px 24px',
            textAlign: 'center',
            color: '#64748B',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Megaphone size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>No Notices on the Board</h3>
            <p style={{ fontSize: 13, color: '#64748B', maxWidth: 420, margin: '6px auto 18px', lineHeight: 1.4 }}>
              {filterCat !== 'all' || searchQuery
                ? 'No notices match the selected category or search filter.'
                : 'Post announcements, training schedule updates, or matchday call-ups to notify your squad via SMS.'}
            </p>
            {isPrivileged && (
              <button
                onClick={() => setComposeModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Post the First Notice
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredNotices.map(notice => {
              const isUrgent = notice.category === 'urgent'
              const isPinnedNotice = notice.is_pinned

              return (
                <div
                  key={notice.id}
                  style={{
                    background: isUrgent ? '#FFFDFD' : '#FFFFFF',
                    border: isUrgent ? '1.5px solid #FECACA' : isPinnedNotice ? '1.5px solid #5EEAD4' : '1px solid #E2E8F0',
                    borderRadius: 16,
                    padding: '20px 24px',
                    boxShadow: isPinnedNotice ? '0 6px 20px rgba(13, 148, 136, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: isUrgent ? '#EF4444' : isPinnedNotice ? '#0D9488' : '#CBD5E1',
                  }} />

                  {/* Top Row: Meta Tags & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isPinnedNotice && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}>
                          <Pin size={11} /> Pinned
                        </span>
                      )}

                      <CategoryPill category={notice.category} />

                      {notice.target_group && notice.target_group !== 'all' && (
                        <span style={{
                          background: '#F1F5F9',
                          color: '#475569',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          Target: {notice.target_group}
                        </span>
                      )}

                      {/* SMS Status badge */}
                      {notice.sms_sent ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          <Radio size={10} /> Moolre SMS Sent ({notice.sms_count})
                        </span>
                      ) : (
                        <span style={{
                          background: '#F8FAFC',
                          color: '#94A3B8',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          Notice Board Only
                        </span>
                      )}
                    </div>

                    {/* Author & Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>{timeAgo(notice.created_at)}</span>
                      </div>

                      {/* Actions for Coach / Admin */}
                      {isPrivileged && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() => handleTogglePin(notice)}
                            title={notice.is_pinned ? 'Unpin Notice' : 'Pin Notice to Top'}
                            style={{
                              background: notice.is_pinned ? '#FEF3C7' : '#F1F5F9',
                              border: 'none',
                              color: notice.is_pinned ? '#B45309' : '#64748B',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <Pin size={12} />
                          </button>

                          <button
                            onClick={() => handleDeleteNotice(notice)}
                            title="Delete Notice"
                            style={{
                              background: '#FFF1F2',
                              border: 'none',
                              color: '#E11D48',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notice Title */}
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 8, lineHeight: 1.3 }}>
                    {notice.title}
                  </h2>

                  {/* Notice Content */}
                  <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {notice.content}
                  </p>

                  {/* Footer: Posted By */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E2E8F0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
                        {notice.author_name ? notice.author_name[0].toUpperCase() : 'S'}
                      </div>
                      <span>
                        Posted by <strong>{notice.author_name || 'Staff'}</strong> {notice.author_role ? `(${notice.author_role})` : ''}
                      </span>
                    </div>

                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>
                      ID: {notice.id?.slice(0, 8)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── COMPOSE NOTICE MODAL ── */}
        {composeModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: 20,
              width: '100%',
              maxWidth: 540,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #F0FDFA, #FFFFFF)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0F766E', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Publish Squad Notice</h3>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Broadcast to notice board and send Moolre SMS</p>
                  </div>
                </div>
                <button
                  onClick={() => setComposeModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateNotice} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' }}>
                {/* Category & Audience */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0F172A',
                        outline: 'none',
                      }}
                    >
                      <option value="general">General Notice</option>
                      <option value="urgent">Urgent Alert</option>
                      <option value="matchday">Matchday Call-Up</option>
                      <option value="training">Training &amp; Schedule</option>
                      <option value="medical">Medical &amp; Physio</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Target Audience
                    </label>
                    <select
                      value={targetGroup}
                      onChange={e => setTargetGroup(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0F172A',
                        outline: 'none',
                      }}
                    >
                      {TARGET_GROUPS.map(g => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional Session Linker when Training & Schedule category is picked */}
                {category === 'training' && sessions.length > 0 && (
                  <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 10, padding: '10px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      <Calendar size={13} />
                      Link to Scheduled Session (Optional)
                    </label>
                    <select
                      value={selectedSessionId}
                      onChange={e => handleSelectSession(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: '#FFFFFF',
                        border: '1px solid #99F6E4',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0F766E',
                        outline: 'none',
                      }}
                    >
                      <option value="">-- No session linked (General training notice) --</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {s.time} — {s.title} ({s.venue})
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: 10, color: '#0D9488', margin: '4px 0 0 0' }}>
                      Selecting a session automatically aligns notice details with the club schedule.
                    </p>
                  </div>
                )}

                {/* Headline / Title */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Notice Headline *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Matchday Call-Up vs Hearts of Oak / Pitch Venue Update"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      fontSize: 13,
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Body Content */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Notice Message *
                    </label>
                    <span style={{ fontSize: 11, color: content.length > 150 ? '#EF4444' : '#94A3B8', fontWeight: 600 }}>
                      {content.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Write instructions, reporting times, required kit, or critical updates…"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      fontSize: 13,
                      color: '#0F172A',
                      outline: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* SMS Broadcast Box */}
                <div style={{
                  background: sendSms ? '#F0FDF4' : '#F8FAFC',
                  border: `1.5px solid ${sendSms ? '#86EFAC' : '#E2E8F0'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={16} color={sendSms ? '#15803D' : '#64748B'} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: sendSms ? '#166534' : '#334155' }}>
                        Broadcast via Moolre SMS
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendSms}
                      onChange={e => setSendSms(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }}
                    />
                  </div>

                  {sendSms ? (
                    <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.4, borderTop: '1px dashed #BBF7D0', paddingTop: 8 }}>
                      Will immediately deliver to <strong>{eligibleSmsRecipients.length} target players</strong> with registered Ghanaian phone numbers via Moolre VAS gateway.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Notice will only appear in-app on the Notice Board. No SMS credits will be deducted.
                    </div>
                  )}
                </div>

                {/* Pin to top toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Pin size={15} color={isPinned ? '#B45309' : '#64748B'} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Pin this notice to top of board</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={e => setIsPinned(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#D97706', cursor: 'pointer' }}
                  />
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #F1F5F9', paddingTop: 16, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setComposeModal(false)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 10,
                      background: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 2,
                      padding: '11px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      opacity: submitting ? 0.7 : 1,
                      boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
                    }}
                  >
                    <Send size={15} />
                    <span>{submitting ? 'Publishing & Sending SMS…' : 'Publish Notice →'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
