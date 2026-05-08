# DOLPHLINK Marketing Site — Technical README

> **Live**: https://dolphlinkroyli.github.io/Dolphlink-MainPage/
> **Owner**: Baiwu Technology Group → DOLPHLINK PTE. LTD. (Singapore)
> **Audience**: engineers maintaining or extending the site
> **Companion**: `SITE-SPECIFICATION.md` (marketing / SEO copy reference)

A static, JSON-driven marketing site for DOLPHLINK — Singapore's sovereign CPaaS and AI-orchestration platform. Targets B2B enterprise + government buyers (FinTech, healthcare, regulated enterprises). One long-scroll page, fully SSR pre-rendered, progressively enhanced, no framework.

---

## What's new — modular refactor (May 2026)

The site was refactored into a **reusable template engine**. The
monolithic `js/main.js` was split into 22 ES modules, the section
markup pulled out into `templates/`, and design tokens lifted into
`css/tokens.css`. Re-skinning for a new project is now a 5-step,
edit-two-files job. See:

- **[`TEMPLATE-GUIDE.md`](./TEMPLATE-GUIDE.md)** — how to re-skin this stack for a new project
- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — module dependency diagram + runtime data flow + build pipeline
- **[`REFACTOR-STATUS.md`](./REFACTOR-STATUS.md)** — what changed in each phase

The repository layout below describes the **new** structure. `js/main.js`
is kept as a fallback during cutover but is no longer the entry point.

---

## 1. Stack at a glance

| Layer | What | Why |
| --- | --- | --- |
| **Hosting** | GitHub Pages (static) | Zero-cost, edge-cached, no backend |
| **HTML / CSS / JS** | Vanilla, no framework | Every KB ships to the user; framework tax not worth it |
| **Service Worker** | Custom `sw.js` | Offline shell + cache-invalidation control |
| **Charts** | ECharts 5.4.3 (lazy-loaded) | One world map; loaded only when viewport approaches it |
| **Fonts** | Inter (single variable woff2) | Variable font = one file covers 100..900 weights |
| **Video** | MP4 H.264 autoplay loop muted | Hero backdrop, GIF-style behaviour at ~1/10 GIF size |
| **CMS** | None — `content/content.json` | Content team edits JSON via PR; CSV pipeline in `/cms` |
| **Analytics** | Not installed | Hook GA4 / Plausible later if needed |

**Browser targets**: Chrome 90+, Edge 90+, Safari 15+, Firefox 90+. Graceful degradation for older browsers via SSR HTML; no-JS users still get a fully readable page.

---

## 2. Repository layout

```
dolphlink/
├── index.html                # SSR pre-rendered main page (~75 KB)
├── offline.html              # Branded offline fallback served by sw.js
├── robots.txt
├── content/
│   ├── content.json          # SINGLE source of truth for visible copy
│   └── cards.json            # Business-card / vCard data
├── css/
│   ├── style.css             # ~95 KB, plain CSS, no preprocessor
│   └── register.css          # Briefing modal styles (loaded async)
├── js/
│   ├── main.js               # ~60 KB hero / portfolio / map / detail panels
│   ├── register.js           # "Request Briefing" modal + form
│   ├── register-scanner.js   # QR scanner (lazy-loaded behind register.js)
│   └── c.js                  # /c/ public-card landing page
├── c/                        # /c/?u=<localpart> public card route
│   ├── index.html
│   └── c.css
├── lib/                      # Local mirrors of CDN libs (offline-friendly)
│   ├── echarts.min.js        # 1 MB, lazy-loaded
│   ├── world.json            # 987 KB GeoJSON, lazy-loaded
│   ├── qrcode.min.js         # 21 KB, lazy-loaded
│   ├── jsQR.js               # 251 KB, only on scanner open
│   ├── download.ps1          # PowerShell to refresh from jsdelivr
│   └── download.sh           # bash equivalent
├── media/
│   ├── icon/3D/              # webp icons, brand logo, favicon
│   ├── img/video-poster.webp # Hero video poster (~64 KB)
│   └── video/current.mp4     # Hero ambient loop (~2.7 MB)
├── seo/
│   ├── sitemap.xml
│   └── site.webmanifest      # PWA manifest
├── cms/                      # CSV → JSON pipeline (optional)
│   ├── build.py
│   ├── text.csv
│   └── …
├── integrations/             # 3rd-party connectors (Apps Script etc.)
└── sw.js                     # Service worker — precache + fetch handler
```

