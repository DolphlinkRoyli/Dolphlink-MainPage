# Architecture

## Module dependency graph

```
                                 ┌──────────────┐
                                 │  index.html  │
                                 │ (built from  │
                                 │  templates/) │
                                 └──────┬───────┘
                                        │ <script type="module">
                                        ▼
                                 ┌──────────────┐
                                 │   js/app.js  │  Entry point — orchestrator
                                 └──────┬───────┘
                                        │
              ┌───────────────────┬─────┴──────┬──────────────────┬──────────────┐
              ▼                   ▼            ▼                  ▼              ▼
        ┌──────────┐       ┌────────────┐ ┌──────────┐    ┌──────────────┐ ┌──────────┐
        │  engine/ │       │  render/   │ │ modules/ │    │   icons/     │ │   ...    │
        │ (boot +  │◄──────│ (per-      │ │ (lazy    │    │ (SVG icon    │ │          │
        │  hydrate)│       │  section)  │ │  feats)  │    │  builders)   │ │          │
        └──────────┘       └────────────┘ └──────────┘    └──────────────┘ └──────────┘
             │                   │            │                  ▲
             │                   ▼            │                  │
             │            ┌────────────┐      │                  │
             └───────────►│  utils.js  │◄─────┘                  │
                          │ escapeHtml │                         │
                          │ getByPath  │                         │
                          └────────────┘                         │
                                                                 │
                          ┌────────────┐                         │
                          │ tokens.js  │                         │
                          │ (date      │                         │
                          │  expander) │                         │
                          └────────────┘                         │
                                                                 │
                          ┌────────────┐                         │
                          │  loader.js │ fetch + cache           │
                          │ content.   │ content.json            │
                          │ json       │                         │
                          └────────────┘                         │
                                                                 │
                          ┌────────────┐                         │
                          │ hydrate.js │ data-key /              │
                          │            │ data-href-key /         │
                          │            │ data-current-date       │
                          └────────────┘                         │
                                                                 │
                          ┌──────────────┐                       │
                          │ lib-loader.js│ ECharts / QR          │
                          │              │ local-first / CDN     │
                          └──────────────┘                       │

  render/{hero, stats, portfolios, audit, menu, trust, ...}.js
                          │
                          └─── imports {escapeHtml, ...} from engine/utils.js
                          └─── may import SVG_ICON_BUILDERS from icons/svg-builders.js

  modules/{card-detail, map, footer-card, scroll, loader-shell}.js
                          │
                          └─── imports {loadScriptOnce, debounce} from engine/
                          └─── card-detail imports SVG_ICON_BUILDERS from icons/
```

The engine imports nothing from render/, icons/, or modules/. That's
the test for "is this engine code?" — engine code is project-agnostic
and reusable; everything else holds project-specific markup, copy, or
feature wiring.

## Data flow at runtime

```
  ┌────────────┐   fetch   ┌──────────────┐
  │ content/   │ ────────► │  loader.js   │
  │ content.   │           │ (single      │
  │ json       │ ◄──────── │  promise +   │
  └────────────┘   cache   │  caching)    │
                           └──────┬───────┘
                                  │ resolves with
                                  ▼
                           ┌──────────────┐
                           │  app.js      │
                           │  bootstrap() │
                           └──────┬───────┘
                                  │ setHydrationContent(content)
                                  ▼
                           ┌──────────────┐
                           │  hydrate.js  │  Walks DOM:
                           │              │   • [data-key]
                           │              │   • [data-href-key]
                           │              │   • [data-current-date]
                           └──────┬───────┘  Replaces text / hrefs.
                                  │
                                  ▼
                           ┌──────────────┐
                           │  app.js      │  For every [data-render]:
                           │  RENDERERS   │   look up key, dispatch
                           │  registry    │   to render/<key>.js
                           └──────┬───────┘
                                  │  Above-fold sync.
                                  │  Below-fold yields between.
                                  ▼
                           ┌──────────────┐
                           │ loader-shell │  Fade out the
                           │ .hideLoader  │  pre-read overlay.
                           └──────────────┘
                                  │
                                  ▼  IntersectionObserver triggers:
                           ┌──────────────┐
                           │ map.js       │  Lazy-loads ECharts
                           │ footer-card  │  Lazy-loads QR lib
                           │ card-detail  │  Wires click → expand
                           └──────────────┘
```

## Cache + Service Worker

```
  Browser request
        │
        ▼
  ┌──────────────┐
  │   sw.js      │
  │   fetch      │
  │   handler    │
  └──────┬───────┘
         │
         ├── content.json   → network-first, cache fallback
         ├── /api/*         → bypass (none currently)
         └── everything     → cache-first, background refresh
                              else: full network → cache → respond

  CACHE_VERSION bumps on every PRECACHE-list change.
  Old caches deleted on `activate` event.
  Page reloads when SW takes over (controllerchange).
```

## Build pipeline

```
  templates/                                      build/
  ├── _layout.html  ──┐                          ├── manifest.json
  ├── head.html       │                          └── build.py
  ├── nav.html        │                                │
  ├── hero.html       │   manifest.json maps           │
  ├── trust.html      │── {{ TOKEN }} → file ──────────┤
  ├── ...             │                                │
  └── footer.html  ───┘                                ▼
                                                ┌──────────────┐
                                                │   index.html │
                                                │   (deployable│
                                                │    artifact) │
                                                └──────────────┘
```

`build.py` is dependency-free Python stdlib. Run `python3 build/build.py`
to rebuild `index.html`. Run with `--check` to verify the existing
`index.html` matches the templates (useful as a CI gate).

## Why this split

Three goals drove the refactor:

1. **Re-skinning** — swap brand by editing `css/tokens.css` +
   `content/content.json` + `templates/head.html`. No code changes.
2. **Re-using** — lift `js/engine/`, `js/icons/`, `js/render/`,
   `js/modules/`, and `build/build.py` into a new project; they
   carry no DOLPHLINK-specific logic.
3. **SEO + accessibility** — pre-baked SSR HTML means crawlers,
   screen readers, and AI agents see the full content immediately.
   JS hydration is a layer on top, not a prerequisite.
