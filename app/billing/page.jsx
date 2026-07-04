'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/subscription'
import { fetchWithAuth } from '@/lib/tenant'

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxx'

const Icon = {
  check: (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5 9.5L11 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  lock:  (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  alert: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>),
  card:  (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 6.5H14.5" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="9" width="3" height="1.5" rx="0.5" fill="currentColor"/></svg>),
  mobile:(<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="12.5" r="0.75" fill="currentColor"/></svg>),
  arrow: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M3 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  history:(<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  spinner:(size=20)=>(<div style={{width:size,height:size,border:`${size>16?3:2}px solid var(--border)`,borderTopColor:'var(--lagoon)',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>),
}

const PLANS = {
  starting_xi:{ label:'Starting XI', price:5,  usd:13, popular:false,
    features:['Up to 40 athletes','Squad Roster','Training Scheduler','Injury Hub','Basic Reports (PDF export)','Admin + Coach + Physio roles','Email support'],
    locked:  ['Performance Analytics','Scouting Module + Transfers','Advanced Reports','Analyst role','Custom club branding'] },
  captain:    { label:'Captain',      price:10, usd:33, popular:true,
    features:['Unlimited athletes','Everything in Starting XI','Performance Analytics (xG, xA, match ratings)','Scouting Module + Transfers','Advanced Reports (board/medical)','All 4 roles including Analyst','Custom club branding','Priority support + onboarding'],
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
    <div style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:'var(--r-lg)',padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:14}}>
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
  const [selPlan,   setSelPlan]   = useState('captain')
  const [paying,    setPaying]    = useState(false)
  const [payMethod, setPayMethod] = useState('paystack')
  const [msg,       setMsg]       = useState({text:'',type:''})

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
        const res=await fetchWithAuth(`/api/billing?team_id=${p.team_id}`)
        const data=await res.json()
        setSub(data.subscription); setHistory(data.history||[])
      }
    }catch(e){console.error(e)}
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{ if(upgradeReason==='upgrade_required'||upgradeReason==='expired') setTab('upgrade') },[upgradeReason])

  async function handlePaystack(){
    if(!selPlan){flash('Select a plan first.','error');return}
    if(!profile?.email){flash('Profile email not found.','error');return}
    setPaying(true)
    try{
      await loadPaystack()
      const plan=PLANS[selPlan]
      const ref=`APEX-${profile.team_id?.slice(0,8)}-${Date.now()}`
      const handler=window.PaystackPop.setup({
        key:PAYSTACK_PUBLIC_KEY, email:profile.email,
        amount:plan.price*100, currency:'GHS', ref,
        label:`Apex Track — ${plan.label} Plan`,
        metadata:{custom_fields:[
          {display_name:'Club',variable_name:'club',value:profile.teams?.name||'Unknown'},
          {display_name:'Plan',variable_name:'plan',value:selPlan},
          {display_name:'Team ID',variable_name:'team_id',value:profile.team_id},
        ]},
        channels:['card','mobile_money','bank'],
        onClose:()=>{setPaying(false);flash('Payment window closed.','error')},
        callback:(response)=>{
          fetchWithAuth('/api/billing',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({team_id:profile.team_id,plan:selPlan,payment_method:'paystack',payment_ref:response.reference,notes:'Paystack — '+response.reference,requested_by:profile.id}),
          })
          .then(r=>r.json())
          .then(data=>{
            if(data.error){flash('Activation failed: '+(data.error||'Unknown')+'. Ref: '+response.reference,'error');setPaying(false);return}
            flash('Payment successful — '+plan.label+' plan is now active.','success')
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
      const plan=PLANS[selPlan]
      const ref=`APEX-M-${profile.team_id?.slice(0,8)}-${Date.now()}`
      const res=await fetchWithAuth('/api/billing/moolre-checkout',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({team_id:profile.team_id,plan:selPlan,email:profile.email,ref,amount_ghs:plan.price}),
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

  return(
    <Layout>
      <div className="page-outer" style={{maxWidth:960}}>
        <PageHeader label="Subscription" title="Billing & Plan" subtitle="Manage your Apex Track subscription"/>

        {upgradeReason==='upgrade_required'&&blockedModule&&(
          <AlertBanner variant="warning" action={
            <button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'8px 18px',fontSize:12,flexShrink:0}}>Upgrade</button>
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

        {/* Tabs */}
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',marginBottom:28}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              display:'inline-flex',alignItems:'center',gap:7,
              padding:'10px 18px',background:'none',border:'none',
              borderBottom:tab===t.id?'2px solid var(--lagoon)':'2px solid transparent',
              fontSize:13,fontWeight:tab===t.id?700:500,
              color:tab===t.id?'var(--lagoon)':'var(--text3)',
              cursor:'pointer',fontFamily:'var(--font)',marginBottom:-1,transition:'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Flash */}
        {msg.text&&(
          <div style={{
            padding:'13px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,lineHeight:1.6,marginBottom:20,
            background:msg.type==='error'?'var(--danger-light)':'var(--success-light)',
            color:msg.type==='error'?'var(--danger)':'var(--success)',
            border:`1px solid ${msg.type==='error'?'rgba(225,29,72,0.2)':'rgba(5,150,105,0.2)'}`,
          }}>{msg.text}</div>
        )}

        {/* ── OVERVIEW ── */}
        {tab==='overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:18}}>
            <div className="card" style={{padding:0,overflow:'hidden'}}>

              {/* Header */}
              <div style={{padding:'22px 26px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>Current Plan</div>
                  <div style={{fontSize:26,fontWeight:800,color:'var(--text)',lineHeight:1.1,marginBottom:4}}>{currentPlan?.label||sub?.plan||'Trial'}</div>
                  {planLimits?.description&&<div style={{fontSize:12,color:'var(--text3)'}}>{planLimits.description}</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:30,fontWeight:900,color:'var(--text)',lineHeight:1.1}}>{sub?.plan==='trial'?'Free':`GHS ${currentPlan?.price?.toLocaleString()}`}</div>
                  {sub?.plan!=='trial'&&<div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>per month &middot; &asymp;${currentPlan?.usd} USD</div>}
                </div>
              </div>

              {/* Stats */}
              <div style={{padding:'18px 26px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
                <StatTile label="Status" value={<span style={{fontWeight:700,padding:'2px 10px',borderRadius:99,fontSize:11,background:statusStyle.bg,color:statusStyle.color,display:'inline-block'}}>{sub?.status?.toUpperCase()||'—'}</span>}/>
                <StatTile label={sub?.plan==='trial'?'Trial Ends':'Renews'} value={fmtDate(sub?.plan==='trial'?sub?.trial_ends_at:sub?.current_period_end)}/>
                <StatTile label="Days Left" value={<span style={{fontWeight:700,color:days<=7?'var(--danger)':'var(--text)'}}>{days} days</span>}/>
                <StatTile label="Athlete Limit" value={sub?.athlete_limit>=999?'Unlimited':sub?.athlete_limit||'—'}/>
                <StatTile label="Staff Limit"   value={sub?.staff_limit  >=99 ?'Unlimited':sub?.staff_limit  ||'—'}/>
              </div>

              {/* Features */}
              <div style={{borderTop:'1px solid var(--border)',padding:'18px 26px',display:'grid',gridTemplateColumns:currentPlan?.locked?.length>0?'1fr 1fr':'1fr',gap:20}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>Included in your plan</div>
                  {currentPlan?.features?.map(f=><FeatureRow key={f} text={f} locked={false}/>)}
                </div>
                {currentPlan?.locked?.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>Unlock with Captain</div>
                    {currentPlan.locked.map(f=><FeatureRow key={f} text={f} locked={true}/>)}
                    <button onClick={()=>setTab('upgrade')} className="gm-btn outline" style={{marginTop:14,padding:'7px 16px',fontSize:12}}>Upgrade plan</button>
                  </div>
                )}
              </div>

              {/* Admin actions */}
              {isAdmin&&(
                <div style={{borderTop:'1px solid var(--border)',padding:'14px 26px',display:'flex',gap:10,flexWrap:'wrap'}}>
                  <button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'9px 22px',fontSize:13}}>Change Plan</button>
                  {sub?.status==='active'&&sub?.plan!=='trial'&&(
                    <button onClick={handleCancel} className="gm-btn danger" style={{padding:'9px 22px',fontSize:13}}>Cancel Subscription</button>
                  )}
                </div>
              )}
            </div>

            {/* Trial warning */}
            {sub?.plan==='trial'&&days<=7&&(
              <AlertBanner variant="warning" action={isAdmin&&(
                <button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'8px 18px',fontSize:12,flexShrink:0,background:'#B45309',borderColor:'rgba(255,255,255,0.3)'}}>
                  Subscribe now
                </button>
              )}>
                <div style={{fontSize:14,fontWeight:700,color:'#92400E',marginBottom:2}}>Trial expires in {days} day{days!==1?'s':''}</div>
                <div style={{fontSize:13,color:'#78350F'}}>Subscribe now to keep all your club data.</div>
              </AlertBanner>
            )}
          </div>
        )}

        {/* ── UPGRADE ── */}
        {tab==='upgrade'&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
              {Object.entries(PLANS).map(([key,p])=>{
                const sel=selPlan===key
                return(
                  <div key={key} onClick={()=>setSelPlan(key)} style={{
                    border:sel?'2px solid var(--lagoon)':'1px solid var(--border)',
                    borderRadius:'var(--r-lg)',padding:'24px',cursor:'pointer',
                    background:sel?'rgba(13,148,136,0.04)':'rgba(255,255,255,0.92)',
                    transition:'all 0.15s',position:'relative',
                    boxShadow:sel?'0 0 0 4px rgba(13,148,136,0.08)':'var(--shadow-sm)',
                  }}>
                    {p.popular&&<div style={{position:'absolute',top:-13,left:'50%',transform:'translateX(-50%)',background:'var(--lagoon)',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 14px',borderRadius:99,whiteSpace:'nowrap',letterSpacing:'0.06em'}}>MOST POPULAR</div>}
                    {sel&&<div style={{position:'absolute',top:14,right:14,width:22,height:22,borderRadius:'50%',background:'var(--lagoon)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>{Icon.check}</div>}
                    <div style={{fontSize:15,fontWeight:800,color:sel?'var(--lagoon)':'var(--text)',marginBottom:8}}>{p.label}</div>
                    <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
                      <span style={{fontSize:11,fontWeight:600,color:'var(--text3)'}}>GHS</span>
                      <span style={{fontSize:30,fontWeight:900,color:'var(--text)',lineHeight:1}}>{p.price}</span>
                    </div>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:20}}>per month &middot; &asymp;${p.usd} USD</div>
                    <div style={{height:1,background:'var(--border)',marginBottom:16}}/>
                    {p.features.map(f=><FeatureRow key={f} text={f} locked={false}/>)}
                    {p.locked.length>0&&<>
                      <div style={{height:1,background:'var(--border)',margin:'14px 0 12px'}}/>
                      {p.locked.map(f=><FeatureRow key={f} text={f} locked={true}/>)}
                    </>}
                  </div>
                )
              })}
            </div>

            <div className="card" style={{padding:'26px'}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
                {Icon.card} Payment
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:500}}>

                {/* Order summary */}
                <div style={{background:'var(--surface2,rgba(255,255,255,0.6))',borderRadius:'var(--r-md)',padding:'16px 18px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:10,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>Order Summary</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                    <span style={{fontSize:13,color:'var(--text2)'}}>{PLANS[selPlan]?.label} Plan</span>
                    <span style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>GHS {PLANS[selPlan]?.price?.toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                    <span>Billing period</span><span>30 days from today</span>
                  </div>
                </div>

                {/* Info note */}
                <div style={{background:'rgba(13,148,136,0.05)',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid rgba(13,148,136,0.15)',fontSize:12,color:'var(--text2)',lineHeight:1.7,display:'flex',gap:10,alignItems:'flex-start'}}>
                  {Icon.mobile}
                  <span><strong>MTN MoMo &amp; Vodafone Cash accepted</strong> — enter your MoMo PIN in the payment popup. Card payments are also supported.</span>
                </div>

                {/* Pay-with selector */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text3)',marginBottom:8}}>Pay with</div>
                  <div style={{display:'flex',gap:8}}>
                    {[{id:'paystack',label:'Paystack',sub:'Card / Mobile Money'},{id:'moolre',label:'Moolre',sub:'Local Mobile Money'}].map(m=>(
                      <button key={m.id} onClick={()=>setPayMethod(m.id)} style={{
                        flex:1,padding:'12px 14px',borderRadius:'var(--r-md)',textAlign:'left',cursor:'pointer',transition:'all 0.15s',fontFamily:'var(--font)',
                        border:payMethod===m.id?'2px solid var(--lagoon)':'1px solid var(--border)',
                        background:payMethod===m.id?'rgba(13,148,136,0.05)':'rgba(255,255,255,0.8)',
                        boxShadow:payMethod===m.id?'0 0 0 3px rgba(13,148,136,0.08)':'none',
                      }}>
                        <div style={{fontSize:13,fontWeight:700,color:payMethod===m.id?'var(--lagoon)':'var(--text)',marginBottom:2}}>{m.label}</div>
                        <div style={{fontSize:11,color:'var(--text3)'}}>{m.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pay button */}
                {payMethod==='paystack'
                  ?<button onClick={handlePaystack} disabled={paying||!isAdmin} className="gm-btn" style={{justifyContent:'center',opacity:paying||!isAdmin?0.65:1,cursor:paying||!isAdmin?'not-allowed':'pointer'}}>
                    {paying?<>{Icon.spinner(16)}Processing payment…</>:`Pay GHS ${PLANS[selPlan]?.price?.toLocaleString()} via Paystack`}
                  </button>
                  :<button onClick={handleMoolre} disabled={paying||!isAdmin} className="gm-btn" style={{justifyContent:'center',opacity:paying||!isAdmin?0.65:1,cursor:paying||!isAdmin?'not-allowed':'pointer'}}>
                    {paying?<>{Icon.spinner(16)}Connecting to Moolre…</>:`Pay GHS ${PLANS[selPlan]?.price?.toLocaleString()} via Moolre`}
                  </button>
                }
                {!isAdmin&&<div style={{fontSize:12,color:'var(--text3)',textAlign:'center'}}>Only club admins can change the subscription plan.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==='history'&&(
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',display:'flex',alignItems:'center',gap:8}}>{Icon.history} Payment History</div>
              <span style={{fontSize:12,color:'var(--text3)',background:'var(--surface2,rgba(0,0,0,0.04))',padding:'3px 10px',borderRadius:99,border:'1px solid var(--border)'}}>
                {history.length} {history.length===1?'event':'events'}
              </span>
            </div>
            {history.length===0?(
              <div style={{padding:'48px 32px',textAlign:'center'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',color:'var(--text3)'}}>{Icon.history}</div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--text2)',marginBottom:6}}>No payment history</div>
                <div style={{fontSize:13,color:'var(--text3)'}}>Transactions will appear here once you subscribe.</div>
              </div>
            ):(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr 1.8fr',gap:8,padding:'10px 22px',background:'var(--surface2,rgba(0,0,0,0.03))',borderBottom:'1px solid var(--border)'}}>
                  {['Date','Type','Plan','Amount','Reference'].map(h=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>
                  ))}
                </div>
                {history.map((ev,i)=>(
                  <div key={ev.id} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr 1.8fr',gap:8,padding:'13px 22px',borderBottom:i<history.length-1?'1px solid var(--border)':'none',background:i%2===0?'transparent':'rgba(0,0,0,0.015)',alignItems:'center'}}>
                    <div style={{fontSize:12,color:'var(--text2)'}}>{fmtDate(ev.created_at)}</div>
                    <div><span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:99,background:'rgba(13,148,136,0.08)',color:'var(--lagoon)',textTransform:'capitalize',border:'1px solid rgba(13,148,136,0.15)'}}>{ev.type}</span></div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',textTransform:'capitalize'}}>{ev.plan}</div>
                    <div style={{fontSize:12,fontWeight:700,color:ev.amount_ghs>0?'var(--success)':'var(--text3)'}}>{ev.amount_ghs>0?`GHS ${ev.amount_ghs.toLocaleString()}`:'—'}</div>
                    <div style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.payment_ref||'—'}</div>
                  </div>
                ))}
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
