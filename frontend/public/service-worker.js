// Service Worker for ktOptima
// __BUILD_VERSION__ is replaced at build time (see vite.config.ts) to bust caches on every deploy.

const VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `ktoptima-${VERSION}`;
const APP_SHELL_ASSETS = ['/manifest.webmanifest', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      // clients.claim() makes this SW take control of currently open tabs,
      // which fires `controllerchange` in those tabs - main.tsx listens for that
      // event and reloads the page with the latest bundle. No navigate() here:
      // the browser refuses to navigate same-origin URLs in some cases (e.g. /login)
      // and we don't want unhandled rejections.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never cache API or auth traffic - always go to network.
  if (url.pathname.startsWith('/api/')) return;

  // HTML / SPA navigation: network-first, fall back to cached index.html when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || Response.error()))
    );
    return;
  }

  // Hashed Vite assets (/assets/...): network-first, cache fallback for offline.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Static shell assets (logo, manifest, fonts, etc.): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || networkPromise;
    })
  );
});
