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

const CACHE_VERSION = 'dolphlink-v309';
const SCOPE = self.registration && self.registration.scope
  ? new URL(self.registration.scope).pathname
  : '/Dolphlink-MainPage/';

// Files cached at install time.
//
// Engine layout (single-entry hook dispatcher + per-page subtrees):
//
//   js/app.js                â† entry, dispatched on every page
//   js/engine/dispatch.js    â† reads <html data-page>, lazy-loads page module
//   js/engine/core/...       â† helpers shared by 2+ pages (drive, vcard,
//                              clipboard, strings, loader-shell)
//   js/engine/home/...       â† homepage tree (the bulk of the JS)
//   js/engine/card/index.js  â† /card/ digital-card page (legacy /c/ redirects)
//   js/engine/sme/index.js   â† /sme/ landing page (no-op for now)
//
// Per-page subtrees own their utils, renderers, modules, and icon
// libraries. They import shared helpers from ../core/ when needed.
// Outside js/engine/ + lib/ NO JS exists in this repo.
const OFFLINE_URL = SCOPE + 'offline.html';
const PRECACHE = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'offline.html',
  SCOPE + 'css/tokens.css',           // design tokens â€” must load before style.css
  SCOPE + 'css/style.css',
  SCOPE + 'css/sme.css',              // SME Ã— Lark landing page styles
  SCOPE + 'css/register.css',

  // ---- Single application entry + the only file every page uses ----
  SCOPE + 'js/app.js',
  SCOPE + 'js/engine/dispatch.js',

  // ---- Core helpers (shared by 2+ pages) ----
  SCOPE + 'js/engine/core/loader-shell.js',
  SCOPE + 'js/engine/core/drive.js',
  SCOPE + 'js/engine/core/strings.js',
  SCOPE + 'js/engine/core/vcard.js',
  SCOPE + 'js/engine/core/clipboard.js',
  SCOPE + 'js/engine/core/url.js',          // safeHttpUrl â€” XSS shield for href= sites
  SCOPE + 'js/engine/core/i18n.js',         // runtime locale swap (zh/ja/es/ms/hi)
  SCOPE + 'content/i18n/zh.json',
  SCOPE + 'content/i18n/ja.json',
  SCOPE + 'content/i18n/es.json',
  SCOPE + 'content/i18n/ms.json',
  SCOPE + 'content/i18n/hi.json',
  // Full-page locale content (homepage). The loader falls back to
  // content.json when a locale file is missing, so listing them here is
  // pure perf (skip-the-network on locale switch).
  SCOPE + 'content/content.zh.json',
  SCOPE + 'content/content.ja.json',
  SCOPE + 'content/content.es.json',
  SCOPE + 'content/content.ms.json',
  SCOPE + 'content/content.hi.json',

  // ---- Homepage tree (loaded only when <html data-page="home">) ----
  SCOPE + 'js/engine/home/index.js',
  SCOPE + 'js/engine/home/utils.js',
  SCOPE + 'js/engine/home/tokens.js',
  SCOPE + 'js/engine/home/loader.js',
  SCOPE + 'js/engine/home/hydrate.js',
  SCOPE + 'js/engine/home/lib-loader.js',
  SCOPE + 'js/engine/home/fallbacks.js',
  SCOPE + 'js/engine/home/icons/svg-builders.js',
  SCOPE + 'js/engine/home/render/hero.js',
  SCOPE + 'js/engine/home/render/stats.js',
  SCOPE + 'js/engine/home/render/portfolio.js',
  SCOPE + 'js/engine/home/render/audit.js',
  SCOPE + 'js/engine/home/render/menu.js',
  SCOPE + 'js/engine/home/render/industries.js',
  SCOPE + 'js/engine/home/render/departments.js',
  SCOPE + 'js/engine/home/render/legal.js',
  SCOPE + 'js/engine/home/render/icon-html.js',  // shared SVG-or-webp helper
  SCOPE + 'js/engine/home/modules/loader-shell.js',
  SCOPE + 'js/engine/home/modules/scroll.js',
  SCOPE + 'js/engine/home/modules/card-detail.js',
  SCOPE + 'js/engine/home/modules/footer-card.js',
  SCOPE + 'js/engine/home/modules/map.js',
  SCOPE + 'js/engine/home/register.js',          // Request-Briefing modal
  SCOPE + 'js/engine/home/register-scanner.js',  // QR scanner (lazy)

  // ---- Card-page tree (loaded only when <html data-page="card">) ----
  SCOPE + 'js/engine/card/index.js',

  // ---- SME-page tree (loaded only when <html data-page="sme">) ----
  SCOPE + 'js/engine/sme/index.js',

  // Card-page tree â€” primary URL is /card/?u=<localpart>. The legacy
  // /c/?u=<localpart> still works because c/index.html is a redirect
  // stub that JS-replaces to ../card/ + the original query string.
  SCOPE + 'card/',
  SCOPE + 'card/index.html',
  SCOPE + 'c/',
  SCOPE + 'c/index.html',
  SCOPE + 'sme/',                     // SME Ã— Lark landing page (built artifact)
  SCOPE + 'sme/index.html',
  SCOPE + 'css/card.css',
  SCOPE + 'media/img/video-poster.webp',
  SCOPE + 'media/video/current.mp4',
  SCOPE + 'media/icon/3D/logo.webp',
  SCOPE + 'seo/site.webmanifest',
  // Local copies of external libs (populated by lib/download.ps1).
  // Pre-cache on install so offline mode + repeat visits skip the CDN.
  // If these files don't exist yet, addAll() rejects but we log + continue
  // (see install handler) â€” engine/home/fallbacks.js degrades the feature
  // to a still-useful static substitute.
  SCOPE + 'lib/echarts.min.js',
  SCOPE + 'lib/world.json',
  SCOPE + 'lib/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE).catch(err => {
        console.warn('[sw] precache partial:', err);
      }))
  );
});

// Page asks us to take over right now (after user clicks Refresh on the
// update toast). Activates the new SW and triggers controllerchange on
// the page, which our index.html script reloads on.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Drop old caches when CACHE_VERSION changes + enable navigation preload
  // (lets the browser race the network alongside SW startup, saving the
  // 100-300ms cold-start delay that SWs traditionally add to navigation).
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle our own origin (don't intercept third-party requests like
  // Google Fonts, jsdelivr CDN â€” let the browser handle them normally)
  if (url.origin !== self.location.origin) return;

  // Skip range / partial requests (mostly <video src> byte-range fetches).
  if (req.headers.has('range')) return;

  // content.json â€” always try network first so editors' updates show fast.
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
        fetch(req).then(resp => {
          if (resp.status === 200) caches.open(CACHE_VERSION).then(c => c.put(req, resp));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(resp => {
        if (resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate' || req.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
