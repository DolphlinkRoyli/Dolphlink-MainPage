// =============================================================
// Content pipeline — all editable copy + chart data is injected
// from content/content.json. Workflow: edit JSON → push → deploy.
// HTML keeps fallback text that shows only if the fetch fails.
// =============================================================
let CONTENT = null;          // Cached JSON payload
let baiwuLocations = [];     // Map points (populated from JSON)

// Resolve dotted path "a.b.c" against an object
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// HTML entity escape — defends DOM from special characters in JSON copy
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// Expand date tokens: {Q} {MMM} {YYYY} {Q-MMM YYYY}
// Lets CMS author write "Verified {Q-MMM YYYY}" and have it auto-update every month.
const MONTHS_3 = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function expandDateTokens(s) {
  if (!s.includes('{')) return s;
  const now = new Date();
  const m = now.getMonth();
  const Q = 'Q' + (Math.floor(m / 3) + 1);
  const MMM = MONTHS_3[m];
  const YYYY = String(now.getFullYear());
  return s
    .replace(/\{Q-MMM YYYY\}/g, `${Q}-${MMM} ${YYYY}`)
    .replace(/\{Q-MMM\}/g, `${Q}-${MMM}`)
    .replace(/\{MMM YYYY\}/g, `${MMM} ${YYYY}`)
    .replace(/\{Q\}/g, Q)
    .replace(/\{MMM\}/g, MMM)
    .replace(/\{YYYY\}/g, YYYY);
}

// Replace text of every [data-key] element with the matching JSON value.
function applyTextContent(root) {
  root.querySelectorAll('[data-key]').forEach(el => {
    let v = getByPath(CONTENT, el.dataset.key);
    if (typeof v !== 'string') return;
    v = expandDateTokens(v);                       // {Q-MMM YYYY} → Q1-MAR 2026
    el.textContent = v;
  });
  // [data-href-key] swaps the href; optional [data-href-prefix] adds e.g. "mailto:"
  root.querySelectorAll('[data-href-key]').forEach(el => {
    const v = getByPath(CONTENT, el.dataset.hrefKey);
    if (typeof v === 'string') {
      const prefix = el.dataset.hrefPrefix || '';
      el.setAttribute('href', prefix + v);
    }
  });
}

// Render the 4 reliability stat-cards. Click → opens a modal with full description.
function renderStats(container, stats) {
  container.innerHTML = stats.map(s => {
    const builder = SVG_ICON_BUILDERS[s.icon];
    const iconHTML = builder
      ? builder(88, 'stat-icon stat-icon-svg')
      : `<img src="media/icon/3D/${escapeHtml(s.icon)}.webp" alt="" class="stat-icon" width="88" height="88" loading="lazy" decoding="async" />`;
    return `
    <button type="button" class="stat-card" data-stat="${escapeHtml(s.key)}"
            data-modal-icon="${escapeHtml(s.icon)}"
            data-modal-eyebrow="${escapeHtml(s.value)}"
            data-modal-title="${escapeHtml(s.label)}"
            data-modal-text="${escapeHtml(s.desc)}"
            aria-haspopup="dialog">
      <span class="stat-icon-wrap">${iconHTML}</span>
      <span class="stat-meta">
        <span class="stat-value">${escapeHtml(s.value)}</span>
        <span class="stat-label">${escapeHtml(s.label)}</span>
        <span class="stat-stars" aria-label="Gold standard rating">★★★★★</span>
      </span>
      <span class="click-hint" aria-hidden="true">Click to view more <span class="hint-arrow">&rarr;</span></span>
    </button>
  `;
  }).join('');
}

// Inline SVG icons — replace webp files for icons that ship with the
// wrong style or alpha channel. All builders share the same brand-blue
// gradient + white-detail visual language so the portfolio grid reads
// as one coherent set. Same builder is reused at 72px (grid) and 104px
// (detail panel) by varying the `size` arg.
function svgGradDef(size, slug) {
  const gid = 'dlpkG_' + slug + '_' + size;
  return {
    gid: gid,
    defs: `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0073D9"/><stop offset="100%" stop-color="#003D80"/></linearGradient></defs>`
  };
}
function svgWrap(size, cls, body) {
  return `<svg class="${cls}" viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

// Phone Numbers (replaces icon_14.webp outlined frame)
function buildPhoneSvg(size, extraClass) {
  const g = svgGradDef(size, 'phone');
  return svgWrap(size, extraClass, g.defs +
    `<rect x="18" y="5" width="28" height="54" rx="5" ry="5" fill="url(#${g.gid})"/>` +
    `<rect x="21" y="11" width="22" height="38" rx="1.6" ry="1.6" fill="#FFFFFF"/>` +
    `<rect x="28.5" y="8" width="7" height="1.4" rx="0.7" ry="0.7" fill="#FFFFFF" opacity="0.6"/>` +
    `<circle cx="38" cy="8.7" r="0.7" fill="#FFFFFF" opacity="0.6"/>` +
    `<circle cx="32" cy="54" r="2" fill="#FFFFFF" opacity="0.45"/>`);
}

// SMS Platform — chat bubble with three typing dots
function buildSmsSvg(size, extraClass) {
  const g = svgGradDef(size, 'sms');
  return svgWrap(size, extraClass, g.defs +
    `<path d="M10 14 H50 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 H26 l-9 8 v-8 h-3 a4 4 0 0 1 -4 -4 V18 a4 4 0 0 1 4 -4 z" fill="url(#${g.gid})"/>` +
    `<circle cx="22" cy="28" r="2.6" fill="#FFFFFF"/>` +
    `<circle cx="32" cy="28" r="2.6" fill="#FFFFFF"/>` +
    `<circle cx="42" cy="28" r="2.6" fill="#FFFFFF"/>`);
}

// Dolphlink One-API — central hub with 4 branching channels
function buildOneApiSvg(size, extraClass) {
  const g = svgGradDef(size, 'oneapi');
  return svgWrap(size, extraClass, g.defs +
    // 4 connector lines
    `<line x1="32" y1="32" x2="32" y2="10" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="32" y2="54" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="10" y2="32" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="54" y2="32" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    // 4 endpoint nodes
    `<circle cx="32" cy="10" r="3.2" fill="#0059B3"/>` +
    `<circle cx="32" cy="54" r="3.2" fill="#0059B3"/>` +
    `<circle cx="10" cy="32" r="3.2" fill="#0059B3"/>` +
    `<circle cx="54" cy="32" r="3.2" fill="#0059B3"/>` +
    // central hub
    `<circle cx="32" cy="32" r="11" fill="url(#${g.gid})"/>` +
    `<text x="32" y="35.8" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">API</text>`);
}

