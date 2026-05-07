/**
 * Top-nav menu items. HOMEPAGE ONLY.
 */
import { escapeHtml, safeUrl } from '../utils.js';

export function renderMenu(container, items) {
  container.innerHTML = items.map(m => {
    const label = escapeHtml(m.label);
    if (m.scrollTo) {
      const id = escapeHtml(m.scrollTo);
      return `<a href="#${id}" data-scroll-to="${id}" class="menu-item">${label}</a>`;
    }
    if (m.href) {
      const target = m.target ? ` target="${escapeHtml(m.target)}" rel="noopener noreferrer"` : '';
      return `<a href="${escapeHtml(safeUrl(m.href))}" class="menu-item"${target}>${label}</a>`;
    }
    return '';
  }).join('');
}
