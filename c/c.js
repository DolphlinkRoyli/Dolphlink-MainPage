/* ============================================================================
 * DOLPHLINK Digital Card — Landing Page Logic (simplified)
 *
 * URL format:
 *   /c/?u=<localpart>     e.g. /c/?u=roygto2013
 *   /c/?u=<email>         e.g. /c/?u=joycetsam@dolphlink.com
 *
 * Data source: ../content/cards.json (members + company + config)
 *
 * Page shows:
 *   1. Avatar (initials or photo URL) + name + title
 *   2. Designed name-card image (member.cardImage on Drive)
 *   3. Three actions: Save to Contacts / Copy Link / Share
 *
 * No external deps. No tracking.
 * ========================================================================== */
(function () {
 'use strict';

 const $ = (id) => document.getElementById(id);
 const text = (el, value) => { if (el) el.textContent = value; };

 // ----------------------------------------------------------------------------
 // URL parsing — supports /c/?u=local AND /c/?u=full@email.com
 // ----------------------------------------------------------------------------
 function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('u') || params.get('user') || '').trim().toLowerCase();
 }

 // ----------------------------------------------------------------------------
 // Drive URL helpers
 // ----------------------------------------------------------------------------
 function driveID(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&]+)/);
  return m ? m[1] : '';
 }
 function driveViewURL(url) {
  const id = driveID(url);
  return id ? 'https://drive.google.com/file/d/' + id + '/view' : url || '';
 }
 // Embed-friendly URL — lh3.googleusercontent.com bypasses Drive's "open in
 // app" interstitial and serves the raw image as <img src>.
 function driveImgURL(url) {
  const id = driveID(url);
  return id
   ? 'https://lh3.googleusercontent.com/d/' + id + '=w1600'
   : url || '';
 }

 // ----------------------------------------------------------------------------
 // vCard composer + .vcf download
 // ----------------------------------------------------------------------------
 function escVCard(s) {
  return String(s || '')
   .replace(/\\/g, '\\\\')
   .replace(/\r?\n/g, '\\n')
   .replace(/,/g, '\\,')
   .replace(/;/g, '\\;');
 }
 function nameParts(full) {
  if (!full) return ';;;;';
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return parts[0] + ';;;;';
  const last = parts.pop();
  return last + ';' + parts.join(' ') + ';;;';
 }
 function buildVCard(member, company) {
  const lines = [
   'BEGIN:VCARD',
   'VERSION:3.0',
   'FN:' + escVCard(member.name || ''),
   'N:' + nameParts(member.name),
   member.title ? 'TITLE:' + escVCard(member.title) : '',
   company && company.name ? 'ORG:' + escVCard(company.name) : '',
   member.department ? 'NOTE:' + escVCard(member.department) : '',
   member.phone ? 'TEL;TYPE=CELL,VOICE:' + member.phone.replace(/\s+/g, '') : '',
   member.email ? 'EMAIL;TYPE=WORK,INTERNET:' + member.email : '',
   member.linkedin ? 'URL;TYPE=LinkedIn:' + member.linkedin : '',
   member.cardImage ? 'URL;TYPE=Card:' + driveViewURL(member.cardImage) : '',
   company && company.url ? 'URL;TYPE=Company:' + company.url : '',
   company && company.address ? 'ADR;TYPE=WORK:;;' + escVCard(company.address) + ';;;;' : '',
   'END:VCARD'
  ];
  return lines.filter(Boolean).join('\r\n');
 }
 function downloadVCard(member, company) {
  const vcard = buildVCard(member, company);
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (member.name || 'contact').replace(/[^A-Za-z0-9]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName + '.vcf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
 }

 // ----------------------------------------------------------------------------
 // Other helpers
 // ----------------------------------------------------------------------------
 function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
 }
 function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
   toast = document.createElement('div');
   toast.className = 'toast';
   document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
 }

 // ----------------------------------------------------------------------------
 // Renderers
 // ----------------------------------------------------------------------------
 function renderHero(member, company) {
  text($('m-name'), member.name || '');
  text($('m-title'), member.title || '');

  const metaBits = [];
  if (company && company.shortName) metaBits.push(company.shortName);
  if (member.department) metaBits.push(member.department);
  text($('m-meta'), metaBits.join(' · '));

  const img = $('avatar-img');
  const init = $('avatar-initials');
  if (member.photo) {
   img.src = member.photo;
   img.alt = member.name + ' portrait';
   img.hidden = false;
   init.hidden = true;
  } else {
   img.hidden = true;
   init.hidden = false;
   text(init, initialsOf(member.name));
  }
 }

 function renderCardImage(member) {
  if (!member.cardImage) return;
  const wrap = $('card-image-wrap');
  const link = $('card-image-link');
  const img  = $('card-image');
  link.href = driveViewURL(member.cardImage);
  img.src = driveImgURL(member.cardImage);
  img.alt = (member.name || 'DOLPHLINK') + ' designed name card';
  // If lh3 fails, fall back to Drive thumbnail; if that also fails, hide.
  img.onerror = function () {
   const id = driveID(member.cardImage);
   if (id && img.src.indexOf('thumbnail') === -1) {
    img.src = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600';
   } else {
    wrap.hidden = true;
   }
  };
  wrap.hidden = false;
 }

 // ----------------------------------------------------------------------------
 // Action wiring
 // ----------------------------------------------------------------------------
 function wireActions(member, company) {
  // Save to Contacts
  $('act-save').addEventListener('click', () => {
   downloadVCard(member, company);
   showToast('Contact downloaded');
  });

  // Copy Link — copies the current page URL (the landing URL recipients
  // already have, so they can pass it on)
  $('act-copy').addEventListener('click', async () => {
   const url = window.location.href;
   try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied');
   } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('Link copied'); }
    catch (_) { showToast('Copy failed'); }
    document.body.removeChild(ta);
   }
  });

  // Share — Web Share API on mobile, fallback to copy
  $('act-share').addEventListener('click', async () => {
   const url = window.location.href;
   const title = (member.name || 'DOLPHLINK') + ' — Digital Card';
   const data = {
    title: title,
    text: (member.name || '') + ', ' + (member.title || 'DOLPHLINK'),
    url: url
   };
   if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (e) { if (e && e.name === 'AbortError') return; /* user cancelled */ }
   }
   // Fallback: copy
   try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied — paste anywhere to share');
   } catch (_) {
    showToast('Sharing not supported');
   }
  });
 }

 // ----------------------------------------------------------------------------
 // Hydrate <head> for nicer share previews
 // ----------------------------------------------------------------------------
 function hydrateHead(member, company) {
  const titleStr = (member.name || 'Digital Card') + ' — ' + (company.shortName || 'DOLPHLINK');
  document.title = titleStr;
  setMeta('description', (member.title || '') + ' · ' + (company.name || 'DOLPHLINK'));
  setMeta('og:title', titleStr, true);
  setMeta('og:description', (member.title || '') + ' · ' + (company.name || 'DOLPHLINK'), true);
  if (member.cardImage) setMeta('og:image', driveImgURL(member.cardImage), true);
 }
 function setMeta(name, content, isOG) {
  const sel = isOG ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
  let el = document.querySelector(sel);
  if (!el) {
   el = document.createElement('meta');
   if (isOG) el.setAttribute('property', name);
   else el.setAttribute('name', name);
   document.head.appendChild(el);
  }
  el.setAttribute('content', content);
 }

 // ----------------------------------------------------------------------------
 // Boot
 // ----------------------------------------------------------------------------
 function findMember(cards, query) {
  if (!query) return null;
  const wanted = query.toLowerCase();
  return (cards.members || []).find((m) => {
   if (m.active === false) return false;
   const full = String(m.email || '').toLowerCase();
   if (full === wanted) return true;
   if (full.split('@')[0] === wanted.split('@')[0]) return true;
   return false;
  }) || null;
 }
 function renderError(msg) {
  $('skeleton').hidden = true;
  const card = $('card');
  if (card) card.hidden = true;
  if (msg) text($('error-msg'), msg);
  $('error-state').hidden = false;
 }

 (async function main() {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const query = readQuery();
  if (!query) {
   renderError('No card identifier. Try /c/?u=<your-name>.');
   return;
  }

  let cards;
  try {
   const r = await fetch('../content/cards.json', { cache: 'no-cache' });
   if (!r.ok) throw new Error('HTTP ' + r.status);
   cards = await r.json();
  } catch (e) {
   console.error('[card] data fetch failed', e);
   renderError('Could not load card data. Please try again later.');
   return;
  }

  const member = findMember(cards, query);
  if (!member) {
   renderError('No card found for "' + query + '". The link may be outdated.');
   return;
  }

  const company = cards.company || {};
  hydrateHead(member, company);
  renderHero(member, company);
  renderCardImage(member);
  wireActions(member, company);

  $('skeleton').hidden = true;
  $('card').hidden = false;
  $('card-shell').setAttribute('aria-busy', 'false');
 })();

})();
