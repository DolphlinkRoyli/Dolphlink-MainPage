/**
 * Industries We Serve — flat 3×3 grid of 9 cards (the legacy primary /
 * secondary tier split was retired). HOMEPAGE ONLY.
 */
import { escapeHtml, safeCssColor } from '../utils.js';

function buildCard(it) {
  const chips = (it.chips || [])
    .map(c => `<span class="industry-chip">${escapeHtml(c)}</span>`)
    .join('');
  const safe = safeCssColor(it.color);
  const accent = safe ? ` style="--accent:${safe}"` : '';
  return `
    <article class="industry-card" data-industry="${escapeHtml(it.key)}"${accent}>
      <h3 class="industry-name">${escapeHtml(it.name)}</h3>
      <p class="industry-desc">${escapeHtml(it.desc)}</p>
      <div class="industry-chips">${chips}</div>
    </article>`;
}

export function renderIndustries(container, items) {
  if (!Array.isArray(items)) return;
  container.innerHTML = items.map(buildCard).join('');
}
