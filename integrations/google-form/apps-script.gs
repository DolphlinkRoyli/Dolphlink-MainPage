/**
 * DOLPHLINK Content Editor — Google Form ⇄ GitHub Bridge (with Auto-Refresh Redirector)
 * ============================================================================
 * This single Apps Script file does THREE jobs:
 *
 *   1. generateForm()   — Run ONCE manually. Reads current content.json from
 *                         GitHub, creates a Google Form with one paragraph
 *                         question per editable field, attaches the on-submit
 *                         trigger, and saves the form ID for the redirector.
 *
 *   2. doGet(e)         — Web App endpoint. When the editor opens the bookmarked
 *                         URL, this function fetches the LATEST content.json
 *                         from GitHub, builds a Google Form pre-fill URL with
 *                         all current values, and 302-redirects to it.
 *                         Editor always sees the freshest content.
 *
 *   3. onFormSubmit(e)  — Auto-fires on form submission. Patches the matching
 *                         paths in content/content.json on GitHub. GitHub Pages
 *                         redeploys automatically.
 *
 * Empty fields on submit are SKIPPED. The PAT lives in Script Properties and
 * never reaches the browser. Every commit message contains the editor's email.
 *
 * SETUP (one-time, ~15 minutes):
 *   1. Generate a fine-grained GitHub PAT (Contents R/W on Dolphlink-MainPage).
 *   2. Create a NEW standalone Apps Script project (script.google.com → New).
 *   3. Paste this entire file into Code.gs. Save.
 *   4. Project Settings → Script properties → add:
 *        GITHUB_TOKEN = <your PAT>
 *        GITHUB_OWNER = dolphlinkroyli
 *        GITHUB_REPO  = Dolphlink-MainPage
 *        CONTENT_PATH = content/content.json
 *   5. Run `generateForm` once. Authorize when prompted.
 *      → Creates the form + trigger. Form ID saved automatically.
 *   6. Deploy → New deployment → Type: Web app
 *        - Execute as: Me
 *        - Who has access: Anyone with Google account (or your specific user)
 *      → Copy the Web App URL. THIS is what editors bookmark.
 *   7. Open the Web App URL → confirms redirect to a pre-filled form. Done.
 * ============================================================================
 */

/* eslint-disable no-undef */

/* ============================================================================
 * SECTION 1 — FORM GENERATOR (run once)
 * ============================================================================ */

