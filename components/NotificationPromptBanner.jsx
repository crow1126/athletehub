'use client'
import { useState, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { requestNotificationPermission, sendTestNotificationToSelf } from '@/lib/notifications'

export default function NotificationPromptBanner() {
  const [permission, setPermission] = useState('granted') // default to granted so no flash
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if dismissed in this session
    if (sessionStorage.getItem('apextrack_notif_banner_dismissed') === 'true') {
      setDismissed(true)
      return
    }

    if (window.Capacitor?.isNativePlatform?.()) {
      // In native app, permissions are handled natively
      return
    }

    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  if (dismissed || permission === 'granted' || permission === 'unsupported') {
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
      sessionStorage.setItem('apextrack_notif_banner_dismissed', 'true')
    } catch {}
  }

  if (success) {
    return (
      <div
        style={{
          background: 'linear-gradient(90deg, #059669 0%, #10B981 100%)',
          color: '#FFFFFF',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <Check size={18} strokeWidth={2.5} />
        <span>Push notifications enabled! You will now receive instant team alerts on your lock screen.</span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 100%)',
        color: '#F8FAFC',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 12,
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240, flex: 1 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(13, 148, 136, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2DD4BF',
            flexShrink: 0,
          }}
        >
          <Bell size={16} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 12 }}>
            Enable Device Notifications
          </div>
          <div style={{ color: '#94A3B8', fontSize: 11, lineHeight: 1.3 }}>
            Receive matchday call-ups, training schedules, and urgent notices directly on this device.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 7,
            padding: '6px 14px',
            fontSize: 11,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 6px rgba(13, 148, 136, 0.4)',
            fontFamily: 'inherit',
          }}
        >
          <Bell size={13} />
          {loading ? 'Enabling...' : 'Enable Push Alerts'}
        </button>
        <button
          onClick={handleDismiss}
          title="Dismiss for this session"
          style={{
            background: 'transparent',
            color: '#64748B',
            border: 'none',
            padding: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
