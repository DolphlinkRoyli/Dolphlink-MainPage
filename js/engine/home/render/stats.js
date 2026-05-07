/**
 * Reliability Matrix — 5 stat cards. Click → opens detail modal.
 * HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';
import { iconHTML }    from './icon-html.js';

export function renderStats(container, stats) {
  container.innerHTML = stats.map(s => `
    <button type="button" class="stat-card" data-stat="${escapeHtml(s.key)}"
            data-modal-icon="${escapeHtml(s.icon)}"
            data-modal-eyebrow="${escapeHtml(s.value)}"
            data-modal-title="${escapeHtml(s.label)}"
            data-modal-text="${escapeHtml(s.desc)}"
            aria-haspopup="dialog">
      <span class="stat-icon-wrap">${iconHTML(s.icon, 88, 'stat-icon')}</span>
      <span class="stat-meta">
        <span class="stat-value">${escapeHtml(s.value)}</span>
        <span class="stat-label">${escapeHtml(s.label)}</span>
        <span class="stat-stars" aria-label="Gold standard rating">★★★★★</span>
      </span>
      <span class="click-hint" aria-hidden="true">Click to view more <span class="hint-arrow">&rarr;</span></span>
    </button>
  `).join('');
}