---

## 3. Content pipeline

### 3.1 The single source of truth

Every visible string on the page is in `content/content.json`. Sections:

```jsonc
{
  "nav": { ... },          // top nav: brand, CTA, menu items
  "hero": { ... },          // eyebrow, h1, tagline, stats, ctaSecondary
  "trustWall": { ... },     // CARRIER NETWORK & COMPLIANCE card
  "reliability": { ... },   // 5 stat cards (Uptime / Routes / Delivery / …)
  "portfolios": { ... },    // 3 pillars × 3 products = 9 portfolio cards
  "audit": { ... },         // 4 Trust Layer cards
  "industries": { ... },    // 4 primary verticals + 5 secondary
  "departments": { ... },   // 4 internal-team cards
  "charts": { ... },        // World-map node coordinates
  "footer": { ... }         // Address, contacts, links, social, copyright
}
```

### 3.2 Hydration model

`js/main.js` reads `content/content.json` at boot and walks the DOM:

- `[data-key="path.to.value"]` → text content swap
- `[data-href-key="path.to.url"]` → href swap (with optional `data-href-prefix`)
- `[data-render="path.to.array"]` → call a registered `render*()` function
- `[data-current-date]` → expand `{D MMM YYYY}` token to today's date

The HTML is **already pre-rendered** with the same content (SSR step). The JS step is hydration only — if JS fails, no-JS users still see complete content. SEO crawlers index the SSR HTML.

### 3.3 Updating copy

```bash
# Edit content
vim content/content.json

# Bump CONTENT_VERSION in two places:
#  - js/main.js   const CONTENT_VERSION = '20260507af'
#  - index.html   <link href="content/content.json?v=20260507af">

# Optional: bump CACHE_VERSION in sw.js so SW skip-waiting flows trigger
```

`bump.py` automation deferred — manual bumps are fine for the current cadence.

---

## 4. Page sections (top → bottom)

| # | Section | HTML id | Anchor in nav |
| --- | --- | --- | --- |
| 1 | Top nav (sticky, brand-blue, persistent Request Briefing CTA) | `nav` | — |
| 2 | Hero (eyebrow + h1 + tagline + stats + 3 CTAs) | `#h-sec` | HOME |
| 3 | **Carrier Network & Compliance** (gold-bordered unified card with 4 region cards + 6 regulator pills) | — | TRUST LAYER |
| 4 | **Reliability Matrix** (5 stat cards, click-to-expand detail panel) | `#r-sec` | RELIABILITY |
| 5 | **The Portfolio** (3 pillars × 3 products, 9 cards) | `#n-sec` | PORTFOLIO |
| 6 | **The Trust Layer** (4 audit boxes — Compliance / Sovereignty / Reliability / Access) | `#a-sec` | TRUST LAYER |
| 7 | **Industries We Serve** (4 primary verticals + 5 secondary) | `#i-sec` | INDUSTRIES |
| 8 | **Departments We Empower** (4 internal-team cards) | — | — |
| 9 | Footer + global map (gold-bordered ECharts world map + business card) | — | — |

Each section lives in its own `<section class="section-row">` with `content-visibility: auto` so the browser can skip layout/paint until viewport intersect.

---

## 5. Hero CTA system (current)

The hero has **two audience tracks** separated by a gold gradient hairline:

```
ROW 1 (enterprise) ── primary audience
  [📊 Industry Insights →]      [⋰ See Auto-Orchestration →]
   solid blue, 270px              solid blue, flex 1
   → scrolls to #i-sec            → scrolls to #n-sec

═════════════ gold hairline ═════════════

ROW 2 (SME) ── off-ramp for non-target visitors
  [🏪 SME · Best-Fit Plans →]    │ Built for smaller teams.
   solid blue, 270px              │ Same enterprise stack,
   pulse animation                │ right-sized for SME budgets.
   → /sme/ landing page           │
```

Sizing: `--hero-side-btn-w: clamp(220px, 22vw, 300px)` keeps Industry/SME buttons in lockstep at every viewport. Right-side elements (See Auto + SME tag) use `flex: 1 1 0` so their right edges anchor to the stats row's `200+ COUNTRIES` right edge above.

Mobile (≤600px): rows stack vertically, buttons go full-width, gold border-left becomes border-top on the SME tag.

The **Request Briefing** CTA was removed from the hero (lives only in the sticky nav now). The **Defragment Now · {date}** live status row was also removed — too "patchwork" per UX critique. The SME button's gentle 3.2s pulse animation replaces the explicit "Click left ←" / "Click up ↑" text cues.

---

## 6. Performance optimizations

- **Single critical-path CSS file** — no preprocessor, no @import chain
- **`content-visibility: auto`** on 6 sections (reliability, infra, audit, industries, departments, footer) — browser skips paint of ~80% of the page on first load
- **`contain-intrinsic-size`** reserves layout height so the scrollbar doesn't jump as sections enter the viewport
- **ECharts + world.json lazy-loaded** behind an IntersectionObserver — saves ~2 MB of initial JS / JSON
- **Hero video** at H.264 + `preload="metadata"` so only the first MOOV box ships until autoplay starts
- **Variable Inter font** — single woff2 covers all weights
- **JetBrains Mono dropped** — saved one cross-origin font request (was only used by an old loader UI)
- **Decorative bg-canvas particle network DELETED** (~125 lines of unreachable JS + element + CSS rule)
- **Service Worker** precache for the app shell (~250 KB) + network-first for `content.json` so editorial updates land instantly
- **Speculation Rules** prerender for `/c/?u=joycetsam` so the public card route is instant from the homepage
- **`<link rel="preload" as="fetch" crossorigin="anonymous">`** for `content.json` — overlaps network with HTML parse
- **Two-pass render in main.js** — above-fold data renders sync, below-fold yields to `scheduler.yield()` so above-fold paints first

Total above-the-fold transfer (gzipped):
- index.html ~19 KB
- style.css ~26 KB
- main.js ~19 KB
- content.json ~7 KB
- **~71 KB** total to first interactive — well under the 100 KB benchmark.

---

## 7. Responsive design system

All sizing is **fluid** via `clamp()`. No staircase media-query breakpoints for typography:

```css
/* Headings */
.sec-title  { font-size: clamp(1.125rem, 1.4vw + 0.7rem, 1.75rem); }
.strip-tag  { font-size: clamp(1.125rem, 1.4vw + 0.7rem, 1.75rem); }

/* Footer text — two-tier scale */
.footer {
  --footer-fs-body: clamp(10.5px, 0.55vw + 0.4rem, 12.5px);
  --footer-fs-meta: clamp(9.5px,  0.45vw + 0.35rem, 11px);
}

/* Hero CTAs */
:root { --hero-side-btn-w: clamp(220px, 22vw, 300px); }
```

Hard breakpoints exist only for **structural** changes:

| Breakpoint | What flips |
| --- | --- |
| 1600px+ | Compliance pills wrap from 3 cols × 2 rows back to 6 cols × 1 row |
| 1280px | Stats row, footer grid 2/3 + 1/3 splits stay; below this stays 3+3 compliance |
| 1100px | Trust card panes stack vertically (Network on top, Compliance on bottom) |
| 768px  | Hero becomes single-column, video opacity drops to 0.55, gradient mask intensifies |
| 640px  | Stats row → vertical billboard layout, big number left + label right |
| 600px  | Hero CTA rows stack to full-width buttons, SME tag border flips left → top |
| 480px  | Eyebrow font drops to 8.5px so compliance copy stays one line |
| 340px  | Eyebrow allows wrap (final fallback for very small Androids) |

