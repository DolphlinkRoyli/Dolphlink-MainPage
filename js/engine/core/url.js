/**
 * URL safety helpers — narrower than home/utils.js's `safeUrl`, which
 * also accepts mailto/tel/sms/relative paths. This file only validates
 * "is this an http(s):// URL?" — the right test for places where we
 * expect a remote resource (Drive image, LinkedIn profile, etc.).
 *
 * Scope: SHARED CORE.
 *
 * Why both: home/utils.js is HOMEPAGE-only and broader (accepts every
 * scheme that may flow from content.json into <a href>). drive.js + the
 * inline-card flow in home/register.js need the strict variant — they
 * concatenate user-controlled URLs into href= attributes that are about
 * to be CLICKED. A `javascript:` URL slipping through there would
 * execute on click. This validator blocks anything that isn't http(s).
 */

/**
 * Returns the input URL if it's safely loadable as a remote resource
 * (https:// or http://), else returns ''. Strips zero-width / control
 * characters that browsers tolerate before scheme parsing — those have
 * been used to slip past naive prefix checks (e.g. "java\tscript:").
 */
export function safeHttpUrl(u) {
  if (typeof u !== 'string') return '';
  /* Trim + drop control chars (incl. tab, newline, NULs) before testing. */
  const cleaned = u.trim().replace(/[\s\x00-\x1f\x7f]/g, '');
  if (!cleaned) return '';
  /* Anchor-style match — scheme must start the string after cleaning. */
  return /^https?:\/\//i.test(cleaned) ? u.trim() : '';
}
