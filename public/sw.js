// public/sw.js
// Service worker for ApexTrack PWA with Push Notification and Click handling

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
    })
  )
})

// Handle user clicking on a push notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (client.url.includes(targetUrl) || targetUrl === '/dashboard') {
            return client.focus()
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// Handle background push messages
self.addEventListener('push', (event) => {
  let data = { title: 'ApexTrack Alert', body: 'You have a new team notification.', url: '/dashboard' }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch (_e) {
    if (event.data) data.body = event.data.text()
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/dashboard' },
    tag: data.tag || `apextrack-${Date.now()}`,
    renotify: true,
    vibrate: [100, 50, 150],
  }

  event.waitUntil(self.registration.showNotification(data.title || 'ApexTrack Alert', options))
})
