'use client'
import { useState } from 'react'

export default function StatCard({ label, value, note, icon, accent, trend, href }) {
  const [hovered, setHovered] = useState(false)
  const ac = accent || '#008080'

  const inner = (
    <div
      className="fade-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 18px 16px',
        borderRadius: 18,
        background: hovered
          ? `linear-gradient(145deg, #ffffff 0%, ${ac}1a 60%, ${ac}0f 100%)`
          : `linear-gradient(145deg, #f9fafa 0%, ${ac}12 60%, ${ac}08 100%)`,
        border: `1px solid ${hovered ? ac + '40' : ac + '22'}`,
        boxShadow: hovered
          ? `0 8px 28px ${ac}22, 0 2px 8px rgba(0,0,0,0.06)`
          : `0 2px 10px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)`,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.22s ease',
        cursor: href ? 'pointer' : 'default',
        fontFamily: 'var(--font)',
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position: 'absolute',
        top: -24, right: -24,
        width: 80, height: 80,
        borderRadius: '50%',
        background: `${ac}18`,
        pointerEvents: 'none',
      }} />

      {/* Icon + trend row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
        <div style={{
          width: 42, height: 42,
          borderRadius: '50%',
          background: `${ac}18`,
          border: `1.5px solid ${ac}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19,
          boxShadow: `0 2px 8px ${ac}18`,
        }}>
          {icon}
        </div>

        {trend && (
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: trend.startsWith('+') ? '#0a7a35' : '#c0392b',
            background: trend.startsWith('+') ? 'rgba(10,122,53,0.1)' : 'rgba(192,57,43,0.1)',
            border: `1px solid ${trend.startsWith('+') ? 'rgba(10,122,53,0.2)' : 'rgba(192,57,43,0.2)'}`,
            padding: '3px 8px', borderRadius: 20,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            {trend.startsWith('+') ? '↑' : '↓'} {trend}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 32, fontWeight: 900,
        color: '#06160E',
        lineHeight: 1, marginBottom: 4,
        letterSpacing: '-0.03em',
        position: 'relative',
      }}>
        {value}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 13, color: '#1A3D2D',
        fontWeight: 700,
        marginBottom: note ? 8 : 0,
        position: 'relative',
      }}>
        {label}
      </div>

      {/* Note pill */}
      {note && (
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 11, fontWeight: 800,
          color: '#046A4E',
          background: '#D1FAE5',
          border: '1px solid #A7F3D0',
          padding: '2px 9px', borderRadius: 20,
          position: 'relative',
        }}>
          {note}
        </div>
      )}



      {/* Bottom accent bar on hover */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${ac}70, ${ac}15)`,
        borderRadius: '0 0 18px 18px',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.22s ease',
      }} />
    </div>
  )

  if (href) return <a href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>
  return inner
}