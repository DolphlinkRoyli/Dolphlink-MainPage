/**
 * Departments We Empower — integrated tab + panel explorer. HOMEPAGE ONLY.
 *
 * Earlier rev had two disconnected pieces:
 *   - .persona-banner above (rotating quote + role attribution)
 *   - .departments-strip below (4 department cards)
 * Visitors couldn't tell which quote belonged to which department,
 * because the linkage was implicit (active dot on banner ↔ unrelated
 * card below).
 *
 * Now both live inside ONE component:
 *   - Tab strip (4 tabs, one per department)
 *   - Active panel below shows that department's persona quote +
 *     attribution + description, side-by-side, explicitly linked.
 * Auto-rotation, hover-pause, click-to-switch are wired up by
 * modules/dept-explorer.js after this renderer mounts the markup.
 */
import { escapeHtml } from '../utils.js';
import { getContent } from '../hydrate.js';

/* Persona-icon SVGs (same set as the old persona-banner — headset for
   support, megaphone for growth, server for ops, blueprint for
   innovation).  brand-blue stroke via currentColor. */
const PERSONA_ICONS = {
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 13a8 8 0 0 1 16 0v3"/>
    <rect x="2.5" y="13" width="4.5" height="6.5" rx="1.5"/>
    <rect x="17" y="13" width="4.5" height="6.5" rx="1.5"/>
    <path d="M19.25 19.5a3 3 0 0 1-3 2.5h-2"/>
  </svg>`,
  growth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11l16-6v14L3 13z"/>
    <path d="M7 13v5"/>
    <path d="M19 8.5v7"/>
  </svg>`,
  ops: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="6.5" rx="1.2"/>
    <rect x="3.5" y="14" width="17" height="6.5" rx="1.2"/>
    <circle cx="7.5" cy="6.75" r="0.75" fill="currentColor"/>
    <circle cx="7.5" cy="17.25" r="0.75" fill="currentColor"/>
    <path d="M11 6.75h6"/><path d="M11 17.25h6"/>
  </svg>`,
  innovation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.2"/>
    <path d="M9 3.5v17"/><path d="M3.5 9h17"/><path d="M14 9v11.5"/>
  </svg>`,
};

export function renderDepartments(container, items) {
  if (!Array.isArray(items)) return;
  const content = getContent();
  const personas = (content && content.departments && content.departments.personas) || {};

  const tabs = items.map((d, i) => {
    const active = i === 0;
    return `
      <button type="button"
              class="dept-tab${active ? ' is-active' : ''}"
              data-dept="${escapeHtml(d.key)}"
              data-tab-index="${i}"
              role="tab"
              aria-selected="${active}">
        <span class="dept-tab-icon" aria-hidden="true">${PERSONA_ICONS[d.key] || ''}</span>
        <span class="dept-tab-name">${escapeHtml(d.name)}</span>
      </button>`;
  }).join('');

  const panels = items.map((d, i) => {
    const persona = personas[d.key] || {};
    const active = i === 0;
    return `
      <div class="dept-panel${active ? ' is-active' : ''}"
           data-dept="${escapeHtml(d.key)}"
           role="tabpanel">
        <div class="dept-panel-quote-wrap">
          <span class="dept-panel-quote-mark" aria-hidden="true">“</span>
          <blockquote class="dept-panel-quote">${escapeHtml(persona.quote || '')}</blockquote>
          <cite class="dept-panel-attr">${escapeHtml(persona.attr || '')}</cite>
        </div>
        <hr class="dept-panel-divider" aria-hidden="true">
        <p class="dept-panel-desc">${escapeHtml(d.desc)}</p>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="dept-tabs" role="tablist" aria-label="Department selector">${tabs}</div>
    <div class="dept-panels">${panels}</div>`;
}
