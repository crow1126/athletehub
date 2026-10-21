'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import {
  Heart, HeartOff, FileHeart, Plus, Pencil, Trash2, Check,
  Stethoscope, Eye, Download, Activity, Clock
} from 'lucide-react'
import PhysiotherapyReportModal from '@/components/PhysiotherapyReportModal'
import { buildPhysiotherapyReportPDF } from '@/lib/physioReport'
import { openDownloadWindow, mobileSafeDownload, mobileSafeDownloadIntoWindow } from '@/lib/pdfDownload'

// Roles that can create / edit injury records (medical staff only)
const MEDICAL_ROLES = ['superadmin', 'physio', 'sports_scientist', 'medical']

const SEVERITY_STYLE = {
  Mild:     { bg:'#E8F8EE', color:'#1B7A3E', dot:'#27AE60' },
  Moderate: { bg:'#FEF9E7', color:'#B36200', dot:'#F39C12' },
  Severe:   { bg:'#FDEDEC', color:'#C0392B', dot:'#E74C3C' },
}

function initials(n) { return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

function Avatar({ ath, size = 38 }) {
  const [err, setErr] = useState(false)
  const colors = ['#0D9488', '#2563EB', '#D97706', '#7C3AED', '#E11D48', '#059669']
  const bg = colors[(ath?.name?.charCodeAt(0) || 0) % colors.length]
  if (ath?.photo_url && !err) {
    return (
      <img
        src={ath.photo_url}
        alt={ath.name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E2E8F0' }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.34,
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {initials(ath?.name)}
    </div>
  )
}

function GradeBadge({ grade, severity }) {
  const displayGrade = grade || (severity === 'Severe' ? 'Grade III' : severity === 'Moderate' ? 'Grade II' : 'Grade I')
  const sevKey = displayGrade.includes('III') ? 'Severe' : displayGrade.includes('II') ? 'Moderate' : 'Mild'
  const s = SEVERITY_STYLE[sevKey] || SEVERITY_STYLE.Mild

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: s.bg,
      color: s.color,
      padding: '3px 9px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {displayGrade}
    </span>
  )
}

function StatusBadge({ status, plan }) {
  const isRecovered = status === 'Recovered' || plan?.clinical_plan === 'Discharge / Cleared'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: isRecovered ? '#ECFDF5' : '#FEF2F2',
      color: isRecovered ? '#059669' : '#DC2626',
      border: `1px solid ${isRecovered ? '#A7F3D0' : '#FECACA'}`,
      padding: '3px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRecovered ? '#10B981' : '#EF4444', flexShrink: 0 }} />
      {isRecovered ? 'Cleared / Match Fit' : 'In Rehabilitation'}
    </span>
  )
}

function getActivePhase(diag, isRecovered) {
  if (isRecovered || diag?.clinical_plan === 'Discharge / Cleared') {
    return { title: 'Full Match Clearance', badge: 'Discharged', bg: '#ECFDF5', color: '#059669' }
  }
  if (diag?.phase4?.status === 'In Progress') {
    return { title: 'Phase 4: Return to Sport', badge: 'In Progress', bg: '#FAF5FF', color: '#7E22CE' }
  }
  if (diag?.phase3?.status === 'In Progress') {
    return { title: 'Phase 3: Power & Agility', badge: 'In Progress', bg: '#EFF6FF', color: '#1D4ED8' }
  }
  if (diag?.phase2?.status === 'In Progress') {
    return { title: 'Phase 2: Strength & Control', badge: 'In Progress', bg: '#F0FDFA', color: '#0F766E' }
  }
  if (diag?.phase1?.status === 'In Progress') {
    return { title: 'Phase 1: Protect & Settle', badge: 'In Progress', bg: '#FFFBEB', color: '#B45309' }
  }
  return { title: diag?.phase2?.title || 'Phase 1: Protection & Settle', badge: 'Active', bg: '#F8FAFC', color: '#475569' }
}

function getPainSummary(diag) {
  if (diag?.baseline && Array.isArray(diag.baseline) && diag.baseline.length > 0) {
    const p = diag.baseline[0]?.injured || ''
    if (p) return p.replace(/\s*\|\s*/g, ' · ')
  }
  return 'Pain 1-2/10 controlled'
}

export default function InjuriesPage() {
  const [injuries, setInjuries] = useState([])
  const [athletes, setAthletes] = useState([])
  const [filter, setFilter] = useState('All')
  const [deleting, setDeleting] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [teamId, setTeamId] = useState(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloadingRow, setDownloadingRow] = useState(null)
  const [physioModal, setPhysioModal] = useState({ open: false, athlete: null, injury: null })

  const fetchData = useCallback(async () => {
    const { profile: p, teamId: tid } = await getTenantProfile('id,full_name,role,team_id')
    setCurrentUser(p)
    setTeamId(tid)

    // Determine if user can write based on their role OR their staff_type via the coaches table
    let editAllowed = MEDICAL_ROLES.includes(p?.role)
    if (!editAllowed && p?.id) {
      const { data: staffRow } = await supabase
        .from('coaches').select('staff_type').eq('user_id', p.id).maybeSingle()
      if (staffRow && ['physio', 'sports_scientist', 'medical'].includes(staffRow.staff_type)) {
        editAllowed = true
      }
    }
    setCanEdit(editAllowed)

    const { data: ath } = await scopeTeam(
      supabase.from('athletes').select('id,name,position,photo_url,back_number,nationality,phone,email,status'), tid
    ).order('name')
    setAthletes(ath || [])

    const { data: rows } = await scopeTeam(
      supabase.from('injuries').select('*,athletes(name,position,id,photo_url,back_number,nationality,phone,email,status),logged_profile:logged_by(full_name),updated_profile:updated_by(full_name)'), tid
    ).order('date_of_injury', { ascending: false })
    setInjuries(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleDelete(id) {
    if (!isAdmin) {
      alert('Permission Denied: Only club administrators can permanently delete medical injury records.')
      return
    }
    if (!confirm('Are you sure you want to delete this clinical injury & rehabilitation record? This permanent action is strictly restricted to club administrators.')) return
    setDeleting(id)
    const { error } = await scopeTeam(supabase.from('injuries').delete().eq('id', id), teamId)
    if (error) alert('Delete failed: ' + error.message)
    else fetchData()
    setDeleting(null)
  }

  async function markRecovered(id, athleteId) {
    const update = {
      status: 'Recovered',
      updated_by: currentUser?.id || null,
      updated_at: new Date().toISOString()
    }
    await scopeTeam(supabase.from('injuries').update(update).eq('id', id), teamId)
    await scopeTeam(supabase.from('athletes').update({ status: 'Active' }).eq('id', athleteId), teamId)
    fetchData()
  }

  async function handleDownloadRowPDF(inj) {
    const ath = inj.athletes || athletes.find(a => a.id === inj.athlete_id) || { name: 'Athlete', position: 'Player' }
    setDownloadingRow(inj.id)
    const isDesktop = typeof window !== 'undefined' && !(/iphone|ipad|ipod|android/i.test(navigator.userAgent || ''))
    const win = isDesktop ? openDownloadWindow(`Physiotherapy Report — ${ath.name}`) : null

    try {
      const diag = inj.diagnosis_data || {}
      const meta = {
        clubName: ath.club || currentUser?.club_name || 'ApexTrack Football Club',
        clubLogoUrl: currentUser?.club_logo_url || null,
        generatedBy: inj.updated_profile?.full_name || inj.logged_profile?.full_name || currentUser?.full_name || 'Physiotherapist',
        generatedAt: inj.updated_at || inj.logged_at || new Date().toISOString(),
      }

      const doc = await buildPhysiotherapyReportPDF({
        athlete: ath,
        injury: inj,
        rehabNotes: [],
        customPlan: Object.keys(diag).length > 0 ? diag : null,
        meta,
        period: `${new Date().getFullYear()} Season`,
      })

      const safeAthlete = (ath.name || 'Athlete').replace(/\s+/g, '_')
      const filename = `${safeAthlete}_Physiotherapy_Rehab_Plan_${new Date().toISOString().slice(0, 10)}.pdf`

      if (win) {
        await mobileSafeDownloadIntoWindow(win, doc, filename)
      } else {
        await mobileSafeDownload(doc, filename)
      }
    } catch (err) {
      if (win) try { win.close() } catch {}
      alert('Failed to generate PDF: ' + err.message)
    } finally {
      setDownloadingRow(null)
    }
  }

  const fmtDate = d => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtDateTime = d => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const userRole = currentUser?.role || 'staff'
  const isPhysio = userRole === 'physio' || userRole === 'superadmin' || currentUser?.staff_type === 'physio' || currentUser?.staff_type === 'medical' || currentUser?.staff_type === 'sports_scientist'
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  const isAdminReadOnly = userRole === 'admin'

  const activeCnt = injuries.filter(i => i.status === 'Active').length
  const recovCnt = injuries.filter(i => i.status === 'Recovered').length

  const filtered = filter === 'All'
    ? injuries
    : filter === 'Active'
    ? injuries.filter(i => i.status === 'Active')
    : injuries.filter(i => i.status === 'Recovered')

  return (
    <>
      <Layout>
        <div className="page-outer">

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0D9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Medical &amp; Physiotherapy Department
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                Sports Injury Diagnosis &amp; Rehabilitation Hub
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0', fontWeight: 500 }}>
                Individual Physiotherapy Reports · 9-section clinical framework · Phase progressions &amp; clearance.
                {!canEdit && (
                  <span style={{ marginLeft: 8, background: '#F1F5F9', color: '#64748B', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    Read Only
                  </span>
                )}
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => setPhysioModal({ open: true, athlete: null, injury: null })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
                  fontFamily: 'var(--font)',
                }}
              >
                <Plus size={16} />
                <span>+ Log Injury &amp; Rehabilitation Plan</span>
              </button>
            )}
          </div>

          {/* Admin read-only notice */}
          {isAdminReadOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#0369A1', fontSize: 13, fontWeight: 600 }}>
              <Eye size={16} style={{ flexShrink: 0 }} />
              <span><strong>View-Only Mode</strong> — Clinical diagnosis and rehabilitation plans are managed by physiotherapy staff. You can view, download official PDF reports, and manage records.</span>
            </div>
          )}

          {/* ── Stat Counters ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Clinical Plans', value: injuries.length, icon: <FileHeart size={16} color="#0D9488" />, color: '#0D9488', bg: '#F0FDFA' },
              { label: 'In Rehabilitation', value: activeCnt, icon: <HeartOff size={16} color="#E11D48" />, color: '#E11D48', bg: '#FFF1F2' },
              { label: 'Cleared / Match Ready', value: recovCnt, icon: <Heart size={16} color="#059669" />, color: '#059669', bg: '#ECFDF5' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', minWidth: 140 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter Buttons ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[
              { id: 'All', label: `All Plans (${injuries.length})` },
              { id: 'Active', label: `In Rehabilitation (${activeCnt})` },
              { id: 'Recovered', label: `Cleared / Match Ready (${recovCnt})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '7px 16px',
                  background: filter === f.id ? (f.id === 'Active' ? 'linear-gradient(135deg,#BE123C,#E11D48)' : '#0D9488') : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: filter === f.id ? '#fff' : 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Unified Injury & Rehabilitation Plans Table ── */}
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading clinical records…</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', borderRadius: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Stethoscope size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No injury &amp; rehabilitation records found</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {canEdit ? 'Use the "+ Log Injury & Rehabilitation Plan" button above to document an athlete\'s diagnosis and 9-section plan.' : 'All athletes currently have a clean medical bill of health.'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden', padding: 0, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1.6fr 1.2fr 1.1fr 1.1fr 130px',
                background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
                padding: '12px 18px',
                gap: 12,
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                <div>Athlete</div>
                <div>Diagnosis &amp; Stage</div>
                <div>Current Rehab Phase</div>
                <div>Baseline Pain</div>
                <div>Clearance Status</div>
                <div>Dates &amp; Review</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>

              {/* Rows */}
              {filtered.map((inj, idx) => {
                const ath = inj.athletes || athletes.find(a => a.id === inj.athlete_id) || { name: '—', position: 'Player' }
                const diag = inj.diagnosis_data || {}
                const isAct = inj.status === 'Active'
                const isRecovered = inj.status === 'Recovered' || diag.clinical_plan === 'Discharge / Cleared'
                const structure = diag.structure_and_side || inj.injury_type || 'Unspecified Injury'
                const phase = getActivePhase(diag, isRecovered)
                const pain = getPainSummary(diag)
                const isLast = idx === filtered.length - 1

                return (
                  <div
                    key={inj.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 2fr 1.6fr 1.2fr 1.1fr 1.1fr 130px',
                      alignItems: 'center',
                      padding: '14px 18px',
                      gap: 12,
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      borderLeft: `3px solid ${isRecovered ? '#10B981' : '#E11D48'}`,
                      background: 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* 1. Athlete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar ath={ath} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ath.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          #{ath.back_number || '—'} · {ath.position || 'Player'}
                        </div>
                      </div>
                    </div>

                    {/* 2. Diagnosis & Stage */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={structure}>
                        {structure}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <GradeBadge grade={diag.grade} severity={inj.severity} />
                        <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                          {diag.stage || 'Sub-acute'}
                        </span>
                      </div>
                    </div>

                    {/* 3. Current Rehab Phase */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: phase.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Activity size={12} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{phase.title}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                        {diag.phase2?.duration || 'Weeks 2 to 4'}
                      </div>
                    </div>

                    {/* 4. Baseline Pain */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        {pain}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                        Rest / Activity Score
                      </div>
                    </div>

                    {/* 5. Clearance Status */}
                    <div>
                      <StatusBadge status={inj.status} plan={diag} />
                    </div>

                    {/* 6. Dates & Review */}
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>
                        Injured: {fmtDate(inj.date_of_injury)}
                      </div>
                      <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 700, marginTop: 2 }}>
                        Review: {fmtDate(diag.review_date || inj.expected_return)}
                      </div>
                    </div>

                    {/* 7. Actions */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {/* Edit / Update Clinical Plan */}
                      {canEdit && (
                        <button
                          onClick={() => setPhysioModal({ open: true, athlete: ath, injury: inj })}
                          title="Edit Clinical Diagnosis & Rehabilitation Plan"
                          style={{
                            background: '#F0FDFA',
                            color: '#0D9488',
                            border: '1px solid #CCFBF1',
                            borderRadius: 7,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      )}

                      {/* Download Official PDF Dossier */}
                      <button
                        onClick={() => handleDownloadRowPDF(inj)}
                        disabled={downloadingRow === inj.id}
                        title="Download 9-Section Physiotherapy Report PDF (Desktop Preview)"
                        style={{
                          background: '#EFF6FF',
                          color: '#2563EB',
                          border: '1px solid #BFDBFE',
                          borderRadius: 7,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: downloadingRow === inj.id ? 0.6 : 1,
                        }}
                      >
                        <Download size={13} />
                      </button>

                      {/* Quick Mark Recovered / Clear Player */}
                      {canEdit && isAct && (
                        <button
                          onClick={() => markRecovered(inj.id, inj.athlete_id)}
                          title="Clear Player & Return to Match Play"
                          style={{
                            background: '#ECFDF5',
                            color: '#059669',
                            border: '1px solid #A7F3D0',
                            borderRadius: 7,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Check size={13} />
                        </button>
                      )}

                      {/* Delete (Admin only) */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(inj.id)}
                          disabled={deleting === inj.id}
                          title="Permanently Delete Clinical Record (Admin Only)"
                          style={{
                            background: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            borderRadius: 7,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: deleting === inj.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Clinician Documentation Note Footer */}
          <div style={{ marginTop: 20, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stethoscope size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Unified Clinical Documentation
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                  Every logged case contains the official 9-section diagnostic &amp; rehabilitation protocol. Updates automatically sync to athlete matchday eligibility and official PDF dossiers.
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 700 }}>
              Official ApexTrack GH Medical Engine
            </div>
          </div>
        </div>
      </Layout>

      {/* ── Unified 9-Section Sports Injury Diagnosis & Rehabilitation Plan Modal ── */}
      {physioModal.open && (
        <PhysiotherapyReportModal
          isOpen={physioModal.open}
          onClose={() => setPhysioModal({ open: false, athlete: null, injury: null })}
          athlete={physioModal.athlete}
          athletes={athletes}
          injury={physioModal.injury}
          rehabNotes={[]}
          teamId={teamId}
          currentUser={currentUser}
          onSaved={fetchData}
        />
      )}
    </>
  )
}
