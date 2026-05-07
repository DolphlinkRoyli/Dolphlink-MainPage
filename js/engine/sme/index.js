/**
 * SME page setup — runs when <html data-page="sme">.
 *
 * Scope: SME PAGE ONLY.
 *
 * The SME landing page is fully static SSR (build-time baking from
 * content/sme.json). The only runtime work is the i18n layer:
 *   - read the visitor's language pick (URL ?lang= → localStorage →
 *     navigator.language → 'en')
 *   - if not English, fetch content/i18n/<code>.json and swap every
 *     [data-i18n="key"] text content
 *   - inject a small language picker in the [data-lang-picker] slot
 *     so the visitor can switch interactively
 *
 * Future enhancements that should land here (not in a new file):
 *   - In-page anchor smooth-scroll (when nav links go to #pricing etc.)
 *   - Lark Connect button → real OAuth handoff
 *   - Live pricing calculator (slider → estimated SGD/month)
 *   - Currency switcher (SGD ↔ HKD ↔ VND ↔ THB ↔ IDR ↔ MYR ↔ PHP)
 *   - Anonymous usage analytics (only after explicit consent)
 */
import { setupI18n, attachLanguagePicker } from '../core/i18n.js';

export default async function setupSmePage() {
  /* Render the picker FIRST so it appears the instant JS runs — even
     if the i18n JSON fetch is slow (or blocked), the visitor can still
     interact with the dropdown. Both calls run synchronously enough
     that the brief English flash before translation lands is below
     perceptual threshold for most network conditions. */
  attachLanguagePicker(document.querySelector('[data-lang-picker]'));
  setupI18n().catch(err => console.warn('[sme] i18n setup failed:', err));
}
