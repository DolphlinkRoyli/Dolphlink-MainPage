# DOLPHLINK Marketing Site — Technical README

> **Live**: https://dolphlinkroyli.github.io/Dolphlink-MainPage/
> **Owner**: Baiwu Technology Group → DOLPHLINK PTE. LTD. (Singapore)
> **Audience for this doc**: Engineers maintaining or extending the site
> **Companion doc**: `DOLPHLINK_Site_Specification.md` (marketing / SEO spec)

A static, JSON-driven marketing site for DOLPHLINK — Singapore's sovereign CPaaS and AI orchestration platform. Designed for B2B enterprise buyers (governments, FinTech, healthcare, regulated enterprises). Built as a single-page experience with progressive enhancement, server-side-rendered static HTML, and aggressive performance optimization.

---

## 1. Stack at a glance

| Layer | What | Why |
| --- | --- | --- |
| **Hosting** | GitHub Pages (static) | Zero-cost, edge-cached, no backend |
| **HTML / CSS / JS** | Vanilla, no framework | Footprint matters — every byte is on the wire |
| **Service Worker** | Custom (`sw.js`) | Offline support + cache invalidation control |
| **Charts** | ECharts 5.4.3 (lazy-loaded) | World map only, no other charts |
| **Fonts** | Inter (variable) + JetBrains Mono | Variable font = single woff2 instead of 6 files |
| **Video** | MP4 (H.264, autoplay loop muted) | Hero backdrop, GIF-style behaviour at 1/10 the size |
| **Build** | Optional `cms/build.py` | CSV → JSON pipeline; can also edit JSON directly |
| **CMS** | None — content lives in `content/content.json` | Content team edits via PR or via CSVs in `/cms` |
| **Analytics** | Not installed | Add GA4 / Plausible later if needed |

**Browser targets**: Chrome 90+, Edge 90+, Safari 15+, Firefox 90+. Graceful degradation for IE/old Android via no-JS HTML pre-rendering.

---

## 2. Repository layout

```
dolphlink/
├── index.html              # Main page — SSR pre-rendered, ~76 KB
├── content/
│   └── content.json        # Single source of truth for visible copy
├── css/
│   ├── style.css           # ~96 KB, plain CSS, no preprocessor
│   └── register.css        # Briefing-modal styles (loaded async)
├── js/
│   ├── main.js             # ~59 KB hero / portfolio / map renderer
│   ├── register.js         # Briefing-modal logic
│   └── register-scanner.js # QR scanner (lazy-loaded)
├── lib/                    # Local copies of external libs
│   ├── echarts.min.js      # 1 MB, lazy-loaded
│   ├── world.json          # 987 KB ECharts geojson
│   ├── qrcode.min.js       # 21 KB, lazy-loaded
│   ├── jsQR.js             # 251 KB, only on scanner open
│   ├── download.ps1        # PowerShell to refresh libs
│   ├── download.sh         # bash equivalent
│   └── README.md
├── media/
│   ├── img/
│   │   └── video-poster.webp   # 92 KB, hero LCP image
│   ├── icon/3D/
│   │   └── logo.webp           # 5 KB brand mark
│   └── video/
│       └── current.mp4         # 2.7 MB, 8s, 1280×720, loop
├── cms/                    # CSV-based content pipeline (partial)
│   ├── build.py            # Run to regenerate content.json
│   ├── text.csv            # Flat key/value strings
│   ├── menu.csv            # Nav items
│   ├── stats.csv           # Reliability cards
│   ├── portfolios.csv      # Portfolio items (legacy schema)
│   ├── audit.csv           # Trust Layer cards
│   ├── sectors.csv         # Industry sectors
│   └── locations.csv       # Map points
├── seo/
│   ├── site.webmanifest    # PWA manifest
│   ├── sitemap.xml
│   └── robots.txt
├── c/                      # Public vCard landing (/c/?u=joycetsam)
│   ├── index.html
│   ├── c.css
│   └── ...
├── offline.html            # Service-worker offline fallback
├── sw.js                   # Service worker
├── README.md               # ← This file
└── DOLPHLINK_Site_Specification.md  # Marketing / SEO content spec
```

---

## 3. Content pipeline

**Source of truth**: `content/content.json` — everything visible on the site (copy, numbers, links, regulator names, KPIs) lives here.

### Three ways to edit content

