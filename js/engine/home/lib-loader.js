/**
 * Lazy script loader — fetches a vendored copy from `lib/`.
 *
 * Scope: HOMEPAGE ONLY (used by ./modules/map.js and ./modules/footer-card.js).
 *
 * SECURITY / SOVEREIGNTY:
 *   - 100% self-hosted. We do NOT fall back to any CDN, even with SRI.
 *     If `lib/<file>.js` is missing the feature simply doesn't load —
 *     no third-party origin is ever contacted.
 *   - To refresh a vendored library, run `lib/download.ps1` (Windows)
 *     or `lib/download.sh` (Unix), commit the result.
 *
 * Returns a promise that resolves once the script tag's `load` event
 * fires. Subsequent calls with the same URL return the cached promise
 * — saves duplicate network + parse on multi-bind code paths.
 */
const _cache = new Map();

export function loadScriptOnce(localUrl) {
  if (_cache.has(localUrl)) return _cache.get(localUrl);

  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = localUrl;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      s.remove();
      reject(new Error(
        `script load failed: ${localUrl} ` +
        `(no CDN fallback by policy — vendor the file under lib/ instead)`
      ));
    };
    document.head.appendChild(s);
  });

  _cache.set(localUrl, p);
  return p;
}
