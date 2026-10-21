'use client'

import { useState, useEffect } from 'react'
import {
  X, Check, Download, Stethoscope, Save,
  AlertTriangle, Shield, Activity, Calendar, User, FileText,
  ChevronRight, Sparkles, Plus, Trash2, ArrowRight, Printer
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { scopeTeam } from '@/lib/tenant'
import { DEFAULT_PHYSIO_TEMPLATE, buildPhysiotherapyReportPDF } from '@/lib/physioReport'
import { mobileSafeDownload, openDownloadWindow, mobileSafeDownloadIntoWindow } from '@/lib/pdfDownload'

export default function PhysiotherapyReportModal({
  isOpen,
  onClose,
  athlete,
  injury = null,
  rehabNotes = [],
  teamId,
  currentUser,
}) {
  const [plan, setPlan] = useState(DEFAULT_PHYSIO_TEMPLATE)
  const [activeSection, setActiveSection] = useState('1')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load plan data on open
  useEffect(() => {
    if (!isOpen || !athlete) return

    async function loadPlan() {
      // 1. Start from default template
      let merged = {
        ...DEFAULT_PHYSIO_TEMPLATE,
        therapist_name: currentUser?.full_name || currentUser?.name || DEFAULT_PHYSIO_TEMPLATE.therapist_name,
        report_date: new Date().toISOString().split('T')[0],
      }

      // 2. Pre-fill from active injury
      if (injury) {
        if (injury.injury_type) merged.structure_and_side = injury.injury_type
        if (injury.severity) {
          merged.grade = injury.severity === 'Severe' ? 'Grade III' : (injury.severity === 'Moderate' ? 'Grade II' : 'Grade I')
        }
        if (injury.date_of_injury) merged.date_of_injury = injury.date_of_injury
        if (injury.notes) merged.clinical_impression = injury.notes
      }

      // 3. Pre-fill from latest rehab note
      if (rehabNotes && rehabNotes.length > 0) {
        const latest = rehabNotes[0]
        if (latest.pain_level !== undefined) {
          merged.baseline[0].injured = `Pain: ${latest.pain_level}/10`
        }
        if (latest.treatment_summary) {
          merged.phase2.exercises = latest.treatment_summary
        }
        if (latest.clinical_notes) {
          merged.status_against_goals = latest.clinical_notes
        }
      }

      // 4. Check localStorage fallback
      try {
        const local = localStorage.getItem(`apextrack_physio_plan_${athlete.id}`)
        if (local) {
          const parsed = JSON.parse(local)
          merged = { ...merged, ...parsed }
        }
      } catch (_e) {}

      // 5. Try fetching from Supabase physiotherapy_plans
      if (teamId && athlete.id) {
        try {
          const { data: dbPlan } = await scopeTeam(
            supabase.from('physiotherapy_plans')
              .select('*')
              .eq('athlete_id', athlete.id)
              .order('report_date', { ascending: false })
              .limit(1)
              .maybeSingle(),
            teamId
          )
          if (dbPlan && dbPlan.plan_data) {
            merged = { ...merged, ...dbPlan.plan_data }
          }
        } catch (_err) {
          // Fallback gracefully to merged plan
        }
      }

      setPlan(merged)
    }

    loadPlan()
  }, [isOpen, athlete, injury, rehabNotes, teamId, currentUser])

  if (!isOpen || !athlete) return null

  const updateField = (key, val) => setPlan(prev => ({ ...prev, [key]: val }))

  const updatePhase = (phaseKey, field, val) => {
    setPlan(prev => ({
      ...prev,
      [phaseKey]: {
        ...prev[phaseKey],
        [field]: val,
      }
    }))
  }

  const updateBaseline = (idx, field, val) => {
    setPlan(prev => {
      const next = [...prev.baseline]
      next[idx] = { ...next[idx], [field]: val }
      return { ...prev, baseline: next }
    })
  }

  const updateHEP = (idx, field, val) => {
    setPlan(prev => {
      const next = [...prev.hep]
      next[idx] = { ...next[idx], [field]: val }
      return { ...prev, hep: next }
    })
  }

  const addHEPRow = () => {
    setPlan(prev => ({
      ...prev,
      hep: [
        ...prev.hep,
        { exercise: 'New Prescribed Exercise', sets_reps: '3 sets x 10 reps', frequency: 'Daily', precautions: 'Monitor pain tolerance' }
      ]
    }))
  }

  const deleteHEPRow = (idx) => {
    setPlan(prev => ({
      ...prev,
      hep: prev.hep.filter((_, i) => i !== idx)
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)
    try {
      // 1. Cache to localStorage for instant local retrieval
      localStorage.setItem(`apextrack_physio_plan_${athlete.id}`, JSON.stringify(plan))

      // 2. Save to Supabase physiotherapy_plans table if available
      if (teamId) {
        try {
          await supabase.from('physiotherapy_plans').insert([{
            team_id: teamId,
            athlete_id: athlete.id,
            injury_id: injury?.id || null,
            report_date: plan.report_date || new Date().toISOString().split('T')[0],
            plan_data: plan,
            author_id: currentUser?.id || null,
            author_name: currentUser?.full_name || currentUser?.name || 'Physiotherapist',
            author_role: currentUser?.role || 'physio',
          }])
        } catch (_dbErr) {
          // table might not exist yet; cached in localStorage
        }
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      alert('Failed saving plan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadPDF() {
    setDownloading(true)
    const isDesktop = typeof window !== 'undefined' && !(/iphone|ipad|ipod|android/i.test(navigator.userAgent || ''))
    const win = isDesktop ? openDownloadWindow(`Physiotherapy Report — ${athlete.name}`) : null

    try {
      const meta = {
        clubName: athlete.club || currentUser?.club_name || 'ApexTrack Football Club',
        clubLogoUrl: currentUser?.club_logo_url || null,
        generatedBy: currentUser?.full_name || plan.therapist_name || 'Physiotherapist',
        generatedAt: plan.report_date || new Date().toISOString(),
      }

      const doc = await buildPhysiotherapyReportPDF({
        athlete,
        injury: injury || { injury_type: plan.structure_and_side, severity: plan.grade, date_of_injury: plan.date_of_injury, notes: plan.clinical_impression },
        rehabNotes,
        customPlan: plan,
        meta,
        period: `${new Date().getFullYear()} Season`,
      })

      const safeAthlete = (athlete.name || 'Athlete').replace(/\s+/g, '_')
      const filename = `${safeAthlete}_Physiotherapy_Rehab_Plan_${new Date().toISOString().slice(0, 10)}.pdf`

      if (win) {
        await mobileSafeDownloadIntoWindow(win, doc, filename)
      } else {
        await mobileSafeDownload(doc, filename)
      }
    } catch (err) {
      if (win) try { win.close() } catch {}
      alert('Error generating PDF report: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const SECTIONS = [
    { id: '1', label: '1. Patient Details' },
    { id: '2', label: '2. Injury Diagnosis' },
    { id: '3', label: '3. Baseline Assessment' },
    { id: '4', label: '4. Goals' },
    { id: '5', label: '5. Rehab Plan (4 Phases)' },
    { id: '6', label: '6. Prevention' },
    { id: '7', label: '7. Home Exercises' },
    { id: '8', label: '8. Review' },
    { id: '9', label: '9. Sign-off' },
  ]

  const inp = {
    width: '100%',
    padding: '9px 12px',
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  }
  const lbl = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#475569',
    marginBottom: 4,
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: 960,
        height: '92vh',
        borderRadius: 20,
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}>
        {/* Modal Top Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #134E4A 100%)',
          color: '#FFFFFF',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #0D9488',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'rgba(13, 148, 136, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(45, 212, 191, 0.4)',
            }}>
              <Stethoscope size={22} color="#2DD4BF" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#2DD4BF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                SPORTS INJURY DIAGNOSIS AND REHABILITATION PLAN
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 0', letterSpacing: '-0.01em' }}>
                Individual Physiotherapy Report: {athlete.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saveSuccess && (
              <span style={{ fontSize: 12, color: '#2DD4BF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={14} /> Saved!
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 8,
                padding: '8px 14px',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Plan'}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #0D9488, #0F766E)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
              }}
            >
              <Download size={14} /> {downloading ? 'Preparing PDF…' : 'Open & Download PDF (Desktop)'}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div style={{
          display: 'flex',
          background: '#F1F5F9',
          borderBottom: '1px solid #E2E8F0',
          overflowX: 'auto',
          padding: '4px 12px',
          gap: 4,
        }}>
          {SECTIONS.map(s => {
            const isAct = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: isAct ? '#0D9488' : 'transparent',
                  color: isAct ? '#FFFFFF' : '#475569',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* ── SECTION 1: Patient Details ── */}
          {activeSection === '1' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                {athlete.photo_url ? (
                  <img src={athlete.photo_url} alt={athlete.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0D9488' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0D9488', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>
                    {(athlete.name || 'A').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0F172A' }}>{athlete.name}</h3>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Squad #{athlete.back_number || '—'} · {athlete.position || 'Player'} · {athlete.nationality || 'Ghana'}
                  </div>
                  <div style={{ fontSize: 12, color: '#0D9488', fontWeight: 700, marginTop: 4 }}>
                    Current Status: {athlete.status === 'Injured' ? 'In Rehabilitation' : 'Cleared / Active'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label style={lbl}>Sport &amp; Position</label>
                  <input style={inp} value={`Football · ${athlete.position || 'Player'}`} readOnly />
                </div>
                <div>
                  <label style={lbl}>Athlete Level</label>
                  <select style={inp} value={plan.level} onChange={e => updateField('level', e.target.value)}>
                    <option value="Club / Elite">Club / Elite (Ghana Premier / Division 1)</option>
                    <option value="Semi-Professional">Semi-Professional</option>
                    <option value="Youth Academy">Youth Academy</option>
                    <option value="Recreational">Recreational</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Date of Report</label>
                  <input type="date" style={inp} value={plan.report_date} onChange={e => updateField('report_date', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Referred By</label>
                  <input style={inp} value={plan.referred_by} onChange={e => updateField('referred_by', e.target.value)} placeholder="e.g. Head Coach / Team Doctor" />
                </div>
                <div>
                  <label style={lbl}>Patient ID / Contact</label>
                  <input style={inp} value={`${athlete.phone || ''} ${athlete.email ? `(${athlete.email})` : ''}`} readOnly />
                </div>
                <div>
                  <label style={lbl}>Age / Sex</label>
                  <input style={inp} value={`${athlete.age ? `${athlete.age} yrs` : '—'} / ${athlete.sex || 'Male'}`} readOnly />
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 2: Sports Injury Diagnosis ── */}
          {activeSection === '2' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Injury (Structure &amp; Side) *</label>
                  <input style={inp} value={plan.structure_and_side} onChange={e => updateField('structure_and_side', e.target.value)} placeholder="e.g. Right Hamstring (Biceps Femoris) or Left Ankle ATFL" />
                </div>
                <div>
                  <label style={lbl}>Grade</label>
                  <select style={inp} value={plan.grade} onChange={e => updateField('grade', e.target.value)}>
                    <option value="Grade I">Grade I (Mild - Micro-tears, minimal loss of function)</option>
                    <option value="Grade II">Grade II (Moderate - Partial structural tear, pain/swelling)</option>
                    <option value="Grade III">Grade III (Severe - Complete rupture / avulsion)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Date of Injury</label>
                  <input type="date" style={inp} value={plan.date_of_injury} onChange={e => updateField('date_of_injury', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Mechanism (Contact vs Non-contact)</label>
                  <select style={inp} value={plan.mechanism_contact} onChange={e => updateField('mechanism_contact', e.target.value)}>
                    <option value="Non-contact">Non-contact (Deceleration, sprinting, change of direction)</option>
                    <option value="Contact">Contact (Tackle, collision, impact)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Onset (Acute vs Overuse)</label>
                  <select style={inp} value={plan.mechanism_timing} onChange={e => updateField('mechanism_timing', e.target.value)}>
                    <option value="Acute">Acute (Sudden onset incident)</option>
                    <option value="Overuse">Overuse (Gradual insidious loading onset)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Stage of Healing</label>
                  <select style={inp} value={plan.stage} onChange={e => updateField('stage', e.target.value)}>
                    <option value="Acute">Acute (Day 0–7: Inflammatory response)</option>
                    <option value="Sub-acute">Sub-acute (Week 1–6: Repair &amp; collagen deposition)</option>
                    <option value="Chronic">Chronic (&gt;6 weeks: Remodeling / persistent pathology)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Contributing Factors</label>
                  <input style={inp} value={plan.contributing_factors} onChange={e => updateField('contributing_factors', e.target.value)} placeholder="Training load, previous injury, footwear, surface" />
                </div>
              </div>

              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: 14, borderRadius: 10 }}>
                <label style={{ ...lbl, color: '#B91C1C' }}>Red Flags / Precautions</label>
                <input style={{ ...inp, background: '#FFFFFF', borderColor: '#F87171' }} value={plan.red_flags} onChange={e => updateField('red_flags', e.target.value)} placeholder="Exclude avulsion fracture, neurovascular compromise, severe instability" />
              </div>

              <div>
                <label style={lbl}>Clinical Impression &amp; Pathology Summary</label>
                <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={plan.clinical_impression} onChange={e => updateField('clinical_impression', e.target.value)} placeholder="Physiotherapist diagnostic assessment and clinical rationale" />
              </div>
            </div>
          )}

          {/* ── SECTION 3: Baseline Assessment ── */}
          {activeSection === '3' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Bilateral comparison metrics between the injured limb and uninjured reference limb:
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '25%' }}>Measure</th>
                      <th style={{ padding: '10px 12px', width: '25%' }}>Injured Side</th>
                      <th style={{ padding: '10px 12px', width: '25%' }}>Uninjured Side</th>
                      <th style={{ padding: '10px 12px', width: '25%' }}>Notes / Deficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.baseline.map((b, idx) => (
                      <tr key={b.measure} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>{b.measure}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={b.injured} onChange={e => updateBaseline(idx, 'injured', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={b.uninjured} onChange={e => updateBaseline(idx, 'uninjured', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={b.notes} onChange={e => updateBaseline(idx, 'notes', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECTION 4: Rehabilitation Goals ── */}
          {activeSection === '4' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 12, padding: 16 }}>
                <label style={{ ...lbl, color: '#0F766E' }}>Short-term Goals (1–4 weeks)</label>
                <textarea rows={3} style={{ ...inp, background: '#FFFFFF', borderColor: '#2DD4BF' }} value={plan.goal_short_term} onChange={e => updateField('goal_short_term', e.target.value)} />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#0F766E' }}>
                  Target: Control pain &amp; swelling, restore full pain-free ROM, isometric activation.
                </p>
              </div>

              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 16 }}>
                <label style={{ ...lbl, color: '#065F46' }}>Long-term Goals (Full Return to Sport)</label>
                <textarea rows={3} style={{ ...inp, background: '#FFFFFF', borderColor: '#34D399' }} value={plan.goal_long_term} onChange={e => updateField('goal_long_term', e.target.value)} />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#065F46' }}>
                  Target: Full return to competitive match play at pre-injury peak; hop test LSI &gt;= 90%; minimized re-injury risk.
                </p>
              </div>
            </div>
          )}

          {/* ── SECTION 5: Rehabilitation Plan (4 Phases) ── */}
          {activeSection === '5' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { key: 'phase1', title: 'Phase 1: Protect and Settle', badgeColor: '#2563EB' },
                { key: 'phase2', title: 'Phase 2: Restore Strength and Control', badgeColor: '#0D9488' },
                { key: 'phase3', title: 'Phase 3: Power and Sport-Specific', badgeColor: '#D97706' },
                { key: 'phase4', title: 'Phase 4: Return to Sport', badgeColor: '#059669' },
              ].map(({ key, title, badgeColor }) => {
                const p = plan[key] || {}
                return (
                  <div key={key} style={{ border: '1px solid #CBD5E1', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ background: '#0F172A', color: '#FFFFFF', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, opacity: 0.8 }}>Duration:</span>
                        <input
                          style={{ ...inp, width: 140, padding: '4px 8px', fontSize: 12, background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                          value={p.duration || ''}
                          onChange={e => updatePhase(key, 'duration', e.target.value)}
                        />
                        <select
                          style={{ ...inp, width: 130, padding: '4px 8px', fontSize: 12, background: badgeColor, color: '#fff', border: 'none', fontWeight: 700 }}
                          value={p.status || 'Active'}
                          onChange={e => updatePhase(key, 'status', e.target.value)}
                        >
                          <option value="Completed">Completed</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Upcoming">Upcoming</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#FFFFFF' }}>
                      <div>
                        <label style={lbl}>Aim</label>
                        <input style={inp} value={p.aim || ''} onChange={e => updatePhase(key, 'aim', e.target.value)} />
                      </div>
                      <div>
                        <label style={lbl}>Interventions</label>
                        <input style={inp} value={p.interventions || ''} onChange={e => updatePhase(key, 'interventions', e.target.value)} />
                      </div>
                      <div>
                        <label style={lbl}>Prescribed Exercises (Sets x Reps)</label>
                        <textarea rows={2} style={{ ...inp, resize: 'vertical', fontWeight: 600, color: '#0F172A' }} value={p.exercises || ''} onChange={e => updatePhase(key, 'exercises', e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ ...lbl, color: '#059669' }}>Progression Criteria (Advance When)</label>
                          <input style={{ ...inp, borderColor: '#A7F3D0' }} value={p.progress_when || ''} onChange={e => updatePhase(key, 'progress_when', e.target.value)} />
                        </div>
                        <div>
                          <label style={lbl}>Notes / Status</label>
                          <input style={inp} value={p.notes || ''} onChange={e => updatePhase(key, 'notes', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── SECTION 6: Prevention and Maintenance ── */}
          {activeSection === '6' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Warm-up Routine</label>
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={plan.warmup_routine} onChange={e => updateField('warmup_routine', e.target.value)} placeholder="e.g. FIFA 11+ protocol, dynamic mobility, glute activation" />
              </div>
              <div>
                <label style={lbl}>Strength &amp; Mobility Maintenance</label>
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={plan.strength_maintenance} onChange={e => updateField('strength_maintenance', e.target.value)} placeholder="e.g. Weekly Nordic curls, Copenhagen adductors, eccentric calf loading" />
              </div>
              <div>
                <label style={lbl}>Load Management Protocol</label>
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={plan.load_management} onChange={e => updateField('load_management', e.target.value)} placeholder="e.g. ACWR monitoring (0.8–1.3), GPS sprint distance tracking" />
              </div>
              <div>
                <label style={lbl}>Recovery Protocol</label>
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={plan.recovery} onChange={e => updateField('recovery', e.target.value)} placeholder="e.g. 8+ hrs sleep, post-match nutrition, hydration, cold water immersion" />
              </div>
            </div>
          )}

          {/* ── SECTION 7: Home Exercise Programme (HEP) ── */}
          {activeSection === '7' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>Athlete daily and weekly home rehabilitation exercises:</span>
                <button
                  onClick={addHEPRow}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#0D9488',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add Exercise
                </button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '30%' }}>Exercise</th>
                      <th style={{ padding: '10px 12px', width: '22%' }}>Sets x Reps</th>
                      <th style={{ padding: '10px 12px', width: '18%' }}>Frequency</th>
                      <th style={{ padding: '10px 12px', width: '24%' }}>Precautions</th>
                      <th style={{ padding: '10px 8px', width: '6%', textAlign: 'center' }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.hep.map((h, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={h.exercise} onChange={e => updateHEP(idx, 'exercise', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={h.sets_reps} onChange={e => updateHEP(idx, 'sets_reps', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={h.frequency} onChange={e => updateHEP(idx, 'frequency', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input style={inp} value={h.precautions} onChange={e => updateHEP(idx, 'precautions', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => deleteHEPRow(idx)}
                            style={{ background: '#FEF2F2', border: 'none', color: '#DC2626', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECTION 8: Review and Outcome Measures ── */}
          {activeSection === '8' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lbl}>Sessions per week</label>
                  <input style={inp} value={plan.sessions_per_week} onChange={e => updateField('sessions_per_week', e.target.value)} placeholder="e.g. 3 clinical sessions per week" />
                </div>
                <div>
                  <label style={lbl}>Review Date</label>
                  <input type="date" style={inp} value={plan.review_date} onChange={e => updateField('review_date', e.target.value)} />
                </div>
              </div>

              <div>
                <label style={lbl}>Outcome Measures Monitored</label>
                <input style={inp} value={plan.outcome_measures} onChange={e => updateField('outcome_measures', e.target.value)} placeholder="Pain (NRS), ROM, strength, hop tests, functional score" />
              </div>

              <div>
                <label style={lbl}>Status Against Goals</label>
                <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={plan.status_against_goals} onChange={e => updateField('status_against_goals', e.target.value)} placeholder="Current status against rehabilitation benchmarks" />
              </div>

              <div>
                <label style={lbl}>Care Plan Recommendation</label>
                <select style={inp} value={plan.clinical_plan} onChange={e => updateField('clinical_plan', e.target.value)}>
                  <option value="Continue Care">Continue Active Physiotherapy Care</option>
                  <option value="Refer">Refer to Orthopedic Specialist / Advanced Imaging</option>
                  <option value="Discharge">Discharge / Full Match Clearance Granted</option>
                </select>
              </div>
            </div>
          )}

          {/* ── SECTION 9: Sign-off ── */}
          {activeSection === '9' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 14, padding: 20 }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Clinical Sign-off Credentials</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={lbl}>Attending Therapist Name</label>
                    <input style={inp} value={plan.therapist_name} onChange={e => updateField('therapist_name', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Qualification / Clinical License</label>
                    <input style={inp} value={plan.therapist_qualification} onChange={e => updateField('therapist_qualification', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Report Date</label>
                    <input type="date" style={inp} value={plan.report_date} onChange={e => updateField('report_date', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Clinical Signature / Stamp</label>
                    <div style={{ padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, fontSize: 12, color: '#0D9488', fontWeight: 700, border: '1px dashed #0D9488', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} style={{ flexShrink: 0 }} />
                      <span>Authorized Clinical Digital Sign-off Included on PDF</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div style={{
          background: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Section {activeSection} of {SECTIONS.length} · {SECTIONS.find(s => s.id === activeSection)?.label}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                const curIdx = SECTIONS.findIndex(s => s.id === activeSection)
                if (curIdx > 0) setActiveSection(SECTIONS[curIdx - 1].id)
              }}
              disabled={activeSection === '1'}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                cursor: activeSection === '1' ? 'not-allowed' : 'pointer',
                opacity: activeSection === '1' ? 0.5 : 1,
              }}
            >
              Previous
            </button>

            <button
              onClick={() => {
                const curIdx = SECTIONS.findIndex(s => s.id === activeSection)
                if (curIdx < SECTIONS.length - 1) setActiveSection(SECTIONS[curIdx + 1].id)
              }}
              disabled={activeSection === String(SECTIONS.length)}
              style={{
                background: '#0D9488',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                color: '#FFFFFF',
                cursor: activeSection === String(SECTIONS.length) ? 'not-allowed' : 'pointer',
                opacity: activeSection === String(SECTIONS.length) ? 0.5 : 1,
              }}
            >
              Next Section
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
