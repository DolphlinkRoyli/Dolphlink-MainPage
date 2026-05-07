/**
 * Core utilities — pure helpers, no DOM or content dependencies.
 *
 * Scope: HOMEPAGE ONLY. The card and SME pages do not import from this
 * file; if they ever need any of these helpers, copy them into the
 * relevant page tree rather than promoting this module to the engine root.
 *
 * SECURITY NOTES (read these before editing):
 *
 *   - escapeHtml is the project-wide XSS shield. Every renderer that
 *     emits HTML via template literals MUST pass dynamic values through
 *     it. Don't bypass.
 *
 *   - safeUrl is the open-redirect / `javascript:` URL shield. Every
 *     time we set an `href` from JSON data (data-href-key, render
 *     output, footer / nav / social links), pipe it through safeUrl
 *     so a poisoned content.json can't ship a `javascript:alert(1)` URL.
 *
 *   - getByPath has a deny-list to block prototype walking. A poisoned
 *     content.json key like "__proto__.x" would otherwise let an
 *     attacker probe Object.prototype.
 */


/* Forbidden segments in a dotted path. Blocks prototype-walking via
   crafted keys in content.json. */
const PROTO_TRAPS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Resolve a dotted path "a.b.c" against an object. Used everywhere we
 * hydrate data from JSON into the DOM. Refuses to walk into prototype
 * traps and only descends through plain objects (or arrays) to keep
 * the surface tight.
 *
 * Returns `undefined` when any segment is missing or unsafe.
 */
export function getByPath(obj, path) {
  if (typeof path !== 'string' || !path) return undefined;
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur == null) return undefined;
    if (PROTO_TRAPS.has(k)) return undefined;
    const t = typeof cur;
    if (t !== 'object' && t !== 'function') return undefined;
    cur = cur[k];
  }
  return cur;
}

/**
 * HTML entity escape — defends DOM from special characters in JSON
 * copy. Covers the 5 chars that matter for both element-content and
 * quoted attribute contexts (&, <, >, ", '). Sufficient for our use;
 * we never inject into unquoted attributes or javascript: URLs (those
 * go through safeUrl).
 *
 * Lookup table is module-scoped so the per-call replace callback
 * doesn't re-allocate a fresh object on every character.
 */
const HTML_ESCAPES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
};
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

/* Allow-list of URL schemes that may flow from JSON into the DOM.
   Anything else (javascript:, data:, vbscript:, file:, blob:, ws:,
   custom protocols) gets rewritten to '#'. */
const SAFE_URL_SCHEMES  = /^(?:https?|mailto|tel|sms):/i;
const ABSOLUTE_REL_PATH = /^[\/.?#]/;
const HAS_SCHEME        = /^[^\/?#]*:/;

/**
 * Validate / sanitise an href value. Returns the URL if it's:
 *   - a known safe scheme (http, https, mailto, tel, sms), OR
 *   - a relative path / fragment / query (no scheme).
 * Rejects everything else by returning '#'.
 */
export function safeUrl(u) {
  if (typeof u !== 'string') return '#';
  const v = u.trim();
  if (!v) return '#';
  /* Strip whitespace + control chars that browsers tolerate before
     scheme parsing (e.g. "java\tscript:" still parses as javascript:). */
  const cleaned = v.replace(/[\s\x00-\x1f\x7f]/g, '');
  if (!cleaned) return '#';
  if (SAFE_URL_SCHEMES.test(cleaned))  return v;   // known good scheme
  if (ABSOLUTE_REL_PATH.test(cleaned)) return v;   // /, ./, ../, ?, #
  if (!HAS_SCHEME.test(cleaned))       return v;   // no scheme → relative
  return '#';                                      // unknown scheme — block
}

/**
 * CSS color sanitiser — only lets through hex (#rgb / #rrggbb / #rrggbbaa)
 * or named colors (letters only). Rejects anything that could break out
 * of a `style="--accent: …"` attribute via `;` / `url(…)` / `expression(…)`.
 */
export function safeCssColor(c) {
  if (typeof c !== 'string') return '';
  const v = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;        // hex
  if (/^[a-zA-Z]{1,32}$/.test(v)) return v;            // named (red, navy, …)
  return '';
}

/**
 * Slug validator for icon / key names. Used wherever a string from
 * JSON gets concatenated into a URL path (e.g. `media/icon/3D/${name}.webp`)
 * — without this, `name = "../../etc/passwd"` would silently traverse
 * out of the icon directory.
 */
export function safeIconName(name) {
  if (typeof name !== 'string') return '';
  return /^[A-Za-z0-9_-]{1,40}$/.test(name) ? name : '';
}

/**
 * Trailing-edge debounce — throttles bursty events (resize, scroll).
 */
export function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Yield to main thread on every browser that supports it. Used between
 * rendering passes so the first paint happens fast and below-fold work
 * runs after.
 */
export function yieldToMain() {
  if (typeof scheduler !== 'undefined' && scheduler.yield) {
    return scheduler.yield();
  }
  return new Promise(r => setTimeout(r, 0));
}
