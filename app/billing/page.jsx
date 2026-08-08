'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/subscription'
import { fetchWithAuth } from '@/lib/tenant'

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxx'

/* ── Custom CSS Animations & Shimmers ── */
const customStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in {
    animation: fadeInScale 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
  }
  .pricing-card {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pricing-card:hover {
    transform: translateY(-4px);
    border-color: var(--lagoon) !important;
    box-shadow: var(--shadow-lg) !important;
  }
  .payment-method-card {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .payment-method-card:hover {
    transform: translateY(-2px);
    border-color: var(--lagoon-light) !important;
    box-shadow: var(--shadow-md) !important;
  }
  .btn-hover-effect {
    transition: all 0.2s ease;
  }
  .btn-hover-effect:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
  }
`

/* ── Minimal SVG icons ── */
const Icon = {
  check: (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5 9.5L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  lock:  (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  alert: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>),
  card:  (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 6.5H14.5" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="9" width="3" height="1.5" rx="0.5" fill="currentColor"/></svg>),
  mobile:(<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="12.5" r="0.75" fill="currentColor"/></svg>),
  arrow: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M3 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  history:(<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  spinner:(size=20)=>(<div style={{width:size,height:size,border:`${size>16?3:2}px solid var(--border)`,borderTopColor:'var(--lagoon)',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>),
}

/* ── Real Logos ── */
const Logo = {
  paystack: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg viewBox="0 0 32 32" style={{ width: 18, height: 18 }} fill="none">
        <rect x="0" y="4" width="24" height="4" rx="2" fill="#09A5DB" />
        <rect x="0" y="11" width="32" height="4" rx="2" fill="#09A5DB" />
        <rect x="0" y="18" width="32" height="4" rx="2" fill="#09A5DB" />
        <rect x="0" y="25" width="16" height="4" rx="2" fill="#09A5DB" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font)', letterSpacing: '-0.03em' }}>paystack</span>
    </div>
  ),
  moolre: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg viewBox="0 0 120 120" style={{ width: 18, height: 18 }} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M45 20C28 20 15 33 15 60C15 87 28 100 45 100" stroke="#FFA726" strokeWidth="15" strokeLinecap="round" />
        <path d="M48 60L72 36C82 26 95 26 105 36C115 46 115 59 105 69L105 100" stroke="#FFA726" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font)', letterSpacing: '-0.02em' }}>moolre</span>
    </div>
  )
}

const PLANS = {
  starting_xi:{ label:'Starting XI', price:199, usd:13, popular:false,
    features:['Up to 40 athletes','Squad Roster','Training Scheduler','Injury Hub','Basic Reports (PDF export)','Admin + Coach + Physio roles','Email support'],
    locked:  ['ApexPay Payroll Module','Performance Analytics','Scouting Module + Transfers','Advanced Reports','Analyst role','Custom club branding'] },
  captain:    { label:'Captain',      price:499, usd:33, popular:false,
    features:['Unlimited athletes','Everything in Starting XI','ApexPay Payroll & MoMo Disbursements','Performance Analytics (xG, xA, match ratings)','Scouting Module + Transfers','Advanced Reports (board/medical)','All 4 roles including Analyst','Custom club branding','Priority support + onboarding'],
    locked:[] },
}

const TABS = [
  { id:'overview', label:'Overview'        },
  { id:'upgrade',  label:'Change Plan'     },
  { id:'history',  label:'Payment History' },
]

const MODULE_NAMES = { coaches:'Staff', injuries:'Medical Hub', performance:'Performance Analytics', scouting:'Scouting', contracts:'Contracts', reports:'Reports' }
const STATUS_COLORS = {
  active:   { bg:'var(--success-light)', color:'var(--success)' },
  trial:    { bg:'rgba(13,148,136,0.1)', color:'var(--lagoon)'  },
  expired:  { bg:'var(--danger-light)',  color:'var(--danger)'  },
  cancelled:{ bg:'var(--danger-light)',  color:'var(--danger)'  },
}

function daysLeft(d){ if(!d)return 0; return Math.max(0,Math.ceil((new Date(d)-new Date())/86400000)) }
function fmtDate(d) { if(!d)return'—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) }

function loadPaystack(){
  return new Promise(resolve=>{
    if(window.PaystackPop){resolve();return}
    const s=document.createElement('script'); s.src='https://js.paystack.co/v1/inline.js'; s.onload=resolve; document.head.appendChild(s)
  })
}

function StatTile({label,value}){
  return(
    <div style={{background:'var(--surface2,rgba(255,255,255,0.6))',borderRadius:'var(--r-md)',padding:'14px 16px',border:'1px solid var(--border)'}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:6}}>{label}</div>
      <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{value}</div>
    </div>
  )
}

function FeatureRow({text,locked}){
  return(
    <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6}}>
      <span style={{color:locked?'var(--text3)':'var(--success)',flexShrink:0,marginTop:1}}>{locked?Icon.lock:Icon.check}</span>
      <span style={{fontSize:12,color:locked?'var(--text3)':'var(--text2)',lineHeight:1.5}}>{text}</span>
    </div>
  )
}

function AlertBanner({variant='warning',children,action}){
  const s={
    warning:{bg:'var(--warning-light)',border:'rgba(217,119,6,0.25)',color:'#92400E'},
    danger: {bg:'var(--danger-light)', border:'rgba(225,29,72,0.2)', color:'var(--danger)'},
  }[variant]
  return(
    <div style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:'var(--r-lg)',padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14,animation:'fadeInScale 0.25s ease'}}>
      <span style={{color:s.color,flexShrink:0}}>{Icon.alert}</span>
      <div style={{flex:1}}>{children}</div>
      {action}
    </div>
  )
}

function BillingContent(){
  const searchParams  = useSearchParams()
  const upgradeReason = searchParams.get('reason')
  const blockedModule = searchParams.get('module')

  const [profile,   setProfile]   = useState(null)
  const [sub,       setSub]       = useState(null)
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('overview')
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [selPlan,   setSelPlan]   = useState(null)
  const [paying,    setPaying]    = useState(false)
  const [payMethod, setPayMethod] = useState(null)
  const [msg,       setMsg]       = useState({text:'',type:''})
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'annual'
  const [verifyStatus, setVerifyStatus] = useState(null) // { type: 'loading'|'success'|'error', text: string }

  // Usage Stats
  const [athleteCount, setAthleteCount] = useState(0)
  const [staffCount,   setStaffCount]   = useState(0)
  const [isNativeApp,  setIsNativeApp]  = useState(false)

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        setIsNativeApp(true)
      }
    }).catch(() => {})
  }, [])

  const flash=(text,type='success')=>{ setMsg({text,type}); setTimeout(()=>setMsg({text:'',type:''}),9000) }

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)return
      const{data:p}=await supabase.from('profiles').select('*,teams(id,name,short_name)').eq('id',session.user.id).single()
      if(!p)return
      setProfile({...p,email:session.user.email})
      setIsAdmin(p.role==='admin'||p.role==='superadmin')
      if(p.team_id){
        // Fetch Billing API
        const res=await fetchWithAuth(`/api/billing?team_id=${p.team_id}`)
        const data=await res.json()
        setSub(data.subscription); setHistory(data.history||[])

        // Fetch counts for usage limits
        const [athCountRes, coachCountRes] = await Promise.all([
          supabase.from('athletes').select('id', { count: 'exact', head: true }).eq('team_id', p.team_id),
          supabase.from('coaches').select('id', { count: 'exact', head: true }).eq('team_id', p.team_id)
        ])
        setAthleteCount(athCountRes.count || 0)
        setStaffCount(coachCountRes.count || 0)
      }
    }catch(e){console.error(e)}
    setLoading(false)
  },[])

  useEffect(()=>{
    load()
    // Auto-verify payment after Moolre POS redirect
    if(typeof window==='undefined') return
    const params=new URLSearchParams(window.location.search)
    const ref=params.get('ref')
    if(ref&&ref.startsWith('APEX-M-')){
      const plan=params.get('plan')
      const team_id=params.get('team_id')
      // Clean URL immediately
      const url=new URL(window.location.href)
      url.searchParams.delete('ref'); url.searchParams.delete('plan')
      url.searchParams.delete('team_id'); url.searchParams.delete('redirect')
      window.history.replaceState({},'',(url.pathname+url.search).replace(/\?$/,''))
      if(ref&&plan&&team_id){
        setVerifyStatus({type:'loading',text:'Verifying your payment… Please do not close this page.'})
        fetchWithAuth('/api/billing/verify-moolre',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({reference:ref,plan,team_id}),
        })
        .then(r=>r.json())
        .then(data=>{
          if(data.ok){
            setVerifyStatus({type:'success',text:data.message||'Payment verified — your plan is now active!'})
            load()
          } else {
            setVerifyStatus({type:'error',text:data.error||'Payment verification failed. Please contact support with ref: '+ref})
          }
        })
        .catch(()=>setVerifyStatus({type:'error',text:'Network error during verification. Contact support with ref: '+ref}))
      }
    }
  },[load])
  useEffect(()=>{ if(upgradeReason==='upgrade_required'||upgradeReason==='expired') setTab('upgrade') },[upgradeReason])

  // Compute pricing safely
  const planPrice = selPlan ? (billingCycle === 'monthly' ? PLANS[selPlan].price : Math.round(PLANS[selPlan].price * 12 * 0.8)) : 0
  const planUsd   = selPlan ? (billingCycle === 'monthly' ? PLANS[selPlan].usd   : Math.round(PLANS[selPlan].usd * 12 * 0.8)) : 0

  async function handlePaystack(){
    if(!selPlan){flash('Select a plan first.','error');return}
    if(!profile?.email){flash('Profile email not found.','error');return}
    setPaying(true)
    try{
      await loadPaystack()
      const ref=`APEX-${profile.team_id?.slice(0,8)}-${Date.now()}`
      const handler=window.PaystackPop.setup({
        key:PAYSTACK_PUBLIC_KEY, email:profile.email,
        amount:planPrice*100, currency:'GHS', ref,
        label:`Apex Track — ${PLANS[selPlan].label} (${billingCycle})`,
        metadata:{custom_fields:[
          {display_name:'Club',variable_name:'club',value:profile.teams?.name||'Unknown'},
          {display_name:'Plan',variable_name:'plan',value:selPlan},
          {display_name:'Cycle',variable_name:'cycle',value:billingCycle},
          {display_name:'Team ID',variable_name:'team_id',value:profile.team_id},
        ]},
        channels:['card','mobile_money','bank'],
        onClose:()=>{setPaying(false);flash('Payment window closed.','error')},
        callback:(response)=>{
          fetchWithAuth('/api/billing',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({team_id:profile.team_id,plan:selPlan,payment_method:'paystack',payment_ref:response.reference,notes:`Paystack (${billingCycle}) — `+response.reference,requested_by:profile.id}),
          })
          .then(r=>r.json())
          .then(data=>{
            if(data.error){flash('Activation failed: '+(data.error||'Unknown')+'. Ref: '+response.reference,'error');setPaying(false);return}
            flash('Payment successful — '+PLANS[selPlan].label+' plan is now active.','success')
            load().then(()=>setTab('overview')); setPaying(false)
          })
          .catch(()=>{flash('Payment received but activation failed. Ref: '+response.reference,'error');setPaying(false)})
        },
      })
      handler.openIframe()
    }catch(e){flash('Error: '+e.message,'error');setPaying(false)}
  }

  async function handleMoolre(){
    if(!selPlan){flash('Select a plan first.','error');return}
    if(!profile?.email){flash('Profile email not found.','error');return}
    setPaying(true)
    try{
      const ref=`APEX-M-${profile.team_id?.slice(0,8)}-${Date.now()}`
      const res=await fetchWithAuth('/api/billing/moolre-checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({team_id:profile.team_id,plan:selPlan,email:profile.email,ref,amount_ghs:planPrice}),
      })
      const data=await res.json()
      if(data.error){flash('Could not initiate Moolre payment: '+data.error,'error');setPaying(false);return}
      if(data.checkout_url){window.location.href=data.checkout_url;return}
      flash('Moolre payment initiated. Reference: '+ref,'success'); setPaying(false)
    }catch(e){flash('Error: '+e.message,'error');setPaying(false)}
  }

  async function handleCancel(){
    if(!confirm('Cancel your subscription?'))return
    const res=await fetchWithAuth('/api/billing',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:profile.team_id,action:'cancel',requested_by:profile.id})})
    const data=await res.json()
    if(!res.ok){flash(data.error||'Failed.','error');return}
    flash('Subscription cancelled.','success'); await load()
  }

  let activePlanKey=sub?.plan
  if(activePlanKey==='starter')                               activePlanKey='starting_xi'
  if(activePlanKey==='academy'||activePlanKey==='elite')      activePlanKey='captain'

  const currentPlan=sub?PLANS[activePlanKey]:null
  const planLimits =sub?PLAN_LIMITS[activePlanKey]:null
  const statusStyle=sub?(STATUS_COLORS[sub.status]||STATUS_COLORS.active):STATUS_COLORS.active
  const days       =sub?daysLeft(sub.plan==='trial'?sub.trial_ends_at:sub.current_period_end):0

  if(loading)return(<Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>{Icon.spinner(36)}</div></Layout>)

  // Progress variables
  const maxDays = sub?.plan === 'trial' ? 30 : 30
  const billingProgress = Math.min(100, Math.max(0, ((maxDays - days) / maxDays) * 100))

  // Logo brand component for Page Header action slot
  const apexBrand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 14px', animation: 'fadeInScale 0.25s ease' }}>
      <img src="/logo.png" alt="Apex Track" style={{ width: 18, height: 18, objectFit: 'contain' }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Apex <span style={{ color: 'var(--lagoon)' }}>Track</span></span>
    </div>
  )

  return(
    <Layout>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="page-outer" style={{maxWidth: 960}}>
        <PageHeader label="Subscription" title="Billing & Plan" subtitle="Manage your Apex Track subscription" action={apexBrand}/>

        {upgradeReason==='upgrade_required'&&blockedModule&&(
          <AlertBanner variant="warning" action={
            <button onClick={()=>setTab('upgrade')} className="gm-btn btn-hover-effect" style={{padding:'8px 18px',fontSize:12,flexShrink:0}}>Upgrade</button>
          }>
            <div style={{fontSize:14,fontWeight:700,color:'#92400E',marginBottom:2}}>{MODULE_NAMES[blockedModule]||blockedModule} requires a higher plan</div>
            <div style={{fontSize:13,color:'#78350F'}}>Upgrade your subscription to unlock this module.</div>
          </AlertBanner>
        )}

        {upgradeReason==='expired'&&(
          <AlertBanner variant="danger">
            <div style={{fontSize:14,fontWeight:700,color:'var(--danger)',marginBottom:2}}>Your subscription has expired</div>
            <div style={{fontSize:13,color:'#9F1239'}}>Subscribe now to restore access to your club data.</div>
          </AlertBanner>
        )}

        {isNativeApp&&(
          <div style={{background:'linear-gradient(135deg, #0F766E, #0D9488)',color:'#FFFFFF',padding:'16px 20px',borderRadius:'var(--r-lg)',marginBottom:24,boxShadow:'var(--shadow-md)'}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
              <span>📲</span> Mobile App Subscription Management
            </div>
            <div style={{fontSize:12,opacity:0.92,lineHeight:1.6}}>
              Club subscriptions and billing management for ApexTrack GH are administered via our web dashboard. To change your plan or make payments, please sign in at <strong>apextrackgh.com</strong> on any desktop or mobile web browser.
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',marginBottom:28}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              display:'inline-flex',alignItems:'center',gap:7,
              padding:'10px 18px',background:'none',border:'none',
              borderBottom:tab===t.id?'2.5px solid var(--lagoon)':'2.5px solid transparent',
              fontSize:13,fontWeight:tab===t.id?700:500,
              color:tab===t.id?'var(--lagoon)':'var(--text3)',
              cursor:'pointer',fontFamily:'var(--font)',marginBottom:-1,transition:'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Flash message */}
        {msg.text&&(
          <div style={{
            padding:'13px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,lineHeight:1.6,marginBottom:20,
            background:msg.type==='error'?'var(--danger-light)':'var(--success-light)',
            color:msg.type==='error'?'var(--danger)':'var(--success)',
            border:`1px solid ${msg.type==='error'?'rgba(225,29,72,0.2)':'rgba(5,150,105,0.2)'}`,
            animation:'fadeInScale 0.2s ease',
          }}>{msg.text}</div>
        )}

        {/* Payment verification banner (shown after Moolre POS redirect) */}
        {verifyStatus&&(
          <div style={{
            padding:'13px 18px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,lineHeight:1.6,marginBottom:20,
            background:verifyStatus.type==='loading'?'var(--warning-light)':verifyStatus.type==='success'?'var(--success-light)':'var(--danger-light)',
            color:verifyStatus.type==='loading'?'#92400E':verifyStatus.type==='success'?'var(--success)':'var(--danger)',
            border:`1px solid ${verifyStatus.type==='loading'?'rgba(217,119,6,0.25)':verifyStatus.type==='success'?'rgba(5,150,105,0.2)':'rgba(225,29,72,0.2)'}`,
            animation:'fadeInScale 0.2s ease',
            display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
          }}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {verifyStatus.type==='loading'&&<div style={{width:14,height:14,border:'2px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>}
              {verifyStatus.type==='success'&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {verifyStatus.type==='error'&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}><path d="M8 2L14 13H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              <span>{verifyStatus.text}</span>
            </div>
            {verifyStatus.type!=='loading'&&(
              <button onClick={()=>setVerifyStatus(null)} style={{background:'none',border:'none',color:'inherit',fontWeight:'bold',cursor:'pointer',fontSize:16,padding:'0 4px'}}>×</button>
            )}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:20}}>
            
            {/* Premium Plan Dashboard Header */}
            <div className="card" style={{padding:0,overflow:'hidden',position:'relative'}}>
              {/* Blurred decorative tech background element */}
              <div style={{
                position: 'absolute', top: '-40px', right: '-40px', width: '130px', height: '130px',
                borderRadius: '50%', background: 'radial-gradient(circle, var(--lagoon-light) 0%, transparent 70%)',
                opacity: 0.15, filter: 'blur(12px)', pointerEvents: 'none'
              }} />

              {/* Main plan row */}
              <div style={{padding:'24px 28px',background:'linear-gradient(135deg, var(--floral-dark) 0%, var(--lagoon-pale) 100%)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:6}}>Current Plan</div>
                  <div style={{fontSize:28,fontWeight:900,color:'var(--text)',lineHeight:1.1,marginBottom:4}}>{currentPlan?.label||sub?.plan||'Trial'}</div>
                  {planLimits?.description&&<div style={{fontSize:12,color:'var(--text3)'}}>{planLimits.description}</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:32,fontWeight:900,color:'var(--text)',lineHeight:1.1}}>{sub?.plan==='trial'?'Free':`GHS ${currentPlan?.price?.toLocaleString()}`}</div>
                  {sub?.plan!=='trial'&&<div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>per month &middot; &asymp;${currentPlan?.usd} USD</div>}
                </div>
              </div>

              {/* Stat Boxes */}
              <div style={{padding:'20px 28px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12}}>
                <StatTile label="Status" value={<span style={{fontWeight:700,padding:'2px 10px',borderRadius:99,fontSize:11,background:statusStyle.bg,color:statusStyle.color,display:'inline-block'}}>{sub?.status?.toUpperCase()||'—'}</span>}/>
                <StatTile label={sub?.plan==='trial'?'Trial Ends':'Renews'} value={fmtDate(sub?.plan==='trial'?sub?.trial_ends_at:sub?.current_period_end)}/>
                <StatTile label="Days Left" value={<span style={{fontWeight:700,color:days<=7?'var(--danger)':'var(--text)'}}>{days} days</span>}/>
                <StatTile label="Athlete Limit" value={sub?.athlete_limit>=999?'Unlimited':sub?.athlete_limit||'—'}/>
                <StatTile label="Staff Limit"   value={sub?.staff_limit  >=99 ?'Unlimited':sub?.staff_limit  ||'—'}/>
              </div>

              {/* Progress bar showing billing cycle status */}
              <div style={{padding:'0 28px 20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)',marginBottom:6,fontWeight:600}}>
                  <span>Billing cycle period remaining</span>
                  <span>{days} days remaining</span>
                </div>
                <div style={{height:7,background:'var(--border-light)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{
                    height:'100%',
                    width:`${billingProgress}%`,
                    background: 'linear-gradient(90deg, var(--lagoon-light), var(--lagoon))',
                    borderRadius:99,
                    transition:'width 0.8s ease-in-out',
                  }}/>
                </div>
              </div>

              {/* Usage Metrics Section */}
              <div style={{borderTop:'1px solid var(--border)',padding:'20px 28px',background:'var(--surface2,rgba(0,0,0,0.01))'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:14}}>Club Usage Statistics</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,flexWrap:'wrap'}}>
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6,fontWeight:500}}>
                      <span style={{color:'var(--text2)'}}>Athletes Registered</span>
                      <span style={{color:'var(--text)',fontWeight:700}}>{athleteCount} / {sub?.athlete_limit >= 999 ? 'Unlimited' : sub?.athlete_limit || '40'}</span>
                    </div>
                    <div style={{height:6,background:'var(--border-light)',borderRadius:99,overflow:'hidden'}}>
                      <div style={{
                        height:'100%',
                        width:`${sub?.athlete_limit >= 999 ? 100 : Math.min(100, (athleteCount / (sub?.athlete_limit || 40)) * 100)}%`,
                        background: athleteCount >= (sub?.athlete_limit || 40) ? 'var(--danger)' : 'var(--lagoon)',
                        borderRadius:99,
                        transition:'width 0.5s ease',
                      }}/>
                    </div>
                  </div>
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6,fontWeight:500}}>
                      <span style={{color:'var(--text2)'}}>Staff Accounts</span>
                      <span style={{color:'var(--text)',fontWeight:700}}>{staffCount} / {sub?.staff_limit >= 99 ? 'Unlimited' : sub?.staff_limit || '15'}</span>
                    </div>
                    <div style={{height:6,background:'var(--border-light)',borderRadius:99,overflow:'hidden'}}>
                      <div style={{
                        height:'100%',
                        width:`${sub?.staff_limit >= 99 ? 100 : Math.min(100, (staffCount / (sub?.staff_limit || 15)) * 100)}%`,
                        background: staffCount >= (sub?.staff_limit || 15) ? 'var(--danger)' : 'var(--lagoon)',
                        borderRadius:99,
                        transition:'width 0.5s ease',
                      }}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div style={{borderTop:'1px solid var(--border)',padding:'20px 28px',display:'grid',gridTemplateColumns:currentPlan?.locked?.length>0?'1fr 1fr':'1fr',gap:24}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:12}}>Active Features</div>
                  {currentPlan?.features?.map(f=><FeatureRow key={f} text={f} locked={false}/>)}
                </div>
                {currentPlan?.locked?.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:12}}>Upgrade to unlock</div>
                    {currentPlan.locked.map(f=><FeatureRow key={f} text={f} locked={true}/>)}
                    <button onClick={()=>setTab('upgrade')} className="gm-btn outline btn-hover-effect" style={{marginTop:16,padding:'8px 18px',fontSize:12}}>Upgrade plan</button>
                  </div>
                )}
              </div>

              {/* Actions footer */}
              {isAdmin&&(
                <div style={{borderTop:'1px solid var(--border)',padding:'16px 28px',background:'var(--surface2,rgba(0,0,0,0.015))',display:'flex',gap:12,flexWrap:'wrap'}}>
                  <button onClick={()=>setTab('upgrade')} className="gm-btn btn-hover-effect" style={{padding:'9px 24px',fontSize:13}}>Change Subscription Plan</button>
                  {sub?.status==='active'&&sub?.plan!=='trial'&&(
                    <button onClick={handleCancel} className="gm-btn danger btn-hover-effect" style={{padding:'9px 24px',fontSize:13}}>Cancel Subscription</button>
                  )}
                </div>
              )}
            </div>

            {/* Trial warning card */}
            {sub?.plan==='trial'&&days<=7&&(
              <AlertBanner variant="warning" action={isAdmin&&(
                <button onClick={()=>setTab('upgrade')} className="gm-btn btn-hover-effect" style={{padding:'8px 18px',fontSize:12,flexShrink:0,background:'#B45309',borderColor:'rgba(255,255,255,0.3)'}}>
                  Subscribe now
                </button>
              )}>
                <div style={{fontSize:14,fontWeight:700,color:'#92400E',marginBottom:2}}>Trial expires in {days} day{days!==1?'s':''}</div>
                <div style={{fontSize:13,color:'#78350F'}}>Subscribe now to keep all your club data.</div>
              </AlertBanner>
            )}
          </div>
        )}

        {/* ── CHANGE PLAN ── */}
        {tab==='upgrade' && (
          <div className="animate-fade-in" style={{display:'flex',flexDirection:'column',gap:24}}>

            {/* Toggle Monthly / Annual billing */}
            <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
              <div style={{display:'inline-flex',padding:4,background:'var(--surface2)',borderRadius:'99px',border:'1px solid var(--border)'}}>
                <button onClick={()=>setBillingCycle('monthly')} style={{
                  padding:'7px 18px',borderRadius:'99px',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',
                  background:billingCycle==='monthly'?'var(--lagoon)':'transparent',
                  color:billingCycle==='monthly'?'#fff':'var(--text3)',
                  transition:'all 0.2s',
                }}>Monthly</button>
                <button onClick={()=>setBillingCycle('annual')} style={{
                  padding:'7px 18px',borderRadius:'99px',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',
                  background:billingCycle==='annual'?'var(--lagoon)':'transparent',
                  color:billingCycle==='annual'?'#fff':'var(--text3)',
                  transition:'all 0.2s',
                  display:'inline-flex',alignItems:'center',gap:6,
                }}>
                  Annual
                  <span style={{
                    fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:99,
                    background:billingCycle==='annual'?'rgba(255,255,255,0.25)':'var(--success-light)',
                    color:billingCycle==='annual'?'#fff':'var(--success)',
                  }}>Save 20%</span>
                </button>
              </div>
            </div>

            {/* Pricing Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:18}}>
              {Object.entries(PLANS).map(([key,p])=>{
                const sel=selPlan===key
                // Dynamic cycle pricing calculation
                const cyclePrice = billingCycle === 'monthly' ? p.price : Math.round(p.price * 12 * 0.8)
                const cycleUsd   = billingCycle === 'monthly' ? p.usd   : Math.round(p.usd * 12 * 0.8)
                
                return(
                  <div key={key} className="pricing-card" onClick={()=>setSelPlan(key)} style={{
                    border:sel?'2.5px solid var(--lagoon)':'1px solid var(--border)',
                    borderRadius:'var(--r-lg)',padding:'28px',cursor:'pointer',
                    background:sel?'rgba(13,148,136,0.035)':'rgba(255,255,255,0.92)',
                    position:'relative',
                    boxShadow:sel?'0 0 0 5px rgba(13,148,136,0.08)':'var(--shadow-sm)',
                  }}>
                    {p.popular&&<div style={{position:'absolute',top:-13,left:'50%',transform:'translateX(-50%)',background:'var(--lagoon)',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 14px',borderRadius:99,whiteSpace:'nowrap',letterSpacing:'0.08em'}}>MOST POPULAR</div>}
                    {sel&&<div style={{position:'absolute',top:16,right:16,width:22,height:22,borderRadius:'50%',background:'var(--lagoon)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>{Icon.check}</div>}
                    <div style={{fontSize:16,fontWeight:800,color:sel?'var(--lagoon)':'var(--text)',marginBottom:8}}>{p.label}</div>
                    
                    <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
                      <span style={{fontSize:11,fontWeight:700,color:'var(--text3)'}}>GHS</span>
                      <span style={{fontSize:34,fontWeight:900,color:'var(--text)',lineHeight:1}}>{cyclePrice}</span>
                    </div>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:20}}>
                      {billingCycle==='monthly'?'per month':'per year'} &middot; &asymp;${cycleUsd} USD
                    </div>
                    <div style={{height:1,background:'var(--border)',marginBottom:20}}/>
                    {p.features.map(f=><FeatureRow key={f} text={f} locked={false}/>)}
                    {p.locked.length>0&&<>
                      <div style={{height:1,background:'var(--border)',margin:'16px 0 12px'}}/>
                      {p.locked.map(f=><FeatureRow key={f} text={f} locked={true}/>)}
                    </>}
                  </div>
                )
              })}
            </div>

            {/* Payment Options Checkout */}
            <div className="card" style={{padding:'28px'}}>
              <div style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:22,display:'flex',alignItems:'center',gap:8}}>
                {Icon.card} Select Checkout Method
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:18,maxWidth:520}}>

                {/* Summary Box / Placeholder */}
                {selPlan ? (
                  <div style={{background:'var(--surface2,rgba(255,255,255,0.6))',borderRadius:'var(--r-md)',padding:'18px',border:'1px solid var(--border)',animation:'fadeInScale 0.2s ease'}}>
                    <div style={{fontSize:10,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>Order Summary</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                      <span style={{fontSize:13,color:'var(--text2)',fontWeight:600}}>{PLANS[selPlan]?.label} ({billingCycle==='monthly'?'Monthly':'Annual'})</span>
                      <span style={{fontSize:16,fontWeight:900,color:'var(--text)'}}>GHS {planPrice.toLocaleString()}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                      <span>Billing period</span><span>{billingCycle==='monthly'?'30 days':'365 days'} starting today</span>
                    </div>
                  </div>
                ) : (
                  <div style={{background:'var(--surface2,rgba(255,255,255,0.4))',borderRadius:'var(--r-md)',padding:'20px',border:'1px dashed var(--border)',textAlign:'center',color:'var(--text3)',fontSize:12}}>
                    Select a plan above to view order summary
                  </div>
                )}

                {/* Mobile Money Notice Block */}
                <div style={{background:'rgba(13,148,136,0.05)',borderRadius:'var(--r-md)',padding:'14px 18px',border:'1px solid rgba(13,148,136,0.15)',fontSize:12,color:'var(--text2)',lineHeight:1.7,display:'flex',gap:12,alignItems:'flex-start'}}>
                  <span style={{color:'var(--lagoon)',flexShrink:0,marginTop:1}}>{Icon.mobile}</span>
                  <span><strong>MTN MoMo, Vodafone / Telecel Cash &amp; Cards accepted</strong>. Enter your mobile money PIN directly on the secure overlay widget to process instantly.</span>
                </div>

                {/* Pay-with selector containing Authentic logos */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text3)',marginBottom:10}}>Payment Provider</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {[
                      { id: 'paystack', logo: Logo.paystack, desc: 'Cards & MoMo wallets' },
                      { id: 'moolre',   logo: Logo.moolre,   desc: 'Local MoMo routes' },
                    ].map(m => {
                      const active = payMethod === m.id
                      return (
                        <button key={m.id} className="payment-method-card" onClick={()=>setPayMethod(m.id)} style={{
                          flex:1,minWidth:220,padding:'16px 20px',borderRadius:'var(--r-md)',textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',
                          border: active ? '2.5px solid var(--lagoon)' : '1px solid var(--border)',
                          background: active ? 'rgba(13,148,136,0.04)' : 'var(--floral-dark)',
                          boxShadow: active ? '0 0 0 4px rgba(13,148,136,0.08)' : 'var(--shadow-sm)',
                          display:'flex',flexDirection:'column',gap:8,
                        }}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
                            {m.logo}
                            <div style={{
                              width:16,height:16,borderRadius:'50%',border:'2px solid var(--lagoon)',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              background: active ? 'var(--lagoon)' : 'transparent',
                            }}>
                              {active && <div style={{width:6,height:6,borderRadius:'50%',background:'#fff'}}/>}
                            </div>
                          </div>
                          <div style={{fontSize:11,color:'var(--text3)'}}>{m.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dynamic Provider Checkout Buttons */}
                {!selPlan ? (
                  <button disabled className="gm-btn" style={{justifyContent:'center',width:'100%',padding:'14px',opacity:0.5,cursor:'not-allowed'}}>
                    Select a plan to proceed
                  </button>
                ) : !payMethod ? (
                  <button disabled className="gm-btn" style={{justifyContent:'center',width:'100%',padding:'14px',opacity:0.5,cursor:'not-allowed'}}>
                    Select a payment method
                  </button>
                ) : payMethod==='paystack' ? (
                  <button onClick={handlePaystack} disabled={paying||!isAdmin} className="gm-btn btn-hover-effect" style={{justifyContent:'center',width:'100%',padding:'14px',opacity:paying||!isAdmin?0.65:1,cursor:paying||!isAdmin?'not-allowed':'pointer'}}>
                    {paying?<>{Icon.spinner(16)} Connecting to Paystack…</>:`Pay GHS ${planPrice.toLocaleString()} with Paystack`}
                  </button>
                ) : (
                  <button onClick={handleMoolre} disabled={paying||!isAdmin} className="gm-btn btn-hover-effect" style={{justifyContent:'center',width:'100%',padding:'14px',opacity:paying||!isAdmin?0.65:1,cursor:paying||!isAdmin?'not-allowed':'pointer'}}>
                    {paying?<>{Icon.spinner(16)} Connecting to Moolre…</>:`Pay GHS ${planPrice.toLocaleString()} with Moolre`}
                  </button>
                )}
                {!isAdmin&&<div style={{fontSize:12,color:'var(--text3)',textAlign:'center'}}>Only club admins can change the subscription plan.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==='history' && (
          <div className="animate-fade-in card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',display:'flex',alignItems:'center',gap:8}}>{Icon.history} Payment History</div>
              <span style={{fontSize:12,color:'var(--text3)',background:'var(--surface2,rgba(0,0,0,0.04))',padding:'4px 12px',borderRadius:99,border:'1px solid var(--border)'}}>
                {history.length} {history.length===1?'event':'events'}
              </span>
            </div>
            {history.length===0?(
              <div style={{padding:'64px 32px',textAlign:'center'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',color:'var(--text3)'}}>{Icon.history}</div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--text2)',marginBottom:6}}>No payment history</div>
                <div style={{fontSize:13,color:'var(--text3)'}}>Transactions will appear here once you subscribe.</div>
              </div>
            ):(
              <div style={{ overflowX: 'auto' }}>
                <div style={{minWidth: 700}}>
                  <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr 1.8fr',gap:8,padding:'12px 24px',background:'var(--surface2,rgba(0,0,0,0.03))',borderBottom:'1px solid var(--border)'}}>
                    {['Date','Type','Plan','Amount','Reference'].map(h=>(
                      <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>
                    ))}
                  </div>
                  {history.map((ev,i)=>(
                    <div key={ev.id} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr 1.8fr',gap:8,padding:'14px 24px',borderBottom:i<history.length-1?'1px solid var(--border)':'none',background:i%2===0?'transparent':'rgba(0,0,0,0.015)',alignItems:'center'}}>
                      <div style={{fontSize:12,color:'var(--text2)'}}>{fmtDate(ev.created_at)}</div>
                      <div><span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:99,background:'rgba(13,148,136,0.08)',color:'var(--lagoon)',textTransform:'capitalize',border:'1px solid rgba(13,148,136,0.15)'}}>{ev.type}</span></div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)',textTransform:'capitalize'}}>{ev.plan}</div>
                      <div style={{fontSize:12,fontWeight:700,color:ev.amount_ghs>0?'var(--success)':'var(--text3)'}}>{ev.amount_ghs>0?`GHS ${ev.amount_ghs.toLocaleString()}`:'—'}</div>
                      <div style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.payment_ref||'—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function BillingPage(){
  return(
    <Suspense fallback={<Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:36,height:36,border:'4px solid var(--border)',borderTopColor:'var(--lagoon)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div></Layout>}>
      <BillingContent/>
    </Suspense>
  )
}
