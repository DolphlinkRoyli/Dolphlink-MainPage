/**
 * In-page anchor scroller — used by [data-scroll-to] links and nav menu
 * items. HOMEPAGE ONLY.
 */
export function scrollToSec(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // Instant jump — no smooth animation. Sovereign register prefers
  // direct navigation over UX polish.
  const y = el.getBoundingClientRect().top + window.scrollY - 40;
  window.scrollTo(0, y);
}
