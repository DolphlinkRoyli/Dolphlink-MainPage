/* ============================================================================
 * DOLPHLINK Register — main-site integration
 *
 * Loaded via the existing line in index.html:
 *   <script src="register/inject.js?v=3" defer></script>
 *
 * Behavior (desktop + mobile, identical):
 *   - Hooks every .nav-cta on the page (the "Request Briefing" button — label
 *     comes from content.json which we deliberately do NOT touch)
 *   - Click → modal opens with up to FOUR options:
 *       1. Continue with Google     (team auto-detect → inline card / customer → form)
 *       2. Scan a QR code           (lazy-loads register/scanner.js)
 *       3. Email us directly        (mailto fallback)
 *       4. View my digital card     (only visible to @dolphlink.com cached
 *                                    sessions; opens the card in an iframe,
 *                                    no page navigation)
 *   - Team-member detection short-circuits the form: @dolphlink.com OR an
 *     active entry in cards.json gets the inline card view directly.
 *   - The original mailto href on .nav-cta stays in place as a graceful
 *     fallback for the JS-disabled / pre-load case.
 *
 * Design constraints (per Roy):
 *   - Hues: #0059B3 brand blue + grays / near-black only
 *   - NO #002D5C, NO success-green, NO error-red
 *
 * Setup:
 *   1. Replace GOOGLE_CLIENT_ID with your OAuth Client ID
 *   2. Replace REGISTER_API with your Apps Script Web App URL
 *   3. See integrations/register/setup.md for backend setup
 * ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config — these three values are the only things to update at deploy time
  // ---------------------------------------------------------------------------
  const TEAM_DOMAIN       = 'dolphlink.com';
  const GOOGLE_CLIENT_ID  = '953883058126-8ebc9qlkb982mbh06roprvrl7ee9bqha.apps.googleusercontent.com';
  const REGISTER_API      = 'https://script.google.com/macros/s/REPLACE_WITH_REGISTER_DEPLOYMENT_ID/exec';
  // Same Apps Script Web App as cards/app.js → PHOTO_API. Returns the
  // pre-designed name-card image (filename: <localpart>-namecard.{jpg|png|webp})
  // from the team-photos Drive folder, base64-encoded.
  const PHOTO_API         = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec';
  const SUPPORT_EMAIL     = 'Sales@dolphlink.com';
  const SUPPORT_EMAIL_CC  = 'Joycetsam@dolphlink.com';
  const ROOT_ID           = 'dlpk-reg-root';

  // Test-mode emails: even if these match a roster entry, the modal still
  // shows the customer form first, then routes to the card after submit.
  // Lets the admin (Roy) walk through both halves of the system end-to-end
  // without bypassing the form path. Other team members go straight to card.
  const TEST_USER_EMAILS = ['roygto2013@gmail.com'];

  // Stop double-init if script runs twice
  if (document.getElementById(ROOT_ID)) return;

  // ---------------------------------------------------------------------------
  // 1. Inject scoped styles
  // ---------------------------------------------------------------------------
  const css = `
#${ROOT_ID} {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  color: #0F172A;
}
#${ROOT_ID} *, #${ROOT_ID} *::before, #${ROOT_ID} *::after { box-sizing: border-box; }
#${ROOT_ID} [hidden] { display: none !important; }

/* ===== Modal ===== */
#${ROOT_ID} .modal {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0;
}
#${ROOT_ID} .modal[hidden] { display: none; }
#${ROOT_ID} .backdrop {
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: dlpk-fade 0.25s ease-out;
}
@keyframes dlpk-fade { from { opacity: 0; } to { opacity: 1; } }
#${ROOT_ID} .sheet {
  position: relative;
  width: 100%; max-width: 440px;
  background: #FFFFFF;
  border-radius: 20px 20px 0 0;
  padding: 24px 22px max(28px, env(safe-area-inset-bottom));
  box-shadow: 0 -16px 48px rgba(15, 23, 42, 0.22);
  animation: dlpk-slide 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 92vh;
  overflow-y: auto;
}
@media (min-width: 480px) {
  #${ROOT_ID} .modal { align-items: center; padding: 16px; }
  #${ROOT_ID} .sheet { border-radius: 18px; max-width: 480px; padding: 32px 28px 28px; }
}
@media (min-width: 768px) {
  #${ROOT_ID} .sheet { max-width: 540px; padding: 44px 40px 36px; }
  #${ROOT_ID} .step h2 { font-size: 26px; }
  #${ROOT_ID} .step .lead { font-size: 15px; }
  #${ROOT_ID} .opt { padding: 18px 20px; }
  #${ROOT_ID} .opt-icon { width: 44px; height: 44px; }
  #${ROOT_ID} .opt-text strong { font-size: 15px; }
  #${ROOT_ID} .opt-text small { font-size: 13px; }
}
@keyframes dlpk-slide {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
#${ROOT_ID} .sheet-handle {
  width: 40px; height: 4px;
  background: #E2E8F0;
  border-radius: 2px;
  margin: 0 auto 16px;
}
@media (min-width: 480px) { #${ROOT_ID} .sheet-handle { display: none; } }

#${ROOT_ID} .close {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px;
  border: none;
  border-radius: 50%;
  background: #F1F5F9;
  color: #0F172A;
  font-size: 22px; line-height: 1;
  cursor: pointer;
  display: grid; place-items: center;
}
#${ROOT_ID} .close:hover { background: #E2E8F0; }

/* Steps */
#${ROOT_ID} .step { text-align: center; }
#${ROOT_ID} .step h2 {
  font-size: 22px; font-weight: 900;
  color: #0F172A;
  letter-spacing: -0.4px;
  margin: 0 0 8px;
}
#${ROOT_ID} .step h3 { font-size: 18px; font-weight: 900; color: #0F172A; margin: 0 0 8px; }
#${ROOT_ID} .step .lead {
  font-size: 14px; color: #64748B;
  margin: 0 0 22px;
  line-height: 1.55;
}
#${ROOT_ID} .step .fine {
  font-size: 12px; color: #94A3B8;
  margin: 18px 0 0;
}
#${ROOT_ID} .eyebrow {
  display: inline-block;
  font-size: 11px; font-weight: 800;
  letter-spacing: 2.4px;
  text-transform: uppercase;
  color: #0059B3;
  margin: 0 0 8px;
}

