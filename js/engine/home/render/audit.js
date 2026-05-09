/**
 * Trust Layer — 4 audit boxes (Compliance / Sovereignty / Reliability / Access).
 * HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';

/* (AUDIT_ICONS array removed — Roy spec: trust layer cards now render
   as text-only blocks, no SVG icon at the top-left. Cleaner, lighter. */

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
  container.innerHTML = items.map((a) => `
    <div class="audit-box">
      <h3>${escapeHtml(a.title)}</h3>
      <p>${highlightAuditKeywords(escapeHtml(a.desc))}</p>
    </div>
  `).join('');
}
