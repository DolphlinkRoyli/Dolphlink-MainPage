/**
 * DOLPHLINK — single application entry point.
 * ============================================================================
 * EVERY page in the site loads this one file. No more per-page <script>
 * tags. The dispatcher reads <html data-page="…"> and lazy-imports the
 * matching page module from js/engine/<page>/.
 *
 *   <html data-page="home">  →  js/engine/home/index.js   (homepage)
 *   <html data-page="card">  →  js/engine/card/index.js   (/card/?u=…, legacy /c/ redirects)
 *   <html data-page="sme">   →  js/engine/sme/index.js    (/sme/)
 *
 * Why this shape:
 *   - One entry, one preload, one Service Worker target. No duplicate
 *     boot logic or pre-loader handling spread across separate scripts.
 *   - Each page only pays for the JS it uses (homepage doesn't load
 *     card-page code, card page doesn't load homepage renderers).
 *   - Adding a new page = mark <html data-page="x">, drop a
 *     pages/x.js with `export default`, register it in
 *     engine/dispatch.js. No new <script> tags anywhere.
 *
 * EVERY other JS file in the project lives under js/engine/. This file
 * is the only JS at the js/ root — the entry point HTML imports it
 * directly. Keeping app.js here (instead of inside engine/) means the
 * `<script src="js/app.js">` tag stays one path segment shorter, which
 * matters only for readability.
 * ============================================================================
 */
import { dispatch } from './engine/dispatch.js';

dispatch();
