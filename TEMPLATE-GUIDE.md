# Template Guide — Reusing the DOLPHLINK stack for a new project

This repo doubles as a reusable static-site template. The architecture
separates **engine** (boot, hydrate, dispatch), **icons / renderers**
(visual data), **content** (`content/content.json`), **templates**
(`templates/*.html`), and **design tokens** (`css/tokens.css`). Swap
the four data layers and you get a new branded site without touching
the engine.

## TL;DR — five-step swap

1. **Brand the design** — edit `css/tokens.css`. All colors, fonts,
   and the type scale flow from this file.
2. **Brand the head** — edit `templates/head.html` (title, meta,
   Open Graph, JSON-LD). This is where SEO + social previews live.
3. **Replace section markup** — overwrite the section templates in
   `templates/` (`hero.html`, `trust.html`, `portfolio.html`, etc.)
   with your own structure. Keep `data-render="<key>"` attributes if
   you want to use the same renderers.
4. **Provide your data** — replace `content/content.json` with your
   project's content. The engine hydrates `[data-key]` and
   `[data-render]` attributes from this file at runtime.
5. **Rebuild + deploy** — `python3 build/build.py` reassembles
   `index.html` from the template tree. Push the result.

## Project anatomy

```
.
├── content/
│   └── content.json          ← Runtime data (text, hrefs, render lists)
├── css/
│   ├── tokens.css            ← :root design tokens (BRAND HERE)
│   ├── style.css             ← Base + components + theme (one big file for now)
│   └── register.css          ← Mobile "Connect" button (isolated)
├── js/
│   ├── app.js                ← Entry point — orchestrates engine + renderers
│   ├── engine/               ← Reusable engine (no project-specific code)
│   │   ├── utils.js          (escapeHtml, getByPath, debounce, yieldToMain)
│   │   ├── tokens.js         ({D MMM YYYY} expander)
│   │   ├── loader.js         (content.json fetch + cache)
│   │   ├── hydrate.js        (data-key / data-href-key / data-current-date)
│   │   └── lib-loader.js     (loadScriptOnce — local-first / CDN fallback)
│   ├── icons/
│   │   └── svg-builders.js   (14 inline SVG icons for stat / portfolio cards)
│   ├── render/               ← Per-section renderers (one file per section)
│   │   ├── hero.js           (renderHeroStats)
│   │   ├── stats.js          (Reliability Matrix)
│   │   ├── portfolio.js      (Portfolio strip)
│   │   ├── audit.js          (Trust Layer)
│   │   ├── menu.js           (Top nav)
│   │   ├── trust.js          (Carrier Network)
│   │   ├── industries.js
│   │   ├── departments.js
│   │   ├── legal.js
│   │   └── social.js
│   └── modules/              ← Feature modules (lazy / opt-in)
│       ├── card-detail.js    (Stat + portfolio click-to-expand panel)
│       ├── map.js            (ECharts world map — IntersectionObserver lazy)
│       ├── footer-card.js    (vCard QR — lazy)
│       ├── scroll.js         (Anchor smooth-scroll)
│       └── loader-shell.js   (Pre-read loader fade-out)
├── templates/                ← Section markup (composed by build.py)
│   ├── _layout.html          (Skeleton with {{ TOKEN }} placeholders)
│   ├── head.html             (Inside <head> — meta + JSON-LD + preloads)
│   ├── noscript-banner.html
│   ├── loader-shell.html
│   ├── nav.html
│   ├── hero.html
│   ├── trust.html
│   ├── reliability.html
│   ├── portfolio.html
│   ├── audit.html
│   ├── industries.html
│   ├── departments.html
│   ├── footer.html
│   └── pwa.html
├── build/
│   ├── build.py              (Composes templates + manifest → index.html)
│   └── manifest.json         (Section ordering + token → file map)
├── index.html                ← Built artifact (DON'T edit by hand — edit templates)
└── sw.js                     ← Service worker (precache list)
```

## How the engine works at runtime

1. `index.html` loads with all sections **pre-rendered** as static
   HTML — readable by SEO crawlers, Lighthouse, and AI agents that
   don't run JS.
2. `js/app.js` (an ES module) boots: it fetches `content/content.json`,
   stores it on `window` for the hydrator, and runs two passes —
   - `applyTextContent(document)` walks every `[data-key]` /
     `[data-href-key]` / `[data-current-date]` and replaces the
     pre-rendered text with the JSON value (so editors update the
     site by editing one JSON file, not the HTML).
   - `renderNode(content, node)` for every `[data-render="..."]`
     element, looks up the key in the renderer registry and
     replaces the children with the rendered output.
3. Above-fold renderers run synchronously; below-fold yields to the
   main thread between each renderer (avoids long tasks).
4. Feature modules — card detail, map, footer vCard — register with
   IntersectionObserver and lazy-load only when they enter the
   viewport.

## How to compose `templates/_layout.html`

`templates/_layout.html` is the skeleton. It contains `{{ TOKEN }}`
placeholders that `build.py` substitutes from files listed in
`build/manifest.json`. To add a new section:

1. Create `templates/your-section.html` with the markup.
2. Add an entry to `manifest.json` under `tokens`:
   `"YOUR_SECTION": "your-section.html"`.
3. Add the placeholder `{{ YOUR_SECTION }}` in `_layout.html` where
   you want it to appear.
4. Run `python3 build/build.py`. The new section lands in
   `index.html` automatically.

To remove a section, just delete the placeholder from `_layout.html`
(or comment it out in `manifest.json` `tokens`).

## How to add a new renderer

Renderers are pure functions that take a DOM node + a data array and
mutate the node's children:

```js
// js/render/your-section.js
import { escapeHtml } from '../engine/utils.js';

export function renderYourSection(node, items) {
  node.innerHTML = items
    .map(item => `<div class="your-card">${escapeHtml(item.title)}</div>`)
    .join('');
}
```

Wire it up in `js/app.js`:

```js
import { renderYourSection } from './render/your-section.js';

const RENDERERS = {
  // ...
  'yourSection.items': renderYourSection,
};
```

Markup-side, point a node at it:

```html
<div data-render="yourSection.items">
  <!-- SSR fallback rendered into here at build time -->
</div>
```

And add `yourSection.items` to `content/content.json`.

## How to add new design tokens

Edit `css/tokens.css` — declare new custom properties on `:root`. To
override per breakpoint, declare them inside a `@media` query. To
override per theme (dark mode etc.), declare them inside a `[data-theme="..."]`
selector.

Style rules elsewhere should always **reference** the tokens, never
hardcode hex values:

```css
/* GOOD */
.btn { background: var(--baiwu-blue-primary); }

/* BAD */
.btn { background: #0059B3; }
```

## Future work — finishing the CSS split

For now `css/style.css` (~2,700 lines) holds reset + base + components
+ theme together. The natural split is:

- `css/base.css` — reset, body, focus styles, typography defaults
- `css/components.css` — reusable: btn, card, pill, stat, eyebrow, sec-title
- `css/theme.css` — section-specific: hero, trust, portfolio, footer

The split was deferred to avoid disturbing the live site mid-refactor.
When you're ready, lift each chunk by its `/* === Section Name === */`
header comments. The natural section boundaries are already labelled
inside `style.css`.

## Things you DON'T need to touch when re-skinning

The engine, icons, render dispatcher, modules, and the build script
are project-agnostic. Lift `js/engine/`, `js/icons/`, `js/render/`,
`js/modules/`, and `build/build.py` into your new project as-is.
