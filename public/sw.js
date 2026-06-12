/* nyarch service worker — Web Push receiver.
 *
 * This runs in the background even when the site is closed (as long as the
 * browser is running and the user granted notification permission + an active
 * push subscription exists). The server (Supabase Edge Function) sends an
 * encrypted Web Push message; the browser wakes this worker and delivers the
 * `push` event below.
 */

self.addEventListener('install', (event) => {
  // Activate immediately so pushes work without a reload.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg',
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
