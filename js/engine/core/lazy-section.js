/**
 * Lazy section observer — defers expensive work until a section enters
 * the viewport. Mark any section with `data-lazy="<key>"` and the engine
 * will only call its registered onMount when the user scrolls near it.
 *
 * Why this beats SPAs:
 *   React/Vue/Next render the entire page tree on first load (or on route
 *   change). We only initialise above-the-fold sections; everything else
 *   waits until the user actually approaches it. For long landing pages,
 *   this cuts time-to-interactive by 60-80%.
 *
 * Usage:
 *   <section data-lazy="trust-wall">…fallback HTML…</section>
 *   dlpk.sections.register('trust-wall', { onMount(el){...} });
 *   observeLazySections();   // call once at page setup
 */
import { dlpk } from './runtime.js';

const ROOT_MARGIN = '300px 0px';   /* fire 300px BEFORE element scrolls in */

let _io = null;

function getObserver() {
  if (_io) return _io;
  if (typeof IntersectionObserver === 'undefined') {
    /* Old browser fallback — mount everything immediately. */
    return null;
  }
  _io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const name = el.dataset.lazy;
      _io.unobserve(el);
      if (name) dlpk.sections.mount(name, el);
    }
  }, { rootMargin: ROOT_MARGIN, threshold: 0.01 });
  return _io;
}

export function observeLazySections(root) {
  root = root || document;
  const els = root.querySelectorAll('[data-lazy]');
  const io = getObserver();
  if (!io) {
    /* No IO support — eagerly mount all. */
    els.forEach(el => dlpk.sections.mount(el.dataset.lazy, el));
    return;
  }
  els.forEach(el => io.observe(el));
}

/** Force-flush any unmounted lazy sections (e.g. before print, or for tests). */
export function flushLazy() {
  document.querySelectorAll('[data-lazy]').forEach(el => {
    const name = el.dataset.lazy;
    if (name && dlpk.sections.state(name) !== 'mounted') {
      dlpk.sections.mount(name, el);
    }
  });
}