1. **Direct edit** of `content/content.json` (fastest, JSON-savvy editors only)
2. **Edit CSVs** in `/cms` then run `python cms/build.py` (safer for non-developers, but the CSVs only cover a subset of keys — see `cms/README.md`)
3. **PR review** workflow — open a branch, edit JSON, deploy via merge

### Critical: bump `CONTENT_VERSION` after every edit

After modifying `content/content.json`, update **both** of these to the same value:

```js
// js/main.js  (~line 690)
const CONTENT_VERSION = '20260507x';  // bump

// index.html  (in <head>)
<link rel="preload" as="fetch" href="content/content.json?v=20260507x" crossorigin="anonymous">
```

Use the format `YYYYMMDD<letter>` — e.g. `20260512a`, `20260512b` for second edit same day. The version is a cache-buster: it forces browsers to re-fetch the JSON instead of serving stale.

### content.json schema (high level)

```jsonc
{
  "_comment": "Edited directly...",
  "nav":          { "brandName", "ctaLabel", "ctaMailto", "menuItems": [...] },
  "hero":         { "eyebrow", "h1Line1", "h1Line2", "tagline",
                    "ctaPrimary", "ctaPrimaryMailto",
                    "ctaSecondary", "ctaSecondaryScrollTo",
                    "stats": [{ "value", "label" }] },
  "trustWall":    { "headerTag", "operatorsLabel", "regulatorsLabel",
                    "operators": [...], "regulators": [...] },
  "reliability":  { "headerTag", "stats": [{ "key", "icon", "value", "label", "desc" }] },
  "portfolios":   { "headerTag", "intro",
                    "pillars":  [{ "key", "name", "tagline", "desc" }],
                    "items":    [{ "key", "pillar", "icon", "label", "tagline",
                                   "recommend", "recommendTier", "desc" }] },
  "audit":        { "title", "items": [{ "title", "desc" }] },
  "industries":   { "headerTag", "intro", "primaryLabel", "secondaryLabel",
                    "items": [{ "key", "tier", "name", "color", "desc", "chips" }] },
  "departments":  { "headerTag", "intro", "items": [{ "key", "name", "desc" }] },
  "charts":       { "mapLabel", "locations": [{ "name", "value": [lng, lat], "isHQ" }] },
  "footer":       { "brandTitle", "brandTagline", "missionLabel", "missionText",
                    "locationLabel", "locationLine1", ... ,
                    "vcardEyebrow", "vcardHeading", ... ,
                    "social": [...], "legalLinks": [...], "copyright" }
}
```

---

## 4. Page sections (top-to-bottom)

| ID / class | What | Render path |
| --- | --- | --- |
| `<nav>` | Top nav: brand + menu + CTA | `data-key="nav.*"` + `data-render="nav.menuItems"` |
| `#h-sec .hero` | Cinematic hero with full-bleed video, h1, tagline, KPI stats, CTAs | `data-key="hero.*"` + `data-render="hero.stats"` |
| `.trust-section` | Carrier Network & Compliance — gold-bordered panel, 4-cell global network grid + 6 regulator pills + 3 trophies + audit fine print | `data-key="trustWall.*"` + `data-render="trustWall.operators"`, `data-render="trustWall.regulators"` |
| `#r-sec` | Reliability Matrix — 5 stat cards (uptime / countries / delivery / orchestration / open rate) | `data-render="reliability.stats"` |
| `#n-sec` | The Portfolio — 3 pillars × 3 products = 9 cards | `data-render="portfolios.items"` (uses `pillars` array for grouping) |
| `#a-sec` | The Trust Layer — 4 audit boxes (Compliance / Sovereignty / Reliability / Access) | `data-render="audit.items"` |
| `#i-sec` | Industries We Serve — 4 primary (Banking / Gov / Health / Insurance) + 5 secondary | `data-render="industries.items"` |
| `.departments-section` | Departments We Empower — 4 cards (Customer Service / Marketing / IT / Digital Transformation) | `data-render="departments.items"` |
| `.footer` | Map + brand tagline + HQ address + Sales contacts + Joyce vCard + legal | Multiple `data-key` + `data-render` |

### How rendering works

1. HTML ships **fully pre-rendered** with static content (so crawlers / no-JS / AI agents see real text instantly).
2. On page load, `js/main.js` fetches `content/content.json` and **re-renders** sections inside `[data-render="..."]` containers, plus updates text inside `[data-key="..."]`.
3. If the JSON content matches what was pre-rendered, this is a no-op visually.
4. If content has been edited, JS overwrites the static fallback with the new copy.

This dual-track approach gives you SEO + crawler friendliness AND the ability to ship copy updates without rebuilding HTML.

