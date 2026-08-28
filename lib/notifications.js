// lib/notifications.js
// Universal notification system supporting Web Audio chimes, Capacitor Native Haptics,
// OS native push (PWA & Service Worker), and Electron desktop alerts

let audioCtx = null
let audioUnlocked = false

/**
 * Automatically unlocks Web Audio on first user interaction (tap/click/keydown).
 * Required by modern browsers to allow chime audio to play during background/realtime events.
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined' || audioUnlocked) return

  const unlock = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return

      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext()
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          audioUnlocked = true
        }).catch(() => {})
      } else {
        audioUnlocked = true
      }
    } catch (_e) {
      // Ignore initialisation errors
    } finally {
      // Clean up event listeners after first trigger
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }

  window.addEventListener('pointerdown', unlock, { passive: true, once: true })
  window.addEventListener('touchstart', unlock, { passive: true, once: true })
  window.addEventListener('click', unlock, { passive: true, once: true })
  window.addEventListener('keydown', unlock, { passive: true, once: true })
}

/**
 * Triggers native haptic vibration.
 * Supports Capacitor native iOS/Android (Taptic Engine), Web Vibration API, and falls back gracefully.
 */
export async function triggerHapticFeedback(type = 'notification') {
  if (typeof window === 'undefined') return

  // 1. Try Capacitor Native Haptics (iOS Taptic Engine & Android Native Vibrator)
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics').catch(() => ({}))
    if (Haptics) {
      if (type === 'impact') {
        await Haptics.impact({ style: ImpactStyle?.Medium || 'MEDIUM' })
      } else if (type === 'heavy') {
        await Haptics.impact({ style: ImpactStyle?.Heavy || 'HEAVY' })
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType?.Warning || 'WARNING' })
      } else {
        await Haptics.notification({ type: NotificationType?.Success || 'SUCCESS' })
      }
      return
    }
  } catch (_capErr) {
    // Fall back to web API
  }

  // 2. Try window.Capacitor bridge directly
  try {
    if (window.Capacitor?.Plugins?.Haptics) {
      const h = window.Capacitor.Plugins.Haptics
      if (type === 'impact') {
        await h.impact({ style: 'MEDIUM' })
      } else {
        await h.notification({ type: 'SUCCESS' })
      }
      return
    }
  } catch (_bridgeErr) {
    // Fall back to web vibrate
  }

  // 3. Web Vibration API (Android Chrome, Firefox, PWA)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'impact') {
        navigator.vibrate(50)
      } else if (type === 'heavy') {
        navigator.vibrate(150)
      } else {
        navigator.vibrate([100, 60, 140])
      }
    }
  } catch (_vibErr) {
    // Vibration not supported or blocked
  }
}

/**
 * Plays a pleasant, modern multi-tone notification chime using Web Audio API
 * Works across iOS Safari (PWA), Android, Chrome, Edge, and Electron Desktop without external asset dependencies.
 */
export function playNotificationSound() {
  try {
    if (typeof window === 'undefined') return

    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext()
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    const now = audioCtx.currentTime

    // Tone 1 (High bell note - 880Hz / A5)
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.28, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Tone 2 (Harmonic shimmer - 1174.66Hz / D6)
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1174.66, now + 0.08)
    gain2.gain.setValueAtTime(0.22, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.55)

    // Tone 3 (Warm resolution note - 1318.51Hz / E6)
    const osc3 = audioCtx.createOscillator()
    const gain3 = audioCtx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1318.51, now + 0.16)
    gain3.gain.setValueAtTime(0.25, now + 0.16)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc3.connect(gain3)
    gain3.connect(audioCtx.destination)
    osc3.start(now + 0.16)
    osc3.stop(now + 0.7)

    // Trigger haptic vibration on mobile
    triggerHapticFeedback('notification').catch(() => {})
  } catch (err) {
    console.warn('[Notification] Could not play notification audio:', err?.message || err)
  }
}

/**
 * Requests browser/system notification permission
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  try {
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission()
      return perm
    }
    return Notification.permission
  } catch (err) {
    console.warn('[Notification] Error requesting permission:', err)
    return 'denied'
  }
}

/**
 * Displays a native push/system banner and plays chime + haptics
 */
export async function triggerNotificationAlert({
  title = 'ApexTrack Alert',
  message = '',
  body = '',
  url = '/notices',
  icon = '/icon.png',
  playSound = true,
  haptic = true,
}) {
  if (typeof window === 'undefined') return

  const displayMessage = message || body || ''

  // 1. Play audible sound chime (which also triggers haptics)
  if (playSound) {
    playNotificationSound()
  } else if (haptic) {
    triggerHapticFeedback('notification').catch(() => {})
  }

  // 2. If running inside Electron desktop app, invoke native desktop notification
  if (window.electronAPI?.showNativeNotification) {
    try {
      window.electronAPI.showNativeNotification({
        title,
        body: displayMessage,
        icon: icon || '/icon.png',
      })
      return
    } catch (_e) {
      // Fall back to Web Notification
    }
  }

  // 3. If running in Web browser or Mobile PWA
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Prefer Service Worker showNotification if active (works on mobile background & PWA)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, {
            body: displayMessage,
            icon: icon || '/icon.png',
            badge: '/icon.png',
            data: { url: url || '/notices' },
            tag: `apextrack-${Date.now()}`,
            renotify: true,
            vibrate: [100, 50, 150],
          })
          return
        }
      }

      // Standard desktop browser notification fallback
      const notif = new Notification(title, {
        body: displayMessage,
        icon: icon || '/icon.png',
      })
      notif.onclick = () => {
        window.focus()
        if (url) window.location.href = url
        notif.close()
      }
    } catch (err) {
      console.warn('[Notification] Native push banner failed:', err)
    }
  }
}