// Operations Hub — desktop monitor with bar chart + pie
function buildHubSvg(size, extraClass) {
  const g = svgGradDef(size, 'hub');
  return svgWrap(size, extraClass, g.defs +
    // monitor frame
    `<rect x="6" y="10" width="52" height="36" rx="3" fill="url(#${g.gid})"/>` +
    // inner screen
    `<rect x="9" y="13" width="46" height="30" rx="1" fill="#FFFFFF"/>` +
    // bars
    `<rect x="13" y="32" width="4" height="9" fill="#0059B3"/>` +
    `<rect x="19" y="27" width="4" height="14" fill="#0059B3"/>` +
    `<rect x="25" y="22" width="4" height="19" fill="#0059B3"/>` +
    // pie chart
    `<circle cx="44" cy="29" r="7" fill="#0059B3" opacity="0.32"/>` +
    `<path d="M44 22 A7 7 0 0 1 51 29 L44 29 z" fill="#0059B3"/>` +
    // stand
    `<rect x="28" y="46" width="8" height="3" fill="url(#${g.gid})"/>` +
    `<rect x="20" y="49" width="24" height="3" rx="1.5" fill="url(#${g.gid})"/>`);
}

// AI-Digital Solutions — human silhouette + connected AI nodes
function buildAiDigitalSvg(size, extraClass) {
  const g = svgGradDef(size, 'aidigital');
  return svgWrap(size, extraClass, g.defs +
    // connector lines first (render below nodes)
    `<line x1="24" y1="22" x2="46" y2="14" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="24" y1="22" x2="52" y2="30" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="24" y1="22" x2="46" y2="46" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    // human head + shoulders silhouette
    `<circle cx="22" cy="22" r="8" fill="url(#${g.gid})"/>` +
    `<path d="M10 56 V46 a12 12 0 0 1 24 0 v10 z" fill="url(#${g.gid})"/>` +
    // AI network nodes
    `<circle cx="46" cy="14" r="3.5" fill="url(#${g.gid})"/>` +
    `<circle cx="52" cy="30" r="3.5" fill="url(#${g.gid})"/>` +
    `<circle cx="46" cy="46" r="3.5" fill="url(#${g.gid})"/>` +
    // node centers (white dots for tech feel)
    `<circle cx="46" cy="14" r="1.2" fill="#FFFFFF"/>` +
    `<circle cx="52" cy="30" r="1.2" fill="#FFFFFF"/>` +
    `<circle cx="46" cy="46" r="1.2" fill="#FFFFFF"/>`);
}

// ---------------------------------------------------------------
// Stat icons — reliability matrix (4 of them)
// ---------------------------------------------------------------

// Uptime — circular monitor dial with concentric ring + heartbeat curve
// + live indicator dot. Square aspect, sits cleanly with the other 3
// stat icons.
function buildUptimeSvg(size, extraClass) {
  const g = svgGradDef(size, 'uptime');
  return svgWrap(size, extraClass, g.defs +
    // outer disc
    `<circle cx="32" cy="32" r="24" fill="url(#${g.gid})"/>` +
    // inner ring (faint scale guide)
    `<circle cx="32" cy="32" r="19" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.28"/>` +
    // heartbeat trace
    `<path d="M14 32 H22 L25 24 L30 42 L34 20 L38 34 L42 32 H50" stroke="#FFFFFF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    // live indicator pulse on the right
    `<circle cx="50" cy="32" r="2.4" fill="#FFFFFF"/>` +
    `<circle cx="50" cy="32" r="4.2" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.5"/>`);
}

// Countries — globe with meridians + pins
function buildCountriesSvg(size, extraClass) {
  const g = svgGradDef(size, 'countries');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="32" r="22" fill="url(#${g.gid})"/>` +
    `<line x1="10" y1="32" x2="54" y2="32" stroke="#FFFFFF" stroke-width="1.4" opacity="0.5"/>` +
    `<ellipse cx="32" cy="32" rx="22" ry="9" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity="0.5"/>` +
    `<path d="M32 10 Q44 32 32 54" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity="0.45"/>` +
    `<path d="M32 10 Q20 32 32 54" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity="0.45"/>` +
    `<circle cx="24" cy="22" r="2" fill="#FFFFFF"/>` +
    `<circle cx="42" cy="28" r="2" fill="#FFFFFF"/>` +
    `<circle cx="36" cy="42" r="2" fill="#FFFFFF"/>`);
}

// Velocity — lightning bolt + speed lines
function buildVelocitySvg(size, extraClass) {
  const g = svgGradDef(size, 'velocity');
  return svgWrap(size, extraClass, g.defs +
    `<line x1="4" y1="20" x2="14" y2="20" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="2" y1="32" x2="10" y2="32" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.5"/>` +
    `<line x1="6" y1="44" x2="12" y2="44" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.4"/>` +
    `<path d="M38 6 L18 36 L28 36 L24 58 L46 28 L34 28 Z" fill="url(#${g.gid})"/>`);
}