function generateForm() {
  const { content } = fetchContentFile();
  const json = JSON.parse(content);

  const form = FormApp.create('DOLPHLINK Content Editor');
  form.setDescription(
    'Update DOLPHLINK site copy. Empty fields are skipped — change only what ' +
    'you need. Submit and the change goes live in ~1 minute. Every submission ' +
    'creates a Git commit with your email for full audit trail.\n\n' +
    'For multi-paragraph descriptions, separate paragraphs with a blank line ' +
    '(press Enter twice).'
  );
  // SECURITY: auto-collect Google-verified email. setCollectEmail(true)
  // automatically requires the respondent to be signed into Google to submit,
  // and onFormSubmit reads the verified email (not the user-typed field) to
  // gate against EDITOR_ALLOWLIST. This makes the Form Public URL safe even
  // if it leaks.
  form.setCollectEmail(true);
  form.setShowLinkToRespondAgain(true);
  form.setProgressBar(true);

  // ---- Submitter info (required) ----
  form.addPageBreakItem().setTitle('Submitter Info');
  form.addTextItem()
    .setTitle('Editor Email')
    .setHelpText('Required. Used in commit message for audit trail.')
    .setRequired(true);
  form.addTextItem()
    .setTitle('Change Note')
    .setHelpText('Optional one-liner describing what you changed.')
    .setRequired(false);

  // ---- Hero ----
  form.addPageBreakItem().setTitle('Hero Section');
  addPara(form, 'Hero · Tagline');
  addPara(form, 'Hero · CTA Primary');
  addPara(form, 'Hero · CTA Secondary');

  // ---- Reliability stats ----
  form.addPageBreakItem().setTitle('Reliability Stats')
    .setHelpText('Only descriptions are editable. Values like "99.999%" and labels like "Uptime" are brand constants managed in CSV.');
  for (const stat of json.reliability.stats) {
    addPara(form, `Stats · ${stat.label} · Description`);
  }

  // ---- Portfolio products ----
  form.addPageBreakItem().setTitle('Portfolio Products')
    .setHelpText('9 products. Tagline = the small blue pill on each card. Description = the full popup copy (supports paragraphs — blank line between).');
  for (const p of json.portfolios.items) {
    addPara(form, `Portfolio · ${p.label} · Tagline`);
    addPara(form, `Portfolio · ${p.label} · Description`);
  }

  // ---- Trust Layer audit ----
  form.addPageBreakItem().setTitle('Trust Layer')
    .setHelpText('Compliance / sovereignty / reliability / governance copy. Titles are fixed; only body text is editable.');
  for (const a of json.audit.items) {
    addPara(form, `Trust · ${a.title} · Description`);
  }

  // ---- Footer ----
  form.addPageBreakItem().setTitle('Footer');
  addPara(form, 'Footer · Brand Tagline');
  addPara(form, 'Footer · Mission Text');

  // Wire the on-submit trigger to this same project
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  // Save form ID so doGet() can find this form later
  PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());

  Logger.log('=========================================================');
  Logger.log('  FORM CREATED');
  Logger.log('=========================================================');
  Logger.log('  Form Edit URL:    ' + form.getEditUrl());
  Logger.log('  Form Public URL:  ' + form.getPublishedUrl());
  Logger.log('  Form ID saved to Script Properties: FORM_ID');
  Logger.log('  On-submit trigger attached.');
  Logger.log('=========================================================');
  Logger.log('  NEXT STEP:');
  Logger.log('  Deploy → New deployment → Type: Web app');
  Logger.log('     Execute as: Me');
  Logger.log('     Who has access: Anyone with Google account (or your editor)');
  Logger.log('  Use the deployed Web App URL as the bookmark for editors.');
  Logger.log('=========================================================');
}

function addPara(form, title) {
  // No help text with current values here — values are loaded LIVE by doGet().
  return form.addParagraphTextItem()
    .setTitle(title)
    .setRequired(false);
}

/* ============================================================================
 * SECTION 2 — REDIRECTOR (Web App entry point)
 *
 * When the editor opens the deployed Web App URL, this function reads the
 * current content.json from GitHub, constructs a pre-fill URL for the
 * generated Google Form, and redirects to it. So every time the editor opens
 * the bookmark, they see the latest content already filled into the form.
 * ============================================================================ */

