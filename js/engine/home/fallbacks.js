/**
 * Hand-written graceful degradation when a vendored library under
 * `lib/` fails to load.
 *
 * Scope: HOMEPAGE ONLY (consumed by ./modules/map.js + ./modules/footer-card.js).
 *
 * Policy: 100% self-hosted, no CDN safety net. If `lib/echarts.min.js`
 * or `lib/qrcode.min.js` is missing (deploy bug, accidental delete, repo
 * not yet seeded), the page would silently lose the feature without
 * these fallbacks. Each helper degrades the feature to a still-useful
 * static substitute that costs zero extra bytes when the real library
 * loads correctly.
 *
 *   mapFallback(el, locations)   → city list when ECharts is missing
 *   qrFallback(slot, url, label) → URL + copy button when qrcode is missing
 */
import { escapeHtml, safeUrl } from './utils.js';


/**
 * Render a styled list of locations into `el` when the world-map
 * library is unavailable. The data points still get communicated —
 * just as a readable list instead of an animated globe.
 */
export function mapFallback(el, locations) {
  if (!el || !Array.isArray(locations) || !locations.length) return;
  const items = locations.map(loc => {
    const name = escapeHtml(loc.name || '');
    const tag = loc.isHQ
      ? '<span style="display:inline-block;background:#F59E0B;color:#1E3A6B;font-size:9px;font-weight:800;letter-spacing:1.4px;padding:2px 6px;border-radius:3px;margin-left:8px;vertical-align:middle">HQ</span>'
      : '';
    return `<li style="font-size:13px;font-weight:700;color:#FFF;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;letter-spacing:0.4px">${name}${tag}</li>`;
  }).join('');

  el.innerHTML = `
    <div style="padding:24px 20px;color:#FFF;background:#1E3A5F;border-radius:8px;border:1px solid rgba(255,255,255,0.08);min-height:220px">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#F59E0B;margin-bottom:14px">Strategic Hubs · ${locations.length}</div>
      <ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px">
        ${items}
      </ul>
      <div style="margin-top:14px;font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:1px">Map view unavailable · showing locations as text</div>
    </div>`;
}


/**
 * Render a copy-to-clipboard URL card into `slot` when the QR
 * library is unavailable. The user can still SHARE the URL — they
 * just can't scan it with a phone camera. Includes a "Copy" button
 * that uses the Clipboard API (with a `<input>` selectAll fallback
 * for older browsers) and a label saying what to do.
 */
export function qrFallback(slot, url, label) {
  if (!slot) return;
  const safeUrlStr = safeUrl(url || '');
  const safeLabel = escapeHtml(label || 'Open this link on your phone');
  const id = 'qr-fallback-' + Math.random().toString(36).slice(2, 9);

  slot.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:16px;background:#FFF;border:1px solid #E2E8F0;border-radius:10px;font-family:inherit">
      <div style="font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#0059B3">${safeLabel}</div>
      <input id="${id}" type="text" readonly value="${escapeHtml(safeUrlStr)}"
             style="width:100%;padding:10px 12px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#0F172A;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:6px;outline:none">
      <button type="button" data-qr-fallback-copy="${id}"
              style="padding:9px 14px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#FFF;background:#0059B3;border:none;border-radius:6px;cursor:pointer">
        Copy link
      </button>
      <div style="font-size:10px;color:#64748B;letter-spacing:0.4px">QR view unavailable · share the link directly</div>
    </div>`;

  /* Wire the copy button. Uses Clipboard API where available;
     falls back to selecting + execCommand on older browsers. */
  const btn = slot.querySelector('[data-qr-fallback-copy]');
  const input = slot.querySelector('#' + id);
  if (!btn || !input) return;
  btn.addEventListener('click', async () => {
    const original = btn.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(input.value);
      } else {
        input.select();
        document.execCommand('copy');
      }
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = original; }, 1800);
    } catch {
      input.select();
    }
  });
}
