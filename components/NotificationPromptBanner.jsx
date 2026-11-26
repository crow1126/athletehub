'use client'
import { useState, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { requestNotificationPermission, sendTestNotificationToSelf } from '@/lib/notifications'

export default function NotificationPromptBanner() {
  const [mounted, setMounted] = useState(false)
  const [permission, setPermission] = useState('default')
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    // Check if dismissed permanently / across refreshes
    try {
      if (localStorage.getItem('apextrack_notif_banner_dismissed') === 'true') {
        setDismissed(true)
        return
      }
    } catch {}

    if (window.Capacitor?.isNativePlatform?.()) {
      setDismissed(true)
      return
    }

    if ('Notification' in window) {
      setPermission(Notification.permission)
    } else {
      setPermission('unsupported')
    }
  }, [])

  if (!mounted || dismissed || permission === 'granted' || permission === 'unsupported') {
    return null
  }

  async function handleEnable() {
    setLoading(true)
    try {
      const res = await requestNotificationPermission()
      setPermission(res)
      if (res === 'granted') {
        setSuccess(true)
        // Play audio & send test confirmation alert
        setTimeout(() => {
          sendTestNotificationToSelf().catch(() => {})
        }, 300)
        setTimeout(() => {
          setDismissed(true)
        }, 2500)
      } else if (res === 'denied') {
        alert('Notifications are blocked by your browser. Please tap the lock or site settings icon in the address bar and set Notifications to "Allow".')
      }
    } catch (e) {
      console.warn('[NotificationBanner] enable error:', e)
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem('apextrack_notif_banner_dismissed', 'true')
    } catch {}
  }

  if (success) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          background: '#059669',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(5, 150, 105, 0.28)',
          maxWidth: 310,
        }}
      >
        <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0 }} />
        <span>Push alerts enabled!</span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: '#FFFFFF',
        color: '#0F172A',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
        maxWidth: 310,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: '#F0FDFA',
          border: '1px solid #CCFBF1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0D9488',
          flexShrink: 0,
        }}
      >
        <Bell size={15} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12, lineHeight: 1.25 }}>
          Enable push alerts
        </div>
        <div style={{ color: '#64748B', fontSize: 11, lineHeight: 1.25 }}>
          Get match &amp; schedule notices
        </div>
      </div>

      <button
        onClick={handleEnable}
        disabled={loading}
        style={{
          background: '#0D9488',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        {loading ? '...' : 'Enable'}
      </button>

      <button
        onClick={handleDismiss}
        title="Dismiss"
        aria-label="Dismiss notification prompt"
        style={{
          background: 'transparent',
          color: '#94A3B8',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
