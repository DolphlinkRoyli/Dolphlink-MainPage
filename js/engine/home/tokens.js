/**
 * Date / placeholder token expansion.
 *
 * Scope: HOMEPAGE ONLY (consumed by ./hydrate.js).
 *
 * Supported tokens (anywhere in a string from content.json or HTML):
 *   {YYYY}            → 2026
 *   {MMM}             → MAY
 *   {Q}               → Q2
 *   {Q-MMM}           → Q2-MAY
 *   {MMM YYYY}        → MAY 2026
 *   {Q-MMM YYYY}      → Q2-MAY 2026
 *   {D MMM}           → 7 MAY
 *   {D MMM YYYY}      → 7 MAY 2026
 *
 * Lets content authors write "Last audited {Q-MMM YYYY}" and have
 * it auto-update without code changes.
 */

export const MONTHS_3 = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

export function expandDateTokens(s) {
  if (!s.includes('{')) return s;
  const now = new Date();
  const m = now.getMonth();
  const Q = 'Q' + (Math.floor(m / 3) + 1);
  const MMM = MONTHS_3[m];
  const YYYY = String(now.getFullYear());
  const D = String(now.getDate());
  return s
    .replace(/\{D MMM YYYY\}/g, `${D} ${MMM} ${YYYY}`)
    .replace(/\{D MMM\}/g, `${D} ${MMM}`)
    .replace(/\{Q-MMM YYYY\}/g, `${Q}-${MMM} ${YYYY}`)
    .replace(/\{Q-MMM\}/g, `${Q}-${MMM}`)
    .replace(/\{MMM YYYY\}/g, `${MMM} ${YYYY}`)
    .replace(/\{Q\}/g, Q)
    .replace(/\{MMM\}/g, MMM)
    .replace(/\{YYYY\}/g, YYYY);
}
