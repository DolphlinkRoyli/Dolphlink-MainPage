/**
 * Industries We Serve — 3×3 grid of substantial cards.  HOMEPAGE ONLY.
 *
 * Each industry gets a monochrome line-art icon (24px viewBox, brand-blue
 * via currentColor) sitting at the top of its card.  The icon is the
 * card's identity anchor — without it, all 9 cards collapse into the
 * same visual register and nothing differentiates Banking from Hospitality
 * except the title text.  With it, each industry feels like a recognised
 * focus area, not a data row.
 *
 * Icons inspired by Heroicons / Lucide line-art style.  Kept simple:
 * 1.6 stroke, no fills (except small filled dots), 24×24 viewBox.
 */
import { escapeHtml } from '../utils.js';

/* -- 9 monochrome line-art icons, one per industry key -- */
const ICONS = {
  /* Banking & FinTech — classical bank building with columns */
  banking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L3 8 H21 Z"/>
    <path d="M5 11 V17"/><path d="M9 11 V17"/><path d="M15 11 V17"/><path d="M19 11 V17"/>
    <path d="M3 20 H21"/>
  </svg>`,

  /* Government & Public Sector — shield with checkmark (sovereign / vetted) */
  government: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2 L4 5 V11 C4 16 7.5 20.5 12 22 C16.5 20.5 20 16 20 11 V5 Z"/>
    <path d="M8.5 12 L11 14.5 L15.5 9.5"/>
  </svg>`,

  /* Healthcare — medical cross */
  healthcare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z"/>
  </svg>`,

  /* Insurance — umbrella (classic insurance metaphor) */
  insurance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11 C3 6.5 7 3 12 3 C17 3 21 6.5 21 11 H3 Z"/>
    <path d="M12 3 V11"/>
    <path d="M12 11 V19 C12 20.5 13 21.5 14 21.5 C15 21.5 16 20.5 16 19"/>
  </svg>`,

  /* Retail & E-Commerce — shopping bag */
  retail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 7 H19 L20 21 H4 Z"/>
    <path d="M8 10 V6 C8 3.8 9.8 2 12 2 C14.2 2 16 3.8 16 6 V10"/>
  </svg>`,

  /* Education — graduation cap */
  education: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4 L2 9 L12 14 L22 9 L12 4 Z"/>
    <path d="M6 11.3 V16 C6 17.4 8.7 19 12 19 C15.3 19 18 17.4 18 16 V11.3"/>
    <path d="M22 9 V14"/>
  </svg>`,

  /* Logistics — delivery truck */
  logistics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="13" height="9" rx="1"/>
    <path d="M15 11 H20 L22 14 V16 H15 Z"/>
    <circle cx="6.5" cy="17.5" r="1.5"/>
    <circle cx="17.5" cy="17.5" r="1.5"/>
  </svg>`,

  /* Entertainment & Gaming — game controller */
  entertainment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 8 H18 C20 8 22 10 22 13 C22 15.5 20.5 17.5 18.5 17.5 C17 17.5 16.5 16.5 15 16.5 H9 C7.5 16.5 7 17.5 5.5 17.5 C3.5 17.5 2 15.5 2 13 C2 10 4 8 6 8 Z"/>
    <line x1="6.8" y1="12.6" x2="9.2" y2="12.6"/>
    <line x1="8" y1="11.4" x2="8" y2="13.8"/>
    <circle cx="15.5" cy="11.5" r="0.8" fill="currentColor"/>
    <circle cx="17.5" cy="13.5" r="0.8" fill="currentColor"/>
  </svg>`,

  /* Hospitality — bed (hotel) */
  hospitality: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 19 V7"/>
    <path d="M22 19 V12"/>
    <path d="M2 12 H22"/>
    <path d="M2 16 H22"/>
    <path d="M6 12 V10 H10 V12"/>
  </svg>`,
};

function buildCard(it) {
  const icon = ICONS[it.key] || '';
  const chips = (it.chips || [])
    .map(c => `<span class="industry-chip">${escapeHtml(c)}</span>`)
    .join('');
  const key = escapeHtml(it.key);
  /* Photo at top of card (clean, no overlay). Icon moves to the LEFT
     of the industry name inside the body — better legibility than the
     translucent badge overlay, and the icon stays crisp on a white
     background instead of competing with photo content. */
  return `
    <article class="industry-card" data-industry="${key}">
      <figure class="industry-photo">
        <img src="media/industries/industry-${key}.webp"
             alt="${escapeHtml(it.name)} sector"
             loading="lazy" decoding="async">
      </figure>
      <div class="industry-body">
        <div class="industry-header">
          <span class="industry-icon" aria-hidden="true">${icon}</span>
          <h3 class="industry-name">${escapeHtml(it.name)}</h3>
        </div>
        <p class="industry-desc">${escapeHtml(it.desc)}</p>
        <div class="industry-chips">${chips}</div>
      </div>
    </article>`;
}

export function renderIndustries(container, items) {
  if (!Array.isArray(items)) return;
  container.innerHTML = items.map(buildCard).join('');
}