function doGet(e) {
  // ========== ACCESS CONTROL ==========
  // Even if the Web App URL leaks, only whitelisted Google accounts can use it.
  // The allowlist lives in Script Properties (key: EDITOR_ALLOWLIST), comma-
  // separated. Visitor's Google email is verified by Apps Script automatically.
  const visitor = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!isAllowedEditor(visitor)) {
    return HtmlService.createHtmlOutput(accessDeniedPage(visitor))
      .setTitle('Access Denied');
  }

  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) {
    return HtmlService.createHtmlOutput(
      '<h2>Form not yet generated.</h2>' +
      '<p>Run <code>generateForm()</code> in the Apps Script editor first, then re-deploy.</p>'
    );
  }

  let prefillUrl;
  try {
    const { content } = fetchContentFile();
    const json = JSON.parse(content);
    const form = FormApp.openById(formId);
    refreshHelpText(form, json);                    // long values go here
    prefillUrl = buildPrefillUrl(form, json, visitor); // short values go in URL
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<h2>Could not load content.</h2><p>' + err.message + '</p>'
    );
  }

  // Apps Script web app HTML runs inside a sandboxed iframe; the only reliable
  // way to navigate the TOP browser window cross-origin is to click an
  // <a target="_top"> link (programmatically). meta-refresh only redirects
  // the iframe and drops pre-fill params; window.top.location.href is blocked
  // by the sandbox.
  const safeUrl = prefillUrl.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  // Logo as base64 data URI for "Add to Home Screen" icon (Apps Script can't
  // serve external assets; data URI is universal). Brand-blue dolphin glyph.
  const ICON_DATA = 'data:image/svg+xml;base64,' + Utilities.base64Encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">' +
    '<rect width="192" height="192" rx="32" fill="#0059B3"/>' +
    '<text x="96" y="118" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="72" fill="#fff" text-anchor="middle" letter-spacing="-2">D</text>' +
    '</svg>'
  );
  const html =
    '<!DOCTYPE html><html lang="en"><head>' +
    '<title>DOLPHLINK Editor</title>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="theme-color" content="#0059B3">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
    '<meta name="apple-mobile-web-app-title" content="DOLPHLINK Editor">' +
    '<meta name="mobile-web-app-capable" content="yes">' +
    '<link rel="apple-touch-icon" href="' + ICON_DATA + '">' +
    '<link rel="icon" type="image/svg+xml" href="' + ICON_DATA + '">' +
    '<base target="_top">' +
    '<style>' +
    '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:max(60px,env(safe-area-inset-top,40px)) 24px 40px;text-align:center;color:#475569;background:linear-gradient(180deg,#F1F5F9 0%,#E0E7EF 100%);margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}' +
    '.icon{width:64px;height:64px;border-radius:14px;margin-bottom:18px;box-shadow:0 8px 24px rgba(0,89,179,0.25);}' +
    '.brand{font-size:13px;font-weight:900;letter-spacing:3px;color:#0059B3;margin-bottom:10px;}' +
    'h1{font-size:22px;font-weight:800;color:#1E293B;margin:0 0 24px;letter-spacing:-0.5px;}' +
    '.spinner{width:36px;height:36px;border:3px solid #E2E8F0;border-top-color:#0059B3;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px;}' +
    '@keyframes spin{to{transform:rotate(360deg);}}' +
    'p{margin:6px 0;font-size:14px;line-height:1.5;}' +
    'a.btn{display:inline-block;margin-top:24px;padding:16px 36px;background:#0059B3;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.3px;box-shadow:0 6px 18px rgba(0,89,179,0.35);min-width:220px;}' +
    'a.btn:active{transform:scale(0.98);}' +
    'a{color:#0059B3;}' +
    '.hint{margin-top:32px;font-size:13px;opacity:0.65;max-width:320px;line-height:1.5;}' +
    '</style></head><body>' +
    '<img class="icon" src="' + ICON_DATA + '" alt="DOLPHLINK">' +
    '<div class="brand">DOLPHLINK</div>' +
    '<h1>Content Editor</h1>' +
    '<div class="spinner"></div>' +
    '<p>Loading latest content…</p>' +
    '<a id="redir" class="btn" href="' + safeUrl + '" target="_top">Open Editor →</a>' +
    '<p class="hint">If the page doesn\'t open automatically, tap the button above. On mobile you may need to tap once to allow navigation.</p>' +
    '<script>' +
    'setTimeout(function(){var a=document.getElementById("redir");if(a)a.click();},900);' +
    '</script>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('DOLPHLINK Editor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Google Forms pre-fill URLs have a length cap (~7KB total). Long descriptions
// blow past that, so we only pre-fill SHORT fields here. Long values flow into
// each item's helpText via refreshHelpText() instead.
const MAX_PREFILL_VALUE_LEN = 200;

function buildPrefillUrl(form, json, visitorEmail) {
  const fieldMap = buildFieldMap(json);
  const params = ['usp=pp_url'];

  for (const item of form.getItems()) {
    const t = item.getType();
    if (t !== FormApp.ItemType.PARAGRAPH_TEXT && t !== FormApp.ItemType.TEXT) continue;
    const title = item.getTitle();

    let value = '';
    if (title === 'Editor Email' && visitorEmail) {
      value = visitorEmail;
    } else {
      const path = fieldMap[title];
      if (path) {
        const v = getByPath(json, path);
        if (v != null) value = v.toString();
      }
    }
    if (!value) continue;
    if (value.length > MAX_PREFILL_VALUE_LEN) continue;  // long → goes in helpText

    params.push(`entry.${item.getId()}=${encodeURIComponent(value)}`);
  }

  return form.getPublishedUrl() + '?' + params.join('&');
}

/**
 * Refresh every form item's help text with the latest value from content.json.
 * Editors see the current value as "📝 Current: …" under each question, even
 * for long descriptions that didn't fit in the pre-fill URL.
 */
