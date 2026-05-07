/**
 * Legal links — bottom-bar Privacy / Terms / Cookies / Subprocessors.
 * HOMEPAGE ONLY.
 */
import { escapeHtml, safeUrl } from '../utils.js';

export function renderLegalLinks(container, items) {
  container.innerHTML = items.map(l => `
    <li><a href="${escapeHtml(safeUrl(l.href))}">${escapeHtml(l.label)}</a></li>
  `).join('');
}
