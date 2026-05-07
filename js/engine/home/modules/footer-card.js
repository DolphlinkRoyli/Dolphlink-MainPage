/**
 * Footer business card — vCard-style preview with QR code. HOMEPAGE ONLY.
 * Lazy-loaded: only fetches cards.json + qrcode.min.js when the
 * footer enters the viewport. If the QR library can't load, we
 * degrade to a copy-link card via ../fallbacks.js.
 */
import { escapeHtml } from '../utils.js';
import { loadScriptOnce } from '../lib-loader.js';
import { getContent } from '../hydrate.js';
import { qrFallback } from '../fallbacks.js';

function loadQrLib() {
  if (typeof window.qrcode !== 'undefined') return Promise.resolve(window.qrcode);
  return loadScriptOnce('lib/qrcode.min.js').then(() => window.qrcode);
}

export async function renderFooterCard() {
  const target = document.getElementById('footer-vcard');
  if (!target) return;
  let cards;
  try {
    const r = await fetch('content/cards.json', { cache: 'no-cache' });
    cards = await r.json();
  } catch (e) { return; }
  const m = (cards.members || []).find(function (x) {
    return (x.email || '').toLowerCase() === 'joycetsam@dolphlink.com' && x.active !== false;
  }) || {};
  const company = (cards.company && cards.company.shortName) || 'DOLPHLINK';
  const cardURL = (cards.config && cards.config.landingBase)
    ? cards.config.landingBase + '?u=' + ((m.email || 'joycetsam@dolphlink.com').split('@')[0].toLowerCase())
    : '';
  const content = getContent();
  const c = (content && content.footer) || {};
  target.innerHTML = `
    <div class="vcard-frame">
      <div class="vcard-left">
        <div class="vcard-brand">${escapeHtml(company)}</div>
        <div class="vcard-rule"></div>
        <div class="vcard-eyebrow">${escapeHtml(c.vcardEyebrow || 'Business Inquiry')}</div>
        <h3 class="vcard-heading">${escapeHtml(c.vcardHeading || 'Talk to Sales')}</h3>
        <p class="vcard-line">${escapeHtml(c.vcardLine1 || '')}</p>
        <p class="vcard-line vcard-line--muted">${escapeHtml(c.vcardLine2 || '')}</p>
      </div>
      <div class="vcard-right">
        <div class="vcard-qr" id="footer-vcard-qr" aria-hidden="true"></div>
        <div class="vcard-qr-hint">${escapeHtml(c.vcardScanLabel || 'Scan to Connect')}</div>
      </div>
    </div>`;
  try {
    const qrcode = await loadQrLib();
    if (cardURL) {
      const qr = qrcode(0, 'M');
      qr.addData(cardURL);
      qr.make();
      const slot = document.getElementById('footer-vcard-qr');
      if (slot) slot.innerHTML = qr.createImgTag(4, 0);
    }
  } catch (e) {
    /* QR lib missing → degrade to copy-link card so the URL still
       reaches the visitor. */
    const slot = document.getElementById('footer-vcard-qr');
    if (slot && cardURL) qrFallback(slot, cardURL, c.vcardScanLabel || 'Scan to Connect');
  }
}