/* Option cards (the new 3-button menu) */
#${ROOT_ID} .options {
  display: flex; flex-direction: column; gap: 10px;
  margin: 16px 0 4px;
  text-align: left;
}
#${ROOT_ID} .opt {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  background: #FFFFFF;
  color: #0F172A;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.1s ease;
  text-decoration: none;
}
#${ROOT_ID} .opt:hover { border-color: #0059B3; background: rgba(0, 89, 179, 0.04); }
#${ROOT_ID} .opt:active { transform: scale(0.99); }
#${ROOT_ID} .opt-primary {
  background: #0059B3;
  color: #FFFFFF;
  border-color: #0059B3;
  box-shadow: 0 4px 14px rgba(0, 89, 179, 0.32);
}
#${ROOT_ID} .opt-primary:hover { filter: brightness(0.94); background: #0059B3; border-color: #0059B3; }
#${ROOT_ID} .opt-icon {
  flex-shrink: 0;
  width: 40px; height: 40px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: rgba(0, 89, 179, 0.10);
  color: #0059B3;
}
#${ROOT_ID} .opt-primary .opt-icon { background: rgba(255, 255, 255, 0.18); color: #FFFFFF; }
#${ROOT_ID} .opt-icon svg { width: 20px; height: 20px; }
#${ROOT_ID} .opt-text { flex: 1; min-width: 0; }
#${ROOT_ID} .opt-text strong { display: block; font-size: 14px; font-weight: 800; letter-spacing: 0.2px; }
#${ROOT_ID} .opt-text small { display: block; font-size: 12px; color: #64748B; margin-top: 2px; font-weight: 500; }
#${ROOT_ID} .opt-primary .opt-text strong { color: #FFFFFF; }
#${ROOT_ID} .opt-primary .opt-text small { color: rgba(255, 255, 255, 0.85); }
#${ROOT_ID} .opt-arrow { flex-shrink: 0; color: #94A3B8; }
#${ROOT_ID} .opt-primary .opt-arrow { color: rgba(255, 255, 255, 0.85); }
#${ROOT_ID} .opt:hover .opt-arrow { color: #0059B3; }

/* Step navigation back link */
#${ROOT_ID} .back-link {
  background: none; border: none;
  color: #64748B;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  margin: 0 0 8px -8px;
  display: inline-flex; align-items: center; gap: 4px;
}
#${ROOT_ID} .back-link:hover { color: #0059B3; }

/* Google sign-in container */
#${ROOT_ID} .gbtn-wrap { margin: 12px 0 4px; min-height: 44px; }
#${ROOT_ID} .g_id_signin { display: inline-block; }

/* Form */
#${ROOT_ID} .form { display: flex; flex-direction: column; gap: 14px; text-align: left; }
#${ROOT_ID} .field { display: flex; flex-direction: column; gap: 6px; }
#${ROOT_ID} .field label {
  font-size: 11px; font-weight: 800;
  color: #0F172A;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
#${ROOT_ID} .field label .req { color: #0059B3; margin-left: 2px; }
#${ROOT_ID} .field label small {
  font-size: 10px; color: #94A3B8; font-weight: 600;
  letter-spacing: 0.4px; text-transform: none; margin-left: 4px;
}
#${ROOT_ID} .field input {
  height: 44px;
  padding: 0 14px;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  background: #FFFFFF;
  font: inherit; font-size: 15px;
  color: #0F172A;
  -webkit-appearance: none; appearance: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
#${ROOT_ID} .field input::placeholder { color: #94A3B8; }
#${ROOT_ID} .field input:focus {
  outline: none;
  border-color: #0059B3;
  box-shadow: 0 0 0 3px rgba(0, 89, 179, 0.16);
}
#${ROOT_ID} .field input[readonly] { background: #F1F5F9; color: #64748B; cursor: not-allowed; }

/* Honeypot — hidden from humans, visible to bots */
#${ROOT_ID} .honey {
  position: absolute !important; left: -9999px !important; top: auto !important;
  width: 1px !important; height: 1px !important;
  opacity: 0 !important; pointer-events: none !important;
}

/* Greeting strip on form step */
#${ROOT_ID} .greeting {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  margin-bottom: 18px;
  text-align: left;
}
#${ROOT_ID} .greeting img {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 2px solid #0059B3;
  object-fit: cover;
  flex-shrink: 0;
}
#${ROOT_ID} .greeting-text { min-width: 0; }
#${ROOT_ID} .greeting-text strong { display: block; font-size: 14px; font-weight: 800; color: #0F172A; }
#${ROOT_ID} .greeting-text span { font-size: 12px; color: #64748B; }

/* Submit button */
#${ROOT_ID} .submit {
  margin-top: 6px;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: #0059B3;
  color: #FFFFFF;
  font: inherit; font-size: 15px; font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter 0.18s ease, transform 0.1s ease;
  box-shadow: 0 4px 14px rgba(0, 89, 179, 0.32);
}
#${ROOT_ID} .submit:hover { filter: brightness(0.94); }
#${ROOT_ID} .submit:active { transform: scale(0.98); }
#${ROOT_ID} .submit:disabled { filter: grayscale(0.6) brightness(0.92); cursor: wait; box-shadow: none; }

#${ROOT_ID} .err-msg {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #E2E8F0;
  border-left: 3px solid #0059B3;
  background: #F1F5F9;
  border-radius: 8px;
  font-size: 13px;
  color: #0F172A;
  text-align: left;
}

/* Step icons (success/error) */
#${ROOT_ID} .step-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  display: grid; place-items: center;
  margin: 4px auto 16px;
  background: rgba(0, 89, 179, 0.10);
  color: #0059B3;
}
#${ROOT_ID} .step-icon svg { width: 32px; height: 32px; }

