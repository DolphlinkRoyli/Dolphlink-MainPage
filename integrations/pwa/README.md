# DOLPHLINK PWA — Add-to-Home-Screen App

The main site (https://dolphlinkroyli.github.io/Dolphlink-MainPage/) is now a
**Progressive Web App**. Visitors can install it to their phone home screen,
and it runs full-screen like a native app — no app store, no review, no fees.

## What's deployed

| File                                       | Purpose                                                |
|--------------------------------------------|--------------------------------------------------------|
| `seo/site.webmanifest`                     | PWA manifest (name / icons / theme / shortcuts)        |
| `sw.js` (root)                             | Service worker — pre-caches shell, offline fallback    |
| `media/icon/pwa/icon-192.png`              | 192×192 launcher icon                                  |
| `media/icon/pwa/icon-512.png`              | 512×512 launcher icon                                  |
| `media/icon/pwa/icon-maskable-512.png`     | Maskable icon (Android adaptive shape)                 |
| `media/icon/pwa/apple-touch-icon.png`      | 180×180 iOS home screen icon (brand-blue background)   |
| `index.html` `<head>`                      | Manifest link + icon links + service-worker register   |

## How users install (give this to clients / sales / Joyce)

### Android — Chrome / Edge / Samsung Internet

1. Open https://dolphlinkroyli.github.io/Dolphlink-MainPage/
2. After ~30 seconds, browser shows banner **"Add DOLPHLINK to Home screen"**
   (or open the ⋮ menu → **Install app**)
3. Tap **Install** — app appears on home screen with the DOLPHLINK D icon
4. Tap the icon → site opens full-screen with no browser chrome

### iPhone / iPad — Safari (must be Safari, iOS limitation)

1. Open the URL in **Safari**
2. Tap the **share button ⤴️** at the bottom
3. Scroll the share sheet → **Add to Home Screen**
4. Confirm the name (DOLPHLINK) → **Add**
5. Tap the home-screen icon → site opens in standalone mode

### Desktop (Chrome / Edge)

1. Open the URL
2. Address bar shows a small **install icon** (⊕ or computer-with-arrow)
3. Click → confirm → DOLPHLINK gets a desktop app entry

## What works offline

Once installed, the **app shell** (HTML, CSS, JS, hero image, icons, fonts)
is cached locally. If the user is offline:

- ✅ Opening the app shows the homepage with last-cached content
- ✅ Navigation within the page works (scrolling, clicking sections)
- ⚠️ `content.json` is network-first — if offline, it falls back to the last
  cached version (so users see slightly stale text but still see content)
- ⚠️ Hero video and ECharts world map need network (skipped offline)

## Cache invalidation

When you `git push` major changes, bump `CACHE_VERSION` in `sw.js`:

```js
const CACHE_VERSION = 'dolphlink-v2';   // was v1
```

Next time a user opens the app:
1. New service worker installs in background
2. On next reload, old cache is cleared, new shell pre-cached
3. User sees the latest version

For minor edits (Google Form changes to copy), no SW bump needed —
content.json is always fetched network-first.

## Files in this folder

| File                  | Purpose                                                       |
|-----------------------|---------------------------------------------------------------|
| `README.md`           | This file                                                     |
| `generate-icons.py`   | Re-generate PNG icons from `media/icon/3D/logo.webp`          |
| `lighthouse-audit.md` | How to verify PWA passes Lighthouse audit                     |

## Lighthouse PWA score

Open Chrome DevTools → **Lighthouse** tab → check **Progressive Web App** →
**Analyze page load**. Should pass:

- ✅ Installable (manifest + service worker + HTTPS)
- ✅ PWA optimized (theme color, viewport, content-typed responses)
- ✅ Maskable icon

If anything fails, see `lighthouse-audit.md` for troubleshooting.

## Re-generating icons

If you change the master logo (`media/icon/3D/logo.webp`), run:

```bash
python3 integrations/pwa/generate-icons.py
```

This regenerates all 4 PNG variants in `media/icon/pwa/` from the WebP source.

## Removing the PWA

If you ever want to undo this:

1. Delete `sw.js` and the service-worker registration in `index.html`
2. Delete `media/icon/pwa/` folder
3. Revert `seo/site.webmanifest` to a minimal version
4. Bump `CACHE_VERSION` once before removing (so old caches invalidate first)

Or browser users can manually remove the installed app via:
- Android: long-press icon → Uninstall
- iOS: long-press icon → Remove App
