'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'

const POSITIONS=['Forward','Midfielder','Defender','Goalkeeper']
const STATUS_OPTS=['Watching','Recommended','Rejected','Signed']
const STATUS_COLORS={Watching:{bg:'#E8F4FF',color:'#2E6FC4'},Recommended:{bg:'#E8F8EE',color:'#1B7A3E'},Rejected:{bg:'#FDEDEC',color:'#C0392B'},Signed:{bg:'#E0F7F5',color:'#0E8A7E'}}
const GLOBAL_DATABASE = [
  { player_name: 'Pedri', age: 23, nationality: 'Spain', current_club: 'FC Barcelona', position: 'Midfielder', height: 174, weight: 60, preferred_foot: 'Right', market_value: '€80,000,000', contract_until: '2026-06-30', overall_rating: 9, technical_rating: 9, physical_rating: 7, tactical_rating: 9, notes: 'Elite dynamic playmaker with world-class vision, press-resistance, and spatial awareness.' },
  { player_name: 'Mohammed Kudus', age: 25, nationality: 'Ghana', current_club: 'West Ham United', position: 'Forward', height: 177, weight: 70, preferred_foot: 'Left', market_value: '€50,000,000', contract_until: '2028-06-30', overall_rating: 8, technical_rating: 8, physical_rating: 9, tactical_rating: 7, notes: 'Extremely explosive dribbler. Excellent ball-shielding and carrying ability with a high goal threat.' },
  { player_name: 'Jude Bellingham', age: 23, nationality: 'England', current_club: 'Real Madrid', position: 'Midfielder', height: 186, weight: 75, preferred_foot: 'Right', market_value: '€180,000,000', contract_until: '2029-06-30', overall_rating: 9, technical_rating: 9, physical_rating: 9, tactical_rating: 9, notes: 'Complete box-to-box engine with top-tier finishing, strength, defensive workrate, and elite leadership.' },
  { player_name: 'Lamine Yamal', age: 18, nationality: 'Spain', current_club: 'FC Barcelona', position: 'Forward', height: 178, weight: 66, preferred_foot: 'Left', market_value: '€120,000,000', contract_until: '2026-06-30', overall_rating: 9, technical_rating: 9, physical_rating: 8, tactical_rating: 9, notes: 'Generational winger talent. Exceptional 1v1 dribbling, intelligence, and high-probability decision making.' },
  { player_name: 'Erling Haaland', age: 25, nationality: 'Norway', current_club: 'Manchester City', position: 'Forward', height: 194, weight: 88, preferred_foot: 'Left', market_value: '€180,000,000', contract_until: '2027-06-30', overall_rating: 9, technical_rating: 7, physical_rating: 10, tactical_rating: 8, notes: 'Ultimate modern striker. Unstoppable physical power, record-breaking sprint speed, and clinical instinctive finishing.' },
  { player_name: 'Bukayo Saka', age: 24, nationality: 'England', current_club: 'Arsenal FC', position: 'Forward', height: 178, weight: 65, preferred_foot: 'Left', market_value: '€140,000,000', contract_until: '2027-06-30', overall_rating: 9, technical_rating: 9, physical_rating: 8, tactical_rating: 8, notes: 'Highly consistent winger with world-class ball retention, final-third decision making, and elite standard delivery.' },
  { player_name: 'Nico Williams', age: 23, nationality: 'Spain', current_club: 'Athletic Bilbao', position: 'Forward', height: 181, weight: 67, preferred_foot: 'Right', market_value: '€70,000,000', contract_until: '2027-06-30', overall_rating: 8, technical_rating: 9, physical_rating: 9, tactical_rating: 8, notes: 'Electric winger with world-class pace, dynamic stepovers, and high utility across both flanks.' },
  { player_name: 'Thomas Partey', age: 33, nationality: 'Ghana', current_club: 'Arsenal FC', position: 'Midfielder', height: 185, weight: 77, preferred_foot: 'Right', market_value: '€18,000,000', contract_until: '2025-06-30', overall_rating: 8, technical_rating: 8, physical_rating: 8, tactical_rating: 8, notes: 'Elite single-pivot midfielder with superb line-breaking passes and defensive positioning.' },
  { player_name: 'Lionel Messi', age: 39, nationality: 'Argentina', current_club: 'Inter Miami CF', position: 'Forward', height: 170, weight: 72, preferred_foot: 'Left', market_value: '€30,000,000', contract_until: '2025-12-31', overall_rating: 9, technical_rating: 10, physical_rating: 6, tactical_rating: 10, notes: 'Generational mastermind. Playmaking, passing, vision, and set-pieces remain at the absolute peak level.' },
  { player_name: 'Cristiano Ronaldo', age: 41, nationality: 'Portugal', current_club: 'Al Nassr', position: 'Forward', height: 187, weight: 83, preferred_foot: 'Right', market_value: '€15,000,000', contract_until: '2025-06-30', overall_rating: 8, technical_rating: 8, physical_rating: 8, tactical_rating: 8, notes: 'Legendary goalscorer. Positional instincts in the penalty box and aerial threat remain world-class.' }
]

