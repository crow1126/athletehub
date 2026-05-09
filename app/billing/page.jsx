'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const PLANS = {
  trial:   { label:'Free Trial',  price:0,    usd:0,  color:'#7A4E6A', bg:'#F5E6D3', features:['Up to 999 athletes','All modules unlocked','Full access for 30 days'], limits:[] },
  starter: { label:'Starter',     price:350,  usd:23, color:'#381932', bg:'#EDD9C8', features:['40 athlete profiles','3 staff accounts','Basic injury tracking','Session scheduling'], limits:['No xG/xA analytics','No scout access'] },
  academy: { label:'Academy',     price:600,  usd:40, color:'#065A82', bg:'#E6F0F8', features:['100 athlete profiles','10 staff accounts','Full medical hub','xG & xA analytics','Scout access portal','PDF player reports'], limits:[], popular:true },
  elite:   { label:'Elite',       price:1000, usd:67, color:'#1B7A3E', bg:'#E8F8EE', features:['Unlimited athletes','Unlimited staff','Everything in Academy','Multi-team management','Priority onboarding','Custom branding'], limits:[] },
}
const METHODS = [
  { id:'momo',          label:'MTN MoMo',      icon:'📱' },
  { id:'vodafone_cash', label:'Vodafone Cash', icon:'💳' },
  { id:'bank_transfer', label:'Bank Transfer', icon:'🏦' },
]
const STATUS_COLORS = {
  active:   {bg:'#E8F8EE',color:'#1B7A3E'},
  trial:    {bg:'#EDD9C8',color:'#381932'},
  expired:  {bg:'#FDEDEC',color:'#C0392B'},
  cancelled:{bg:'#FDEDEC',color:'#C0392B'},
  pending:  {bg:'#FEF9E7',color:'#B7770D'},
}
function daysLeft(d){if(!d)return 0;const diff=new Date(d)-new Date();return Math.max(0,Math.ceil(diff/(1000*60*60*24)))}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}

