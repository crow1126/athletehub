'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { payFetch } from '@/lib/payFetch'

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
}

const BADGE = {
  active:   { bg: 'rgba(16,185,129,0.12)', color: '#10B981', label: 'Active' },
  inactive: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: 'Inactive' },
}

export default function PaySettingsPage() {
  const [profile,     setProfile]     = useState(null)
  const [accountants, setAccountants] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState({ full_name: '', email: '', password: '' })
  const [deleting,    setDeleting]    = useState(null)
  const [isMobile,    setIsMobile]    = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: prof } = await supabase.from('profiles').select('*, teams(id, name)').eq('id', session.user.id).single()
      setProfile(prof)
      if (!['admin', 'superadmin'].includes(prof?.role)) { setLoading(false); return }
      const { res, data } = await payFetch(`/api/pay/accountants?team_id=${prof.team_id}`)
      if (!res.ok) throw new Error(data.error || 'Failed to load accountants')
      setAccountants(data.accountants || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault(); setError(''); setSuccess('')
    if (!form.full_name || !form.email || !form.password) { setError('All fields are required'); return }
    setSaving(true)
    try {
      const { res, data } = await payFetch('/api/pay/accountants', { method: 'POST', body: JSON.stringify({ ...form, team_id: profile.team_id }) })
      if (!res.ok) throw new Error(data.error || 'Failed to create accountant')
      setSuccess(`✓ Accountant "${form.full_name}" created successfully`)
      setForm({ full_name: '', email: '', password: '' }); setShowForm(false); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleActive(acc) {
    setError(''); setSuccess('')
    try {
      const { res, data } = await payFetch(`/api/pay/accountants/${acc.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !acc.is_active }) })
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setSuccess(`✓ ${acc.full_name} ${acc.is_active ? 'deactivated' : 'activated'}`); load()
    } catch (e) { setError(e.message) }
  }

  async function handleDelete(acc) {
    if (!confirm(`Permanently delete "${acc.full_name}"? This cannot be undone.`)) return
    setDeleting(acc.id); setError(''); setSuccess('')
    try {
      const { res, data } = await payFetch(`/api/pay/accountants/${acc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setSuccess(`✓ ${acc.full_name} deleted`); load()
    } catch (e) { setError(e.message) }
    setDeleting(null)
  }

  const isAdmin = ['admin', 'superadmin'].includes(profile?.role)

  return (
    <div className="pay-page" style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto', animation: 'fadeUp 0.4s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em', margin: 0 }}>Settings</h1>
        <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
          {isAdmin ? "Manage accountant logins for your club's ApexPay portal" : 'Your portal access settings'}
        </p>
      </div>

      {/* Flash messages */}
      {error   && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', marginBottom: 16, fontSize: 14 }}>{error}</div>}
      {success && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', color: '#34D399', marginBottom: 16, fontSize: 14 }}>{success}</div>}

      {/* Profile card */}
      <div className="pay-card" style={{ padding: isMobile ? '16px' : '24px', marginBottom: isMobile ? 20 : 28, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: isMobile ? 46 : 56, height: isMobile ? 46 : 56, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 16 : 20, fontWeight: 800, color: '#F59E0B', flexShrink: 0 }}>
          {initials(profile?.full_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || '—'}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {profile?.role}
            </span>
            {profile?.teams?.name && (
              <span style={{ background: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 600 }}>
                {profile.teams.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Accountant management (admin only) */}
      {isAdmin && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#E2E8F0', margin: 0 }}>Accountant Accounts</h2>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                Accountants can view wallet, payroll &amp; transactions — but cannot approve or disburse.
              </p>
            </div>
            <button className="pay-btn-gold" style={{ flexShrink: 0, padding: '9px 16px', fontSize: 13 }}
              onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}>
              {showForm ? '✕ Cancel' : '+ Add Accountant'}
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <form onSubmit={handleCreate} className="pay-card" style={{ padding: isMobile ? 16 : 24, marginBottom: 20, animation: 'fadeUp 0.25s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="pay-lbl">Full Name</label>
                  <input className="pay-inp" placeholder="e.g. Kwame Asante" value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div>
                  <label className="pay-lbl">Email Address</label>
                  <input className="pay-inp" type="email" inputMode="email" placeholder="accountant@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="pay-lbl">Temporary Password</label>
                <input className="pay-inp" type="password" placeholder="Min 8 characters" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ maxWidth: isMobile ? '100%' : 360 }} />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>The accountant should change this after first login.</div>
              </div>
              <button className="pay-btn-gold" type="submit" disabled={saving} style={{ width: isMobile ? '100%' : 'auto' }}>
                {saving ? 'Creating…' : 'Create Accountant'}
              </button>
            </form>
          )}

          {/* Accountant list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#475569', fontSize: 14 }}>Loading…</div>
          ) : accountants.length === 0 ? (
            <div className="pay-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8' }}>No accountants yet</div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Add an accountant above to grant read-only portal access.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accountants.map(acc => {
                const badge = acc.is_active ? BADGE.active : BADGE.inactive
                return (
                  <div key={acc.id} className="pay-card" style={{ padding: isMobile ? '14px' : '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 10 : 0 }}>
                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(100,116,139,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#94A3B8', flexShrink: 0 }}>
                        {initials(acc.full_name)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>{acc.full_name}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                      </div>
                      {/* Status badge */}
                      <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Footer row — date + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: isMobile ? 0 : 0, paddingTop: isMobile ? 10 : 0, borderTop: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none', ...(!isMobile && { display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }) }}>
                      {isMobile ? (
                        <>
                          <span style={{ fontSize: 11, color: '#475569' }}>
                            Joined {new Date(acc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="pay-btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => toggleActive(acc)}>
                              {acc.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDelete(acc)} disabled={deleting === acc.id}
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#F87171', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {deleting === acc.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>
                            {new Date(acc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button className="pay-btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => toggleActive(acc)}>
                              {acc.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDelete(acc)} disabled={deleting === acc.id}
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#F87171', padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}>
                              {deleting === acc.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Accountant read-only notice */}
      {!isAdmin && !loading && (
        <div className="pay-card" style={{ padding: isMobile ? 20 : 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px' }}>Portal Access</h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
            Your account has <strong style={{ color: '#F59E0B' }}>read-only</strong> access to the ApexPay portal.
            You can view the wallet balance, payroll runs, and transaction history for your club.
            Contact your club administrator to request additional permissions.
          </p>
        </div>
      )}
    </div>
  )
}
