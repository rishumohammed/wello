// frontend/public/sw.js
// Wello Service Worker V1.0 (PWA App Shell, Offline Cache, Web Push, and Background Sync)

const CACHE_VERSION = 'wello-v1.0.0'
const STATIC_CACHE = `wello-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `wello-runtime-${CACHE_VERSION}`
const API_CACHE = `wello-api-${CACHE_VERSION}`

// Precache essential App Shell assets
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/icon.svg',
]

// ── Install Event ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).then(() => {
        return self.skipWaiting()
      })
    })
  )
})

// ── Activate Event ──────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  )
})

// ── Fetch Event ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // 1. Skip non-GET requests (mutations go through outbox)
  if (req.method !== 'GET') {
    return
  }

  // 2. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return
  }

  // 3. API Requests: Network-First with Cache Fallback for offline reads
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(req, resClone)
            })
          }
          return networkRes
        })
        .catch(() => {
          // Serve from API cache if offline
          return caches.match(req).then((cached) => {
            if (cached) return cached
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                message: 'You are currently offline. Working from local cache.',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          })
        })
    )
    return
  }

  // 4. Static Assets (_nuxt, fonts, images, css): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_nuxt/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(req, resClone)
            })
          }
          return networkRes
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // 5. HTML Page Navigations: Network-First with SPA App Shell Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone()
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(req, resClone)
            })
          }
          return networkRes
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached
            return caches.match('/')
          })
        })
    )
    return
  }

  // 6. Generic Fallback
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  )
})

// ── Web Push Event Listener ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'Wello Alert',
    body: 'You have a new update in Wello.',
    icon: '/icons/icon-192x192.png',
    badge: '/favicon.svg',
    url: '/',
    tag: 'wello-general',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'wello-notification',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Open Wello' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ── Notification Click Listener ──────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// ── Message Listener (Client-to-Worker communication) ────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
