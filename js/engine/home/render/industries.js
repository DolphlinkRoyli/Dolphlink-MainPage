/**
 * Industries We Serve — 4 primary verticals + 5 secondary "Also Serving".
 * HOMEPAGE ONLY.
 */
import { escapeHtml, safeCssColor } from '../utils.js';
import { getContent } from '../hydrate.js';

export function renderIndustries(container, items) {
  const buildCard = (it, mini) => {
    const chips = (it.chips || [])
      .map(c => `<span class="industry-chip">${escapeHtml(c)}</span>`)
      .join('');
    const safe = safeCssColor(it.color);
    const accent = safe ? ` style="--accent:${safe}"` : '';
    if (mini) {
      return `
        <article class="industry-card industry-card--mini" data-industry="${escapeHtml(it.key)}"${accent}>
          <h3 class="industry-name">${escapeHtml(it.name)}</h3>
          <p class="industry-desc">${escapeHtml(it.desc)}</p>
        </article>`;
    }
    return `
      <article class="industry-card" data-industry="${escapeHtml(it.key)}"${accent}>
        <h3 class="industry-name">${escapeHtml(it.name)}</h3>
        <p class="industry-desc">${escapeHtml(it.desc)}</p>
        <div class="industry-chips">${chips}</div>
      </article>`;
  };

  const hasTier = items.some(i => i.tier);
  if (!hasTier) {
    container.innerHTML = items.map(it => buildCard(it, false)).join('');
    return;
  }

  const content = getContent();
  const labels = (content && content.industries) || {};
  const primary   = items.filter(i => i.tier === 'primary');
  const secondary = items.filter(i => i.tier === 'secondary');
  container.innerHTML =
    `<div class="industries-tier industries-tier--primary">
       ${primary.map(it => buildCard(it, false)).join('')}
     </div>` +
    (secondary.length
      ? `<div class="industries-tier-label">${escapeHtml(labels.secondaryLabel || 'Also Serving')}</div>
         <div class="industries-tier industries-tier--secondary">
           ${secondary.map(it => buildCard(it, true)).join('')}
         </div>`
      : '');
}
