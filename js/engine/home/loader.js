/**
 * Content loader â€” fetches and caches content/content.json (and its
 * localized variants).
 *
 * Scope: HOMEPAGE ONLY. The card and SME pages have their own data
 * sources (cards.json / sme.json) baked at build time.
 *
 * Locale awareness:
 *   loadContent('en') â†’ content/content.json          (default)
 *   loadContent('zh') â†’ content/content.zh.json       (falls back to en if 404)
 *   loadContent('ja') â†’ content/content.ja.json       (same)
 *   â€¦etc
 *
 * The result is cached per-language so switching back and forth doesn't
 * re-hit the network. Call signature stays backwards-compatible â€”
 * `loadContent()` with no arg still loads English.
 */
import { yieldToMain } from './utils.js';

export const CONTENT_VERSION = '20260508ch';

const _cache = new Map();        /* lang code â†’ resolved content object */
const _inflight = new Map();     /* lang code â†’ in-flight fetch promise */

function urlFor(lang) {
  if (!lang || lang === 'en') return `content/content.json?v=${CONTENT_VERSION}`;
  return `content/content.${lang}.json?v=${CONTENT_VERSION}`;
}

export async function loadContent(lang = 'en') {
  if (_cache.has(lang)) return _cache.get(lang);
  if (_inflight.has(lang)) return _inflight.get(lang);

  /* `credentials: 'omit'` is REQUIRED for the browser to reuse the
     `<link rel=preload as=fetch crossorigin=anonymous>` resource declared
     in index.html. Without it, the preload runs as CORS-anonymous (no
     cookies) but the bare fetch() defaults to same-origin (sends cookies)
     — credentials don't match, so the preload is discarded and we pay
     for the JSON twice (and Chrome logs the "preloaded but not used"
     warning). With omit, both requests carry identical metadata so the
     preloaded response is consumed by this fetch. */
  const promise = fetch(urlFor(lang), { credentials: 'omit' })
    .then(r => {
      if (r.ok) return r.json();
      /* 404 / 5xx â€” try English fallback. Don't throw; non-English visitors
         shouldn't get a broken page just because we haven't translated
         content.<lang>.json yet. */
      if (lang !== 'en') {
        console.info('[loader] no content.' + lang + '.json â€” falling back to English');
        return loadContent('en');
      }
      throw new Error(`content.json fetch failed: ${r.status}`);
    })
    .then(data => {
      _cache.set(lang, data);
      _inflight.delete(lang);
      return data;
    })
    .catch(err => {
      _inflight.delete(lang);
      throw err;
    });

  _inflight.set(lang, promise);
  return promise;
}
