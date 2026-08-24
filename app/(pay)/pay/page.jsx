'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Wallet, Sparkles, ShieldCheck, ArrowRight, ArrowLeft, Clock } from 'lucide-react'

export default function PayPage() {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('profiles').select('role, full_name, team_id').eq('id', session.user.id).single()
      if (data) setProfile(data)
    }
    load()
  }, [])

  const homeHref = profile?.role === 'player'
    ? '/player-hub'
    : (profile?.role === 'superadmin' ? '/superadmin' : '/dashboard')

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      <div style={{
        maxWidth: 620,
        width: '100%',
        background: '#FFFFFF',
        border: '1px solid #82C29A',
        borderRadius: 24,
        padding: '48px 36px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(11,122,112,0.08)',
      }}>
        {/* Icon & Badge */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #E2F5E9 0%, #CCFBF1 100%)',
          border: '1px solid #82C29A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#0B7A70',
        }}>
          <Wallet size={36} strokeWidth={2.2} />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#FEF3C7',
          border: '1px solid #FDE68A',
          color: '#92400E',
          padding: '6px 14px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          <Clock size={14} />
          Coming Soon
        </div>

        <h1 style={{
          fontSize: 26,
          fontWeight: 900,
          color: '#0B1E14',
          letterSpacing: '-0.03em',
          marginBottom: 12,
          lineHeight: 1.2,
        }}>
          ApexPay Financial Disbursements
        </h1>

        <p style={{
          fontSize: 14,
          color: '#243E30',
          lineHeight: 1.6,
          marginBottom: 32,
          maxWidth: 480,
          margin: '0 auto 32px',
        }}>
          Automated Mobile Money player payouts, coach allowance disbursements, and direct team wallet top-ups are undergoing final compliance testing and will launch soon.
        </p>

        {/* Feature Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          textAlign: 'left',
          marginBottom: 36,
        }}>
          <div style={{ background: '#F0FBF4', border: '1px solid #E2F5E9', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0B7A70', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
              <Sparkles size={16} /> Instant MoMo Payouts
            </div>
            <div style={{ fontSize: 11, color: '#243E30', lineHeight: 1.4 }}>Direct match bonus and allowance payouts to MTN &amp; Telecel wallets.</div>
          </div>

          <div style={{ background: '#F0FBF4', border: '1px solid #E2F5E9', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0B7A70', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
              <ShieldCheck size={16} /> Bank-Grade Audit Trail
            </div>
            <div style={{ fontSize: 11, color: '#243E30', lineHeight: 1.4 }}>Full cryptographic reconciliation &amp; verified disbursements.</div>
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={homeHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#0B7A70',
            color: '#FFFFFF',
            padding: '12px 28px',
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(11,122,112,0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          Return to {profile?.role === 'player' ? 'Player Hub' : (profile?.role === 'superadmin' ? 'Superadmin' : 'Dashboard')}
        </Link>
      </div>
    </div>
  )
}
