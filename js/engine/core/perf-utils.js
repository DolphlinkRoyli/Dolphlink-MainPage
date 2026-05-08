/**
 * Performance utility belt — small, sharp tools the engine + plugins use to
 * stay under the 16ms frame budget. None of these are framework-specific;
 * they're the same primitives high-perf libraries (Lodash, RxJS, React
 * Concurrent) use internally, written here in 1KB instead of imported as
 * a 30KB dependency.
 */

/* ---- 1. RAF-batched writer ------------------------------------------------
   Coalesces multiple DOM writes into a single requestAnimationFrame tick.
   Eliminates layout thrash when many independent callers want to mutate
   the DOM in the same JS task. */
const _rafQueue = [];
let _rafScheduled = false;
function flushRaf() {
  _rafScheduled = false;
  const q = _rafQueue.splice(0);
  for (let i = 0; i < q.length; i++) {
    try { q[i](); } catch (err) { console.error('[perf:raf]', err); }
  }
}
export function rafWrite(fn) {
  _rafQueue.push(fn);
  if (!_rafScheduled) {
    _rafScheduled = true;
    requestAnimationFrame(flushRaf);
  }
}

/* ---- 2. Idle scheduler ----------------------------------------------------
   For non-urgent work (analytics, prefetch warmup, telemetry batching).
   Falls back to setTimeout(0) on Safari < 18 where requestIdleCallback
   isn't available. */
export function whenIdle(fn, timeoutMs) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(fn, { timeout: timeoutMs || 2000 });
  }
  return setTimeout(fn, 1);
}

/* ---- 3. Debounce / throttle (1-line each) -------------------------------- */
export function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
export function throttle(fn, ms) {
  let last = 0, t = null;
  return function (...args) {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) { last = now; fn.apply(this, args); }
    else if (!t) {
      t = setTimeout(() => { last = Date.now(); t = null; fn.apply(this, args); }, wait);
    }
  };
}

/* ---- 4. Microtask queue --------------------------------------------------
   For sub-frame ordering. Enqueueing in microtasks runs BEFORE the next
   paint but AFTER the current task completes. */
export const nextTick = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

/* ---- 5. DOM batch (DocumentFragment helper) ------------------------------
   Wraps an mutation block in a DocumentFragment so multiple appendChild
   calls cause exactly one layout. */
export function domBatch(parent, fillFn) {
  const frag = document.createDocumentFragment();
  fillFn(frag);
  parent.appendChild(frag);
}

/* ---- 6. Lazy property -----------------------------------------------------
   Compute once, cache forever. Useful for expensive getter computations
   (parsing user agent, screen size buckets, feature detection). */
export function lazy(compute) {
  let cached, has = false;
  return () => {
    if (!has) { cached = compute(); has = true; }
    return cached;
  };
}

/* ---- 7. Memoize (single-arg) --------------------------------------------- */
export function memoize(fn) {
  const cache = new Map();
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const v = fn(key);
    cache.set(key, v);
    return v;
  };
}

/* ---- 8. Connection-aware --------------------------------------------------
   For prefetch / image quality decisions. Saves data on cellular. */
export const isSlowNetwork = lazy(() => {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '');
});

/* ---- 9. Prefers reduced motion ------------------------------------------- */
export const prefersReducedMotion = lazy(() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
});

/* ---- 10. Visibility hook --------------------------------------------------
   Pauses background work when tab is hidden, resumes on focus. Saves
   battery + frees CPU for whatever the user is actually looking at. */
export function onVisibilityChange(callback) {
  const handler = () => callback(!document.hidden);
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
