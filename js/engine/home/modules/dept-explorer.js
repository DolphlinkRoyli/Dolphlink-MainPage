/**
 * Department explorer — tab strip + active panel binding.
 * HOMEPAGE ONLY.
 *
 * Replaces the older persona-banner + departments-strip pair.  Now
 * both live in one card: 4 tabs at the top, 1 active panel below
 * showing that department's persona quote + attribution + description.
 *
 * Behaviour:
 *   - Auto-rotates every 5.5s once the component enters the viewport.
 *   - Hovering anywhere in the explorer pauses (resumes on leave).
 *   - Click any tab → jump to that department's panel + reset timer.
 *   - Respects prefers-reduced-motion (pins to first tab).
 *
 * IDEMPOTENT + RESILIENT TO RE-RENDERS — uses event delegation on the
 * container itself (not per-tab listeners), so when the language picker
 * re-renders the inner DOM via hydrateForLang, the click + hover
 * listeners survive (they're on the un-replaced container element).
 * State (active index, timer, paused flag) lives in a module-scope
 * WeakMap keyed by container.  Calling bindDeptExplorer twice on the
 * same container is safe — the second call is a no-op for listeners
 * (already attached) and just resyncs the DOM to the saved state.
 *
 * No dependencies — vanilla DOM only.
 */

const ROTATE_MS = 5500;
const STATE = new WeakMap();   /* container → {active, timer, paused} */

function setActive(container, idx) {
  const tabs = container.querySelectorAll('.dept-tab');
  const panels = container.querySelectorAll('.dept-panel');
  const n = tabs.length;
  if (!n || panels.length !== n) return;
  const a = ((idx % n) + n) % n;
  tabs.forEach((t, i) => {
    const on = i === a;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  panels.forEach((p, i) => p.classList.toggle('is-active', i === a));
  const s = STATE.get(container);
  if (s) s.active = a;
}

function startTimer(container) {
  const s = STATE.get(container);
  if (!s || s.timer || s.paused) return;
  s.timer = setInterval(() => {
    /* Re-query each tick — the inner DOM may have been replaced by a
       lang-change re-render since the last tick. */
    const tabs = container.querySelectorAll('.dept-tab');
    if (!tabs.length) { stopTimer(container); return; }
    setActive(container, s.active + 1);
  }, ROTATE_MS);
}

function stopTimer(container) {
  const s = STATE.get(container);
  if (!s || !s.timer) return;
  clearInterval(s.timer);
  s.timer = null;
}

export function bindDeptExplorer(container) {
  if (!container) return;
  let s = STATE.get(container);

  /* FIRST bind — install delegation listeners + init state.
     Subsequent calls (e.g. after a lang-change re-render) skip this
     block since the container is unchanged and listeners survived. */
  if (!s) {
    s = { active: 0, timer: null, paused: false };
    STATE.set(container, s);

    /* Click delegation — closest('.dept-tab') survives DOM rebuilds. */
    container.addEventListener('click', (e) => {
      const tab = e.target && e.target.closest && e.target.closest('.dept-tab');
      if (!tab || !container.contains(tab)) return;
      const idx = parseInt(tab.dataset.tabIndex, 10);
      if (Number.isNaN(idx)) return;
      setActive(container, idx);
      stopTimer(container);
      if (!s.paused) startTimer(container);
    });

    /* Pause auto-rotate while hovering anywhere in the explorer. */
    container.addEventListener('mouseenter', () => {
      s.paused = true;
      stopTimer(container);
    });
    container.addEventListener('mouseleave', () => {
      s.paused = false;
      startTimer(container);
    });

    /* Reduced-motion users see panel 0, no rotation. */
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive(container, 0);
      return;
    }

    /* Rotate only when on-screen — saves CPU when off-fold. */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) startTimer(container);
          else stopTimer(container);
        });
      }, { threshold: 0.35 });
      io.observe(container);
    } else {
      startTimer(container);
    }
  }

  /* Always resync the freshly-rendered DOM to a known state.  After a
     lang-change re-render the renderer emits the first tab/panel with
     `.is-active` already, but be defensive — explicitly activate the
     stored index (defaults to 0 on first bind, preserves user's last
     selection on subsequent re-binds). */
  setActive(container, s.active);
}
