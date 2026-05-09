/**
 * (Retired) Footer social-icon row renderer.
 *
 * The 3 social icons (LinkedIn / Email / Schedule) used to render into a
 * `.f-social-row` slot in the footer's bottom bar via `data-render`.
 * They were relocated INTO the Book-a-Briefing card — see
 * `modules/footer-card.js`'s `vcard-connect` block — so this file is no
 * longer imported by `home/index.js`.
 *
 * Kept as an empty stub for one cache cycle so service-worker installs
 * pinned to the prior build don't 404 on the old import path. Safe to
 * delete from disk after `dolphlink-v309+` has rotated to all clients.
 */
export function renderSocial() { /* no-op */ }
