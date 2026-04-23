'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']
function initials(n){ return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=38, index=0 }) {
  const [err,setErr]=useState(false)
  if (ath?.photo_url&&!err) return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0 }}/>
  return <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:AV_COLORS[index%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#fff' }}>{initials(ath?.name)}</div>
}

const inp={width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)'}
const lbl={display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}
const EMPTY={athlete_id:'',match_date:new Date().toISOString().split('T')[0],opponent:'',minutes_played:90,goals:0,assists:0,shots:0,shots_on_target:0,passes:0,pass_accuracy:0,distance_km:0,sprint_count:0,duels_won:0,duels_total:0,xg:0,xa:0,rating:0,notes:''}

export default function PerformancePage(){
  const [stats,    setStats]    = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [selAth,   setSelAth]   = useState('all')

  const fetchData=useCallback(async()=>{
    setLoading(true)
    const [{data:s},{data:a}]=await Promise.all([
      supabase.from('performance_stats').select('*,athletes(name,position,club,photo_url)').order('match_date',{ascending:false}),
      supabase.from('athletes').select('id,name,position,club,photo_url').order('name'),
    ])
    setStats(s||[]);setAthletes(a||[]);setLoading(false)
  },[])

  useEffect(()=>{fetchData()},[fetchData])

  const set=k=>v=>setForm(f=>({...f,[k]:v}))
  function openAdd(){setEditId(null);setForm(EMPTY);setShowForm(true)}
  function openEdit(s){setEditId(s.id);setForm({athlete_id:s.athlete_id||'',match_date:s.match_date||'',opponent:s.opponent||'',minutes_played:s.minutes_played||0,goals:s.goals||0,assists:s.assists||0,shots:s.shots||0,shots_on_target:s.shots_on_target||0,passes:s.passes||0,pass_accuracy:s.pass_accuracy||0,distance_km:s.distance_km||0,sprint_count:s.sprint_count||0,duels_won:s.duels_won||0,duels_total:s.duels_total||0,xg:s.xg||0,xa:s.xa||0,rating:s.rating||0,notes:s.notes||''});setShowForm(true)}

  async function handleSave(){
    if (!form.athlete_id) return alert('Select athlete.')
    setSaving(true)
    const payload={...form,minutes_played:parseInt(form.minutes_played)||0,goals:parseInt(form.goals)||0,assists:parseInt(form.assists)||0,shots:parseInt(form.shots)||0,shots_on_target:parseInt(form.shots_on_target)||0,passes:parseInt(form.passes)||0,pass_accuracy:parseFloat(form.pass_accuracy)||0,distance_km:parseFloat(form.distance_km)||0,sprint_count:parseInt(form.sprint_count)||0,duels_won:parseInt(form.duels_won)||0,duels_total:parseInt(form.duels_total)||0,xg:parseFloat(form.xg)||0,xa:parseFloat(form.xa)||0,rating:parseFloat(form.rating)||0}
    if (editId){const {error}=await supabase.from('performance_stats').update(payload).eq('id',editId);if(error)alert(error.message);else{setShowForm(false);fetchData()}}
    else{const {error}=await supabase.from('performance_stats').insert([payload]);if(error)alert(error.message);else{setShowForm(false);setForm(EMPTY);fetchData()}}
    setSaving(false)
  }

  async function handleDelete(id){
    if (!confirm('Delete this record?'))return;setDeleting(id)
    const {error}=await supabase.from('performance_stats').delete().eq('id',id)
    if (error)alert(error.message);else fetchData();setDeleting(null)
  }

  const filtered=selAth==='all'?stats:stats.filter(s=>s.athlete_id===selAth)

  // Leaderboard
  const lb=athletes.map(a=>{
    const as=stats.filter(s=>s.athlete_id===a.id)
    return{...a,goals:as.reduce((x,s)=>x+(s.goals||0),0),assists:as.reduce((x,s)=>x+(s.assists||0),0),matches:as.length,avgRating:as.length?(as.reduce((x,s)=>x+parseFloat(s.rating||0),0)/as.length).toFixed(1):0}
  }).filter(a=>a.matches>0).sort((a,b)=>b.goals-a.goals).slice(0,5)

  return(
    <Layout>
      <div style={{ maxWidth:1280,margin:'0 auto',padding:'32px 40px' }}>
        <PageHeader label="Analytics" title="Performance" subtitle="Match stats, xG, xA and player analytics"
          action={<button className="btn-blue" onClick={openAdd}>+ Log Match Stats</button>}/>

        {/* Leaderboard with photos */}
        {lb.length>0&&(
          <div className="fade-up" style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:16,fontWeight:700,marginBottom:14 }}>🏆 Top Performers</h2>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
              {lb.map((a,i)=>(
                <div key={a.id} className="card" style={{ padding:'16px 14px',textAlign:'center',transition:'var(--transition)' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-md)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>
                  {/* Photo */}
                  <div style={{ display:'flex',justifyContent:'center',marginBottom:10 }}>
                    <AthleteAvatar ath={a} size={52} index={i}/>
                  </div>
                  <div style={{ fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:2 }}>{a.name.split(' ')[0]}</div>
                  <div style={{ fontSize:11,color:'var(--text3)',marginBottom:10 }}>{a.position}</div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
                    {[['⚽',a.goals,'G'],['🅰️',a.assists,'A'],['🎯',a.avgRating,'Avg'],['🏃',a.matches,'Matches']].map(([ic,v,l])=>(
                      <div key={l} style={{ background:'var(--surface2)',borderRadius:6,padding:'4px 6px' }}>
                        <div style={{ fontSize:13,fontWeight:800,color:'var(--text)' }}>{v}</div>
                        <div style={{ fontSize:9,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="fade-up" style={{ display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap' }}>
          <select value={selAth} onChange={e=>setSelAth(e.target.value)} style={{ ...inp,maxWidth:260 }}>
            <option value="all">All Athletes</option>
            {athletes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Stats table */}
        <div className="card fade-up fade-up-1" style={{ overflow:'hidden' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1.8fr 0.9fr 0.9fr 0.6fr 0.6fr 0.6fr 0.6fr 0.8fr 0.7fr 0.6fr 0.7fr 1fr',gap:6,padding:'11px 18px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
            {['Athlete','Date','Opponent','Min','⚽','🅰️','xG','xA','Pass%','Dist','Rating','Actions'].map(h=>(
              <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>
          {loading?(
            <div style={{ padding:'48px',textAlign:'center' }}><div style={{ width:28,height:28,border:'3px solid var(--blue-light)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto' }}/></div>
          ):filtered.length===0?(
            <div style={{ padding:'40px',textAlign:'center',color:'var(--text3)',fontSize:13 }}>No performance records yet.</div>
          ):filtered.map((s,i)=>(
            <div key={s.id} style={{ display:'grid',gridTemplateColumns:'1.8fr 0.9fr 0.9fr 0.6fr 0.6fr 0.6fr 0.6fr 0.8fr 0.7fr 0.6fr 0.7fr 1fr',gap:6,alignItems:'center',padding:'11px 18px',borderBottom:'1px solid var(--border)',transition:'var(--transition)' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              {/* Athlete with photo */}
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <AthleteAvatar ath={s.athletes} size={32} index={i}/>
                <div>
                  <div style={{ fontWeight:700,fontSize:12,color:'var(--text)' }}>{s.athletes?.name}</div>
                  <div style={{ fontSize:10,color:'var(--text3)' }}>{s.athletes?.position}</div>
                </div>
              </div>
              <div style={{ fontSize:11,color:'var(--text3)' }}>{s.match_date}</div>
              <div style={{ fontSize:11,color:'var(--text2)',fontWeight:500 }}>{s.opponent||'—'}</div>
              <div style={{ fontSize:12,color:'var(--text2)',fontWeight:600 }}>{s.minutes_played}'</div>
              <div style={{ fontSize:13,fontWeight:800,color:'var(--blue)' }}>{s.goals}</div>
              <div style={{ fontSize:13,fontWeight:800,color:'#27AE60' }}>{s.assists}</div>
              <div style={{ fontSize:11,color:'var(--text2)' }}>{parseFloat(s.xg||0).toFixed(2)}</div>
              <div style={{ fontSize:11,color:'var(--text2)' }}>{parseFloat(s.xa||0).toFixed(2)}</div>
              <div style={{ fontSize:11,color:'var(--text2)' }}>{s.pass_accuracy||0}%</div>
              <div style={{ fontSize:11,color:'var(--text2)' }}>{s.distance_km||0}km</div>
              <div style={{ display:'flex',alignItems:'center',gap:3 }}>
                <span style={{ fontSize:13,fontWeight:800,color:parseFloat(s.rating||0)>=7?'var(--success)':parseFloat(s.rating||0)>=5?'var(--warning)':'var(--danger)' }}>{s.rating||0}</span>
                <span style={{ fontSize:9,color:'var(--text3)' }}>/10</span>
              </div>
              <div style={{ display:'flex',gap:4 }}>
                <button onClick={()=>openEdit(s)} style={{ background:'var(--blue-light)',color:'var(--blue)',border:'none',padding:'3px 8px',borderRadius:'var(--r-sm)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>Edit</button>
                <button onClick={()=>handleDelete(s.id)} disabled={deleting===s.id} style={{ background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'3px 8px',borderRadius:'var(--r-sm)',fontSize:10,fontWeight:600,cursor:'pointer',opacity:deleting===s.id?0.5:1,fontFamily:'var(--font)' }}>{deleting===s.id?'…':'Del'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showForm&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(44,62,80,0.55)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'var(--surface)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:620,maxHeight:'92vh',overflow:'auto',boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)' }}>
            <div style={{ padding:'20px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(90deg,#2E6FC4,#4A90E2)' }}>
              <h2 style={{ fontSize:20,fontWeight:800,color:'#fff' }}>{editId?'Edit Stats':'Log Match Stats'}</h2>
              <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)',border:'none',width:34,height:34,borderRadius:'50%',fontSize:18,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ padding:28,display:'flex',flexDirection:'column',gap:14 }}>
              <div>
                <label style={lbl}>Athlete *</label>
                <select value={form.athlete_id} onChange={e=>set('athlete_id')(e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {athletes.map(a=><option key={a.id} value={a.id}>{a.name} — {a.position}</option>)}
                </select>
                {form.athlete_id&&(()=>{
                  const ath=athletes.find(a=>a.id===form.athlete_id)
                  if (!ath) return null
                  return <div style={{ display:'flex',alignItems:'center',gap:10,marginTop:8,padding:'7px 12px',background:'var(--surface2)',borderRadius:'var(--r-sm)',border:'1px solid var(--border)' }}><AthleteAvatar ath={ath} size={30} index={0}/><span style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}>{ath.name}</span></div>
                })()}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div><label style={lbl}>Match Date</label><input type="date" value={form.match_date} onChange={e=>set('match_date')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Opponent</label><input value={form.opponent} onChange={e=>set('opponent')(e.target.value)} style={inp} placeholder="e.g. Asante Kotoko"/></div>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
                {[['Minutes','minutes_played'],['Goals','goals'],['Assists','assists'],['Shots','shots'],['On Target','shots_on_target'],['Passes','passes'],['Pass Acc%','pass_accuracy'],['Dist(km)','distance_km'],['Sprints','sprint_count'],['Duels Won','duels_won'],['Duels Total','duels_total'],['Rating/10','rating']].map(([label,key])=>(
                  <div key={key}><label style={lbl}>{label}</label><input type="number" step={['pass_accuracy','distance_km','rating'].includes(key)?'0.1':'1'} min="0" value={form[key]} onChange={e=>set(key)(e.target.value)} style={inp}/></div>
                ))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                <div><label style={lbl}>xG</label><input type="number" step="0.001" min="0" value={form.xg} onChange={e=>set('xg')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>xA</label><input type="number" step="0.001" min="0" value={form.xa} onChange={e=>set('xa')(e.target.value)} style={inp}/></div>
              </div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={2} style={{ ...inp,resize:'vertical' }}/></div>
              <div style={{ display:'flex',gap:10,paddingTop:8 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'11px',borderRadius:'var(--r-md)',fontSize:14,cursor:'pointer',fontWeight:600,fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex:2,padding:'11px',opacity:saving?0.7:1,fontSize:14 }}>{saving?'Saving…':editId?'Save Changes':'Log Stats'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}