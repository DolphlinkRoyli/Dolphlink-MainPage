/**
 * Emergency-banner fallback — shown when content.json fetch fails AND
 * no Service Worker cache exists (e.g. first-ever visit on a dead
 * network). Without this the page would render blank since the SSR
 * fallback HTML was intentionally cleared.
 *
 * Scope: HOMEPAGE ONLY. The card and SME pages have their own
 * page-specific error states baked into their HTML.
 *
 * NOTE: hideLoader() lives in ../../core/loader-shell.js — it's
 * shared with the card page. Don't duplicate it here.
 */

export function showEmergencyBanner() {
  if (document.getElementById('dlpk-emergency')) return;
  const div = document.createElement('div');
  div.id = 'dlpk-emergency';
  div.style.cssText =
    'position:fixed;inset:0;z-index:9998;background:#FFFFFF;display:flex;' +
    'align-items:center;justify-content:center;flex-direction:column;gap:24px;' +
    "padding:32px;font-family:'Inter',system-ui,-apple-system,sans-serif;text-align:center;";
  div.innerHTML =
    '<div style="font-size:11px;font-weight:800;letter-spacing:4.5px;color:#0059B3;">DOLPHLINK</div>' +
    '<h1 style="font-size:20px;font-weight:700;color:#0F172A;margin:0;letter-spacing:.4px;">' +
    'We could not load this page</h1>' +
    '<p style="font-size:14px;color:#475569;max-width:380px;margin:0;line-height:1.6;">' +
    'Check your connection and reload, or reach us directly while we look into it.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">' +
    '<button type="button" id="dlpk-emergency-reload" style="' +
    "padding:12px 24px;background:#0059B3;color:#FFFFFF;border:none;border-radius:8px;" +
    "font-family:inherit;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;" +
    'cursor:pointer;">Reload</button>' +
    '<a href="mailto:Salesmarketing@dolphlink.com?cc=Joycetsam@dolphlink.com" style="' +
    "padding:12px 24px;background:#FFFFFF;color:#0059B3;border:1.5px solid #BF9430;border-radius:8px;" +
    "font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;" +
    '">Email Sales</a>' +
    '</div>';
  document.body.appendChild(div);
  const reloadBtn = document.getElementById('dlpk-emergency-reload');
  if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
}
