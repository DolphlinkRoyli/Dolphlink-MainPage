/**
 * DOLPHLINK Service Worker
 * ============================================================================
 * Caches the core shell (HTML, CSS, JS, hero image, icons) so the site loads
 * instantly on repeat visits and works fully offline once installed as a PWA.
 *
 * Strategy:
 *   - Pre-cache the app shell on install (small, ~250 KB)
 *   - Network-first for content.json (so live updates always show)
 *   - Cache-first for static assets (images, fonts, CSS, JS)
 *   - Bump CACHE_VERSION when shipping major changes to invalidate old caches
 * ============================================================================
 */

const CACHE_VERSION = 'dolphlink-v9';
const SCOPE = self.registration && self.registration.scope
  ? new URL(self.registration.scope).pathname
  : '/Dolphlink-MainPage/';

// Files cached at install time — the minimum needed to render the homepage
// AND the enterprise digital-card landing page (/c/?u=<localpart>).
// The standalone /cards/ mini-app has been retired; the card view now lives
// inside the main-page Request-Briefing modal (js/register.js) and the
// public-facing /c/ landing page (js: c/c.js).
const PRECACHE = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'css/style.css',
  SCOPE + 'js/main.js',
  SCOPE + 'js/register.js',
  SCOPE + 'c/',
  SCOPE + 'c/index.html',
  SCOPE + 'c/c.css',
  SCOPE + 'c/c.js',
  SCOPE + 'media/img/hero-bg.webp',
  SCOPE + 'media/img/og-image.jpg',
  SCOPE + 'media/icon/3D/logo.webp',
  SCOPE + 'media/icon/pwa/icon-192.png',
  SCOPE + 'media/icon/pwa/icon-512.png',
  SCOPE + 'seo/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE).catch(err => {
        // Don't fail install if a single asset is missing (e.g. before deploy)
        console.warn('[sw] precache partial:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Drop old caches when CACHE_VERSION changes
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle our own origin (don't intercept third-party requests like
  // Google Fonts, jsdelivr CDN — let the browser handle them normally)
  if (url.origin !== self.location.origin) return;

  // content.json — always try network first so editors' updates show fast.
  // Falls back to cache only if offline.
  if (url.pathname.endsWith('/content.json') || url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first, fall back to network, then update cache
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Refresh the cached copy in background so it stays fresh
        fetch(req).then(resp => {
          if (resp.ok) caches.open(CACHE_VERSION).then(c => c.put(req, resp));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(resp => {
        if (resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});