---

## 5. Performance optimizations

| Technique | Where | Impact |
| --- | --- | --- |
| **SSR pre-render** | `index.html` | All copy in raw HTML → crawlers + Lighthouse + AI agents read full content immediately |
| **Variable Inter font** | `<head>` link | Single woff2 across 100..900 weight axis (vs 6 separate files) |
| **JetBrains Mono deferred** | inline script in `<head>` | Loaded 1.5s after page load (only loader uses it) |
| **`<link rel="preload" as="fetch">`** | `content.json` | Parallel download with HTML parse — saves a round-trip |
| **`fetchpriority="high"`** | hero `video-poster.webp` | LCP image gets top download priority |
| **Lazy ECharts** | `js/main.js` | 1 MB ECharts only loads when map scrolls into view (IntersectionObserver) |
| **Local libs** | `lib/` | echarts / qrcode / world.json served same-origin (no jsdelivr roundtrip) with CDN fallback |
| **MP4 over GIF** | `media/video/current.mp4` | 2.7 MB H.264 vs ~30 MB equivalent GIF |
| **Service Worker** | `sw.js` | Pre-caches shell on install; cache-first for static, network-first for JSON |
| **`scheduler.yield()`** | `loadAndRender()` in main.js | Slices long render tasks into <50 ms chunks (Chrome 129+) |
| **`requestIdleCallback`** | (none currently — particle-net retired) | — |
| **`content-visibility: auto`** | below-fold sections | Browser skips rendering off-screen content |
| **Variable font** | Inter | Single file vs 6 weights |
| **`<noscript>` slim banner** | top-of-body | No-JS users see real content + small banner; not a takeover |
| **Speculation Rules** | `<head>` | Chrome prerenders `/c/?u=joycetsam` on idle |

### LCP target
- **Mobile**: 1.8–2.4s on 4G
- **Desktop**: 1.0–1.5s on cable

### Total transfer for first paint (gzipped, approximate)
- HTML: ~13 KB
- CSS: ~14 KB
- JS: ~12 KB
- content.json: ~4 KB
- video-poster.webp: 92 KB (LCP image)
- Logo: 5 KB
- **Total critical: ~140 KB** (gzip estimate ~50 KB)

---

## 6. Versioning & cache invalidation

After **any** change to assets, bump the relevant version number:

| File changed | Bump in | Format |
| --- | --- | --- |
| `css/style.css` | `index.html` | `style.css?v=N` (increment N) |
| `js/main.js` | `index.html` | `main.js?v=N` |
| `content/content.json` | `js/main.js` `CONTENT_VERSION` + `index.html` preload link | `YYYYMMDD<letter>` |
| `js/register.js` | `index.html` | `register.js?v=N` |
| `css/register.css` | `index.html` | `register.css?v=N` |
| Any media file | `sw.js` `CACHE_VERSION` | `dolphlink-vN` |

**`sw.js CACHE_VERSION`** must be bumped whenever ANY pre-cached asset changes — this is what tells installed Service Workers to invalidate the old cache. Bump it for every release.

### Why versioning matters

1. Browsers cache CSS/JS aggressively. Without a version query string, users see stale files even after deploy.
2. Service Worker pre-caches the entire app shell. Without bumping `CACHE_VERSION`, returning users serve from old cache forever.
3. `CONTENT_VERSION` ensures content.json always returns fresh data when edited.

---

## 7. Deployment

The site is hosted on **GitHub Pages** at `dolphlinkroyli/Dolphlink-MainPage`. Deployment is `git push` → automatic.

### Standard deploy flow

```bash
# 1. Edit files
vim content/content.json
vim css/style.css

# 2. Bump versions per the table above
#    (style.css?v=93 → ?v=94, etc.)

# 3. Commit & push
git add -A
git commit -m "Update hero copy + bump cache versions"
git push origin main

# 4. Wait ~30s for GitHub Pages to deploy
# 5. Hard-refresh test: Ctrl+Shift+R
# 6. Verify SW updated:
#    DevTools → Application → Service Workers → check version label
```

### Rollback

```bash
git revert HEAD
git push
# OR force back to a known-good commit:
git reset --hard <commit-sha>
git push -f
```

Service workers will detect the new version on next visit and update; users can hit the "Refresh" toast that appears.

---

## 8. Local development

```bash
# Serve the folder over HTTP (Service Workers won't register from file://)
cd dolphlink/
python3 -m http.server 8000
# OR
npx serve .
# OR (VS Code) — Live Server extension
```

