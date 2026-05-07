/**
 * Content loader — fetches and caches content/content.json (and its
 * localized variants).
 *
 * Scope: HOMEPAGE ONLY. The card and SME pages have their own data
 * sources (cards.json / sme.json) baked at build time.
 *
 * Locale awareness:
 *   loadContent('en') → content/content.json          (default)
 *   loadContent('zh') → content/content.zh.json       (falls back to en if 404)
 *   loadContent('ja') → content/content.ja.json       (same)
 *   …etc
 *
 * The result is cached per-language so switching back and forth doesn't
 * re-hit the network. Call signature stays backwards-compatible —
 * `loadContent()` with no arg still loads English.
 */
import { yieldToMain } from './utils.js';

export const CONTENT_VERSION = '20260508e';

const _cache = new Map();        /* lang code → resolved content object */
const _inflight = new Map();     /* lang code → in-flight fetch promise */

function urlFor(lang) {
  if (!lang || lang === 'en') return `content/content.json?v=${CONTENT_VERSION}`;
  return `content/content.${lang}.json?v=${CONTENT_VERSION}`;
}

export async function loadContent(lang = 'en') {
  if (_cache.has(lang)) return _cache.get(lang);
  if (_inflight.has(lang)) return _inflight.get(lang);

  const promise = fetch(urlFor(lang))
    .then(r => {
      if (r.ok) return r.json();
      /* 404 / 5xx — try English fallback. Don't throw; non-English visitors
         shouldn't get a broken page just because we haven't translated
         content.<lang>.json yet. */
      if (lang !== 'en') {
        console.info('[loader] no content.' + lang + '.json — falling back to English');
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
