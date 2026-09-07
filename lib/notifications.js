// lib/notifications.js
// Universal notification system supporting Web Audio chimes, Capacitor Native Haptics,
// OS native push (PWA & Service Worker), and Electron desktop alerts
import { supabase } from '@/lib/supabase'

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

let localNotifChannelCreated = false

/**
 * Ensures Android 8.0+ notification channel is initialized for high-importance alerts
 */
async function ensureAndroidNotificationChannel() {
  if (typeof window === 'undefined' || localNotifChannelCreated) return
  if (!window.Capacitor?.isNativePlatform?.()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: 'apextrack_alerts',
      name: 'ApexTrack Alerts',
      description: 'Important matchday call-ups, team notices, and urgent club updates',
      importance: 5, // High priority (pops up as heads-up notification)
      visibility: 1, // Public on lockscreen
      vibration: true,
      lights: true,
      lightColor: '#0D9488',
    })
    localNotifChannelCreated = true

    // Listen for notification tap / click to navigate
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const targetUrl = notificationAction.notification?.extra?.url || '/notices'
      if (targetUrl && typeof window !== 'undefined') {
        window.location.href = targetUrl
      }
    })
  } catch (err) {
    console.warn('[LocalNotifications] Channel creation warning:', err?.message || err)
  }
}

/**
 * Subscribes the current device to push and local notifications.
 * Seamlessly handles:
 * 1. Capacitor Native Android / iOS (via LocalNotifications + FCM Push)
 * 2. iPhone PWA (iOS 16.4+ Web Push via APNs)
 * 3. Desktop / Android Web Browsers (Web Push)
 */
export async function subscribeToPushNotifications() {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' }

  // Get current authenticated user session
  let authHeaders = { 'Content-Type': 'application/json' }
  let currentUserId = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session
    if (session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${session.access_token}`
      currentUserId = session.user?.id
    }
  } catch (authErr) {
    console.warn('[Push] Session check warning:', authErr?.message || authErr)
  }

  // 1. Capacitor Native App (Android / iOS)
  const isCapacitor = window.Capacitor?.isNativePlatform?.()
  if (isCapacitor) {
    let localGranted = false
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      let localPerm = await LocalNotifications.checkPermissions()
      if (localPerm.display === 'prompt' || localPerm.display === 'prompt-with-rationale') {
        localPerm = await LocalNotifications.requestPermissions()
      }
      localGranted = localPerm.display === 'granted'
      await ensureAndroidNotificationChannel()
    } catch (e) {
      console.warn('[Push] LocalNotifications setup warning:', e)
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }

      if (permStatus.receive === 'granted' || localGranted) {
        await PushNotifications.register().catch(() => {})

        // Listen for token
        PushNotifications.addListener('registration', async (token) => {
          try {
            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                fcm_token: token.value,
                platform: 'android',
                user_id: currentUserId,
              }),
            })
            const d = await res.json().catch(() => ({}))
            console.log('[Push] Android FCM token registered with server:', d)
          } catch (e) {
            console.warn('[Push] Failed to register FCM token with server:', e)
          }
        })

        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          playNotificationSound()
          triggerHapticFeedback('notification').catch(() => {})

          // Display heads-up banner on Android using LocalNotifications
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications')
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: notification.title || 'ApexTrack Alert',
                  body: notification.body || '',
                  id: Math.floor(Math.random() * 1000000) + 1,
                  schedule: { at: new Date(Date.now() + 100) },
                  channelId: 'apextrack_alerts',
                  extra: { url: notification.data?.url || '/notices' },
                },
              ],
            })
          } catch (err) {
            console.warn('[Push] Local notification schedule error:', err)
          }
        })

        return { ok: true, platform: 'capacitor' }
      }
    } catch (capErr) {
      console.warn('[Push] Capacitor push registration warning:', capErr)
    }

    return { ok: localGranted, platform: 'capacitor_local' }
  }

  // 2. Web Push (iPhone PWA / Chrome / Edge / Firefox)
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        return { ok: false, reason: 'missing_vapid_key' }
      }

      let permission = Notification.permission
      if (permission !== 'granted') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' }
      }

      // Ensure SW is ready
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js')
      }
      await navigator.serviceWorker.ready

      let subscription = await reg.pushManager.getSubscription()

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey)
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      if (subscription) {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
        const isAndroid = /android/i.test(navigator.userAgent)
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            platform: isIos ? 'ios_pwa' : (isAndroid ? 'android_web' : 'web'),
            user_id: currentUserId,
          }),
        })
        const resData = await res.json().catch(() => ({}))
        console.log('[Push] Web push registered successfully:', resData)
        return { ok: res.ok && resData.ok !== false, platform: 'web_push' }
      }
    } catch (pwaErr) {
      console.warn('[Push] Web push registration error:', pwaErr)
      return { ok: false, error: pwaErr.message }
    }
  }

  return { ok: false, reason: 'unsupported' }
}

/**
 * Sends an immediate test alert to this device (in-app chime + banner + server push dispatch)
 */
export async function sendTestNotificationToSelf() {
  try {
    // 1. Play local chime and trigger banner
    await triggerNotificationAlert({
      title: 'ApexTrack Test Alert',
      body: 'Your device is configured and receiving instant team notifications!',
      url: '/notices',
      playSound: true,
      haptic: true,
    })

    // 2. Dispatch push from server to test Web Push / OS notification tray
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: {} }))
    const session = sessionData?.session
    if (session?.user?.id) {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          user_id: session.user.id,
          title: 'ApexTrack Push Test',
          body: 'Success! Push notifications are working on this device.',
          url: '/notices',
          tag: `test-${Date.now()}`,
        }),
      })
    }
    return { ok: true }
  } catch (err) {
    console.warn('[sendTestNotificationToSelf] error:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Requests browser/system notification permission and auto-subscribes to push
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported'

  // Handle Capacitor native Android / iOS
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const res = await subscribeToPushNotifications()
      return res.ok ? 'granted' : 'denied'
    } catch (err) {
      console.warn('[Notification] Capacitor permission request error:', err)
      return 'denied'
    }
  }

  if (!('Notification' in window)) {
    return 'unsupported'
  }

  try {
    let perm = Notification.permission
    if (perm !== 'granted' && perm !== 'denied') {
      perm = await Notification.requestPermission()
    }

    if (perm === 'granted') {
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

  // 2. Native Android / iOS via Capacitor LocalNotifications
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      await ensureAndroidNotificationChannel()
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title || 'ApexTrack Alert',
            body: displayMessage,
            id: Math.floor(Math.random() * 1000000) + 1,
            schedule: { at: new Date(Date.now() + 100) },
            channelId: 'apextrack_alerts',
            extra: { url: url || '/notices' },
          },
        ],
      })
      return
    } catch (localErr) {
      console.warn('[Notification] Capacitor local notification error:', localErr)
    }
  }

  // 3. If running inside Electron desktop app, invoke native desktop notification
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

  // 4. If running in Web browser or Mobile PWA
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Prefer Service Worker showNotification if active (works on iPhone PWA & Android Chrome)
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
