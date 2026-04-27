'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SESSION_TYPES = ['Squad Training','Strength & Conditioning','Tactical Drills','Recovery Session','Match Preparation','Friendly Match','Fitness Test','Video Analysis']
const VENUES = ['Training Ground','Fitness Center','Pitch A','Pitch B','Aquatic Centre','Conference Room','Medical Room']
const COLORS = { 'Squad Training':'#4A90E2', 'Strength & Conditioning':'#27AE60', 'Tactical Drills':'#9B59B6', 'Recovery Session':'#1ABC9C', 'Match Preparation':'#E67E22', 'Friendly Match':'#E74C3C', 'Fitness Test':'#F39C12', 'Video Analysis':'#7F8C8D' }
const EMPTY_SESSION = { title:'', type:'Squad Training', date:'', time:'09:00', duration:90, venue:'Training Ground', coach_id:'', notes:'' }

const inp = { width:'100%', padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:14, outline:'none', color:'var(--text)', fontFamily:'var(--font)' }
const lbl = { display:'block', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }

export default function SchedulePage() {
  const [sessions,   setSessions]   = useState([])
  const [coaches,    setCoaches]    = useState([])
  const [athletes,   setAthletes]   = useState([])
  const [today]      = useState(new Date())
  const [viewDate,   setViewDate]   = useState(new Date())
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [form,       setForm]       = useState(EMPTY_SESSION)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(null)
  const [view,       setView]       = useState('month')

  const fetchData = useCallback(async () => {
    const [{ data: s }, { data: c }, { data: a }] = await Promise.all([
      supabase.from('training_sessions').select('*').order('date', { ascending: true }),
      supabase.from('coaches').select('id,name'),
      supabase.from('athletes').select('id,name'),
    ])
    setSessions(s || []); setCoaches(c || []); setAthletes(a || [])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  function openAdd(dateStr) {
    setEditId(null)
    setForm({ ...EMPTY_SESSION, date: dateStr || new Date().toISOString().split('T')[0] })
    setShowForm(true)
  }

  function openEdit(s) {
    setEditId(s.id)
    setForm({ title:s.title||'', type:s.type||'Squad Training', date:s.date||'', time:s.time||'09:00', duration:s.duration||90, venue:s.venue||'Training Ground', coach_id:s.coach_id||'', notes:s.notes||'' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.date) return alert('Date is required.')
    if (!form.title.trim()) return alert('Session title is required.')
    setSaving(true)
    const payload = { ...form, duration: parseInt(form.duration) || 90 }
    if (editId) {
      const { error } = await supabase.from('training_sessions').update(payload).eq('id', editId)
      if (error) alert(error.message)
      else { setShowForm(false); fetchData() }
    } else {
      const { error } = await supabase.from('training_sessions').insert([payload])
      if (error) alert(error.message)
      else { setShowForm(false); setForm(EMPTY_SESSION); fetchData() }
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this session?')) return
    setDeleting(id)
    const { error } = await supabase.from('training_sessions').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchData()
    setDeleting(null)
  }

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function getSessionsForDate(y, m, d) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return sessions.filter(s => s.date === dateStr)
  }

  function isToday(y, m, d) {
    return today.getFullYear()===y && today.getMonth()===m && today.getDate()===d
  }

  const upcoming = sessions.filter(s => {
    const d = new Date(s.date)
    const diff = (d - today) / (1000*60*60*24)
    return diff >= 0 && diff <= 7
  }).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  return (
    <Layout>
      <style>{`
        .sch-outer{max-width:1280px;margin:0 auto;padding:32px 40px}
        .sch-grid{display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start}
        .sch-nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
        .list-th{display:grid;grid-template-columns:0.8fr 1.5fr 1fr 1fr 1fr 0.8fr 1fr;gap:8px;padding:12px 20px;background:var(--surface2);border-bottom:1px solid var(--border)}
        .list-tr{display:grid;grid-template-columns:0.8fr 1.5fr 1fr 1fr 1fr 0.8fr 1fr;gap:8px;align-items:center;padding:13px 20px;border-bottom:1px solid var(--border)}
        .modal-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
        @media(max-width:768px){
          .sch-outer{padding:14px 12px!important}
          .sch-grid{grid-template-columns:1fr!important;gap:14px!important}
          .sch-nav{flex-direction:column!important;align-items:flex-start!important}
          .list-th{display:none!important}
          .list-tr{grid-template-columns:1fr auto!important;gap:6px!important;padding:12px!important}
          .list-hide{display:none!important}
          .modal-g3{grid-template-columns:1fr!important}
          .cal-cell{min-height:60px!important}
        }
      `}</style>

      <div className="sch-outer">
        <PageHeader label="Training Schedule" title="Schedule" subtitle="Manage and track all training sessions"
          action={<button className="btn-blue" onClick={() => openAdd()}>+ New Session</button>}/>

        <div className="sch-nav">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))} style={{ width:36, height:36, borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <h2 style={{ fontSize:18, fontWeight:700, minWidth:180, textAlign:'center' }}>{MONTHS[month]} {year}</h2>
            <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))} style={{ width:36, height:36, borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
            <button onClick={() => setViewDate(new Date())} style={{ padding:'7px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:12, fontWeight:600, color:'var(--blue)' }}>Today</button>
          </div>
          <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:4 }}>
            {['month','list'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'7px 18px', background:view===v?'var(--blue)':'transparent', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:600, color:view===v?'#fff':'var(--text2)', cursor:'pointer', transition:'var(--transition)', textTransform:'capitalize' }}>{v}</button>
            ))}
          </div>
        </div>

        <div className="sch-grid">
          <div>
            {view === 'month' ? (
              <div className="card fade-up" style={{ overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'linear-gradient(90deg,#2E6FC4,#4A90E2)' }}>
                  {DAYS.map(d => <div key={d} style={{ padding:'10px 4px', textAlign:'center', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--surface)' }}>
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} style={{ minHeight:80, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}/>
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const daySessions = getSessionsForDate(year, month, day)
                    const isTod = isToday(year, month, day)
                    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    return (
                      <div key={day} className="cal-cell" onClick={() => openAdd(dateStr)}
                        style={{ minHeight:100, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'6px', cursor:'pointer', background:isTod?'#E8F4FF':'' }}
                        onMouseEnter={e=>e.currentTarget.style.background=isTod?'#d4ebff':'var(--surface2)'}
                        onMouseLeave={e=>e.currentTarget.style.background=isTod?'#E8F4FF':''}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:isTod?'var(--blue)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:isTod?800:500, color:isTod?'#fff':'var(--text)', marginBottom:3 }}>{day}</div>
                        {daySessions.slice(0,2).map(s => (
                          <div key={s.id} onClick={e=>{e.stopPropagation();openEdit(s)}}
                            style={{ fontSize:9, fontWeight:600, background:(COLORS[s.type]||'#4A90E2')+'20', color:COLORS[s.type]||'#4A90E2', padding:'1px 4px', borderRadius:3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderLeft:`2px solid ${COLORS[s.type]||'#4A90E2'}`, cursor:'pointer' }}>
                            {s.time} {s.title}
                          </div>
                        ))}
                        {daySessions.length > 2 && <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600 }}>+{daySessions.length-2}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card fade-up" style={{ overflow:'hidden' }}>
                <div className="list-th">
                  {['Date','Session','Type','Venue','Coach','Dur','Actions'].map(h => (
                    <div key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</div>
                  ))}
                </div>
                {sessions.length === 0 ? (
                  <div style={{ padding:'48px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>No sessions scheduled yet.</div>
                ) : sessions.filter(s => { const d = new Date(s.date); return d.getMonth()===month && d.getFullYear()===year }).map(s => {
                  const coach = coaches.find(c => c.id === s.coach_id)
                  return (
                    <div key={s.id} className="list-tr"
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{s.date}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{s.time}</div>
                      </div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{s.title}</div>
                      <div className="list-hide"><span style={{ fontSize:11, fontWeight:700, background:(COLORS[s.type]||'#4A90E2')+'20', color:COLORS[s.type]||'#4A90E2', padding:'3px 8px', borderRadius:6 }}>{s.type}</span></div>
                      <div className="list-hide" style={{ fontSize:12, color:'var(--text2)' }}>📍 {s.venue}</div>
                      <div className="list-hide" style={{ fontSize:12, color:'var(--text2)' }}>{coach?.name?.replace('Coach ','') || '—'}</div>
                      <div style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>{s.duration}m</div>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={() => openEdit(s)} style={{ background:'var(--blue-light)', color:'var(--blue)', border:'none', padding:'4px 9px', borderRadius:'var(--r-sm)', fontSize:11, fontWeight:600, cursor:'pointer' }}>Edit</button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting===s.id} style={{ background:'var(--danger-light)', color:'var(--danger)', border:'none', padding:'4px 9px', borderRadius:'var(--r-sm)', fontSize:11, fontWeight:600, cursor:'pointer', opacity:deleting===s.id?0.5:1 }}>
                          {deleting===s.id?'…':'Del'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card fade-up" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(90deg,#2E6FC4,#4A90E2)', padding:'14px 18px' }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#fff' }}>Upcoming (7 days)</h3>
              </div>
              <div style={{ padding:'12px 0' }}>
                {upcoming.length === 0 ? (
                  <p style={{ padding:'20px 18px', fontSize:13, color:'var(--text3)', fontStyle:'italic' }}>No sessions in the next 7 days.</p>
                ) : upcoming.map(s => (
                  <div key={s.id} onClick={() => openEdit(s)} style={{ display:'flex', gap:12, padding:'10px 18px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'var(--transition)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <div style={{ width:4, borderRadius:2, background:COLORS[s.type]||'#4A90E2', flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{s.title}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{s.date} · {s.time} · {s.duration}m</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card fade-up fade-up-1" style={{ padding:'16px 18px' }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Session Types</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {Object.entries(COLORS).map(([type, color]) => (
                  <div key={type} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text2)' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
                    {type}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(44,62,80,0.55)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--r-xl)', width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'auto', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
            <div style={{ padding:'20px 28px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(90deg,#2E6FC4,#4A90E2)' }}>
              <h2 style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{editId ? 'Edit Session' : 'New Session'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', width:34, height:34, borderRadius:'50%', fontSize:18, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={lbl}>Session Title *</label><input value={form.title} onChange={e=>set('title')(e.target.value)} style={inp} placeholder="e.g. Morning Squad Training"/></div>
              <div><label style={lbl}>Session Type</label><select value={form.type} onChange={e=>set('type')(e.target.value)} style={inp}>{SESSION_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="modal-g3">
                <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Time</label><input type="time" value={form.time} onChange={e=>set('time')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Duration (min)</label><input type="number" min="15" max="300" value={form.duration} onChange={e=>set('duration')(e.target.value)} style={inp}/></div>
              </div>
              <div><label style={lbl}>Venue</label><select value={form.venue} onChange={e=>set('venue')(e.target.value)} style={inp}>{VENUES.map(v=><option key={v}>{v}</option>)}</select></div>
              <div><label style={lbl}>Assign Coach</label><select value={form.coach_id} onChange={e=>set('coach_id')(e.target.value)} style={inp}><option value="">Select coach…</option>{coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={3} placeholder="Session details…" style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'flex', gap:10, paddingTop:8 }}>
                <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ flex:1, padding:'11px' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex:2, padding:'11px', opacity:saving?0.7:1 }}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Schedule Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}