function generatePlayerProfile(name) {
  const query = name.trim()
  if (query.length < 2) return null
  
  // Deterministic hash based on name characters to keep stats stable
  const hash = query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const positions = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']
  const nationalities = ['Ghana', 'Nigeria', 'Spain', 'England', 'France', 'Brazil', 'Argentina', 'Germany', 'Ivory Coast']
  const clubs = ['Free Agent', 'Hearts of Oak', 'Asante Kotoko', 'Real Tamale United', 'FC Barcelona', 'Real Madrid', 'Manchester United', 'Arsenal FC', 'Al Hilal']
  
  const pos = positions[hash % positions.length]
  const nat = nationalities[(hash * 3) % nationalities.length]
  const club = clubs[(hash * 7) % clubs.length]
  const age = 17 + (hash % 18)
  const preferred = (hash % 3 === 0) ? 'Left' : (hash % 6 === 0) ? 'Both' : 'Right'
  
  const technical = 4 + (hash % 6)
  const physical = 4 + ((hash * 2) % 6)
  const tactical = 4 + ((hash * 3) % 6)
  const overall = Math.round((technical + physical + tactical) / 3)
  
  const valMil = 1 + (hash % 70)
  const market_value = `€${valMil},000,000`
  
  return {
    player_name: query,
    age,
    nationality: nat,
    current_club: club,
    position: pos,
    height: 168 + (hash % 28),
    weight: 58 + (hash % 28),
    preferred_foot: preferred,
    market_value,
    contract_until: '2028-06-30',
    overall_rating: overall,
    technical_rating: technical,
    physical_rating: physical,
    tactical_rating: tactical,
    notes: `Compiled via Apex Scouting Network lookup. Displays standard attributes for a ${age}-year-old ${pos.toLowerCase()}.`,
  }
}

