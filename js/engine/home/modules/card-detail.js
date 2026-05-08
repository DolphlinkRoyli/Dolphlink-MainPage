/**
 * Card detail panel — opens an inline expanded view when the user
 * clicks a stat card or a portfolio card. HOMEPAGE ONLY.
 */
import { escapeHtml, safeIconName } from '../utils.js';
import { SVG_ICON_BUILDERS } from '../icons/svg-builders.js';

export function bindCardDetail(stripSelector, panelId, cardSelector) {
  const strip = document.querySelector(stripSelector);
  const panel = document.getElementById(panelId);
  if (!strip || !panel) return;
  const wrap = strip.parentElement;
  const pIcon = panel.querySelector('.card-detail-icon');
  const pEyebrow = panel.querySelector('.card-detail-eyebrow');
  const pTitle = panel.querySelector('.card-detail-title');
  const pText = panel.querySelector('.card-detail-text');
  const closeBtn = panel.querySelector('.card-detail-close');
  let activeCard = null;
  let closeTimer = null;
  let canHoverClose = false;

  function positionPanel(card) {
    const isMobile = window.innerWidth <= 640;
    panel.classList.toggle('is-mobile', isMobile);
    const wrapRect = wrap.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const originX = cardRect.left - wrapRect.left + cardRect.width / 2;
    panel.style.setProperty('--origin-x', `${originX}px`);
  }

  function openPanel(card) {
    const icon = card.dataset.modalIcon || '';
    const oldSvg = panel.querySelector('.card-detail-icon-svg');
    if (oldSvg) oldSvg.remove();
    if (icon && SVG_ICON_BUILDERS[icon]) {
      pIcon.style.display = 'none';
      pIcon.parentElement.insertAdjacentHTML(
        'beforeend',
        SVG_ICON_BUILDERS[icon](104, 'card-detail-icon card-detail-icon-svg')
      );
    } else if (icon) {
      /* Pipe through safeIconName before concatenating into a path —
         a poisoned content.json with `icon: "../../etc/passwd"` would
         otherwise traverse out of /media/icon/3D/. Same defence as
         render/stats.js + render/portfolio.js use via iconHTML(). */
      const safe = safeIconName(icon);
      if (safe) {
        pIcon.src = `media/icon/3D/${safe}.webp`;
        pIcon.style.display = 'block';
      } else {
        pIcon.style.display = 'none';
      }
    } else {
      pIcon.style.display = 'none';
    }
    const eyebrow = card.dataset.modalEyebrow || '';
    pEyebrow.textContent = eyebrow;
    pEyebrow.style.display = eyebrow ? 'block' : 'none';
    pTitle.textContent = card.dataset.modalTitle || '';
    const paragraphs = (card.dataset.modalText || '').split(/\n{2,}/);
    pText.innerHTML = paragraphs
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');

    positionPanel(card);
    panel.classList.add('open');
    /* Variant flag — stat-strip eyebrow is the metric value (99.999%
       etc.) and renders as a hero number; portfolio eyebrow is a
       tagline and stays compact. CSS targets these via the modifier. */
    const isStat = /\bstat-card\b/.test(cardSelector);
    panel.classList.toggle('card-detail--stat', isStat);
    panel.classList.toggle('card-detail--portfolio', !isStat);

    strip.querySelectorAll(cardSelector).forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeCard = card;

    const section = wrap.closest('.section-row') || wrap;
    const navStr = getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-height').trim();
    const navH = parseInt(navStr, 10) || 72;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const rect = section.getBoundingClientRect();
          const targetY = Math.max(0, window.scrollY + rect.top - navH - 12);
          try {
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          } catch (_) {
            window.scrollTo(0, targetY);
          }
        }, 80);
      });
    });

    canHoverClose = false;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { canHoverClose = true; }, 600);
  }

  function closePanel() {
    panel.classList.remove('open');
    strip.querySelectorAll(cardSelector).forEach(c => c.classList.remove('active'));
    activeCard = null;
    canHoverClose = false;
  }

  /* Event delegation — bind ONCE on the strip parent, find the clicked
     card via closest(). The strip itself survives the language-switch
     re-render (because hydrateForLang only replaces the strip's
     children via innerHTML, not the strip element itself), so this
     listener keeps working forever. Without delegation, every freshly-
     rendered card would have lost its click handler the moment the
     visitor picked a non-default language. */
  strip.addEventListener('click', (ev) => {
    const card = ev.target.closest(cardSelector);
    if (!card || !strip.contains(card)) return;
    if (activeCard === card) closePanel();
    else openPanel(card);
  });
  /* When the language picker fires a re-hydrate, the previously-active
     card is destroyed mid-flight. Close the panel first so the visitor
     doesn't see a stale icon + caption. */
  document.addEventListener('dlpk:lang-change', () => {
    if (panel.classList.contains('open')) closePanel();
  });
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('mouseleave', () => {
    if (canHoverClose && panel.classList.contains('open')) closePanel();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
  });
  bindCardDetail._activeRepositioners = bindCardDetail._activeRepositioners || [];
  bindCardDetail._activeRepositioners.push(() => {
    if (activeCard) positionPanel(activeCard);
  });
}

/* Single shared resize listener */
window.addEventListener('resize', () => {
  if (bindCardDetail._activeRepositioners) {
    bindCardDetail._activeRepositioners.forEach(fn => fn());
  }
});