// Open Rate — opened envelope with checkmark badge above + faint sparkle
// rays. Reads as "message has been opened and confirmed seen".
function buildOpenRateSvg(size, extraClass) {
  const g = svgGradDef(size, 'openrate');
  return svgWrap(size, extraClass, g.defs +
    // envelope rectangle (back panel)
    `<rect x="8" y="22" width="48" height="30" rx="3" fill="url(#${g.gid})"/>` +
    // V-shape interior (envelope is open — flap folded back)
    `<path d="M8 24 L32 42 L56 24" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>` +
    // checkmark badge floating above the envelope
    `<circle cx="46" cy="14" r="8" fill="url(#${g.gid})" stroke="#FFFFFF" stroke-width="1.4"/>` +
    `<path d="M42.5 14.5 L45 17 L50 11" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    // sparkle rays around the badge
    `<line x1="36" y1="9"  x2="34" y2="6"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>` +
    `<line x1="56" y1="9"  x2="58" y2="6"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>` +
    `<line x1="46" y1="2"  x2="46" y2="5"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`);
}

// AI×H Lifecycle — microchip with AI label
function buildAiHSvg(size, extraClass) {
  const g = svgGradDef(size, 'aih');
  // 4 pins on each side
  let pins = '';
  [20, 27, 35, 42].forEach(p => {
    pins += `<rect x="${p}" y="6" width="2" height="6" fill="#0059B3"/>`;
    pins += `<rect x="${p}" y="52" width="2" height="6" fill="#0059B3"/>`;
    pins += `<rect x="6" y="${p}" width="6" height="2" fill="#0059B3"/>`;
    pins += `<rect x="52" y="${p}" width="6" height="2" fill="#0059B3"/>`;
  });
  return svgWrap(size, extraClass, g.defs + pins +
    `<rect x="14" y="14" width="36" height="36" rx="4" fill="url(#${g.gid})"/>` +
    `<rect x="20" y="20" width="24" height="24" rx="2" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.3"/>` +
    `<text x="32" y="37" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="900" fill="#FFFFFF">AI</text>`);
}

// ---------------------------------------------------------------
// Portfolio icons — additional 4 (besides SMS/One-API/Hub/AI-Digital/Phone)
// ---------------------------------------------------------------