Then open `http://localhost:8000` (or whatever port you used).

### Refreshing local libs

```bash
cd lib/
.\download.ps1   # Windows
# OR
bash download.sh  # macOS / Linux
```

Versions in `download.ps1` / `download.sh` — bump if you want a newer ECharts/qrcode/jsQR.

### Adding a new product card to a pillar

1. Open `content/content.json`
2. Append to `portfolios.items` array:
   ```json
   {
     "key": "newproduct",
     "pillar": "orchestration",  // connectivity / orchestration / governance
     "icon": "icon_X",            // see SVG_ICON_BUILDERS in main.js, or use webp
     "label": "Product Name",
     "tagline": "Short tag",
     "recommend": "NEW",          // FLAGSHIP / PROVEN / NEW
     "recommendTier": "gold",     // gold / blue
     "desc": "Full description..."
   }
   ```
3. Bump `CONTENT_VERSION`
4. Pre-render the static HTML (see `cms/README.md` or run the inline Python from the deploy notes)
5. Bump `sw.js CACHE_VERSION`
6. Commit & deploy

### Adding a new industry

Same as above but in `industries.items`. Set `tier: "primary"` (full card with chips, max 4) or `tier: "secondary"` (mini list-row card, no chips). Use brand colour `#0059B3` for secondary unless there's a reason to differentiate.

---

## 9. SEO / Indexing

- **Title**: in `<title>` and OG / Twitter card tags
- **Meta description**: in `<meta name="description">` plus OG / Twitter
- **Keywords**: in `<meta name="keywords">` (kept minimal, real estate is for buyers not for keyword stuffing)
- **JSON-LD structured data**: `Organization` + `Service` + 9× `Product` schemas embedded in `<script type="application/ld+json">` blocks. Helps Google build a Knowledge Graph card.
- **Sitemap**: `seo/sitemap.xml` — single URL with image annotation
- **Canonical URL**: `<link rel="canonical">` set to the apex GitHub Pages URL
- **Open Graph + Twitter cards**: image set to `media/img/video-poster.webp` (1280×720)
- **Robots**: `seo/robots.txt` allows everything, points to sitemap
- **JS-free indexing**: All content is in raw HTML — every crawler (GPTBot, ClaudeBot, PerplexityBot, Bingbot, Googlebot) reads the full content without executing JavaScript

To verify SEO health post-deploy:
- Google Search Console → URL Inspection → "Test Live URL"
- `view-source:https://...` and grep for any keyword you care about — it should be in the HTML

---

## 10. Known limitations

| Limitation | Why | Plan |
| --- | --- | --- |
| Hard-coded numbers (99.999% / 1,000+ / 200+) | Static site, no live telemetry feed | Add GraphQL / REST endpoint when an API exists |
| No customer logos | Not enough signed customer-marketing rights | Add as customer base grows |
| No testimonials | Same — needs real quotes with attribution | Add post-MVP |
| `cms/build.py` only reads a subset of keys | The CMS was scoped before content schema grew | Extend to cover portfolios.pillars, industries.tier, etc. — or migrate to direct JSON editing |
| ECharts world map needs JS | No SSR fallback for the map | Acceptable — map is decorative; full address text is in HTML |
| Video is 2.7 MB | Cinematic backdrop, MP4 H.264 | Acceptable — autoplay and lazy-after-LCP. Could ship WebM as `<source>` for further savings |
| No A/B testing infrastructure | Static site | Add a feature-flag JSON if needed |
| No Google Analytics / Plausible | Not yet installed | Add when conversion tracking matters |

---

## 11. PWA install support

The site is a Progressive Web App:
- `seo/site.webmanifest` defines installability
- `sw.js` provides offline shell + asset caching
- The footer "Install App ↗" link triggers `window.dolphlinkInstall()` (defined inline in `index.html`) which uses the captured `beforeinstallprompt` event on Chromium browsers, falls back to platform-specific instructions on iOS / Firefox.

After install, the app launches as a standalone PWA window with offline support for the entire shell.

---

## 12. Service Worker behaviour

`sw.js` ships:
- **Pre-cache on install**: HTML, CSS, JS, content.json, register CSS/JS, c/ landing, video-poster.webp, current.mp4, logo, manifest, lib/echarts.min.js, lib/world.json, lib/qrcode.min.js
- **Fetch strategy**:
  - `content.json` → network-first, fallback to cache (live updates show fast)
  - Everything else → cache-first, fallback to network (offline-first feel)
