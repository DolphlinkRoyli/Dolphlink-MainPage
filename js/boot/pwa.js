/**
 * PWA: service-worker registration + Install App handler.
 * Moved from an inline <script> to satisfy a strict CSP that drops
 * 'unsafe-inline' from script-src.
 *
 * Boot order: this file is loaded with `defer` at the end of <head>,
 * so it parses in parallel with the body and runs after DOMContentLoaded.
 * All actual work waits for the `load` event (SW registration) or
 * for user interaction (install button click) — no first-paint impact.
 */

/* ---------------- Service-worker registration + update toast ----------------
 *
 * SW only runs in PRODUCTION. On localhost / 127.0.0.1 / file:// we
 * actively unregister any leftover SW so the dev server (Live Server,
 * Vite, Python http.server, etc.) always serves fresh HTML / JS / CSS.
 * Without this guard the SW happily caches dev-built artefacts AND the
 * dev server's hot-reload inline scripts, then serves them back after
 * a CSP / file change — every CSS bump or CSP tighten silently 404s
 * or breaks until you nuke the SW by hand. Bug-class shut down once.
 */
var IS_LOCAL_DEV =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'   ||
  location.hostname === '0.0.0.0'     ||
  location.protocol === 'file:';

if ('serviceWorker' in navigator && IS_LOCAL_DEV) {
  /* Belt-and-braces: any prior SW from a previous prod-style run gets
     killed, and any pre-cached entries it owns get wiped, so the dev
     reload is genuinely fresh. */
  navigator.serviceWorker.getRegistrations()
    .then(function (regs) { regs.forEach(function (r) { r.unregister(); }); })
    .catch(function () {});
  if (window.caches && caches.keys) {
    caches.keys()
      .then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); })
      .catch(function () {});
  }
}

if ('serviceWorker' in navigator && !IS_LOCAL_DEV) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    }).catch(function (err) {
      console.warn('[pwa] service worker registration failed:', err);
    });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });

  function showUpdateToast() {
    if (document.getElementById('dlpk-update-toast')) return;
    var t = document.createElement('div');
    t.id = 'dlpk-update-toast';
    t.style.cssText =
      'position:fixed;left:50%;bottom:max(20px,env(safe-area-inset-bottom));' +
      'transform:translateX(-50%);z-index:9001;display:flex;align-items:center;gap:14px;' +
      'padding:12px 18px;background:#0F172A;color:#FFFFFF;border-radius:999px;' +
      'border:1px solid rgba(191,148,48,.4);font-family:Inter,system-ui,sans-serif;' +
      'font-size:12px;font-weight:700;letter-spacing:.6px;' +
      'box-shadow:0 12px 32px rgba(15,23,42,.32);';
    t.innerHTML =
      '<span>A new version is available.</span>' +
      '<button type="button" style="background:#0059B3;color:#FFFFFF;border:none;' +
      'padding:7px 14px;border-radius:999px;font:inherit;cursor:pointer;' +
      'letter-spacing:1.2px;text-transform:uppercase;font-size:10px;font-weight:800;">' +
      'Refresh</button>';
    document.body.appendChild(t);
    t.querySelector('button').addEventListener('click', function () {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        else location.reload();
      });
    });
  }
}

/* ---------------- Install App handler ---------------- */
(function () {
  var deferred = null;
  var pop = null;

  var standalone = false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) standalone = true;
    if (window.navigator.standalone === true) standalone = true;
  } catch (_) {}

  var ua = (navigator.userAgent || '').toLowerCase();
  var isIOS = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
  var isAndroid = /android/.test(ua);
  var isChromium = /chrome|edg\//.test(ua) && !/firefox/.test(ua);

  function triggerInstall() {
    if (standalone) {
      showHowTo("DOLPHLINK is already installed on this device. You should see it on your home screen or app drawer.");
      return;
    }
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; });
      return;
    }
    showHowTo();
  }

  function showHowTo(customMsg) {
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    var msg = customMsg
      || (isIOS
          ? 'Tap the <strong>Share</strong> icon at the bottom of Safari, then choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.'
          : isAndroid
          ? 'Open the browser <strong>menu (⋮)</strong>, then tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.'
          : isChromium
          ? 'Look for the <strong>install icon (⊕)</strong> on the right side of the URL bar, or open the browser menu and choose <strong>&ldquo;Install DOLPHLINK&rdquo;</strong>.'
          : 'In your browser menu, choose <strong>&ldquo;Install DOLPHLINK&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.');
    pop = document.createElement('div');
    pop.id = 'dlpk-install-howto';
    pop.style.cssText =
      'position:fixed;left:max(16px,env(safe-area-inset-left));' +
      'bottom:calc(max(16px,env(safe-area-inset-bottom)) + 56px);z-index:9001;' +
      'max-width:300px;padding:16px 18px;background:#FFFFFF;color:#0F172A;' +
      'border:1.5px solid #BF9430;border-radius:14px;font-family:Inter,system-ui,sans-serif;' +
      'font-size:13px;line-height:1.55;box-shadow:0 14px 32px rgba(15,23,42,.22);' +
      'animation:dlpkInstallPop .2s ease-out;';
    pop.innerHTML =
      '<div style="font-weight:800;color:#0059B3;letter-spacing:1.4px;font-size:11px;' +
      'text-transform:uppercase;margin-bottom:8px;">Install DOLPHLINK</div>' +
      '<div>' + msg + '</div>';
    document.body.appendChild(pop);
    var autoClose = setTimeout(removePop, 20000);
    function removePop() {
      clearTimeout(autoClose);
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
      document.removeEventListener('click', onOutside);
      pop = null;
    }
    function onOutside(e) { if (pop && !pop.contains(e.target)) removePop(); }
    requestAnimationFrame(function () { document.addEventListener('click', onOutside); });
  }

  window.addEventListener('beforeinstallprompt', function (e) { deferred = e; });
  window.addEventListener('appinstalled', function () { standalone = true; });

  /* Install App button — was previously bound via inline `onclick`. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.f-install-link');
    if (btn) triggerInstall();
  });

  /* Public hook kept for any caller who prefers the global function form. */
  window.dolphlinkInstall = triggerInstall;
})();

/* (register.css `rel=preload` → `rel=stylesheet` promoter removed —
   register.css is now loaded directly as a regular stylesheet in
   index.html, so no JS promotion is needed.) */
