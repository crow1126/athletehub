'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { scopeTeam } from '@/lib/tenant'
import {
  HeartPulse, Plus, Lock, ShieldCheck, Calendar, Activity,
  AlertCircle, CheckCircle2, ChevronRight, Filter, Search,
  Edit3, Trash2, X, Check, FileText, User, Sparkles, ArrowRight
} from 'lucide-react'

const REHAB_PHASES = [
  'Phase 1 - Acute Protection & Symptom Reduction',
  'Phase 2 - Early Mobility, Activation & Strength',
  'Phase 3 - Progressive Loading & Pitch Running',
  'Phase 4 - Sport-Specific Drills & Agility',
  'Phase 5 - Return to Team Training Clearance',
]

const CLEARANCE_STATUSES = [
  { label: 'In Rehab', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
  { label: 'Restricted Training', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  { label: 'Modified Drills', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { label: 'Full Match Clearance', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
]

const EMPTY_FORM = {
  athlete_id: '',
  injury_id: '',
  session_date: new Date().toISOString().split('T')[0],
  rehab_phase: 'Phase 1 - Acute Protection & Symptom Reduction',
  pain_level: 2,
  treatment_summary: '',
  clinical_notes: '',
  target_milestone: '',
  clearance_status: 'In Rehab',
}

const LOCAL_STORAGE_KEY = 'apextrack_rehab_notes_fallback'

export default function RehabilitationNotes({
  currentUser,
  teamId,
  athleteIdFilter = null,
  compact = false,
  title = 'Rehabilitation Notes',
}) {
  const [notes, setNotes] = useState([])
  const [athletes, setAthletes] = useState([])
  const [injuries, setInjuries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedAthleteId, setSelectedAthleteId] = useState(athleteIdFilter || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNoteId, setExpandedNoteId] = useState(null)

  // Strict role checking
  const userRole = currentUser?.role || 'staff'
  const isPhysio = userRole === 'physio' || userRole === 'superadmin' || currentUser?.staff_type === 'physio' || currentUser?.staff_type === 'medical' || currentUser?.staff_type === 'sports_scientist'
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isAuthorized = isPhysio || isAdmin

  const fetchNotes = useCallback(async () => {
    if (!isAuthorized || !teamId) {
      setLoading(false)
      return
    }

    try {
      // Fetch Athletes & Injuries for dropdowns/labels
      const [{ data: athData }, { data: injData }] = await Promise.all([
        scopeTeam(supabase.from('athletes').select('id, name, position, photo_url, club, status'), teamId).order('name'),
        scopeTeam(supabase.from('injuries').select('id, athlete_id, injury_type, severity, status, expected_return'), teamId)
      ])

      setAthletes(athData || [])
      setInjuries(injData || [])

      // Try fetching from Supabase table
      let query = scopeTeam(
        supabase.from('rehabilitation_notes')
          .select('*, athletes(id, name, position, photo_url, club), injuries(id, injury_type, severity)'),
        teamId
      ).order('session_date', { ascending: false }).order('created_at', { ascending: false })

      if (athleteIdFilter) {
        query = query.eq('athlete_id', athleteIdFilter)
      }

      const { data: dbNotes, error } = await query

      // Read local storage cache
      let localNotes = []
      try {
        const raw1 = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${teamId}`)
        const raw2 = localStorage.getItem(LOCAL_STORAGE_KEY)
        const parsed1 = raw1 ? JSON.parse(raw1) : []
        const parsed2 = raw2 ? JSON.parse(raw2) : []
        localNotes = [...parsed1, ...parsed2]
        if (athleteIdFilter) {
          localNotes = localNotes.filter(n => n.athlete_id === athleteIdFilter)
        }
      } catch {
        localNotes = []
      }

      // Merge dbNotes and localNotes
      const combined = [...(dbNotes || [])]
      for (const ln of localNotes) {
        if (!combined.some(cn => cn.id === ln.id || (cn.athlete_id === ln.athlete_id && cn.session_date === ln.session_date && cn.treatment_summary === ln.treatment_summary))) {
          combined.push(ln)
        }
      }

      combined.sort((a, b) => new Date(b.session_date || b.created_at || 0) - new Date(a.session_date || a.created_at || 0))
      setNotes(combined)
    } catch (err) {
      console.error('Failed to load rehab notes:', err)
    } finally {
      setLoading(false)
    }
  }, [teamId, athleteIdFilter, isAuthorized])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // If user is not physio and not admin, DO NOT RENDER ANYTHING (must not be seen by other staff)
  if (!isAuthorized) {
    return null
  }

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleOpenAdd = (presetAthleteId = null) => {
    if (!isPhysio) return
    setEditId(null)
    setForm({
      ...EMPTY_FORM,
      athlete_id: presetAthleteId || athleteIdFilter || (athletes[0]?.id || ''),
      injury_id: injuries.find(i => i.athlete_id === (presetAthleteId || athleteIdFilter))?.id || '',
    })
    setShowModal(true)
  }

  const handleOpenEdit = (n) => {
    if (!isPhysio) return
    setEditId(n.id)
    setForm({
      athlete_id: n.athlete_id,
      injury_id: n.injury_id || '',
      session_date: n.session_date,
      rehab_phase: n.rehab_phase || REHAB_PHASES[0],
      pain_level: n.pain_level ?? 0,
      treatment_summary: n.treatment_summary || '',
      clinical_notes: n.clinical_notes || '',
      target_milestone: n.target_milestone || '',
      clearance_status: n.clearance_status || 'In Rehab',
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isPhysio) return
    if (!form.athlete_id) {
      alert('Please select an athlete.')
      return
    }
    if (!form.treatment_summary.trim() || !form.clinical_notes.trim()) {
      alert('Treatment summary and clinical notes are required.')
      return
    }

    setSaving(true)
    const ath = athletes.find(a => a.id === form.athlete_id)
    const inj = injuries.find(i => i.id === form.injury_id)

    const payload = {
      team_id: teamId,
      athlete_id: form.athlete_id,
      injury_id: form.injury_id || null,
      session_date: form.session_date,
      rehab_phase: form.rehab_phase,
      pain_level: Number(form.pain_level) || 0,
      treatment_summary: form.treatment_summary.trim(),
      clinical_notes: form.clinical_notes.trim(),
      target_milestone: form.target_milestone.trim() || null,
      clearance_status: form.clearance_status,
      author_id: currentUser?.id || null,
      author_name: currentUser?.full_name || 'Team Physio',
      author_role: userRole,
      updated_at: new Date().toISOString(),
    }

    try {
      let savedSuccessfully = false
      if (editId) {
        const { error } = await scopeTeam(
          supabase.from('rehabilitation_notes').update(payload).eq('id', editId),
          teamId
        )
        if (!error) savedSuccessfully = true
      } else {
        payload.created_at = new Date().toISOString()
        const { error } = await supabase.from('rehabilitation_notes').insert([payload])
        if (!error) savedSuccessfully = true
      }

      if (!savedSuccessfully) {
        // Fallback update to localStorage
        const storageKey = `${LOCAL_STORAGE_KEY}_${teamId}`
        let localNotes = []
        try {
          localNotes = JSON.parse(localStorage.getItem(storageKey) || '[]')
        } catch {
          localNotes = []
        }

        if (editId) {
          localNotes = localNotes.map(item => item.id === editId ? {
            ...item,
            ...payload,
            athletes: ath ? { id: ath.id, name: ath.name, position: ath.position, photo_url: ath.photo_url } : item.athletes,
            injuries: inj ? { id: inj.id, injury_type: inj.injury_type, severity: inj.severity } : item.injuries
          } : item)
        } else {
          const newNote = {
            ...payload,
            id: `local_${Date.now()}`,
            athletes: ath ? { id: ath.id, name: ath.name, position: ath.position, photo_url: ath.photo_url } : null,
            injuries: inj ? { id: inj.id, injury_type: inj.injury_type, severity: inj.severity } : null
          }
          localNotes.unshift(newNote)
        }
        localStorage.setItem(storageKey, JSON.stringify(localNotes))
      }

      setShowModal(false)
      fetchNotes()
    } catch (err) {
      console.error('Error saving rehab note:', err)
      alert('Failed to save rehabilitation note.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId) => {
    if (!isPhysio) return
    if (!confirm('Are you sure you want to delete this confidential rehabilitation note?')) return

    try {
      const { error } = await scopeTeam(supabase.from('rehabilitation_notes').delete().eq('id', noteId), teamId)
      if (error) {
        const storageKey = `${LOCAL_STORAGE_KEY}_${teamId}`
        let localNotes = JSON.parse(localStorage.getItem(storageKey) || '[]')
        localNotes = localNotes.filter(n => n.id !== noteId)
        localStorage.setItem(storageKey, JSON.stringify(localNotes))
      }
      fetchNotes()
    } catch (err) {
      console.error('Error deleting rehab note:', err)
    }
  }

  // Filter notes
  const filteredNotes = notes.filter(n => {
    if (selectedAthleteId !== 'all' && n.athlete_id !== selectedAthleteId) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const athName = n.athletes?.name || ''
      const summary = n.treatment_summary || ''
      const notesTxt = n.clinical_notes || ''
      const phase = n.rehab_phase || ''
      if (!athName.toLowerCase().includes(q) && !summary.toLowerCase().includes(q) && !notesTxt.toLowerCase().includes(q) && !phase.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  // Get pain level styling
  const getPainBadge = (pain) => {
    if (pain === 0) return { label: '0 / 10 (Pain Free)', bg: '#ECFDF5', color: '#059669', dot: '#10B981' }
    if (pain <= 3) return { label: `${pain} / 10 (Mild)`, bg: '#F0FDFA', color: '#0F766E', dot: '#14B8A6' }
    if (pain <= 6) return { label: `${pain} / 10 (Moderate)`, bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' }
    return { label: `${pain} / 10 (High Pain)`, bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' }
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1.5px solid #CCFBF1',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(13, 148, 136, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 100%)',
        borderBottom: '1px solid #CCFBF1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0F766E, #0D9488)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 10px rgba(13, 148, 136, 0.25)',
            flexShrink: 0,
          }}>
            <HeartPulse size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                {title}
              </h3>
              {isPhysio ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  background: '#CCFBF1',
                  color: '#0F766E',
                  padding: '2px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <Activity size={12} /> Physio Lead (Write Access)
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  background: '#FEF3C7',
                  color: '#B45309',
                  padding: '2px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <Lock size={11} /> Admin Read-Only
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: 500 }}>
              Confidential medical progress, exercise loading, pain scales &amp; return-to-play clearance.
            </div>
          </div>
        </div>

        {/* Action button */}
        {isPhysio && (
          <button
            onClick={() => handleOpenAdd()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #0F766E, #0D9488)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Rehab Note</span>
          </button>
        )}
      </div>

      {/* ── Filters (when not filtered by single athlete) ── */}
      {!athleteIdFilter && (
        <div style={{
          padding: '10px 18px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
            <Search size={14} color="#94A3B8" />
            <input
              type="text"
              placeholder="Search by player, notes, or rehab phase…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                color: '#0F172A',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="#64748B" />
            <select
              value={selectedAthleteId}
              onChange={e => setSelectedAthleteId(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontWeight: 600,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <option value="all">All Athletes ({notes.length})</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Notes Content List ── */}
      <div style={{ padding: compact ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Loading rehabilitation logs…
          </div>
        ) : filteredNotes.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: '#F8FAFC',
            borderRadius: 12,
            border: '1px dashed #CBD5E1',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#F0FDFA',
              color: '#0D9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
            }}>
              <FileText size={22} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
              No rehabilitation notes recorded yet
            </div>
            <div style={{ fontSize: 12, color: '#64748B', maxWidth: 360, margin: '0 auto 12px' }}>
              {isPhysio
                ? 'Document player recovery milestones, pain monitoring, gym & pitch protocols, and return-to-play clearance.'
                : 'Physiotherapist has not logged any rehabilitation records for this selection yet.'}
            </div>
            {isPhysio && (
              <button
                onClick={() => handleOpenAdd()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#0D9488',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Record First Rehab Session
              </button>
            )}
          </div>
        ) : (
          filteredNotes.map((n) => {
            const painStyle = getPainBadge(n.pain_level)
            const clearanceObj = CLEARANCE_STATUSES.find(c => c.label === n.clearance_status) || CLEARANCE_STATUSES[0]
            const isExpanded = expandedNoteId === n.id || !compact

            return (
              <div
                key={n.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '14px 16px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}
              >
                {/* Top note header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {n.athletes?.photo_url ? (
                      <img
                        src={n.athletes.photo_url}
                        alt={n.athletes?.name || 'Athlete'}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #CCFBF1' }}
                      />
                    ) : (
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: '#0F766E',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                      }}>
                        {(n.athletes?.name || 'A').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                          {n.athletes?.name || 'Athlete'}
                        </span>
                        {n.athletes?.position && (
                          <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            {n.athletes.position}
                          </span>
                        )}
                        {n.injuries?.injury_type && (
                          <span style={{ fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {n.injuries.injury_type}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          <Calendar size={11} /> {new Date(n.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span>•</span>
                        <span>Logged by <strong>{n.author_name || 'Physio'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      background: painStyle.bg,
                      color: painStyle.color,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: `1px solid ${painStyle.color}30`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: painStyle.dot }} />
                      Pain: {painStyle.label}
                    </span>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      background: clearanceObj.bg,
                      color: clearanceObj.color,
                      border: `1px solid ${clearanceObj.border}`,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}>
                      {clearanceObj.label}
                    </span>

                    {isPhysio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                        <button
                          onClick={() => handleOpenEdit(n)}
                          title="Edit note"
                          style={{ background: '#F1F5F9', border: 'none', color: '#475569', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          title="Delete note"
                          style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase Banner */}
                <div style={{
                  marginTop: 10,
                  padding: '6px 10px',
                  background: '#F0FDFA',
                  border: '1px solid #CCFBF1',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0F766E',
                }}>
                  <Activity size={13} />
                  <span>{n.rehab_phase}</span>
                </div>

                {/* Treatment & Clinical Details */}
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                      Treatment &amp; Protocols Applied
                    </div>
                    <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.5, fontWeight: 600 }}>
                      {n.treatment_summary}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                      Clinical Notes &amp; Observations
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {n.clinical_notes}
                    </div>
                  </div>

                  {n.target_milestone && (
                    <div style={{
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      color: '#92400E',
                    }}>
                      <CheckCircle2 size={14} color="#D97706" style={{ flexShrink: 0 }} />
                      <div>
                        <strong>Next Milestone Target:</strong> {n.target_milestone}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Add / Edit Modal (Physio Exclusive) ── */}
      {showModal && isPhysio && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 18,
            maxWidth: 620,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              background: 'linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0F766E', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HeartPulse size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {editId ? 'Edit Rehabilitation Note' : 'Record Rehabilitation Session'}
                  </h3>
                  <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 600 }}>
                    Physio Clinical Assessment &amp; Return-to-Play Tracking
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Select Athlete *
                  </label>
                  <select
                    value={form.athlete_id}
                    onChange={e => {
                      const aid = e.target.value
                      setField('athlete_id', aid)
                      const matchingInj = injuries.find(i => i.athlete_id === aid)
                      if (matchingInj) setField('injury_id', matchingInj.id)
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      fontWeight: 600,
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select player…</option>
                    {athletes.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.position || 'Player'}) {a.status === 'Injured' ? '⚠️ Injured' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Session Date *
                  </label>
                  <input
                    type="date"
                    value={form.session_date}
                    onChange={e => setField('session_date', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      fontWeight: 600,
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Rehab Phase */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Current Rehabilitation Phase *
                </label>
                <select
                  value={form.rehab_phase}
                  onChange={e => setField('rehab_phase', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                >
                  {REHAB_PHASES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Pain Level & Clearance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Pain Scale (0 - 10): <strong>{form.pain_level} / 10</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={form.pain_level}
                    onChange={e => setField('pain_level', e.target.value)}
                    style={{ width: '100%', accentColor: '#0D9488' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8' }}>
                    <span>0 (No Pain)</span>
                    <span>5 (Moderate)</span>
                    <span>10 (Severe)</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    Clearance Status
                  </label>
                  <select
                    value={form.clearance_status}
                    onChange={e => setField('clearance_status', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      fontWeight: 600,
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  >
                    {CLEARANCE_STATUSES.map(c => (
                      <option key={c.label} value={c.label}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Treatment Summary */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Treatment &amp; Protocols Performed *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cryotherapy + isometric quadriceps activation + 15min stationary bike"
                  value={form.treatment_summary}
                  onChange={e => setField('treatment_summary', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Detailed Clinical Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Clinical Notes &amp; Observations *
                </label>
                <textarea
                  rows={4}
                  placeholder="Swelling reduced by 50%. Full knee extension achieved with zero discomfort. Tolerated 70% bodyweight single-leg press. Recommended to begin light straight-line pitch jogs on Thursday."
                  value={form.clinical_notes}
                  onChange={e => setField('clinical_notes', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Next Milestone Target */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Target Milestone / Next Goal
                </label>
                <input
                  type="text"
                  placeholder="e.g. Complete 5x50m shuttle sprints at 80% intensity with 0/10 pain"
                  value={form.target_milestone}
                  onChange={e => setField('target_milestone', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
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
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.3)',
                  }}
                >
                  {saving ? 'Saving Note…' : editId ? 'Update Note' : 'Save Rehabilitation Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
