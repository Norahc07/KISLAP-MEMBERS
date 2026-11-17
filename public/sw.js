const CACHE = 'kislap-shell-v2'

const PRECACHE = ['/', '/login', '/youth', '/youth/new', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const cacheable =
    url.pathname === '/' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/youth') ||
    url.pathname.startsWith('/geo/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && cacheable) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/youth') || caches.match('/')),
      ),
  )
})
