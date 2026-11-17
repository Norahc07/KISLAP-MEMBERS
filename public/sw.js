const CACHE = 'kislap-shell-v3'

const PRECACHE = [
  '/',
  '/index.html',
  '/login',
  '/welcome',
  '/youth',
  '/youth/new',
  '/youth/willing',
  '/youth/pwd',
  '/youth/upcoming-sk',
  '/documents',
  '/calendar',
  '/account',
  '/manifest.webmanifest',
]

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

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // SPA routes: network first, fall back to cached app shell offline
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => {
              cache.put(request, copy)
              cache.put('/index.html', response.clone()).catch(() => undefined)
            })
          }
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/index.html') || caches.match('/') || caches.match('/login')),
        ),
    )
    return
  }

  const cacheable =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/youth') ||
    url.pathname.startsWith('/geo/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')

  if (!cacheable) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))),
  )
})
