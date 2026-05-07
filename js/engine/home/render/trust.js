/**
 * Trust wall — Carrier Network & Compliance unified card. HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';

const REGULATOR_ICONS = {
  'ISO 27001': '<path d="M12 2 L20 5 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12 L11 14 L15 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'SOC 2':     '<rect x="5" y="11" width="14" height="9" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor"/>',
  'GDPR':      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  'MAS TRM':   '<path d="M3 12 L12 4 L21 12 L21 19 H3 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 19 V14 H15 V19" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  'IM8':       '<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9 H16 M8 12 H16 M8 15 H13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  'PDPA':      '<path d="M12 2 L20 6 V13 C20 17.5 16.5 21 12 22 C7.5 21 4 17.5 4 13 V6 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'
};

export function renderTrustWall(container, items, connect) {
  if (connect) {
    const goldHubIcon = `<svg class="trust-stat-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 12 L4 4 M12 12 L20 4 M12 12 L4 20 M12 12 L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="4" cy="4" r="1.6" fill="currentColor"/><circle cx="20" cy="4" r="1.6" fill="currentColor"/><circle cx="4" cy="20" r="1.6" fill="currentColor"/><circle cx="20" cy="20" r="1.6" fill="currentColor"/></svg>`;
    container.innerHTML = items.map((it) => {
      const name = it.name || '';
      const isStat = /\b\d[\d,]*\+?\b/.test(name);
      if (isStat) {
        const m = name.match(/^(\S+\+?)\s+(.+)$/);
        const num = m ? m[1] : name;
        const label = m ? m[2] : '';
        return `<div class="trust-stat">${goldHubIcon}<span class="trust-stat-text"><span class="trust-stat-number">${escapeHtml(num)}</span>${label ? `<span class="trust-stat-label">${escapeHtml(label)}</span>` : ''}</span></div>`;
      }
      return `<div class="trust-card"><span class="trust-card-text">${escapeHtml(name)}</span></div>`;
    }).join('');
  } else {
    container.innerHTML = items.map((it) => {
      const name = it.name || '';
      const iconPath = REGULATOR_ICONS[name];
      const icon = iconPath
        ? `<svg class="trust-card-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">${iconPath}</svg>`
        : '';
      return `<div class="trust-card">${icon}<span class="trust-card-text">${escapeHtml(name)}</span></div>`;
    }).join('');
  }
}
