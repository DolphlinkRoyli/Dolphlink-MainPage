/**
 * Google Drive URL helpers — convert a Drive share URL between its
 * display, embed, and download flavours.
 *
 * Scope: SHARED CORE. Imported by:
 *   - card/index.js          (for the public digital-card image)
 *   - home/register.js       (for the inline-card download flow)
 *
 * SECURITY: when the input URL doesn't match the Drive ID regex, the
 * fallback path returns the URL passed through `safeHttpUrl` — so a
 * poisoned cards.json carrying `cardImage: "javascript:alert(1)"`
 * resolves to '' (empty href) instead of an XSS-trigger href. Without
 * this guard, a click on the "view full-size card" link would execute
 * the malicious URL.
 */
import { safeHttpUrl } from './url.js';

/**
 * Extract the Drive file ID from any of:
 *   https://drive.google.com/file/d/<id>/view
 *   https://drive.google.com/file/d/<id>/edit?usp=sharing
 *   https://drive.google.com/uc?id=<id>&export=download
 *   https://drive.google.com/open?id=<id>
 * Returns '' when no ID is present.
 */
export function driveID(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&]+)/);
  return m ? m[1] : '';
}

/** Canonical "open in Drive" share URL — what to surface in vCard URL fields. */
export function driveViewURL(url) {
  const id = driveID(url);
  return id ? 'https://drive.google.com/file/d/' + id + '/view' : safeHttpUrl(url);
}

/**
 * Embed-friendly URL — lh3.googleusercontent.com bypasses Drive's
 * "open in app" interstitial and serves the raw image as <img src>.
 * Used for card-image previews on the public landing page.
 */
export function driveImgURL(url) {
  const id = driveID(url);
  return id
    ? 'https://lh3.googleusercontent.com/d/' + id + '=w1600'
    : safeHttpUrl(url);
}

/**
 * Direct download URL — triggers a file download instead of opening
 * the Drive viewer. Used by the inline name-card download flow.
 * Returns '' if the URL doesn't look like Drive AND isn't safe http(s).
 */
export function driveDownloadURL(url) {
  const id = driveID(url);
  return id
    ? 'https://drive.google.com/uc?export=download&id=' + id
    : safeHttpUrl(url);
}
