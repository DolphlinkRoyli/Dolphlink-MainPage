/**
 * Pre-read loader removal — shared by every page that boots over a
 * #dlpk-loader splash element (home + card today).
 *
 * Scope: SHARED CORE. Imported from per-page index files when they need
 * to fade out the boot splash after first paint.
 *
 * SME page does not include a #dlpk-loader element, so it never imports
 * this module — that's fine, the function no-ops if the element is absent.
 */
export function hideLoader() {
  const loader = document.getElementById('dlpk-loader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
    setTimeout(() => loader.parentNode && loader.parentNode.removeChild(loader), 600);
  }
}

// Safety auto-hide — never leave the user staring at a spinner.
// Fires once at module load. Subsequent imports hit the same module
// instance (ES modules are singletons) so the timer doesn't multiply.
setTimeout(hideLoader, 5000);
