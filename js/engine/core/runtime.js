/**
 * DOLPHLINK Runtime — the framework's central nervous system
 * ============================================================================
 * Provides everything a page or plugin needs to attach itself to the engine
 * without modifying central code:
 *
 *   dlpk.events    — pub/sub bus (`emit`, `on`, `off`)
 *   dlpk.plugins   — declarative plugin registry
 *   dlpk.sections  — section lifecycle (mount, unmount, lang-change)
 *   dlpk.perf      — performance marks visible in DevTools
 *   dlpk.errorBoundary — wrap functions so one crash doesn't break the page
 *   dlpk.config    — feature flags + variant resolution
 *
 * USAGE FROM ANY PAGE MODULE:
 *
 *   import { dlpk } from '../core/runtime.js';
 *
 *   // Register a section (lifecycle hooks)
 *   dlpk.sections.register('hero', {
 *     onMount(el)        { ... },
 *     onLangChange(lang) { ... },
 *     onUnmount()        { ... },
 *   });
 *
 *   // Emit / listen to events across the app
 *   dlpk.events.emit('cart:item-added', { sku: 'x' });
 *   dlpk.events.on('cart:item-added', ev => { ... });
 *
 *   // Wrap a flaky function
 *   const safeFn = dlpk.errorBoundary(maybeFlaky, 'hero-render');
 * ============================================================================
 */

// -------- 1. Event bus -------------------------------------------------------
const _listeners = Object.create(null);

const events = {
  emit(name, detail) {
    const list = _listeners[name];
    if (!list) return;
    for (const fn of list.slice()) {
      try { fn({ type: name, detail }); }
      catch (err) { console.error(`[dlpk:events] listener for "${name}" threw:`, err); }
    }
    /* Bridge to native CustomEvent so DOM-based handlers also see it. */
    try { document.dispatchEvent(new CustomEvent(`dlpk:${name}`, { detail })); }
    catch (_) {}
  },
  on(name, fn) {
    (_listeners[name] = _listeners[name] || []).push(fn);
    return () => events.off(name, fn);  // returned unsubscribe function
  },
  off(name, fn) {
    const list = _listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  },
  once(name, fn) {
    const unsub = events.on(name, ev => { unsub(); fn(ev); });
    return unsub;
  },
};

// -------- 2. Section registry + lifecycle -----------------------------------
const _sections = new Map();   // name → { hooks, state, el }

const sections = {
  /** Register a section with optional onMount/onLangChange/onUnmount hooks. */
  register(name, hooks) {
    if (_sections.has(name)) {
      console.warn(`[dlpk:sections] overwriting existing section "${name}"`);
    }
    _sections.set(name, { hooks: hooks || {}, state: 'idle', el: null });
  },
  /** Manually mount a registered section (auto-mount handles most cases). */
  async mount(name, el) {
    const entry = _sections.get(name);
    if (!entry) {
      console.warn(`[dlpk:sections] unknown section "${name}"`);
      return;
    }
    if (entry.state === 'mounted') return;
    entry.el = el;
    entry.state = 'mounting';
    try {
      perf.mark(`section:${name}:start`);
      if (typeof entry.hooks.onMount === 'function') {
        await entry.hooks.onMount(el);
      }
      entry.state = 'mounted';
      perf.measure(`section:${name}`, `section:${name}:start`);
      events.emit('section:ready', { name, el });
    } catch (err) {
      entry.state = 'error';
      console.error(`[dlpk:sections] "${name}" onMount failed:`, err);
      events.emit('section:error', { name, error: err });
    }
  },
  /** Notify a single section that the language changed. */
  notifyLangChange(name, lang) {
    const entry = _sections.get(name);
    if (!entry || entry.state !== 'mounted') return;
    if (typeof entry.hooks.onLangChange === 'function') {
      try { entry.hooks.onLangChange(lang); }
      catch (err) { console.error(`[dlpk:sections] "${name}" onLangChange failed:`, err); }
    }
  },
  /** Notify ALL mounted sections. Called by i18n.js after lang switch. */
  broadcastLangChange(lang) {
    for (const name of _sections.keys()) sections.notifyLangChange(name, lang);
  },
  unmount(name) {
    const entry = _sections.get(name);
    if (!entry || entry.state !== 'mounted') return;
    if (typeof entry.hooks.onUnmount === 'function') {
      try { entry.hooks.onUnmount(); }
      catch (err) { console.error(`[dlpk:sections] "${name}" onUnmount failed:`, err); }
    }
    entry.state = 'unmounted';
  },
  list() { return Array.from(_sections.keys()); },
  state(name) { return _sections.get(name)?.state || 'unknown'; },
};

