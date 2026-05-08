/* ============================================================================
 * DOLPHLINK Register — main-site (homepage) Request-Briefing modal
 *
 * Scope: HOMEPAGE ONLY. Loaded from index.html as
 *   <script type="module" src="js/engine/home/register.js">
 *
 * Behaviour (desktop + mobile, identical):
 *   - Hooks every .nav-cta on the page (the "Request Briefing" button — label
 *     comes from content.json which we deliberately do NOT touch)
 *   - Click → modal opens with up to FOUR options:
 *       1. Continue with Google     (team auto-detect → inline card / customer → form)
 *       2. Scan a QR code           (lazy-loads engine/home/register-scanner.js)
 *       3. Email us directly        (mailto fallback)
 *       4. View my digital card     (only visible to @dolphlink.com cached
 *                                    sessions; renders inline in the modal,
 *                                    no page navigation)
 *   - Team-member detection short-circuits the form: @dolphlink.com OR an
 *     active entry in cards.json gets the inline card view directly.
 *   - The original mailto href on .nav-cta stays in place as a graceful
 *     fallback for the JS-disabled / pre-load case.
 *
 * Helpers shared with the public card page (vCard build, Drive URLs,
 * clipboard, initials) live in ../core/. Anything below is homepage-
 * specific glue.
 *
 * Setup:
 *   1. Replace GOOGLE_CLIENT_ID with your OAuth Client ID
 *   2. Replace REGISTER_API with your Apps Script Web App URL
 *   3. See integrations/register/setup.md for backend setup
 * ========================================================================== */
import { driveDownloadURL }    from '../core/drive.js';
import { initialsOf,
         hasRealPhone }      from '../core/strings.js';
import { buildLeanVCard }    from '../core/vcard.js';
import { copyToClipboard,
         shareOrCopy }       from '../core/clipboard.js';
import { safeHttpUrl }       from '../core/url.js';

/* Cached card-session validity window (30 days). Beyond this we treat
   the session as expired and fall back to re-authenticating, so a
   stolen long-lived localStorage entry can't replay forever. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_KEY    = 'dolphlink.card.session';

/* Read the cached team session. Returns null on parse failure, missing
   email, or expiry beyond SESSION_TTL_MS. */
function loadSession() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch (_) { return null; }
  if (!cached || !cached.email) return null;
  const savedAt = typeof cached.savedAt === 'number' ? cached.savedAt : 0;
  if (savedAt && Date.now() - savedAt > SESSION_TTL_MS) {
    /* Expired — wipe so subsequent reads don't keep fishing it out. */
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    return null;
  }
  return cached;
}

/* Persist the team session with an expiry stamp. Silently no-ops on
   private-browsing localStorage failures. */
function saveSession(payload) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...payload,
      savedAt: Date.now()
    }));
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Config — update GOOGLE_CLIENT_ID + REGISTER_API at deploy time. PHOTO_API
// is optional (only used as a fallback when a member has no `cardImage`
// URL set in cards.json).
// ---------------------------------------------------------------------------
const TEAM_DOMAIN       = 'dolphlink.com';
const GOOGLE_CLIENT_ID  = '953883058126-8ebc9qlkb982mbh06roprvrl7ee9bqha.apps.googleusercontent.com';
const REGISTER_API      = 'https://script.google.com/macros/s/REPLACE_WITH_REGISTER_DEPLOYMENT_ID/exec';
const PHOTO_API         = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec';
const SUPPORT_EMAIL     = 'Sales@dolphlink.com';
const SUPPORT_EMAIL_CC  = 'Joycetsam@dolphlink.com';
const ROOT_ID           = 'dlpk-reg-root';

// QR-scanner module path (engine/home/register-scanner.js, lazy-loaded).
const SCANNER_SRC       = 'js/engine/home/register-scanner.js?v=2';
// Vendored QR generator (self-hosted only — no CDN by policy).
const QR_LIB_SRC        = 'lib/qrcode.min.js';

