/**
 * Footer social-icon row (LinkedIn / Email / Schedule). HOMEPAGE ONLY.
 */
import { escapeHtml, safeUrl } from '../utils.js';

const SOCIAL_ICONS = {
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
};
export function renderSocial(container, items) {
  container.innerHTML = items.map(s => {
    const path = SOCIAL_ICONS[s.icon] || '';
    return `<a class="f-social-link" href="${escapeHtml(safeUrl(s.href))}"
      target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>
    </a>`;
  }).join('');
}