// -------- 3. Plugin registry -------------------------------------------------
const _plugins = [];

const plugins = {
  /** Register a plugin. Plugin is `{ name, install(dlpk) }`. */
  register(plugin) {
    if (!plugin || typeof plugin.install !== 'function') {
      throw new Error('[dlpk:plugins] plugin must have .install(dlpk) method');
    }
    _plugins.push(plugin);
    try { plugin.install(api); }
    catch (err) { console.error(`[dlpk:plugins] "${plugin.name || '?'}" install failed:`, err); }
  },
  list() { return _plugins.map(p => p.name || '(anonymous)'); },
};

// -------- 4. Performance instrumentation -------------------------------------
const perf = {
  mark(name) {
    try { performance.mark(name); }
    catch (_) {}
  },
  measure(label, startMark, endMark) {
    try {
      if (endMark) performance.measure(label, startMark, endMark);
      else performance.measure(label, startMark);
    } catch (_) {}
  },
  /** Time an async function. Logs to console + Performance API. */
  async time(label, fn) {
    const start = performance.now();
    perf.mark(`${label}:start`);
    try {
      const result = await fn();
      perf.measure(label, `${label}:start`);
      const ms = (performance.now() - start).toFixed(1);
      if (config.flag('debug.perf')) console.log(`[perf] ${label}: ${ms}ms`);
      return result;
    } catch (err) {
      perf.measure(`${label}:error`, `${label}:start`);
      throw err;
    }
  },
};

// -------- 5. Error boundary --------------------------------------------------
function errorBoundary(fn, label) {
  return function boundedFn(...args) {
    try {
      const result = fn.apply(this, args);
      if (result && typeof result.catch === 'function') {
        return result.catch(err => {
          console.error(`[dlpk:err] ${label}:`, err);
          events.emit('error', { label, error: err });
        });
      }
      return result;
    } catch (err) {
      console.error(`[dlpk:err] ${label}:`, err);
      events.emit('error', { label, error: err });
      return undefined;
    }
  };
}

// -------- 6. Feature flags / variant ----------------------------------------
const _flags = new Map();

const config = {
  /** Read from URL ?flag.name=1 → localStorage 'dlpk:flag:name' → false default. */
  flag(name) {
    if (_flags.has(name)) return _flags.get(name);
    let val = false;
    try {
      const params = new URLSearchParams(location.search);
      if (params.has(`flag.${name}`)) val = params.get(`flag.${name}`) === '1';
      else val = localStorage.getItem(`dlpk:flag:${name}`) === '1';
    } catch (_) {}
    _flags.set(name, val);
    return val;
  },
  set(name, val) {
    _flags.set(name, !!val);
    try { localStorage.setItem(`dlpk:flag:${name}`, val ? '1' : '0'); } catch (_) {}
  },
  /** Active A/B variant — first letter from ?variant= or 'a'. */
  variant() {
    try {
      const v = new URLSearchParams(location.search).get('variant');
      if (v) return v.toLowerCase();
      const stored = localStorage.getItem('dlpk:variant');
      if (stored) return stored;
    } catch (_) {}
    return 'a';
  },
};

// -------- 7. Public API ------------------------------------------------------
/* Production build: no console debugger, no window namespace. The runtime
   is module-internal — pages import { dlpk } where they need it. Removing
   the global exposure also removes an attack surface (third-party scripts
   can't poke at the runtime if it's not on window). */
export const api = {
  events,
  sections,
  plugins,
  perf,
  errorBoundary,
  config,
};

export const dlpk = api;
export default api;
