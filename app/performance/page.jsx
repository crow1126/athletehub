'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam, getLastKnownTeamId } from '@/lib/tenant'
import { DEFAULT_GPL_TEAMS } from '@/lib/gplTeams'
import { Eye, Ban, ShieldAlert, CalendarDays, Trophy, Plus, Edit2, Trash2 } from 'lucide-react'

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']
function initials(n){ return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=38, index=0 }) {
  const [err,setErr]=useState(false)
  if (ath?.photo_url&&!err) return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0 }}/>
  return <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:AV_COLORS[index%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#fff' }}>{initials(ath?.name)}</div>
}

// Match "Register Athlete" modal look & feel
const inp={width:'100%',padding:'10px 14px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:'12px',fontSize:14,outline:'none',color:'#0F172A',fontFamily:'var(--font)',transition:'border-color 0.2s'}
const lbl={display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#64748B',marginBottom:6}
const EMPTY={athlete_id:'',match_date:new Date().toISOString().split('T')[0],opponent:'',minutes_played:90,goals:0,assists:0,shots:0,shots_on_target:0,passes:0,pass_accuracy:0,distance_km:0,sprint_count:0,duels_won:0,duels_total:0,xg:0,xa:0,rating:0,notes:'',red_card:false,suspension_games:1,update_status_suspended:true}
const EMPTY_FIXTURE={opponent_team_id:'',opponent_name:'',opponent_logo_url:'',competition:'Ghana Premier League',match_date:new Date().toISOString().split('T')[0],kickoff_time:'15:00',venue:'',is_home:true,home_score:'',away_score:'',status:'scheduled',notes:''}

export default function PerformancePage(){
  const [stats,        setStats]       = useState([])
  const [athletes,     setAthletes]    = useState([])
  const [loading,      setLoading]     = useState(true)
  const [showForm,     setShowForm]    = useState(false)
  const [editId,       setEditId]      = useState(null)
  const [saving,       setSaving]      = useState(false)
  const [deleting,     setDeleting]    = useState(null)
  const [form,         setForm]        = useState(EMPTY)
  const [selAth,       setSelAth]      = useState('all')
  const [teamId,       setTeamId]      = useState(() => getLastKnownTeamId())
  const [currentUser,  setCurrentUser] = useState(null)
  const [unpublished,  setUnpublished] = useState([])  // unnotified stat rows
  const [publishing,   setPublishing]  = useState(false)
  const [publishMsg,   setPublishMsg]  = useState('')
  const [activeTab,    setActiveTab]   = useState('fixtures') // 'fixtures' | 'stats'
  const [fixtures,     setFixtures]    = useState([])
  const [leagueTeams,  setLeagueTeams] = useState([])
  const [showFixModal, setShowFixModal]= useState(false)
  const [editFixId,    setEditFixId]   = useState(null)
  const [fixForm,      setFixForm]     = useState(EMPTY_FIXTURE)
  const [fixCustomMode,setFixCustomMode]= useState(false)
  const [savingFix,    setSavingFix]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { session, profile, teamId: currentTeamId } = await getTenantProfile()
    if (!session || !currentTeamId) {
      setLoading(false)
      return
    }
    setCurrentUser(profile)
    setTeamId(currentTeamId)
    const [resStats, resAth, resFix, resLT] = await Promise.allSettled([
      scopeTeam(supabase.from('performance_stats').select('*,athletes(name,position,club,photo_url,status,back_number)'), currentTeamId).order('match_date',{ascending:false}),
      scopeTeam(supabase.from('athletes').select('id,name,position,club,photo_url,status,back_number'), currentTeamId).order('name'),
      scopeTeam(supabase.from('fixtures').select('*'), currentTeamId).order('match_date', { ascending: false }),
      supabase.from('league_teams').select('*').eq('is_active', true).order('name', { ascending: true }),
    ])
    const s = resStats.status === 'fulfilled' ? (resStats.value?.data || []) : []
    const a = resAth.status === 'fulfilled' ? (resAth.value?.data || []) : []
    const f = resFix.status === 'fulfilled' ? (resFix.value?.data || []) : []
    const ltOk = resLT.status === 'fulfilled' && !resLT.value?.error && (resLT.value?.data?.length || 0) > 0
    const lt = ltOk ? resLT.value.data : DEFAULT_GPL_TEAMS
    setStats(s)
    setAthletes(a)
    setFixtures(f)
    setLeagueTeams(lt)
    // Track entries awaiting notification
    setUnpublished(s.filter(r => r.notified === false))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const handleProfileLoaded = (e) => {
      const tid = e.detail?.teamId
      if (tid) {
        setStats(prev => {
          if (prev.length === 0 || tid !== teamId) {
            fetchData()
          }
          return prev
        })
      }
    }
    const handleTeamChange = () => fetchData()
    window.addEventListener('apex_profile_loaded', handleProfileLoaded)
    window.addEventListener('apex_superadmin_team_changed', handleTeamChange)
    return () => {
      window.removeEventListener('apex_profile_loaded', handleProfileLoaded)
      window.removeEventListener('apex_superadmin_team_changed', handleTeamChange)
    }
  }, [fetchData, teamId])

  const set=k=>v=>setForm(f=>({...f,[k]:v}))
  function openAdd(){setEditId(null);setForm(EMPTY);setShowForm(true)}
  function openEdit(s){
    const hasRed = (s.notes||'').includes('Red Card')
    setEditId(s.id)
    setForm({
      athlete_id:s.athlete_id||'',
      match_date:s.match_date||'',
      opponent:s.opponent||'',
      minutes_played:s.minutes_played||0,
      goals:s.goals||0,
      assists:s.assists||0,
      shots:s.shots||0,
      shots_on_target:s.shots_on_target||0,
      passes:s.passes||0,
      pass_accuracy:s.pass_accuracy||0,
      distance_km:s.distance_km||0,
      sprint_count:s.sprint_count||0,
      duels_won:s.duels_won||0,
      duels_total:s.duels_total||0,
      xg:s.xg||0,
      xa:s.xa||0,
      rating:s.rating||0,
      notes:s.notes||'',
      red_card:hasRed,
      suspension_games:1,
      update_status_suspended:false,
    })
    setShowForm(true)
  }

  async function handleReinstate(athleteId, athleteName) {
    if (!confirm(`Reinstate ${athleteName} to Active? They will become available for matchday selection.`)) return
    const { error } = await scopeTeam(supabase.from('athletes').update({ status: 'Active' }).eq('id', athleteId), teamId)
    if (error) alert('Failed: ' + error.message)
    else fetchData()
  }

  async function handleSave(){
    if (!form.athlete_id) return alert('Select athlete.')
    if (!teamId) return alert('Your account is not assigned to a team.')
    setSaving(true)

    let finalNotes = form.notes || ''
    if (form.red_card) {
      const banText = `[Red Card: Suspended for ${form.suspension_games || 1} match${(parseInt(form.suspension_games) || 1) > 1 ? 'es' : ''}]`
      if (!finalNotes.includes('Red Card')) {
        finalNotes = finalNotes ? `${banText} ${finalNotes}` : banText
      }
    }

    const payload={
      athlete_id:form.athlete_id,
      match_date:form.match_date,
      opponent:form.opponent,
      minutes_played:parseInt(form.minutes_played)||0,
      goals:parseInt(form.goals)||0,
      assists:parseInt(form.assists)||0,
      shots:parseInt(form.shots)||0,
      shots_on_target:parseInt(form.shots_on_target)||0,
      passes:parseInt(form.passes)||0,
      pass_accuracy:parseFloat(form.pass_accuracy)||0,
      distance_km:parseFloat(form.distance_km)||0,
      sprint_count:parseInt(form.sprint_count)||0,
      duels_won:parseInt(form.duels_won)||0,
      duels_total:parseInt(form.duels_total)||0,
      xg:parseFloat(form.xg)||0,
      xa:parseFloat(form.xa)||0,
      rating:parseFloat(form.rating)||0,
      notes:finalNotes,
      team_id:teamId,
      notified:false,           // always saved as draft until analyst publishes
    }
    if (editId){
      const {error}=await scopeTeam(supabase.from('performance_stats').update(payload).eq('id',editId), teamId)
      if(error) { alert(error.message); setSaving(false); return }
    } else {
      const {error}=await supabase.from('performance_stats').insert([payload])
      if(error) { alert(error.message); setSaving(false); return }
    }

    // Auto-update athlete status to Suspended if red card was flagged
    if (form.red_card && form.update_status_suspended && form.athlete_id) {
      await scopeTeam(supabase.from('athletes').update({ status: 'Suspended' }).eq('id', form.athlete_id), teamId)
    }

    setShowForm(false)
    if (!editId) setForm(EMPTY)
    fetchData()
    setSaving(false)
  }

  async function handlePublishNotify(){
    if (!teamId || publishing) return
    setPublishing(true)
    setPublishMsg('')
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      const res = await fetch('/api/performance/publish-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ team_id: teamId }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setPublishMsg(`OK: ${data.message}`)
        fetchData() // refresh — unpublished list will clear
      } else {
        setPublishMsg(`Error: ${data.error || 'Failed to publish'}`)
      }
    } catch(err) {
      setPublishMsg(`Error: ${err.message}`)
    }
    setPublishing(false)
  }

  async function handleDelete(id){
    if (!confirm('Delete this record?'))return;setDeleting(id)
    const {error}=await scopeTeam(supabase.from('performance_stats').delete().eq('id',id), teamId)
    if (error)alert(error.message);else fetchData();setDeleting(null)
  }

  function openAddFixture() {
    setEditFixId(null)
    setFixForm(EMPTY_FIXTURE)
    setFixCustomMode(false)
    setShowFixModal(true)
  }

  function openEditFixture(fx) {
    setEditFixId(fx.id)
    const matchedTeam = leagueTeams.find(t => t.id === fx.opponent_team_id || t.name?.toLowerCase() === fx.opponent_name?.toLowerCase())
    setFixCustomMode(!matchedTeam && !!fx.opponent_name)
    setFixForm({
      opponent_team_id: matchedTeam?.id || fx.opponent_team_id || '',
      opponent_name: fx.opponent_name || '',
      opponent_logo_url: fx.opponent_logo_url || matchedTeam?.logo_url || '',
      competition: fx.competition || 'Ghana Premier League',
      match_date: fx.match_date || new Date().toISOString().split('T')[0],
      kickoff_time: fx.kickoff_time || '15:00',
      venue: fx.venue || '',
      is_home: fx.is_home !== false,
      home_score: fx.home_score ?? '',
      away_score: fx.away_score ?? '',
      status: fx.status || 'scheduled',
      notes: fx.notes || '',
    })
    setShowFixModal(true)
  }

  async function handleSaveFixture() {
    if (!fixForm.opponent_name.trim()) return alert('Select or enter opponent team name.')
    if (!fixForm.match_date) return alert('Match date is required.')
    if (!teamId) return alert('No active team assigned.')
    setSavingFix(true)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fixForm.opponent_team_id || '')
    const payload = {
      team_id: teamId,
      opponent_team_id: isUuid ? fixForm.opponent_team_id : null,
      opponent_name: fixForm.opponent_name.trim(),
      opponent_logo_url: fixForm.opponent_logo_url || null,
      competition: fixForm.competition.trim() || 'Ghana Premier League',
      match_date: fixForm.match_date,
      kickoff_time: fixForm.kickoff_time || '15:00',
      venue: fixForm.venue.trim() || null,
      is_home: !!fixForm.is_home,
      home_score: fixForm.status === 'completed' && fixForm.home_score !== '' ? parseInt(fixForm.home_score, 10) : null,
      away_score: fixForm.status === 'completed' && fixForm.away_score !== '' ? parseInt(fixForm.away_score, 10) : null,
      status: fixForm.status || 'scheduled',
      notes: fixForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editFixId) {
      const { error } = await scopeTeam(supabase.from('fixtures').update(payload).eq('id', editFixId), teamId)
      if (error) alert(error.message)
      else { setShowFixModal(false); fetchData() }
    } else {
      const { error } = await supabase.from('fixtures').insert([{ ...payload, created_by: currentUser?.id || null }])
      if (error) alert(error.message)
      else { setShowFixModal(false); fetchData() }
    }
    setSavingFix(false)
  }

  async function handleDeleteFixture(id) {
    if (!confirm('Delete this official fixture?')) return
    const { error } = await scopeTeam(supabase.from('fixtures').delete().eq('id', id), teamId)
    if (error) alert(error.message)
    else fetchData()
  }

  const filtered=selAth==='all'?stats:stats.filter(s=>s.athlete_id===selAth)

  // Leaderboard
  const lb=athletes.map(a=>{
    const as=stats.filter(s=>s.athlete_id===a.id)
    return{...a,goals:as.reduce((x,s)=>x+(s.goals||0),0),assists:as.reduce((x,s)=>x+(s.assists||0),0),matches:as.length,avgRating:as.length?(as.reduce((x,s)=>x+parseFloat(s.rating||0),0)/as.length).toFixed(1):0}
  }).filter(a=>a.matches>0).sort((a,b)=>b.goals-a.goals).slice(0,5)

  // Admin (non-superadmin) has read-only access — coaches/analysts log match stats
  const isAdminReadOnly = currentUser?.role === 'admin'

  return(
    <Layout>
      <style>{`
        .perf-actions-bar { display:flex; gap:8px; flex-wrap:wrap; }
        .perf-tabs { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
        .perf-tab-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:9px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:var(--font); }
        .perf-fixture-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 20px; flex-wrap:wrap; }
        .perf-fixture-left { display:flex; align-items:center; gap:12px; min-width:0; flex:1 1 240px; }
        .perf-fixture-actions { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .perf-stats-scroll { overflow-x:auto !important; -webkit-overflow-scrolling:touch; width:100%; }
        .perf-stats-scroll .table-scroll-inner { min-width:860px; }
        .perf-stats-scroll .table-header-row { display:grid !important; }
        .perf-modal-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .perf-modal-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .perf-toggle-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px; }
        @media(max-width:640px) {
          .perf-actions-bar { width:100%; }
          .perf-actions-bar > button { flex:1 1 160px; justify-content:center; }
          .perf-tab-btn { flex:1 1 100%; }
          .perf-fixture-row { flex-direction:column; align-items:stretch !important; gap:10px !important; padding:14px 16px !important; }
          .perf-fixture-left { flex:1 1 auto !important; }
          .perf-fixture-actions { width:100%; justify-content:space-between; padding-top:8px; border-top:1px dashed #E2E8F0; }
          .perf-modal-header { padding:16px 18px !important; }
          .perf-modal-body { padding:16px !important; }
          .perf-modal-grid-2 { grid-template-columns:1fr !important; }
          .perf-modal-grid-4 { grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
        }
      `}</style>
      <div className="page-outer">
        <PageHeader label="Analytics" title="Performance & Official Fixtures" subtitle="Official GPL fixtures, match scores, xG, xA and player analytics"
          action={!isAdminReadOnly && (
            <div className="perf-actions-bar">
              <button onClick={openAddFixture} style={{ background:'#0F766E', color:'#fff', border:'none', borderRadius:10, padding:'9px 15px', fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'var(--font)' }}>
                <Plus size={15}/> Add Official Fixture
              </button>
              <button className="btn-blue" onClick={openAdd}>+ Log Match Stats</button>
            </div>
          )}/>

        {/* ── Tab Switcher: Official Fixtures & Scores vs Player Match Stats ── */}
        <div className="perf-tabs">
          {[
            { id:'fixtures', label:`Official Fixtures & Scores (${fixtures.length})`, icon:<CalendarDays size={15}/> },
            { id:'stats', label:`Player Match Stats (${stats.length})`, icon:<Trophy size={15}/> },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="perf-tab-btn"
              style={{
                background: activeTab === t.id ? '#0F766E' : 'var(--surface)',
                color: activeTab === t.id ? '#FFFFFF' : 'var(--text2)',
                border: activeTab === t.id ? '1.5px solid #0F766E' : '1px solid var(--border)',
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        {isAdminReadOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10, padding:'10px 16px', marginBottom:20, color:'#0369A1', fontSize:13, fontWeight:600 }}>
            <Eye size={16} style={{ flexShrink: 0 }} />
            <span><strong>View-Only Mode</strong> — Performance stats are logged by coaches and analysts. You can view and export all data.</span>
          </div>
        )}

        {/* ── Publish & Notify All banner ── */}
        {unpublished.length > 0 && (
          <div className="fade-up" style={{
            background: 'linear-gradient(135deg, rgba(13,148,136,0.08), rgba(20,184,166,0.05))',
            border: '1.5px solid rgba(13,148,136,0.25)',
            borderRadius: 14,
            padding: '14px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(13,148,136,0.1)', border:'1px solid rgba(13,148,136,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a5 5 0 015 5v2l1.5 2.5H1.5L3 9V7a5 5 0 015-5zM6 13.5c0 1.1.9 2 2 2s2-.9 2-2" stroke="#0D9488" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>
                  {unpublished.length} player{unpublished.length !== 1 ? 's\'' : '\'s'} stats saved — not yet notified
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                  {unpublished.slice(0,4).map(s => s.athletes?.name?.split(' ')[0]).filter(Boolean).join(', ')}
                  {unpublished.length > 4 ? ` and ${unpublished.length - 4} more` : ''}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {publishMsg && (
                <span style={{ fontSize:12, fontWeight:600, color: publishMsg.startsWith('OK:') ? '#0D9488' : 'var(--danger)' }}>
                  {publishMsg}
                </span>
              )}
              <button
                onClick={handlePublishNotify}
                disabled={publishing}
                style={{
                  background: publishing ? '#94A3B8' : 'linear-gradient(135deg,#0F766E,#0D9488)',
                  color:'#fff', border:'none', borderRadius:10,
                  padding:'9px 18px', fontSize:13, fontWeight:700,
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--font)',
                  boxShadow:'0 4px 12px rgba(13,148,136,0.25)',
                  whiteSpace:'nowrap',
                }}
              >
                {publishing ? 'Sending…' : 'Publish & Notify All'}
              </button>
            </div>
          </div>
        )}

        {/* ── Suspended Players / Disciplinary Status Banner ── */}
        {(() => {
          const suspendedAthletes = athletes.filter(a => (a.status || '').toLowerCase() === 'suspended')
          if (suspendedAthletes.length === 0) return null
          return (
            <div className="fade-up" style={{
              background: '#FFFBEB',
              border: '1.5px solid #FCD34D',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>
                    {suspendedAthletes.length} Player{suspendedAthletes.length > 1 ? 's' : ''} Suspended (Unavailable for Matchday Selection)
                  </div>
                  <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                    {suspendedAthletes.map(a => `${a.name}${a.back_number ? ' #' + a.back_number : ''}`).join(', ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {suspendedAthletes.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleReinstate(a.id, a.name)}
                    title={`Reinstate ${a.name} to active match status`}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D97706',
                      color: '#92400E',
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    ✓ Lift Ban for {a.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── OFFICIAL FIXTURES & SCORES TAB ── */}
        {activeTab === 'fixtures' && (
          <div className="card fade-up" style={{ padding:0, overflow:'hidden', marginBottom:24 }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
              <div>
                <h2 style={{ fontSize:16, fontWeight:800, margin:0, color:'var(--text)' }}>Official Fixtures &amp; Match Results</h2>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Official competitive fixtures &amp; scorelines (feeds Analyst Dashboard &amp; Reports)</div>
              </div>
              {!isAdminReadOnly && (
                <button onClick={openAddFixture} style={{ background:'#F0FDFA', color:'#0F766E', border:'1px solid #99F6E4', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  + New Fixture / Score
                </button>
              )}
            </div>
            {loading ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Loading official fixtures...</div>
            ) : fixtures.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                No official fixtures recorded yet. Click <strong>+ Add Official Fixture</strong> to schedule a match or enter a scoreline.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {fixtures.map((fx, idx) => {
                  const isCompleted = fx.status === 'completed'
                  const ourScore = fx.is_home ? fx.home_score : fx.away_score
                  const oppScore = fx.is_home ? fx.away_score : fx.home_score
                  let resLabel = null, resBg = '#F1F5F9', resColor = '#475569'
                  if (isCompleted && ourScore !== null && oppScore !== null) {
                    if (ourScore > oppScore) { resLabel = 'W'; resBg = '#DCFCE7'; resColor = '#15803D' }
                    else if (ourScore < oppScore) { resLabel = 'L'; resBg = '#FEE2E2'; resColor = '#DC2626' }
                    else { resLabel = 'D'; resBg = '#FEF3C7'; resColor = '#B45309' }
                  }
                  return (
                    <div key={fx.id} className="perf-fixture-row" style={{ borderBottom: idx < fixtures.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="perf-fixture-left">
                        {fx.opponent_logo_url ? (
                          <img src={fx.opponent_logo_url} alt={fx.opponent_name} style={{ width:36, height:36, borderRadius:8, objectFit:'contain', background:'#F8FAFC', border:'1px solid var(--border)', padding:2, flexShrink:0 }} />
                        ) : (
                          <div style={{ width:36, height:36, borderRadius:8, background:'#F0FDFA', color:'#0F766E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                            {(fx.opponent_name || 'OPP').slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>
                              {fx.is_home ? 'vs' : '@'} {fx.opponent_name}
                            </span>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, background: fx.is_home ? '#EFF6FF' : '#F3E8FF', color: fx.is_home ? '#1D4ED8' : '#7C3AED' }}>
                              {fx.is_home ? 'HOME' : 'AWAY'}
                            </span>
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                            {fx.match_date} {fx.kickoff_time ? `· ${fx.kickoff_time}` : ''} · {fx.competition}{fx.venue ? ` · ${fx.venue}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="perf-fixture-actions">
                        {isCompleted && fx.home_score !== null && fx.away_score !== null ? (
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <span style={{ fontSize:15, fontWeight:900, color:'#0F172A', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'4px 12px', borderRadius:8 }}>
                              {fx.home_score} - {fx.away_score}
                            </span>
                            {resLabel && (
                              <span style={{ width:24, height:24, borderRadius:6, background:resBg, color:resColor, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900 }}>
                                {resLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, background: fx.status === 'postponed' ? '#FEE2E2' : '#F0FDFA', color: fx.status === 'postponed' ? '#DC2626' : '#0F766E', textTransform:'uppercase' }}>
                            {fx.status}
                          </span>
                        )}

                        {!isAdminReadOnly && (
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => openEditFixture(fx)} title="Edit fixture / score"
                              style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:11.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
                              <Edit2 size={12}/> Edit
                            </button>
                            <button onClick={() => handleDeleteFixture(fx.id)} title="Delete fixture"
                              style={{ padding:'6px 8px', borderRadius:7, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', fontSize:11.5, cursor:'pointer', display:'inline-flex', alignItems:'center' }}>
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (<>
        {/* Leaderboard with photos */}
        {lb.length>0&&(
          <div className="fade-up" style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:16,fontWeight:700,marginBottom:14 }}>Top Performers</h2>
            <div className="stat-grid-5" style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
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
                    {[['',a.goals,'G'],['A',a.assists,'A'],['',a.avgRating,'Avg'],['',a.matches,'Matches']].map(([ic,v,l])=>(
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
          <div className="perf-stats-scroll">
          <div className="table-scroll-inner table-scroll-wide">
          <div className="table-header-row" style={{ display:'grid',gridTemplateColumns:'1.8fr 0.9fr 0.9fr 0.6fr 0.6fr 0.6fr 0.6fr 0.8fr 0.7fr 0.6fr 0.7fr 1fr',gap:6,padding:'11px 18px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
            {['Athlete','Date','Opponent','Min','G','A','xG','xA','Pass%','Dist','Rating','Actions'].map(h=>(
              <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>
          {loading?(
            <div style={{ padding:'48px',textAlign:'center' }}><div style={{ width:28,height:28,border:'3px solid #F0FDFA',borderTopColor:'#0D9488',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto' }}/></div>
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
              <div style={{ fontSize:13,fontWeight:800,color:'#0D9488' }}>{s.goals}</div>
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
                {!isAdminReadOnly && <button onClick={()=>openEdit(s)} style={{ background:'#F0FDFA',color:'#0D9488',border:'none',padding:'3px 8px',borderRadius:'var(--r-sm)',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>Edit</button>}
                {!isAdminReadOnly && <button onClick={()=>handleDelete(s.id)} disabled={deleting===s.id} style={{ background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'3px 8px',borderRadius:'var(--r-sm)',fontSize:10,fontWeight:600,cursor:'pointer',opacity:deleting===s.id?0.5:1,fontFamily:'var(--font)' }}>{deleting===s.id?'…':'Del'}</button>}
                {isAdminReadOnly && <span style={{ fontSize:9, color:'#94A3B8', fontWeight:600 }}>View only</span>}
              </div>
            </div>
          ))}
          </div>
          </div>
        </div>
        </>)}
      </div>

      {/* Modal */}
      {showForm&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'#FFFFFF',borderRadius:'20px',width:'100%',maxWidth:620,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px -10px rgba(0,0,0,0.25)',border:'1px solid #E2E8F0' }}>
            {/* Modal Header */}
            <div className="perf-modal-header" style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)',padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'20px 20px 0 0' }}>
              <div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.65)',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:3 }}>{editId?'Edit Record':'New Registration'}</div>
                <h2 style={{ fontSize:18,fontWeight:800,color:'#fff',margin:0 }}>{editId?'Edit Stats':'Log Match Stats'}</h2>
              </div>
              <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1 }}>×</button>
            </div>

            {/* Modal Body */}
            <div className="perf-modal-body" style={{ padding:24,display:'flex',flexDirection:'column',gap:14 }}>
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
              {/* ── Official Fixture Quick-Pick ── */}
              {fixtures.length > 0 && (
                <div>
                  <label style={lbl}>Link to Official Fixture (Optional)</label>
                  <select
                    value=""
                    onChange={e => {
                      const fx = fixtures.find(f => f.id === e.target.value)
                      if (fx) {
                        setForm(f => ({ ...f, opponent: fx.opponent_name, match_date: fx.match_date }))
                      }
                    }}
                    style={inp}
                  >
                    <option value="">-- Pick an entered official fixture to auto-fill --</option>
                    {fixtures.map(fx => (
                      <option key={fx.id} value={fx.id}>
                        {fx.match_date} · {fx.is_home ? 'vs' : '@'} {fx.opponent_name} {fx.status === 'completed' && fx.home_score !== null ? `(${fx.home_score}-${fx.away_score})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="perf-modal-grid-2">
                <div><label style={lbl}>Match Date</label><input type="date" value={form.match_date} onChange={e=>set('match_date')(e.target.value)} style={inp}/></div>
                <div>
                  <label style={lbl}>Opponent</label>
                  {leagueTeams.length > 0 ? (
                    <select
                      value={leagueTeams.some(t => t.name === form.opponent) ? form.opponent : (form.opponent ? '__custom__' : '')}
                      onChange={e => {
                        if (e.target.value !== '__custom__') set('opponent')(e.target.value)
                      }}
                      style={inp}
                    >
                      <option value="">Select GPL Opponent…</option>
                      {leagueTeams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      <option value="__custom__">Other (type below)</option>
                    </select>
                  ) : null}
                  {(leagueTeams.length === 0 || !leagueTeams.some(t => t.name === form.opponent)) && (
                    <input value={form.opponent} onChange={e=>set('opponent')(e.target.value)} style={{ ...inp, marginTop: leagueTeams.length > 0 ? 6 : 0 }} placeholder="e.g. Asante Kotoko"/>
                  )}
                </div>
              </div>
              <div className="perf-modal-grid-4">
                {[['Minutes','minutes_played'],['Goals','goals'],['Assists','assists'],['Shots','shots'],['On Target','shots_on_target'],['Passes','passes'],['Pass Acc%','pass_accuracy'],['Dist(km)','distance_km'],['Sprints','sprint_count'],['Duels Won','duels_won'],['Duels Total','duels_total'],['Rating/10','rating']].map(([label,key])=>(
                  <div key={key}><label style={lbl}>{label}</label><input type="number" step={['pass_accuracy','distance_km','rating'].includes(key)?'0.1':'1'} min="0" value={form[key]} onChange={e=>set(key)(e.target.value)} style={inp}/></div>
                ))}
              </div>
              <div className="perf-modal-grid-2">
                <div><label style={lbl}>xG</label><input type="number" step="0.001" min="0" value={form.xg} onChange={e=>set('xg')(e.target.value)} style={inp}/></div>
                <div><label style={lbl}>xA</label><input type="number" step="0.001" min="0" value={form.xa} onChange={e=>set('xa')(e.target.value)} style={inp}/></div>
              </div>
              {/* ── Disciplinary & Red Card ── */}
              <div style={{
                background: form.red_card ? '#FFF1F2' : '#F8FAFC',
                border: `1.5px solid ${form.red_card ? '#FDA4AF' : '#E2E8F0'}`,
                borderRadius: 12,
                padding: '12px 16px',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.red_card}
                      onChange={e => setForm(f => ({ ...f, red_card: e.target.checked, update_status_suspended: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: '#E11D48', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: form.red_card ? '#BE123C' : '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 16, background: '#DC2626', borderRadius: 2, display: 'inline-block', boxShadow: '0 1px 3px rgba(220,38,38,0.4)' }} />
                      Red Card / Match Suspension
                    </span>
                  </label>
                  {form.red_card && (
                    <span style={{ fontSize: 11, background: '#FFE4E6', color: '#BE123C', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      Suspension Active
                    </span>
                  )}
                </div>

                {form.red_card && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #FECDD3', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="perf-modal-grid-2">
                      <div>
                        <label style={{ ...lbl, color: '#BE123C' }}>Suspension Length</label>
                        <select
                          value={form.suspension_games}
                          onChange={e => setForm(f => ({ ...f, suspension_games: parseInt(e.target.value) || 1 }))}
                          style={{ ...inp, background: '#FFFFFF', borderColor: '#FDA4AF' }}
                        >
                          <option value="1">1 Match Ban (Standard / 2nd Yellow)</option>
                          <option value="2">2 Matches Ban (Serious Foul Play)</option>
                          <option value="3">3 Matches Ban (Violent Conduct)</option>
                          <option value="4">4 Matches Ban</option>
                          <option value="5">5+ Matches Ban</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ ...lbl, color: '#BE123C' }}>Automatic Squad Status</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 12, color: '#9F1239', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={form.update_status_suspended}
                            onChange={e => setForm(f => ({ ...f, update_status_suspended: e.target.checked }))}
                            style={{ width: 16, height: 16, accentColor: '#E11D48' }}
                          />
                          Mark player &ldquo;Suspended&rdquo; (blocks matchday selection)
                        </label>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: '#9F1239', lineHeight: 1.4 }}>
                      ℹ️ Suspended players are automatically excluded from Starting XI and Substitutes selection in Matchday Call-Ups until reinstated.
                    </p>
                  </div>
                )}
              </div>

              <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes')(e.target.value)} rows={2} style={{ ...inp,resize:'vertical' }}/></div>
              <div style={{ display:'flex',gap:10,paddingTop:8 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1,background:'#F1F5F9',border:'1px solid #E2E8F0',color:'#334155',padding:'11px',borderRadius:'12px',fontSize:14,cursor:'pointer',fontWeight:700,fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2,padding:'11px',opacity:saving?0.7:1,fontSize:14,background:'linear-gradient(135deg,#0F766E,#0D9488)',border:'none',color:'#fff',borderRadius:'12px',cursor:'pointer',fontWeight:800,fontFamily:'var(--font)' }}>{saving?'Saving…':editId?'Save Changes':'Log Stats'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Official Fixture Add/Edit Modal ── */}
      {showFixModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowFixModal(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              width: '100%',
              maxWidth: 560,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Header */}
            <div className="perf-modal-header" style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)', padding: '20px 24px', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{editFixId ? 'Edit Official Fixture & Score' : 'Add Official Fixture'}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: '3px 0 0' }}>2026/2027 Ghana Premier League &amp; Official Competitions</p>
              </div>
              <button onClick={() => setShowFixModal(false)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>

            <div className="perf-modal-body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Opponent Selector with GPL Directory vs Custom Toggle */}
              <div>
                <div className="perf-toggle-row">
                  <label style={{ ...lbl, marginBottom: 0 }}>Opponent Team *</label>
                  <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                    {[
                      { id: false, label: 'GPL Directory' },
                      { id: true, label: 'Custom Team' },
                    ].map(opt => (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => {
                          setFixCustomMode(opt.id)
                          if (opt.id) {
                            setFixForm(f => ({ ...f, opponent_team_id: '', opponent_logo_url: '' }))
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: fixCustomMode === opt.id ? '#FFFFFF' : 'transparent',
                          color: fixCustomMode === opt.id ? '#0F766E' : '#64748B',
                          boxShadow: fixCustomMode === opt.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!fixCustomMode ? (
                  <>
                    <select
                      value={fixForm.opponent_team_id || ''}
                      onChange={e => {
                        const t = leagueTeams.find(x => x.id === e.target.value)
                        if (t) {
                          setFixForm(f => ({ ...f, opponent_team_id: t.id, opponent_name: t.name, opponent_logo_url: t.logo_url || '' }))
                        } else {
                          setFixForm(f => ({ ...f, opponent_team_id: '', opponent_name: '', opponent_logo_url: '' }))
                        }
                      }}
                      style={inp}
                    >
                      <option value="">-- Select GPL Team ({leagueTeams.length} clubs) --</option>
                      {leagueTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{t.short_name ? ` (${t.short_name})` : ''}</option>
                      ))}
                    </select>
                    {fixForm.opponent_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 12px', background: '#F0FDFA', borderRadius: 10, border: '1px solid #CCFBF1' }}>
                        {fixForm.opponent_logo_url ? (
                          <img src={fixForm.opponent_logo_url} alt={fixForm.opponent_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2 }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F766E', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {fixForm.opponent_name.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>{fixForm.opponent_name}</div>
                          <div style={{ fontSize: 10.5, color: '#0F766E', fontWeight: 600 }}>Official 2026/2027 GPL Crest Ready</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    value={fixForm.opponent_name}
                    onChange={e => setFixForm(f => ({ ...f, opponent_name: e.target.value, opponent_team_id: '', opponent_logo_url: '' }))}
                    placeholder="Enter custom opponent club name"
                    style={inp}
                  />
                )}
              </div>

              {/* Date & Kickoff */}
              <div className="perf-modal-grid-2">
                <div>
                  <label style={lbl}>Match Date *</label>
                  <input type="date" value={fixForm.match_date} onChange={e => setFixForm(f => ({ ...f, match_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Kickoff Time</label>
                  <input type="time" value={fixForm.kickoff_time} onChange={e => setFixForm(f => ({ ...f, kickoff_time: e.target.value }))} style={inp} />
                </div>
              </div>

              {/* Venue Type Pills + Competition */}
              <div className="perf-modal-grid-2">
                <div>
                  <label style={lbl}>Home / Away</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#F8FAFC', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                    {[
                      { val: true, label: 'Home' },
                      { val: false, label: 'Away' },
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => setFixForm(f => ({ ...f, is_home: opt.val }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: fixForm.is_home === opt.val ? '#0F766E' : 'transparent',
                          color: fixForm.is_home === opt.val ? '#FFFFFF' : '#64748B',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Competition</label>
                  <input value={fixForm.competition} onChange={e => setFixForm(f => ({ ...f, competition: e.target.value }))} style={inp} placeholder="Ghana Premier League" />
                </div>
              </div>

              {/* Venue & Status */}
              <div>
                <label style={lbl}>Venue / Stadium</label>
                <input value={fixForm.venue} onChange={e => setFixForm(f => ({ ...f, venue: e.target.value }))} style={inp} placeholder="e.g. Baba Yara Sports Stadium" />
              </div>

              <div>
                <label style={lbl}>Match Status</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'scheduled', label: 'Scheduled', color: '#0F766E', bg: '#F0FDFA' },
                    { id: 'completed', label: 'Completed', color: '#1D4ED8', bg: '#EFF6FF' },
                    { id: 'postponed', label: 'Postponed', color: '#DC2626', bg: '#FEF2F2' },
                  ].map(st => {
                    const active = fixForm.status === st.id
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setFixForm(f => ({ ...f, status: st.id }))}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 10,
                          border: active ? `1.5px solid ${st.color}` : '1px solid #E2E8F0',
                          background: active ? st.bg : '#F8FAFC',
                          color: active ? st.color : '#64748B',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {st.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {fixForm.status === 'completed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: '14px 16px', background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0' }}>
                  <div>
                    <label style={{ ...lbl, textAlign: 'center' }}>Home Score</label>
                    <input type="number" min="0" value={fixForm.home_score} onChange={e => setFixForm(f => ({ ...f, home_score: e.target.value }))} style={{ ...inp, textAlign: 'center', fontSize: 18, fontWeight: 800 }} placeholder="0" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#94A3B8', paddingTop: 18 }}>:</div>
                  <div>
                    <label style={{ ...lbl, textAlign: 'center' }}>Away Score</label>
                    <input type="number" min="0" value={fixForm.away_score} onChange={e => setFixForm(f => ({ ...f, away_score: e.target.value }))} style={{ ...inp, textAlign: 'center', fontSize: 18, fontWeight: 800 }} placeholder="0" />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={() => setShowFixModal(false)} style={{ flex: 1, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155', padding: 12, borderRadius: 12, fontSize: 14, cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font)' }}>Cancel</button>
                <button type="button" onClick={handleSaveFixture} disabled={savingFix} style={{ flex: 2, padding: 12, fontSize: 14, background: 'linear-gradient(135deg,#0F766E,#0D9488)', border: 'none', color: '#fff', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontFamily: 'var(--font)', boxShadow: '0 4px 14px rgba(13,148,136,0.28)' }}>
                  {savingFix ? 'Saving…' : editFixId ? 'Update Fixture' : 'Save Official Fixture'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
