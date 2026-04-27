'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const POSITIONS=['Forward','Midfielder','Defender','Goalkeeper']
const STATUS_OPTS=['Watching','Recommended','Rejected','Signed']
const STATUS_COLORS={Watching:{bg:'#E8F4FF',color:'#2E6FC4'},Recommended:{bg:'#E8F8EE',color:'#1B7A3E'},Rejected:{bg:'#FDEDEC',color:'#C0392B'},Signed:{bg:'#E0F7F5',color:'#0E8A7E'}}
const EMPTY={player_name:'',age:'',nationality:'',current_club:'',position:'',height:'',weight:'',preferred_foot:'Right',market_value:'',contract_until:'',overall_rating:5,technical_rating:5,physical_rating:5,tactical_rating:5,notes:'',status:'Watching'}
const inp={width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)'}
const lbl={display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}

function RatingBar({value,color='var(--blue)'}){
  return(
    <div style={{height:6,background:'var(--surface3)',borderRadius:3,overflow:'hidden',marginTop:3}}>
      <div style={{height:'100%',width:`${(value/10)*100}%`,background:color,borderRadius:3,transition:'width 0.6s ease'}}/>
    </div>
  )
}

export default function ScoutingPage(){
  const [reports, setReports] = useState([])
  const [coaches, setCoaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm,setShowForm]= useState(false)
  const [editId,  setEditId]  = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [deleting,setDeleting]= useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [filter,  setFilter]  = useState('All')
  const [search,  setSearch]  = useState('')

  const fetchData=useCallback(async()=>{
    setLoading(true)
    const [{data:r},{data:c}]=await Promise.all([
      supabase.from('scouting_reports').select('*, coaches(name)').order('created_at',{ascending:false}),
      supabase.from('coaches').select('id,name'),
    ])
    setReports(r||[]);setCoaches(c||[]);setLoading(false)
  },[])

  useEffect(()=>{fetchData()},[fetchData])

  const set=k=>v=>setForm(f=>({...f,[k]:v}))
  function openAdd(){setEditId(null);setForm(EMPTY);setShowForm(true)}
  function openEdit(r){setEditId(r.id);setForm({player_name:r.player_name||'',age:r.age||'',nationality:r.nationality||'',current_club:r.current_club||'',position:r.position||'',height:r.height||'',weight:r.weight||'',preferred_foot:r.preferred_foot||'Right',market_value:r.market_value||'',contract_until:r.contract_until||'',overall_rating:r.overall_rating||5,technical_rating:r.technical_rating||5,physical_rating:r.physical_rating||5,tactical_rating:r.tactical_rating||5,notes:r.notes||'',status:r.status||'Watching',scout_id:r.scout_id||''});setShowForm(true)}

  async function handleSave(){
    if(!form.player_name.trim())return alert('Player name required.')
    setSaving(true)
    const p={...form,age:parseInt(form.age)||null,height:parseInt(form.height)||null,weight:parseInt(form.weight)||null,overall_rating:parseInt(form.overall_rating)||5,technical_rating:parseInt(form.technical_rating)||5,physical_rating:parseInt(form.physical_rating)||5,tactical_rating:parseInt(form.tactical_rating)||5,scout_id:form.scout_id||null}
    if(editId){const{error}=await supabase.from('scouting_reports').update(p).eq('id',editId);if(error)alert(error.message);else{setShowForm(false);fetchData()}}
    else{const{error}=await supabase.from('scouting_reports').insert([p]);if(error)alert(error.message);else{setShowForm(false);setForm(EMPTY);fetchData()}}
    setSaving(false)
  }

  async function handleDelete(id){
    if(!confirm('Delete this scouting report?'))return;setDeleting(id)
    const{error}=await supabase.from('scouting_reports').delete().eq('id',id)
    if(error)alert(error.message);else fetchData();setDeleting(null)
  }

  const filtered=reports.filter(r=>{
    const q=search.toLowerCase()
    return(filter==='All'||r.status===filter)&&(!search||r.player_name?.toLowerCase().includes(q)||r.current_club?.toLowerCase().includes(q)||r.nationality?.toLowerCase().includes(q))
  })

  return(
    <Layout>
      <style>{`
  @media(max-width:768px){
    div[style*="32px 40px"]{padding:14px 12px!important}
    div[style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,1fr)!important}
    div[style*="1fr 1fr 1fr;gap:12"]{grid-template-columns:1fr!important}
    div[style*="repeat(4,1fr);gap:10"]{grid-template-columns:1fr 1fr!important}
  }
`}</style>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'32px 40px'}}>
        <PageHeader label="Recruitment" title="Scouting" subtitle={`${reports.length} players tracked · ${reports.filter(r=>r.status==='Recommended').length} recommended`}
          action={<button className="btn-blue" onClick={openAdd}>+ Add Scout Report</button>}/>

        {/* Summary */}
        <div className="fade-up" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          {STATUS_OPTS.map(s=>{
            const count=reports.filter(r=>r.status===s).length
            const sc=STATUS_COLORS[s]
            return(<div key={s} className="card" style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:sc.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                {s==='Watching'?'👁':s==='Recommended'?'⭐':s==='Signed'?'✅':'❌'}
              </div>
              <div><div style={{fontSize:24,fontWeight:800,color:'var(--text)',lineHeight:1}}>{count}</div><div style={{fontSize:12,color:'var(--text3)',fontWeight:500,marginTop:2}}>{s}</div></div>
            </div>)
          })}
        </div>

        {/* Filters */}
        <div className="fade-up" style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          <input placeholder="🔍 Search player, club, nationality…" value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,maxWidth:300}}/>
          <div style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:4}}>
            {['All',...STATUS_OPTS].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:'7px 14px',background:filter===f?'var(--blue)':'transparent',border:'none',borderRadius:'var(--r-md)',fontSize:12,fontWeight:600,color:filter===f?'#fff':'var(--text2)',cursor:'pointer',transition:'var(--transition)'}}>{f}</button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        {loading?(<div style={{padding:'60px',textAlign:'center'}}><div style={{width:32,height:32,border:'4px solid var(--blue-light)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto'}}/></div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
            {filtered.length===0?<div style={{gridColumn:'1/-1',padding:'48px',textAlign:'center',color:'var(--text3)',background:'var(--surface)',borderRadius:'var(--r-xl)',border:'1px solid var(--border)'}}>No players found.</div>
            :filtered.map(r=>{
              const sc=STATUS_COLORS[r.status]||STATUS_COLORS.Watching
              return(
                <div key={r.id} className="card fade-up" style={{padding:0,overflow:'hidden',transition:'var(--transition)'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>
                  <div style={{padding:'16px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,color:'var(--text)',marginBottom:3}}>{r.player_name}</div>
                      <div style={{fontSize:12,color:'var(--text3)'}}>{r.position} · {r.current_club||'Free Agent'} · {r.nationality||'—'}</div>
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{r.age?`Age: ${r.age}`:''}{r.preferred_foot?` · ${r.preferred_foot} foot`:''}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,background:sc.bg,color:sc.color,padding:'3px 10px',borderRadius:99,letterSpacing:'0.07em',textTransform:'uppercase',flexShrink:0}}>{r.status}</span>
                  </div>
                  <div style={{padding:'14px 18px'}}>
                    {[['Technical',r.technical_rating,'#4A90E2'],['Physical',r.physical_rating,'#27AE60'],['Tactical',r.tactical_rating,'#9B59B6']].map(([label,val,color])=>(
                      <div key={label} style={{marginBottom:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text2)',fontWeight:600,marginBottom:2}}>
                          <span>{label}</span><span style={{color}}>{val}/10</span>
                        </div>
                        <RatingBar value={val} color={color}/>
                      </div>
                    ))}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                      <div>
                        <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Overall</div>
                        <div style={{fontSize:22,fontWeight:900,color:r.overall_rating>=7?'var(--success)':r.overall_rating>=5?'var(--warning)':'var(--danger)'}}>{r.overall_rating}<span style={{fontSize:12,color:'var(--text3)',fontWeight:500}}>/10</span></div>
                      </div>
                      {r.market_value&&<div style={{textAlign:'right'}}><div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Value</div><div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{r.market_value}</div></div>}
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>openEdit(r)} style={{background:'var(--blue-light)',color:'var(--blue)',border:'none',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Edit</button>
                        <button onClick={()=>handleDelete(r.id)} disabled={deleting===r.id} style={{background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',opacity:deleting===r.id?0.5:1}}>{deleting===r.id?'…':'Del'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(44,62,80,0.55)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--surface)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:580,maxHeight:'92vh',overflow:'auto',boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)'}}>
            <div style={{padding:'20px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(90deg,#4A1FA0,#6B2FD9)'}}>
              <h2 style={{fontSize:20,fontWeight:800,color:'#fff'}}>{editId?'Edit Report':'Add Scout Report'}</h2>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',width:34,height:34,borderRadius:'50%',fontSize:18,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{padding:28,display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={lbl}>Player Name *</label><input value={form.player_name} onChange={e=>set('player_name')(e.target.value)} style={inp} placeholder="Full name"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div><label style={lbl}>Age</label><input type="number" value={form.age} onChange={e=>set('age')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Position</label><select value={form.position} onChange={e=>set('position')(e.target.value)} style={inp}><option value="">Select…</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label style={lbl}>Preferred Foot</label><select value={form.preferred_foot} onChange={e=>set('preferred_foot')(e.target.value)} style={inp}>{['Right','Left','Both'].map(f=><option key={f}>{f}</option>)}</select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>Current Club</label><input value={form.current_club} onChange={e=>set('current_club')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Nationality</label><input value={form.nationality} onChange={e=>set('nationality')(e.target.value)} style={inp}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>Market Value</label><input value={form.market_value} onChange={e=>set('market_value')(e.target.value)} style={inp} placeholder="e.g. GHS 500,000"/></div>
                <div><label style={lbl}>Contract Until</label><input type="date" value={form.contract_until} onChange={e=>set('contract_until')(e.target.value)} style={inp}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[['Overall','overall_rating'],['Technical','technical_rating'],['Physical','physical_rating'],['Tactical','tactical_rating']].map(([label,key])=>(
                  <div key={key}><label style={lbl}>{label} /10</label><input type="number" min="1" max="10" value={form[key]} onChange={e=>set(key)(e.target.value)} style={inp}/></div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>Status</label><select value={form.status} onChange={e=>set('status')(e.target.value)} style={inp}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={lbl}>Scout</label><select value={form.scout_id||''} onChange={e=>set('scout_id')(e.target.value)} style={inp}><option value="">Select…</option>{coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={3} style={{...inp,resize:'vertical'}}/></div>
              <div style={{display:'flex',gap:10,paddingTop:8}}>
                <button onClick={()=>setShowForm(false)} className="btn-ghost" style={{flex:1,padding:'11px'}}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{flex:2,padding:'11px',opacity:saving?0.7:1}}>{saving?'Saving…':editId?'Save Changes':'Add Report'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}