#${ROOT_ID} .link-back-cta {
  display: inline-block;
  margin-top: 14px;
  color: #0059B3;
  font-size: 13px; font-weight: 700;
  text-decoration: none;
  letter-spacing: 0.4px;
}
#${ROOT_ID} .link-back-cta:hover { text-decoration: underline; }

/* Inline digital-card view — full DOM, no iframe */
#${ROOT_ID} .step-card { text-align: left; }
#${ROOT_ID} .dlpk-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 28px 22px 22px;
  position: relative;
  overflow: hidden;
}
#${ROOT_ID} .dlpk-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #003D80, #0059B3, #38BDF8);
}
#${ROOT_ID} .dlpk-card-photo-wrap {
  display: flex; justify-content: center;
  margin-bottom: 16px;
}
#${ROOT_ID} .dlpk-card-photo-wrap img {
  width: 110px; height: 110px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #0059B3;
  box-shadow: 0 6px 20px rgba(0, 89, 179, 0.20);
}
#${ROOT_ID} .dlpk-card-initials {
  width: 110px; height: 110px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0059B3, #003D80);
  color: #FFFFFF;
  display: grid; place-items: center;
  font-size: 38px; font-weight: 900;
  letter-spacing: -1px;
  box-shadow: 0 6px 20px rgba(0, 89, 179, 0.25);
}
#${ROOT_ID} .dlpk-card-identity { text-align: center; margin-bottom: 18px; }
#${ROOT_ID} .dlpk-card-identity h2 {
  font-size: 22px; font-weight: 900;
  color: #0F172A;
  letter-spacing: -0.4px;
  margin: 0 0 4px;
}
#${ROOT_ID} .dlpk-card-role {
  color: #0059B3;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin: 0 0 4px;
}
#${ROOT_ID} .dlpk-card-dept {
  color: #64748B;
  font-size: 13px; font-weight: 500;
  margin: 0;
}
#${ROOT_ID} .dlpk-card-divider {
  height: 1px; background: #E2E8F0;
  margin: 0 -22px 18px;
}
#${ROOT_ID} .dlpk-card-contact {
  list-style: none; padding: 0; margin: 0 0 18px;
  display: flex; flex-direction: column; gap: 12px;
}
#${ROOT_ID} .dlpk-card-row {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; color: #0F172A;
}
#${ROOT_ID} .dlpk-card-row svg {
  flex-shrink: 0; width: 18px; height: 18px;
  color: #0059B3;
}
#${ROOT_ID} .dlpk-card-row a {
  color: #0F172A; text-decoration: none;
  font-weight: 500; word-break: break-word;
}
#${ROOT_ID} .dlpk-card-row a:hover { color: #0059B3; }
#${ROOT_ID} .dlpk-card-bio {
  font-size: 13px; line-height: 1.6;
  color: #475569;
  background: rgba(0, 89, 179, 0.04);
  border-left: 3px solid #0059B3;
  padding: 12px 14px;
  border-radius: 0 6px 6px 0;
  margin: 0 0 18px;
}
#${ROOT_ID} .dlpk-card-products {
  margin-bottom: 18px;
  padding: 14px 16px;
  background: rgba(0, 89, 179, 0.04);
  border-radius: 8px;
}
#${ROOT_ID} .dlpk-card-products h3 {
  font-size: 11px; font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #0059B3;
  margin: 0 0 10px;
}
#${ROOT_ID} .dlpk-card-product-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 8px;
}
#${ROOT_ID} .dlpk-card-product-list li {
  display: flex; flex-direction: column; gap: 2px;
  font-size: 13px;
}
#${ROOT_ID} .dlpk-card-product-list .p-label {
  font-weight: 700; color: #0F172A;
  letter-spacing: 0.2px;
}
#${ROOT_ID} .dlpk-card-product-list .p-tag {
  font-size: 11px; color: #64748B;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-weight: 600;
}
#${ROOT_ID} .dlpk-card-share {
  border-top: 1px solid #E2E8F0;
  padding-top: 18px;
}
#${ROOT_ID} .dlpk-card-qr-wrap {
  display: flex; flex-direction: column; align-items: center;
  margin-bottom: 16px;
}
#${ROOT_ID} #dlpk-card-qr {
  display: inline-block;
  padding: 10px;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}
#${ROOT_ID} #dlpk-card-qr img,
#${ROOT_ID} #dlpk-card-qr canvas { display: block; }
#${ROOT_ID} .dlpk-card-qr-hint {
  font-size: 12px; color: #64748B;
  margin: 8px 0 0;
  letter-spacing: 0.4px;
}
#${ROOT_ID} .dlpk-card-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
#${ROOT_ID} .dlpk-card-actions .submit {
  margin-top: 0;
  width: 100%;
}
#${ROOT_ID} .submit-outline {
  background: #FFFFFF;
  color: #0059B3;
  border: 1.5px solid #E2E8F0;
  box-shadow: none;
}
#${ROOT_ID} .submit-outline:hover {
  border-color: #0059B3;
  background: rgba(0, 89, 179, 0.06);
  filter: none;
}

