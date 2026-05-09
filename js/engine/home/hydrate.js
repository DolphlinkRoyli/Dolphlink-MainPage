/**
 * DOM hydration — fills SSR HTML with values from content.json.
 *
 * Scope: HOMEPAGE ONLY.
 *
 * Recognised attributes:
 *   data-key="path.to.value"          → element.textContent swap
 *   data-href-key="path.to.url"       → href swap (with optional data-href-prefix)
 *   data-render="path.to.array"       → trigger a registered renderer
 *   data-current-date                 → expand {D MMM YYYY} in place
 */
import { getByPath, safeUrl } from './utils.js';
import { expandDateTokens } from './tokens.js';

let _content = null;

export function setHydrationContent(content) {
  _content = content;
}

/* Read-only accessor — renderers / modules that need the FULL content
   tree (not just the array passed by the dispatcher) can pull it via
   this getter. Replaces the old `window.CONTENT` global from main.js. */
export function getContent() {
  return _content;
}

export function applyTextContent(root) {
  // [data-current-date] — live date stamps embedded in markup. No
  // content.json round-trip needed; just expand the token in place.
  root.querySelectorAll('[data-current-date]').forEach(el => {
    el.textContent = expandDateTokens(el.textContent || '{D MMM YYYY}');
  });
  // [data-key] — text content swap from content.json.
  root.querySelectorAll('[data-key]').forEach(el => {
    let v = getByPath(_content, el.dataset.key);
    if (typeof v !== 'string') return;
    v = expandDateTokens(v);
    el.textContent = v;
  });
  // [data-href-key] — href swap. Pipe through safeUrl so a poisoned
  // content.json can't inject a `javascript:` / `data:` URL. The
  // prefix (e.g. "mailto:") is treated as part of the same value —
  // safeUrl validates the COMBINED string against the scheme allow-list.
  root.querySelectorAll('[data-href-key]').forEach(el => {
    const v = getByPath(_content, el.dataset.hrefKey);
    if (typeof v === 'string') {
      const prefix = el.dataset.hrefPrefix || '';
      el.setAttribute('href', safeUrl(prefix + v));
    }
  });
}

