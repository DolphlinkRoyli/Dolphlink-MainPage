/**
 * vCard 3.0 composer — escapes payload, emits valid VCARD blocks,
 * and triggers .vcf downloads.
 *
 * Scope: SHARED CORE. Imported by:
 *   - card/index.js     (Save Contact button — full vCard with cardImage,
 *                        company address, LinkedIn URL)
 *   - home/register.js  (QR contents fallback when no cardImage exists —
 *                        a leaner vCard with just the contact basics)
 */
import { driveViewURL } from './drive.js';

/**
 * RFC 6350 escape — backslash, newline, comma, semicolon are all
 * meaningful inside a vCard property value, so we backslash-escape them.
 */
export function escapeVCard(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Build the vCard "N:" structured-name field from a free-form display
 * name. Last token is treated as family name; everything before is the
 * given names. Empty input returns the canonical empty form ";;;;".
 */
export function splitLastFirst(full) {
  if (!full) return ';;;;';
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return parts[0] + ';;;;';
  const last = parts.pop();
  return last + ';' + parts.join(' ') + ';;;';
}

/**
 * Full vCard — every contact field we know about, including the
 * designed name-card image as a typed URL and the company address.
 * Used by the public /card/?u=… page's "Save Contact" button.
 */
export function buildFullVCard(member, company) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + escapeVCard(member.name || ''),
    'N:' + splitLastFirst(member.name),
    member.title ? 'TITLE:' + escapeVCard(member.title) : '',
    company && company.name ? 'ORG:' + escapeVCard(company.name) : '',
    member.department ? 'NOTE:' + escapeVCard(member.department) : '',
    member.phone ? 'TEL;TYPE=CELL,VOICE:' + member.phone.replace(/\s+/g, '') : '',
    member.email ? 'EMAIL;TYPE=WORK,INTERNET:' + member.email : '',
    member.linkedin ? 'URL;TYPE=LinkedIn:' + member.linkedin : '',
    member.cardImage ? 'URL;TYPE=Card:' + driveViewURL(member.cardImage) : '',
    company && company.url ? 'URL;TYPE=Company:' + company.url : '',
    company && company.address ? 'ADR;TYPE=WORK:;;' + escapeVCard(company.address) + ';;;;' : '',
    'END:VCARD'
  ];
  return lines.filter(Boolean).join('\r\n');
}

/**
 * Lean vCard — just the basics, plus a single landing-page URL. Used
 * as the QR-payload fallback when a member has no `cardImage` to point
 * at. Smaller payload = denser QR = scannable on cheap phone cameras.
 *
 * `companyName` is passed in (rather than read from a global) so this
 * helper stays caller-agnostic.
 */
export function buildLeanVCard(member, cardURL, companyName) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + escapeVCard(member.name || ''),
    'N:' + splitLastFirst(member.name),
    member.title ? 'TITLE:' + escapeVCard(member.title) : '',
    'ORG:' + escapeVCard(companyName || 'DOLPHLINK'),
    member.phone ? 'TEL;TYPE=WORK,VOICE:' + member.phone : '',
    member.email ? 'EMAIL;TYPE=WORK:' + member.email : '',
    cardURL ? 'URL:' + cardURL : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
}

/**
 * Trigger a .vcf file download using a transient blob URL. The browser
 * presents the standard "Add to Contacts" dialog on iOS/Android.
 *
 * Filename is derived from member.name (alphanumeric only) so the
 * download lands as Joyce_Tsam.vcf, not "vcard.vcf".
 */
export function downloadVCard(member, company) {
  const vcard = buildFullVCard(member, company);
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (member.name || 'contact').replace(/[^A-Za-z0-9]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName + '.vcf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
