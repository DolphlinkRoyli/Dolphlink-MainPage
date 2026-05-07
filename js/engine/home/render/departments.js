/**
 * Departments We Empower — 4 internal-team cards. HOMEPAGE ONLY.
 */
import { escapeHtml } from '../utils.js';

export function renderDepartments(container, items) {
  container.innerHTML = items.map(d => `
    <div class="department-card" data-department="${escapeHtml(d.key)}">
      <h3 class="department-name">${escapeHtml(d.name)}</h3>
      <p class="department-desc">${escapeHtml(d.desc)}</p>
    </div>
  `).join('');
}
