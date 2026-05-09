/**
 * Build wizard page setup — runs when <html data-page="build">.
 *
 * Scope: /sme/build/ ONLY.
 *
 * Owns three concerns:
 *   1. i18n — picker render + locale JSON fetch + data-i18n swap.
 *   2. AJAX form submit — sign the payload with HMAC-SHA256 against a
 *      shared secret + timestamp, POST it to the Cloudflare Worker
 *      `/contact` endpoint. Worker verifies the signature against any
 *      of its rotating keys (rejects bare curl + replay attempts).
 *   3. Dialog UX — open / close / Esc / backdrop-click; toggles the
 *      `.is-open` class for the CSS opacity fade and locks
 *      `<html>` overflow while the dialog is up.
 *
 * Threat model honesty: HMAC_KEY ships in this JS bundle, so anyone
 * who reads view-source can compute valid signatures. The HMAC layer
 * stops:
 *   - random scripts that curl the Worker URL (no sig → 401)
 *   - replay of captured requests (timestamp window → 401 stale)
 *   - bots that scrape HTML but never run JS
 * It does NOT stop a determined attacker who reads the JS. For that,
 * pair this with Cloudflare Turnstile (server-issued token) and the
 * Worker's CORS / origin / honeypot / per-IP rate-limit layers.
 */
import { setupI18n, attachLanguagePicker } from '../core/i18n.js';

/* ---------- API endpoint + HMAC ---------- */

const API_ENDPOINT = 'https://dolphlink-api.roygto2013.workers.dev/contact';

/* Active signing key — rotate by changing this hex string AND keeping
   the new key in the Worker's FORM_KEYS list while old in-flight
   submits drain. The Worker accepts any key in FORM_KEYS, so swap
   here, redeploy, then drop the deprecated key from FORM_KEYS later. */
const HMAC_KEY_HEX = '1622471fb4dac5f814c691fc92300656';

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return out;
}
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(keyHex, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', hexToBytes(keyHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return bufToHex(sig);
}

/* English fallbacks for the dialog copy. The data-i18n machinery
   normally swaps these out at page load via hidden <span data-i18n="…">
   slots in the HTML; these strings only render if the slot is missing
   or i18n hasn't run yet. Kept in code (not in JSON) on purpose — they
   are the safety net, not the source of truth. */
const FALLBACK = {
  errTitle: 'Something went wrong.',
  errText:  "We couldn't reach the inbox. Please try again, or email us at Salesmarketing@dolphlink.com.",
  sending:  'Sending…',
};

/* Wire the AJAX form. No-op if the form isn't on the page (e.g. if
   the build hero is removed in a future redesign). */
function wireForm() {
  const form    = document.getElementById('build-form');
  const dialog  = document.getElementById('build-dialog');
  const closeBtn = document.getElementById('build-dialog-close');
  if (!form || !dialog) return;

  const submitBtn = form.querySelector('.build-form-submit');
  const origLabel = submitBtn ? submitBtn.innerHTML : '';

  /* Snapshot of the localized success copy. Captured the first time
     openDialog() runs (after data-i18n has already swapped the strings
     into the dialog DOM), so subsequent error→success transitions
     restore the right language without re-fetching anything. */
  let successTitle = null;
  let successText  = null;

  function openDialog(success, customMessage) {
    const titleEl = document.getElementById('build-dialog-title');
    const textEl  = dialog.querySelector('.build-dialog-text');
    const iconEl  = dialog.querySelector('.build-dialog-icon');

    if (successTitle === null) successTitle = titleEl.textContent;
    if (successText  === null) successText  = textEl.textContent;

    if (success) {
      titleEl.textContent = successTitle;
      textEl.textContent  = customMessage || successText;
      iconEl.classList.remove('build-dialog-icon--err');
    } else {
      const errTitleSlot = document.getElementById('build-dialog-err-title');
      const errTextSlot  = document.getElementById('build-dialog-err-text');
      titleEl.textContent = (errTitleSlot && errTitleSlot.textContent.trim()) || FALLBACK.errTitle;
      textEl.textContent  = customMessage
        || ((errTextSlot && errTextSlot.textContent.trim()) || FALLBACK.errText);
      iconEl.classList.add('build-dialog-icon--err');
    }
    dialog.hidden = false;
    /* setTimeout(10ms) lets the browser paint the visible dialog state
       BEFORE adding `.is-open`, so the opacity transition runs from
       0 → 1 instead of jumping. */
    setTimeout(() => dialog.classList.add('is-open'), 10);
    document.documentElement.style.overflow = 'hidden';
  }

  function closeDialog() {
    dialog.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    /* Wait for the 0.25s opacity fade to finish before hiding so the
       dialog doesn't pop out instantly. */
    setTimeout(() => { dialog.hidden = true; }, 250);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* In-flight button state — show localized "Sending…" so non-English
       visitors don't see English mid-submit. */
    if (submitBtn) {
      submitBtn.disabled = true;
      const sendingSlot = document.getElementById('build-form-sending');
      const sendingText = (sendingSlot && sendingSlot.textContent.trim()) || FALLBACK.sending;
      submitBtn.innerHTML = '<span>' + sendingText.replace(/[<>&]/g, '') + '</span>';
    }

    try {
      /* Build the JSON payload by inspecting actual <input> types.
         Checkboxes that share a name (industry, need) ALWAYS produce
         arrays — even when only one box is ticked, even when none is.
         Radios collapse to a scalar. Text / email / textarea pass
         through as-is. Submit buttons are skipped. Honeypot is
         preserved verbatim (bots fill it; Worker drops). */
      const payload = {};
      const seenCheckbox = new Set();
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') continue;
        if (el.type === 'checkbox') {
          if (!seenCheckbox.has(el.name)) {
            payload[el.name] = [];
            seenCheckbox.add(el.name);
          }
          if (el.checked) payload[el.name].push(el.value);
        } else if (el.type === 'radio') {
          if (el.checked) payload[el.name] = el.value;
        } else {
          payload[el.name] = el.value;
        }
      }

      /* Sign: HMAC-SHA256 over `${timestamp}:${rawBody}`. The Worker
         reconstructs the same string and verifies. Timestamp is in
         milliseconds; Worker rejects anything outside ±5 minutes. */
      const timestamp = Date.now().toString();
      const rawBody = JSON.stringify(payload);
      const signature = await hmacHex(HMAC_KEY_HEX, `${timestamp}:${rawBody}`);

      const resp = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp':  timestamp,
          'X-Signature':  signature,
        },
        body: rawBody,
      });

      /* Worker always replies JSON. On non-OK status or `{ok:false}`,
         throw so the catch block opens the error dialog. The full
         response code reaches console for support diagnostics, but
         we don't dump arbitrary body content (might leak whatever the
         Worker accidentally echoed back). */
      if (!resp.ok) throw new Error('http_' + resp.status);
      const result = await resp.json().catch(() => ({}));
      if (!result.ok) throw new Error(result.error || 'unknown');

      openDialog(true);
      form.reset();
    } catch (err) {
      console.warn('[build-form] submit failed:', err);
      openDialog(false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origLabel;
      }
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  const backdrop = dialog.querySelector('.build-dialog-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeDialog);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialog.hidden) closeDialog();
  });
}

export default async function setupBuildPage() {
  /* i18n FIRST — render the picker straight away so the language
     dropdown is interactive before the JSON fetch returns. */
  attachLanguagePicker(document.querySelector('[data-lang-picker]'));
  setupI18n().catch(err => console.warn('[build] i18n setup failed:', err));

  wireForm();
}
