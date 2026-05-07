/**
 * Shared "SVG-or-webp" icon HTML builder. Used by stats and portfolio
 * renderers — they need the same fallback path:
 *
 *   1. Inline SVG (when SVG_ICON_BUILDERS[name] exists) — preferred.
 *   2. webp asset at media/icon/3D/<name>.webp — only when `name`
 *      passes safeIconName(). Without that guard a poisoned
 *      content.json could traverse out of the icon directory via
 *      "../" segments.
 *
 * `baseClass` is the per-section class prefix ("stat-icon",
 * "portfolio-icon"). The SVG variant gets "<baseClass> <baseClass>-svg"
 * so CSS can style the inline-SVG flavour separately from the img.
 */
import { safeIconName } from '../utils.js';
import { SVG_ICON_BUILDERS } from '../icons/svg-builders.js';

export function iconHTML(name, size, baseClass) {
  const builder = SVG_ICON_BUILDERS[name];
  if (builder) return builder(size, baseClass + ' ' + baseClass + '-svg');
  const safe = safeIconName(name);
  if (!safe) return '';
  return `<img src="media/icon/3D/${safe}.webp" alt="" class="${baseClass}" width="${size}" height="${size}" loading="lazy" decoding="async" />`;
}