/* Lock body scroll while modal open */
.dlpk-no-scroll { overflow: hidden !important; }
`;

  // ---------------------------------------------------------------------------
  // 2. Inject DOM (modal only — no FAB)
  // ---------------------------------------------------------------------------
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="modal" id="dlpk-modal" hidden role="dialog" aria-labelledby="dlpk-title" aria-modal="true">
      <!-- Backdrop is dim but NOT click-to-close. User must use X button or
           submit / next-step button to dismiss the modal. -->
      <div class="backdrop"></div>
      <div class="sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button type="button" class="close" data-close aria-label="Close">&times;</button>

        <!-- Step 0: Three options menu -->
        <section class="step" id="dlpk-step-options">
          <span class="eyebrow">DOLPHLINK</span>
          <h2 id="dlpk-title">Request a Briefing</h2>
          <p class="lead">Choose how you would like to connect &mdash; we will respond within 24 hours.</p>

          <div class="options">
            <button type="button" class="opt opt-primary" id="dlpk-opt-google">
              <span class="opt-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.35 11.1h-9.17v2.78h5.27c-.23 1.43-1.66 4.2-5.27 4.2-3.17 0-5.76-2.62-5.76-5.84s2.59-5.84 5.76-5.84c1.81 0 3.02.77 3.71 1.43l2.53-2.43C16.86 3.92 14.74 3 12.18 3 6.99 3 3 6.99 3 12s3.99 9 9.18 9c5.31 0 8.82-3.74 8.82-8.99 0-.6-.06-1.06-.15-1.91z"/></svg>
              </span>
              <span class="opt-text">
                <strong>Continue with Google</strong>
                <small>Fast-track &mdash; name and email auto-filled</small>
              </span>
              <svg class="opt-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button type="button" class="opt" id="dlpk-opt-scan">
              <span class="opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect x="7" y="7" width="10" height="10" rx="1"/>
                </svg>
              </span>
              <span class="opt-text">
                <strong>Scan a QR code</strong>
                <small>Save a card or open a link with the camera</small>
              </span>
              <svg class="opt-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <a class="opt" id="dlpk-opt-email" href="#">
              <span class="opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-10 5L2 7"/>
                </svg>
              </span>
              <span class="opt-text">
                <strong>Email us directly</strong>
                <small>${SUPPORT_EMAIL}</small>
              </span>
              <svg class="opt-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>

            <button type="button" class="opt" id="dlpk-opt-mycard" hidden>
              <span class="opt-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2"/>
                  <circle cx="9" cy="10" r="2"/>
                  <line x1="14" y1="9" x2="18" y2="9"/>
                  <line x1="14" y1="13" x2="18" y2="13"/>
                  <path d="M7 16h10"/>
                </svg>
              </span>
              <span class="opt-text">
                <strong>View my digital card</strong>
                <small>Team members &mdash; sign in with your DOLPHLINK email</small>
              </span>
              <svg class="opt-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </section>

        <!-- Step 1: Google sign-in -->
        <section class="step" id="dlpk-step-signin" hidden>
          <button type="button" class="back-link" data-back-to="options">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <span class="eyebrow">Sign in</span>
          <h2>Continue with Google</h2>
          <p class="lead">We use Google only to verify your email &mdash; nothing posted, nothing stored beyond your contact details.</p>
          <div class="gbtn-wrap">
            <div id="g_id_onload"
                 data-client_id="${GOOGLE_CLIENT_ID}"
                 data-callback="onDLPKRegisterSignIn"
                 data-auto_prompt="false"
                 data-itp_support="true"></div>
            <div class="g_id_signin"
                 data-type="standard"
                 data-theme="filled_blue"
                 data-size="large"
                 data-text="continue_with"
                 data-shape="rectangular"
                 data-logo_alignment="left"
                 data-width="280"></div>
          </div>
          <p class="fine">By continuing, you agree to receive a follow-up from our team.</p>
        </section>

        <!-- Step 2: Form -->
        <section class="step" id="dlpk-step-form" hidden>
          <span class="eyebrow">Almost there</span>
          <h2>Just two more details</h2>
          <p class="lead">We will use these to route your request to the right person.</p>

          <div class="greeting">
            <img id="dlpk-avatar" alt="" hidden>
            <div class="greeting-text">
              <strong id="dlpk-greet-name">there</strong>
              <span id="dlpk-greet-email"></span>
            </div>
          </div>

          <form class="form" id="dlpk-form" novalidate>
            <input class="honey" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="field">
              <label for="dlpk-field-name">Name<span class="req">*</span></label>
              <input id="dlpk-field-name" name="name" type="text" required autocomplete="name">
            </div>
            <div class="field">
              <label for="dlpk-field-company">Company<span class="req">*</span></label>
              <input id="dlpk-field-company" name="company" type="text" required autocomplete="organization" placeholder="Your company name">
            </div>
            <div class="field">
              <label for="dlpk-field-email">Email <small>(verified by Google)</small></label>
              <input id="dlpk-field-email" name="email" type="email" readonly>
            </div>
            <div class="field">
              <label for="dlpk-field-phone">Phone<span class="req">*</span></label>
              <input id="dlpk-field-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+65 9123 4567">
            </div>
            <p class="err-msg" id="dlpk-err" hidden></p>
            <button type="submit" class="submit" id="dlpk-submit">Submit</button>
          </form>
        </section>

        <!-- Step 3: Success -->
        <section class="step" id="dlpk-step-success" hidden>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span class="eyebrow">Received</span>
          <h2>Thank you, <span id="dlpk-success-name">there</span>.</h2>
          <p class="lead">Our team will reach out within 24 hours.</p>
          <a class="link-back-cta" href="#" data-close>Back to site &rarr;</a>
        </section>

        <!-- Step: Inline digital card — fully integrated DOM, no iframe -->
        <section class="step step-card" id="dlpk-step-card" hidden>
          <article class="dlpk-card">
            <div class="dlpk-card-photo-wrap">
              <img id="dlpk-card-photo" alt="" hidden>
              <div id="dlpk-card-initials" class="dlpk-card-initials"></div>
            </div>
            <div class="dlpk-card-identity">
              <h2 id="dlpk-card-name">&mdash;</h2>
              <p id="dlpk-card-title" class="dlpk-card-role">&mdash;</p>
              <p id="dlpk-card-dept" class="dlpk-card-dept"></p>
            </div>
            <div class="dlpk-card-divider"></div>
            <ul class="dlpk-card-contact">
              <li class="dlpk-card-row" id="dlpk-card-row-email" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
                <a id="dlpk-card-email" href="">&mdash;</a>
              </li>
              <li class="dlpk-card-row" id="dlpk-card-row-phone" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <a id="dlpk-card-phone" href="">&mdash;</a>
              </li>
              <li class="dlpk-card-row" id="dlpk-card-row-linkedin" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                <a id="dlpk-card-linkedin" href="" target="_blank" rel="noopener">LinkedIn Profile</a>
              </li>
              <li class="dlpk-card-row" id="dlpk-card-row-languages" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span id="dlpk-card-languages">&mdash;</span>
              </li>
            </ul>
            <p id="dlpk-card-bio" class="dlpk-card-bio" hidden></p>
            <section class="dlpk-card-products" id="dlpk-card-products" hidden>
              <h3>Specialty Products</h3>
              <ul class="dlpk-card-product-list" id="dlpk-card-product-list"></ul>
            </section>
            <section class="dlpk-card-share">
              <div class="dlpk-card-qr-wrap">
                <div id="dlpk-card-qr"></div>
                <p class="dlpk-card-qr-hint">Scan to save contact</p>
              </div>
              <div class="dlpk-card-actions">
                <button type="button" class="submit" id="dlpk-card-namecard">View My Digital Name Card</button>
                <button type="button" class="submit submit-outline" id="dlpk-card-copy">Copy Link</button>
                <button type="button" class="submit submit-outline" id="dlpk-card-share">Share</button>
              </div>
            </section>
          </article>
        </section>

                <!-- Step 4: Error -->
        <section class="step" id="dlpk-step-error" hidden>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="8" x2="12" y2="13"/>
              <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
              <circle cx="12" cy="12" r="9.5"/>
            </svg>
          </div>
          <span class="eyebrow">Something is off</span>
          <h2>Please try again</h2>
          <p class="lead" id="dlpk-error-msg">Or email <a style="color:#0059B3;font-weight:700;text-decoration:underline" href="mailto:${SUPPORT_EMAIL}?cc=${SUPPORT_EMAIL_CC}">${SUPPORT_EMAIL}</a> directly.</p>
          <button type="button" class="submit" data-back-to="options">Back to options</button>
        </section>
      </div>
    </div>
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'dlpk-reg-styles';
  styleEl.textContent = css;

  function attach() {
    document.head.appendChild(styleEl);
    document.body.appendChild(root);
    wire();
  }
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach);

  // ---------------------------------------------------------------------------
  // 3. Wire up
  // ---------------------------------------------------------------------------
  let gisLoaded = false;
  let signedIn = null;
  let scannerLoading = false;
  let viewCardMode = false;  // when true, sign-in callback skips form and jumps straight to /cards/

  function $(id) { return document.getElementById(id); }

  function wire() {
    // Hook every .nav-cta (Request Briefing button on the main site)
    const ctaTriggers = document.querySelectorAll('.nav-cta');
    ctaTriggers.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    // Modal close handlers
    root.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); closeModal(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('dlpk-modal').hidden) closeModal();
    });

    // Step navigation back buttons
    root.querySelectorAll('[data-back-to]').forEach(function (el) {
      el.addEventListener('click', function () {
        const target = el.getAttribute('data-back-to');
        showStep(target);
      });
    });

    // Three option buttons
    $('dlpk-opt-google').addEventListener('click', function () {
      showStep('signin');
      if (!gisLoaded) loadGIS();
    });
    $('dlpk-opt-scan').addEventListener('click', openScanner);
    $('dlpk-opt-email').addEventListener('click', function (e) {
      e.preventDefault();
      const subject = encodeURIComponent('Briefing Request');
      window.location.href = 'mailto:' + SUPPORT_EMAIL +
        '?cc=' + encodeURIComponent(SUPPORT_EMAIL_CC) +
        '&subject=' + subject;
    });
    $('dlpk-opt-mycard').addEventListener('click', onMyCardClick);

    $('dlpk-form').addEventListener('submit', onFormSubmit);
  }

  function openModal() {
    $('dlpk-modal').hidden = false;
    document.documentElement.classList.add('dlpk-no-scroll');
    showStep('options');
    updateMyCardVisibility();
  }

  // Reveal "View my digital card" only when the cached session belongs to a
  // verified team member. Customers (no cached session OR non-team email)
  // never see this option.
  function updateMyCardVisibility() {
    const opt = $('dlpk-opt-mycard');
    if (!opt) return;
    opt.hidden = true;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('dolphlink.card.session') || 'null'); }
    catch (_) {}
    if (!cached || !cached.email) return;
    // STRICT: only @dolphlink.com domain triggers visibility (NOT roster).
    // Personal-email team members (like roygto2013@gmail.com) can still
    // access their card via "Continue with Google", but the shortcut option
    // only appears once the user has migrated to a corporate email.
    const email = String(cached.email).toLowerCase();
    if (email.endsWith('@' + TEAM_DOMAIN)) {
      opt.hidden = false;
    }
  }

  function closeModal() {
    $('dlpk-modal').hidden = true;
    document.documentElement.classList.remove('dlpk-no-scroll');
    setTimeout(function () { showStep('options'); }, 240);
  }

  function showStep(name) {
    $('dlpk-step-options').hidden = name !== 'options';
    $('dlpk-step-signin').hidden  = name !== 'signin';
    $('dlpk-step-form').hidden    = name !== 'form';
    $('dlpk-step-success').hidden = name !== 'success';
    $('dlpk-step-error').hidden   = name !== 'error';
    const cardStep = $('dlpk-step-card');
    if (cardStep) cardStep.hidden = name !== 'card';
  }

  function loadGIS() {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
    gisLoaded = true;
  }

  // ---------------------------------------------------------------------------
  // 4. Google Sign-In callback
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // "View my digital card" handler — short-circuit straight to the card if
  // the user is already signed in, otherwise trigger Google sign-in with
  // viewCardMode=true so the callback redirects without the form step.
  // ---------------------------------------------------------------------------
  function onMyCardClick() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('dolphlink.card.session') || 'null'); }
    catch (_) {}

    if (cached && cached.email) {
      isTeamMember(cached.email).then(function (isTeam) {
        if (isTeam) {
          showCardInline(cached.email);
        } else {
          showMyCardNotMember();
        }
      });
      return;
    }

    viewCardMode = true;
    showStep('signin');
    if (!gisLoaded) loadGIS();
  }

  // ---------------------------------------------------------------------------
  // Inline card rendering — no iframe. Pulls member from content/cards.json,
  // pulls product taglines from content/content.json, renders into the DOM
  // already declared in step-card. Lazy-loads qrcode-generator for the vCard QR.
  // ---------------------------------------------------------------------------
  let cardsDataCache = null;
  let portfoliosCache = null;
  let qrLibLoading = null;

  async function showCardInline(email) {
    const target = String(email || '').toLowerCase();
    if (!target) return;

    // Fetch cards.json + content.json once, then cache
    if (!cardsDataCache) {
      try {
        const r = await fetch('content/cards.json', { cache: 'no-cache' });
        cardsDataCache = await r.json();
      } catch (e) {
        showStep('error'); return;
      }
    }
    if (!portfoliosCache) {
      try {
        const r = await fetch('content/content.json', { cache: 'no-cache' });
        const data = await r.json();
        portfoliosCache = {};
        (data && data.portfolios && data.portfolios.items || []).forEach(function (it) {
          if (it && it.key) portfoliosCache[it.key] = it;
        });
      } catch (e) { portfoliosCache = {}; }
    }

    const member = (cardsDataCache.members || []).find(function (m) {
      if (m.active === false) return false;
      const full = String(m.email || '').toLowerCase();
      return full === target || full.split('@')[0] === target.split('@')[0];
    });
    if (!member) { showStep('error'); return; }

    paintCard(member);
    showStep('card');

    // Fire-and-forget QR render (lazy load qrcode-generator)
    renderCardQR(member);
  }

  function paintCard(member) {
    const photo = $('dlpk-card-photo');
    const initials = $('dlpk-card-initials');
    photo.hidden = true;
    initials.textContent = initialsOf(member.name);

    $('dlpk-card-name').textContent  = member.name || '';
    $('dlpk-card-title').textContent = member.title || '';
    const dept = $('dlpk-card-dept');
    if (member.department) { dept.textContent = member.department; dept.hidden = false; }
    else                   { dept.hidden = true; }

    // Email
    if (member.email) {
      $('dlpk-card-email').textContent = member.email;
      $('dlpk-card-email').href = 'mailto:' + member.email;
      $('dlpk-card-row-email').hidden = false;
    } else { $('dlpk-card-row-email').hidden = true; }

    // Phone
    if (hasRealPhone(member.phone)) {
      $('dlpk-card-phone').textContent = member.phone;
      $('dlpk-card-phone').href = 'tel:' + member.phone.replace(/[^+0-9]/g, '');
      $('dlpk-card-row-phone').hidden = false;
    } else { $('dlpk-card-row-phone').hidden = true; }

    // LinkedIn
    if (member.linkedin) {
      $('dlpk-card-linkedin').href = member.linkedin;
      $('dlpk-card-row-linkedin').hidden = false;
    } else { $('dlpk-card-row-linkedin').hidden = true; }

    // Languages
    if (Array.isArray(member.languages) && member.languages.length) {
      $('dlpk-card-languages').textContent = member.languages.join(' · ');
      $('dlpk-card-row-languages').hidden = false;
    } else { $('dlpk-card-row-languages').hidden = true; }

    // Bio
    const bio = $('dlpk-card-bio');
    if (member.bio) { bio.textContent = member.bio; bio.hidden = false; }
    else            { bio.hidden = true; }

    // Specialty Products
    const productsEl = $('dlpk-card-products');
    const list = $('dlpk-card-product-list');
    list.innerHTML = '';
    const keys = member.products || [];
    if (keys.length) {
      keys.forEach(function (k) {
        const p = portfoliosCache[k];
        const li = document.createElement('li');
        const lbl = document.createElement('span');
        lbl.className = 'p-label';
        lbl.textContent = (p && p.label) || k;
        li.appendChild(lbl);
        if (p && p.tagline) {
          const tag = document.createElement('span');
          tag.className = 'p-tag';
          tag.textContent = p.tagline;
          li.appendChild(tag);
        }
        list.appendChild(li);
      });
      productsEl.hidden = false;
    } else { productsEl.hidden = true; }

    // Three actions — only meaningful when the member has a designed card
    // image on Drive. Hide the whole row otherwise so we don't show
    // buttons that point at nothing.
    const hasCard = !!(member && member.cardImage);
    $('dlpk-card-namecard').hidden = !hasCard;
    $('dlpk-card-copy').hidden     = !hasCard;
    $('dlpk-card-share').hidden    = !hasCard;
    if (hasCard) {
      $('dlpk-card-namecard').onclick = function () { downloadNameCard(member); };
      $('dlpk-card-copy').onclick     = function () { copyCardLink(member); };
      $('dlpk-card-share').onclick    = function () { shareCard(member); };
    }
  }

  // The shareable URL is now strictly the member's designed Drive card.
  // No on-site /cards/?u= fallback — that page has been retired.
  // Returns '' when cardImage is missing; the calling buttons are hidden
  // in that case (see paintCard).
  function buildShareableCardURL(member) {
    return (member && member.cardImage) || '';
  }

  // Convert a Drive "/file/d/<ID>/view" share URL into a direct download URL.
  // Handles both `/file/d/<id>/...` and `?id=<id>` flavors. If the input
  // does not look like a Drive URL, returns it unchanged.
  function toDriveDownloadURL(url) {
    const s = String(url || '');
    const m = s.match(/\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&]+)/);
    if (!m) return s;
    return 'https://drive.google.com/uc?export=download&id=' + m[1];
  }

  // Download the pre-designed name-card image. Two sources, in priority:
  //   1. member.cardImage  (a direct URL — typically Google Drive
  //      "uc?export=download&id=…" — set per-member in cards.json)
  //   2. PHOTO_API proxy   (Apps Script reads <localpart>-namecard.* from
  //      the shared Drive folder and returns base64)
  // Falls through to a helpful instruction if neither is configured.
  async function downloadNameCard(member) {
    const local = String(member.email || '').split('@')[0];
    if (!local) return;

    // Source 1: explicit cardImage URL on the member.
    // member.cardImage is the share URL (Drive /file/d/<id>/view).
    // For download we convert it to the uc?export=download form.
    if (member.cardImage) {
      const a = document.createElement('a');
      a.href = toDriveDownloadURL(member.cardImage);
      a.download = (member.name || local).replace(/\s+/g, '_') + '-card.png';
      a.target = '_blank';                  // some browsers ignore download cross-origin
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Source 2: Apps Script proxy
    if (PHOTO_API.indexOf('REPLACE_WITH_') !== -1) {
      window.alert(
        'Name-card download is not configured for ' + (member.name || local) + '.\n\n' +
        'Add a "cardImage" URL in content/cards.json for this member, ' +
        'OR set PHOTO_API in register/inject.js and drop ' + local + '-namecard.png ' +
        'into the team Drive folder.'
      );
      return;
    }

    const btn = $('dlpk-card-namecard');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Loading…';
    try {
      const r = await fetch(PHOTO_API + '?r=photo&name=' + encodeURIComponent(local + '-namecard'));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data || !data.image) {
        window.alert(
          'No name-card image found for ' + local + '.\n\n' +
          'Upload one to the Drive folder as ' + local + '-namecard.png, then try again.'
        );
        return;
      }
      const a = document.createElement('a');
      a.href = data.image;
      a.download = (member.name || local).replace(/\s+/g, '_') + '-namecard.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      window.alert('Could not load your name card: ' + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  async function copyCardLink(member) {
    const url = buildShareableCardURL(member);
    const btn = $('dlpk-card-copy');
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Copied!';
    } catch (_) {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed'; ta.style.top = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); btn.textContent = 'Copied!'; }
      catch (_) { btn.textContent = 'Copy failed'; }
      document.body.removeChild(ta);
    }
    setTimeout(function () { btn.textContent = original; }, 1500);
  }

  async function shareCard(member) {
    const url = buildShareableCardURL(member);
    const data = {
      title: (member.name || 'DOLPHLINK') + ' — Digital Card',
      text: (member.name || '') + ', ' + (member.title || 'DOLPHLINK'),
      url: url
    };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (_) {}
    }
    // No native share API — fall back to copy
    copyCardLink(member);
  }

  function initialsOf(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function hasRealPhone(phone) {
    if (!phone) return false;
    if (/^\+?\s*0+(\s|$)/.test(phone)) return false;
    if (/0000\s*0000/.test(phone)) return false;
    return true;
  }

  async function renderCardQR(member) {
    const target = $('dlpk-card-qr');
    target.innerHTML = '';
    if (!window.qrcode) {
      qrLibLoading = qrLibLoading || new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('qr load failed')); };
        document.head.appendChild(s);
      });
      try { await qrLibLoading; } catch (e) {
        target.textContent = '(QR library failed to load)';
        return;
      }
    }
    // QR contents:
    //   - cardImage present → encode the Drive download URL directly.
    //     Scanning prompts to open Drive → image downloads (one tap).
    //   - cardImage missing → fall back to a vCard (no URL field), so
    //     scanning still gives "Add to Contacts" with name + phone + email.
    let text;
    if (member.cardImage) {
      text = toDriveDownloadURL(member.cardImage);
    } else {
      text = buildVCardForQR(member, '');
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    target.innerHTML = qr.createImgTag(4, 4);
    const img = target.querySelector('img');
    if (img) {
      img.style.width  = '180px';
      img.style.height = '180px';
      img.alt = 'Scan to save ' + (member.name || '') + ' to your contacts';
    }
  }

  // Lean vCard for the QR. Only used when a member has no cardImage; in
  // that case scanning still gives "Add to Contacts" with the contact info.
  function buildVCardForQR(member, cardURL) {
    return [
      'BEGIN:VCARD', 'VERSION:3.0',
      'FN:' + escapeVCard(member.name || ''),
      'N:' + splitLastFirst(member.name),
      member.title ? 'TITLE:' + escapeVCard(member.title) : '',
      'ORG:' + escapeVCard((cardsDataCache && cardsDataCache.company && cardsDataCache.company.name) || 'DOLPHLINK'),
      hasRealPhone(member.phone) ? 'TEL;TYPE=WORK,VOICE:' + member.phone : '',
      member.email ? 'EMAIL;TYPE=WORK:' + member.email : '',
      cardURL ? 'URL:' + cardURL : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
  }
  function escapeVCard(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  function splitLastFirst(name) {
    if (!name) return ';;;;';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0] + ';;;;';
    const last = parts.pop();
    return last + ';' + parts.join(' ') + ';;;';
  }

  function showMyCardNotMember() {
    $('dlpk-error-msg').innerHTML =
      'The digital card is reserved for DOLPHLINK team members. ' +
      'If you would like to leave us a message, use ' +
      '<a style="color:#0059B3;font-weight:700;text-decoration:underline" href="mailto:' + SUPPORT_EMAIL + '?cc=' + SUPPORT_EMAIL_CC + '">' + SUPPORT_EMAIL + '</a>.';
    showStep('error');
  }

  window.onDLPKRegisterSignIn = function (response) {
    try {
      const payload = decodeJWT(response.credential);
      const email = String(payload && payload.email || '').toLowerCase();
      const name  = (payload && payload.name) || '';
      if (!email) { showStep('error'); return; }

      signedIn = {
        email: email, name: name,
        picture: (payload && payload.picture) || '',
        idToken: response.credential
      };

      // "View my digital card" path: skip form, go straight to /cards/ if team
      if (viewCardMode) {
        viewCardMode = false;
        isTeamMember(email).then(function (isTeam) {
          if (isTeam) {
            try {
              localStorage.setItem('dolphlink.card.session', JSON.stringify({
                email: email, name: name, picture: signedIn.picture
              }));
            } catch (_) {}
            showCardInline(email);
          } else {
            showMyCardNotMember();
          }
        });
        return;
      }

      // Test-mode admin: see customer form first even though we're in roster.
      // The form's submit handler will detect team membership and route to
      // the card afterwards, so the admin walks through both halves.
      if (TEST_USER_EMAILS.indexOf(email) !== -1) {
        showCustomerForm(email, name);
        return;
      }

      // Default "Continue with Google" path: team check first.
      // Team members get the direct-redirect shortcut (no useless form);
      // customers fall through to the form below.
      isTeamMember(email).then(function (isTeam) {
        if (isTeam) {
          try {
            localStorage.setItem('dolphlink.card.session', JSON.stringify({
              email: email, name: name, picture: signedIn.picture
            }));
          } catch (_) {}
          showCardInline(email);
          return;
        }
        // Customer — show the form
        showCustomerForm(email, name);
      });
      return;
    } catch (err) {
      console.error('[register] sign-in error', err);
      showStep('error');
    }
  };

  function showCustomerForm(email, name) {
      $('dlpk-greet-name').textContent  = (name.split(' ')[0]) || 'there';
      $('dlpk-greet-email').textContent = email;
      const avatar = $('dlpk-avatar');
      if (signedIn.picture) { avatar.src = signedIn.picture; avatar.hidden = false; }
      else                  { avatar.hidden = true; }
      $('dlpk-field-name').value    = name;
      $('dlpk-field-email').value   = email;
      $('dlpk-field-company').value = '';
      $('dlpk-field-phone').value   = '';
      $('dlpk-err').hidden = true;

      showStep('form');
      setTimeout(function () { $('dlpk-field-company').focus(); }, 50);
  }

  function decodeJWT(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('bad jwt');
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const json = atob(pad);
    const utf8 = decodeURIComponent(
      json.split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')
    );
    return JSON.parse(utf8);
  }

  // ---------------------------------------------------------------------------
  // 5. Form submit -> Sheet write OR team-redirect
  // ---------------------------------------------------------------------------
  async function onFormSubmit(e) {
    e.preventDefault();
    const errEl = $('dlpk-err');
    errEl.hidden = true;

    const form = e.currentTarget;
    if (!form.checkValidity()) {
      errEl.textContent = 'Please complete all required fields.';
      errEl.hidden = false;
      return;
    }

    const submitBtn = $('dlpk-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const data = {
      name:    $('dlpk-field-name').value.trim(),
      company: $('dlpk-field-company').value.trim(),
      email:   $('dlpk-field-email').value.trim().toLowerCase(),
      phone:   $('dlpk-field-phone').value.trim(),
      idToken: signedIn ? signedIn.idToken : '',
      website: form.elements['website'] ? form.elements['website'].value : '',
      page:    location.pathname + location.search,
      referrer: document.referrer || '',
      ua:      navigator.userAgent
    };

    try {
      // Team check first -- @dolphlink.com OR roster member -> straight to card
      const isTeam = await isTeamMember(data.email);

      if (isTeam) {
        // Cache the team session for future fast paths
        try {
          localStorage.setItem('dolphlink.card.session', JSON.stringify({
            email: data.email,
            name:  signedIn ? (signedIn.name || data.name) : data.name,
            picture: signedIn ? (signedIn.picture || '') : ''
          }));
        } catch (_) {}
        // Render the card inline in the modal — no page navigation
        showCardInline(data.email);
        return;
      }

      // Customer -> write to Sheet via Apps Script
      if (REGISTER_API.indexOf('REPLACE_WITH_') === -1) {
        const body = new URLSearchParams();
        Object.keys(data).forEach(function (k) { body.append(k, String(data[k])); });
        const r = await fetch(REGISTER_API, { method: 'POST', body: body });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      } else {
        console.warn('[register] REGISTER_API placeholder -- skipping POST');
      }

      $('dlpk-success-name').textContent = (data.name.split(' ')[0]) || 'there';
      showStep('success');
    } catch (err) {
      console.error('[register] submit failed', err);
      $('dlpk-error-msg').innerHTML =
        'Saved your interest, but the confirmation did not go through. ' +
        'Please email <a style="color:#0059B3;font-weight:700;text-decoration:underline" href="mailto:' + SUPPORT_EMAIL + '?cc=' + SUPPORT_EMAIL_CC + '">' + SUPPORT_EMAIL + '</a> so we do not miss you.';
      showStep('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Team detection: @dolphlink.com OR roster entry in cards.json
  // ---------------------------------------------------------------------------
  async function isTeamMember(email) {
    email = String(email || '').toLowerCase();
    if (!email) return false;
    if (email.endsWith('@' + TEAM_DOMAIN)) return true;
    try {
      const r = await fetch('content/cards.json', { cache: 'no-cache' });
      if (!r.ok) return false;
      const data = await r.json();
      if (!data || !Array.isArray(data.members)) return false;
      return data.members.some(function (m) {
        return m.active !== false && String(m.email || '').toLowerCase() === email;
      });
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. QR Scanner -- loads register/scanner.js on demand
  // ---------------------------------------------------------------------------
  function openScanner() {
    if (window.DLPKScanner) {
      window.DLPKScanner.open(handleScanResult);
      return;
    }
    if (scannerLoading) return;
    scannerLoading = true;
    const s = document.createElement('script');
    s.src = 'js/register-scanner.js?v=2';
    s.onload = function () {
      scannerLoading = false;
      if (window.DLPKScanner) window.DLPKScanner.open(handleScanResult);
    };
    s.onerror = function () {
      scannerLoading = false;
      window.alert('Scanner failed to load. Please check your connection.');
    };
    document.head.appendChild(s);
  }

  function handleScanResult(result) {
    if (!result || !result.data) return;
    if (result.type === 'url') {
      if (window.confirm('Open this link?\n\n' + result.data)) {
        window.location.href = result.data;
      }
      return;
    }
    if (result.type === 'vcard') {
      const blob = new Blob([result.data], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'contact.vcf';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return;
    }
    window.alert('QR content:\n\n' + result.data);
  }

})();
