/**
 * Page dispatcher — the only file js/app.js imports directly.
 * ============================================================================
 *
 * Boots the runtime, attaches global behaviours (prefetch, lazy sections),
 * then routes to the page module based on `<html data-page="…">`.
 *
 *   <html data-page="home">  →  ./home/index.js
 *   <html data-page="card">  →  ./card/index.js
 *   <html data-page="sme">   →  ./sme/index.js
 *
 * Add a new page in three lines:
 *   1. Create js/engine/<name>/index.js exporting `default async function`.
 *   2. Add `<html data-page="<name>">` on the new page.
 *   3. Add `'<name>': () => import('./<name>/index.js')` below.
 *
 * The runtime + prefetch + lazy section observer + error boundary all
 * apply automatically — page modules don't need to opt in.
 * ============================================================================
 */

import { dlpk } from './core/runtime.js';
import { attachPrefetch } from './core/prefetch.js';
import { observeLazySections } from './core/lazy-section.js';

const PAGE_LOADERS = {
  'home':  () => import('./home/index.js'),
  'card':  () => import('./card/index.js'),
  'sme':   () => import('./sme/index.js'),
  'build': () => import('./build/index.js'),
};

const DEFAULT_PAGE = 'home';

export async function dispatch() {
  /* Mark the start of dispatch on the Performance timeline so DevTools
     shows our boot in the same view as LCP / FCP / CLS. */
  dlpk.perf.mark('dispatch:start');

  /* Wire up cross-cutting concerns BEFORE the page module so the page
     can rely on them being available in setup(). */
  attachPrefetch();   /* hover/touch prefetch for any <a> on the page */

  const root = document.documentElement;
  const name = (root && root.dataset && root.dataset.page) || DEFAULT_PAGE;
  const loader = PAGE_LOADERS[name];

  if (!loader) {
    console.warn('[dispatch] unknown page:', name, '— skipping setup');
    return;
  }

  try {
    /* Lazy import the page module. The browser only fetches the page-
       specific JS the visitor needs — never the SME bundle on the home
       page or vice versa. */
    const mod = await dlpk.perf.time(`page:${name}:load`, () => loader());

    if (typeof mod.default === 'function') {
      await dlpk.perf.time(`page:${name}:setup`, () => mod.default());
    }

    /* After page setup mounted everything eager, kick off the lazy
       observer for `data-lazy` sections. */
    observeLazySections();

    dlpk.perf.measure('dispatch', 'dispatch:start');
    dlpk.events.emit('page:ready', { name });

    /* Lazy-mount the chatbot ~1.5s after page is interactive, so it never
       competes with first-paint. The module itself decides which pages
       it appears on (skips card/build/legal). */
    setTimeout(() => {
      import('./home/chatbot.js')
        .then(m => m.default && m.default())
        .catch(e => console.warn('[chatbot] load failed:', e));
    }, 1500);
  } catch (err) {
    console.error('[dispatch] page setup failed:', name, err);
    dlpk.events.emit('page:error', { name, error: err });
  }
}
