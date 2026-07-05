'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { payFetch } from '@/lib/payFetch'

const C = {
  text: '#0B1E14',
  text2: '#102A1C',
  text3: '#243E30',
  teal: '#0B7A70',
  tealDeep: '#0A5C54',
  tealAlpha: 'rgba(11,122,112,0.10)',
  border: '#82C29A',
  muted: '#E2F5E9',
  bg: '#F0FBF4',
  card: 'rgba(255,255,255,0.92)',
  success: '#047857',
  successBg: '#D1FAE5',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  warning: '#B45309',
  warningBg: '#FEF3C7',
}

const fmt = (n) => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`


// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, accent }) {
  return (
    <div className="pay-card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden', animation: 'fadeUp 0.4s ease' }}>
      <div style={{ position: 'absolute', top: -16, right: -16, fontSize: 56, opacity: 0.08, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.text3, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    draft: { bg: 'rgba(36,62,48,0.10)', color: C.text3, dot: C.text3, label: 'Draft' },
    pending_approval: { bg: C.warningBg, color: C.warning, dot: C.warning, label: 'Pending' },
    approved: { bg: C.tealAlpha, color: C.teal, dot: C.teal, label: 'Approved' },
    processing: { bg: 'rgba(109,40,217,0.10)', color: '#6D28D9', dot: '#6D28D9', label: 'Processing' },
    completed: { bg: C.successBg, color: C.success, dot: C.success, label: 'Completed' },
    failed: { bg: C.dangerBg, color: C.danger, dot: C.danger, label: 'Failed' },
  }
  const s = map[status] || map.draft
  return (
    <span className="pay-badge" style={{ background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  )
}

// ─── Top-up modal ─────────────────────────────────────────────────────────
function TopUpModal({ onClose, teamId, isSimulation }) {
  const [amount, setAmount] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!amount || isNaN(amount) || Number(amount) < 10) return setError('Minimum top-up is GHS 10')
    setLoading(true); setError(null)
    const { res, data } = await payFetch('/api/pay/topup', {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, amount_ghs: Number(amount), email }),
    })
    setLoading(false)
    if (!res.ok) {
      return setError(data.error || 'Failed')
    }
    if (data.checkout_url) {
      window.open(data.checkout_url, '_blank')
    } else if (isSimulation) {
      await payFetch('/api/pay/dev-topup-confirm', {
        method: 'POST',
        body: JSON.stringify({ reference: data.reference, amount_ghs: Number(amount), team_id: teamId }),
      })
      alert(`Simulated top-up of ${fmt(amount)} completed!`)
    }
    onClose(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,20,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeUp 0.2s ease' }}
      onClick={() => onClose(false)}>
      <div className="pay-card" style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: '28px 24px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))', background: '#ffffff', border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}>
        {/* handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Top Up Wallet</h2>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>Pay via MoMo through Moolre. Funds credit in real-time.</p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label className="pay-lbl">Amount (GHS)</label>
            <input className="pay-inp" type="number" inputMode="decimal" min="10" step="0.01" placeholder="500.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="pay-lbl">Your Email (for Moolre receipt)</label>
            <input className="pay-inp" type="email" inputMode="email" placeholder="admin@club.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {error && <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger, marginBottom: 16 }}>{error}</div>}
          {isSimulation && <div style={{ background: C.warningBg, border: `1px solid ${C.warning}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.warning, marginBottom: 16 }}>Dev mode — payment will be simulated instantly</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="pay-btn-ghost" style={{ flex: 1 }} onClick={() => onClose(false)}>Cancel</button>
            <button type="submit" className="pay-btn-gold" style={{ flex: 2 }} disabled={loading}>
              {loading ? 'Processing…' : 'Top Up Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function PayOverviewPage() {
  const [teamId, setTeamId] = useState(null)
  const [role, setRole] = useState(null)
  const [walletData, setWalletData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTopUp, setShowTopUp] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSimulation, setIsSimulation] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null) // { type: 'success' | 'error' | 'loading', text: string }

  const load = useCallback(async (tid) => {
    if (!tid) return
    setLoading(true)
    const { res, data } = await payFetch(`/api/pay/wallet?team_id=${tid}`)
    setLoading(false)
    if (res.ok) setWalletData(data)
  }, [])

  useEffect(() => {
    setIsSimulation(process.env.NEXT_PUBLIC_ENABLE_SIMULATION === 'true')
  }, [])

  // Auto-verify payment on success redirect
  useEffect(() => {
    if (typeof window === 'undefined' || !teamId) return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    const ref = params.get('reference')

    if (status === 'success' && ref && ref.startsWith('APAY-TOPUP-')) {
      async function verify() {
        setVerifyStatus({ type: 'loading', text: 'Verifying your payment with Moolre... Please do not close this page.' })
        try {
          const response = await fetch('/api/pay/topup/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref }),
          })
          const data = await response.json()
          if (response.ok && data.ok) {
            setVerifyStatus({ type: 'success', text: data.message || 'Payment successfully verified and wallet credited!' })
            load(teamId)
          } else {
            setVerifyStatus({ type: 'error', text: data.error || 'Failed to verify payment status.' })
          }
        } catch (err) {
          setVerifyStatus({ type: 'error', text: 'An error occurred while verifying the payment.' })
        }
        // Clean URL query parameters
        const url = new URL(window.location.href)
        url.searchParams.delete('status')
        url.searchParams.delete('reference')
        window.history.replaceState({}, '', url.pathname + url.search)
      }
      verify()
    }
  }, [teamId, load])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('team_id, role').eq('id', session.user.id).single()
      if (profile?.team_id) { setTeamId(profile.team_id); setRole(profile.role); load(profile.team_id) }
    }
    init()
  }, [load])

  const isAdmin = ['admin', 'superadmin'].includes(role)
  const wallet = walletData?.wallet
  const stats = walletData?.stats
  const recentRuns = walletData?.recentRuns || []

  return (
    <div className="pay-page" style={{ animation: 'fadeUp 0.35s ease' }}>
      {showTopUp && teamId && (
        <TopUpModal teamId={teamId} isSimulation={isSimulation} onClose={(refresh) => { setShowTopUp(false); if (refresh) load(teamId) }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 20 : 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: C.text, letterSpacing: '-0.04em', marginBottom: 3 }}>
            Payroll Overview
          </h1>
          <p style={{ fontSize: 13, color: C.text3 }}>Wallet balance, payroll activity &amp; quick actions.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="pay-btn-ghost" style={{ padding: '9px 14px', fontSize: 13 }} onClick={() => load(teamId)}>↺ Refresh</button>
          {isAdmin && <button className="pay-btn-gold" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setShowTopUp(true)}>+ Top Up</button>}
        </div>
      </div>

      {/* Verification Status Banner */}
      {verifyStatus && (
        <div style={{
          background: verifyStatus.type === 'loading' ? C.warningBg : verifyStatus.type === 'success' ? C.successBg : C.dangerBg,
          border: `1px solid ${verifyStatus.type === 'loading' ? C.warning : verifyStatus.type === 'success' ? C.success : C.danger}`,
          color: verifyStatus.type === 'loading' ? C.warning : verifyStatus.type === 'success' ? C.success : C.danger,
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 20,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          animation: 'fadeUp 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{verifyStatus.type === 'loading' ? '' : verifyStatus.type === 'success' ? '' : ''}</span>
            <span>{verifyStatus.text}</span>
          </div>
          {verifyStatus.type !== 'loading' && (
            <button
              onClick={() => setVerifyStatus(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Wallet hero — teal gradient matching ApexTrack brand */}
      <div style={{
        background: `linear-gradient(135deg, ${C.tealDeep} 0%, ${C.teal} 60%, #0D9488 100%)`,
        borderRadius: isMobile ? 16 : 20,
        border: `1px solid ${C.border}`,
        padding: isMobile ? '22px 20px' : '32px 36px',
        marginBottom: isMobile ? 16 : 24,
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(11,122,112,0.18)',
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', right: isMobile ? 16 : 32, top: '50%', transform: 'translateY(-50%)', fontSize: isMobile ? 60 : 80, opacity: 0.12, color: '#fff' }}>₵</div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.80)', marginBottom: 8 }}>Club Payroll Wallet</div>
        {loading ? (
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.5)' }}>Loading…</div>
        ) : (
          <>
            <div style={{ fontSize: isMobile ? 34 : 46, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 4 }}>
              {fmt(wallet?.balance)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)' }}>
              Available balance · Last updated {wallet?.updated_at ? new Date(wallet.updated_at).toLocaleString() : 'never'}
            </div>
            {isSimulation && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.25)' }}>
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Dev mode — instant transfer simulation ON</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 }}>
        <StatCard label="Total Topped Up" value={loading ? '…' : fmt(stats?.totalTopUps)} icon="⬆" sub="All-time deposits" accent={C.success} />
        <StatCard label="Total Disbursed" value={loading ? '…' : fmt(stats?.totalDisbursed)} icon="" sub="All-time payouts" accent={C.teal} />
        <StatCard label="Pending Payouts" value={loading ? '…' : fmt(stats?.pendingAmount)} icon="" sub="Awaiting confirmation" accent={C.warning} />
        <StatCard label="Platform Fees" value={loading ? '…' : fmt(stats?.totalFees)} icon="" sub="1% per run" accent="#6D28D9" />
      </div>

      {/* Quick Actions + Recent Runs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: isMobile ? 12 : 20 }}>

        {/* Quick actions */}
        <div className="pay-card" style={{ padding: isMobile ? 16 : 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isAdmin && (
              <button className="pay-btn-gold" style={{ width: '100%' }} onClick={() => setShowTopUp(true)}>
                💳 Top Up Wallet
              </button>
            )}
            {isAdmin && (
              <Link href="/pay/payroll" style={{ textDecoration: 'none' }}>
                <button className="pay-btn-ghost" style={{ width: '100%' }}>New Payroll Run</button>
              </Link>
            )}
            <Link href="/pay/transactions" style={{ textDecoration: 'none' }}>
              <button className="pay-btn-ghost" style={{ width: '100%' }}>View Transactions</button>
            </Link>
          </div>

        </div>

        {/* Recent runs */}
        <div className="pay-card" style={{ padding: isMobile ? 16 : 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Payroll Runs</h3>
            <Link href="/pay/payroll" style={{ fontSize: 12, color: C.teal, textDecoration: 'none', fontWeight: 700 }}>View All →</Link>
          </div>
          {loading ? (
            <div style={{ color: C.text3, fontSize: 14, textAlign: 'center', padding: 32 }}>Loading…</div>
          ) : recentRuns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: isMobile ? 24 : 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}></div>
              <div style={{ color: C.text3, fontSize: 13 }}>No payroll runs yet</div>
              <Link href="/pay/payroll">
                <button className="pay-btn-gold" style={{ marginTop: 14, fontSize: 13, padding: '9px 18px' }}>Create First Payroll</button>
              </Link>
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentRuns.map(run => (
                <Link key={run.id} href={`/pay/payroll/${run.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.muted, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.description}</div>
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 4 }}>{fmt(run.total_amount)}</div>
                      <StatusBadge status={run.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="pay-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Description', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map(run => (
                    <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 8px' }}>
                        <Link href={`/pay/payroll/${run.id}`} style={{ color: C.text2, textDecoration: 'none', fontWeight: 600 }}>{run.description}</Link>
                      </td>
                      <td style={{ padding: '10px 8px', color: C.text2, fontWeight: 600 }}>{fmt(run.total_amount)}</td>
                      <td style={{ padding: '10px 8px' }}><StatusBadge status={run.status} /></td>
                      <td style={{ padding: '10px 8px', color: C.text3, fontSize: 11 }}>{new Date(run.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
