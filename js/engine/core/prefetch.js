/**
 * Smart prefetch — warms up resources the user is ABOUT to need.
 * Three strategies, layered:
 *
 *   1. HOVER PREFETCH (desktop)
 *      When mouse hovers a link for 65ms+, fetch the destination + its
 *      content JSON. By click time, browser cache is warm.
 *
 *   2. TOUCHSTART PREFETCH (mobile)
 *      Fingers touch ~100ms before tap registers. Use that window to fetch.
 *
 *   3. INTERSECTIONOBSERVER PREFETCH (idle)
 *      Links visible on screen + connection is fast → prefetch in idle time.
 *
 * Contrast with React/Next.js:
 *   Next has next/link prefetch — it's good but bound to their router.
 *   Ours works on any anchor + any URL, no framework lock-in. And we
 *   prefetch the JSON content too, not just the HTML, so render is instant
 *   on click.
 */

const _prefetched = new Set();
let _hoverTimer = null;

function isLikelyExternal(href) {
  if (!href) return true;
  if (href.startsWith('#')) return true;            /* same-page anchor */
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (href.startsWith('javascript:')) return true;
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return true;
  } catch (_) { return true; }
  return false;
}

function prefetchHref(href) {
  if (!href || _prefetched.has(href)) return;
  if (isLikelyExternal(href)) return;
  _prefetched.add(href);

  /* Use <link rel="prefetch"> — browser puts it in idle queue, no network
     spike, doesn't block anything. */
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.as = 'document';
  document.head.appendChild(link);

  /* If the page is one of ours (sme/, card/, etc.), also prefetch its
     content JSON so the next-page hydrate is instant. */
  const m = href.match(/\/(sme|card|about)\/(?:[?#]|$)/);
  if (m) {
    const slug = m[1];
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('dlpk:lang')) || '';
    const jsonUrl = lang && lang !== 'en'
      ? `content/${slug}.${lang}.json`
      : `content/${slug}.json`;
    const link2 = document.createElement('link');
    link2.rel = 'prefetch';
    link2.href = jsonUrl;
    link2.as = 'fetch';
    link2.crossOrigin = 'anonymous';
    document.head.appendChild(link2);
  }
}

function onHoverEnter(ev) {
  const a = ev.target.closest && ev.target.closest('a[href]');
  if (!a || a.dataset.noPrefetch !== undefined) return;
  clearTimeout(_hoverTimer);
  _hoverTimer = setTimeout(() => prefetchHref(a.getAttribute('href')), 65);
}
function onHoverLeave() {
  clearTimeout(_hoverTimer);
}
function onTouchStart(ev) {
  const a = ev.target.closest && ev.target.closest('a[href]');
  if (!a || a.dataset.noPrefetch !== undefined) return;
  prefetchHref(a.getAttribute('href'));
}

/** Wire up the listeners. Call once at boot. */
export function attachPrefetch() {
  document.addEventListener('mouseover', onHoverEnter, { passive: true });
  document.addEventListener('mouseout', onHoverLeave, { passive: true });
  document.addEventListener('touchstart', onTouchStart, { passive: true });

  /* Also prefetch any link with data-prefetch attribute on first paint. */
  document.querySelectorAll('a[data-prefetch]').forEach(a => {
    prefetchHref(a.getAttribute('href'));
  });
}
