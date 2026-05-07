/**
 * Hero KPI stat row — 3 compact stats. HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';

export function renderHeroStats(container, items) {
  container.innerHTML = items.map(s => `
    <div class="hero-stat">
      <span class="hero-stat-value">${escapeHtml(s.value)}</span>
      <span class="hero-stat-label">${escapeHtml(s.label)}</span>
    </div>
  `).join('');
}