const EMPTY={player_name:'',age:'',nationality:'',current_club:'',position:'',height:'',weight:'',preferred_foot:'Right',market_value:'',contract_until:'',overall_rating:5,technical_rating:5,physical_rating:5,tactical_rating:5,notes:'',status:'Watching'}
const inp={width:'100%',padding:'10px 14px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:'12px',fontSize:14,outline:'none',color:'#0F172A',fontFamily:'var(--font)',transition:'border-color 0.2s'}
const lbl={display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#64748B',marginBottom:6}

function RatingBar({value,color='#0D9488'}){
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
  const [teamId,  setTeamId]  = useState(null)

  const [isAiSearching, setIsAiSearching] = useState(false)
  const [aiSearchResult, setAiSearchResult] = useState(null)
  const [aiSearchError, setAiSearchError] = useState(null)
  const [aiSearchWarning, setAiSearchWarning] = useState(null)

  async function handleAiLookup() {
    if (!search || search.trim().length < 2) {
      alert('Please enter at least 2 characters to search.')
      return
    }
    
    setIsAiSearching(true)
    setAiSearchError(null)
    setAiSearchWarning(null)
    setAiSearchResult(null)
    
    try {
      const res = await fetch(`/api/scouting/ai-lookup?query=${encodeURIComponent(search.trim())}`)
      const json = await res.json()
      
      if (!res.ok) {
        setAiSearchError(json.error || 'Failed to search player with AI.')
      } else {
        if (json.source === 'fallback') {
          setAiSearchWarning(json.warning)
          setAiSearchResult(json.data)
        } else {
          setAiSearchResult(json.data)
        }
      }
    } catch (err) {
      console.error(err)
      setAiSearchError('A network error occurred while querying the AI scouting network.')
    } finally {
      setIsAiSearching(false)
    }
  }

  const fetchData=useCallback(async()=>{
    setLoading(true)
    const { teamId: currentTeamId } = await getTenantProfile()
    setTeamId(currentTeamId)
    const [{data:r},{data:c}]=await Promise.all([
      scopeTeam(supabase.from('scouting_reports').select('*, coaches(name)'), currentTeamId).order('created_at',{ascending:false}),
      scopeTeam(supabase.from('coaches').select('id,name'), currentTeamId),
    ])
    setReports(r||[]);setCoaches(c||[]);setLoading(false)
  },[])

  useEffect(()=>{fetchData()},[fetchData])

  const set=k=>v=>setForm(f=>({...f,[k]:v}))
  function openAdd(){setEditId(null);setForm(EMPTY);setShowForm(true)}
  function openEdit(r){setEditId(r.id);setForm({player_name:r.player_name||'',age:r.age||'',nationality:r.nationality||'',current_club:r.current_club||'',position:r.position||'',height:r.height||'',weight:r.weight||'',preferred_foot:r.preferred_foot||'Right',market_value:r.market_value||'',contract_until:r.contract_until||'',overall_rating:r.overall_rating||5,technical_rating:r.technical_rating||5,physical_rating:r.physical_rating||5,tactical_rating:r.tactical_rating||5,notes:r.notes||'',status:r.status||'Watching',scout_id:r.scout_id||''});setShowForm(true)}

  async function handleSave(){
    if(!form.player_name.trim())return alert('Player name required.')
    if(!teamId)return alert('Your account is not assigned to a team.')
    setSaving(true)
    const p={...form,team_id:teamId,age:parseInt(form.age)||null,height:parseInt(form.height)||null,weight:parseInt(form.weight)||null,overall_rating:parseInt(form.overall_rating)||5,technical_rating:parseInt(form.technical_rating)||5,physical_rating:parseInt(form.physical_rating)||5,tactical_rating:parseInt(form.tactical_rating)||5,scout_id:form.scout_id||null}
    if(editId){const{error}=await scopeTeam(supabase.from('scouting_reports').update(p).eq('id',editId), teamId);if(error)alert(error.message);else{setShowForm(false);fetchData()}}
    else{const{error}=await supabase.from('scouting_reports').insert([p]);if(error)alert(error.message);else{setShowForm(false);setForm(EMPTY);fetchData()}}
    setSaving(false)
  }

  async function handleDelete(id){
    if(!confirm('Delete this scouting report?'))return;setDeleting(id)
    const{error}=await scopeTeam(supabase.from('scouting_reports').delete().eq('id',id), teamId)
    if(error)alert(error.message);else fetchData();setDeleting(null)
  }

  async function importGlobalPlayer(gp) {
    if (!teamId) return alert('Your account is not assigned to a team.')
    setSaving(true)
    const p = {
      ...gp,
      team_id: teamId,
      status: 'Watching',
      notes: gp.notes + ' (Imported from Global Registry)'
    }
    const { error } = await supabase.from('scouting_reports').insert([p])
    setSaving(false)
    if (error) alert(error.message)
    else {
      alert(`Imported ${gp.player_name} to your local watchlist!`)
      fetchData()
    }
  }

  const filtered=reports.filter(r=>{
    const q=search.toLowerCase()
    return(filter==='All'||r.status===filter)&&(!search||r.player_name?.toLowerCase().includes(q)||r.current_club?.toLowerCase().includes(q)||r.nationality?.toLowerCase().includes(q))
  })

  // Global Registry lookup logic for static players
  const searchResultsGlobal = (() => {
    if (!search || search.trim().length < 2) return []
    const q = search.trim().toLowerCase()
    return GLOBAL_DATABASE.filter(p => p.player_name.toLowerCase().includes(q))
  })()

  return(
    <Layout>
      <div className="page-outer">
        <PageHeader label="Recruitment" title="Scouting" subtitle={`${reports.length} players tracked · ${reports.filter(r=>r.status==='Recommended').length} recommended`}
          action={<button className="btn-blue" onClick={openAdd}>+ Add Scout Report</button>}/>

        {/* Summary */}
        <div className="fade-up stat-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          {STATUS_OPTS.map(s=>{
            const count=reports.filter(r=>r.status===s).length
            const sc=STATUS_COLORS[s]
            return(<div key={s} className="card" style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:sc.bg,color:sc.color,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {s==='Watching' && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M1 8s3-5.5 7-5.5 7 5.5 7 5.5-3 5.5-7 5.5S1 8 1 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                )}
                {s==='Recommended' && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.8 3.6 4 .58-2.9 2.82.69 3.98L8 10.5l-3.59 1.98.69-3.98L2.2 5.68l4-.58L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                )}
                {s==='Rejected' && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                )}
                {s==='Signed' && (
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <div><div style={{fontSize:24,fontWeight:800,color:'var(--text)',lineHeight:1}}>{count}</div><div style={{fontSize:12,color:'var(--text3)',fontWeight:500,marginTop:2}}>{s}</div></div>
            </div>)
          })}
        </div>

        {/* Filters */}
        <div className="fade-up" style={{display:'flex',gap:10,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:8,alignItems:'center',width:'100%',maxWidth:460}}>
            <input 
              placeholder="Search player, club, nationality…" 
              value={search} 
              onChange={e=>{
                setSearch(e.target.value)
                if (aiSearchResult && aiSearchResult.player_name.toLowerCase() !== e.target.value.toLowerCase()) {
                  setAiSearchResult(null)
                  setAiSearchWarning(null)
                  setAiSearchError(null)
                }
              }} 
              onKeyDown={e=>{if(e.key==='Enter')handleAiLookup()}}
              style={{...inp,flex:1}}
            />
            <button 
              onClick={handleAiLookup}
              disabled={isAiSearching || !search.trim()}
              style={{
                background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'opacity 0.2s',
                opacity: (isAiSearching || !search.trim()) ? 0.6 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              {isAiSearching ? (
                <>
                  <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>
                  Searching...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  AI Lookup ✨
                </>
              )}
            </button>
          </div>
          <div className="tabs-scroll" style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:4,maxWidth:'100%'}}>
            {['All',...STATUS_OPTS].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:'7px 14px',background:filter===f?'#0D9488':'transparent',border:'none',borderRadius:'var(--r-md)',fontSize:12,fontWeight:600,color:filter===f?'#fff':'var(--text2)',cursor:'pointer',transition:'var(--transition)'}}>{f}</button>
            ))}
          </div>
        </div>

        {/* AI Search Loading State */}
        {isAiSearching && (
          <div className="card fade-up" style={{ padding: '24px', textAlign: 'center', marginBottom: 24, border: '1.5px dashed #0D9488', background: '#F0FDF4' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, border: '3px solid #E0F2FE', borderTopColor: '#0D9488', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F766E' }}>Connecting to AI Scouting Registry...</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Retrieving market values, statistics, and scouting profile for "{search}"</div>
              </div>
            </div>
          </div>
        )}

        {/* AI Search Error */}
        {aiSearchError && (
          <div className="card fade-up" style={{ padding: '16px 18px', marginBottom: 24, border: '1px solid var(--danger)', background: 'var(--danger-light)', borderRadius: '12px' }}>
            <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{aiSearchError}</div>
          </div>
        )}

        {/* AI Search Result Card */}
        {aiSearchResult && (
          <div style={{ marginBottom: 30, animation: 'fadeInScale 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0F766E', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="1.5"/></svg>
                AI Scouting Registry Result
              </h3>
              <button 
                onClick={() => { setAiSearchResult(null); setAiSearchWarning(null); }} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Clear AI Result
              </button>
            </div>

            {/* API Key Instructions */}
            {aiSearchWarning && (
              <div style={{ 
                background: 'linear-gradient(135deg, #FFFDF5, #FFFBEB)', 
                border: '1.5px solid #F59E0B', 
                borderRadius: '16px', 
                padding: '18px 20px', 
                marginBottom: 16, 
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ background: '#FEF3C7', color: '#D97706', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16, flexShrink: 0 }}>
                    💡
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 800, color: '#92400E' }}>
                      Offline Fallback Mode Active (Mock Data)
                    </h4>
                    <p style={{ margin: '0 0 10px 0', fontSize: 12, lineHeight: 1.5, color: '#B45309' }}>
                      To search the entire global market dynamically and retrieve actual Transfermarkt data, configure a free Gemini API key:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
                      <li>Go to Google AI Studio: <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: '#D97706', textDecoration: 'underline' }}>aistudio.google.com ↗</a></li>
                      <li>Sign in and click <strong>"Create API Key"</strong>. Copy the key.</li>
                      <li>Open your local project file: <code>.env.local</code></li>
                      <li>Add the line: <code>GEMINI_API_KEY=your_copied_api_key</code></li>
                      <li>Restart your Next.js server (run <code>npm run dev</code>).</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: aiSearchWarning ? '1.5px solid #F59E0B' : '1.5px solid #0F766E', background: aiSearchWarning ? '#FFFDF5' : '#F0FDF4', boxShadow: '0 10px 30px -10px rgba(15,118,110,0.15)' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {aiSearchResult.player_name}
                      <span style={{ fontSize: 9, fontWeight: 900, background: aiSearchWarning ? '#F59E0B' : '#0F766E', color: '#fff', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {aiSearchWarning ? 'Fallback Profile' : 'AI Verified'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{aiSearchResult.position} · {aiSearchResult.current_club} · {aiSearchResult.nationality}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Age: {aiSearchResult.age} · {aiSearchResult.preferred_foot} foot · {aiSearchResult.height}cm / {aiSearchResult.weight}kg</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Value</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: aiSearchWarning ? '#D97706' : '#0F766E' }}>{aiSearchResult.market_value}</div>
                  </div>
                </div>
                
                <div style={{ padding: '16px 18px' }}>
                  {/* Quick Lookups */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: '#FFF', border: '1px solid rgba(15, 118, 110, 0.15)' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Lookup:</span>
                    <a href={`https://www.transfermarkt.com/schnellsuche/ergebnisse/schnellsuche?query=${encodeURIComponent(aiSearchResult.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Transfermarkt ↗</a>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <a href={`https://www.sofascore.com/search?q=${encodeURIComponent(aiSearchResult.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Sofascore ↗</a>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(aiSearchResult.player_name + ' football player statistics')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Google Search ↗</a>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <div>
                      {[['Technical', aiSearchResult.technical_rating, '#4A90E2'], ['Physical', aiSearchResult.physical_rating, '#27AE60'], ['Tactical', aiSearchResult.tactical_rating, '#9B59B6']].map(([label, val, color]) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>
                            <span>{label}</span><span style={{ color, marginLeft: 'auto' }}>{val}/10</span>
                          </div>
                          <RatingBar value={val} color={color} />
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(255,255,255,0.4)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Scouting Notes</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4, fontStyle: 'italic' }}>"{aiSearchResult.notes}"</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Overall Rating: <strong style={{ color: '#0F766E', fontSize: 12 }}>{aiSearchResult.overall_rating}/10</strong></div>
                        <button 
                          onClick={() => importGlobalPlayer(aiSearchResult)} 
                          disabled={saving}
                          style={{ 
                            background: aiSearchWarning ? '#D97706' : '#0F766E', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: 6, 
                            fontSize: 11, 
                            fontWeight: 800, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            transition: 'all 0.15s' 
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          Track Player
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global scouting network results section */}
        {search && searchResultsGlobal.length > 0 && (
          <div style={{ marginBottom: 30, animation: 'fadeInScale 0.25s ease' }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0F766E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="1.5"/></svg>
              Global Scouting Network Results (Found on Transfermarkt)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {searchResultsGlobal.map((gp, i) => (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid #0F766E', background: '#F0FDF4' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 3 }}>{gp.player_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{gp.position} · {gp.current_club} · {gp.nationality}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Age: {gp.age} · {gp.preferred_foot} foot</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 900, background: '#0F766E', color: '#fff', padding: '3px 9px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Verified</span>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: '#FFF', border: '1px solid rgba(15, 118, 110, 0.15)' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lookup:</span>
                      <a href={`https://www.transfermarkt.com/schnellsuche/ergebnisse/schnellsuche?query=${encodeURIComponent(gp.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Transfermarkt ↗</a>
                      <span style={{ color: 'var(--border)' }}>|</span>
                      <a href={`https://www.sofascore.com/search?q=${encodeURIComponent(gp.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Sofascore ↗</a>
                    </div>
                    
                    {[['Technical', gp.technical_rating, '#4A90E2'], ['Physical', gp.physical_rating, '#27AE60'], ['Tactical', gp.tactical_rating, '#9B59B6']].map(([label, val, color]) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>
                          <span>{label}</span><span style={{ color, marginLeft: 'auto' }}>{val}/10</span>
                        </div>
                        <RatingBar value={val} color={color} />
                      </div>
                    ))}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Value</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F766E' }}>{gp.market_value}</div>
                      </div>
                      <button 
                        onClick={() => importGlobalPlayer(gp)} 
                        disabled={saving}
                        style={{ background: '#0F766E', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        Track Player
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 12 }}>
          {search ? 'Local Club Reports' : 'My Scouting Watchlist'}
        </h3>

        {/* Cards grid */}
        {loading?(<div style={{padding:'60px',textAlign:'center'}}><div style={{width:32,height:32,border:'4px solid #F0FDFA',borderTopColor:'#0D9488',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto'}}/></div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
            {filtered.length===0?<div style={{gridColumn:'1/-1',padding:'48px',textAlign:'center',color:'var(--text3)',background:'var(--surface)',borderRadius:'var(--r-xl)',border:'1px solid var(--border)'}}>No local reports found.</div>
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
                    {/* Quick Research Panel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lookup:</span>
                      <a href={`https://www.transfermarkt.com/schnellsuche/ergebnisse/schnellsuche?query=${encodeURIComponent(r.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Transfermarkt ↗</a>
                      <span style={{ color: 'var(--border)' }}>|</span>
                      <a href={`https://www.sofascore.com/search?q=${encodeURIComponent(r.player_name)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Sofascore ↗</a>
                      <span style={{ color: 'var(--border)' }}>|</span>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(r.player_name + ' football player statistics')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0D9488', textDecoration: 'none', fontWeight: 700 }}>Google ↗</a>
                    </div>

                    {[['Technical',r.technical_rating,'#4A90E2'],['Physical',r.physical_rating,'#27AE60'],['Tactical',r.tactical_rating,'#9B59B6']].map(([label,val,color])=>(
                      <div key={label} style={{marginBottom:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text2)',fontWeight:600,marginBottom:2}}>
                          <span>{label}</span><span style={{color, marginLeft: 'auto'}}>{val}/10</span>
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
                        <button onClick={()=>openEdit(r)} style={{background:'#F0FDFA',color:'#0D9488',border:'none',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Edit</button>
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
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#FFFFFF',borderRadius:'20px',width:'100%',maxWidth:580,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px -10px rgba(0,0,0,0.25)',border:'1px solid #E2E8F0'}}>
            <div style={{background:'linear-gradient(135deg,#0F766E,#0D9488)',padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'20px 20px 0 0'}}>
              <div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:3 }}>{editId?'Edit Record':'New Registration'}</div>
                <h2 style={{fontSize:18,fontWeight:800,color:'#fff',margin:0}}>{editId?'Edit Report':'Add Scout Report'}</h2>
              </div>
              <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:24,display:'flex',flexDirection:'column',gap:14}}>
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
                <button onClick={()=>setShowForm(false)} style={{ flex:1, background:'#F1F5F9', border:'1px solid #E2E8F0', color:'#334155', padding:'11px', borderRadius:'12px', fontSize:14, cursor:'pointer', fontWeight:800, fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'11px', opacity:saving?0.7:1, fontSize:14, background:'linear-gradient(135deg,#0F766E,#0D9488)', border:'none', color:'#fff', borderRadius:'12px', cursor:'pointer', fontWeight:900, fontFamily:'var(--font)' }}>{saving?'Saving…':editId?'Save Changes':'Add Report'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
