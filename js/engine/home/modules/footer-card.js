/**
 * Footer business card — vCard-style preview with QR code. HOMEPAGE ONLY.
 * Lazy-loaded: only fetches cards.json + qrcode.min.js when the
 * footer enters the viewport. If the QR library can't load, we
 * degrade to a copy-link card via ../fallbacks.js.
 */
import { escapeHtml, safeUrl } from '../utils.js';
import { loadScriptOnce } from '../lib-loader.js';
import { getContent } from '../hydrate.js';
import { qrFallback } from '../fallbacks.js';

function loadQrLib() {
  if (typeof window.qrcode !== 'undefined') return Promise.resolve(window.qrcode);
  return loadScriptOnce('lib/qrcode.min.js').then(() => window.qrcode);
}

/* Inline SVG paths for the 3 social actions (LinkedIn / Email / Schedule).
   Same icons that used to live in the footer bottom-bar — relocated INTO
   the Book-a-Briefing card so the bottom bar is left clean for the
   copyright line. */
const SOCIAL_ICONS = {
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  mail:     '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
};

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
  const social = Array.isArray(c.social) ? c.social : [];
  const socialHTML = social.map(s => {
    const path = SOCIAL_ICONS[s.icon] || '';
    if (!path) return '';
    return `<a class="vcard-social-link" href="${escapeHtml(safeUrl(s.href))}"
      target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>
    </a>`;
  }).join('');
  const socialBlock = socialHTML ? `
        <div class="vcard-connect">
          <span class="vcard-connect-label">${escapeHtml(c.socialLabel || 'Connect')}</span>
          <div class="vcard-connect-row">${socialHTML}</div>
        </div>` : '';
  target.innerHTML = `
    <div class="vcard-frame">
      <div class="vcard-left">
        <div class="vcard-brand">${escapeHtml(company)}</div>
        <div class="vcard-rule"></div>
        <div class="vcard-eyebrow">${escapeHtml(c.vcardEyebrow || 'Business Inquiry')}</div>
        <h3 class="vcard-heading">${escapeHtml(c.vcardHeading || 'Talk to Sales')}</h3>
        <p class="vcard-line">${escapeHtml(c.vcardLine1 || '')}</p>
        <p class="vcard-line vcard-line--muted">${escapeHtml(c.vcardLine2 || '')}</p>
        ${socialBlock}
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
