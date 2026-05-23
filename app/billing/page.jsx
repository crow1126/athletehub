'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/subscription'
import { fetchWithAuth } from '@/lib/tenant'

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxx'

const GM_ICON = (
  <span className="gm-icon" aria-hidden="true">
    <svg viewBox="0 0 16 19" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"/>
    </svg>
  </span>
)

const PLANS = {
  starter: { label:'Starter', price:350, usd:23, color:'#004F4F', bg:'#E0F0F0', popular:false,
    features:['40 athlete profiles','3 staff accounts','Session scheduling','Dashboard'],
    locked:['Medical hub','Performance analytics','Scouting','Contracts','Reports'] },
  academy: { label:'Academy', price:600, usd:40, color:'#006A6A', bg:'#C8E8E8', popular:true,
    features:['100 athlete profiles','10 staff accounts','Full medical hub','xG & xA analytics','Scout access portal','PDF player reports','Session scheduling'],
    locked:['Contracts module'] },
  elite:   { label:'Elite',   price:1000, usd:67, color:'#1B7A3E', bg:'#E8F8EE', popular:false,
    features:['Unlimited athlete profiles','Unlimited staff accounts','All modules unlocked','Contracts management','Multi-team management','Priority onboarding','Custom branding'],
    locked:[] },
}

const MODULE_NAMES = { coaches:'Teams', injuries:'Medical Hub', performance:'Performance Analytics', scouting:'Scouting', contracts:'Contracts', reports:'Reports' }
const STATUS_COLORS = { active:{bg:'#E8F8EE',color:'#1B7A3E'}, trial:{bg:'#E0F0F0',color:'#004F4F'}, expired:{bg:'#FDEDEC',color:'#C0392B'}, cancelled:{bg:'#FDEDEC',color:'#C0392B'} }

