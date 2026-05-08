# Lighthouse PWA Audit Checklist

How to verify the DOLPHLINK PWA installs correctly and what to fix if any
checks fail.

## Run the audit

1. Open Chrome → https://dolphlinkroyli.github.io/Dolphlink-MainPage/
2. F12 → **Lighthouse** tab
3. Mode: **Navigation**
4. Categories: tick **Progressive Web App** + **Performance** + **SEO**
5. Device: **Mobile**
6. Click **Analyze page load**

Wait ~30 seconds. Should see installable badge ✓ and ~95/100 PWA score.

## Expected pass criteria

| Check                                  | Why it should pass                                      |
|----------------------------------------|---------------------------------------------------------|
| Installable                            | manifest + service worker + HTTPS all present           |
| Web app manifest meets requirements    | `name` / `short_name` / `start_url` / `icons` / display |
| Has a `<meta name="viewport">` tag     | Already in index.html                                   |
| Manifest has `maskable` icon           | `icon-maskable-512.png` is in manifest                  |
| Provides a valid `apple-touch-icon`    | `apple-touch-icon.png` 180×180 with brand bg            |
| Sets a theme color for the address bar | `#0059B3` in manifest + `<meta name="theme-color">`     |
| Page is responsive                     | Existing responsive CSS handles 320px+                  |
| Service worker registers               | `<script>navigator.serviceWorker.register('sw.js')</script>` |

## Common failures + fixes

### "Service worker does not control page"

The service worker is registered but hasn't taken control yet (first visit).

**Fix**: Reload the page once. Service worker uses `skipWaiting()` and
`clients.claim()` so it should control on the second load.

### "Manifest doesn't have a maskable icon"

Maskable icon missing or wrong purpose.

**Fix**: Verify `seo/site.webmanifest` has:
```json
{
  "src": "../media/icon/pwa/icon-maskable-512.png",
  "purpose": "maskable"
}
```

### "start_url responds with HTTP 404 when offline"

Service worker isn't pre-caching the start URL.

**Fix**: In `sw.js`, ensure `PRECACHE` array includes the `SCOPE` (root path).

### "Does not provide a valid `apple-touch-icon`"

iOS requires apple-touch-icon at 180×180.

**Fix**: Verify `<link rel="apple-touch-icon" sizes="180x180" href="media/icon/pwa/apple-touch-icon.png">` is in `index.html`.

### "Page does not work offline"

Service worker not caching, or fetched via different URL than cached.

**Fix**:
1. Clear site data (DevTools → Application → Storage → Clear site data)
2. Reload page (registers fresh SW)
3. Check Application → Service Workers → "Active and running"
4. Check Application → Cache Storage → see `dolphlink-v1` cache populated
5. Toggle DevTools → Network → **Offline** → reload — page should still load

### Lighthouse score drops on first run, jumps on second

This is normal — service workers only kick in after first install. **Run
Lighthouse twice** for accurate score.

## Manual install test on mobile

Beyond Lighthouse, manually test on real devices:

### Android Chrome

1. Open the URL
2. Wait 30 seconds (Chrome's heuristic for "engaged")
3. Should see "Install DOLPHLINK?" mini-info bar OR ⋮ → Install app
4. Install → check home screen for blue D icon
5. Open from home screen → no browser address bar visible

### iPhone Safari

1. Open the URL in Safari (NOT Chrome — iOS Chrome can't install PWA)
2. Tap Share → Add to Home Screen
3. Tap Add
4. Tap home screen icon → opens full-screen
5. Status bar style should be black-translucent

If anything's broken on real devices, capture the issue and update this doc.