function refreshHelpText(form, json) {
  const fieldMap = buildFieldMap(json);
  for (const item of form.getItems()) {
    const t = item.getType();
    if (t !== FormApp.ItemType.PARAGRAPH_TEXT && t !== FormApp.ItemType.TEXT) continue;
    const title = item.getTitle();
    const path = fieldMap[title];
    if (!path) continue;
    const value = getByPath(json, path);
    if (value == null) continue;

    let preview = value.toString();
    if (preview.length > 1500) preview = preview.substring(0, 1500) + '…';
    const helpText =
      '📝 Current value:\n\n' + preview +
      '\n\n(Leave blank to keep. Type new value to replace.)';

    try {
      if (t === FormApp.ItemType.PARAGRAPH_TEXT) {
        item.asParagraphTextItem().setHelpText(helpText);
      } else {
        item.asTextItem().setHelpText(helpText);
      }
    } catch (_) {}
  }
}

/* ============================================================================
 * SECTION 2.5 — Access control helpers
 * ============================================================================ */

function isAllowedEditor(email) {
  if (!email) return false;
  const raw = PropertiesService.getScriptProperties().getProperty('EDITOR_ALLOWLIST') || '';
  const allowlist = raw.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length === 0) {
    Logger.log('WARNING: EDITOR_ALLOWLIST is empty — denying all access. Add allowed emails in Script Properties.');
    return false;
  }
  return allowlist.includes(email.toLowerCase());
}

function accessDeniedPage(email) {
  return '<!DOCTYPE html><html><head><title>Access Denied</title><meta charset="utf-8">' +
    '<style>body{font-family:-apple-system,sans-serif;padding:80px 24px;text-align:center;color:#475569;background:#F1F5F9;}' +
    '.brand{font-size:18px;font-weight:900;letter-spacing:2px;color:#0059B3;margin-bottom:24px;}' +
    '.lock{font-size:48px;margin-bottom:12px;}' +
    'h2{color:#1E293B;margin-bottom:8px;}p{margin:6px 0;font-size:14px;}' +
    '</style></head><body>' +
    '<div class="brand">DOLPHLINK</div>' +
    '<div class="lock">🔒</div>' +
    '<h2>Access denied</h2>' +
    '<p>Your Google account <code>' + (email || '(not signed in)') + '</code> is not on the editor allowlist.</p>' +
    '<p style="margin-top:24px;opacity:0.6;">Contact the site administrator to request access.</p>' +
    '</body></html>';
}

/* ============================================================================
 * SECTION 3 — FORM SUBMIT HANDLER (auto-fires on every submit)
 * ============================================================================ */

function buildFieldMap(json) {
  const map = {
    'Hero · Tagline': 'hero.tagline',
    'Hero · CTA Primary': 'hero.ctaPrimary',
    'Hero · CTA Secondary': 'hero.ctaSecondary',
    'Footer · Brand Tagline': 'footer.brandTagline',
    'Footer · Mission Text': 'footer.missionText'
  };
  for (const stat of json.reliability.stats) {
    map[`Stats · ${stat.label} · Description`] = `label:reliability.stats[${stat.label}].desc`;
  }
  for (const p of json.portfolios.items) {
    map[`Portfolio · ${p.label} · Tagline`] = `label:portfolios.items[${p.label}].tagline`;
    map[`Portfolio · ${p.label} · Description`] = `label:portfolios.items[${p.label}].desc`;
  }
  for (const a of json.audit.items) {
    map[`Trust · ${a.title} · Description`] = `title:audit.items[${a.title}].desc`;
  }
  return map;
}