function daysLeft(d){ if(!d)return 0; return Math.max(0,Math.ceil((new Date(d)-new Date())/86400000)) }
function fmtDate(d){ if(!d)return'—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) }

function loadPaystack(){
  return new Promise(resolve=>{
    if(window.PaystackPop){resolve();return}
    const s=document.createElement('script')
    s.src='https://js.paystack.co/v1/inline.js'
    s.onload=resolve
    document.head.appendChild(s)
  })
}

function BillingContent(){
  const searchParams  = useSearchParams()
  const upgradeReason = searchParams.get('reason')
  const blockedModule = searchParams.get('module')

  const [profile, setProfile] = useState(null)
  const [sub,     setSub]     = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('overview')
  const [isAdmin, setIsAdmin] = useState(false)
  const [selPlan, setSelPlan] = useState('academy')
  const [paying,  setPaying]  = useState(false)
  const [msg,     setMsg]     = useState({text:'',type:''})

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
        setSub(data.subscription)
        setHistory(data.history||[])
      }
    }catch(e){console.error(e)}
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{ if(upgradeReason==='upgrade_required'||upgradeReason==='expired') setTab('upgrade') },[upgradeReason])

  async function handlePaystack(){
    if(!selPlan){ flash('Select a plan first.','error'); return }
    if(!profile?.email){ flash('Profile email not found.','error'); return }
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
        onClose: function(){ setPaying(false); flash('Payment window closed.','error') },
        callback: function(response){
          fetchWithAuth('/api/billing',{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ team_id:profile.team_id, plan:selPlan, payment_method:'paystack', payment_ref:response.reference, notes:'Paystack — '+response.reference, requested_by:profile.id }),
          })
          .then(res=>res.json())
          .then(data=>{
            if(data.error){ flash('Activation failed. Contact support with ref: '+response.reference,'error'); setPaying(false); return }
            flash('✅ Payment successful! '+plan.label+' plan is now active.','success')
            load().then(()=>setTab('overview'))
            setPaying(false)
          })
          .catch(()=>{ flash('Payment received but activation failed. Ref: '+response.reference,'error'); setPaying(false) })
        },
      })
      handler.openIframe()
    }catch(e){ flash('Error: '+e.message,'error'); setPaying(false) }
  }

  async function handleCancel(){
    if(!confirm('Cancel your subscription?'))return
    const res=await fetchWithAuth('/api/billing',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:profile.team_id,action:'cancel',requested_by:profile.id})})
    const data=await res.json()
    if(!res.ok){ flash(data.error||'Failed.','error'); return }
    flash('Subscription cancelled.','success'); await load()
  }

  const currentPlan = sub?PLANS[sub.plan]:null
  const planLimits  = sub?PLAN_LIMITS[sub.plan]:null
  const statusStyle = sub?(STATUS_COLORS[sub.status]||STATUS_COLORS.active):STATUS_COLORS.active
  const days        = sub?daysLeft(sub.plan==='trial'?sub.trial_ends_at:sub.current_period_end):0

  if(loading)return(<Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:36,height:36,border:'4px solid #CCFBF1',borderTopColor:'#0D9488',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div></Layout>)

  return(
    <Layout>
      <div style={{maxWidth:960,margin:'0 auto',padding:'32px 40px'}}>
        <PageHeader label="Subscription" title="Billing & Plan" subtitle="Manage your Apex Track subscription"/>

        {upgradeReason==='upgrade_required'&&blockedModule&&(
          <div style={{background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:'var(--r-lg)',padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:22}}>🔒</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:'#B7770D'}}>{MODULE_NAMES[blockedModule]||blockedModule} requires a higher plan</div>
              <div style={{fontSize:13,color:'#7A5A0A'}}>Upgrade your subscription to unlock this module.</div>
            </div>
            <button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'8px 16px',fontSize:12,flexShrink:0}}>Upgrade {GM_ICON}</button>
          </div>
        )}

        {upgradeReason==='expired'&&(
          <div style={{background:'var(--danger-light)',border:'1px solid rgba(192,57,43,0.2)',borderRadius:'var(--r-lg)',padding:'14px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:22}}>⚠️</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--danger)'}}>Your subscription has expired</div>
              <div style={{fontSize:13,color:'#8B2020'}}>Subscribe now to restore access to your club data.</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:8,marginBottom:28,borderBottom:'1px solid var(--border)'}}>
          {[{id:'overview',label:'📋 Overview'},{id:'upgrade',label:'⬆️ Change Plan'},{id:'history',label:'🧾 Payment History'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 18px',background:'none',border:'none',borderBottom:tab===t.id?'2px solid #0D9488':'2px solid transparent',fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?'#0D9488':'var(--text2)',cursor:'pointer',fontFamily:'var(--font)',marginBottom:-1}}>
              {t.label}
            </button>
          ))}
        </div>

        {msg.text&&<div style={{padding:'13px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,whiteSpace:'pre-line',lineHeight:1.7,marginBottom:20,background:msg.type==='error'?'var(--danger-light)':'var(--success-light)',color:msg.type==='error'?'var(--danger)':'var(--success)',border:`1px solid ${msg.type==='error'?'rgba(192,57,43,0.2)':'rgba(27,122,62,0.2)'}`}}>{msg.text}</div>}

        {tab==='overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{background:currentPlan?.color||'#0D9488',padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,252,246,0.6)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Current Plan</div>
                  <div style={{fontSize:28,fontWeight:800,color:'#FFFCF6'}}>{currentPlan?.label||sub?.plan||'Trial'}</div>
                  <div style={{fontSize:12,color:'rgba(255,252,246,0.6)',marginTop:4}}>{planLimits?.description}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:34,fontWeight:900,color:'#FFFCF6'}}>{sub?.plan==='trial'?'FREE':`GHS ${currentPlan?.price?.toLocaleString()}`}</div>
                  {sub?.plan!=='trial'&&<div style={{fontSize:11,color:'rgba(255,252,246,0.6)'}}>per month · ≈ ${currentPlan?.usd} USD</div>}
                </div>
              </div>
              <div style={{padding:'18px 24px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12}}>
                {[
                  {label:'Status',value:<span style={{fontWeight:700,padding:'3px 10px',borderRadius:99,fontSize:12,background:statusStyle.bg,color:statusStyle.color}}>{sub?.status?.toUpperCase()||'—'}</span>},
                  {label:sub?.plan==='trial'?'Trial Ends':'Renews',value:fmtDate(sub?.plan==='trial'?sub?.trial_ends_at:sub?.current_period_end)},
                  {label:'Days Left',value:<span style={{fontWeight:700,color:days<=7?'var(--danger)':'var(--text)'}}>{days} days</span>},
                  {label:'Athlete Limit',value:sub?.athlete_limit>=999?'Unlimited':sub?.athlete_limit||'—'},
                  {label:'Staff Limit',value:sub?.staff_limit>=99?'Unlimited':sub?.staff_limit||'—'},
                ].map(({label,value})=>(
                  <div key={label} style={{background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:5}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:'1px solid var(--border)',padding:'16px 24px',display:'grid',gridTemplateColumns:currentPlan?.locked?.length>0?'1fr 1fr':'1fr',gap:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>✅ Included</div>
                  {currentPlan?.features?.map(f=>(
                    <div key={f} style={{fontSize:12,color:'var(--success)',marginBottom:5,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:'var(--success)',flexShrink:0}}/>{f}
                    </div>
                  ))}
                </div>
                {currentPlan?.locked?.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>🔒 Upgrade to unlock</div>
                    {currentPlan.locked.map(f=>(
                      <div key={f} style={{fontSize:12,color:'var(--text3)',marginBottom:5,display:'flex',alignItems:'center',gap:6}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:'var(--text3)',flexShrink:0}}/>{f}
                      </div>
                    ))}
                    <button onClick={()=>setTab('upgrade')} className="gm-btn outline" style={{marginTop:12,padding:'7px 14px',fontSize:12}}>
                      Upgrade now {GM_ICON}
                    </button>
                  </div>
                )}
              </div>
              {isAdmin&&(
                <div style={{borderTop:'1px solid var(--border)',padding:'12px 24px',display:'flex',gap:10,flexWrap:'wrap'}}>
                  <button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'9px 20px',fontSize:13}}>
                    Change Plan {GM_ICON}
                  </button>
                  {sub?.status==='active'&&sub?.plan!=='trial'&&(
                    <button onClick={handleCancel} className="gm-btn danger" style={{padding:'9px 20px',fontSize:13}}>
                      Cancel {GM_ICON}
                    </button>
                  )}
                </div>
              )}
            </div>

            {sub?.plan==='trial'&&days<=7&&(
              <div style={{background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:'var(--r-lg)',padding:'16px 20px',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:22}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#B7770D'}}>Trial expires in {days} day{days!==1?'s':''}</div>
                  <div style={{fontSize:13,color:'#7A5A0A'}}>Subscribe now to keep all your data.</div>
                </div>
                {isAdmin&&<button onClick={()=>setTab('upgrade')} className="gm-btn" style={{padding:'8px 16px',fontSize:12,flexShrink:0,background:'#B7770D',borderColor:'rgba(255,255,255,0.4)'}}>
                  Subscribe {GM_ICON}
                </button>}
              </div>
            )}
          </div>
        )}

        {tab==='upgrade'&&(
          <div style={{display:'flex',flexDirection:'column',gap:22}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
              {Object.entries(PLANS).map(([key,p])=>(
                <div key={key} onClick={()=>setSelPlan(key)}
                  style={{border:selPlan===key?`2px solid ${p.color}`:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'22px',cursor:'pointer',background:selPlan===key?p.bg:'#fff',transition:'all 0.15s',position:'relative'}}>
                  {p.popular&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:p.color,color:'#fff',fontSize:10,fontWeight:700,padding:'3px 14px',borderRadius:99,whiteSpace:'nowrap'}}>MOST POPULAR</div>}
                  {selPlan===key&&<div style={{position:'absolute',top:12,right:12,width:22,height:22,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontWeight:700}}>✓</div>}
                  <div style={{fontSize:17,fontWeight:800,color:p.color,marginBottom:6}}>{p.label}</div>
                  <div style={{fontSize:26,fontWeight:900,color:'var(--text)',marginBottom:2}}>GHS {p.price.toLocaleString()}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:16}}>per month · ≈ ${p.usd} USD</div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text3)',marginBottom:8}}>Included</div>
                  {p.features.map(f=><div key={f} style={{fontSize:11,color:'var(--text2)',marginBottom:5,display:'flex',gap:6}}><span style={{color:p.color,flexShrink:0}}>✓</span>{f}</div>)}
                  {p.locked.length>0&&<>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text3)',marginTop:12,marginBottom:8}}>Not included</div>
                    {p.locked.map(f=><div key={f} style={{fontSize:11,color:'var(--text3)',marginBottom:5,display:'flex',gap:6}}><span style={{flexShrink:0}}>–</span>{f}</div>)}
                  </>}
                </div>
              ))}
            </div>
            <div className="card" style={{padding:'24px'}}>
              <div style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:18}}>💳 Payment</div>
              <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:480}}>
                <div style={{background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'16px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Order Summary</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:14,marginBottom:6}}>
                    <span style={{color:'var(--text2)'}}>{PLANS[selPlan]?.label} Plan</span>
                    <span style={{fontWeight:800,color:'var(--text)'}}>GHS {PLANS[selPlan]?.price?.toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                    <span>Billing period</span><span>30 days from today</span>
                  </div>
                </div>
                <div style={{background:'#F0FDFA',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid #CCFBF1',fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
                  📱 <strong>MTN MoMo & Vodafone Cash accepted</strong> — enter your MoMo PIN in the payment popup.<br/>
                  💳 Card payments also supported.
                </div>
                <button onClick={handlePaystack} disabled={paying||!isAdmin} className="gm-btn"
                  style={{justifyContent:'center',opacity:paying||!isAdmin?0.7:1,cursor:paying||!isAdmin?'not-allowed':'pointer',background:paying?'var(--text3)':undefined}}>
                  {paying?'⏳ Opening payment…':`Pay GHS ${PLANS[selPlan]?.price?.toLocaleString()} — Activate ${PLANS[selPlan]?.label}`}
                  {!paying&&GM_ICON}
                </button>
                {!isAdmin&&<div style={{fontSize:12,color:'var(--text3)',textAlign:'center'}}>Only admins can change the subscription plan.</div>}
              </div>
            </div>
          </div>
        )}

        {tab==='history'&&(
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:700}}>Payment History</div>
              <span style={{fontSize:12,color:'var(--text3)'}}>{history.length} events</span>
            </div>
            {history.length===0?(
              <div style={{padding:'32px',textAlign:'center',color:'var(--text3)',fontSize:13}}>No payment history yet.</div>
            ):(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr',gap:8,padding:'10px 20px',background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}>
                  {['Date','Type','Plan','Amount','Reference'].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>)}
                </div>
                {history.map((ev,i)=>(
                  <div key={ev.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr',gap:8,padding:'12px 20px',borderBottom:'1px solid var(--border)',background:i%2===0?'#fff':'var(--surface2)'}}>
                    <div style={{fontSize:12,color:'var(--text2)'}}>{fmtDate(ev.created_at)}</div>
                    <div><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,background:'#F0FDFA',color:'#0F766E',textTransform:'capitalize'}}>{ev.type}</span></div>
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

export default function BillingPage() {
  return (
    <Suspense fallback={<Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:36,height:36,border:'4px solid #CCFBF1',borderTopColor:'#0D9488',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div></Layout>}>
      <BillingContent />
    </Suspense>
  )
}
