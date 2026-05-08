# JS Tree Cleanup — Pending Moves

**Goal:** `js/` root directory should only hold `app.js` (the entry point).
Everything else lives in `js/engine/`, `js/render/`, `js/modules/`, `js/icons/`.

## Already done (this session)

- `js/main.js` → content replaced with deprecation stub. Safe to physically delete.
- All references to `js/main.js` already removed from `index.html` + `sw.js` PRECACHE.

## Pending moves (need a real `mv` — bash sandbox was unavailable)

Run these on Windows (PowerShell or via Git Bash) when convenient:

```bash
git mv js/register.js          js/modules/register.js
git mv js/register-scanner.js  js/modules/register-scanner.js
git mv js/card.js              js/modules/card.js
git rm  js/main.js
```

Then update the references in three files:

### 1. `index.html`

Find:
```html
<script src="js/register.js?v=16" defer></script>
```
Replace with:
```html
<script src="js/modules/register.js?v=17" defer></script>
```

### 2. `templates/pwa.html`

Same edit as `index.html` (the build step regenerates `index.html` from this template).

### 3. `c/index.html`

Find:
```html
<script src="../js/card.js?v=5" defer></script>
```
Replace with:
```html
<script src="../js/modules/card.js?v=6" defer></script>
```
Also update `templates/card-page.html` the same way.

### 4. `js/modules/register.js` (after the move)

Find the line that lazy-loads the QR scanner:
```js
const SCANNER_SRC = 'js/register-scanner.js';
```
Replace with:
```js
const SCANNER_SRC = 'js/modules/register-scanner.js';
```

### 5. `sw.js` PRECACHE list

Find:
```js
SCOPE + 'js/register.js',
SCOPE + 'js/register-scanner.js',
SCOPE + 'js/card.js',
```
Replace with:
```js
SCOPE + 'js/modules/register.js',
SCOPE + 'js/modules/register-scanner.js',
SCOPE + 'js/modules/card.js',
```

Bump `CACHE_VERSION` (e.g. `'dolphlink-v207'` → `'dolphlink-v208'`).

## Verify after the move

```bash
# All 25 modules under js/ should still parse:
for f in js/app.js js/engine/*.js js/icons/*.js js/render/*.js js/modules/*.js; do
  node --check "$f"
done

# Build still works:
python3 build/build.py

# js/ root only has app.js:
ls js/                    # should show: app.js  engine/  icons/  modules/  render/
```

## Why this matters

Per the project rule: **`js/` root only holds the entry point. Everything else
lives in a sub-folder so the engine boundary is obvious at a glance.** Today
register.js / card.js sit at root for historical reasons — they were classic
script tags before the modular refactor. Moving them aligns the file tree
with the architecture the rest of the engine already follows.