---

## 8. Mobile-specific UX choices

Roy's UX critique drove these decisions:

1. **Stronger gradient mask** on hero — `linear-gradient(180deg, rgba(0,45,92,0.94) 0% → 0.30 100%)` so the busy globe video sits behind a near-opaque navy curtain in the upper 60% (where text lives) and fades to ~30% at the bottom.
2. **Video opacity 0.55 on phones** so glowing connection lines don't fight body copy.
3. **Stats matrix → vertical billboard** on phones: each stat on its own row with big gold number left + label right + gold hairline divider — no more squished 9px footnotes.
4. **No "Click left ←" text cues** — replaced by a 3.2s pulse animation on the SME button (gold halo expand/contract + arrow drift). Pauses on hover, respects `prefers-reduced-motion`.
5. **SME tag line-height 1.78** on mobile (vs 1.55 desktop) so 2-3 line wraps read as comfortable mini-paragraphs.
6. **Eyebrow gradient + dual shadow** so the "OPERATED UNDER…" pill reads as a lit-from-above tablet, not a flat washed-out chip.

---

## 9. Service Worker contract

`sw.js` (single file, ~5.5 KB) handles:

- **Install**: pre-cache the app shell + lib/ libs (~250 KB total)
- **Activate**: drop old caches when `CACHE_VERSION` changes
- **Fetch routing**:
  - `content.json` → **network-first** (so editorial updates show fast)
  - everything else → **cache-first**, refresh in background
  - HTML navigations on offline → fall back to `offline.html`

```js
const CACHE_VERSION = 'dolphlink-v195';   // bump on major changes
const PRECACHE = [
  'index.html', 'offline.html',
  'css/style.css', 'css/register.css',
  'js/main.js', 'js/register.js', 'js/c.js',
  'c/', 'c/index.html', 'c/c.css',
  'media/img/video-poster.webp', 'media/video/current.mp4',
  'media/icon/3D/logo.webp', 'seo/site.webmanifest',
  'lib/echarts.min.js', 'lib/world.json', 'lib/qrcode.min.js',
];
```

`SKIP_WAITING` opt-in: the page surfaces a "new build available" toast; user clicks Refresh, page posts `{type: 'SKIP_WAITING'}` to the waiting SW, controllerchange triggers a single reload.

---

## 10. Cache-buster cascade

When deploying a content / CSS / JS change, bump in this order so users actually see the new version:

| File | Variable |
| --- | --- |
| `content/content.json` | edit JSON |
| `js/main.js` | `const CONTENT_VERSION = '20260507af'` |
| `index.html` | `<link rel="preload" href="content/content.json?v=20260507af">` |
| `index.html` | `<link rel="stylesheet" href="css/style.css?v=152">` |
| `index.html` | `<script src="js/main.js?v=72">` (also nav script v=16) |
| `sw.js`  | `const CACHE_VERSION = 'dolphlink-v195'` |

Service worker activation reload happens automatically on `controllerchange`; without bumping CACHE_VERSION users on the SW would keep seeing the cached old shell.

---

## 11. Local development

No build step required. From the repo root:

```bash
# Quickest — Python's built-in static server
python3 -m http.server 5500

# Or use start-local-test.bat (Windows convenience wrapper)
./start-local-test.bat
```

Open http://localhost:5500/ — service worker caches will install on first load. To bypass them while iterating, DevTools → Application → Service Workers → Update on reload.

For lint:

```bash
# CSS — manual sweep, no automated tool installed
# JS  — manual ESLint run (ESLint is not in the repo; rely on browser console)
# HTML — W3C validator UI: https://validator.w3.org/
```

---

## 12. Browser-side dependencies

| Lib | Where | Version | Lazy? |
| --- | --- | --- | --- |
| ECharts | `lib/echarts.min.js` | 5.4.3 | Yes — IntersectionObserver |
| ECharts world map | `lib/world.json` | matching | Yes — fetched after ECharts init |
| qrcode.js | `lib/qrcode.min.js` | latest | Yes — only when QR card renders |
| jsQR | `lib/jsQR.js` | latest | Yes — only on QR scanner open |

