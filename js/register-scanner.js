/* ============================================================================
 * DOLPHLINK QR Scanner — self-contained module loaded on-demand from register.js
 *
 * Public API:
 *   window.DLPKScanner.open(onResult)
 *     onResult({ type: 'url' | 'vcard' | 'text', data: string })
 *
 * Loads jsQR (cozmo/jsQR, MIT) lazily from jsdelivr the first time scanner
 * opens. Asks for camera permission, runs decode loop on each animation
 * frame, and shuts down cleanly on close / first hit.
 *
 * UI: full-screen overlay with brand-blue corner reticle and a Cancel button.
 * Strict color palette: #0059B3, #FFFFFF, grays only.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.DLPKScanner) return;

  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const ROOT_ID  = 'dlpk-scanner-root';

  // ---------------------------------------------------------------------------
  // Inject styles once
  // ---------------------------------------------------------------------------
  const css = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: #0F172A;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #FFFFFF;
}
#${ROOT_ID}[hidden] { display: none; }

#${ROOT_ID} .head {
  flex-shrink: 0;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.45);
}
#${ROOT_ID} .head .title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.4px;
}
#${ROOT_ID} .head .close {
  width: 36px; height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #FFFFFF;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
#${ROOT_ID} .head .close:hover { background: rgba(255, 255, 255, 0.22); }

#${ROOT_ID} .stage {
  position: relative;
  flex: 1;
  overflow: hidden;
  background: #0F172A;
}
#${ROOT_ID} video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
#${ROOT_ID} canvas { display: none; }

#${ROOT_ID} .reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(70vw, 280px);
  height: min(70vw, 280px);
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55);
  border-radius: 16px;
}
#${ROOT_ID} .reticle::before,
#${ROOT_ID} .reticle::after {
  content: '';
  position: absolute;
  width: 28px; height: 28px;
  border: 3px solid #0059B3;
}
#${ROOT_ID} .reticle::before {
  top: -3px; left: -3px;
  border-right: none; border-bottom: none;
  border-top-left-radius: 14px;
}
#${ROOT_ID} .reticle::after {
  bottom: -3px; right: -3px;
  border-left: none; border-top: none;
  border-bottom-right-radius: 14px;
}
#${ROOT_ID} .reticle-mid {
  position: absolute;
  top: 50%; left: 50%;
  width: min(70vw, 280px);
  height: 2px;
  transform: translate(-50%, 0);
  background: linear-gradient(90deg, transparent, #0059B3, transparent);
  animation: dlpk-scan-line 1.6s ease-in-out infinite;
  box-shadow: 0 0 12px #0059B3;
}
@keyframes dlpk-scan-line {
  0%, 100% { top: calc(50% - min(35vw, 140px)); opacity: 0.4; }
  50%      { top: calc(50% + min(35vw, 140px) - 2px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  #${ROOT_ID} .reticle-mid { animation: none; }
}

#${ROOT_ID} .reticle-corners {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(70vw, 280px);
  height: min(70vw, 280px);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
#${ROOT_ID} .reticle-corners span {
  position: absolute;
  width: 28px; height: 28px;
  border: 3px solid #0059B3;
}
#${ROOT_ID} .reticle-corners span:nth-child(1) { top: -3px;    left: -3px;    border-right: none; border-bottom: none; border-top-left-radius: 14px; }
#${ROOT_ID} .reticle-corners span:nth-child(2) { top: -3px;    right: -3px;   border-left: none;  border-bottom: none; border-top-right-radius: 14px; }
#${ROOT_ID} .reticle-corners span:nth-child(3) { bottom: -3px; left: -3px;    border-right: none; border-top: none;    border-bottom-left-radius: 14px; }
#${ROOT_ID} .reticle-corners span:nth-child(4) { bottom: -3px; right: -3px;   border-left: none;  border-top: none;    border-bottom-right-radius: 14px; }

#${ROOT_ID} .hint {
  position: absolute;
  bottom: max(80px, env(safe-area-inset-bottom));
  left: 0; right: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  letter-spacing: 0.3px;
}

#${ROOT_ID} .foot {
  flex-shrink: 0;
  padding: 14px 18px max(18px, env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
}
#${ROOT_ID} .foot .cancel {
  height: 44px;
  padding: 0 28px;
  background: #0059B3;
  color: #FFFFFF;
  border: none;
  border-radius: 22px;
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 89, 179, 0.35);
}
#${ROOT_ID} .foot .cancel:hover { filter: brightness(0.94); }

#${ROOT_ID} .err {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: #FFFFFF;
  color: #0F172A;
  padding: 18px 22px;
  border-radius: 12px;
  max-width: 80vw;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}
#${ROOT_ID} .err strong { color: #0059B3; display: block; margin-bottom: 6px; }
`;

  function injectStyles() {
    if (document.getElementById('dlpk-scanner-styles')) return;
    const s = document.createElement('style');
    s.id = 'dlpk-scanner-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Inject DOM (created on first open, kept around)
  // ---------------------------------------------------------------------------
  let root = null;
  let video = null;
  let canvas = null;
  let stream = null;
  let active = false;
  let onDoneCallback = null;

  function buildDOM() {
    if (root) return;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.hidden = true;
    root.innerHTML = `
      <div class="head">
        <span class="title">Scan a QR code</span>
        <button type="button" class="close" data-dlpk-scanner-close aria-label="Close scanner">&times;</button>
      </div>
      <div class="stage">
        <video id="dlpk-scanner-video" muted playsinline></video>
        <canvas id="dlpk-scanner-canvas"></canvas>
        <div class="reticle-corners"><span></span><span></span><span></span><span></span></div>
        <div class="reticle-mid"></div>
        <p class="hint" id="dlpk-scanner-hint">Looking for QR&hellip;</p>
      </div>
      <div class="foot">
        <button type="button" class="cancel" data-dlpk-scanner-close>Cancel</button>
      </div>
    `;
    document.body.appendChild(root);

    video  = document.getElementById('dlpk-scanner-video');
    canvas = document.getElementById('dlpk-scanner-canvas');

    root.querySelectorAll('[data-dlpk-scanner-close]').forEach(function (el) {
      el.addEventListener('click', closeAndCancel);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && !root.hidden) closeAndCancel();
    });
  }

  // ---------------------------------------------------------------------------
  // jsQR lazy loader
  // ---------------------------------------------------------------------------
  function loadJSQR() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = JSQR_URL;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('jsQR load failed')); };
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------------------
  // Camera control
  // ---------------------------------------------------------------------------
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('camera unsupported');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    try { await video.play(); } catch (e) { /* iOS autoplay sometimes throws */ }
  }

  function stopCamera() {
    active = false;
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  // ---------------------------------------------------------------------------
  // Scan loop
  // ---------------------------------------------------------------------------
  function loop() {
    if (!active) return;
    if (video.readyState === 4 && window.jsQR) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        try {
          const img = ctx.getImageData(0, 0, w, h);
          const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            handleHit(code.data);
            return;
          }
        } catch (e) { /* canvas tainted etc — ignore frame */ }
      }
    }
    requestAnimationFrame(loop);
  }

  function handleHit(text) {
    stopCamera();
    closeOverlay();
    const result = classify(text);
    if (typeof onDoneCallback === 'function') onDoneCallback(result);
    onDoneCallback = null;
  }

  function classify(text) {
    if (/^https?:\/\//i.test(text)) return { type: 'url', data: text };
    if (/^BEGIN:VCARD/i.test(text)) return { type: 'vcard', data: text };
    return { type: 'text', data: text };
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------
  function showError(msg) {
    if (!root) return;
    let err = root.querySelector('.err');
    if (!err) {
      err = document.createElement('div');
      err.className = 'err';
      root.querySelector('.stage').appendChild(err);
    }
    err.innerHTML = '<strong>Scanner unavailable</strong>' + msg;
  }

  async function open(onResult) {
    onDoneCallback = onResult || null;
    injectStyles();
    buildDOM();
    root.hidden = false;
    document.documentElement.classList.add('dlpk-no-scroll');

    try {
      await loadJSQR();
    } catch (e) {
      showError('Library failed to load. Please try again or check your connection.');
      return;
    }
    try {
      await startCamera();
    } catch (e) {
      const msg = (e && e.name === 'NotAllowedError')
        ? 'Camera permission was denied. Tap the address bar lock icon to grant access.'
        : 'Camera could not be started. Try a different browser if this persists.';
      showError(msg);
      return;
    }
    active = true;
    requestAnimationFrame(loop);
  }

  function closeOverlay() {
    if (!root) return;
    root.hidden = true;
    document.documentElement.classList.remove('dlpk-no-scroll');
    const err = root.querySelector('.err');
    if (err) err.remove();
  }

  function closeAndCancel() {
    stopCamera();
    closeOverlay();
    onDoneCallback = null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.DLPKScanner = { open: open };
})();
