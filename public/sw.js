// public/sw.js
// Minimal PWA service worker for ApexTrack GH

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Simple pass-through fetch handler — no offline caching yet
  return
})