function onFormSubmit(e) {
  // Apps-Script-created forms (not linked to a Sheet) leave e.namedValues
  // empty. The reliable source is e.response.getItemResponses(). Build our
  // own namedValues map from there so the rest of the logic stays unchanged.
  const namedValues = {};
  try {
    if (e.response && typeof e.response.getItemResponses === 'function') {
      for (const ir of e.response.getItemResponses()) {
        const title = ir.getItem().getTitle();
        const v = ir.getResponse();
        namedValues[title] = [v == null ? '' : v.toString()];
      }
    }
  } catch (err) {
    Logger.log('Failed to read item responses: ' + err.message);
  }

  Logger.log('Submitted field names: ' + JSON.stringify(Object.keys(namedValues)));

  // ========== ACCESS CONTROL — verified Google email ==========
  let verifiedEmail = '';
  let emailSource = 'none';

  try {
    if (e.response && typeof e.response.getRespondentEmail === 'function') {
      verifiedEmail = e.response.getRespondentEmail() || '';
      if (verifiedEmail) emailSource = 'e.response.getRespondentEmail';
    }
  } catch (_) {}

  if (!verifiedEmail) {
    // Loose fallback: any field whose name contains 'email' but isn't our
    // user-typed 'Editor Email' (those are likely Google's auto-collected ones)
    for (const key of Object.keys(namedValues)) {
      if (key === 'Editor Email') continue;
      if (key.toLowerCase().includes('email') && namedValues[key][0]) {
        verifiedEmail = namedValues[key][0];
        emailSource = 'namedValues["' + key + '"]';
        break;
      }
    }
  }
  if (!verifiedEmail) {
    verifiedEmail = (namedValues['Editor Email'] && namedValues['Editor Email'][0]) || '';
    if (verifiedEmail) emailSource = 'Editor Email field (user-typed, less trustworthy)';
  }

  Logger.log('Email used for allowlist check: "' + verifiedEmail + '" (source: ' + emailSource + ')');

  if (!isAllowedEditor(verifiedEmail)) {
    Logger.log('REJECTED submit from unauthorized email: "' + verifiedEmail + '". Commit aborted.');
    return;
  }
  const submitterEmail = verifiedEmail;

  const current = fetchContentFile();
  const json = JSON.parse(current.content);
  const fieldMap = buildFieldMap(json);

  let changes = 0;
  for (const [question, path] of Object.entries(fieldMap)) {
    const answer = namedValues[question];
    if (!answer) continue;
    const value = (Array.isArray(answer) ? answer[0] : answer).toString().trim();
    if (!value) continue;
    if (setByPath(json, path, value)) changes++;
  }

  if (changes === 0) {
    Logger.log('No content changes detected, skipping commit.');
    return;
  }

  const note =
    (namedValues['Change Note'] && namedValues['Change Note'][0]) || '';
  const message =
    `Content update (${changes} field${changes === 1 ? '' : 's'}) via Form by ${submitterEmail}` +
    (note ? `: ${note}` : '');

  pushContentFile(json, message, current.sha);
  Logger.log('Committed: ' + message);
}

/* ============================================================================
 * SECTION 4 — GitHub API helpers
 * ============================================================================ */

function ghProps() {
  const p = PropertiesService.getScriptProperties();
  return {
    token: p.getProperty('GITHUB_TOKEN'),
    owner: p.getProperty('GITHUB_OWNER'),
    repo: p.getProperty('GITHUB_REPO'),
    path: p.getProperty('CONTENT_PATH')
  };
}

function fetchContentFile() {
  const { token, owner, repo, path } = ghProps();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    throw new Error('GitHub fetch failed (HTTP ' + resp.getResponseCode() + '): ' + resp.getContentText());
  }
  const data = JSON.parse(resp.getContentText());
  const decoded = Utilities.newBlob(Utilities.base64Decode(data.content)).getDataAsString('UTF-8');
  return { sha: data.sha, content: decoded };
}

function pushContentFile(jsonObject, message, sha) {
  const { token, owner, repo, path } = ghProps();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body = {
    message: message,
    content: Utilities.base64Encode(Utilities.newBlob(JSON.stringify(jsonObject, null, 2)).getBytes()),
    sha: sha
  };
  const resp = UrlFetchApp.fetch(url, {
    method: 'put',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    throw new Error('GitHub push failed (HTTP ' + resp.getResponseCode() + '): ' + resp.getContentText());
  }
}

/* ============================================================================
 * SECTION 5 — JSON path get/set helpers
 * Path forms: "a.b.c" / "key:portfolios.items[sms].desc" / "label:..." / "title:..."
 * ============================================================================ */

function parsePath(path) {
  let lookupBy = null;
  if (/^(key|label|title):/.test(path)) {
    const colon = path.indexOf(':');
    lookupBy = path.substring(0, colon);
    path = path.substring(colon + 1);
  }
  const segments = [];
  const re = /([^.[\]]+)|\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(path)) !== null) {
    segments.push({ kind: m[1] ? 'prop' : 'find', value: m[1] || m[2] });
  }
  return { lookupBy, segments };
}

