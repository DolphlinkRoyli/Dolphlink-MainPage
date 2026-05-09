/**
 * Tiny runtime i18n — swaps page copy without round-tripping the server.
 *
 * Scope: SHARED CORE. Used by home/index.js + sme/index.js.
 *
 * How it works:
 *   1. The HTML ships with English text baked in (SEO-safe — Google sees
 *      the English copy). Translatable elements carry data-i18n="<key>".
 *   2. On first paint we read the visitor's language pick from
 *      ?lang=<code>, then localStorage, then navigator.language.
 *   3. If the pick isn't English we fetch content/i18n/<code>.json and
 *      walk every [data-i18n="key"] in the document, swapping textContent
 *      to the matching translation. Missing keys silently fall back to
 *      whatever English text was already in the DOM.
 *   4. attachLanguagePicker() injects a small dropdown that lets the
 *      visitor change language; choice is persisted across visits.
 *
 * Why not URL-routed (/zh/, /ja/) per-locale pages?
 *   That gives better SEO but multiplies the build artefact 5×. For a
 *   marketing page that changes weekly, the maintenance cost outweighs
 *   the SEO benefit. Default-English + hreflang to /sme/ is enough for
 *   Google to surface the page to multilingual searchers.
 */

const STORAGE_KEY = 'dolphlink.lang';

/* Available locales. Order = picker order. Code maps to JSON file
   under content/i18n/<code>.json. English has no JSON — it's the
   baked-in body text. */
export const LOCALES = [
  { code: 'en', label: 'English',         native: 'English'        },
  { code: 'zh', label: 'Chinese',         native: '简体中文'        },
  { code: 'ja', label: 'Japanese',        native: '日本語'          },
  { code: 'es', label: 'Spanish',         native: 'Español'        },
  { code: 'ms', label: 'Malay',           native: 'Bahasa Melayu'  },
  { code: 'hi', label: 'Hindi',           native: 'हिन्दी'          }
];

const CODES = new Set(LOCALES.map(l => l.code));

/**
 * Resolve which language to render. Order of precedence:
 *   1. ?lang=<code> in the URL  (shareable, deep-linkable)
 *   2. localStorage choice      (sticks across visits)
 *   3. navigator.language match (auto-detect on first visit)
 *   4. fallback: 'en'
 */
export function detectLang() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && CODES.has(fromUrl)) return fromUrl;
  } catch (_) {}
  try {
    const fromStore = localStorage.getItem(STORAGE_KEY);
    if (fromStore && CODES.has(fromStore)) return fromStore;
  } catch (_) {}
  /* navigator.language is e.g. "zh-CN" / "ja-JP" / "es-MX". Strip the
     region tag and match the 2-letter prefix against our locales. */
  const navLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (CODES.has(navLang)) return navLang;
  return 'en';
}

/* Translation cache so we don't re-fetch the same JSON on every
   picker-change within a session. Keyed by language code. */
const _cache = new Map();

/* Resolve `content/i18n/` relative to THIS module's URL, not the
   visitor's current page URL. Without this, a fetch on /sme/ or
   /sme/build/ would resolve to /sme/content/... or /sme/build/content/...
   and 404 — translation files only exist at the site root.
   This walks up `js/engine/core/` (3 levels) to the root, then descends
   into content/i18n/. Same SW cache key on every page, too. */
const I18N_BASE = new URL('../../../content/i18n/', import.meta.url);

async function fetchTranslations(lang) {
  if (lang === 'en') return null;          /* English is the baked default */
  if (_cache.has(lang)) return _cache.get(lang);
  try {
    const r = await fetch(new URL(`${lang}.json`, I18N_BASE).toString(), { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    _cache.set(lang, data);
    return data;
  } catch (e) {
    console.warn('[i18n] fetch failed for', lang, e);
    return null;
  }
}

/**
 * Apply translations to every [data-i18n="key"] in `root`. Missing
 * keys fall back to whatever's already in the DOM (the English text).
 */
function applyTranslations(translations, root = document) {
  if (!translations) return;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = translations[key];
    if (typeof value === 'string') el.textContent = value;
  });
  /* Also handle data-i18n-attr="placeholder:hero.placeholder" style —
     for translating attributes (alt, placeholder, aria-label, title).
     Currently unused but available for follow-ups. */
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const spec = el.dataset.i18nAttr || '';
    spec.split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (!attr || !key) return;
      const value = translations[key];
      if (typeof value === 'string') el.setAttribute(attr, value);
    });
  });
  /* Update <html lang> so screen readers + search engines pick up the
     active language. dir flips for RTL languages we don't support yet
     but the wiring is here. */
  document.documentElement.lang = translations.__lang || document.documentElement.lang;
}

