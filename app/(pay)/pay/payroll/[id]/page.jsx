'use client'
import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  info: '#1D4ED8',
  infoBg: '#DBEAFE',
}

const fmt = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`


function StatusBadge({ status }) {
  const map = {
    draft: { bg: 'rgba(36,62,48,0.10)', color: C.text3, label: 'Draft' },
    pending_approval: { bg: C.warningBg, color: C.warning, label: 'Pending' },
    approved: { bg: C.infoBg, color: C.info, label: 'Approved' },
    processing: { bg: 'rgba(109,40,217,0.10)', color: '#6D28D9', label: 'Processing' },
    completed: { bg: C.successBg, color: C.success, label: 'Completed' },
    failed: { bg: C.dangerBg, color: C.danger, label: 'Failed' },
    pending: { bg: C.warningBg, color: C.warning, label: 'Pending' },
    success: { bg: C.successBg, color: C.success, label: 'Paid' },
  }
  const s = map[status] || map.draft
  return <span className="pay-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
}

// Timeline step
function TimelineStep({ done, active, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
        border: `2px solid ${done ? C.success : active ? C.warning : C.border}`,
        background: done ? C.successBg : active ? C.warningBg : 'transparent',
        color: done ? C.success : active ? C.warning : C.text3
      }}>
        {done ? '✓' : active ? '⬤' : '○'}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: done || active ? C.text : C.text3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function PayrollRunDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [run, setRun] = useState(null)
  const [items, setItems] = useState([])
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(null) // 'approving' | 'disbursing'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [teamId, setTeamId] = useState(null)
  const [role, setRole] = useState(null)

  const load = useCallback(async (tid) => {
    setLoading(true)
    const [runRes, walletRes] = await Promise.all([
      payFetch(`/api/pay/payroll/${id}`),
      tid ? payFetch(`/api/pay/wallet?team_id=${tid}`) : Promise.resolve({ res: { ok: false }, data: {} }),
    ])
    setLoading(false)
    if (runRes.res.ok) { setRun(runRes.data.run); setItems(runRes.data.items || []) }
    if (walletRes.res.ok) setWallet(walletRes.data.wallet)
  }, [id])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('team_id, role').eq('id', session.user.id).single()
      setTeamId(profile?.team_id)
      setRole(profile?.role)
      load(profile?.team_id)
    }
    init()
  }, [load])

  async function approve() {
    setAction('approving'); setError(null)
    const { res, data } = await payFetch(`/api/pay/payroll/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    })
    setAction(null)
    if (!res.ok) return setError(data.error)
    setResult(`✅ Approved! Fee: ${fmt(data.fee)}`)
    load(teamId)
  }

  async function disburse() {
    if (!confirm('This will trigger live MoMo transfers. Proceed?')) return
    setAction('disbursing'); setError(null)
    const { res, data } = await payFetch('/api/pay/disburse', {
      method: 'POST',
      body: JSON.stringify({ payroll_run_id: id }),
    })
    setAction(null)
    if (!res.ok) {
      const msg = data.error || 'Disbursement failed'
      // Provide actionable guidance for the most common failure
      if (msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('ain01')) {
        setError(
          '❌ Moolre API Authentication Error\n\n' +
          'Your Moolre account does not have API payouts enabled.\n\n' +
          'To fix this:\n' +
          '1. Go to app.moolre.com → Wallets\n' +
          '2. Edit your Coreva wallet\n' +
          '3. Enable "API Transactions" toggle\n' +
          '4. Or contact Moolre support at support@moolre.com'
        )
      } else {
        setError(msg)
      }
      return
    }
    const simNote = data.simulated ? ' (simulated)' : ''
    const dbg = data._debug ? '\n\nEnv: ' + JSON.stringify(data._debug) : ''
    if (data.successCount === 0 && data.failCount > 0) {
      const firstErr = data.results?.[0]?.statusMsg || ''
      const isAuthErr = firstErr.toLowerCase().includes('authentication') || firstErr.toLowerCase().includes('ain01')
      if (isAuthErr) {
        setError(
          '❌ Moolre API Authentication Error — all transfers failed.\n\n' +
          'Your Moolre account does not have API payouts enabled.\n\n' +
          'To fix:\n' +
          '1. Go to app.moolre.com → Wallets\n' +
          '2. Edit your Coreva wallet → Enable "API Transactions"\n' +
          '3. Or email support@moolre.com to activate API disbursements.\n\n' +
          '⬇ Workaround: Click "Export CSV" to download this payroll and upload it manually to app.moolre.com → Bulk Payouts.'
        )
      } else {
        setError(`❌ All disbursements failed. ${firstErr}${dbg}`)
      }
    } else {
      setResult(`✅ Disbursed ${data.successCount} recipient(s)${simNote}. ⚠ ${data.failCount} failed.${dbg}`)
    }
    load(teamId)
  }

  async function cancel() {
    if (!confirm('Cancel this payroll run?')) return
    await payFetch(`/api/pay/payroll/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    load(teamId)
  }

  function exportCSV() {
    const rows = [
      ['name', 'phone', 'amount', 'narration'],
      ...items.map(item => [
        item.name,
        item.phone,
        Number(item.total_amount).toFixed(2),
        `${run.description} - ApexTrack Payroll`,
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${run.description.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }


  const isAdmin = ['admin', 'superadmin'].includes(role)

  if (loading) return <div style={{ padding: 64, textAlign: 'center', color: C.text3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading…</div>
  if (!run) return <div style={{ padding: 64, textAlign: 'center', color: C.danger, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Run not found</div>

  const fee = parseFloat((run.total_amount * 0.01).toFixed(2))
  const totalRequired = run.total_amount + fee
  const balance = Number(wallet?.balance || 0)
  const sufficient = balance >= totalRequired

  // Timeline
  const isDraft = run.status === 'draft'
  const isApproved = ['approved', 'processing', 'completed', 'failed'].includes(run.status)
  const isDispatched = ['processing', 'completed', 'failed'].includes(run.status)
  const isDone = run.status === 'completed'

  return (
    <div style={{ padding: '32px', animation: 'fadeUp 0.35s ease' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 20 }}>
        <Link href="/pay" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>ApexPay</Link>
        {' / '}
        <Link href="/pay/payroll" style={{ color: C.text3, textDecoration: 'none', fontWeight: 600 }}>Payroll</Link>
        {' / '}
        <span style={{ color: C.text }}>{run.description}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>{run.description}</h1>
            <StatusBadge status={run.status} />
          </div>
          <div style={{ fontSize: 13, color: C.text3 }}>
            Created {new Date(run.created_at).toLocaleString()} by {run.created_by_profile?.full_name || 'Admin'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (run.status === 'draft' || run.status === 'pending_approval') && (
            <button className="pay-btn-ghost" onClick={cancel} disabled={!!action}>Cancel Run</button>
          )}
          {isAdmin && (run.status === 'draft' || run.status === 'pending_approval') && (
            <button className="pay-btn-gold" onClick={approve} disabled={!!action}>
              {action === 'approving' ? 'Approving…' : '✓ Approve Run'}
            </button>
          )}
          {isAdmin && run.status === 'approved' && (
            <button
              onClick={exportCSV}
              style={{ background: C.muted, border: `1px solid ${C.border}`, color: C.teal, borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              title="Download CSV for Moolre Bulk Payouts"
            >
              ⬇ Export CSV
            </button>
          )}
          {isAdmin && run.status === 'approved' && (
            <button className="pay-btn-gold" onClick={disburse} disabled={!!action} style={{ background: 'linear-gradient(135deg, #0A5C54, #0B7A70)' }}>
              {action === 'disbursing' ? '⏳ Disbursing…' : '💸 Disburse Now'}
            </button>
          )}
          {!isAdmin && (
            <span style={{ fontSize: 12, color: C.text3, fontStyle: 'italic', alignSelf: 'center' }}>View only</span>
          )}
        </div>
      </div>

      {/* Status messages */}
      {result && <div style={{ background: C.successBg, border: `1px solid ${C.success}`, borderRadius: 10, padding: '12px 18px', fontSize: 13, color: C.success, marginBottom: 20 }}>{result}</div>}
      {error && (
        <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 10, padding: '12px 18px', fontSize: 13, color: C.danger, marginBottom: 20 }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }}>{error}</pre>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left: items table */}
        <div>
          <div className="pay-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: C.muted }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recipients ({items.length})
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: C.muted }}>
                <tr>
                  {['Name', 'Phone', 'Base', 'Bonus', 'Allowance', 'Total', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}`, animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: C.text }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: C.text3, textTransform: 'capitalize', marginTop: 2 }}>{item.recipient_type}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: C.text2, fontFamily: 'monospace' }}>
                      {item.phone ? `****${String(item.phone).slice(-4)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: C.text3 }}>{fmt(item.base_salary)}</td>
                    <td style={{ padding: '12px 16px', color: C.text3 }}>{fmt(item.bonus)}</td>
                    <td style={{ padding: '12px 16px', color: C.text3 }}>{fmt(item.allowance)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: C.success }}>{fmt(item.total_amount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={item.status} />
                      {item.moolre_status_msg && <div style={{ fontSize: 10, color: C.text3, marginTop: 3 }}>{item.moolre_status_msg}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: summary + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Financial summary */}
          <div className="pay-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Financial Summary</h3>
            {[
              { label: 'Payroll Total', value: fmt(run.total_amount), color: C.text },
              { label: 'Platform Fee (1%)', value: fmt(fee), color: C.text3 },
              { label: 'Total Deduction', value: fmt(totalRequired), color: C.warning },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.text3 }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.value}</span>
              </div>
            ))}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: sufficient ? C.successBg : C.dangerBg, border: `1px solid ${sufficient ? C.success : C.danger}`, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: sufficient ? C.success : C.danger, fontWeight: 700 }}>
                {sufficient ? '✓ Wallet has sufficient funds' : '✗ Insufficient wallet balance'}
              </div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>Available: {fmt(balance)}</div>
            </div>
          </div>

          {/* Approval info */}
          {run.approved_at && (
            <div className="pay-card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Approval</h3>
              <div style={{ fontSize: 13, color: C.text }}>{run.approved_by_profile?.full_name || 'Admin'}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{new Date(run.approved_at).toLocaleString()}</div>
            </div>
          )}

          {/* Timeline */}
          <div className="pay-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Progress</h3>
            <TimelineStep done={!isDraft} active={isDraft} label="Draft Created" sub={new Date(run.created_at).toLocaleDateString()} />
            <TimelineStep done={isApproved} active={!isDraft && !isApproved} label="Admin Approved" sub={run.approved_at ? new Date(run.approved_at).toLocaleDateString() : undefined} />
            <TimelineStep done={isDispatched} active={isApproved && !isDispatched} label="Disbursement Initiated" />
            <TimelineStep done={isDone} active={isDispatched && !isDone} label="All Payments Confirmed" />
          </div>
        </div>
      </div>
    </div>
  )
}