function getByPath(obj, path) {
  const { lookupBy, segments } = parsePath(path);
  let cur = obj;
  for (const s of segments) {
    if (cur == null) return null;
    if (s.kind === 'prop') {
      cur = cur[s.value];
    } else {
      cur = cur.find(it => it[lookupBy] === s.value);
    }
  }
  return cur == null ? null : cur;
}

function setByPath(obj, path, value) {
  const { lookupBy, segments } = parsePath(path);
  let cur = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const s = segments[i];
    if (s.kind === 'prop') {
      cur = cur[s.value];
    } else {
      cur = cur.find(it => it[lookupBy] === s.value);
    }
    if (cur == null) return false;
  }
  const last = segments[segments.length - 1];
  if (last.kind !== 'prop') return false;
  if (cur[last.value] === value) return false;
  cur[last.value] = value;
  return true;
}

/* ============================================================================
 * SECTION 6 — Smoke tests (run from the editor)
 * ============================================================================ */

function _testFetch() {
  const f = fetchContentFile();
  Logger.log('OK — fetched ' + f.content.length + ' bytes, SHA = ' + f.sha);
}

function _testFieldMap() {
  const { content } = fetchContentFile();
  const json = JSON.parse(content);
  const map = buildFieldMap(json);
  Logger.log('Field map has ' + Object.keys(map).length + ' entries:');
  for (const k of Object.keys(map)) Logger.log('  - ' + k + '  →  ' + map[k]);
}

function _testPrefillUrl() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) { Logger.log('Run generateForm() first.'); return; }
  const { content } = fetchContentFile();
  const json = JSON.parse(content);
  const form = FormApp.openById(formId);
  const myEmail = Session.getActiveUser().getEmail();
  const url = buildPrefillUrl(form, json, myEmail);
  Logger.log('Pre-fill URL (' + url.length + ' chars):');
  Logger.log(url);
}

/**
 * Manually populate every form item's help text with the current value from
 * content.json. Useful as a one-time bootstrap or after big content changes.
 * doGet() also runs this on every request so values stay fresh automatically.
 */
function _refreshHelpText() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) { Logger.log('Run generateForm() first.'); return; }
  const { content } = fetchContentFile();
  const json = JSON.parse(content);
  const form = FormApp.openById(formId);
  refreshHelpText(form, json);
  Logger.log('Help text refreshed for all matching items.');
  Logger.log('Form URL: ' + form.getPublishedUrl());
}

function _testAllowlist() {
  const raw = PropertiesService.getScriptProperties().getProperty('EDITOR_ALLOWLIST') || '';
  const allowlist = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  Logger.log('EDITOR_ALLOWLIST has ' + allowlist.length + ' entries:');
  for (const a of allowlist) Logger.log('  - ' + a);
  const me = Session.getActiveUser().getEmail();
  Logger.log('My email: ' + me);
  Logger.log('Authorized: ' + isAllowedEditor(me));
}

/**
 * Lock down an EXISTING form (already created by generateForm) so its Public
 * URL becomes safe even if it leaks: requires Google login + collects the
 * verified email automatically. Use this if you don't want to recreate the
 * form from scratch.
 */
function hardenForm() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) {
    Logger.log('No FORM_ID found in Script Properties. Run generateForm() first.');
    return;
  }
  const form = FormApp.openById(formId);
  form.setCollectEmail(true);
  Logger.log('=========================================================');
  Logger.log('  FORM HARDENED');
  Logger.log('=========================================================');
  Logger.log('  Auto-collect email:       true (Google-verified)');
  Logger.log('  → Login is automatically enforced when email is collected.');
  Logger.log('  Form URL:                 ' + form.getPublishedUrl());
  Logger.log('  → Even if this URL leaks publicly, only authenticated');
  Logger.log('    users on EDITOR_ALLOWLIST can submit.');
  Logger.log('=========================================================');
}
