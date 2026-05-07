/**
 * Page dispatcher — the only file js/app.js imports directly. Reads
 * <html data-page="…"> and lazy-loads the matching page module.
 *
 *   <html data-page="home">  →  ./home/index.js
 *   <html data-page="card">  →  ./card/index.js
 *   <html data-page="sme">   →  ./sme/index.js
 *
 * Engine layout:
 *
 *     js/engine/
 *     ├── dispatch.js            ← this file (the only file used by EVERY page)
 *     ├── core/                  ← helpers shared by 2+ pages
 *     │   ├── loader-shell.js    (hideLoader)
 *     │   ├── drive.js           (Drive URL flavours)
 *     │   ├── strings.js         (initialsOf, hasRealPhone)
 *     │   ├── vcard.js           (vCard composer + .vcf download)
 *     │   └── clipboard.js       (Clipboard API + Web Share fallbacks)
 *     ├── home/                  ← homepage modules (the bulk of the JS)
 *     ├── card/                  ← /card/?u=… digital card page (legacy /c/ redirects)
 *     └── sme/                   ← /sme/ landing page (currently no-op)
 *
 * Adding a new page is two steps:
 *   1. Mark the HTML with <html data-page="my-page">.
 *   2. Create js/engine/my-page/index.js with `export default async function () {…}`,
 *      then add a key in PAGE_LOADERS below pointing at it.
 *
 * Page modules import from ../core/ when they need a shared helper.
 * Anything used by exactly one page belongs inside that page's tree.
 */

const PAGE_LOADERS = {
  'home': () => import('./home/index.js'),
  'card': () => import('./card/index.js'),
  'sme':  () => import('./sme/index.js'),
};

const DEFAULT_PAGE = 'home';

export async function dispatch() {
  const root = document.documentElement;
  const name = (root && root.dataset && root.dataset.page) || DEFAULT_PAGE;
  const loader = PAGE_LOADERS[name];
  if (!loader) {
    console.warn('[dispatch] unknown page:', name, '— skipping setup');
    return;
  }
  try {
    const mod = await loader();
    if (typeof mod.default === 'function') {
      await mod.default();
    }
  } catch (err) {
    console.error('[dispatch] page setup failed:', name, err);
  }
}
