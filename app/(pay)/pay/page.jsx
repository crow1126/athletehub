'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { payFetch } from '@/lib/payFetch'

const fmt = (n) => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const SIMULATE = process.env.NODE_ENV !== 'production'

// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, accent }) {
  return (
    <div className="pay-card" style={{ padding: '22px 24px', position: 'relative', overflow: 'hidden', animation: 'fadeUp 0.4s ease' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 64, opacity: 0.04, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || '#F1F5F9', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>{sub}</div>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    draft:           { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', dot: '#94A3B8', label: 'Draft' },
    pending_approval:{ bg: 'rgba(245,158,11,0.12)', color: '#FBB124', dot: '#F59E0B', label: 'Pending' },
    approved:        { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA', dot: '#3B82F6', label: 'Approved' },
    processing:      { bg: 'rgba(139,92,246,0.12)', color: '#A78BFA', dot: '#8B5CF6', label: 'Processing' },
    completed:       { bg: 'rgba(16,185,129,0.12)', color: '#34D399', dot: '#10B981', label: 'Completed' },
    failed:          { bg: 'rgba(239,68,68,0.12)',  color: '#FCA5A5', dot: '#EF4444', label: 'Failed' },
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
function TopUpModal({ onClose, teamId }) {
  const [amount, setAmount]   = useState('')
  const [email,  setEmail]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!amount || isNaN(amount) || Number(amount) < 10) return setError('Minimum top-up is GHS 10')
    setLoading(true); setError(null)
    const { res, data } = await payFetch('/api/pay/topup', {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, amount_ghs: Number(amount), email }),
    })
    setLoading(false)
    if (!res.ok) return setError(data.error || 'Failed')
    if (data.checkout_url) {
      window.open(data.checkout_url, '_blank')
    } else if (SIMULATE) {
      await payFetch('/api/pay/dev-topup-confirm', {
        method: 'POST',
        body: JSON.stringify({ reference: data.reference, amount_ghs: Number(amount), team_id: teamId }),
      })
      alert(`✅ Simulated top-up of ${fmt(amount)} completed!`)
    }
    onClose(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeUp 0.2s ease' }}>
      <div className="pay-card" style={{ width: 420, padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>Top Up Wallet</h2>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>Pay via MoMo through Moolre. Funds credit in real-time.</p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label className="pay-lbl">Amount (GHS)</label>
            <input className="pay-inp" type="number" min="10" step="0.01" placeholder="500.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="pay-lbl">Your Email (for Moolre receipt)</label>
            <input className="pay-inp" type="email" placeholder="admin@club.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FCA5A5', marginBottom: 16 }}>{error}</div>}
          {SIMULATE && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#F59E0B', marginBottom: 16 }}>⚡ Dev mode — payment will be simulated instantly</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="pay-btn-ghost" style={{ flex: 1 }} onClick={() => onClose(false)}>Cancel</button>
            <button type="submit" className="pay-btn-gold" style={{ flex: 2 }} disabled={loading}>
              {loading ? 'Processing…' : '💸 Top Up Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function PayOverviewPage() {
  const [teamId,     setTeamId]     = useState(null)
  const [walletData, setWalletData] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [showTopUp,  setShowTopUp]  = useState(false)

  const load = useCallback(async (tid) => {
    if (!tid) return
    setLoading(true)
    const { res, data } = await payFetch(`/api/pay/wallet?team_id=${tid}`)
    setLoading(false)
    if (res.ok) setWalletData(data)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', session.user.id).single()
      if (profile?.team_id) { setTeamId(profile.team_id); load(profile.team_id) }
    }
    init()
  }, [load])

  const wallet     = walletData?.wallet
  const stats      = walletData?.stats
  const recentRuns = walletData?.recentRuns || []

  return (
    <div style={{ padding: '32px', animation: 'fadeUp 0.35s ease' }}>
      {showTopUp && teamId && (
        <TopUpModal
          teamId={teamId}
          onClose={(refresh) => { setShowTopUp(false); if (refresh) load(teamId) }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.04em', marginBottom: 4 }}>
            Payroll Overview
          </h1>
          <p style={{ fontSize: 14, color: '#475569' }}>Wallet balance, payroll activity, and quick actions.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pay-btn-ghost" onClick={() => load(teamId)}>↺ Refresh</button>
          <button className="pay-btn-gold" onClick={() => setShowTopUp(true)}>+ Top Up Wallet</button>
        </div>
      </div>

      {/* Wallet hero */}
      <div style={{ background: 'linear-gradient(135deg, #0F1B33 0%, #1A1000 100%)', borderRadius: 20, border: '1px solid rgba(245,158,11,0.2)', padding: '32px 36px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)', fontSize: 80, opacity: 0.07 }}>₵</div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#F59E0B', marginBottom: 8 }}>Club Payroll Wallet</div>
        {loading ? (
          <div style={{ fontSize: 36, color: '#2D3748' }}>Loading…</div>
        ) : (
          <>
            <div style={{ fontSize: 46, fontWeight: 900, color: '#FEF3C7', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 4 }}>
              {fmt(wallet?.balance)}
            </div>
            <div style={{ fontSize: 13, color: '#78716C' }}>Available balance · Last updated {wallet?.updated_at ? new Date(wallet.updated_at).toLocaleString() : 'never'}</div>
            {SIMULATE && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: '5px 12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>⚡ Simulate Instant Transfer — ON (dev mode)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Topped Up"  value={loading ? '…' : fmt(stats?.totalTopUps)}   icon="⬆" sub="All-time deposits" accent="#34D399" />
        <StatCard label="Total Disbursed"  value={loading ? '…' : fmt(stats?.totalDisbursed)} icon="💸" sub="All-time payouts" />
        <StatCard label="Pending Payouts"  value={loading ? '…' : fmt(stats?.pendingAmount)}  icon="⏳" sub="Awaiting confirmation" accent="#F59E0B" />
        <StatCard label="Platform Fees"    value={loading ? '…' : fmt(stats?.totalFees)}       icon="📊" sub="1% per run" accent="#818CF8" />
      </div>

      {/* Quick Actions + Recent Runs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Quick actions */}
        <div className="pay-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="pay-btn-gold" style={{ width: '100%' }} onClick={() => setShowTopUp(true)}>
              💳 Top Up Wallet
            </button>
            <Link href="/pay/payroll" style={{ textDecoration: 'none' }}>
              <button className="pay-btn-ghost" style={{ width: '100%' }}>📋 New Payroll Run</button>
            </Link>
            <Link href="/pay/transactions" style={{ textDecoration: 'none' }}>
              <button className="pay-btn-ghost" style={{ width: '100%' }}>📒 View Transactions</button>
            </Link>
          </div>
          <div style={{ marginTop: 20, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Webhook URLs</div>
            <div style={{ fontSize: 10, color: '#334155', wordBreak: 'break-all', lineHeight: 1.6 }}>
              <div style={{ color: '#64748B', marginBottom: 2 }}>Top-Up:</div>
              <code style={{ fontSize: 9, color: '#94A3B8' }}>/api/webhooks/pay/moolre-topup</code>
              <div style={{ color: '#64748B', marginTop: 6, marginBottom: 2 }}>Disbursement:</div>
              <code style={{ fontSize: 9, color: '#94A3B8' }}>/api/webhooks/pay/moolre-disburse</code>
            </div>
          </div>
        </div>

        {/* Recent runs */}
        <div className="pay-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Payroll Runs</h3>
            <Link href="/pay/payroll" style={{ fontSize: 12, color: '#F59E0B', textDecoration: 'none', fontWeight: 700 }}>View All →</Link>
          </div>
          {loading ? (
            <div style={{ color: '#334155', fontSize: 14, textAlign: 'center', padding: 32 }}>Loading…</div>
          ) : recentRuns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💸</div>
              <div style={{ color: '#475569', fontSize: 14 }}>No payroll runs yet</div>
              <Link href="/pay/payroll">
                <button className="pay-btn-gold" style={{ marginTop: 16 }}>Create First Payroll</button>
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Description', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#334155' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRuns.map(run => (
                  <tr key={run.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <Link href={`/pay/payroll/${run.id}`} style={{ color: '#CBD5E1', textDecoration: 'none', fontWeight: 600 }}>
                        {run.description}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#94A3B8', fontWeight: 600 }}>{fmt(run.total_amount)}</td>
                    <td style={{ padding: '10px 8px' }}><StatusBadge status={run.status} /></td>
                    <td style={{ padding: '10px 8px', color: '#475569', fontSize: 11 }}>{new Date(run.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
