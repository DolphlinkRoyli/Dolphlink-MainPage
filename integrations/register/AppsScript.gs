/**
 * DOLPHLINK Register — Lead Capture (with security hardening)
 *
 * Receives sign-in + form data from the Request Briefing modal (register/
 * inject.js, hooked to the .nav-cta button on the main site). Validates the
 * Google ID token server-side, applies a per-email rate limit, drops bot
 * submissions via honeypot, then appends a row to the Sheet.
 *
 * Endpoints:
 *   POST  body: idToken, name, company, email, phone, website (honeypot), page, referrer, ua
 *         → appends row, returns { ok: true }
 *   GET   ?r=ping  → health check
 *
 * Hardening:
 *   1. JWT verified via Google's tokeninfo endpoint (rejects forged / expired)
 *   2. Audience check (token must be issued for our Client ID)
 *   3. Per-email rate limit: 1 submission / hour
 *   4. Honeypot field "website" — bots fill, humans don't see → silent drop
 *   5. Email used in the Sheet is the *Google-verified* one, not the user's
 *      submitted form value (prevents impersonation)
 *
 * Setup:
 *   1. Replace SHEET_ID + GOOGLE_CLIENT_ID below
 *   2. Run setupSheetHeaders() ONCE from the editor
 *   3. Deploy → Web app → Execute as: Me → Anyone access
 *   4. Copy the deployment URL into register/inject.js → REGISTER_API
 *
 * Full docs: integrations/register/setup.md
 */

// ============================================================================
// CONFIG
// ============================================================================
const SHEET_ID         = 'REPLACE_WITH_YOUR_SHEET_ID';
const GOOGLE_CLIENT_ID = '953883058126-8ebc9qlkb982mbh06roprvrl7ee9bqha.apps.googleusercontent.com';
const SHEET_NAME       = 'Leads';
const RATE_LIMIT_SECS  = 3600; // 1 hour per email

// ============================================================================
// Routing
// ============================================================================
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // 1. Honeypot — silently drop bot submissions (return 200 so they don't retry)
    if (p.website) return ok();

    // 2. Required fields
    if (!p.idToken || !p.company || !p.phone) {
      return err('missing_fields');
    }

    // 3. Verify the Google JWT — rejects forged or expired tokens
    const claims = verifyGoogleJWT(p.idToken);
    if (!claims) return err('invalid_token');

    // 4. Per-email rate limit
    const cache = CacheService.getScriptCache();
    const rateKey = 'rate:' + claims.email;
    if (cache.get(rateKey)) return err('rate_limited');
    cache.put(rateKey, '1', RATE_LIMIT_SECS);

    // 5. Append to Sheet — use Google-verified email/name, not user-submitted
    appendLead({
      name:     claims.name || p.name || '',
      email:    claims.email,
      company:  String(p.company || '').slice(0, 200),
      phone:    String(p.phone || '').slice(0, 60),
      picture:  claims.picture || '',
      page:     String(p.page || '').slice(0, 200),
      referrer: String(p.referrer || '').slice(0, 300),
      ua:       String(p.ua || '').slice(0, 300)
    });

    return ok();
  } catch (e2) {
    return err(e2.message || String(e2));
  }
}

function doGet(e) {
  const route = String(e && e.parameter && e.parameter.r || '').toLowerCase();
  if (route === 'ping') {
    return jsonResponse({
      status: 'ok',
      sheet: SHEET_ID,
      time: new Date().toISOString()
    });
  }
  return jsonResponse({ status: 'register endpoint live' });
}

// ============================================================================
// JWT verification — calls Google's tokeninfo endpoint
// ============================================================================
function verifyGoogleJWT(idToken) {
  try {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;

    const claims = JSON.parse(resp.getContentText());

    // Audience check — must be OUR client ID, not someone else's
    if (claims.aud !== GOOGLE_CLIENT_ID) return null;

    // Issuer check — must come from Google
    if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') return null;

    // Expiry check
    if (Number(claims.exp) * 1000 < Date.now()) return null;

    // Email must be present and verified
    if (!claims.email || claims.email_verified === 'false' || claims.email_verified === false) return null;

    return {
      email: String(claims.email).toLowerCase(),
      name: claims.name || '',
      picture: claims.picture || '',
      sub: claims.sub
    };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// Sheet append
// ============================================================================
function appendLead(row) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found. Run setupSheetHeaders() first.');
  }
  const domain = (row.email.split('@')[1] || '').toLowerCase();
  sheet.appendRow([
    new Date(),
    row.name,
    row.email,
    domain,
    row.company,
    row.phone,
    row.picture,
    row.page,
    row.referrer,
    row.ua
  ]);
}

// ============================================================================
// One-time setup (run from the Apps Script editor's Run menu)
// ============================================================================
function setupSheetHeaders() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp', 'Name', 'Email', 'Email Domain',
      'Company', 'Phone', 'Picture URL',
      'Page', 'Referrer', 'User Agent'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 220);
    sheet.setColumnWidth(4, 140);
    sheet.setColumnWidth(5, 180);
    sheet.setColumnWidth(6, 140);
  }
}

// ============================================================================
// Helpers
// ============================================================================
function ok() {
  return jsonResponse({ ok: true });
}
function err(code) {
  return jsonResponse({ ok: false, error: code });
}
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
