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
    } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
 * Helper to convert base64 URL VAPID key to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribes the current device to push notifications.
 * Seamlessly handles:
 * 1. Capacitor Native Android / iOS (via FCM)
 * 2. iPhone PWA (iOS 16.4+ Web Push via APNs)
 * 3. Desktop / Android Web Browsers (Web Push)
 */
export async function subscribeToPushNotifications() {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' }

  // 1. Capacitor Native App (Android / iOS)
  const isCapacitor = window.Capacitor?.isNativePlatform?.()
  if (isCapacitor) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }

      if (permStatus.receive === 'granted') {
        await PushNotifications.register()

        // Listen for token
        PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fcm_token: token.value, platform: 'android' }),
            })
          } catch (e) {
            console.warn('[Push] Failed to register FCM token with server:', e)
          }
        })

        PushNotifications.addListener('pushNotificationReceived', (_notification) => {
          playNotificationSound()
          triggerHapticFeedback('notification').catch(() => {})
        })

        return { ok: true, platform: 'capacitor' }
      } else {
        return { ok: false, reason: 'permission_denied' }
      }
    } catch (capErr) {
      console.warn('[Push] Capacitor registration error:', capErr)
    }
  }

  // 2. Web Push (iPhone PWA / Chrome / Edge / Firefox)
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        return { ok: false, reason: 'missing_vapid_key' }
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' }
      }

      const reg = await navigator.serviceWorker.ready
      let subscription = await reg.pushManager.getSubscription()

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey)
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            platform: /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios_pwa' : 'web',
          }),
        })
        return { ok: true, platform: 'web_push' }
      }
    } catch (pwaErr) {
      console.warn('[Push] Web push registration error:', pwaErr)
      return { ok: false, error: pwaErr.message }
    }
  }

  return { ok: false, reason: 'unsupported' }
}

/**
 * Requests browser/system notification permission and auto-subscribes to push
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  try {
    let perm = Notification.permission
    if (perm !== 'granted' && perm !== 'denied') {
      perm = await Notification.requestPermission()
    }

    if (perm === 'granted') {
      // Automatically register Web Push / Native FCM in background
      subscribeToPushNotifications().catch(() => {})
    }

    return perm
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
  icon = '/icons/icon-192.png',
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
        icon: icon || '/icons/icon-192.png',
      })
      return
    } catch {
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
            icon: icon || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
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
        icon: icon || '/icons/icon-192.png',
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
