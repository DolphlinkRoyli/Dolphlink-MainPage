/**
 * SVG icon builders — inline icons used by stat cards, portfolio cards,
 * and detail panels. Each builder takes (size, extraClass) and returns
 * an inline-SVG string. Visual language: brand-blue gradient + white detail.
 *
 * Scope: HOMEPAGE ONLY (consumed by ../render/stats.js, ../render/portfolio.js,
 * and ../modules/card-detail.js). Card and SME pages don't render any of
 * these icons; if either ever needs SVG, copy what's needed into that
 * page tree rather than hoisting this file out of home/.
 *
 * To swap the icon set: change the exports below or replace the
 * SVG_ICON_BUILDERS map entries.
 */
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

// Phone Numbers
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

// Dolphlink One-API
function buildOneApiSvg(size, extraClass) {
  const g = svgGradDef(size, 'oneapi');
  return svgWrap(size, extraClass, g.defs +
    `<line x1="32" y1="32" x2="32" y2="10" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="32" y2="54" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="10" y2="32" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<line x1="32" y1="32" x2="54" y2="32" stroke="#0059B3" stroke-width="2.4" stroke-linecap="round"/>` +
    `<circle cx="32" cy="10" r="3.2" fill="#0059B3"/>` +
    `<circle cx="32" cy="54" r="3.2" fill="#0059B3"/>` +
    `<circle cx="10" cy="32" r="3.2" fill="#0059B3"/>` +
    `<circle cx="54" cy="32" r="3.2" fill="#0059B3"/>` +
    `<circle cx="32" cy="32" r="11" fill="url(#${g.gid})"/>` +
    `<text x="32" y="35.8" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="900" fill="#FFFFFF" letter-spacing="0.5">API</text>`);
}

// Operations Hub
function buildHubSvg(size, extraClass) {
  const g = svgGradDef(size, 'hub');
  return svgWrap(size, extraClass, g.defs +
    `<rect x="6" y="10" width="52" height="36" rx="3" fill="url(#${g.gid})"/>` +
    `<rect x="9" y="13" width="46" height="30" rx="1" fill="#FFFFFF"/>` +
    `<rect x="13" y="32" width="4" height="9" fill="#0059B3"/>` +
    `<rect x="19" y="27" width="4" height="14" fill="#0059B3"/>` +
    `<rect x="25" y="22" width="4" height="19" fill="#0059B3"/>` +
    `<circle cx="44" cy="29" r="7" fill="#0059B3" opacity="0.32"/>` +
    `<path d="M44 22 A7 7 0 0 1 51 29 L44 29 z" fill="#0059B3"/>` +
    `<rect x="28" y="46" width="8" height="3" fill="url(#${g.gid})"/>` +
    `<rect x="20" y="49" width="24" height="3" rx="1.5" fill="url(#${g.gid})"/>`);
}

// AI-Digital Solutions
function buildAiDigitalSvg(size, extraClass) {
  const g = svgGradDef(size, 'aidigital');
  return svgWrap(size, extraClass, g.defs +
    `<line x1="24" y1="22" x2="46" y2="14" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="24" y1="22" x2="52" y2="30" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="24" y1="22" x2="46" y2="46" stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>` +
    `<circle cx="22" cy="22" r="8" fill="url(#${g.gid})"/>` +
    `<path d="M10 56 V46 a12 12 0 0 1 24 0 v10 z" fill="url(#${g.gid})"/>` +
    `<circle cx="46" cy="14" r="3.5" fill="url(#${g.gid})"/>` +
    `<circle cx="52" cy="30" r="3.5" fill="url(#${g.gid})"/>` +
    `<circle cx="46" cy="46" r="3.5" fill="url(#${g.gid})"/>` +
    `<circle cx="46" cy="14" r="1.2" fill="#FFFFFF"/>` +
    `<circle cx="52" cy="30" r="1.2" fill="#FFFFFF"/>` +
    `<circle cx="46" cy="46" r="1.2" fill="#FFFFFF"/>`);
}

// Stat icons —————————————————————————————————————————————

function buildUptimeSvg(size, extraClass) {
  const g = svgGradDef(size, 'uptime');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="32" r="24" fill="url(#${g.gid})"/>` +
    `<circle cx="32" cy="32" r="19" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.28"/>` +
    `<path d="M14 32 H22 L25 24 L30 42 L34 20 L38 34 L42 32 H50" stroke="#FFFFFF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="32" r="2.4" fill="#FFFFFF"/>` +
    `<circle cx="50" cy="32" r="4.2" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.5"/>`);
}

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

