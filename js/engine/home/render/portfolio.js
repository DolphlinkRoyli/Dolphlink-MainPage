/**
 * Portfolio grid — 3 pillars × 3 products (9 cards total). HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';
import { getContent } from '../hydrate.js';
import { iconHTML }   from './icon-html.js';

export function buildPortfolioCard(p) {
  const tagline = p.tagline ? `<span class="portfolio-tagline">${escapeHtml(p.tagline)}</span>` : '';
  const recommend = p.recommend
    ? `<span class="portfolio-badge" data-tier="${escapeHtml(p.recommendTier || 'gold')}">${escapeHtml(p.recommend)}</span>`
    : '';
  return `
    <button type="button" class="btn-portfolio" data-portfolio="${escapeHtml(p.key)}"
            data-modal-icon="${escapeHtml(p.icon)}"
            data-modal-eyebrow="${escapeHtml(p.tagline || '')}"
            data-modal-title="${escapeHtml(p.label)}"
            data-modal-text="${escapeHtml(p.desc)}"
            aria-haspopup="dialog">
      ${recommend}
      ${tagline}
      <span class="portfolio-icon-wrap">${iconHTML(p.icon, 72, 'portfolio-icon')}</span>
      <span class="portfolio-label">${escapeHtml(p.label)}</span>
      <span class="click-hint" aria-hidden="true">Click to view more <span class="hint-arrow">&rarr;</span></span>
    </button>
  `;
}

/* Three-pillar layout: when content.portfolios.pillars is present,
   group items by `pillar` key and emit a small section header above
   each group. Falls back to a flat grid (legacy 9-card layout) if
   pillars metadata is missing. */
export function renderPortfolios(container, items) {
  const content = getContent();
  const pillars = (content && content.portfolios && content.portfolios.pillars) || null;
  if (!pillars || !Array.isArray(pillars) || !pillars.length) {
    container.innerHTML = items.map(buildPortfolioCard).join('');
    return;
  }
  const byPillar = {};
  items.forEach(p => {
    const k = p.pillar || 'other';
    (byPillar[k] = byPillar[k] || []).push(p);
  });
  container.innerHTML = pillars.map(pillar => {
    const list = byPillar[pillar.key] || [];
    if (!list.length) return '';
    return `
      <div class="portfolio-pillar" data-pillar="${escapeHtml(pillar.key)}">
        <header class="portfolio-pillar-head">
          <span class="portfolio-pillar-name">${escapeHtml(pillar.name)}</span>
          <span class="portfolio-pillar-tagline">${escapeHtml(pillar.tagline || '')}</span>
        </header>
        <p class="portfolio-pillar-desc">${escapeHtml(pillar.desc || '')}</p>
        <div class="portfolio-pillar-grid">
          ${list.map(buildPortfolioCard).join('')}
        </div>
      </div>
    `;
  }).join('');
}
