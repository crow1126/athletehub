'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import {
  ArrowLeft, FileText, User, ShieldCheck, HeartPulse, Activity,
  Calendar, Phone, Mail, MapPin, Globe, Award, Sparkles, TrendingUp,
  FileSignature, ArrowLeftRight, Clock, AlertTriangle, CheckCircle2,
  Share2, Edit3, Footprints, Ruler, Weight, Hash, CreditCard
} from 'lucide-react'

const AV_COLORS = ['#0D9488', '#059669', '#0F766E', '#14B8A6', '#047857', '#065F46']

function initials(n) {
  return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const TRANSFER_TYPE_LABELS = {
  sold: 'Sold', bought: 'Bought', free_agent: 'Free Agent',
  loan_out: 'Loan Out', loan_in: 'Loan In', return_from_loan: 'Return from Loan',
}
const TRANSFER_TYPE_COLORS = {
  sold:            { bg:'#FED7D7', color:'#742A2A' },
  bought:          { bg:'#C6F6D5', color:'#276749' },
  free_agent:      { bg:'#FEFCBF', color:'#744210' },
  loan_out:        { bg:'#BEE3F8', color:'#1A365D' },
  loan_in:         { bg:'#E9D8FD', color:'#44337A' },
  return_from_loan:{ bg:'#B2F5EA', color:'#234E52' },
}

export default function AthleteProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const [ath, setAth] = useState(null)
  const [injuries, setInjuries] = useState([])
  const [perf, setPerf] = useState([])
  const [contracts, setContracts] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [photoErr, setPhotoErr] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { teamId } = await getTenantProfile()
        const [{ data: a }, { data: i }, { data: p }, { data: c }, { data: tr }] = await Promise.all([
          scopeTeam(supabase.from('athletes').select('*, coaches(name)').eq('id', id), teamId).single(),
          scopeTeam(supabase.from('injuries').select('*').eq('athlete_id', id), teamId).order('date_of_injury', { ascending: false }),
          scopeTeam(supabase.from('performance_stats').select('*').eq('athlete_id', id), teamId).order('match_date', { ascending: false }),
          scopeTeam(supabase.from('contracts').select('*').eq('athlete_id', id), teamId).order('created_at', { ascending: false }),
          scopeTeam(supabase.from('transfers').select('*').eq('athlete_id', id), teamId).order('transfer_date', { ascending: false }),
        ])
        setAth(a)
        setInjuries(i || [])
        setPerf(p || [])
        setContracts(c || [])
        setTransfers(tr || [])
      } catch (err) {
        console.error('Error loading athlete profile:', err)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  if (loading) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--milk-muted)', borderTopColor: 'var(--plum)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </Layout>
    )
  }

  if (!ath) {
    return (
      <Layout>
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertTriangle size={32} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Athlete Record Not Found</h2>
          <p style={{ color: '#64748B', marginBottom: 20 }}>The athlete profile you requested may have been removed or does not belong to your team workspace.</p>
          <Link href="/athletes" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#0F766E', color: '#FFF', fontWeight: 700, textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Return to Squad
          </Link>
        </div>
      </Layout>
    )
  }

  // Derived statistics
  const totalGoals = perf.reduce((s, p) => s + (p.goals || 0), 0)
  const totalAssists = perf.reduce((s, p) => s + (p.assists || 0), 0)
  const totalMatches = perf.length
  const avgRating = totalMatches ? (perf.reduce((s, p) => s + parseFloat(p.rating || 0), 0) / totalMatches).toFixed(1) : '—'
  const totalXG = perf.reduce((s, p) => s + parseFloat(p.xg || 0), 0).toFixed(2)
  const totalXA = perf.reduce((s, p) => s + parseFloat(p.xa || 0), 0).toFixed(2)
  const avgPass = totalMatches ? (perf.reduce((s, p) => s + parseFloat(p.pass_accuracy || 0), 0) / totalMatches).toFixed(0) : '—'
  const activeInjuries = injuries.filter(i => i.status === 'Active')
  const activeContract = contracts.find(c => c.status === 'Active')

  const fullName = ath.name || `${ath.first_name || ''} ${ath.last_name || ''}`.trim() || 'Athlete'

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px', width: '100%', minWidth: 0, overflowX: 'hidden' }}>

        {/* ── Top Navigation Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Link href="/athletes" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0F766E', fontWeight: 700, fontSize: 13, textDecoration: 'none', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '8px 14px', borderRadius: 10, transition: 'all 0.15s' }}>
            <ArrowLeft size={16} /> Back to Squad
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`/athletes/${id}/report?print=true`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                color: '#FFFFFF',
                padding: '9px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              }}
            >
              <FileText size={15} />
              <span>Official PDF Report</span>
            </a>

            <Link
              href={`/athletes?edit=${ath.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'linear-gradient(135deg, #0F766E, #0D9488)',
                color: '#FFFFFF',
                padding: '9px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
              }}
            >
              <Edit3 size={15} />
              <span>Edit Athlete</span>
            </Link>
          </div>
        </div>

        {/* ── HERO PROFILE HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #047857 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(2, 44, 34, 0.25)',
          marginBottom: 24,
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: -80, right: -40, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52, 211, 153, 0.18) 0%, transparent 70%)' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Athlete Avatar / Photo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {ath.photo_url && !photoErr ? (
                <img
                  src={ath.photo_url}
                  alt={fullName}
                  onError={() => setPhotoErr(true)}
                  style={{ width: 100, height: 100, borderRadius: 20, objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', background: '#0F766E' }}
                />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: 20, background: 'linear-gradient(135deg, #0F766E, #14B8A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: '#FFF', border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  {initials(fullName)}
                </div>
              )}
              {ath.back_number && (
                <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#F59E0B', color: '#000', fontWeight: 900, fontSize: 13, padding: '3px 8px', borderRadius: 8, border: '2px solid #FFF', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  #{ath.back_number}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 6, backdropFilter: 'blur(6px)' }}>
                  {ath.position || 'Player'}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: (ath.status || '').toLowerCase() === 'injured' ? '#EF4444' : '#10B981',
                  color: '#FFFFFF',
                }}>
                  ● {ath.status || 'Active'}
                </span>
                {ath.nationality && (
                  <span style={{ fontSize: 12, color: '#A7F3D0', fontWeight: 600 }}>
                    {ath.nationality}
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
                {fullName}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: '#D1FAE5', fontSize: 13, flexWrap: 'wrap' }}>
                {ath.age && <span><strong>{ath.age}</strong> yrs old</span>}
                {ath.height && <span><strong>{ath.height}</strong> cm</span>}
                {ath.weight && <span><strong>{ath.weight}</strong> kg</span>}
                {ath.strong_foot && <span>Foot: <strong>{ath.strong_foot}</strong></span>}
                {ath.club && <span>Club: <strong>{ath.club}</strong></span>}
              </div>
            </div>

            {/* KPI Stat Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, width: '100%', maxWidth: 440, marginTop: 12 }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#34D399' }}>{totalMatches}</div>
                <div style={{ fontSize: 10, color: '#A7F3D0', fontWeight: 700, textTransform: 'uppercase' }}>Matches</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FCD34D' }}>{totalGoals}</div>
                <div style={{ fontSize: 10, color: '#A7F3D0', fontWeight: 700, textTransform: 'uppercase' }}>Goals</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#60A5FA' }}>{totalAssists}</div>
                <div style={{ fontSize: 10, color: '#A7F3D0', fontWeight: 700, textTransform: 'uppercase' }}>Assists</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#F472B6' }}>{avgRating}</div>
                <div style={{ fontSize: 10, color: '#A7F3D0', fontWeight: 700, textTransform: 'uppercase' }}>Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Medical Alert (if injured) ── */}
        {activeInjuries.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HeartPulse size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#991B1B', marginBottom: 2 }}>
                Active Injury Alert — {activeInjuries[0].injury_type || 'Under Treatment'}
              </div>
              <div style={{ fontSize: 12, color: '#B91C1C' }}>
                Diagnosis Date: {activeInjuries[0].date_of_injury || 'Recent'} · Severity: <strong>{activeInjuries[0].severity || 'Moderate'}</strong> · Expected Return: <strong>{activeInjuries[0].expected_return || 'TBD'}</strong>
              </div>
            </div>
            <Link href="/injuries" style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: '#FFFFFF', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
              View Medical Room →
            </Link>
          </div>
        )}

        {/* ── NAVIGATION TABS ── */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 24, overflowX: 'auto' }}>
          {[
            { id: 'overview', label: 'Overview & Bio', icon: <User size={15} /> },
            { id: 'performance', label: `Performance (${perf.length})`, icon: <Activity size={15} /> },
            { id: 'medical', label: `Medical History (${injuries.length})`, icon: <HeartPulse size={15} /> },
            { id: 'contracts', label: `Contracts & Transfers (${contracts.length + transfers.length})`, icon: <FileSignature size={15} /> },
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: isActive ? '#0F766E' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── TAB 1: OVERVIEW & BIO ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Personal Details */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} color="#0F766E" /> Personal Profile
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>FULL NAME</span><strong>{fullName}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>DATE OF BIRTH</span><strong>{ath.date_of_birth || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>PLACE OF BIRTH</span><strong>{ath.place_of_birth || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>NATIONALITY</span><strong>{ath.nationality || 'Ghana'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>REGION</span><strong>{ath.region || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>MEMBERSHIP NO.</span><strong>{ath.membership_number || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>PASSPORT NO.</span><strong>{ath.passport_number || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>ASSIGNED COACH</span><strong>{ath.coaches?.name || '—'}</strong></div>
              </div>
            </div>

            {/* Physical & Gear */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ruler size={18} color="#0F766E" /> Physical &amp; Equipment
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>HEIGHT</span><strong>{ath.height ? `${ath.height} cm` : '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>WEIGHT</span><strong>{ath.weight ? `${ath.weight} kg` : '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>STRONG FOOT</span><strong>{ath.strong_foot || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>SHOE SIZE</span><strong>{ath.shoe_size || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>CLOTHING SIZE</span><strong>{ath.clothing_size || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>WRIST MEASURE</span><strong>{ath.wrist_measurement || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>JERSEY NUMBER</span><strong>{ath.back_number ? `#${ath.back_number}` : '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>NUMBER LETTERING</span><strong>{ath.number_lettering || '—'}</strong></div>
              </div>
            </div>

            {/* Contact & Socials */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22, gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={18} color="#0F766E" /> Contact &amp; Channels
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 13 }}>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>MOBILE PHONE</span><strong>{ath.phone || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>EMAIL ADDRESS</span><strong>{ath.email || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>LANDLINE</span><strong>{ath.landline || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>ADDRESS / COUNTRY</span><strong>{ath.address ? `${ath.address}, ${ath.country || ''}` : '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>INSTAGRAM</span><strong>{ath.instagram || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>FACEBOOK</span><strong>{ath.facebook || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>HOMEPAGE</span><strong>{ath.homepage || '—'}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PERFORMANCE ── */}
        {activeTab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Stats Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[
                { label: 'Total Matches', val: totalMatches, color: '#0F766E' },
                { label: 'Total Goals', val: totalGoals, color: '#10B981' },
                { label: 'Total Assists', val: totalAssists, color: '#3B82F6' },
                { label: 'Avg Rating', val: avgRating, color: '#8B5CF6' },
                { label: 'Total xG', val: totalXG, color: '#F59E0B' },
                { label: 'Total xA', val: totalXA, color: '#EC4899' },
                { label: 'Pass Accuracy', val: `${avgPass}%`, color: '#06B6D4' },
              ].map(s => (
                <div key={s.label} className="card" style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Match Log Table */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Match-by-Match Logs</h3>
                <Link href="/performance" style={{ fontSize: 12, fontWeight: 700, color: '#0F766E', textDecoration: 'none' }}>+ Add Performance Record</Link>
              </div>

              {perf.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  No match performance stats recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>DATE</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>OPPONENT</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>MINS</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>GOALS</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>ASSISTS</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>xG / xA</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>PASS %</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>RATING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.match_date || '—'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>{p.opponent || 'Match'}</td>
                          <td style={{ padding: '12px 16px' }}>{p.minutes_played || 0}&apos;</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#10B981' }}>{p.goals || 0}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#3B82F6' }}>{p.assists || 0}</td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>{p.xg || 0} / {p.xa || 0}</td>
                          <td style={{ padding: '12px 16px' }}>{p.pass_accuracy ? `${p.pass_accuracy}%` : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 800, background: parseFloat(p.rating || 0) >= 7.5 ? '#ECFDF5' : '#F1F5F9', color: parseFloat(p.rating || 0) >= 7.5 ? '#059669' : '#0F172A', padding: '3px 8px', borderRadius: 6 }}>
                              {p.rating || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: MEDICAL HISTORY ── */}
        {activeTab === 'medical' && (
          <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Injury &amp; Medical Log</h3>
              <Link href="/injuries" style={{ fontSize: 12, fontWeight: 700, color: '#0F766E', textDecoration: 'none' }}>+ Log Medical Record</Link>
            </div>

            {injuries.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px' }} />
                <div>Clean medical record — no injuries recorded.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>DIAGNOSIS DATE</th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>INJURY TYPE</th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>BODY PART</th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>SEVERITY</th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>STATUS</th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#64748B' }}>EXPECTED RETURN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {injuries.map(inj => (
                      <tr key={inj.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inj.date_of_injury || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>{inj.injury_type || 'Injury'}</td>
                        <td style={{ padding: '12px 16px' }}>{inj.body_part || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><Badge status={inj.severity} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: inj.status === 'Active' ? '#FEE2E2' : '#DCFCE7', color: inj.status === 'Active' ? '#DC2626' : '#16A34A' }}>
                            {inj.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748B' }}>{inj.expected_return || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: CONTRACTS & TRANSFERS ── */}
        {activeTab === 'contracts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Active Contract Card */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileSignature size={18} color="#0F766E" /> Active Contract Information
                </h3>
                <Link href="/contracts" style={{ fontSize: 12, fontWeight: 700, color: '#0F766E', textDecoration: 'none' }}>+ Manage Contracts</Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 13 }}>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>IN CLUB SINCE</span><strong>{ath.in_club_since || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>CONTRACT UNTIL</span><strong style={{ color: '#0F766E' }}>{ath.contract_until || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>OPTION UNTIL</span><strong>{ath.contract_option_until || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>LAST CLUB</span><strong>{ath.last_club || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>IBAN</span><strong>{ath.iban || '—'}</strong></div>
                <div><span style={{ color: '#94A3B8', fontSize: 11, display: 'block', fontWeight: 700 }}>TAX ID</span><strong>{ath.tax_id || '—'}</strong></div>
              </div>
            </div>

            {/* Transfer Timeline */}
            <div className="card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowLeftRight size={18} color="#0F766E" /> Transfer Timeline
              </h3>

              {transfers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '20px 0' }}>
                  No transfer records logged.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {transfers.map(t => {
                    const style = TRANSFER_TYPE_COLORS[t.transfer_type] || { bg: '#F1F5F9', color: '#334155' }
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t.club_from || 'Club'} → {t.club_to || 'Club'}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{t.transfer_date || 'Date'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: style.bg, color: style.color }}>
                            {TRANSFER_TYPE_LABELS[t.transfer_type] || t.transfer_type}
                          </span>
                          {t.fee_ghs ? <div style={{ fontSize: 12, fontWeight: 700, color: '#0F766E', marginTop: 3 }}>GHS {Number(t.fee_ghs).toLocaleString()}</div> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