/**
 * Persist + apply a language choice. Returns the resolved locale code.
 */
export async function setLang(code) {
  const next = CODES.has(code) ? code : 'en';
  try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  /* Update URL ?lang= without a navigation, so refreshing or sharing
     the link preserves the choice. */
  try {
    const url = new URL(location.href);
    if (next === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', next);
    history.replaceState(null, '', url.toString());
  } catch (_) {}

  if (next === 'en') {
    /* No JSON to fetch — the page is already English. We DO need to
       re-walk data-i18n elements and reset them to their English
       defaults if the user previously switched away. We've stashed the
       English text in dataset.i18nDefault on first run. */
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const def = el.dataset.i18nDefault;
      if (typeof def === 'string') el.textContent = def;
    });
    document.documentElement.lang = 'en';
  } else {
    const translations = await fetchTranslations(next);
    applyTranslations(translations);
  }
  /* Notify the picker UI so it can highlight the active option. */
  document.dispatchEvent(new CustomEvent('dlpk:lang-change', { detail: { lang: next } }));
  return next;
}

/**
 * Snapshot the original English text on every translatable element so
 * `setLang('en')` can restore it later without a server round-trip.
 * Called once during initial setup before any translation is applied.
 */
function captureEnglishDefaults() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (!('i18nDefault' in el.dataset)) {
      el.dataset.i18nDefault = el.textContent.trim();
    }
  });
}

/**
 * Wire up i18n on page load. Call from your page's setup function.
 * Returns a Promise that resolves after the initial language has been
 * applied, so callers can await before binding interaction handlers
 * that depend on translated copy.
 */
export async function setupI18n() {
  captureEnglishDefaults();
  const lang = detectLang();
  if (lang === 'en') {
    document.documentElement.lang = 'en';
    return 'en';
  }
  const translations = await fetchTranslations(lang);
  if (translations) {
    applyTranslations(translations);
  } else {
    /* Fetch failed — fall back to English so we don't show blank text. */
    document.documentElement.lang = 'en';
  }
  return lang;
}

/**
 * Inject a tiny language picker into `host`. The picker is unstyled
 * here; pages provide their own CSS via .dlpk-lang-picker selector.
 * Re-renders when dlpk:lang-change fires so the active state stays
 * in sync if some other code triggers a switch.
 */
export function attachLanguagePicker(host) {
  if (!host) return;

  function render(active) {
    host.innerHTML = `
      <details class="dlpk-lang-picker">
        <summary aria-label="Select language">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span class="dlpk-lang-current">${LOCALES.find(l => l.code === active)?.native || 'English'}</span>
        </summary>
        <ul class="dlpk-lang-menu" role="menu">
          ${LOCALES.map(l => `
            <li role="menuitem">
              <button type="button" data-lang="${l.code}" aria-current="${l.code === active ? 'true' : 'false'}">
                <span class="dlpk-lang-native">${l.native}</span>
                <span class="dlpk-lang-en">${l.label}</span>
              </button>
            </li>
          `).join('')}
        </ul>
      </details>
    `;
    /* Wire button clicks AFTER render. */
    host.querySelectorAll('button[data-lang]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.lang;
        await setLang(code);
        /* Close the dropdown after selection. */
        const det = host.querySelector('details');
        if (det) det.open = false;
      });
    });
  }

  render(detectLang());
  document.addEventListener('dlpk:lang-change', e => render(e.detail.lang));
}