function buildVelocitySvg(size, extraClass) {
  const g = svgGradDef(size, 'velocity');
  return svgWrap(size, extraClass, g.defs +
    `<line x1="4" y1="20" x2="14" y2="20" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` +
    `<line x1="2" y1="32" x2="10" y2="32" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.5"/>` +
    `<line x1="6" y1="44" x2="12" y2="44" stroke="#0059B3" stroke-width="2" stroke-linecap="round" opacity="0.4"/>` +
    `<path d="M38 6 L18 36 L28 36 L24 58 L46 28 L34 28 Z" fill="url(#${g.gid})"/>`);
}

function buildOpenRateSvg(size, extraClass) {
  const g = svgGradDef(size, 'openrate');
  return svgWrap(size, extraClass, g.defs +
    `<rect x="8" y="22" width="48" height="30" rx="3" fill="url(#${g.gid})"/>` +
    `<path d="M8 24 L32 42 L56 24" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>` +
    `<circle cx="46" cy="14" r="8" fill="url(#${g.gid})" stroke="#FFFFFF" stroke-width="1.4"/>` +
    `<path d="M42.5 14.5 L45 17 L50 11" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<line x1="36" y1="9"  x2="34" y2="6"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>` +
    `<line x1="56" y1="9"  x2="58" y2="6"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>` +
    `<line x1="46" y1="2"  x2="46" y2="5"  stroke="#0059B3" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`);
}

function buildAiHSvg(size, extraClass) {
  const g = svgGradDef(size, 'aih');
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

// Trust-as-a-Service (TaaS) — shield with checkmark + verification pulse dot.
// Visual language: brand-blue gradient shield, white inner outline + bold check,
// pulse dot at upper-right echoing the uptime icon's verification motif.
function buildTaasSvg(size, extraClass) {
  const g = svgGradDef(size, 'taas');
  return svgWrap(size, extraClass, g.defs +
    // Outer shield body (gradient fill)
    `<path d="M32 6 L52 13 V30 C52 42 42 51 32 57 C22 51 12 42 12 30 V13 Z" fill="url(#${g.gid})"/>` +
    // Inner shield outline (white, low-opacity highlight)
    `<path d="M32 12 L46 17.5 V30 C46 39 39 47 32 51 C25 47 18 39 18 30 V17.5 Z" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.32"/>` +
    // Bold checkmark (white)
    `<path d="M22 32 L29 39 L43 25" stroke="#FFFFFF" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    // Verification pulse dot at top-right (mirrors uptime icon style)
    `<circle cx="50" cy="14" r="2.4" fill="#FFFFFF"/>` +
    `<circle cx="50" cy="14" r="4.2" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.55"/>`);
}

// Portfolio icons —————————————————————————————————————————————

function buildNexusSvg(size, extraClass) {
  const g = svgGradDef(size, 'nexus');
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

function buildTouchSvg(size, extraClass) {
  const g = svgGradDef(size, 'touch');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="22" r="14" fill="none" stroke="#0059B3" stroke-width="1.4" opacity="0.3"/>` +
    `<circle cx="32" cy="22" r="9" fill="none" stroke="#0059B3" stroke-width="1.6" opacity="0.55"/>` +
    `<circle cx="32" cy="22" r="4" fill="url(#${g.gid})"/>` +
    `<path d="M28 60 L28 38 a4 4 0 0 1 8 0 V36" fill="url(#${g.gid})"/>`);
}

function buildSmartSvg(size, extraClass) {
  const g = svgGradDef(size, 'smart');
  return svgWrap(size, extraClass, g.defs +
    `<path d="M32 6 a14 14 0 0 1 9 24 q-2 2 -2 5 v3 h-14 v-3 q0 -3 -2 -5 a14 14 0 0 1 9 -24 z" fill="url(#${g.gid})"/>` +
    `<path d="M27 22 L30 28 L34 28 L37 22" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<rect x="24" y="44" width="16" height="3" rx="1" fill="#003D80"/>` +
    `<rect x="26" y="49" width="12" height="2" fill="#003D80"/>` +
    `<rect x="28" y="53" width="8" height="4" rx="1" fill="#003D80"/>`);
}

function buildVoiceSvg(size, extraClass) {
  const g = svgGradDef(size, 'voice');
  return svgWrap(size, extraClass, g.defs +
    `<circle cx="32" cy="32" r="24" fill="url(#${g.gid})"/>` +
    `<g transform="translate(20 20)" fill="#FFFFFF">` +
      `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>` +
    `</g>`);
}

// Map of icon-name → SVG builder. The render code (../render/stats.js,
// ../render/portfolio.js) consults this both in the strip render AND in
// the click-through detail panel via ../modules/card-detail.js.
export const SVG_ICON_BUILDERS = {
  // Reliability Matrix (stats)
  icon_3:  buildOpenRateSvg,
  icon_5:  buildCountriesSvg,
  icon_6:  buildUptimeSvg,
  icon_7:  buildAiHSvg,
  icon_10: buildVelocitySvg,
  icon_15: buildTaasSvg,        // Trust-as-a-Service (TaaS) — Zero-Trust shield
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
