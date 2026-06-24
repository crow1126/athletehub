'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[Error Boundary]', error)
  }, [error])

  return (
    <div style={containerStyle}>
      <div style={cardStyle} className="fade-up">
        <div style={iconContainerStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={titleStyle}>System Error</h1>
        <p style={descriptionStyle}>
          An unexpected error occurred while processing your request. The security log has captured this event.
        </p>
        <div style={buttonContainerStyle}>
          <button style={btnStyle} onClick={() => reset()}>
            Try Again
          </button>
          <a href="/dashboard" style={btnOutlineStyle}>
            Return Home
          </a>
        </div>
      </div>
    </div>
  )
}

const containerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '24px',
  background: 'linear-gradient(135deg, #C8EDCE 0%, #E4F7E8 30%, #F0FBF4 60%, #FFFFFF 100%)',
  fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
}

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #D4EDDE',
  borderRadius: '16px',
  padding: '40px 32px',
  maxWidth: '480px',
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 10px 25px -5px rgba(13, 100, 60, 0.1)',
  backdropFilter: 'blur(8px)',
}

const iconContainerStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#FFE4E6',
  color: '#E11D48',
  marginBottom: '24px',
}

const iconStyle = {
  width: '32px',
  height: '32px',
}

const titleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0F2218',
  marginBottom: '12px',
}

const descriptionStyle = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#5A7A68',
  marginBottom: '32px',
}

const buttonContainerStyle = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'center',
}

const btnStyle = {
  backgroundColor: '#0D9488',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '12px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
}

const btnOutlineStyle = {
  textDecoration: 'none',
  backgroundColor: 'transparent',
  color: '#1E4433',
  border: '1px solid #D4EDDE',
  borderRadius: '12px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
}
