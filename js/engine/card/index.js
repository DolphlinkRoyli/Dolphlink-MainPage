/* ============================================================================
 * DOLPHLINK Digital Card — page module for /c/?u=<localpart>
 *
 * Scope: CARD PAGE ONLY. Runs when <html data-page="card">.
 *
 * URL format:
 *   /c/?u=<localpart>     e.g. /c/?u=roygto2013
 *   /c/?u=<email>         e.g. /c/?u=joycetsam@dolphlink.com
 *
 * Data source: ../content/cards.json (members + company + config) — fetched
 * relative to the *page* (c/index.html), not this script.
 *
 * Page shows:
 *   1. Wordmark name + italic title (no avatar — letterhead style)
 *   2. Designed name-card image (member.cardImage on Drive)
 *   3. Three actions: Save Contact / Copy Link / Share with Friends
 *
 * Helpers shared with the homepage live in ../core/. Anything below is
 * card-page-specific glue: URL parsing, DOM rendering, action wiring.
 * ========================================================================== */
import { hideLoader }       from '../core/loader-shell.js';
import { driveID,
         driveViewURL,
         driveImgURL }       from '../core/drive.js';
import { initialsOf }        from '../core/strings.js';
import { downloadVCard }     from '../core/vcard.js';
import { copyToClipboard,
         shareOrCopy }       from '../core/clipboard.js';

/* Safety auto-hide is registered inside core/loader-shell.js — importing
   it here is enough to schedule the timer; we don't need a duplicate. */

const $ = (id) => document.getElementById(id);
const text = (el, value) => { if (el) el.textContent = value; };

// URL parsing — supports /c/?u=local AND /c/?u=full@email.com
function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('u') || params.get('user') || '').trim().toLowerCase();
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

function renderHero(member, company) {
  text($('m-name'), member.name || '');
  text($('m-title'), member.title || '');

  const metaBits = [];
  if (company && company.shortName) metaBits.push(company.shortName);
  if (member.department) metaBits.push(member.department);
  text($('m-meta'), metaBits.join(' · '));

  /* Optional avatar disc (only if those nodes exist in the HTML) */
  const img = $('avatar-img');
  const init = $('avatar-initials');
  if (img && init) {
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
}

function renderCardImage(member) {
  if (!member.cardImage) return;
  const wrap = $('card-image-wrap');
  const link = $('card-image-link');
  const img  = $('card-image');
  link.href = driveViewURL(member.cardImage);
  img.src = driveImgURL(member.cardImage);
  img.alt = (member.name || 'DOLPHLINK') + ' designed name card';
  /* If lh3 fails, fall back to Drive thumbnail; if that also fails, hide. */
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

function wireActions(member, company) {
  $('act-save').addEventListener('click', () => {
    downloadVCard(member, company);
    showToast('Contact downloaded');
  });

  $('act-copy').addEventListener('click', async () => {
    const ok = await copyToClipboard(window.location.href);
    showToast(ok ? 'Link copied' : 'Copy failed');
  });

  $('act-share').addEventListener('click', async () => {
    const result = await shareOrCopy({
      title: (member.name || 'DOLPHLINK') + ' — Digital Card',
      text:  (member.name || '') + ', ' + (member.title || 'DOLPHLINK'),
      url:   window.location.href
    });
    if (result === 'copied') showToast('Link copied — paste anywhere to share');
    else if (result === 'failed') showToast('Sharing not supported');
    /* 'shared' → native sheet handled it, no toast needed */
  });
}

// Hydrate <head> for nicer share previews
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
  const card = $('card');
  if (card) card.hidden = true;
  if (msg) text($('error-msg'), msg);
  $('error-state').hidden = false;
  hideLoader();
}

/**
 * Default export — invoked by ../dispatch.js when <html data-page="card">.
 */
export default async function setupCardPage() {
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

  $('card').hidden = false;
  $('card-shell').setAttribute('aria-busy', 'false');
  hideLoader();
}
