'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import AthleteCard from '@/components/AthleteCard'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const POSITION_GROUPS = {
  'Goalkeeper':  ['GK'],
  'Defenders':   ['CB','RB','LB','RWB','LWB'],
  'Midfielders': ['CDM','CM','CAM','RM','LM'],
  'Forwards':    ['RW','LW','CF','SS','ST'],
}

const REGIONS = ['Greater Accra','Ashanti','Western','Eastern','Volta','Brong-Ahafo','Northern','Upper East','Upper West','Central']
const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']
const EMPTY = { name:'',age:'',position:'',strong_foot:'',region:'',club:'',phone:'',height:'',weight:'',coach_id:'' }

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

const inp = { width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)' }
const lbl = { display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6 }

export default function AthletesPage() {
  const [athletes,     setAthletes]     = useState([])
  const [coaches,      setCoaches]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(EMPTY)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [search,       setSearch]       = useState('')
  const [posFilter,    setPosFilter]    = useState('')
  const [statFilter,   setStatFilter]   = useState('')
  const [formError,    setFormError]    = useState('')
  const [viewMode,     setViewMode]     = useState('cards') // 'cards' | 'table'

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data:a }, { data:c }] = await Promise.all([
      supabase.from('athletes').select('*, coaches(name)').order('created_at', { ascending:false }),
      supabase.from('coaches').select('id, name').order('name'),
    ])
    setAthletes(a||[])
    setCoaches(c||[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const set = k => v => setForm(f => ({ ...f, [k]:v }))

  function openAdd() {
    setEditId(null); setForm(EMPTY); setPhotoFile(null)
    setPhotoPreview(null); setFormError(''); setShowForm(true)
  }

  function openEdit(ath) {
    setEditId(ath.id)
    setForm({
      name:ath.name||'', age:ath.age||'', position:ath.position||'',
      strong_foot:ath.strong_foot||'', region:ath.region||'', club:ath.club||'',
      phone:ath.phone||'', height:ath.height||'', weight:ath.weight||'',
      coach_id:ath.coach_id||''
    })
    setPhotoFile(null); setPhotoPreview(ath.photo_url||null)
    setFormError(''); setShowForm(true)
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(athleteId) {
    if (!photoFile) return null
    const ext = photoFile.name.split('.').pop()
    const path = `${athleteId}.${ext}`
    const { error } = await supabase.storage.from('athlete-photos').upload(path, photoFile, { upsert:true })
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    setFormError('')
    if (!form.name.trim()) { setFormError('Full name is required.'); return }
    if (!form.position)    { setFormError('Position is required.'); return }
    setSaving(true)
    const payload = {
      name:form.name.trim(), age:parseInt(form.age)||null, position:form.position||null,
      strong_foot:form.strong_foot||null, region:form.region||null, club:form.club||null,
      phone:form.phone||null, height:parseInt(form.height)||null,
      weight:parseInt(form.weight)||null, coach_id:form.coach_id||null,
    }
    if (editId) {
      const url = await uploadPhoto(editId)
      if (url) payload.photo_url = url
      const { error } = await supabase.from('athletes').update(payload).eq('id', editId)
      if (error) { setFormError('Update failed: '+error.message); setSaving(false); return }
      setShowForm(false); fetchData()
    } else {
      const { data, error } = await supabase.from('athletes').insert([{ ...payload, status:'Active' }]).select().single()
      if (error) { setFormError('Save failed: '+error.message); setSaving(false); return }
      const url = await uploadPhoto(data.id)
      if (url) await supabase.from('athletes').update({ photo_url:url }).eq('id', data.id)
      setShowForm(false); setForm(EMPTY); fetchData()
    }
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from the roster? This cannot be undone.`)) return
    setDeleting(id)
    await supabase.from('injuries').delete().eq('athlete_id', id)
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) alert('Delete failed: '+error.message)
    else fetchData()
    setDeleting(null)
  }

  const filtered = athletes.filter(a => {
    const q = search.toLowerCase()
    return (
      (!search     || a.name?.toLowerCase().includes(q) || a.club?.toLowerCase().includes(q) || a.region?.toLowerCase().includes(q)) &&
      (!posFilter  || a.position === posFilter) &&
      (!statFilter || a.status   === statFilter)
    )
  })

  return (
    <Layout>
      <style>{`
        .ath-outer { max-width:1280px; margin:0 auto; padding:32px 40px; }
        .ath-filters { display:flex; gap:10px; margin-bottom:22px; flex-wrap:wrap; align-items:center; }

        /* ── Card grid ── */
        .ath-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        /* ── Card action overlay (edit / delete) ── */
        .ath-card-wrap { position: relative; }
        .ath-card-overlay {
          position: absolute;
          top: 8px; right: 8px;
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.18s;
          z-index: 10;
        }
        .ath-card-wrap:hover .ath-card-overlay { opacity: 1; }
        .ath-card-act {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          font-family: var(--font);
          backdrop-filter: blur(6px);
        }

        /* ── Table view (kept for toggle) ── */
        .ath-th { display:grid; grid-template-columns:2.2fr 1fr 1.1fr 1fr 1fr 0.5fr 1fr 1fr; gap:8px; padding:12px 20px; background:var(--surface2); border-bottom:1px solid var(--border); }
        .ath-tr { display:grid; grid-template-columns:2.2fr 1fr 1.1fr 1fr 1fr 0.5fr 1fr 1fr; gap:8px; align-items:center; padding:12px 20px; border-bottom:1px solid var(--border); }

        /* ── View toggle buttons ── */
        .view-toggle { display:flex; gap:4px; background:var(--surface2); border-radius:var(--r-md); padding:3px; border:1px solid var(--border); }
        .view-btn { padding:6px 12px; border-radius:6px; border:none; cursor:pointer; font-size:12px; font-weight:600; font-family:var(--font); transition:all 0.15s; }
        .view-btn-active { background:#fff; color:var(--blue); box-shadow:0 1px 4px rgba(0,0,0,0.1); }
        .view-btn-inactive { background:transparent; color:var(--text3); }

        /* ── Modal ── */
        .modal-g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

        @media(max-width:900px) {
          .ath-card-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
        }
        @media(max-width:768px) {
          .ath-outer { padding:16px 12px !important; }
          .ath-filters input, .ath-filters select { max-width:100% !important; width:100% !important; }
          .ath-card-grid { grid-template-columns: 1fr; }
          .ath-th { display:none !important; }
          .ath-tr { grid-template-columns:auto 1fr auto !important; gap:10px !important; padding:12px 14px !important; }
          .ath-hide { display:none !important; }
          .modal-g2 { grid-template-columns:1fr !important; }
          .modal-inner { padding:16px !important; }
          .view-toggle { display:none; }
        }
      `}</style>

      <div className="ath-outer">
        <PageHeader
          label="Squad Registry"
          title="Athletes"
          subtitle={`${filtered.length} of ${athletes.length} athlete${athletes.length!==1?'s':''} registered`}
          action={<button className="btn-blue" onClick={openAdd}>+ Register Athlete</button>}
        />

        {/* ── Filters + view toggle ── */}
        <div className="ath-filters fade-up">
          <input
            placeholder="🔍 Search name, club, region…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, maxWidth:300 }}
            onFocus={e => e.target.style.borderColor='var(--blue)'}
            onBlur={e  => e.target.style.borderColor='var(--border)'}
          />
          <select value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ ...inp, maxWidth:180 }}>
            <option value="">All Positions</option>
            {Object.entries(POSITION_GROUPS).map(([group, positions]) => (
              <optgroup key={group} label={group}>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={statFilter} onChange={e => setStatFilter(e.target.value)} style={{ ...inp, maxWidth:140 }}>
            <option value="">All Statuses</option>
            {['Active','Injured','Suspended'].map(s => <option key={s}>{s}</option>)}
          </select>
          {(search||posFilter||statFilter) && (
            <button
              onClick={() => { setSearch(''); setPosFilter(''); setStatFilter('') }}
              style={{ ...inp, width:'auto', cursor:'pointer', background:'var(--surface3)', fontWeight:600, color:'var(--text2)' }}
            >
              ✕ Clear
            </button>
          )}

          {/* View toggle — pushed to the right */}
          <div style={{ marginLeft:'auto' }}>
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode==='cards' ? 'view-btn-active' : 'view-btn-inactive'}`}
                onClick={() => setViewMode('cards')}
              >
                ⊞ Cards
              </button>
              <button
                className={`view-btn ${viewMode==='table' ? 'view-btn-active' : 'view-btn-inactive'}`}
                onClick={() => setViewMode('table')}
              >
                ☰ Table
              </button>
            </div>
          </div>
        </div>

        {/* ══════════ CARD GRID VIEW ══════════ */}
        {viewMode === 'cards' && (
          <>
            {loading ? (
              <div style={{ padding:'80px', textAlign:'center' }}>
                <div style={{ width:34, height:34, border:'4px solid var(--blue-light)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }}/>
                <p style={{ color:'var(--text3)', fontSize:13 }}>Loading athletes…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'64px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>
                {athletes.length === 0
                  ? 'No athletes registered yet. Click "+ Register Athlete" to start.'
                  : 'No athletes match your search.'}
              </div>
            ) : (
              <div className="ath-card-grid fade-up fade-up-1">
                {filtered.map((ath, i) => (
                  <div key={ath.id} className="ath-card-wrap">

                    {/* Edit / Delete overlay — appears on card hover */}
                    <div className="ath-card-overlay">
                      <button
                        className="ath-card-act"
                        onClick={() => openEdit(ath)}
                        style={{ background:'rgba(255,255,255,0.92)', color:'var(--blue)', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}
                      >
                        Edit
                      </button>
                      <button
                        className="ath-card-act"
                        onClick={() => handleDelete(ath.id, ath.name)}
                        disabled={deleting === ath.id}
                        style={{ background:'rgba(255,255,255,0.92)', color:'var(--danger)', boxShadow:'0 2px 8px rgba(0,0,0,0.12)', opacity: deleting===ath.id ? 0.5 : 1 }}
                      >
                        {deleting === ath.id ? '…' : 'Del'}
                      </button>
                    </div>

                    <AthleteCard
                      athlete={ath}
                      index={i}
                      href={`/athletes/${ath.id}`}
                      stats={{
                        matches:   ath.match_count   ?? '—',
                        goals:     ath.goal_count    ?? '—',
                        assists:   ath.assist_count  ?? '—',
                        avgRating: ath.avg_rating    ?? '—',
                      }}
                      onConnect={() => {
                        // wire up your connect / follow logic here
                        console.log('connect', ath.id)
                      }}
                      onContact={() => {
                        if (ath.phone) window.location.href = `tel:${ath.phone}`
                        else if (ath.email) window.location.href = `mailto:${ath.email}`
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════ TABLE VIEW ══════════ */}
        {viewMode === 'table' && (
          <div className="card fade-up fade-up-1" style={{ overflow:'hidden' }}>
            <div className="ath-th">
              {['Athlete','Position','Club','Region','Coach','Age','Status','Actions'].map(h => (
                <div key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding:'60px', textAlign:'center' }}>
                <div style={{ width:30, height:30, border:'4px solid var(--blue-light)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 10px' }}/>
                <p style={{ color:'var(--text3)', fontSize:13 }}>Loading athletes…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'48px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>
                {athletes.length === 0 ? 'No athletes registered yet.' : 'No athletes match your search.'}
              </div>
            ) : filtered.map((ath, i) => {
              const bg = AV_COLORS[i % AV_COLORS.length]
              return (
                <div
                  key={ath.id}
                  className="ath-tr"
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, background: ath.photo_url ? 'transparent' : bg, overflow:'hidden', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff' }}>
                      {ath.photo_url
                        ? <img src={ath.photo_url} alt={ath.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none' }}/>
                        : initials(ath.name)
                      }
                    </div>
                    <div>
                      <Link href={`/athletes/${ath.id}`} style={{ fontSize:13, fontWeight:700, color:'var(--blue-dark)', display:'block', marginBottom:1 }}>{ath.name}</Link>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>{ath.club||'—'}</span>
                    </div>
                  </div>
                  <div className="ath-hide" style={{ fontSize:12, fontWeight:700, color:'var(--blue-dark)', background:'var(--blue-light)', padding:'3px 8px', borderRadius:6, width:'fit-content' }}>{ath.position||'—'}</div>
                  <div className="ath-hide" style={{ fontSize:13, color:'var(--text)' }}>{ath.club||'—'}</div>
                  <div className="ath-hide" style={{ fontSize:13, color:'var(--text2)' }}>{ath.region||'—'}</div>
                  <div className="ath-hide" style={{ fontSize:12, color:'var(--text2)' }}>{ath.coaches?.name?.replace('Coach ','')||'—'}</div>
                  <div className="ath-hide" style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>{ath.age||'—'}</div>
                  <div>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99,
                      background: ath.status==='Active'?'#E8F8EE':ath.status==='Injured'?'#FEE8E8':'#FEF9E7',
                      color: ath.status==='Active'?'#1B6B3A':ath.status==='Injured'?'#8B2020':'#B7770D'
                    }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor' }}/>
                      {ath.status||'Active'}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(ath)} style={{ background:'var(--blue-light)', color:'var(--blue)', border:'none', padding:'5px 11px', borderRadius:'var(--r-sm)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Edit</button>
                    <button onClick={() => handleDelete(ath.id, ath.name)} disabled={deleting===ath.id} style={{ background:'var(--danger-light)', color:'var(--danger)', border:'none', padding:'5px 11px', borderRadius:'var(--r-sm)', fontSize:12, fontWeight:600, cursor:'pointer', opacity:deleting===ath.id?0.5:1, fontFamily:'var(--font)' }}>
                      {deleting===ath.id ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══════════ MODAL ══════════ */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(44,62,80,0.6)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--r-xl)', width:'100%', maxWidth:580, maxHeight:'92vh', overflow:'auto', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>

            <div style={{ background:'linear-gradient(90deg,#2E6FC4,#4A90E2)', padding:'18px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:3 }}>{editId ? 'Edit Record' : 'New Registration'}</div>
                <h2 style={{ fontSize:18, fontWeight:800, color:'#fff' }}>{editId ? 'Edit Athlete' : 'Register Athlete'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', width:36, height:36, borderRadius:'50%', fontSize:18, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div className="modal-inner" style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
              {formError && (
                <div style={{ background:'var(--danger-light)', border:'1px solid rgba(231,76,60,0.25)', borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:13, color:'var(--danger)', fontWeight:600 }}>⚠ {formError}</div>
              )}

              {/* Photo */}
              <div>
                <label style={lbl}>Profile Photo</label>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--surface2)', border:'3px dashed var(--border-md)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {photoPreview ? <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:28 }}>👤</span>}
                  </div>
                  <div>
                    <label htmlFor="photo-upload" style={{ display:'inline-block', background:'var(--blue-light)', color:'var(--blue)', border:'1px solid rgba(74,144,226,0.3)', padding:'7px 16px', borderRadius:'var(--r-sm)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {photoPreview ? 'Change' : 'Upload Photo'}
                    </label>
                    <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }}/>
                    {photoPreview && (
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ marginLeft:8, background:'var(--danger-light)', color:'var(--danger)', border:'none', padding:'6px 12px', borderRadius:'var(--r-sm)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={lbl}>Full Name *</label>
                <input value={form.name} onChange={e => set('name')(e.target.value)} style={inp} placeholder="e.g. Kwame Asante"
                  onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
              </div>

              {/* Age + Position */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Age</label>
                  <input type="number" min="14" max="50" value={form.age} onChange={e => set('age')(e.target.value)} style={inp}
                    onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
                </div>
                <div>
                  <label style={lbl}>Position *</label>
                  <select value={form.position} onChange={e => set('position')(e.target.value)} style={inp}>
                    <option value="">Select position…</option>
                    {Object.entries(POSITION_GROUPS).map(([group, positions]) => (
                      <optgroup key={group} label={`── ${group} ──`}>
                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Strong foot */}
              <div>
                <label style={lbl}>Strong Foot</label>
                <select value={form.strong_foot} onChange={e => set('strong_foot')(e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  <option value="right">🦶 Right Foot</option>
                  <option value="left">🦶 Left Foot</option>
                  <option value="both">🦶 Both Feet</option>
                </select>
              </div>

              {/* Club */}
              <div>
                <label style={lbl}>Club / Team</label>
                <input value={form.club} onChange={e => set('club')(e.target.value)} style={inp} placeholder="e.g. Asante Kotoko SC"
                  onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
              </div>

              {/* Region */}
              <div>
                <label style={lbl}>Region</label>
                <select value={form.region} onChange={e => set('region')(e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {REGIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label style={lbl}>Phone</label>
                <input value={form.phone} onChange={e => set('phone')(e.target.value)} style={inp} placeholder="+233 24 000 0000"
                  onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
              </div>

              {/* Coach */}
              <div>
                <label style={lbl}>Assign Coach</label>
                <select value={form.coach_id} onChange={e => set('coach_id')(e.target.value)} style={inp}>
                  <option value="">No coach assigned</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Height + Weight */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Height (cm)</label>
                  <input type="number" value={form.height} onChange={e => set('height')(e.target.value)} style={inp}
                    onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
                </div>
                <div>
                  <label style={lbl}>Weight (kg)</label>
                  <input type="number" value={form.weight} onChange={e => set('weight')(e.target.value)} style={inp}
                    onFocus={e => e.target.style.borderColor='var(--blue)'} onBlur={e => e.target.style.borderColor='var(--border)'}/>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, paddingTop:8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text2)', padding:'12px', borderRadius:'var(--r-md)', fontSize:14, cursor:'pointer', fontWeight:600, fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex:2, padding:'12px', opacity:saving?0.7:1, fontSize:14 }}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Register Athlete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}