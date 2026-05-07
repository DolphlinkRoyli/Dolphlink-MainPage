/**
 * Clipboard + Web Share helpers — handle the Clipboard API with a
 * textarea + execCommand fallback for older browsers / non-secure
 * contexts (file://, http://).
 *
 * Scope: SHARED CORE. Imported by:
 *   - card/index.js     (act-copy / act-share buttons)
 *   - home/register.js  (Copy Link / Share buttons in the inline card)
 */

/**
 * Copy text to the clipboard. Returns true on success, false otherwise.
 * Caller handles the success/failure UX (toast vs button-text swap, etc.)
 * so this stays a pure side-effect helper.
 */
export async function copyToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) { /* fall through to textarea fallback */ }

  /* Older browsers / non-secure contexts: synthesise a hidden textarea,
     select its contents, and let document.execCommand('copy') do the work. */
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  return ok;
}

/**
 * Share via the Web Share API, falling back to clipboard copy when the
 * platform doesn't support it (desktop browsers without `navigator.share`)
 * or when the user dismisses the native sheet without sharing.
 *
 * Returns one of:
 *   'shared'  — native share completed
 *   'copied'  — fell back to clipboard, copy succeeded
 *   'failed'  — both paths failed (very rare)
 *
 * The `data` argument matches navigator.share's ShareData shape:
 *   { title?: string, text?: string, url?: string }
 */
export async function shareOrCopy(data) {
  const payload = data || {};
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (e) {
      /* User-cancellation comes back as AbortError — also not an error */
      if (e && e.name === 'AbortError') return 'shared';
      /* Real failure → fall through to clipboard */
    }
  }
  const ok = await copyToClipboard(payload.url || payload.text || '');
  return ok ? 'copied' : 'failed';
}
