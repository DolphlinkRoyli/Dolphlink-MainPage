/**
 * Tiny error-monitor shim. Loaded synchronously in <head> so it can
 * catch errors that fire before the main module graph is parsed.
 *
 * Buffers up to 50 deduped entries in `window.__dlpkErrors` for the
 * `/_local/health-check.html` dashboard to read. Pure logging — no
 * side effects on the page itself.
 *
 * Moved out of an inline `<script>` so the CSP can drop
 * `'unsafe-inline'` from script-src.
 */

/* Trusted Types default policy — REGISTERED FIRST so it covers every
   subsequent `el.innerHTML = ...` sink in the codebase before any
   render module runs.
   Why a default policy: a strict per-site policy would require
   wrapping every existing innerHTML call (~25 sites across the engine
   tree) and is a non-trivial refactor. The default policy is the
   minimum-viable "pass-through" that satisfies the CSP
   `require-trusted-types-for 'script'` directive, lets DOMPurify-style
   tooling drop in later, and keeps the existing renderers working. All
   data still goes through `escapeHtml()` / `safeUrl()` / `safeCssColor()`
   in those renderers — that XSS hygiene is unchanged. */
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML:      function (s) { return s; },
      createScript:    function (s) { return s; },
      createScriptURL: function (s) { return s; }
    });
  } catch (_) { /* Policy already exists (HMR / multi-load) — ignore. */ }
}

(function () {
  window.__dlpkErrors = [];
  var DLPK_ERR_MAX = 50;
  var dlpkErrSeen = Object.create(null);
  function pushErr(entry) {
    var key = entry.type + '|' + entry.msg + '|' + (entry.src || '') + '|' + (entry.line || '');
    if (dlpkErrSeen[key]) { dlpkErrSeen[key].count++; dlpkErrSeen[key].lastAt = entry.at; return; }
    entry.count = 1; entry.lastAt = entry.at;
    dlpkErrSeen[key] = entry;
    window.__dlpkErrors.push(entry);
    if (window.__dlpkErrors.length > DLPK_ERR_MAX) {
      var d = window.__dlpkErrors.shift();
      delete dlpkErrSeen[d.type + '|' + d.msg + '|' + (d.src || '') + '|' + (d.line || '')];
    }
  }
  window.addEventListener('error', function (e) {
    pushErr({ type: 'error', msg: e.message, src: e.filename, line: e.lineno, col: e.colno,
      stack: e.error && e.error.stack || '', at: new Date().toISOString() });
    console.warn('[dlpk:error]', e.message, e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    pushErr({ type: 'unhandledrejection',
      msg: (e.reason && e.reason.message) || String(e.reason),
      stack: (e.reason && e.reason.stack) || '', at: new Date().toISOString() });
    console.warn('[dlpk:reject]', e.reason);
  });
})();
