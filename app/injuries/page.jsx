'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import { Heart, HeartOff, FileHeart, Plus, Pencil, Trash2, Check, X } from 'lucide-react'

const EMPTY = {
  athlete_id:'', injury_type:'', severity:'Mild',
  date_of_injury: new Date().toISOString().split('T')[0],
  expected_return:'', notes:'', status:'Active',
}
const STATUS_OPTS   = ['Active','Recovered']
const SEVERITY_OPTS = ['Mild','Moderate','Severe']

const SEVERITY_STYLE = {
  Mild:     { bg:'#E8F8EE', color:'#1B7A3E', dot:'#27AE60' },
  Moderate: { bg:'#FEF9E7', color:'#B36200', dot:'#F39C12' },
  Severe:   { bg:'#FDEDEC', color:'#C0392B', dot:'#E74C3C' },
}

// Roles that can create / edit / delete injury records
const MEDICAL_ROLES = ['admin','superadmin','physio','sports_scientist','medical']

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function Avatar({ ath, size=36 }) {
  const [err, setErr] = useState(false)
  const colors = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']
  const bg = colors[(ath?.name?.charCodeAt(0)||0) % colors.length]
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath.name} onError={()=>setErr(true)}
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid #E2E8F0' }}/>
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.32, fontWeight:800, color:'#fff', flexShrink:0 }}>
      {initials(ath?.name)}
    </div>
  )
}

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.Mild
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color,
      padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, flexShrink:0 }}/>
      {severity}
    </span>
  )
}

function StatusBadge({ status }) {
  const isActive = status === 'Active'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5,
      background: isActive ? '#FDEDEC' : '#E8F8EE',
      color: isActive ? '#C0392B' : '#1B7A3E',
      padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: isActive ? '#E74C3C' : '#27AE60', flexShrink:0 }}/>
      {status}
    </span>
  )
}

const inp = { width:'100%', padding:'10px 14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10,
  fontSize:14, outline:'none', color:'#0F172A', fontFamily:'var(--font)', boxSizing:'border-box' }
