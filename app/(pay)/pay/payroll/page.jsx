'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n) => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function StatusBadge({ status }) {
  const map = {
    draft:            { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'Draft' },
    pending_approval: { bg: 'rgba(245,158,11,0.12)',  color: '#FBB124', label: 'Pending' },
    approved:         { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA', label: 'Approved' },
    processing:       { bg: 'rgba(139,92,246,0.12)', color: '#A78BFA', label: 'Processing' },
    completed:        { bg: 'rgba(16,185,129,0.12)', color: '#34D399', label: 'Completed' },
    failed:           { bg: 'rgba(239,68,68,0.12)',  color: '#FCA5A5', label: 'Failed' },
  }
  const s = map[status] || map.draft
  return <span className="pay-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
}

// ── Player/staff picker (from team roster) ────────────────────────────────
function RecipientRow({ rec, index, onChange, onRemove, players }) {
  const [name,   setName]   = useState(rec.name || '')
  const [phone,  setPhone]  = useState(rec.phone || '')
  const [base,   setBase]   = useState(rec.base_salary || '')
  const [bonus,  setBonus]  = useState(rec.bonus || '')
  const [allow,  setAllow]  = useState(rec.allowance || '')

  // Notify parent on any change
  function update(field, val) {
    const upd = { ...rec, name, phone, base_salary: base, bonus, allowance: allow, [field]: val }
    onChange(index, upd)
  }

  const total = (Number(base || 0) + Number(bonus || 0) + Number(allow || 0)).toFixed(2)

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '8px 6px' }}>
        {players.length > 0 ? (
          <select
            className="pay-inp" style={{ padding: '7px 10px', fontSize: 12 }}
            value={rec.recipient_id || ''}
            onChange={e => {
              const p = players.find(x => x.id === e.target.value)
              if (p) {
                const upd = { ...rec, recipient_id: p.id, recipient_type: p.type, name: p.full_name, phone: p.phone || '' }
                setName(p.full_name); setPhone(p.phone || '')
                onChange(index, upd)
              }
            }}
          >
            <option value="">— Select —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.type})</option>)}
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
      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#34D399', fontSize: 13, textAlign: 'right' }}>GHS {total}</td>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <button onClick={() => onRemove(index)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#F87171', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </td>
    </tr>
  )
}

