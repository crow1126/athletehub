'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { payFetch } from '@/lib/payFetch'

const C = {
  text:      '#0B1E14',
  text2:     '#102A1C',
  text3:     '#243E30',
  teal:      '#0B7A70',
  tealDeep:  '#0A5C54',
  tealAlpha: 'rgba(11,122,112,0.10)',
  border:    '#82C29A',
  muted:     '#E2F5E9',
  bg:        '#F0FBF4',
  card:      'rgba(255,255,255,0.92)',
  success:   '#047857',
  successBg: '#D1FAE5',
  danger:    '#B91C1C',
  dangerBg:  '#FEE2E2',
  warning:   '#B45309',
  warningBg: '#FEF3C7',
  info:      '#1D4ED8',
  infoBg:    '#DBEAFE',
}

const fmt = (n) => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function StatusBadge({ status }) {
  const map = {
    draft:            { bg: 'rgba(36,62,48,0.10)', color: C.text3, label: 'Draft' },
    pending_approval: { bg: C.warningBg,             color: C.warning, label: 'Pending' },
    approved:         { bg: C.infoBg,                color: C.info, label: 'Approved' },
    processing:       { bg: 'rgba(109,40,217,0.10)', color: '#6D28D9', label: 'Processing' },
    completed:        { bg: C.successBg,             color: C.success, label: 'Completed' },
    failed:           { bg: C.dangerBg,              color: C.danger, label: 'Failed' },
  }
  const s = map[status] || map.draft
  return <span className="pay-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
}

// ── Recipient row — mobile-friendly stacked card on mobile ────────────────
function RecipientRow({ rec, index, onChange, onRemove, players, isMobile }) {
  const [name,  setName]  = useState(rec.name || '')
  const [phone, setPhone] = useState(rec.phone || '')
  const [base,  setBase]  = useState(rec.base_salary || '')
  const [bonus, setBonus] = useState(rec.bonus || '')
  const [allow, setAllow] = useState(rec.allowance || '')

  function update(field, val) {
    const upd = { ...rec, name, phone, base_salary: base, bonus, allowance: allow, [field]: val }
    onChange(index, upd)
  }

  const total = (Number(base || 0) + Number(bonus || 0) + Number(allow || 0)).toFixed(2)

  if (isMobile) {
    return (
      <div style={{ background: C.muted, borderRadius: 12, padding: '14px', border: `1px solid ${C.border}`, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recipient {index + 1}</span>
          <button onClick={() => onRemove(index)} style={{ background: C.dangerBg, border: 'none', color: C.danger, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14, lineHeight: 1, fontWeight: 'bold' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="pay-lbl">Name / Recipient</label>
            {players.length > 0 ? (
              <select className="pay-inp" style={{ padding: '9px 12px', fontSize: 13, background: '#ffffff', color: C.text, border: `1px solid ${C.border}` }} value={rec.recipient_id || ''}
                onChange={e => {
                  const p = players.find(x => x.id === e.target.value)
                  if (p) { setName(p.full_name); setPhone(p.phone || ''); onChange(index, { ...rec, recipient_id: p.id, recipient_type: p.type, name: p.full_name, phone: p.phone || '' }) }
                }}>
                <option value="">— Select —</option>
                {players.map(p => <option key={p.id} value={p.id} style={{ color: C.text }}>{p.full_name} ({p.type})</option>)}
              </select>
            ) : (
              <input className="pay-inp" style={{ padding: '9px 12px', fontSize: 13 }} placeholder="Name" value={name}
                onChange={e => { setName(e.target.value); update('name', e.target.value) }} />
            )}
          </div>
          <div>
            <label className="pay-lbl">MoMo Phone</label>
            <input className="pay-inp" style={{ padding: '9px 12px', fontSize: 13 }} type="tel" inputMode="numeric" placeholder="0244000000" value={phone}
              onChange={e => { setPhone(e.target.value); update('phone', e.target.value) }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Base', val: base, set: setBase, field: 'base_salary' },
              { label: 'Bonus', val: bonus, set: setBonus, field: 'bonus' },
              { label: 'Allow.', val: allow, set: setAllow, field: 'allowance' },
            ].map(({ label, val, set, field }) => (
              <div key={field}>
                <label className="pay-lbl">{label}</label>
                <input className="pay-inp" style={{ padding: '8px 10px', fontSize: 12 }} type="number" inputMode="decimal" min="0" placeholder="0.00" value={val}
                  onChange={e => { set(e.target.value); update(field, e.target.value) }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>Total payout</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.success }}>GHS {total}</span>
          </div>
        </div>
      </div>
    )
  }

  // Desktop row
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '8px 6px' }}>
        {players.length > 0 ? (
          <select className="pay-inp" style={{ padding: '7px 10px', fontSize: 12, background: '#ffffff', color: C.text, border: `1px solid ${C.border}` }} value={rec.recipient_id || ''}
            onChange={e => {
              const p = players.find(x => x.id === e.target.value)
              if (p) { setName(p.full_name); setPhone(p.phone || ''); onChange(index, { ...rec, recipient_id: p.id, recipient_type: p.type, name: p.full_name, phone: p.phone || '' }) }
            }}>
            <option value="">— Select —</option>
            {players.map(p => <option key={p.id} value={p.id} style={{ color: C.text }}>{p.full_name} ({p.type})</option>)}
          </select>
        ) : (
          <input className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }} placeholder="Name" value={name}
            onChange={e => { setName(e.target.value); update('name', e.target.value) }} />
        )}
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }} placeholder="0244000000" value={phone}
          onChange={e => { setPhone(e.target.value); update('phone', e.target.value) }} />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }} type="number" min="0" placeholder="0.00" value={base}
          onChange={e => { setBase(e.target.value); update('base_salary', e.target.value) }} />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }} type="number" min="0" placeholder="0.00" value={bonus}
          onChange={e => { setBonus(e.target.value); update('bonus', e.target.value) }} />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }} type="number" min="0" placeholder="0.00" value={allow}
          onChange={e => { setAllow(e.target.value); update('allowance', e.target.value) }} />
      </td>
      <td style={{ padding: '8px 6px', fontWeight: 700, color: C.success, fontSize: 13, textAlign: 'right' }}>GHS {total}</td>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <button onClick={() => onRemove(index)} style={{ background: C.dangerBg, border: 'none', color: C.danger, borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: 1, fontWeight: 'bold' }}>×</button>
      </td>
    </tr>
  )
}

