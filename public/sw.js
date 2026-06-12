/* nyarch service worker — Web Push receiver + PWA shell.
 *
 * Two jobs:
 *  1) Background Web Push (works even when the site is closed).
 *  2) Make the app installable / offline-capable (PWA) via a tiny app-shell
 *     cache and a navigation fallback, so "Add to desktop" gives a real
 *     standalone app window.
 */

const CACHE = 'nyarch-shell-v1'
// Minimal app shell. The hashed JS/CSS bundles are cached on demand at runtime
// (we can't know their hashed names here), so we cache the entry document and
// icons and let the network-first handler fill the rest.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  // Activate immediately so pushes + the new shell work without a reload.
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // drop old shell caches
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

/* PWA fetch handling.
 * - Navigations: network-first, fall back to the cached app shell when offline
 *   (so the standalone app still opens without a connection).
 * - Static GET requests: stale-while-revalidate so repeat loads are instant.
 * We never touch non-GET, cross-origin API calls, or Supabase requests. */
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // let API/CDN calls pass through

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'nyarch', body: event.data ? event.data.text() : 'New activity' }
  }

  const title = data.title || 'nyarch'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    // group same-tag notifications (e.g. one conversation) instead of stacking
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if we have one, else open a new one.
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client && target !== '/') client.navigate(target).catch(() => {})
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})
