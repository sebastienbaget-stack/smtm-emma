const CACHE = 'smtm-emma-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Push notification reçue du serveur
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const title = data.title || 'SMTM — Nouvelles offres'
  const options = {
    body: data.body || 'De nouvelles offres correspondent à ton profil.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Voir les offres' },
      { action: 'close', title: 'Ignorer' },
    ],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur la notif → ouvre l'app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'close') return
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const url = e.notification.data?.url || '/'
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      return clients.openWindow(url)
    })
  )
})
