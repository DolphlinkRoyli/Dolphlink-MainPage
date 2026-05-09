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
 * Card 5 (key="zer") shows value "0-Trust" and label "Trust (TaaS)" —
 * Zero Implicit Trust framed as Trust-as-a-Service. Sits at 2.2fr column
 * with GOLD top accent (sovereign credential color) — distinct from
 * card 6 (Open Rate) which has GREEN top + green ✓ stamp (verified
 * outcome). Two emphasis cards, two roles: TaaS = credential anchor,
 * Open Rate = downstream verified result. Connector between them is
 * green-tinted to bridge into the outcome zone.
 *
 * Cards are addressed in CSS by `data-stat` (sla / loc / lat / ain / open),
 * NOT by :nth-child — the interleaved connectors would otherwise shift the
 * indices and break the FOUNDATION / DIFFERENTIATOR / OUTCOME styling.
 */
import { escapeHtml } from '../utils.js';
import { iconHTML }    from './icon-html.js';

const CONNECTOR = '<span class="stat-connector" aria-hidden="true">›</span>';

export function renderStats(container, stats) {
  const cards = stats.map(s => `
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
      <span class="click-hint" aria-hidden="true">View details <span class="hint-arrow">&rarr;</span></span>
    </button>
  `);
  container.innerHTML = cards.join(CONNECTOR);
}
