/**
 * Trust Layer — 4 audit boxes (Compliance / Sovereignty / Reliability / Access).
 * HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';

const AUDIT_ICONS = [
  '<path d="M12 2 L20 5 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V5 Z"/>',
  '<path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 Z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 14 11 16 15 12"/>',
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>',
  '<circle cx="8" cy="14" r="4"/><line x1="11" y1="11" x2="22" y2="2"/><line x1="17" y1="7" x2="20" y2="10"/><line x1="14" y1="10" x2="17" y2="13"/>'
];

/* Key compliance terms that should render in gold + bold inside an
   audit-box description. Order matters — longest matches first so
   "PDPA Singapore" wins over plain "PDPA". Word boundaries prevent
   partial-word hits. */
const AUDIT_KEYWORDS = [
  'PDPA Singapore', 'ISO 27001', 'MAS TRM', 'SOC 2',
  'GDPR', 'PDPA', 'IM8'
];
function highlightAuditKeywords(escapedText) {
  let out = escapedText;
  for (const kw of AUDIT_KEYWORDS) {
    // kw is plain ASCII so a literal regex with `g` flag is safe.
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'g');
    out = out.replace(re, (m) => `<span class="audit-keyword">${m}</span>`);
  }
  return out;
}

export function renderAudit(container, items) {
  container.innerHTML = items.map((a, i) => `
    <div class="audit-box">
      <svg class="audit-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AUDIT_ICONS[i] || AUDIT_ICONS[0]}</svg>
      <h3>${escapeHtml(a.title)}</h3>
      <p>${highlightAuditKeywords(escapeHtml(a.desc))}</p>
    </div>
  `).join('');
}