export default function BillingPage() {
  const [profile,  setProfile]  = useState(null)
  const [sub,      setSub]      = useState(null)
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('overview')
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [selPlan,  setSelPlan]  = useState('academy')
  const [selMethod,setSelMethod]= useState('momo')
  const [payRef,   setPayRef]   = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState({text:'',type:''})

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    try{
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)return
      const {data:p}=await supabase.from('profiles').select('*,teams(id,name,short_name)').eq('id',session.user.id).single()
      if(!p)return
      setProfile({...p,email:session.user.email})
      setIsAdmin(p.role==='admin'||p.role==='superadmin')
      if(p.team_id){
        const res=await fetch(`/api/billing?team_id=${p.team_id}`)
        const data=await res.json()
        setSub(data.subscription)
        setHistory(data.history||[])
      }
    }catch(e){console.error(e)}
    setLoading(false)
  }

  async function handleUpgrade(){
    if(!selPlan){flash('Select a plan.','error');return}
    if(!payRef.trim()){flash('Enter your payment reference / MoMo transaction ID.','error');return}
    setSaving(true)
    try{
      const res=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:profile.team_id,plan:selPlan,payment_method:selMethod,payment_ref:payRef.trim()||null,notes:notes.trim()||null,requested_by:profile.id})})
      const data=await res.json()
      if(!res.ok){flash(data.error||'Failed.','error');setSaving(false);return}
      flash('✅ Plan updated! Your subscription is now active.','success')
      setPayRef('');setNotes('');await load();setTab('overview')
    }catch(e){flash('Error: '+e.message,'error')}
    setSaving(false)
  }

  async function handleCancel(){
    if(!confirm('Cancel your subscription? You will lose access at the end of the current period.'))return
    const res=await fetch('/api/billing',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:profile.team_id,action:'cancel',requested_by:profile.id})})
    const data=await res.json()
    if(!res.ok){flash(data.error||'Failed.','error');return}
    flash('Subscription cancelled.','success');await load()
  }

  const flash=(text,type='success')=>{setMsg({text,type});setTimeout(()=>setMsg({text:'',type:''}),8000)}
  const plan=sub?PLANS[sub.plan]||PLANS.trial:null
  const statusStyle=sub?(STATUS_COLORS[sub.status]||STATUS_COLORS.active):STATUS_COLORS.active
  const days=sub?daysLeft(sub.plan==='trial'?sub.trial_ends_at:sub.current_period_end):0
  const inp={width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)'}

  if(loading)return(<Layout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:36,height:36,border:'4px solid var(--milk-muted)',borderTopColor:'var(--plum)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/></div></Layout>)

  return(
    <Layout>
      <div style={{maxWidth:960,margin:'0 auto',padding:'32px 40px'}}>
        <PageHeader label="Subscription" title="Billing & Plan" subtitle="Manage your Apex Track subscription and payment history"/>

        {/* Tabs */}
        <div style={{display:'flex',gap:8,marginBottom:28,borderBottom:'1px solid var(--border)',paddingBottom:0}}>
          {[{id:'overview',label:'📋 Overview'},{id:'upgrade',label:'⬆️ Change Plan'},{id:'history',label:'🧾 Payment History'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 18px',background:'none',border:'none',borderBottom:tab===t.id?'2px solid var(--plum)':'2px solid transparent',fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?'var(--plum)':'var(--text2)',cursor:'pointer',fontFamily:'var(--font)',marginBottom:-1}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Flash */}
        {msg.text&&<div style={{padding:'13px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,whiteSpace:'pre-line',lineHeight:1.7,marginBottom:20,background:msg.type==='error'?'var(--danger-light)':'var(--success-light)',color:msg.type==='error'?'var(--danger)':'var(--success)',border:`1px solid ${msg.type==='error'?'rgba(192,57,43,0.2)':'rgba(27,122,62,0.2)'}`}}>{msg.text}</div>}

        {/* ── OVERVIEW ── */}
        {tab==='overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{background:plan?.color||'var(--plum)',padding:'18px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,243,230,0.6)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>Current Plan</div>
                  <div style={{fontSize:26,fontWeight:800,color:'#FFF3E6'}}>{plan?.label||'—'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:32,fontWeight:900,color:'#FFF3E6'}}>{sub?.plan==='trial'?'FREE':`GHS ${plan?.price?.toLocaleString()}`}</div>
                  {sub?.plan!=='trial'&&<div style={{fontSize:11,color:'rgba(255,243,230,0.6)'}}>per month · ≈ ${plan?.usd} USD</div>}
                </div>
              </div>
              <div style={{padding:'20px 24px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
                {[
                  {label:'Status',value:<span style={{fontWeight:700,padding:'3px 10px',borderRadius:99,fontSize:12,background:statusStyle.bg,color:statusStyle.color}}>{sub?.status?.toUpperCase()||'—'}</span>},
                  {label:sub?.plan==='trial'?'Trial Ends':'Renews On',value:fmtDate(sub?.plan==='trial'?sub?.trial_ends_at:sub?.current_period_end)},
                  {label:'Days Remaining',value:<span style={{fontWeight:700,color:days<=7?'var(--danger)':'var(--text)'}}>{days} days</span>},
                  {label:'Athlete Limit',value:sub?.athlete_limit>=999?'Unlimited':sub?.athlete_limit||'—'},
                  {label:'Staff Limit',value:sub?.staff_limit>=99?'Unlimited':sub?.staff_limit||'—'},
                  {label:'Payment',value:sub?.payment_method?.replace('_',' ')||'—'},
                ].map(({label,value})=>(
                  <div key={label} style={{background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:5}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:'1px solid var(--border)',padding:'14px 22px'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>Included in your plan</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                  {plan?.features.map(f=><span key={f} style={{fontSize:11,padding:'3px 10px',borderRadius:99,background:plan.bg,color:plan.color,fontWeight:600}}>✓ {f}</span>)}
                  {plan?.limits?.map(f=><span key={f} style={{fontSize:11,padding:'3px 10px',borderRadius:99,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'}}>– {f}</span>)}
                </div>
              </div>
              {isAdmin&&(
                <div style={{borderTop:'1px solid var(--border)',padding:'12px 22px',display:'flex',gap:10,flexWrap:'wrap'}}>
                  <button onClick={()=>setTab('upgrade')} className="btn-blue" style={{padding:'9px 20px',fontSize:13}}>⬆️ Change Plan</button>
                  {sub?.status==='active'&&sub?.plan!=='trial'&&(
                    <button onClick={handleCancel} style={{padding:'9px 20px',fontSize:13,fontWeight:600,background:'var(--danger-light)',color:'var(--danger)',border:'1px solid rgba(192,57,43,0.2)',borderRadius:'var(--r-md)',cursor:'pointer',fontFamily:'var(--font)'}}>Cancel Subscription</button>
                  )}
                </div>
              )}
            </div>

            {sub?.plan==='trial'&&days<=7&&(
              <div style={{background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:'var(--r-lg)',padding:'16px 20px',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:24}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#B7770D',marginBottom:3}}>Trial expires in {days} day{days!==1?'s':''}</div>
                  <div style={{fontSize:13,color:'#7A5A0A'}}>Subscribe now to keep your data and continue managing your club.</div>
                </div>
                {isAdmin&&<button onClick={()=>setTab('upgrade')} style={{padding:'8px 16px',background:'#B7770D',color:'#fff',border:'none',borderRadius:'var(--r-md)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'var(--font)',flexShrink:0}}>Subscribe →</button>}
              </div>
            )}

            <div className="card" style={{padding:'18px 22px'}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:14}}>💳 How to Pay</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
                {[
                  {icon:'📱',title:'MTN MoMo',detail:'Send to: 0XX XXX XXXX\nAccount: Apex Track Ltd'},
                  {icon:'💳',title:'Vodafone Cash',detail:'Send to: 0XX XXX XXXX\nAccount: Apex Track Ltd'},
                  {icon:'🏦',title:'Bank Transfer',detail:'Bank: GCB Bank\nAcc No: XXXX-XXXX-XXXX\nName: Apex Track Ltd'},
                ].map(m=>(
                  <div key={m.title} style={{background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'14px',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:20,marginBottom:6}}>{m.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:4}}>{m.title}</div>
                    <div style={{fontSize:12,color:'var(--text2)',whiteSpace:'pre-line',lineHeight:1.6}}>{m.detail}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,fontSize:12,color:'var(--text3)',lineHeight:1.7}}>
                After payment, click <strong>Change Plan</strong>, select your plan, enter your transaction reference, and submit. Your plan activates immediately.
              </div>
            </div>
          </div>
        )}

        {/* ── CHANGE PLAN ── */}
        {tab==='upgrade'&&(
          <div style={{display:'flex',flexDirection:'column',gap:22}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14}}>
              {Object.entries(PLANS).filter(([k])=>k!=='trial').map(([key,p])=>(
                <div key={key} onClick={()=>setSelPlan(key)}
                  style={{border:selPlan===key?`2px solid ${p.color}`:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px',cursor:'pointer',background:selPlan===key?p.bg:'#fff',transition:'all 0.15s',position:'relative'}}>
                  {p.popular&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:p.color,color:'#fff',fontSize:10,fontWeight:700,padding:'3px 14px',borderRadius:99,whiteSpace:'nowrap'}}>MOST POPULAR</div>}
                  {selPlan===key&&<div style={{position:'absolute',top:12,right:12,width:20,height:20,borderRadius:'50%',background:p.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#fff',fontWeight:700}}>✓</div>}
                  <div style={{fontSize:16,fontWeight:800,color:p.color,marginBottom:4}}>{p.label}</div>
                  <div style={{fontSize:24,fontWeight:900,color:'var(--text)',marginBottom:2}}>GHS {p.price.toLocaleString()}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:14}}>per month · ≈ ${p.usd} USD</div>
                  {p.features.map(f=><div key={f} style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>✓ {f}</div>)}
                  {p.limits?.map(f=><div key={f} style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>– {f}</div>)}
                </div>
              ))}
            </div>

            <div className="card" style={{padding:'24px'}}>
              <div style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:18}}>💰 Payment Details</div>
              <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:480}}>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>Payment Method</label>
                  <div style={{display:'flex',gap:8}}>
                    {METHODS.map(m=>(
                      <button key={m.id} onClick={()=>setSelMethod(m.id)}
                        style={{flex:1,padding:'10px',border:selMethod===m.id?'2px solid var(--plum)':'1px solid var(--border)',borderRadius:'var(--r-md)',background:selMethod===m.id?'var(--blue-light)':'#fff',cursor:'pointer',fontSize:12,fontWeight:selMethod===m.id?700:500,color:selMethod===m.id?'var(--plum)':'var(--text2)',fontFamily:'var(--font)'}}>
                        {m.icon}<br/>{m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>Transaction / Reference ID *</label>
                  <input value={payRef} onChange={e=>setPayRef(e.target.value)} style={inp} placeholder="e.g. MOMO123456789"
                    onFocus={e=>e.target.style.borderColor='var(--plum)'}
                    onBlur={e=>e.target.style.borderColor='var(--border)'}/>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>The MoMo transaction ID or bank transfer reference from your payment confirmation.</div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>Notes (optional)</label>
                  <input value={notes} onChange={e=>setNotes(e.target.value)} style={inp} placeholder="e.g. Paid for 3 months"
                    onFocus={e=>e.target.style.borderColor='var(--plum)'}
                    onBlur={e=>e.target.style.borderColor='var(--border)'}/>
                </div>
                <div style={{background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'14px 16px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Order Summary</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                    <span style={{color:'var(--text2)'}}>{PLANS[selPlan]?.label} Plan</span>
                    <span style={{fontWeight:700,color:'var(--text)'}}>GHS {PLANS[selPlan]?.price?.toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                    <span>Billing period</span><span>30 days from today</span>
                  </div>
                </div>
                <button onClick={handleUpgrade} disabled={saving} className="btn-blue" style={{padding:'12px 28px',opacity:saving?0.7:1,fontSize:14}}>
                  {saving?'⏳ Processing…':`✅ Activate ${PLANS[selPlan]?.label} — GHS ${PLANS[selPlan]?.price?.toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==='history'&&(
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:700}}>Payment History</div>
              <span style={{fontSize:12,color:'var(--text3)'}}>{history.length} events</span>
            </div>
            {history.length===0?(
              <div style={{padding:'32px',textAlign:'center',color:'var(--text3)',fontSize:13}}>No billing history yet.</div>
            ):(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr',gap:8,padding:'10px 20px',background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}>
                  {['Date','Type','Plan','Amount','Reference'].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>)}
                </div>
                {history.map((ev,i)=>(
                  <div key={ev.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr',gap:8,padding:'12px 20px',borderBottom:'1px solid var(--border)',background:i%2===0?'#fff':'var(--surface2)'}}>
                    <div style={{fontSize:12,color:'var(--text2)'}}>{fmtDate(ev.created_at)}</div>
                    <div><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,background:'var(--blue-light)',color:'var(--plum)',textTransform:'capitalize'}}>{ev.type}</span></div>
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