// Test-mode emails: even if these match a roster entry, the modal still
// shows the customer form first, then routes to the card after submit.
const TEST_USER_EMAILS = ['roygto2013@gmail.com'];

// ---------------------------------------------------------------------------
// Module-scoped state — shared between every helper below.
// ---------------------------------------------------------------------------
let root = null;
let gisLoaded = false;
let signedIn = null;
let scannerLoading = false;
let viewCardMode = false;
let cardsDataCache = null;
let portfoliosCache = null;
let qrLibLoading = null;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// 1. Modal HTML — built once, attached to <body> on first ready event.
// ---------------------------------------------------------------------------
function buildModalDOM() {
  const div = document.createElement('div');
  div.id = ROOT_ID;
  div.innerHTML = `
    <div class="modal" id="dlpk-modal" hidden role="dialog" aria-labelledby="dlpk-title" aria-modal="true">
      <div class="backdrop"></div>
      <div class="sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <button type="button" class="close" data-close aria-label="Close">&times;</button>

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
              <input id="dlpk-field-email" name="email" type="email" readonly autocomplete="email">
            </div>
            <div class="field">
              <label for="dlpk-field-phone">Phone<span class="req">*</span></label>
              <input id="dlpk-field-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+65 9123 4567">
            </div>
            <p class="err-msg" id="dlpk-err" hidden></p>
            <button type="submit" class="submit" id="dlpk-submit">Submit</button>
          </form>
        </section>

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
  return div;
}

// ---------------------------------------------------------------------------
// 2. Wire-up + open/close
// ---------------------------------------------------------------------------
function wire() {
  document.querySelectorAll('.nav-cta').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });

  root.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); closeModal(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('dlpk-modal').hidden) closeModal();
  });

  root.querySelectorAll('[data-back-to]').forEach(function (el) {
    el.addEventListener('click', function () {
      showStep(el.getAttribute('data-back-to'));
    });
  });

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

function updateMyCardVisibility() {
  const opt = $('dlpk-opt-mycard');
  if (!opt) return;
  opt.hidden = true;
  const cached = loadSession();
  if (!cached) return;
  const email = String(cached.email).toLowerCase();
  if (email.endsWith('@' + TEAM_DOMAIN)) {
    opt.hidden = false;
  }
}

function closeModal() {
  $('dlpk-modal').hidden = true;
  document.documentElement.classList.remove('dlpk-no-scroll');
  setTimeout(() => showStep('options'), 240);
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
// 3. "View my digital card" — short-circuit the form when the cached
// session belongs to a verified team member.
// ---------------------------------------------------------------------------
function onMyCardClick() {
  const cached = loadSession();

  if (cached && cached.email) {
    isTeamMember(cached.email).then(function (isTeam) {
      if (isTeam) showCardInline(cached.email);
      else showMyCardNotMember();
    });
    return;
  }

  viewCardMode = true;
  showStep('signin');
  if (!gisLoaded) loadGIS();
}

async function showCardInline(email) {
  const target = String(email || '').toLowerCase();
  if (!target) return;

  if (!cardsDataCache) {
    try {
      const r = await fetch('content/cards.json', { cache: 'no-cache' });
      cardsDataCache = await r.json();
    } catch (e) { showStep('error'); return; }
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
  renderCardQR(member);
}

function paintCard(member) {
  $('dlpk-card-photo').hidden = true;
  $('dlpk-card-initials').textContent = initialsOf(member.name);

  $('dlpk-card-name').textContent  = member.name || '';
  $('dlpk-card-title').textContent = member.title || '';
  const dept = $('dlpk-card-dept');
  if (member.department) { dept.textContent = member.department; dept.hidden = false; }
  else                   { dept.hidden = true; }

  if (member.email) {
    $('dlpk-card-email').textContent = member.email;
    $('dlpk-card-email').href = 'mailto:' + member.email;
    $('dlpk-card-row-email').hidden = false;
  } else { $('dlpk-card-row-email').hidden = true; }

  if (hasRealPhone(member.phone)) {
    $('dlpk-card-phone').textContent = member.phone;
    $('dlpk-card-phone').href = 'tel:' + member.phone.replace(/[^+0-9]/g, '');
    $('dlpk-card-row-phone').hidden = false;
  } else { $('dlpk-card-row-phone').hidden = true; }

  /* Validate LinkedIn URL is http(s):// only — a poisoned cards.json
     with `linkedin: "javascript:alert(1)"` would otherwise become an
     XSS-on-click <a href>. */
  const linkedinUrl = safeHttpUrl(member.linkedin);
  if (linkedinUrl) {
    $('dlpk-card-linkedin').href = linkedinUrl;
    $('dlpk-card-row-linkedin').hidden = false;
  } else { $('dlpk-card-row-linkedin').hidden = true; }

  if (Array.isArray(member.languages) && member.languages.length) {
    $('dlpk-card-languages').textContent = member.languages.join(' · ');
    $('dlpk-card-row-languages').hidden = false;
  } else { $('dlpk-card-row-languages').hidden = true; }

  const bio = $('dlpk-card-bio');
  if (member.bio) { bio.textContent = member.bio; bio.hidden = false; }
  else            { bio.hidden = true; }

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

  const hasCardImg = !!(member && member.cardImage);
  $('dlpk-card-namecard').hidden = !hasCardImg;
  if (hasCardImg) {
    $('dlpk-card-namecard').onclick = () => downloadNameCard(member);
  }
  $('dlpk-card-copy').hidden  = false;
  $('dlpk-card-share').hidden = false;
  $('dlpk-card-copy').onclick  = () => copyCardLink(member);
  $('dlpk-card-share').onclick = () => shareCard(member);
}

// Shareable URL = the enterprise landing page for this member.
function buildShareableCardURL(member) {
  if (!member || !member.email) return '';
  const local = String(member.email).split('@')[0];
  const base = (cardsDataCache && cardsDataCache.config && cardsDataCache.config.landingBase)
    || (window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'card/');
  return base + '?u=' + encodeURIComponent(local);
}

async function downloadNameCard(member) {
  const local = String(member.email || '').split('@')[0];
  if (!local) return;

  // Source 1: explicit cardImage URL on the member.
  if (member.cardImage) {
    const a = document.createElement('a');
    a.href = driveDownloadURL(member.cardImage);
    a.download = (member.name || local).replace(/\s+/g, '_') + '-card.png';
    a.target = '_blank';
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
      'OR set PHOTO_API in this register module and drop ' + local + '-namecard.png ' +
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
    /* Defence-in-depth: validate the URL the proxy returns before
       handing it to <a href>. Apps Script is trusted but if it ever
       gets compromised, an attacker could return a `javascript:` URL
       and exploit a click. Also accepts `data:` for base64-encoded
       images (the documented happy path). */
    const imageHref = safeHttpUrl(data.image)
      || (typeof data.image === 'string' && /^data:image\//i.test(data.image) ? data.image : '');
    if (!imageHref) {
      window.alert('Server returned an unsafe image URL — blocked.');
      return;
    }
    const a = document.createElement('a');
    a.href = imageHref;
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
  const ok = await copyToClipboard(url);
  btn.textContent = ok ? 'Copied!' : 'Copy failed';
  setTimeout(() => { btn.textContent = original; }, 1500);
}

async function shareCard(member) {
  const url = buildShareableCardURL(member);
  const result = await shareOrCopy({
    title: (member.name || 'DOLPHLINK') + ' — Digital Card',
    text:  (member.name || '') + ', ' + (member.title || 'DOLPHLINK'),
    url:   url
  });
  if (result === 'copied' || result === 'failed') copyCardLink(member);
}

function showMyCardNotMember() {
  $('dlpk-error-msg').innerHTML =
    'The digital card is reserved for DOLPHLINK team members. ' +
    'If you would like to leave us a message, use ' +
    '<a style="color:#0059B3;font-weight:700;text-decoration:underline" href="mailto:' + SUPPORT_EMAIL + '?cc=' + SUPPORT_EMAIL_CC + '">' + SUPPORT_EMAIL + '</a>.';
  showStep('error');
}

// ---------------------------------------------------------------------------
// 4. Google Sign-In callback (exposed globally so the GIS data-callback
// attribute can find it).
// ---------------------------------------------------------------------------
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

    if (viewCardMode) {
      viewCardMode = false;
      isTeamMember(email).then(function (isTeam) {
        if (isTeam) {
          saveSession({ email: email, name: name, picture: signedIn.picture });
          showCardInline(email);
        } else {
          showMyCardNotMember();
        }
      });
      return;
    }

    if (TEST_USER_EMAILS.indexOf(email) !== -1) {
      showCustomerForm(email, name);
      return;
    }

    isTeamMember(email).then(function (isTeam) {
      if (isTeam) {
        saveSession({ email: email, name: name, picture: signedIn.picture });
        showCardInline(email);
        return;
      }
      showCustomerForm(email, name);
    });
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
  setTimeout(() => $('dlpk-field-company').focus(), 50);
}

function decodeJWT(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('bad jwt');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const json = atob(pad);
  const utf8 = decodeURIComponent(
    json.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
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
    const isTeam = await isTeamMember(data.email);

    if (isTeam) {
      saveSession({
        email: data.email,
        name:  signedIn ? (signedIn.name || data.name) : data.name,
        picture: signedIn ? (signedIn.picture || '') : ''
      });
      showCardInline(data.email);
      return;
    }

    if (REGISTER_API.indexOf('REPLACE_WITH_') === -1) {
      const body = new URLSearchParams();
      Object.keys(data).forEach(k => body.append(k, String(data[k])));
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
    return data.members.some(m =>
      m.active !== false && String(m.email || '').toLowerCase() === email);
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 7. QR rendering — uses lib/qrcode.min.js, lazy-loaded on first card view.
// ---------------------------------------------------------------------------
async function renderCardQR(member) {
  const target = $('dlpk-card-qr');
  target.innerHTML = '';
  if (!window.qrcode) {
    qrLibLoading = qrLibLoading || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = QR_LIB_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('qr load failed (vendor lib/qrcode.min.js missing)'));
      document.head.appendChild(s);
    });
    try { await qrLibLoading; } catch (e) {
      target.textContent = '(QR library failed to load)';
      return;
    }
  }
  /* QR contents: the enterprise landing page URL (/c/?u=<localpart>).
     If buildShareableCardURL returns empty (e.g. cards.json missing
     config.landingBase), fall back to a direct vCard so the QR is never
     useless. */
  const companyName = (cardsDataCache && cardsDataCache.company && cardsDataCache.company.name) || 'DOLPHLINK';
  let payload = buildShareableCardURL(member);
  if (!payload) payload = buildLeanVCard(member, '', companyName);
  const qr = window.qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  target.innerHTML = qr.createImgTag(4, 4);
  const img = target.querySelector('img');
  if (img) {
    img.style.width  = '180px';
    img.style.height = '180px';
    img.alt = 'Scan to save ' + (member.name || '') + ' to your contacts';
  }
}

// ---------------------------------------------------------------------------
// 8. QR Scanner — loads engine/home/register-scanner.js on demand
// ---------------------------------------------------------------------------
function openScanner() {
  if (window.DLPKScanner) {
    window.DLPKScanner.open(handleScanResult);
    return;
  }
  if (scannerLoading) return;
  scannerLoading = true;
  const s = document.createElement('script');
  s.src = SCANNER_SRC;
  s.onload = () => {
    scannerLoading = false;
    if (window.DLPKScanner) window.DLPKScanner.open(handleScanResult);
  };
  s.onerror = () => {
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  window.alert('QR content:\n\n' + result.data);
}

// ---------------------------------------------------------------------------
// Boot — guard against double-init, then attach the modal to the page.
// ---------------------------------------------------------------------------
if (!document.getElementById(ROOT_ID)) {
  root = buildModalDOM();
  if (document.body) {
    document.body.appendChild(root);
    wire();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(root);
      wire();
    });
  }
}
