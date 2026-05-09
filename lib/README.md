# `lib/` — Local copies of external libraries

This folder holds local copies of the third-party libs the site uses. Loading
them locally gives us:

- **Privacy** — no third-party CDN sees the user's IP
- **Offline** — service worker can cache them on install
- **Speed** — one less DNS + TLS handshake on first paint
- **Resilience** — site still works if jsdelivr is blocked or down

## Files (you populate them with `download.ps1`)

| File                 | Source                                                                    | Size    |
|----------------------|---------------------------------------------------------------------------|---------|
| `echarts.min.js`     | <https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js>          | ~1.0 MB |
| `world.json`         | <https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json>          | ~250 KB |
| `qrcode.min.js`      | <https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js>       | ~10 KB  |
| `jsQR.js`            | <https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js>                    | ~50 KB  |

## How to download

From this folder, run in PowerShell:

```powershell
.\download.ps1
```

Or in any shell with `curl`:

```bash
bash download.sh
```

After running, the JS automatically prefers these local copies and falls
back to the CDN if they're missing.

## Updating versions

Bump the URLs in `download.ps1` / `download.sh`, re-run, and bump
`CACHE_VERSION` in `../sw.js` so the service worker refreshes them.
