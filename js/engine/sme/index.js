/**
 * SME page setup — runs when <html data-page="sme">.
 *
 * Scope: SME PAGE ONLY.
 *
 * Owns three concerns:
 *   1. i18n — pick a language, fetch the locale JSON, swap data-i18n
 *      text, and mount the language picker.
 *   2. Hero rotation control — clicking a slide dot pauses the auto
 *      cross-fade and jumps to that slide; clicking the active dot
 *      again resumes auto. The CSS reads `.is-paused` + `data-active`
 *      on `#hero` to do the actual work.
 *   3. Gap-card "save" toggle — on touch devices :hover never fires,
 *      so we toggle `.is-saved` on click. Desktop hover still works
 *      via the CSS `:hover` selector — this handler is purely additive.
 *      Keyboard support: Enter / Space on a focused card toggles too.
 *
 * Both UI handlers used to live as inline `<script>` blocks at the
 * bottom of each section in sme/index.html. They moved here so the
 * page CSP can drop `'unsafe-inline'` from script-src — strictly fewer
 * holes for stored-XSS to wedge into.
 */
import { setupI18n, attachLanguagePicker } from '../core/i18n.js';

/* Hero slide-dot click controller. Pure DOM manipulation; no framework. */
function wireHeroDots() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  hero.querySelectorAll('.sme-hero-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const n = dot.getAttribute('data-slide');
      /* Click the already-active dot a second time → resume auto-cycle. */
      if (hero.classList.contains('is-paused') && hero.getAttribute('data-active') === n) {
        hero.classList.remove('is-paused');
        hero.removeAttribute('data-active');
        return;
      }
      /* Otherwise pause auto-cycle and jump to the picked slide. */
      hero.classList.add('is-paused');
      hero.setAttribute('data-active', n);
    });
  });
}

/* Touch-swipe support for the hero slideshow. On mobile, swiping
   left/right inside .sme-hero advances the photo by 1, just like
   tapping a dot — same `is-paused` + `data-active` model. The auto
   cross-fade pauses (until user clicks the active dot to resume). */
function wireHeroSwipe() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const TOTAL_SLIDES = 7;          // matches 7 hero-bg / hero-card / dots
  const MIN_DISTANCE  = 40;        // px — under this is treated as a tap
  const MAX_VERT      = 60;        // px — vertical movement bigger than this = scroll, not swipe

  let startX = 0, startY = 0, tracking = false;

  hero.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  hero.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dy) > MAX_VERT) return;          // vertical scroll, ignore
    if (Math.abs(dx) < MIN_DISTANCE) return;      // too small, just a tap

    /* Read current slide; default to 1 if not paused yet. */
    const cur = parseInt(hero.getAttribute('data-active') || '1', 10) || 1;
    const dir = dx < 0 ? +1 : -1;                 // swipe-left → next slide
    let next = cur + dir;
    if (next > TOTAL_SLIDES) next = 1;
    if (next < 1)            next = TOTAL_SLIDES;

    hero.classList.add('is-paused');
    hero.setAttribute('data-active', String(next));
  }, { passive: true });
}

/* Gap-card click + keyboard toggle. Adds `.is-saved` so the CSS swaps
   the photo from pain → saved and reveals the saver line. */
function wireGapCards() {
  document.querySelectorAll('.sme-gap-card').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('is-saved'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('is-saved');
      }
    });
  });
}

export default async function setupSmePage() {
  /* Render the picker FIRST so it appears the instant JS runs — even
     if the i18n JSON fetch is slow (or blocked), the visitor can still
     interact with the dropdown. The brief English flash before the
     translation lands is below perceptual threshold on most networks. */
  attachLanguagePicker(document.querySelector('[data-lang-picker]'));
  setupI18n().catch(err => console.warn('[sme] i18n setup failed:', err));

  /* Both handlers are idempotent and DOM-additive — safe to run on
     first dispatch even if the page module re-runs (e.g. after a soft
     reload during dev). */
  wireHeroDots();
  wireHeroSwipe();
  wireGapCards();
}