- **Update flow**: when `CACHE_VERSION` changes, the new SW installs in background. Page detects via `controllerchange` event and shows a "Refresh" toast (defined inline in `index.html`).

To force a clean SW state during dev:
- DevTools → Application → Storage → Clear site data
- OR DevTools → Application → Service Workers → Unregister

---

## 13. Trust Layer / Compliance copy — guard rails

This is a B2B sovereign-infrastructure site. **Never** add unverified compliance claims. The current claims map back to:

| Claim | Source |
| --- | --- |
| `99.999%` uptime | Internal SLA (verify quarterly) |
| `1,000+` Tier-1 routes | Baiwu Tech public claim ("上千家运营商直连") |
| `200+` countries | Baiwu Tech public claim |
| ISO 27001 / GDPR | Active certifications |
| MAS TRM / IM8 / PDPA | Aligned-with framework (not certified — check copy if changed) |
| SOC 2 | Pursuing — verify before marketing |
| `Singapore-licensed` | DOLPHLINK PTE. LTD. (202203440N), reg'd 2022-01-28 as VAS / telecoms reseller |

If copy needs to be tightened or expanded for legal review, that's a content.json edit, not code. Update the keys, bump CONTENT_VERSION, redeploy.

**Carrier names** are deliberately NOT shown on the site (no Singtel / Telstra / Reliance Jio / etc. as named partners) to avoid trademark misrepresentation. The trust wall uses regional groupings (`Asia-Pacific / EMEA / Americas / 1,000+ Global Routes`) instead. Don't add specific carrier names without signed partnership-marketing agreements.

---

## 14. Architecture decisions log

Short historical notes on why things look the way they do. Useful when someone asks "why isn't this a Next.js app?".

- **Static + JSON over Next.js**: GitHub Pages doesn't run Node. Build complexity not justified for a single-page brochure site. JSON-driven approach gives a content-team ergonomic without dragging in a CMS service.
- **No framework**: ~150 KB of framework runtime would dwarf the actual content. Vanilla JS keeps the site under 60 KB compressed.
- **SSR pre-render baked into HTML**: Crawler-friendly + Lighthouse-friendly. JS just hydrates / overrides if content has changed.
- **Hero video as full-bleed background**: Sovereign-infrastructure "film" register. Replaced earlier 50/50 split (text + video card) which felt SaaS-y.
- **No marquee on trust wall**: Earlier had carrier-name marquee scrolling — retired because the constant motion fought the "calm authority" register sovereign buyers expect.
- **Service Worker auto-update toast**: Standard PWA pattern. Users get fresh content within seconds of a deploy.
- **3-pillar portfolio (3×3)**: Replaced flat 9-card grid because Miller's law (7±2) said 9 atoms was hard to scan. Three thematic pillars each with three products is much easier to mentally categorize.
- **Industries split (4 primary + 5 secondary)**: Same cognitive-load rationale. Four primary verticals get full cards; five secondary verticals get mini list-rows.
- **No customer logos / testimonials yet**: Premature for a site at this trust level. Faking with stock photos / anonymized quotes is worse than not having them.

---

## 15. Quick checklists

### Pre-deploy

- [ ] All `data-key` / `data-render` containers have static fallback content (re-run pre-render Python script if you edited content.json)
- [ ] `CONTENT_VERSION` in `js/main.js` matches the `?v=` in `index.html` preload link
- [ ] `style.css?v=N` and `main.js?v=N` bumped if those files changed
- [ ] `sw.js` `CACHE_VERSION` bumped
- [ ] Hard-refresh (Ctrl+Shift+R) renders correctly on Chrome and Safari
- [ ] DevTools console is clean (no errors, no warnings)
- [ ] Lighthouse mobile score ≥ 80

### Post-deploy

- [ ] Visit site, verify SW "new version available" toast appears (then click it)
- [ ] Click 5 random portfolio cards — each opens its detail panel cleanly
- [ ] Click 5 reliability stat cards — same
- [ ] Map renders (after scrolling to footer)
- [ ] Mobile viewport: hero h1 not clipped, KPI strip wraps, trust wall stacks correctly
- [ ] `view-source:` and grep for "Singapore" — should be in the raw HTML

---

## 16. Contact

For technical handoff or maintenance questions: `Salesmarketing@dolphlink.com` (cc'd to `Joycetsam@dolphlink.com`).

For the marketing / SEO content spec, see `DOLPHLINK_Site_Specification.md` in this repo.