Local mirrors are populated by `lib/download.ps1` / `lib/download.sh`. If a local file is missing, the JS loader falls back to jsdelivr automatically.

No npm dependencies, no node_modules — the repo is pure source.

---

## 13. SEO + structured data

- Full SSR pre-rendered HTML in `index.html` so crawlers index complete content
- JSON-LD `Organization` + `Service` blocks at the bottom of `<head>`
- OG / Twitter card meta with `media/icon/3D/logo.webp` as the share image
- `seo/sitemap.xml` and `robots.txt` published at site root
- All anchors have visible text + scroll-to behaviour
- `<noscript>` slim banner instead of full-page takeover so JS-disabled crawlers see the same content

---

## 14. Trust-layer guard rails

The site claims sovereign-grade trust. To stay credible:

- **Numbers**: every claim (`99.999%`, `1,000+ tier-1 routes`, `200+ countries`) is sourced; the values live in `content.json` and are reviewed by Joyce / Compliance before each release
- **Logos / wordmarks**: trust wall uses **regions** (Asia-Pacific / EMEA / Americas) instead of named carriers — avoids permission disputes
- **Compliance pills**: only show frameworks DOLPHLINK actually complies with (ISO 27001 / MAS TRM / IM8 / PDPA / GDPR / SOC 2)
- **No personal names**: the public site references "Sales · Briefings · Partnerships" — internal director names live behind the QR code on the business card, not in the public copy

---

## 15. Architecture decision log (recent)

| Decision | Rationale |
| --- | --- |
| Drop the decorative bg-canvas particle network | Was burning CPU for "design noise"; sovereign brand register prefers stillness |
| Drop JetBrains Mono font | Only used by the retired loader; saved one network request |
| Trust card consolidation (4-row → 1 unified card) | Read as one credential block, not two competing strips |
| Network cards uniform gold border (was 3px gold left + 1px cyan) | Symmetric framing rhymes with the wrapping unified card |
| Stats matrix vertical-billboard on mobile | Big numbers > squished horizontal footnote |
| Remove "Click left ←" / "Click up ↑" text cues | Patchwork UX; pulse animation signals interactivity intuitively |
| Hero gradient mask intensification on mobile | Globe video was fighting body copy at narrow widths |
| Eyebrow gradient + bevel + drop shadow | Was visually flat; now reads as a lit metallic plate |
| All sub-titles / hero CTAs use `clamp()` | Continuous responsive scaling, no breakpoint stairs |
| Footer type two-tier (`--footer-fs-body` / `--footer-fs-meta`) | Email overflow ("Salesmark…ng@dolphlink.co" / "m" wrap) gone |

---

## 16. Pre-deploy checklist

- [ ] `content.json` saved as valid JSON (run `python -m json.tool content/content.json`)
- [ ] `CONTENT_VERSION` bumped in `js/main.js`
- [ ] `content.json?v=…` bumped in `index.html`
- [ ] `style.css?v=…` and `main.js?v=…` bumped in `index.html`
- [ ] `CACHE_VERSION` bumped in `sw.js`
- [ ] Hero KPIs match Compliance / Joy / Sales attestations
- [ ] DOLPHLINK SG address line accurate (`9 Raffles Place #29-04 Republic Plaza Singapore 048619`)
- [ ] All emails (`Salesmarketing@dolphlink.com`, `Joycetsam@dolphlink.com`) live
- [ ] Test offline mode (DevTools → Network → Offline → reload)
- [ ] Test SW update flow (DevTools → Application → SW → trigger update)
- [ ] Spot-check Lighthouse: target ≥ 95 mobile, ≥ 98 desktop

---

## 17. Contact

Bug reports / pull requests / content updates: raise a GitHub issue, or email **Salesmarketing@dolphlink.com**. The site is the front door — keep it sharp.
