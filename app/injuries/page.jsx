'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'

const EMPTY = {
  athlete_id:'', injury_type:'', severity:'Mild',
  date_of_injury: new Date().toISOString().split('T')[0],
  expected_return:'', notes:'', status:'Active',
}
const STATUS_OPTS   = ['Active','Recovered']
const SEVERITY_OPTS = ['Mild','Moderate','Severe']
const SEVERITY_STYLES = {
  Mild:     { bg:'#E8F8EE', color:'#1B7A3E', dot:'#27AE60' },
  Moderate: { bg:'#FEF9E7', color:'#B36200', dot:'#F39C12' },
  Severe:   { bg:'#FDEDEC', color:'#C0392B', dot:'#E74C3C' },
}
const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=44, index=0 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(255,255,255,0.4)',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:AV_COLORS[index%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#fff',border:'2px solid rgba(255,255,255,0.2)' }}>
      {initials(ath?.name)}
    </div>
  )
}

function PostStamp({ loggedBy, loggedAt, updatedBy, updatedAt }) {
  const fmt = d => !d ? null : new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  if (!loggedBy&&!loggedAt&&!updatedBy) return null
  return (
    <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
      {(loggedBy||loggedAt)&&(
        <div style={{ display:'inline-flex',alignItems:'center',gap:5,background:'rgba(74,144,226,0.08)',border:'1px solid rgba(74,144,226,0.18)',borderRadius:99,padding:'4px 12px' }}>
          <div style={{ width:18,height:18,borderRadius:'50%',background:'linear-gradient(135deg,#4A90E2,#2E6FC4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><span style={{ fontSize:9,color:'#fff' }}>✍</span></div>
          {loggedBy&&<span style={{ fontSize:11,fontWeight:700,color:'#2E6FC4' }}>{loggedBy}</span>}
          {loggedAt&&<span style={{ fontSize:10,color:'#7A9CC4' }}>· {fmt(loggedAt)}</span>}
        </div>
      )}
      {updatedBy&&(
        <div style={{ display:'inline-flex',alignItems:'center',gap:5,background:'rgba(155,89,182,0.08)',border:'1px solid rgba(155,89,182,0.18)',borderRadius:99,padding:'4px 12px' }}>
          <div style={{ width:18,height:18,borderRadius:'50%',background:'linear-gradient(135deg,#9B59B6,#7D3C98)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><span style={{ fontSize:9,color:'#fff' }}>✏</span></div>
          <span style={{ fontSize:11,fontWeight:700,color:'#7D3C98' }}>{updatedBy}</span>
          {updatedAt&&<span style={{ fontSize:10,color:'#9B59B6' }}>· {fmt(updatedAt)}</span>}
        </div>
      )}
    </div>
  )
}

function InlineSelect({ value, options, onSave, renderValue }) {
  const [ed,setEd]=useState(false)
  if (ed) return <select autoFocus defaultValue={value} onChange={e=>{onSave(e.target.value);setEd(false)}} onBlur={()=>setEd(false)} style={{ padding:'4px 8px',border:'1px solid var(--blue)',borderRadius:6,fontSize:13,outline:'none',fontFamily:'var(--font)',background:'var(--surface)',color:'var(--text)' }}>{options.map(o=><option key={o}>{o}</option>)}</select>
  return <div onClick={()=>setEd(true)} style={{ cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4 }} title="Click to edit">{renderValue()}<span style={{ fontSize:10,color:'var(--text3)',opacity:0.5 }}>✏</span></div>
}

function InlineText({ value, onSave, style={} }) {
  const [ed,setEd]=useState(false)
  if (ed) return <input autoFocus defaultValue={value} style={{ padding:'4px 8px',border:'1px solid var(--blue)',borderRadius:6,fontSize:13,outline:'none',fontFamily:'var(--font)',background:'var(--surface)',color:'var(--text)',...style }} onBlur={e=>{onSave(e.target.value);setEd(false)}} onKeyDown={e=>{if(e.key==='Enter'){onSave(e.target.value);setEd(false)}if(e.key==='Escape')setEd(false)}}/>
  return <div onClick={()=>setEd(true)} style={{ cursor:'text',display:'inline-flex',alignItems:'center',gap:4,...style }} title="Click to edit"><span>{value||'—'}</span><span style={{ fontSize:10,color:'var(--text3)',opacity:0.5 }}>✏</span></div>
}

const inp = { width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)' }
const lbl = { display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6 }

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
  const [hasStamp,    setHasStamp]    = useState(false)

  const fetchData = useCallback(async () => {
    const { data:{session} } = await supabase.auth.getSession()
    if (session) {
      const { data:p } = await supabase.from('profiles').select('id,full_name,role').eq('id',session.user.id).single()
      setCurrentUser(p)
    }
    const { data:ath } = await supabase.from('athletes').select('id,name,position,photo_url').order('name')
    setAthletes(ath||[])

    const r1 = await supabase.from('injuries')
      .select('*,athletes(name,position,club,id,photo_url),logged_profile:logged_by(full_name),updated_profile:updated_by(full_name)')
      .order('date_of_injury',{ascending:false})

    if (!r1.error) { setInjuries(r1.data||[]); setHasStamp(true) }
    else {
      const r2 = await supabase.from('injuries').select('*,athletes(name,position,club,id,photo_url)').order('date_of_injury',{ascending:false})
      setInjuries(r2.data||[]); setHasStamp(false)
    }
  }, [])

  useEffect(()=>{fetchData()},[fetchData])

  const set = k => v => setForm(f=>({...f,[k]:v}))

  function openAdd(){ setEditId(null);setForm(EMPTY);setShowForm(true) }
  function openEdit(inj){
    setEditId(inj.id)
    setForm({athlete_id:inj.athlete_id||'',injury_type:inj.injury_type||'',severity:inj.severity||'Mild',date_of_injury:inj.date_of_injury||'',expected_return:inj.expected_return||'',notes:inj.notes||'',status:inj.status||'Active'})
    setShowForm(true)
  }

  async function handleSave(){
    if (!form.athlete_id) return alert('Select an athlete.')
    if (!form.injury_type.trim()) return alert('Injury type required.')
    setSaving(true)
    const now=new Date().toISOString(), userId=currentUser?.id||null
    const base={...form}
    if (hasStamp){if(editId){base.updated_by=userId;base.updated_at=now}else{base.logged_by=userId;base.logged_at=now}}
    if (editId){
      const {error}=await supabase.from('injuries').update(base).eq('id',editId)
      if (error) alert(error.message)
      else{setShowForm(false);fetchData()}
    } else {
      const {error}=await supabase.from('injuries').insert([{...base,status:'Active'}])
      if (!error) await supabase.from('athletes').update({status:'Injured'}).eq('id',form.athlete_id)
      if (error) alert(error.message)
      else{setShowForm(false);setForm(EMPTY);fetchData()}
    }
    setSaving(false)
  }

  async function handleDelete(id){
    if (!confirm('Delete this injury record?'))return
    setDeleting(id)
    const {error}=await supabase.from('injuries').delete().eq('id',id)
    if (error) alert('Delete failed: '+error.message)
    else fetchData()
    setDeleting(null)
  }

  async function markRecovered(id,athleteId){
    const update={status:'Recovered'}
    if (hasStamp){update.updated_by=currentUser?.id||null;update.updated_at=new Date().toISOString()}
    await supabase.from('injuries').update(update).eq('id',id)
    await supabase.from('athletes').update({status:'Active'}).eq('id',athleteId)
    fetchData()
  }

  async function saveField(id,field,value,athleteId){
    const update={[field]:value}
    if (hasStamp){update.updated_by=currentUser?.id||null;update.updated_at=new Date().toISOString()}
    if (field==='status'&&value==='Recovered'&&athleteId) await supabase.from('athletes').update({status:'Active'}).eq('id',athleteId)
    if (field==='status'&&value==='Active'&&athleteId) await supabase.from('athletes').update({status:'Injured'}).eq('id',athleteId)
    const {error}=await supabase.from('injuries').update(update).eq('id',id)
    if (error) alert('Update failed: '+error.message)
    else fetchData()
  }

  const filtered=filter==='All'?injuries:injuries.filter(i=>i.status===filter)
  const activeCnt=injuries.filter(i=>i.status==='Active').length
  const recovCnt=injuries.filter(i=>i.status==='Recovered').length
  const nowStr=new Date().toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  return (
    <Layout>
      <div style={{ maxWidth:1280,margin:'0 auto',padding:'32px 40px' }}>
        <PageHeader label="Medical Records" title="Injury Register" subtitle={`${activeCnt} active · ${recovCnt} recovered`}
          action={<button className="btn-blue" onClick={openAdd} style={{ background:'linear-gradient(135deg,#C0392B,#E74C3C)',boxShadow:'0 4px 14px rgba(231,76,60,0.35)' }}>+ Log Injury</button>}/>

        {/* Stats */}
        <div className="fade-up" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24 }}>
          {[
            {label:'Total Records',  value:injuries.length, icon:'📋', color:'#4A90E2', bg:'#E8F4FF'},
            {label:'Active Injuries',value:activeCnt,       icon:'🚨', color:'#E74C3C', bg:'#FDEDEC'},
            {label:'Recovered',      value:recovCnt,        icon:'✅', color:'#27AE60', bg:'#E8F8EE'},
          ].map(s=>(
            <div key={s.label} className="card" style={{ padding:'18px 22px',display:'flex',alignItems:'center',gap:16,borderLeft:`4px solid ${s.color}` }}>
              <div style={{ width:48,height:48,borderRadius:14,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:30,fontWeight:900,color:s.color,lineHeight:1,letterSpacing:'-0.02em' }}>{s.value}</div>
                <div style={{ fontSize:12,color:'var(--text3)',fontWeight:600,marginTop:3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="fade-up" style={{ display:'flex',gap:4,marginBottom:20,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:4,width:'fit-content' }}>
          {['All','Active','Recovered'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'8px 22px',background:f==='Active'&&filter===f?'linear-gradient(135deg,#C0392B,#E74C3C)':filter===f?'var(--blue)':'transparent',border:'none',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,color:filter===f?'#fff':'var(--text2)',cursor:'pointer',transition:'var(--transition)',fontFamily:'var(--font)' }}>{f}</button>
          ))}
        </div>

        {/* Injury cards */}
        {filtered.length===0?(
          <div className="card" style={{ padding:'48px',textAlign:'center',color:'var(--text3)',fontSize:14 }}>No injury records found.</div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {filtered.map((inj,idx)=>{
              const ss=SEVERITY_STYLES[inj.severity]||SEVERITY_STYLES.Mild
              const isAct=inj.status==='Active'
              return(
                <div key={inj.id} className="card fade-up" style={{ padding:0,overflow:'hidden',borderLeft:`4px solid ${isAct?'#E74C3C':'#27AE60'}`,transition:'var(--transition)' }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-md)'}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow-sm)'}>

                  <div style={{ display:'grid',gridTemplateColumns:'2.2fr 1.8fr 1.1fr 1.1fr 1fr 1fr',gap:0 }}>

                    {/* Athlete with photo */}
                    <div style={{ padding:'16px 18px',borderRight:'1px solid var(--border)',display:'flex',alignItems:'flex-start',gap:12 }}>
                      <AthleteAvatar ath={inj.athletes} size={46} index={idx}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14,fontWeight:800,color:'var(--text)',marginBottom:3 }}>{inj.athletes?.name}</div>
                        <div style={{ fontSize:11,color:'var(--text3)',marginBottom:8 }}>{inj.athletes?.position}{inj.athletes?.club?` · ${inj.athletes.club}`:''}</div>
                        <InlineText value={inj.injury_type} onSave={v=>saveField(inj.id,'injury_type',v,inj.athletes?.id)} style={{ fontSize:13,fontWeight:700,color:'var(--text)',background:'var(--surface2)',padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)' }}/>
                      </div>
                    </div>

                    {/* Severity + Status */}
                    <div style={{ padding:'16px 16px',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:12 }}>
                      <div>
                        <div style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Severity</div>
                        <InlineSelect value={inj.severity} options={SEVERITY_OPTS} onSave={v=>saveField(inj.id,'severity',v,inj.athletes?.id)}
                          renderValue={()=>(
                            <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:ss.bg,color:ss.color,padding:'5px 12px',borderRadius:99,fontSize:12,fontWeight:700,border:`1px solid ${ss.dot}30` }}>
                              <div style={{ width:7,height:7,borderRadius:'50%',background:ss.dot,boxShadow:`0 0 5px ${ss.dot}` }}/>{inj.severity}
                            </div>
                          )}/>
                      </div>
                      <div>
                        <div style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Status</div>
                        <InlineSelect value={inj.status} options={STATUS_OPTS} onSave={v=>saveField(inj.id,'status',v,inj.athletes?.id)}
                          renderValue={()=>(
                            <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:isAct?'#FDEDEC':'#E8F8EE',color:isAct?'#C0392B':'#1B7A3E',padding:'5px 12px',borderRadius:99,fontSize:12,fontWeight:700 }}>
                              <div style={{ width:7,height:7,borderRadius:'50%',background:isAct?'#E74C3C':'#27AE60',boxShadow:`0 0 5px ${isAct?'#E74C3C':'#27AE60'}` }}/>{inj.status}
                            </div>
                          )}/>
                      </div>
                    </div>

                    {/* Injured date */}
                    <div style={{ padding:'16px 14px',borderRight:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Injured</div>
                      <InlineText value={inj.date_of_injury} onSave={v=>saveField(inj.id,'date_of_injury',v,inj.athletes?.id)} style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}/>
                    </div>

                    {/* Return date */}
                    <div style={{ padding:'16px 14px',borderRight:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Return</div>
                      <InlineText value={inj.expected_return||''} onSave={v=>saveField(inj.id,'expected_return',v,inj.athletes?.id)} style={{ fontSize:13,fontWeight:600,color:inj.expected_return?'var(--text)':'var(--text3)' }}/>
                    </div>

                    {/* Notes */}
                    <div style={{ padding:'16px 14px',borderRight:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Notes</div>
                      <div style={{ fontSize:11,color:'var(--text2)',lineHeight:1.5,fontStyle:inj.notes?'normal':'italic' }}>{inj.notes||'—'}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ padding:'14px 12px',display:'flex',flexDirection:'column',gap:6,justifyContent:'center' }}>
                      <button onClick={()=>openEdit(inj)} style={{ background:'var(--blue-light)',color:'var(--blue)',border:'none',padding:'6px 0',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',width:'100%' }}>Edit</button>
                      {isAct&&<button onClick={()=>markRecovered(inj.id,inj.athlete_id)} style={{ background:'#E8F8EE',color:'#1B7A3E',border:'none',padding:'6px 0',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',width:'100%' }}>✓ Done</button>}
                      <button onClick={()=>handleDelete(inj.id)} disabled={deleting===inj.id} style={{ background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'6px 0',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer',opacity:deleting===inj.id?0.5:1,fontFamily:'var(--font)',width:'100%' }}>{deleting===inj.id?'…':'Delete'}</button>
                    </div>
                  </div>

                  {/* Stamp footer */}
                  {(inj.logged_profile?.full_name||inj.logged_at)&&(
                    <div style={{ padding:'8px 18px 12px',background:'var(--surface2)',borderTop:'1px solid var(--border)' }}>
                      <PostStamp loggedBy={inj.logged_profile?.full_name} loggedAt={inj.logged_at} updatedBy={inj.updated_profile?.full_name} updatedAt={inj.updated_at}/>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p style={{ fontSize:11,color:'var(--text3)',marginTop:12 }}>💡 Click any field to edit inline.</p>
      </div>

      {/* Modal */}
      {showForm&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(44,62,80,0.55)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'var(--surface)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:520,maxHeight:'92vh',overflow:'auto',boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)' }}>
            <div style={{ padding:'20px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(90deg,#C0392B,#E74C3C)' }}>
              <h2 style={{ fontSize:20,fontWeight:800,color:'#fff' }}>{editId?'Edit Injury':'Log Injury'}</h2>
              <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)',border:'none',width:34,height:34,borderRadius:'50%',fontSize:18,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:28,display:'flex',flexDirection:'column',gap:16 }}>
              <div>
                <label style={lbl}>Athlete *</label>
                <select value={form.athlete_id} onChange={e=>set('athlete_id')(e.target.value)} style={inp} disabled={!!editId}>
                  <option value="">Select athlete…</option>
                  {athletes.map(a=><option key={a.id} value={a.id}>{a.name} — {a.position}</option>)}
                </select>
                {form.athlete_id&&(()=>{
                  const ath=athletes.find(a=>a.id===form.athlete_id)
                  if (!ath) return null
                  return (
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginTop:8,padding:'8px 12px',background:'var(--surface2)',borderRadius:'var(--r-sm)',border:'1px solid var(--border)' }}>
                      <AthleteAvatar ath={ath} size={32} index={0}/>
                      <span style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}>{ath.name}</span>
                      <span style={{ fontSize:11,color:'var(--text3)' }}>{ath.position}</span>
                    </div>
                  )
                })()}
              </div>
              <div><label style={lbl}>Injury Type *</label><input value={form.injury_type} onChange={e=>set('injury_type')(e.target.value)} placeholder="e.g. Hamstring Strain" style={inp} onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div><label style={lbl}>Severity</label><select value={form.severity} onChange={e=>set('severity')(e.target.value)} style={inp}>{SEVERITY_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={lbl}>Status</label><select value={form.status||'Active'} onChange={e=>set('status')(e.target.value)} style={inp}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div><label style={lbl}>Date of Injury *</label><input type="date" value={form.date_of_injury} onChange={e=>set('date_of_injury')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Expected Return</label><input type="date" value={form.expected_return} onChange={e=>set('expected_return')(e.target.value)} style={inp}/></div>
              </div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={3} placeholder="Treatment notes…" style={{ ...inp,resize:'vertical' }}/></div>
              {currentUser&&(
                <div style={{ background:'linear-gradient(135deg,rgba(74,144,226,0.08),rgba(74,144,226,0.03))',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid rgba(74,144,226,0.2)',position:'relative',overflow:'hidden' }}>
                  <div style={{ position:'absolute',top:0,left:0,width:3,height:'100%',background:'linear-gradient(180deg,#E74C3C,#4A90E2)',borderRadius:'3px 0 0 3px' }}/>
                  <div style={{ fontSize:11,color:'var(--blue-dark)',fontWeight:700,marginBottom:4 }}>📋 Will be stamped as:</div>
                  <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(74,144,226,0.1)',borderRadius:99,padding:'4px 12px' }}>
                    <span style={{ fontSize:12 }}>✍</span>
                    <span style={{ fontSize:12,fontWeight:700,color:'#2E6FC4' }}>{currentUser.full_name}</span>
                    <span style={{ fontSize:11,color:'#7A9CC4' }}>· {nowStr}</span>
                  </div>
                </div>
              )}
              <div style={{ display:'flex',gap:10,paddingTop:8 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'11px',borderRadius:'var(--r-md)',fontSize:14,cursor:'pointer',fontWeight:600,fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex:2,padding:'11px',background:'linear-gradient(135deg,#C0392B,#E74C3C)',opacity:saving?0.7:1,fontSize:14 }}>{saving?'Saving…':editId?'Save Changes':'Log Injury'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}