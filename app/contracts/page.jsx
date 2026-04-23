'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const STATUS_OPTS   = ['Active','Expired','Terminated','Negotiating']
const STATUS_COLORS = {
  Active:      { bg: '#E8F8EE', color: '#1B7A3E' },
  Expired:     { bg: '#FDEDEC', color: '#C0392B' },
  Terminated:  { bg: '#FDEDEC', color: '#C0392B' },
  Negotiating: { bg: '#FEF9E7', color: '#B36200' },
}
const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=36, index=0 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: AV_COLORS[index % AV_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: '#fff' }}>
      {initials(ath?.name)}
    </div>
  )
}

function currency(v) { return v ? `GHS ${parseFloat(v).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—' }

const EMPTY = { athlete_id:'',contract_start:'',contract_end:'',weekly_wage:'',signing_fee:'',release_clause:'',bonus_goals:'',bonus_assists:'',status:'Active',notes:'' }
const inp   = { width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)' }
const lbl   = { display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6 }

export default function ContractsPage() {
  const [contracts, setContracts] = useState([])
  const [athletes,  setAthletes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [form,      setForm]      = useState(EMPTY)
  const [filter,    setFilter]    = useState('All')
  const [formError, setFormError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('contracts').select('*, athletes(id, name, position, club, photo_url)').order('created_at', { ascending: false }),
      supabase.from('athletes').select('id, name, position, club, photo_url').order('name'),
    ])
    setContracts(c || [])
    setAthletes(a  || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  function openAdd() { setEditId(null); setForm(EMPTY); setFormError(''); setShowForm(true) }
  function openEdit(c) {
    setEditId(c.id)
    setForm({ athlete_id:c.athlete_id||'', contract_start:c.contract_start||'', contract_end:c.contract_end||'', weekly_wage:c.weekly_wage||'', signing_fee:c.signing_fee||'', release_clause:c.release_clause||'', bonus_goals:c.bonus_goals||'', bonus_assists:c.bonus_assists||'', status:c.status||'Active', notes:c.notes||'' })
    setFormError(''); setShowForm(true)
  }

  async function handleSave() {
    setFormError('')
    if (!form.athlete_id) { setFormError('Please select an athlete.'); return }
    setSaving(true)
    const payload = {
      athlete_id:     form.athlete_id,
      contract_start: form.contract_start || null,
      contract_end:   form.contract_end   || null,
      weekly_wage:    parseFloat(form.weekly_wage)    || 0,
      signing_fee:    parseFloat(form.signing_fee)    || 0,
      release_clause: form.release_clause ? parseFloat(form.release_clause) : null,
      bonus_goals:    parseFloat(form.bonus_goals)    || 0,
      bonus_assists:  parseFloat(form.bonus_assists)  || 0,
      status:         form.status,
      notes:          form.notes || null,
    }
    if (editId) {
      const { error } = await supabase.from('contracts').update(payload).eq('id', editId)
      if (error) { setFormError('Update failed: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('contracts').insert([payload])
      if (error) { setFormError('Save failed: ' + error.message); setSaving(false); return }
    }
    setShowForm(false); setForm(EMPTY); setSaving(false); fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this contract? This cannot be undone.')) return
    setDeleting(id)
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) alert('Delete failed: ' + error.message)
    else fetchData()
    setDeleting(null)
  }

  const filtered       = filter === 'All' ? contracts : contracts.filter(c => c.status === filter)
  const activeContracts = contracts.filter(c => c.status === 'Active')
  const totalWage       = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)

  // Days until expiry
  function daysLeft(dateStr) {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  }

  return (
    <Layout>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px' }}>
        <PageHeader
          label="Finance"
          title="Player Contracts"
          subtitle="Athlete contracts, wages, and financial overview"
          action={<button className="btn-blue" onClick={openAdd}>+ New Contract</button>}
        />

        {/* Stats */}
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Contracts',      value: contracts.length,          icon: '📄', color: 'var(--blue)'    },
            { label: 'Active',               value: activeContracts.length,    icon: '✅', color: 'var(--success)'  },
            { label: 'Weekly Wage Bill',      value: `GHS ${totalWage.toLocaleString('en-GH', { minimumFractionDigits: 0 })}`, icon: '💰', color: '#1B7A3E' },
            { label: 'Expiring (90 days)',    value: contracts.filter(c => { const d = daysLeft(c.contract_end); return d !== null && d >= 0 && d <= 90 }).length, icon: '⚠️', color: 'var(--warning)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: typeof s.value === 'string' ? 16 : 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="fade-up" style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 4, width: 'fit-content' }}>
          {['All', ...STATUS_OPTS].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 20px', background: filter === f ? 'var(--blue)' : 'transparent', border: 'none', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, color: filter === f ? '#fff' : 'var(--text2)', cursor: 'pointer', transition: 'var(--transition)', fontFamily: 'var(--font)' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card fade-up fade-up-1" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1.1fr 1.1fr 0.9fr 1.1fr', gap: 8, padding: '12px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Athlete','Start','End','Weekly Wage','Signing Fee','Release Clause','Status','Actions'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--blue-light)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              {contracts.length === 0 ? 'No contracts yet. Click "+ New Contract" to add one.' : 'No contracts match this filter.'}
            </div>
          ) : filtered.map((c, i) => {
            const sc   = STATUS_COLORS[c.status] || STATUS_COLORS.Active
            const dl   = daysLeft(c.contract_end)
            const expireSoon = dl !== null && dl >= 0 && dl <= 90

            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1.1fr 1.1fr 0.9fr 1.1fr', gap: 8, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--border)', transition: 'var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>

                {/* Athlete with photo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AthleteAvatar ath={c.athletes} size={36} index={i} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.athletes?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.athletes?.position} · {c.athletes?.club}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{c.contract_start || '—'}</div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{c.contract_end || '—'}</div>
                  {expireSoon && <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 700 }}>{dl}d left</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1B7A3E' }}>{currency(c.weekly_wage)}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{currency(c.signing_fee)}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{currency(c.release_clause)}</div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, padding: '3px 9px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {c.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => openEdit(c)} style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: 'none', padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Edit</button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: deleting === c.id ? 0.5 : 1, fontFamily: 'var(--font)' }}>
                    {deleting === c.id ? '…' : 'Del'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Wage summary */}
        {activeContracts.length > 0 && (
          <div className="card fade-up" style={{ padding: '20px 24px', marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>💰 Wage Bill Summary (Active Contracts)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                ['Weekly',  `GHS ${totalWage.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`],
                ['Monthly', `GHS ${(totalWage * 4.33).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`],
                ['Annual',  `GHS ${(totalWage * 52).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`],
              ].map(([period, value]) => (
                <div key={period} style={{ background: 'var(--surface2)', borderRadius: 'var(--r-md)', padding: '14px 18px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{period}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1B7A3E' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,62,80,0.6)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ background: 'linear-gradient(90deg, #1B5E20, #27AE60)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Player Finance</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{editId ? 'Edit Contract' : 'New Contract'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ background: 'var(--danger-light)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>⚠ {formError}</div>
              )}
              <div>
                <label style={lbl}>Athlete *</label>
                <select value={form.athlete_id} onChange={e => set('athlete_id')(e.target.value)} style={inp} disabled={!!editId}>
                  <option value="">Select athlete…</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name} — {a.position} ({a.club})</option>)}
                </select>
                {athletes.length === 0 && <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>No athletes found. Register athletes first.</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={lbl}>Contract Start</label><input type="date" value={form.contract_start} onChange={e => set('contract_start')(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Contract End</label><input type="date" value={form.contract_end} onChange={e => set('contract_end')(e.target.value)} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={lbl}>Weekly Wage (GHS)</label><input type="number" value={form.weekly_wage} onChange={e => set('weekly_wage')(e.target.value)} style={inp} placeholder="0.00" /></div>
                <div><label style={lbl}>Signing Fee (GHS)</label><input type="number" value={form.signing_fee} onChange={e => set('signing_fee')(e.target.value)} style={inp} placeholder="0.00" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Release Clause</label><input type="number" value={form.release_clause} onChange={e => set('release_clause')(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Goal Bonus (GHS)</label><input type="number" value={form.bonus_goals} onChange={e => set('bonus_goals')(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Assist Bonus (GHS)</label><input type="number" value={form.bonus_assists} onChange={e => set('bonus_assists')(e.target.value)} style={inp} /></div>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => set('status')(e.target.value)} style={inp}>
                  {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => set('notes')(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Additional contract details…" /></div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', padding: '12px', borderRadius: 'var(--r-md)', fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex: 2, padding: '12px', opacity: saving ? 0.7 : 1, background: 'linear-gradient(135deg,#1B5E20,#27AE60)', fontSize: 14 }}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}