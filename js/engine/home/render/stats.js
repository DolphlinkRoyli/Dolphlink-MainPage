/**
 * Performance Dashboard — 6 stat cards chained by causal arrows.
 * HOMEPAGE ONLY.
 *
 * Renders the 6 cards interleaved with .stat-connector spans (›) so the
 * grid reads left-to-right as a causal chain:
 *
 *   [99.999%] › [200+] › [<10s] › [360°] › [0-Trust] › [98%]
 *    bedrock    scale    speed    cycle    credential  outcome
 *
 * Each card shows a 3D icon (from media/icon/3D/) over the value, label
 * and gold-star rating, with the "View details ›" hint at the bottom.
 *
 * Cards are addressed in CSS by `data-stat` (sla / loc / lat / ain /
 * zer / open), NOT by :nth-child — the interleaved connectors would
 * otherwise shift the indices and break the FOUNDATION / DIFFERENTIATOR
 * / OUTCOME styling.
 */
import { escapeHtml } from '../utils.js';
import { iconHTML } from './icon-html.js';

const CONNECTOR = '<span class="stat-connector" aria-hidden="true">›</span>';

export function renderStats(container, stats) {
  const cards = stats.map(s => {
    const key = escapeHtml(s.key);
    return `
    <button type="button" class="stat-card" data-stat="${key}"
            data-modal-icon="${escapeHtml(s.icon)}"
            data-modal-eyebrow="${escapeHtml(s.value)}"
            data-modal-title="${escapeHtml(s.label)}"
            data-modal-text="${escapeHtml(s.desc)}"
            aria-haspopup="dialog">
      <span class="stat-icon-wrap" aria-hidden="true">
        ${iconHTML(s.icon, 64, 'stat-icon')}
      </span>
      <span class="stat-meta">
        <span class="stat-value">${escapeHtml(s.value)}</span>
        <span class="stat-label">${escapeHtml(s.label)}</span>
        <span class="stat-stars" aria-label="Gold standard rating">★★★★★</span>
      </span>
      <span class="click-hint" aria-hidden="true">View details <span class="hint-arrow">&rarr;</span></span>
    </button>
  `;
  });
  container.innerHTML = cards.join(CONNECTOR);
}
