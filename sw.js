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

const CACHE_VERSION = 'dolphlink-v130';
const SCOPE = self.registration && self.registration.scope
  ? new URL(self.registration.scope).pathname
  : '/Dolphlink-MainPage/';

// Files cached at install time — the minimum needed to render the homepage
// AND the enterprise digital-card landing page (/c/?u=<localpart>).
// The standalone /cards/ mini-app has been retired; the card view now lives
// inside the main-page Request-Briefing modal (js/register.js) and the
// public-facing /c/ landing page (js: c/c.js).
const OFFLINE_URL = SCOPE + 'offline.html';
const PRECACHE = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'offline.html',
  SCOPE + 'css/style.css',
  SCOPE + 'css/register.css',
  SCOPE + 'js/main.js',
  SCOPE + 'js/register.js',
  SCOPE + 'c/',
  SCOPE + 'c/index.html',
  SCOPE + 'c/c.css',
  SCOPE + 'js/c.js',
  SCOPE + 'media/img/video-poster.webp',
  SCOPE + 'media/video/current.mp4',
  SCOPE + 'media/icon/3D/logo.webp',
  SCOPE + 'seo/site.webmanifest',
  // Local copies of external libs (populated by lib/download.ps1).
  // Pre-cache on install so offline mode + repeat visits skip the CDN.
  // If these files don't exist yet, addAll() rejects but we log + continue
  // (see install handler) — the JS loaders fall back to jsdelivr.
  SCOPE + 'lib/echarts.min.js',
  SCOPE + 'lib/world.json',
  SCOPE + 'lib/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE).catch(err => {
        // Don't fail install if a single asset is missing (e.g. before deploy)
        console.warn('[sw] precache partial:', err);
      }))
      // NOTE: do NOT skipWaiting() automatically — that would force the new
      // SW on top of an active session, sometimes mixing old + new caches
      // mid-render. Instead we wait for the page to opt in via postMessage.
  );
});

// Page asks us to take over right now (after user clicks Refresh on the
// update toast). Activates the new SW and triggers controllerchange on
// the page, which our index.html script reloads on.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  // Skip range / partial requests (mostly <video src> byte-range fetches).
  // The Cache API rejects 206 Partial Content with a TypeError, so we
  // simply let the browser handle these natively. Anything served as a
  // partial response is by definition not part of the offline shell.
  if (req.headers.has('range')) return;

  // content.json — always try network first so editors' updates show fast.
  // Falls back to cache only if offline.
  if (url.pathname.endsWith('/content.json') || url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          }
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
          if (resp.status === 200) caches.open(CACHE_VERSION).then(c => c.put(req, resp));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(resp => {
        // Only cache full 200 responses. Skip 206 (range) / 0 (opaque) /
        // anything else — they crash Cache.put() or pollute the offline
        // shell with broken byte ranges.
        if (resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => {
        // Network is dead AND nothing cached. For HTML navigations show
        // the branded offline page; for other resources just let the
        // browser show its native error.
        if (req.mode === 'navigate' || req.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