const lbl = { display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#64748B', marginBottom:5 }

export default function InjuriesPage() {
  const [injuries,    setInjuries]    = useState([])
  const [athletes,    setAthletes]    = useState([])
  const [filter,      setFilter]      = useState('All')
  const [showForm,    setShowForm]    = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [form,        setForm]        = useState(EMPTY)
  const [currentUser, setCurrentUser] = useState(null)
  const [teamId,      setTeamId]      = useState(null)
  const [canEdit,     setCanEdit]     = useState(false)
  const [loading,     setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    const { profile: p, teamId: tid } = await getTenantProfile('id,full_name,role,team_id')
    setCurrentUser(p)
    setTeamId(tid)

    // Determine if user can write based on their role OR their staff_type via the coaches table
    let editAllowed = MEDICAL_ROLES.includes(p?.role)
    if (!editAllowed && p?.id) {
      const { data: staffRow } = await supabase
        .from('coaches').select('staff_type').eq('user_id', p.id).maybeSingle()
      if (staffRow && ['physio','sports_scientist','medical'].includes(staffRow.staff_type)) {
        editAllowed = true
      }
    }
    setCanEdit(editAllowed)

    const { data: ath } = await scopeTeam(
      supabase.from('athletes').select('id,name,position,photo_url'), tid
    ).order('name')
    setAthletes(ath || [])

    const { data: rows } = await scopeTeam(
      supabase.from('injuries').select('*,athletes(name,position,id,photo_url),logged_profile:logged_by(full_name),updated_profile:updated_by(full_name)'), tid
    ).order('date_of_injury', { ascending: false })
    setInjuries(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  function openAdd() { setEditId(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(inj) {
    setEditId(inj.id)
    setForm({ athlete_id:inj.athlete_id||'', injury_type:inj.injury_type||'', severity:inj.severity||'Mild',
      date_of_injury:inj.date_of_injury||'', expected_return:inj.expected_return||'', notes:inj.notes||'', status:inj.status||'Active' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.athlete_id) return alert('Select an athlete.')
    if (!form.injury_type.trim()) return alert('Injury type required.')
    if (!teamId) return alert('Your account is not assigned to a team.')
    setSaving(true)
    const now = new Date().toISOString(), userId = currentUser?.id || null
    const base = { ...form, team_id: teamId }
    if (editId) {
      base.updated_by = userId; base.updated_at = now
      const { error } = await scopeTeam(supabase.from('injuries').update(base).eq('id', editId), teamId)
      if (error) alert(error.message)
      else { setShowForm(false); fetchData() }
    } else {
      base.logged_by = userId; base.logged_at = now; base.status = 'Active'
      const { error } = await supabase.from('injuries').insert([base])
      if (!error) await scopeTeam(supabase.from('athletes').update({ status:'Injured' }).eq('id', form.athlete_id), teamId)
      if (error) alert(error.message)
      else { setShowForm(false); setForm(EMPTY); fetchData() }
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this injury record?')) return
    setDeleting(id)
    const { error } = await scopeTeam(supabase.from('injuries').delete().eq('id', id), teamId)
    if (error) alert('Delete failed: ' + error.message)
    else fetchData()
    setDeleting(null)
  }

  async function markRecovered(id, athleteId) {
    const update = { status:'Recovered', updated_by: currentUser?.id||null, updated_at: new Date().toISOString() }
    await scopeTeam(supabase.from('injuries').update(update).eq('id', id), teamId)
    await scopeTeam(supabase.from('athletes').update({ status:'Active' }).eq('id', athleteId), teamId)
    fetchData()
  }

  const fmtDate = d => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })

  const filtered  = filter === 'All' ? injuries : injuries.filter(i => i.status === filter)
  const activeCnt = injuries.filter(i => i.status === 'Active').length
  const recovCnt  = injuries.filter(i => i.status === 'Recovered').length

  return (
    <Layout>
      <div className="page-outer">

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:14, marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#0D9488', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>
              Medical Records
            </div>
            <h1 style={{ fontSize:22, fontWeight:900, color:'var(--text)', margin:0, letterSpacing:'-0.02em' }}>Injury Register</h1>
            <p style={{ fontSize:13, color:'var(--text3)', margin:'4px 0 0', fontWeight:500 }}>
              {activeCnt} active · {recovCnt} recovered
              {!canEdit && <span style={{ marginLeft:8, background:'#F1F5F9', color:'#64748B', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:700 }}>Read Only</span>}
            </p>
          </div>
          {canEdit && (
            <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg,#C0392B,#E74C3C)', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(231,76,60,0.3)', fontFamily:'var(--font)' }}>
              <Plus size={15}/> Log Injury
            </button>
          )}
        </div>

        {/* ── Stat pills ── */}
        <div style={{ display:'flex', gap:12, marginBottom:22, flexWrap:'wrap' }}>
          {[
            { label:'Total', value:injuries.length, icon:<FileHeart size={16} color="#4A90E2"/>, color:'#4A90E2', bg:'#EBF4FF' },
            { label:'Active', value:activeCnt, icon:<HeartOff size={16} color="#E74C3C"/>, color:'#E74C3C', bg:'#FDEDEC' },
            { label:'Recovered', value:recovCnt, icon:<Heart size={16} color="#27AE60"/>, color:'#27AE60', bg:'#E8F8EE' },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 18px', minWidth:110 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:20, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginTop:2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter ── */}
        <div style={{ display:'flex', gap:4, marginBottom:18, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:4, width:'fit-content' }}>
          {['All','Active','Recovered'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'7px 18px', background: filter===f ? (f==='Active'?'linear-gradient(135deg,#C0392B,#E74C3C)':'#0D9488') : 'transparent', border:'none', borderRadius:8, fontSize:12, fontWeight:600, color: filter===f ? '#fff' : 'var(--text2)', cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.15s' }}>{f}</button>
          ))}
        </div>

        {/* ── Injury Table ── */}
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding:'48px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>
            No injury records found.
          </div>
        ) : (
          <div className="card" style={{ overflow:'hidden', padding:0 }}>
            {/* Table Header */}
            <div style={{ display:'grid', gridTemplateColumns: canEdit ? '2fr 1.4fr 0.9fr 0.9fr 0.9fr 1.2fr 96px' : '2fr 1.4fr 0.9fr 0.9fr 0.9fr 1.4fr', background:'var(--surface2)', borderBottom:'1px solid var(--border)', padding:'10px 18px', gap:12 }}>
              {['Player','Injury','Severity','Status','Date Injured','Expected Return', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <div key={h} style={{ fontSize:10, fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</div>
              ))}
            </div>

            {filtered.map((inj, i) => {
              const isAct = inj.status === 'Active'
              const isLast = i === filtered.length - 1
              return (
                <div key={inj.id} style={{ display:'grid', gridTemplateColumns: canEdit ? '2fr 1.4fr 0.9fr 0.9fr 0.9fr 1.2fr 96px' : '2fr 1.4fr 0.9fr 0.9fr 0.9fr 1.4fr', alignItems:'center', padding:'13px 18px', gap:12, borderBottom: isLast ? 'none' : '1px solid var(--border)', borderLeft: `3px solid ${isAct ? '#E74C3C' : '#27AE60'}`, transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                  {/* Player */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar ath={inj.athletes} size={34}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{inj.athletes?.name || '—'}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{inj.athletes?.position || ''}</div>
                    </div>
                  </div>

                  {/* Injury */}
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={inj.injury_type}>{inj.injury_type}</div>

                  {/* Severity */}
                  <div><SeverityBadge severity={inj.severity}/></div>

                  {/* Status */}
                  <div><StatusBadge status={inj.status}/></div>

                  {/* Date injured */}
                  <div style={{ fontSize:12, color:'var(--text2)', fontWeight:500 }}>{fmtDate(inj.date_of_injury)}</div>

                  {/* Return */}
                  <div style={{ fontSize:12, color: inj.expected_return ? 'var(--text2)' : 'var(--text3)', fontWeight:500, fontStyle: inj.expected_return ? 'normal' : 'italic' }}>
                    {fmtDate(inj.expected_return)}
                  </div>

                  {/* Actions — only for canEdit */}
                  {canEdit && (
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <button onClick={() => openEdit(inj)} title="Edit" style={{ background:'#F0FDFA', color:'#0D9488', border:'none', borderRadius:7, padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                        <Pencil size={13}/>
                      </button>
                      {isAct && (
                        <button onClick={() => markRecovered(inj.id, inj.athlete_id)} title="Mark Recovered" style={{ background:'#E8F8EE', color:'#1B7A3E', border:'none', borderRadius:7, padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                          <Check size={13}/>
                        </button>
                      )}
                      <button onClick={() => handleDelete(inj.id)} disabled={deleting===inj.id} title="Delete" style={{ background:'#FEF2F2', color:'#E74C3C', border:'none', borderRadius:7, padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center', opacity: deleting===inj.id ? 0.5 : 1 }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Notes tooltip row (shown when notes exist) */}
        {filtered.some(i => i.notes) && (
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:10 }}>* Hover row or open edit to view notes.</p>
        )}

        {/* ── Read-only summary for non-medical staff ── */}
        {!canEdit && (
          <div style={{ marginTop:20, background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'14px 18px', display:'flex', gap:10, alignItems:'flex-start' }}>
            <HeartOff size={18} color="#D97706" style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400E', marginBottom:3 }}>Medical Summary</div>
              <div style={{ fontSize:12, color:'#78350F', lineHeight:1.6 }}>
                {activeCnt > 0
                  ? `${activeCnt} player${activeCnt > 1 ? 's are' : ' is'} currently listed as injured. Detailed medical records and editing are restricted to medical staff and admins.`
                  : 'No active injuries at this time.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal (Edit / Add) ── only rendered for canEdit users ── */}
      {showForm && canEdit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#FFFFFF', borderRadius:18, width:'100%', maxWidth:500, maxHeight:'92vh', overflow:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.22)', border:'1px solid #E2E8F0' }}>
            {/* Modal header */}
            <div style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'18px 18px 0 0' }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#fff', margin:0 }}>{editId ? 'Edit Injury' : 'Log Injury'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:32, height:32, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:15 }}>
              <div>
                <label style={lbl}>Athlete *</label>
                <select value={form.athlete_id} onChange={e=>set('athlete_id')(e.target.value)} style={inp} disabled={!!editId}>
                  <option value="">Select athlete…</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name} — {a.position}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Injury Type *</label>
                <input value={form.injury_type} onChange={e=>set('injury_type')(e.target.value)} placeholder="e.g. Hamstring Strain" style={inp} onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='#E2E8F0'}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Severity</label>
                  <select value={form.severity} onChange={e=>set('severity')(e.target.value)} style={inp}>{SEVERITY_OPTS.map(s=><option key={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select value={form.status} onChange={e=>set('status')(e.target.value)} style={inp}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label style={lbl}>Date of Injury *</label>
                  <input type="date" value={form.date_of_injury} onChange={e=>set('date_of_injury')(e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Expected Return</label>
                  <input type="date" value={form.expected_return} onChange={e=>set('expected_return')(e.target.value)} style={inp}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Notes / Treatment</label>
                <textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={3} placeholder="Treatment notes, physio plan…" style={{ ...inp, resize:'vertical', lineHeight:1.5 }}/>
              </div>
              <div style={{ display:'flex', gap:10, paddingTop:4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, background:'#F1F5F9', border:'1px solid #E2E8F0', color:'#334155', padding:'11px', borderRadius:10, fontSize:14, cursor:'pointer', fontWeight:700, fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,#0F766E,#0D9488)', border:'none', color:'#fff', borderRadius:10, fontSize:14, cursor:'pointer', fontWeight:900, fontFamily:'var(--font)', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Log Injury'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
