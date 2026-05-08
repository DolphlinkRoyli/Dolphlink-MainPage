/**
 * Homepage setup — runs when <html data-page="home">.
 *
 * This module owns everything the enterprise homepage needs:
 *   - Renderer registry (data-render → render/<key>.js)
 *   - Above/below-fold scheduling
 *   - Footer vCard lazy-load
 *   - Reveal-on-scroll fade-up
 *   - Card-detail panel binding (stat + portfolio)
 *   - World map lazy-load
 *   - Anchor smooth-scroll
 *
 * Loaded only when the dispatcher decides this is the homepage — so card
 * page / SME page visits don't pay any of this code's parse cost.
 */
import { loadContent } from './loader.js';
import { applyTextContent, setHydrationContent } from './hydrate.js';
import { yieldToMain, getByPath } from './utils.js';
import { hideLoader } from '../core/loader-shell.js';
import { setupI18n, attachLanguagePicker, detectLang } from '../core/i18n.js';
import { showEmergencyBanner } from './modules/loader-shell.js';
import { scrollToSec } from './modules/scroll.js';

import { renderHeroStats }   from './render/hero.js';
import { renderStats }       from './render/stats.js';
import { renderPortfolios }  from './render/portfolio.js';
import { renderAudit }       from './render/audit.js';
import { renderMenu }        from './render/menu.js';
import { renderIndustries }  from './render/industries.js';
import { renderDepartments } from './render/departments.js';
import { renderLegalLinks }  from './render/legal.js';

import { bindCardDetail }    from './modules/card-detail.js';
import { renderFooterCard }  from './modules/footer-card.js';
import { bindMap, setMapLocations } from './modules/map.js';


/* -------- Renderer registry — drives the [data-render] dispatcher ------ */
const RENDERERS = {
  'reliability.stats':   renderStats,
  'hero.stats':          renderHeroStats,
  'portfolios.items':    renderPortfolios,
  'audit.items':         renderAudit,
  'nav.menuItems':       renderMenu,
  'industries.items':    renderIndustries,
  'departments.items':   renderDepartments,
  'footer.legalLinks':   renderLegalLinks,
};

const ABOVE_FOLD_KEYS = new Set([
  'reliability.stats',
  'nav.menuItems',
]);

function renderNode(content, node) {
  const key = node.dataset.render;
  const fn = RENDERERS[key];
  if (!fn) return;
  /* getByPath blocks prototype-walking via __proto__/constructor/prototype
     keys — defends against a poisoned content.json. */
  const data = getByPath(content, key);
  if (!Array.isArray(data)) return;
  fn(node, data);
}


/**
 * One full hydrate pass for a given language. Fetches the locale-aware
 * content.json (falls back to English if content.<lang>.json is missing),
 * hydrates every [data-key] / [data-href-key] in the DOM, and re-runs
 * every registered renderer. Used both at first paint AND when the
 * language picker fires a change — making the entire page re-render
 * in the new language without a full page reload.
 */
async function hydrateForLang(lang) {
  let content;
  try {
    content = await loadContent(lang);
  } catch (e) {
    console.warn('[home] content load failed for lang=' + lang, e);
    showEmergencyBanner();
    hideLoader();
    /* Still apply i18n so the static (non-data-key) elements get
       translated even when content.json fails. */
    setupI18n().catch(() => {});
    return;
  }
  setHydrationContent(content);

  // 1) Hydrate every text + href bound to content.json
  applyTextContent(document);

  // 2) Re-render every data-render block from the localized content
  document.querySelectorAll('[data-render]').forEach(n => renderNode(content, n));

  // 3) Map locations from content.json (only used on first hydrate)
  if (content.charts && content.charts.locations) {
    setMapLocations(content.charts.locations);
  }
  return content;
}

async function bootstrap() {
  /* First-paint flow: figure out language, hydrate the WHOLE page from
     the localized content file, apply i18n to anything still in English,
     then reveal. Below-fold work is yielded so it doesn't block paint. */
  const lang = detectLang();
  const content = await hydrateForLang(lang);
  if (!content) return;          /* hydrateForLang already handled the error */

  /* 1b) Apply i18n AFTER hydrate so captured English defaults reflect
     the content.json values (not the SSR placeholders like "—"). The
     PICKER itself is rendered earlier in setupHomePage() so it's
     visible the instant JS runs, regardless of how long content.json
     takes to load. */
  await setupI18n();

  // 4) Reveal — content is in, fade out the pre-read screen
  hideLoader();

  /* 5) Listen for language switches from the picker. Each switch
     re-fetches the localized content.json and re-runs every renderer.
     setupI18n's own data-i18n swap also runs (already triggered by
     setLang inside i18n.js) — for elements that don't have a localized
     content.json equivalent, that's what catches them. */
  document.addEventListener('dlpk:lang-change', async (e) => {
    const newLang = e.detail && e.detail.lang;
    if (!newLang) return;
    await hydrateForLang(newLang);
    /* Re-apply i18n on the freshly hydrated content. setLang inside
       i18n.js already ran applyTranslations, but elements re-rendered
       by data-render may have been overwritten back to content.json
       text — re-applying ensures the data-i18n swaps stick. */
    await setupI18n();
  });
}


function wireUpInteractions() {
  // Anchor link smooth-scroll
  document.querySelectorAll('[data-scroll-to]').forEach(a => {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      scrollToSec(this.getAttribute('data-scroll-to'));
    });
  });

  // Footer business card — defer until the footer enters viewport
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

  // Reveal-on-scroll fade-up
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

  // Card-detail panels (Reliability + Portfolio)
  bindCardDetail('.stat-strip', 'stat-card-detail', '.stat-card');
  bindCardDetail('.portfolio-strip', 'portfolio-card-detail', '.btn-portfolio');

  // World map (lazy via IntersectionObserver inside bindMap)
  const mapEl = document.getElementById('global-map');
  if (mapEl) bindMap(mapEl);
}


/**
 * Default export — invoked by ../dispatch.js.
 * Boots content + hydration in parallel with DOMContentLoaded handling,
 * then wires up post-load interactions when window.load fires.
 */
export default async function setupHomePage() {
  /* Render the language picker IMMEDIATELY — it doesn't depend on
     content.json or hydration, and shouldn't wait for the network.
     The dropdown is reachable from the moment JS runs, so visitors on
     slow links (or behind a Live Server) can pick a language before
     the rest of the page hydrates. The actual translation swap
     happens later inside bootstrap() (after applyTextContent so the
     captured English defaults reflect content.json values, not the
     SSR placeholder dashes). */
  attachLanguagePicker(document.querySelector('[data-lang-picker]'));

  const contentReady = bootstrap();

  if (document.readyState === 'complete') {
    await contentReady;
    wireUpInteractions();
  } else {
    window.addEventListener('load', async () => {
      await contentReady;
      wireUpInteractions();
    }, { once: true });
  }
}