// ── Create payroll run modal ──────────────────────────────────────────────
function CreateRunModal({ teamId, players, onClose, onCreated, isMobile }) {
  const [description, setDescription] = useState('')
  const [recipients,  setRecipients]  = useState([
    { recipient_type: 'manual', recipient_id: null, name: '', phone: '', base_salary: '', bonus: '', allowance: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function addRow() { setRecipients(r => [...r, { recipient_type: 'manual', recipient_id: null, name: '', phone: '', base_salary: '', bonus: '', allowance: '' }]) }
  function removeRow(i) { setRecipients(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i, upd) { setRecipients(r => r.map((x, idx) => idx === i ? upd : x)) }

  const total = recipients.reduce((s, r) => s + Number(r.base_salary || 0) + Number(r.bonus || 0) + Number(r.allowance || 0), 0)
  const fee   = parseFloat((total * 0.01).toFixed(2))

  async function submit() {
    if (!description) return setError('Description is required')
    const cleaned = recipients.map(r => ({ ...r, base_salary: Number(r.base_salary || 0), bonus: Number(r.bonus || 0), allowance: Number(r.allowance || 0) }))
    const noName  = cleaned.filter(r => !r.name)
    if (noName.length) return setError('All recipients must have a name')
    const noPhone = cleaned.filter(r => !r.phone)
    if (noPhone.length) return setError(`Missing MoMo phone for: ${noPhone.map(r => r.name).join(', ')}`)
    setLoading(true); setError(null)
    const { res, data } = await payFetch('/api/pay/payroll', { method: 'POST', body: JSON.stringify({ team_id: teamId, description, recipients: cleaned }) })
    setLoading(false)
    if (!res.ok) return setError(data.error || 'Failed to create run')
    onCreated(data.run)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,20,0.5)', zIndex: 9999, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeUp 0.2s ease' }}
      onClick={() => onClose()}>
      <div className="pay-card"
        style={{ width: isMobile ? '100%' : '92vw', maxWidth: isMobile ? '100%' : 860, maxHeight: isMobile ? '92vh' : '90vh', display: 'flex', flexDirection: 'column', padding: isMobile ? '20px 16px' : 32, borderRadius: isMobile ? '20px 20px 0 0' : 18, paddingBottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : 32, background: '#ffffff', border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}>
        {isMobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />}
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>New Payroll Run</h2>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>Create a payroll run for review and disbursement.</p>

        <div style={{ marginBottom: 14 }}>
          <label className="pay-lbl">Payroll Description</label>
          <input className="pay-inp" placeholder="e.g. July 2025 Monthly Salaries" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Recipients */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
          {isMobile ? (
            <div>{recipients.map((r, i) => <RecipientRow key={i} rec={r} index={i} onChange={updateRow} onRemove={removeRow} players={players} isMobile />)}</div>
          ) : (
            <div className="pay-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Name / Recipient', 'MoMo Phone', 'Base Salary', 'Bonus', 'Allowance', 'Total', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r, i) => <RecipientRow key={i} rec={r} index={i} onChange={updateRow} onRemove={removeRow} players={players} isMobile={false} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button onClick={addRow} style={{ background: C.muted, border: `1px dashed ${C.border}`, borderRadius: 8, color: C.text2, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, width: '100%', fontWeight: 'bold' }}>
          + Add Recipient
        </button>

        {/* Summary */}
        <div style={{ background: C.muted, borderRadius: 10, padding: '12px 16px', marginBottom: 14, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text3, marginBottom: 4 }}>
            <span>Payroll total</span><span style={{ color: C.text, fontWeight: 700 }}>{fmt(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.text3, marginBottom: 4 }}>
            <span>Platform fee (1%)</span><span style={{ color: C.text }}>{fmt(fee)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text, fontWeight: 800, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
            <span>Total wallet deduction</span><span style={{ color: C.warning }}>{fmt(total + fee)}</span>
          </div>
        </div>

        {error && <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pay-btn-ghost" style={{ flex: 1 }} onClick={() => onClose()}>Cancel</button>
          <button className="pay-btn-gold" style={{ flex: 2 }} onClick={submit} disabled={loading}>
            {loading ? 'Creating…' : '✓ Create Payroll Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const router  = useRouter()
  const [teamId,  setTeamId]  = useState(null)
  const [runs,    setRuns]    = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadRuns = useCallback(async (tid) => {
    setLoading(true)
    const { res, data } = await payFetch(`/api/pay/payroll?team_id=${tid}`)
    setLoading(false)
    if (res.ok) setRuns(data.runs || [])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', session.user.id).single()
      if (!profile?.team_id) return
      setTeamId(profile.team_id)
      loadRuns(profile.team_id)
      const { data: roster } = await supabase.from('athletes').select('id, name, phone').eq('team_id', profile.team_id).order('name')
      const { data: staff  } = await supabase.from('coaches').select('id, name, phone').eq('team_id', profile.team_id).order('name')
      setPlayers([
        ...(roster || []).map(p => ({ ...p, full_name: p.name, type: 'athlete' })),
        ...(staff  || []).map(s => ({ ...s, full_name: s.name, type: 'coach'   })),
      ])
    }
    init()
  }, [loadRuns])

  return (
    <div className="pay-page" style={{ animation: 'fadeUp 0.35s ease' }}>
      {showNew && teamId && (
        <CreateRunModal teamId={teamId} players={players} isMobile={isMobile}
          onClose={() => setShowNew(false)}
          onCreated={(run) => { setShowNew(false); router.push(`/pay/payroll/${run.id}`) }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 16 : 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: C.text, letterSpacing: '-0.04em', marginBottom: 3 }}>Payroll Runs</h1>
          <p style={{ fontSize: 13, color: C.text3 }}>Create, approve, and disburse payroll for your squad.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pay-btn-ghost" style={{ padding: '9px 14px', fontSize: 13 }} onClick={() => loadRuns(teamId)}>↺</button>
          <button className="pay-btn-gold" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setShowNew(true)}>+ New Run</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="pay-card" style={{ padding: 48, textAlign: 'center', color: C.text3 }}>Loading payroll runs…</div>
      ) : runs.length === 0 ? (
        <div className="pay-card" style={{ padding: isMobile ? 40 : 64, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 40 : 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text2, marginBottom: 8 }}>No payroll runs yet</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>Create a payroll run to start disbursing salaries.</div>
          <button className="pay-btn-gold" onClick={() => setShowNew(true)}>Create First Run</button>
        </div>
      ) : isMobile ? (
        /* Mobile: card list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {runs.map((run, i) => (
            <Link key={run.id} href={`/pay/payroll/${run.id}`} style={{ textDecoration: 'none', animation: `fadeUp 0.3s ease ${i * 0.04}s both`, display: 'block' }}>
              <div className="pay-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={run.status} />
                    <span style={{ fontSize: 11, color: C.text3 }}>{new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{fmt(run.total_amount)}</div>
                  <div style={{ fontSize: 11, color: C.warning, marginTop: 2, fontWeight: 600 }}>View →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Desktop: full table */
        <div className="pay-card pay-table-scroll" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead style={{ background: C.muted }}>
              <tr>
                {['Description', 'Total Amount', 'Status', 'Created By', 'Date', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.text3, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}`, animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{run.description}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{run.id.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: C.teal }}>{fmt(run.total_amount)}</td>
                  <td style={{ padding: '14px 20px' }}><StatusBadge status={run.status} /></td>
                  <td style={{ padding: '14px 20px', color: C.text2, fontSize: 12 }}>{run.created_by_profile?.full_name || '—'}</td>
                  <td style={{ padding: '14px 20px', color: C.text3, fontSize: 11 }}>{new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Link href={`/pay/payroll/${run.id}`} style={{ textDecoration: 'none' }}>
                      <button style={{ background: C.muted, border: `1px solid ${C.border}`, color: C.teal, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>View →</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
