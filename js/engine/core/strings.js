/**
 * Generic string helpers — name initials, phone validators, etc.
 * Scope: SHARED CORE.
 */

/**
 * Two-letter initials from a name. Falls back to first two chars if
 * the name is a single token. Returns '?' for empty input.
 *
 * Used by:
 *   - card/index.js     (avatar disc when no member.photo)
 *   - home/register.js  (inline-card initials placeholder)
 */
export function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Phone number sanity check — filters out roster placeholders like
 * "+0", "0000 0000" so we don't render bogus tel: links.
 *
 * Currently used by home/register.js. Kept here in core because the
 * card page is a candidate consumer once it starts rendering phone
 * numbers (right now it only ships the vCard download).
 */
export function hasRealPhone(phone) {
  if (!phone) return false;
  if (/^\+?\s*0+(\s|$)/.test(phone)) return false;
  if (/0000\s*0000/.test(phone)) return false;
  return true;
}
