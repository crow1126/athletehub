// lib/icons.jsx
// Professional SVG icon components used across the app.
// All icons render as inline SVGs — no external dependency needed.
// Usage: import { IconPin, IconUser, IconStar, ... } from '@/lib/icons'

export const IconPin = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M8 1.5C5.518 1.5 3.5 3.518 3.5 6c0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.482-2.018-4.5-4.5-4.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="8" cy="6" r="1.5" fill={color}/>
  </svg>
)

export const IconUser = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.5"/>
    <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const IconStar = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M8 1.5l1.8 3.6 4 .58-2.9 2.82.69 3.98L8 10.5l-3.59 1.98.69-3.98L2.2 5.68l4-.58L8 1.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)

export const IconPause = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill={color}/>
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill={color}/>
  </svg>
)

export const IconPlay = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M4 2.5l9 5.5-9 5.5V2.5z" fill={color} strokeLinejoin="round"/>
  </svg>
)

export const IconCamera = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M1.5 5.5a1 1 0 011-1h1.4l.7-1.5h4.8l.7 1.5h1.4a1 1 0 011 1v6a1 1 0 01-1 1h-10a1 1 0 01-1-1v-6z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    <circle cx="8" cy="8.5" r="2" stroke={color} strokeWidth="1.4"/>
  </svg>
)

export const IconUpload = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M8 2v8M5 5l3-3 3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const IconMobile = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke={color} strokeWidth="1.5"/>
    <circle cx="8" cy="12.5" r="0.75" fill={color}/>
  </svg>
)

export const IconMenu = ({ size = 18, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={style}>
    <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

export const IconClose = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={style}>
    <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

export const IconCheck = ({ size = 13, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={style}>
    <path d="M2 6.5L5 9.5L11 3.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const IconArrowRight = ({ size = 13, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={style}>
    <path d="M2 6.5h9M7 2.5l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const IconSms = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M2 2.5h12a1 1 0 011 1v7a1 1 0 01-1 1H5L2 14V3.5a1 1 0 011-1h-1z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M5 7h6M5 9.5h4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

export const IconMailOff = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M2 3.5h12a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1v-7a1 1 0 011-1z" stroke={color} strokeWidth="1.5"/>
    <path d="M1.5 4l6.5 4.5L14.5 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M3 13L13 3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

export const IconGoals = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/>
    <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.3"/>
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

export const IconAssists = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={style}>
    <path d="M3 11C3 8 5 6 8 6M8 6l-2-2M8 6l-2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="4" r="2" stroke={color} strokeWidth="1.3"/>
  </svg>
)

export const IconCelebrate = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style}>
    <path d="M2 14L7 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 7l2-4.5M7 7l4-2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="9.5" cy="2" r="1" fill={color}/>
    <circle cx="13.5" cy="5" r="1" fill={color}/>
    <circle cx="5" cy="2.5" r="0.8" fill={color}/>
    <circle cx="13" cy="10" r="0.8" fill={color}/>
  </svg>
)