// Nexus — orchestration hub with 6 connected node satellites
function buildNexusSvg(size, extraClass) {
  const g = svgGradDef(size, 'nexus');
  // 6 nodes around hexagonal positions
  const nodes = [
    [32, 8], [52, 20], [52, 44],
    [32, 56], [12, 44], [12, 20]
  ];
  let lines = '';
  let dots = '';
  nodes.forEach(([x, y]) => {
    lines += `<line x1="32" y1="32" x2="${x}" y2="${y}" stroke="#0059B3" stroke-width="1.6" opacity="0.7"/>`;
    dots += `<circle cx="${x}" cy="${y}" r="3.2" fill="#0059B3"/>`;
    dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="#FFFFFF"/>`;
  });
  return svgWrap(size, extraClass, g.defs + lines + dots +
    `<circle cx="32" cy="32" r="11" fill="url(#${g.gid})"/>` +
    `<circle cx="32" cy="32" r="3.2" fill="#FFFFFF"/>`);
}

// Touch — finger pointing up + ripple rings around touch point
function buildTouchSvg(size, extraClass) {
  const g = svgGradDef(size, 'touch');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="22" r="14" fill="none" stroke="#0059B3" stroke-width="1.4" opacity="0.3"/>` +
    `<circle cx="32" cy="22" r="9" fill="none" stroke="#0059B3" stroke-width="1.6" opacity="0.55"/>` +
    `<circle cx="32" cy="22" r="4" fill="url(#${g.gid})"/>` +
    `<path d="M28 60 L28 38 a4 4 0 0 1 8 0 V36" fill="url(#${g.gid})"/>`);
}

// Smart — light bulb (idea / intelligence)
function buildSmartSvg(size, extraClass) {
  const g = svgGradDef(size, 'smart');
  return svgWrap(size, extraClass, g.defs +
    // bulb body (hand-drawn rounded shape)
    `<path d="M32 6 a14 14 0 0 1 9 24 q-2 2 -2 5 v3 h-14 v-3 q0 -3 -2 -5 a14 14 0 0 1 9 -24 z" fill="url(#${g.gid})"/>` +
    // filament squiggle inside
    `<path d="M27 22 L30 28 L34 28 L37 22" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    // base layers
    `<rect x="24" y="44" width="16" height="3" rx="1" fill="#003D80"/>` +
    `<rect x="26" y="49" width="12" height="2" fill="#003D80"/>` +
    `<rect x="28" y="53" width="8" height="4" rx="1" fill="#003D80"/>`);
}

// Voice & SIP — phone receiver inside a brand-blue disc
function buildVoiceSvg(size, extraClass) {
  const g = svgGradDef(size, 'voice');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="32" r="24" fill="url(#${g.gid})"/>` +
    // Lucide-style phone path scaled into a 24x24 region centered at (20,20)
    `<g transform="translate(20 20)" fill="#FFFFFF">` +
      `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>` +
    `</g>`);
}

// Map of icon-name → SVG builder. main.js consults this both in the
// stat strip + portfolio strip render AND in the click-through detail
// panel. Every icon listed here renders as inline SVG; anything not
// listed falls back to the original webp from media/icon/3D/<name>.webp.
const SVG_ICON_BUILDERS = {
  // Reliability Matrix (stats)
  icon_3:  buildOpenRateSvg,
  icon_5:  buildCountriesSvg,
  icon_6:  buildUptimeSvg,
  icon_7:  buildAiHSvg,
  icon_10: buildVelocitySvg,
  // Industrial Portfolios
  icon_1:  buildNexusSvg,
  icon_2:  buildHubSvg,
  icon_4:  buildSmsSvg,
  icon_8:  buildOneApiSvg,
  icon_9:  buildAiDigitalSvg,
  icon_11: buildTouchSvg,
  icon_12: buildSmartSvg,
  icon_13: buildVoiceSvg,
  icon_14: buildPhoneSvg
};

// Render the portfolio cards. Click → opens a modal with full description.
// Each card carries a top-left "recommendation badge" (FLAGSHIP / PROVEN /
// TOP PICK / NEW / etc.) sourced from content.json's `recommend` field.
// `data-recommend-tier` lets CSS apply different chromatic accents per tier
// (gold for premium tiers, blue for foundational, green for trending).
function renderPortfolios(container, items) {
  container.innerHTML = items.map(p => {
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
      <span class="portfolio-icon-wrap">${
        SVG_ICON_BUILDERS[p.icon]
          ? SVG_ICON_BUILDERS[p.icon](72, 'portfolio-icon portfolio-icon-svg')
          : `<img src="media/icon/3D/${escapeHtml(p.icon)}.webp" alt="" class="portfolio-icon" width="72" height="72" loading="lazy" decoding="async" />`
      }</span>
      <span class="portfolio-label">${escapeHtml(p.label)}</span>
      <span class="click-hint" aria-hidden="true">Click to view more <span class="hint-arrow">&rarr;</span></span>
    </button>
  `;
  }).join('');
}

// Render the nav menu (variable count from menu.csv)
function renderMenu(container, items) {
  container.innerHTML = items.map(m => {
    const label = escapeHtml(m.label);
    if (m.scrollTo) {
      const id = escapeHtml(m.scrollTo);
      return `<a href="#${id}" data-scroll-to="${id}" class="menu-item">${label}</a>`;
    }
    if (m.href) {
      const target = m.target ? ` target="${escapeHtml(m.target)}" rel="noopener noreferrer"` : '';
      return `<a href="${escapeHtml(m.href)}" class="menu-item"${target}>${label}</a>`;
    }
    return '';
  }).join('');
}

// Render the 4 audit boxes (each box keeps its own positional SVG icon)
const AUDIT_ICONS = [
  '<path d="M12 2 L20 5 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V5 Z"/>',
  '<path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 Z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 14 11 16 15 12"/>',
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>',
  '<circle cx="8" cy="14" r="4"/><line x1="11" y1="11" x2="22" y2="2"/><line x1="17" y1="7" x2="20" y2="10"/><line x1="14" y1="10" x2="17" y2="13"/>'
];
function renderAudit(container, items) {
  container.innerHTML = items.map((a, i) => `
    <div class="audit-box">
      <svg class="audit-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AUDIT_ICONS[i] || AUDIT_ICONS[0]}</svg>
      <h3>${escapeHtml(a.title)}</h3>
      <p>${escapeHtml(a.desc)}</p>
    </div>
  `).join('');
}
// NOTE: audit boxes are not clickable cards — they are just informational
// boxes, so no click-hint is rendered for them. Only stat-card +
// btn-portfolio carry the "click to view more" affordance.

// Industries grid — 6 cards sharing the same visual DNA as the
// Departments strip below: white card on light section bg with a
// brand-blue left blade. The blade picks up the industry's signature
// color via `--accent` for subtle differentiation between cards.
// No "Learn More" links yet (industry landing pages aren't built),
// no numbered prefix — just name + description + compliance chips.
function renderIndustries(container, items) {
  container.innerHTML = items.map(it => {
    const chips = (it.chips || [])
      .map(c => `<span class="industry-chip">${escapeHtml(c)}</span>`)
      .join('');
    const accent = it.color ? ` style="--accent:${escapeHtml(it.color)}"` : '';
    return `
    <article class="industry-card" data-industry="${escapeHtml(it.key)}"${accent}>
      <h3 class="industry-name">${escapeHtml(it.name)}</h3>
      <p class="industry-desc">${escapeHtml(it.desc)}</p>
      <div class="industry-chips">${chips}</div>
    </article>`;
  }).join('');
}

// Departments strip — 3 functional teams that DOLPHLINK serves inside
// each customer organisation. Lighter card treatment than industries
// (white card + brand-blue blade) — secondary dimension to industries.
function renderDepartments(container, items) {
  container.innerHTML = items.map(d => `
    <div class="department-card" data-department="${escapeHtml(d.key)}">
      <h4 class="department-name">${escapeHtml(d.name)}</h4>
      <p class="department-desc">${escapeHtml(d.desc)}</p>
    </div>
  `).join('');
}

// Footer legal links — Privacy / Terms / Cookies / Subprocessors.
// Renders as inline list items above the copyright line.
function renderLegalLinks(container, items) {
  container.innerHTML = items.map(l => `
    <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>
  `).join('');
}

// Footer business card — fetches cards.json, picks the featured
// member (Joyce Tsam — local part `joycetsam`), renders a compact
// vCard preview with name + role + contact lines + QR code linking
// to her public landing page (/c/?u=joycetsam). Lazy-loads the
// `qrcode-generator` library on demand (same library + CDN as the
// in-page Briefing modal — no duplicate dependency).
let qrLibLoadingP = null;
async function loadQrLib() {
  if (window.qrcode) return window.qrcode;
  qrLibLoadingP = qrLibLoadingP || new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.onload = function () { resolve(window.qrcode); };
    s.onerror = function () { reject(new Error('qr load failed')); };
    document.head.appendChild(s);
  });
  return qrLibLoadingP;
}
async function renderFooterCard() {
  const target = document.getElementById('footer-vcard');
  if (!target) return;
  let cards;
  try {
    const r = await fetch('content/cards.json', { cache: 'no-cache' });
    cards = await r.json();
  } catch (e) { return; }
  // QR still resolves to Joyce's vCard landing page (saves real contact
  // when scanned), but the visible card text is generic "Business
  // Inquiry / Talk to Sales" rather than her personal name + email.
  const m = (cards.members || []).find(function (x) {
    return (x.email || '').toLowerCase() === 'joycetsam@dolphlink.com' && x.active !== false;
  }) || {};
  const company = (cards.company && cards.company.shortName) || 'DOLPHLINK';
  const cardURL = (cards.config && cards.config.landingBase)
    ? cards.config.landingBase + '?u=' + ((m.email || 'joycetsam@dolphlink.com').split('@')[0].toLowerCase())
    : '';
  // Pull copy from content.json (footer.vcard*) so wording is editable
  const c = (CONTENT && CONTENT.footer) || {};
  target.innerHTML = `
    <div class="vcard-frame">
      <div class="vcard-left">
        <div class="vcard-brand">${escapeHtml(company)}</div>
        <div class="vcard-rule"></div>
        <div class="vcard-eyebrow">${escapeHtml(c.vcardEyebrow || 'Business Inquiry')}</div>
        <h3 class="vcard-heading">${escapeHtml(c.vcardHeading || 'Talk to Sales')}</h3>
        <p class="vcard-line">${escapeHtml(c.vcardLine1 || '')}</p>
        <p class="vcard-line vcard-line--muted">${escapeHtml(c.vcardLine2 || '')}</p>
      </div>
      <div class="vcard-right">
        <div class="vcard-qr" id="footer-vcard-qr" aria-hidden="true"></div>
        <div class="vcard-qr-hint">${escapeHtml(c.vcardScanLabel || 'Scan to Connect')}</div>
      </div>
    </div>`;
  // Generate QR (lazy-load lib if not already)
  try {
    const qrcode = await loadQrLib();
    if (cardURL) {
      const qr = qrcode(0, 'M');
      qr.addData(cardURL);
      qr.make();
      const slot = document.getElementById('footer-vcard-qr');
      if (slot) slot.innerHTML = qr.createImgTag(4, 0);
    }
  } catch (e) { /* QR optional — silently fall through */ }
}

// Footer social row — icon + accessible label. Inline SVG so we
// don't need extra HTTP requests / icon font dependencies.
const SOCIAL_ICONS = {
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
};
function renderSocial(container, items) {
  container.innerHTML = items.map(s => {
    const path = SOCIAL_ICONS[s.icon] || '';
    return `<a class="f-social-link" href="${escapeHtml(s.href)}"
      target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(s.name)}" title="${escapeHtml(s.name)}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>
    </a>`;
  }).join('');
}

// Trust wall — render carrier and regulator wordmarks as styled text.
// Each mark gets its own --i index so a staggered "lighting wave" travels
// through the row (CSS `animation-delay: calc(var(--i) * 0.18s)`). The
// outer `.trust-loop` slides horizontally for marquee. Items are duplicated
// once so the CSS can wrap with translateX(-50%) seamlessly.
//
// `connect: true` inserts a `<span class="trust-link">` between items so
// the carrier row reads as a connected network bus (thin gold line + a
// glowing node dot at the midpoint). Compliance row keeps simple gaps.
function renderTrustWall(container, items, connect) {
  const total = items.length;
  const link = '<span class="trust-link" aria-hidden="true"></span>';
  const buildSet = (offset) => items.map((it, idx) =>
    `<span class="trust-mark" style="--i:${(offset + idx) % total}">${escapeHtml(it.name)}</span>`
  ).join(connect ? link : '');
  // For connected mode, also place a link BETWEEN the two duplicated sets
  // so the connection wraps cleanly through the marquee loop.
  const sep = connect ? link : '';
  container.innerHTML =
    `<div class="trust-loop" style="--n:${total}">${buildSet(0)}${sep}${buildSet(0)}</div>`;
}

// Content version — bump this when CSV/JSON changes so browsers bypass stale cache.
// Ties together: cache-buster query param + visible version in <html data-content-version>.
const CONTENT_VERSION = '20260507n';

// Hide the inline pre-read loader (defined in index.html). Called once
// content.json is rendered, AND defensively after a 5s timeout in case
// the network is dead — never leave the user staring at a spinner.
function hideLoader() {
  const loader = document.getElementById('dlpk-loader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
    setTimeout(() => loader.parentNode && loader.parentNode.removeChild(loader), 600);
  }
}
setTimeout(hideLoader, 5000);

// Emergency banner — shown when content.json fetch fails AND no SW cache
// exists (e.g. first-ever visit on a dead network). Without this the page
// would render blank since fallback HTML was intentionally cleared.
function showEmergencyBanner() {
  if (document.getElementById('dlpk-emergency')) return;
  const div = document.createElement('div');
  div.id = 'dlpk-emergency';
  div.style.cssText =
    'position:fixed;inset:0;z-index:9998;background:#FFFFFF;display:flex;' +
    'align-items:center;justify-content:center;flex-direction:column;gap:24px;' +
    "padding:32px;font-family:'Inter',system-ui,-apple-system,sans-serif;text-align:center;";
  div.innerHTML =
    '<div style="font-size:11px;font-weight:800;letter-spacing:4.5px;color:#0059B3;">DOLPHLINK</div>' +
    '<h1 style="font-size:20px;font-weight:700;color:#0F172A;margin:0;letter-spacing:.4px;">' +
    'We could not load this page</h1>' +
    '<p style="font-size:14px;color:#475569;max-width:380px;margin:0;line-height:1.6;">' +
    'Check your connection and reload, or reach us directly while we look into it.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">' +
    '<button type="button" id="dlpk-emergency-reload" style="' +
    "padding:12px 24px;background:#0059B3;color:#FFFFFF;border:none;border-radius:8px;" +
    "font-family:inherit;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;" +
    'cursor:pointer;">Reload</button>' +
    '<a href="mailto:Salesmarketing@dolphlink.com?cc=Joycetsam@dolphlink.com" style="' +
    "padding:12px 24px;background:#FFFFFF;color:#0059B3;border:1.5px solid #BF9430;border-radius:8px;" +
    "font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;" +
    '">Email Sales</a>' +
    '</div>';
  document.body.appendChild(div);
  const reloadBtn = document.getElementById('dlpk-emergency-reload');
  if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
}

// Entry point — fetch content.json then patch the page
async function loadAndRender() {
  try {
    const r = await fetch(`content/content.json?v=${CONTENT_VERSION}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error('fetch failed');
    CONTENT = await r.json();
  } catch (e) {
    console.warn('[content] JSON load failed; showing emergency banner', e);
    showEmergencyBanner();
    hideLoader();
    return;
  }

  // 1) Patch [data-key] text + [data-href-key] hrefs
  applyTextContent(document);

  // 2) Render repeating structures (stats / portfolios / audit boxes)
  document.querySelectorAll('[data-render]').forEach(node => {
    const key = node.dataset.render;
    const data = getByPath(CONTENT, key);
    if (!Array.isArray(data)) return;
    if (key === 'reliability.stats') renderStats(node, data);
    else if (key === 'portfolios.items') renderPortfolios(node, data);
    else if (key === 'audit.items') renderAudit(node, data);
    else if (key === 'nav.menuItems') renderMenu(node, data);
    else if (key === 'trustWall.operators') renderTrustWall(node, data, true);
    else if (key === 'trustWall.regulators') renderTrustWall(node, data, false);
    else if (key === 'industries.items') renderIndustries(node, data);
    else if (key === 'departments.items') renderDepartments(node, data);
    else if (key === 'footer.legalLinks') renderLegalLinks(node, data);
    else if (key === 'footer.social') renderSocial(node, data);
  });

  // 3) Map data (sector data no longer needed — industries render as
  // direct HTML cards via renderIndustries / renderDepartments)
  if (CONTENT.charts) {
    baiwuLocations = CONTENT.charts.locations || [];
  }

  // 4) Reveal — content is in, fade out the pre-read screen
  hideLoader();
}

// Kick off fetch immediately (don't wait for DOMContentLoaded — saves round-trip)
const contentReady = loadAndRender();

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const reduceMotion = window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let running = true;

  function init() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const count = reduceMotion ? 25 : 80;
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (reduceMotion ? 0.05 : 0.3),
        vy: (Math.random() - 0.5) * (reduceMotion ? 0.05 : 0.3)
      });
    }
  }

  // Pre-computed constants — kept outside animate() so they aren't redeclared every frame
  const CONNECT_DIST = 150;
  const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
  const TWO_PI = Math.PI * 2;
  const PARTICLE_FILL = 'rgba(56, 189, 248, 0.4)';

  function animate() {
    if (!running) { rafId = null; return; }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const len = particles.length;
    ctx.clearRect(0, 0, w, h);

    // Pass 1: move + draw dots (single fillStyle set, batched paths)
    ctx.fillStyle = PARTICLE_FILL;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, TWO_PI);
      ctx.fill();
    }

    // Pass 2: connection lines (squared distance avoids per-pair sqrt)
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      for (let j = i + 1; j < len; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x, dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < CONNECT_DIST_SQ) {
          const dist = Math.sqrt(distSq);
          const opacity = 1 - dist / CONNECT_DIST;
          ctx.lineWidth = 0.8 * opacity;
          ctx.strokeStyle = `rgba(56, 189, 248, ${opacity * 0.4})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  // Page Visibility API — pause when tab is hidden, resume on return (saves CPU / battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      if (!rafId) animate();
    }
  });

  window.addEventListener('resize', debounce(init, 150));
  init();
  animate();
})();

function scrollToSec(id) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' });
}

window.addEventListener('load', async function () {
  // Wait for JSON render so stat-card / portfolio / audit DOM is stable before binding handlers
  await contentReady;

  document.querySelectorAll('[data-scroll-to]').forEach(a => {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      scrollToSec(this.getAttribute('data-scroll-to'));
    });
  });

  // Footer business card — fire-and-forget render. Uses
  // IntersectionObserver to defer the cards.json fetch + qrcode-generator
  // CDN load until the footer enters the viewport (saves ~6KB on initial
  // load for users who never scroll to the bottom).
  const footerCardEl = document.getElementById('footer-vcard');
  if (footerCardEl && 'IntersectionObserver' in window) {
    const cardIo = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        renderFooterCard();
      }
    }, { rootMargin: '300px' });
    cardIo.observe(footerCardEl);
  } else if (footerCardEl) {
    renderFooterCard();
  }

  // Trust-wall: ALWAYS animate. The horizontal marquee is the visual
  // statement of "live carrier traffic flowing through DOLPHLINK", so
  // we never pause it based on content width — even on ultra-wide
  // monitors the gentle drift signals "this is real-time data".
  // When content does overflow, mask + overflow:hidden naturally clips it.

  // Reveal-on-scroll: fade-up for main sections as they enter viewport
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('revealed'));
  }

  // Inline overlay — clicking a card opens a gold-bordered panel that grows
  // out of the card center. Desktop: covers only that card's row. Mobile (≤640
  // px, where cards stack vertically): covers the whole strip so long copy has
  // room. Other page content stays in place either way.
  function bindCardDetail(stripSelector, panelId, cardSelector) {
    const strip = document.querySelector(stripSelector);
    const panel = document.getElementById(panelId);
    if (!strip || !panel) return;
    const wrap = strip.parentElement;
    const pIcon = panel.querySelector('.card-detail-icon');
    const pEyebrow = panel.querySelector('.card-detail-eyebrow');
    const pTitle = panel.querySelector('.card-detail-title');
    const pText = panel.querySelector('.card-detail-text');
    const closeBtn = panel.querySelector('.card-detail-close');
    let activeCard = null;
    let closeTimer = null;

    function positionPanel(card) {
      // Panel is in flow now (position: relative) and replaces the cards strip
      // when open via CSS :has() — no top/height calculation needed. We only
      // need the horizontal origin so the scaleX animation grows from the
      // clicked card's center.
      const isMobile = window.innerWidth <= 640;
      panel.classList.toggle('is-mobile', isMobile);
      const wrapRect = wrap.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const originX = cardRect.left - wrapRect.left + cardRect.width / 2;
      panel.style.setProperty('--origin-x', `${originX}px`);
    }

    let canHoverClose = false;


    function openPanel(card) {
      const icon = card.dataset.modalIcon || '';
      // Clean up any SVG injected on a previous open
      const oldSvg = panel.querySelector('.card-detail-icon-svg');
      if (oldSvg) oldSvg.remove();
      if (icon && SVG_ICON_BUILDERS[icon]) {
        // Render the inline SVG version (replaces the webp for the 5
        // icons that have a custom SVG counterpart)
        pIcon.style.display = 'none';
        pIcon.parentElement.insertAdjacentHTML(
          'beforeend',
          SVG_ICON_BUILDERS[icon](104, 'card-detail-icon card-detail-icon-svg')
        );
      } else if (icon) {
        pIcon.src = `media/icon/3D/${icon}.webp`;
        pIcon.style.display = 'block';
      } else {
        pIcon.style.display = 'none';
      }
      const eyebrow = card.dataset.modalEyebrow || '';
      pEyebrow.textContent = eyebrow;
      pEyebrow.style.display = eyebrow ? 'block' : 'none';
      pTitle.textContent = card.dataset.modalTitle || '';
      // Split description by blank lines into separate paragraphs (\n\n).
      // Falls back to a single paragraph if no break is present.
      const paragraphs = (card.dataset.modalText || '').split(/\n{2,}/);
      pText.innerHTML = paragraphs
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');

      positionPanel(card);
      panel.classList.add('open');

      strip.querySelectorAll(cardSelector).forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activeCard = card;

      canHoverClose = false;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => { canHoverClose = true; }, 600);
    }
    function closePanel() {
      panel.classList.remove('open');
      strip.querySelectorAll(cardSelector).forEach(c => c.classList.remove('active'));
      activeCard = null;
      canHoverClose = false;
    }

    strip.querySelectorAll(cardSelector).forEach(card => {
      card.addEventListener('click', () => {
        if (activeCard === card) closePanel();
        else openPanel(card);
      });
    });
    closeBtn.addEventListener('click', closePanel);
    // Auto-close when the cursor leaves the panel (after grace period)
    panel.addEventListener('mouseleave', () => {
      if (canHoverClose && panel.classList.contains('open')) closePanel();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });
    window.addEventListener('resize', () => { if (activeCard) positionPanel(activeCard); });
  }
  bindCardDetail('.stat-strip', 'stat-card-detail', '.stat-card');
  bindCardDetail('.portfolio-strip', 'portfolio-card-detail', '.btn-portfolio');

  // Hero video — play/pause toggle, no loop, rewind on end
  const heroVideo = document.querySelector('.v-frame video');
  const playBtn = document.querySelector('.v-play-btn');
  if (heroVideo && playBtn) {
    heroVideo.volume = 0.12;

    const syncBtn = () => {
      const isPlaying = !heroVideo.paused && !heroVideo.ended;
      playBtn.classList.toggle('playing', isPlaying);
    };

    // Sync button state with video play/pause events
    heroVideo.addEventListener('play', syncBtn);
    heroVideo.addEventListener('pause', syncBtn);

    // On end: rewind to start and show play button (no loop)
    heroVideo.addEventListener('ended', () => {
      heroVideo.currentTime = 0;
      syncBtn();
    });

    playBtn.addEventListener('click', () => {
      if (heroVideo.paused || heroVideo.ended) {
        // Unmute on first click (browser autoplay policies require muted start)
        heroVideo.muted = false;
        heroVideo.volume = 0.12;
        const p = heroVideo.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        heroVideo.pause();
      }
    });

    syncBtn(); // Initial state

    // Volume slider (default 0.12)
    const volSlider = document.querySelector('.v-vol-slider');
    const muteBtn = document.querySelector('.v-mute-btn');
    const fullBtn = document.querySelector('.v-full-btn');

    const syncMuteIcon = () => {
      if (!muteBtn) return;
      const effectivelyMuted = heroVideo.muted || heroVideo.volume === 0;
      muteBtn.classList.toggle('muted', effectivelyMuted);
    };

    if (volSlider) {
      volSlider.value = '0.12';
      volSlider.addEventListener('input', () => {
        const v = parseFloat(volSlider.value);
        heroVideo.volume = v;
        if (v === 0) heroVideo.muted = true;
        else if (heroVideo.muted) heroVideo.muted = false;
        syncMuteIcon();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (heroVideo.muted) {
          heroVideo.muted = false;
          if (heroVideo.volume === 0) {
            heroVideo.volume = 0.12;
            if (volSlider) volSlider.value = '0.12';
          }
        } else {
          heroVideo.muted = true;
        }
        syncMuteIcon();
      });
    }

    heroVideo.addEventListener('volumechange', syncMuteIcon);
    syncMuteIcon();

    // Fullscreen toggle (WebKit prefix fallback)
    if (fullBtn) {
      fullBtn.addEventListener('click', () => {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          const target = heroVideo;
          const req = target.requestFullscreen
            || target.webkitRequestFullscreen
            || target.webkitEnterFullscreen;
          if (req) req.call(target);
        }
      });
      const syncFullIcon = () => {
        const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        fullBtn.classList.toggle('fullscreen', fs);
      };
      document.addEventListener('fullscreenchange', syncFullIcon);
      document.addEventListener('webkitfullscreenchange', syncFullIcon);
    }
  }

  const mapEl = document.getElementById('global-map');
  if (!mapEl) return;

  // ECharts lazy-load — IntersectionObserver injects the CDN only when charts enter viewport
  const loadECharts = () => new Promise((resolve, reject) => {
    if (typeof window.echarts !== 'undefined') return resolve(window.echarts);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    s.async = true;
    s.onload = () => resolve(window.echarts);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const initCharts = async () => {
    try {
      // Wait for both content.json and the ECharts script to be ready
      await Promise.all([contentReady, loadECharts()]);
    } catch {
      return;
    }
    runCharts();
  };

  // Trigger when chart container is within 200px of viewport
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        initCharts();
      }
    }, { rootMargin: '200px' });
    io.observe(mapEl);
  } else {
    initCharts(); // Fallback for legacy browsers without IntersectionObserver
  }

  function runCharts() {
  const mapChart = echarts.init(mapEl);

  // Chart font — matches site-wide Inter
  const CHART_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

  // Build responsive map option. ECharts geo `layoutSize: N%` is
  // computed against the SMALLER of the chart's width/height, then
  // the world map (aspect ~2:1) is centred at `layoutCenter`. If the
  // size is too aggressive (e.g. 200%) the bottom of the map clips
  // below the container; if too small, big dark margins.
  // 145% on desktop = world map fills the container width nicely
  // for a roughly 2:1 card aspect, with small navy margins top/bottom.
  const buildMapOption = () => {
    const w = mapChart.getWidth();
    const h = mapChart.getHeight();
    const isMobile = w < 560;
    const isNarrow = w < 380;
    /* When card is wider than 2× height, scale up; when squarer, scale
       down so the map fits without clipping. Aim: world width ≈
       container width with ~10% padding on each side. */
    const aspect = w / Math.max(h, 1);
    let pct;
    if (isNarrow)      pct = 130;
    else if (isMobile) pct = 150;
    else if (aspect > 1.9) pct = 175;   /* wide cards (stacked mode) */
    else                   pct = 145;   /* tall cards (2-col mode)   */
    const layoutSize = pct + '%';
    const labelFontSize = isMobile ? 9 : 10;
    const labelPad = isMobile ? [3, 5] : [4, 8];

    return {
      textStyle: { fontFamily: CHART_FONT, fontWeight: 500 },
      geo: {
        map: 'world',
        /* Geographic centre at 50% / 50% — with the conservative
           layoutSize above, the world map fills the container without
           clipping. Landmasses naturally weight to the upper half,
           which is the visual reality of the planet. */
        layoutCenter: ['50%', '50%'],
        layoutSize: layoutSize,
        roam: false,
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: '#264F78' }
        },
        itemStyle: {
          areaColor: '#1E3A5F',
          borderColor: '#38BDF8',
          borderWidth: 0.5
        }
      },
      series: [
        {
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: baiwuLocations,
          symbolSize: (val, params) => params.data.isHQ ? (isMobile ? 11 : 14) : (isMobile ? 6 : 7),
          rippleEffect: { brushType: 'stroke', scale: 3.5, period: 4 },
          label: {
            show: true,
            position: 'top',
            formatter: '{b}',
            color: '#fff',
            fontSize: labelFontSize,
            fontWeight: '700',
            fontFamily: CHART_FONT,
            backgroundColor: 'rgba(5, 12, 26, 0.7)',
            padding: labelPad,
            borderRadius: 4,
            distance: isMobile ? 6 : 10,
            textBorderColor: '#000',
            textBorderWidth: 1
          },
          labelLayout: (params) => {
            // Mobile: nudge labels back inside chart edges
            const x = params.rect.x + params.rect.width / 2;
            const chartW = mapChart.getWidth();
            const margin = isMobile ? 4 : 8;
            let dx = 0;
            if (x < params.labelRect.width / 2 + margin) {
              dx = (params.labelRect.width / 2 + margin) - x;
            } else if (x > chartW - params.labelRect.width / 2 - margin) {
              dx = (chartW - params.labelRect.width / 2 - margin) - x;
            }
            return { dx: dx, hideOverlap: false, moveOverlap: 'shiftY' };
          },
          emphasis: {
            scale: true,
            label: { show: false },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(56, 189, 248, 0.6)'
            }
          },
          itemStyle: {
            color: (params) => params.data.isHQ ? '#F59E0B' : '#38BDF8',
            shadowBlur: 10
          },
          zlevel: 2
        },
        {
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          effect: {
            show: true,
            period: 5,
            trailLength: 0.55,
            symbolSize: 4,
            color: '#FBBF24'
          },
          lineStyle: {
            color: '#F59E0B',
            width: 1,
            opacity: 0.55,
            curveness: 0.32
          },
          data: (() => {
            // Lines radiate from the HQ to every non-HQ location (HQ resolved dynamically from JSON)
            const hq = baiwuLocations.find(l => l.isHQ) || baiwuLocations[0];
            if (!hq) return [];
            return baiwuLocations
              .filter(l => !l.isHQ)
              .map(l => ({ fromName: hq.name, toName: l.name, coords: [hq.value, l.value] }));
          })()
        }
      ]
    };
  };

  // (Legacy ecograph code removed — Industries are now rendered as a
  // 6-card grid + 3-card departments strip directly in HTML by
  // renderIndustries/renderDepartments. Saves ~150 lines of ECharts
  // node/label layout math and makes the content SEO-readable.)

  const renderMap = () => mapChart.setOption(buildMapOption(), true);
  if (echarts.getMap && echarts.getMap('world')) {
    renderMap();
  } else {
    fetch('https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json')
      .then(r => r.json())
      .then(geo => { echarts.registerMap('world', geo); renderMap(); })
      .catch(err => console.error('Failed to load world map GeoJSON:', err));
  }

  const onResize = debounce(() => {
    mapChart.resize();
    if (echarts.getMap && echarts.getMap('world')) renderMap();
  }, 150);
  window.addEventListener('resize', onResize);

  // ResizeObserver picks up CSS-driven container size changes (e.g.
  // breakpoint transitions where the map column collapses to full
  // width). Without this, the chart stays at its initial size and
  // ECharts renders the world at the wrong layoutSize for the
  // newly-resized container, leaving big dark margins.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(debounce(() => {
      mapChart.resize();
      if (echarts.getMap && echarts.getMap('world')) renderMap();
    }, 100));
    ro.observe(mapEl);
  }

  } // end runCharts
});