// ── Create payroll run modal ──────────────────────────────────────────────
function CreateRunModal({ teamId, players, onClose, onCreated }) {
  const [description, setDescription] = useState('')
  const [recipients,  setRecipients]  = useState([
    { recipient_type: 'manual', recipient_id: null, name: '', phone: '', base_salary: '', bonus: '', allowance: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function addRow() {
    setRecipients(r => [...r, { recipient_type: 'manual', recipient_id: null, name: '', phone: '', base_salary: '', bonus: '', allowance: '' }])
  }
  function removeRow(i) { setRecipients(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i, upd) { setRecipients(r => r.map((x, idx) => idx === i ? upd : x)) }

  const total = recipients.reduce((s, r) => s + Number(r.base_salary || 0) + Number(r.bonus || 0) + Number(r.allowance || 0), 0)
  const fee   = parseFloat((total * 0.01).toFixed(2))

  async function submit() {
    if (!description) return setError('Description is required')
    const cleaned = recipients.map(r => ({
      ...r,
      base_salary: Number(r.base_salary || 0),
      bonus:       Number(r.bonus || 0),
      allowance:   Number(r.allowance || 0),
    }))
    const noName  = cleaned.filter(r => !r.name)
    if (noName.length) return setError('All recipients must have a name')
    const noPhone = cleaned.filter(r => !r.phone)
    if (noPhone.length) return setError(`Missing MoMo phone for: ${noPhone.map(r => r.name).join(', ')}`)

    setLoading(true); setError(null)
    const res = await fetch('/api/pay/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, description, recipients: cleaned }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'Failed to create run')
    onCreated(data.run)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeUp 0.2s ease' }}>
      <div className="pay-card" style={{ width: '90vw', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>New Payroll Run</h2>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Create a payroll run for review and disbursement.</p>

        <div style={{ marginBottom: 16 }}>
          <label className="pay-lbl">Payroll Description</label>
          <input className="pay-inp" placeholder="e.g. July 2025 Monthly Salaries" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Recipient table */}
        <div style={{ overflowX: 'auto', flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Name / Recipient', 'MoMo Phone', 'Base Salary', 'Bonus', 'Allowance', 'Total', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map((r, i) => (
                <RecipientRow key={i} rec={r} index={i} onChange={updateRow} onRemove={removeRow} players={players} />
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addRow} style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, color: '#64748B', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 16 }}>
          + Add Recipient
        </button>

        {/* Summary */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B', marginBottom: 4 }}>
            <span>Payroll total</span><span style={{ color: '#CBD5E1', fontWeight: 700 }}>{fmt(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B', marginBottom: 4 }}>
            <span>Platform fee (1%)</span><span style={{ color: '#CBD5E1' }}>{fmt(fee)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#F1F5F9', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
            <span>Total wallet deduction</span><span style={{ color: '#F59E0B' }}>{fmt(total + fee)}</span>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FCA5A5', marginBottom: 16 }}>{error}</div>}

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

  const loadRuns = useCallback(async (tid) => {
    setLoading(true)
    const res  = await fetch(`/api/pay/payroll?team_id=${tid}`)
    const data = await res.json()
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

      // Load roster (players + staff) to help fill in recipients
      const { data: roster } = await supabase
        .from('players')
        .select('id, full_name, phone')
        .eq('team_id', profile.team_id)
        .order('full_name')
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name, phone')
        .eq('team_id', profile.team_id)
        .order('full_name')
      const combined = [
        ...(roster || []).map(p => ({ ...p, type: 'player' })),
        ...(staff  || []).map(s => ({ ...s, type: 'staff'  })),
      ]
      setPlayers(combined)
    }
    init()
  }, [loadRuns])

  return (
    <div style={{ padding: '32px', animation: 'fadeUp 0.35s ease' }}>
      {showNew && teamId && (
        <CreateRunModal
          teamId={teamId}
          players={players}
          onClose={() => setShowNew(false)}
          onCreated={(run) => { setShowNew(false); router.push(`/pay/payroll/${run.id}`) }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.04em', marginBottom: 4 }}>Payroll Runs</h1>
          <p style={{ fontSize: 14, color: '#475569' }}>Create, approve, and disburse payroll for your squad and staff.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pay-btn-ghost" onClick={() => loadRuns(teamId)}>↺ Refresh</button>
          <button className="pay-btn-gold" onClick={() => setShowNew(true)}>+ New Payroll Run</button>
        </div>
      </div>

      <div className="pay-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#334155' }}>Loading payroll runs…</div>
        ) : runs.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 8 }}>No payroll runs yet</div>
            <div style={{ fontSize: 13, color: '#334155', marginBottom: 20 }}>Create a payroll run to start disbursing salaries.</div>
            <button className="pay-btn-gold" onClick={() => setShowNew(true)}>Create First Run</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                {['Description', 'Total Amount', 'Status', 'Created By', 'Date', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#334155', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={run.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{run.description}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{run.id.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#34D399' }}>{fmt(run.total_amount)}</td>
                  <td style={{ padding: '14px 20px' }}><StatusBadge status={run.status} /></td>
                  <td style={{ padding: '14px 20px', color: '#64748B', fontSize: 12 }}>{run.created_by_profile?.full_name || '—'}</td>
                  <td style={{ padding: '14px 20px', color: '#475569', fontSize: 11 }}>{new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Link href={`/pay/payroll/${run.id}`} style={{ textDecoration: 'none' }}>
                      <button style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        View →
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
