/**
 * DOLPHLINK chatbot widget
 * ============================================================================
 * Floating bubble bottom-right + slide-out panel. Backed by:
 *   • Cloudflare Worker /chat route (signed with HMAC)
 *   • Apps Script Web App that logs every turn to a Sheet
 *   • Anthropic Claude on the back-end
 *
 * Persona is defined server-side (system prompt). Front-end is just plumbing:
 *   - render bubble + panel
 *   - track session_id (uuid in localStorage)
 *   - keep last 20 turns of history in localStorage
 *   - sign each POST with HMAC-SHA256 (same key-rotation pattern as build form)
 *   - render assistant reply with a small typing animation
 *
 * Threat-model honesty: HMAC_KEY ships in this bundle. The HMAC layer stops
 * naive curl/bot abuse + replay attacks (5-min timestamp window). Determined
 * attackers who view-source can sign their own. For real protection pair with
 * Cloudflare's Rate Limiting rules (dashboard) + per-IP soft cap in Worker.
 * ============================================================================
 */

import { setupI18n } from '../core/i18n.js';

/* ─────────── CONFIG ─────────── */

const API_ENDPOINT = 'https://dolphlink-api.roygto2013.workers.dev/chat';
const HMAC_KEY_HEX = '1622471fb4dac5f814c691fc92300656';   // same key the build form uses; rotate in worker FORM_KEYS / CHAT_HMAC_KEYS

const STORAGE_KEY_SESSION = 'dolphlink_chat_session';
const STORAGE_KEY_HISTORY = 'dolphlink_chat_history';
const MAX_HISTORY_TURNS   = 20;
const MAX_USER_LEN        = 2000;

const LANG_GREETINGS = {
  en: { bubbleLabel: 'Chat with us',
        hi: "Welcome to DOLPHLINK. I can answer questions on our platform, compliance, and pricing.\n\nFor your privacy, please don't share confidential or sensitive information here. If you'd like our team to follow up, just leave your name + email and we'll reach out.",
        placeholder: 'Type a message…',
        send: 'SEND', talk: 'Email team', heading: 'Chat with DOLPHLINK',
        sub: 'We typically reply within seconds', sending: 'Typing',
        privacy: 'Please don\'t share secrets · we only keep contact info you choose to leave',
        footnote: 'AI-assisted · escalates to a person on request' },
  zh: { bubbleLabel: '在线咨询',
        hi: "欢迎来到 DOLPHLINK。我可以回答平台、合规、价格相关的问题。\n\n为了您的隐私，请不要在此分享机密或敏感信息。如果希望我们团队回访，只需留下您的姓名 + 邮箱，我们会主动联系。",
        placeholder: '请输入消息…',
        send: '发送', talk: '邮件联系团队', heading: '与 DOLPHLINK 对话',
        sub: '通常几秒内回复', sending: '正在输入',
        privacy: '请勿分享机密信息 · 我们仅保留您主动留下的联系方式',
        footnote: 'AI 辅助 · 复杂咨询将转接真人' },
  ja: { bubbleLabel: 'チャット',
        hi: "DOLPHLINK へようこそ。プラットフォーム、コンプライアンス、料金についてお答えします。\n\nプライバシー保護のため、機密情報や個人情報の共有はお控えください。担当者からの連絡をご希望の場合は、お名前とメールアドレスのみお残しいただければご連絡いたします。",
        placeholder: 'メッセージを入力…',
        send: '送信', talk: 'チームへメール', heading: 'DOLPHLINK と対話',
        sub: '通常数秒以内に返信', sending: '入力中',
        privacy: '機密情報はお控えください · 連絡先のみ保管します',
        footnote: 'AI 補助 · 複雑な案件は担当者へお繋ぎ' },
  es: { bubbleLabel: 'Chatear',
        hi: "Bienvenido a DOLPHLINK. Puedo responder preguntas sobre nuestra plataforma, cumplimiento y precios.\n\nPor su privacidad, no comparta información confidencial o sensible aquí. Si desea que nuestro equipo le contacte, deje su nombre y correo electrónico.",
        placeholder: 'Escriba un mensaje…',
        send: 'ENVIAR', talk: 'Email al equipo', heading: 'Chatear con DOLPHLINK',
        sub: 'Solemos responder en segundos', sending: 'Escribiendo',
        privacy: 'No comparta secretos · solo guardamos los datos de contacto que decida dejar',
        footnote: 'Asistencia IA · escalable a una persona si lo pide' },
  ms: { bubbleLabel: 'Sembang',
        hi: "Selamat datang ke DOLPHLINK. Saya boleh menjawab soalan platform, pematuhan, dan harga.\n\nUntuk privasi anda, sila jangan kongsi maklumat sulit atau sensitif di sini. Jika anda mahu pasukan kami menghubungi, sila tinggalkan nama + e-mel sahaja.",
        placeholder: 'Taip mesej…',
        send: 'HANTAR', talk: 'E-mel pasukan', heading: 'Sembang dengan DOLPHLINK',
        sub: 'Biasanya membalas dalam beberapa saat', sending: 'Sedang menaip',
        privacy: 'Jangan kongsi rahsia · kami hanya simpan maklumat hubungan anda',
        footnote: 'Bantuan AI · diserahkan kepada manusia atas permintaan' },
  hi: { bubbleLabel: 'चैट करें',
        hi: "DOLPHLINK में आपका स्वागत है। मैं प्लेटफ़ॉर्म, अनुपालन, और मूल्य निर्धारण पर प्रश्नों का उत्तर दे सकती हूं।\n\nआपकी गोपनीयता के लिए, कृपया यहां गोपनीय या संवेदनशील जानकारी साझा न करें। यदि आप हमारी टीम से संपर्क चाहते हैं, तो बस अपना नाम और ईमेल छोड़ दें।",
        placeholder: 'संदेश लिखें…',
        send: 'भेजें', talk: 'टीम को ईमेल', heading: 'DOLPHLINK से चैट',
        sub: 'आमतौर पर सेकंडों में जवाब', sending: 'लिख रही हूं',
        privacy: 'गुप्त जानकारी न दें · हम केवल आपके स्वैच्छिक संपर्क विवरण रखते हैं',
        footnote: 'AI सहायक · अनुरोध पर मानव को सौंप दिया जाता है' },
};

// Pure-text avatar — a single white "D" on the brand-blue. Faster to render
// than an image, never breaks on cache miss, sharp at every size.
const AVATAR_HTML = `<span class="dlc-avatar-letter">D</span>`;


/* ─────────── HMAC helpers (same shape as build form) ─────────── */

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return out;
}
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(keyHex, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', hexToBytes(keyHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return bufToHex(sig);
}

function uuid() {
  // RFC 4122 v4 — sufficient for session-id purposes
  if (crypto.randomUUID) return crypto.randomUUID();
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const h = Array.from(a).map(b => b.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
}


/* ─────────── State ─────────── */

let sessionId = null;
let history = [];     // [{ role: 'user'|'assistant', content: '...' }]
let turn = 0;
let lang = 'en';
let strings = LANG_GREETINGS.en;
let panelEl = null, msgsEl = null, inputEl = null, sendBtnEl = null;
let isSending = false;

function getLang() {
  // Match how the rest of the site picks language
  const fromHtml = document.documentElement.lang;
  if (fromHtml && LANG_GREETINGS[fromHtml]) return fromHtml;
  const fromQs = new URLSearchParams(location.search).get('lang');
  if (fromQs && LANG_GREETINGS[fromQs]) return fromQs;
  const fromStorage = localStorage.getItem('dolphlink_lang');
  if (fromStorage && LANG_GREETINGS[fromStorage]) return fromStorage;
  return 'en';
}

function loadSession() {
  sessionId = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!sessionId) {
    sessionId = uuid();
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    history = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];
  } catch (_) { history = []; }
  turn = history.length;
}

function saveSession() {
  // Cap history before saving
  while (history.length > MAX_HISTORY_TURNS * 2) history.shift();
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

function resetSession() {
  history = [];
  turn = 0;
  localStorage.removeItem(STORAGE_KEY_HISTORY);
  // Keep the session_id stable so logs can show "user came back"
  if (msgsEl) {
    msgsEl.innerHTML = '';
    appendAssistant(strings.hi);
  }
}


/* ─────────── DOM construction ─────────── */

function injectStyle() {
  if (document.getElementById('dolphlink-chat-style')) return;
  const css = `
/* ─── BUBBLE — pill-shaped "Chat with us" button, brand blue ─── */
.dlc-bubble {
  position: fixed; right: 22px; bottom: 22px; z-index: 9990;
  background: #0059B3;
  color: #fff; border: none;
  padding: 14px 22px; border-radius: 30px;
  display: flex; align-items: center; gap: 9px;
  font: 500 14px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.6px; cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,89,179,0.32);
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}
.dlc-bubble:hover {
  background: #003E80;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0,89,179,0.45);
}
.dlc-bubble.dlc-bubble--open { display: none; }
.dlc-bubble-icon { width: 18px; height: 18px; flex-shrink: 0; }
.dlc-bubble-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #4ade80; flex-shrink: 0;
  margin-left: 3px;
  box-shadow: 0 0 0 0 rgba(74,222,128,0.6);
  animation: dlc-online-pulse 2s ease-in-out infinite;
}
@keyframes dlc-online-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
  50%      { box-shadow: 0 0 0 6px rgba(74,222,128,0);   }
}

/* ─── PANEL ─── */
.dlc-panel {
  position: fixed; right: 22px; bottom: 22px; z-index: 9991;
  width: 400px; max-width: calc(100vw - 24px);
  height: 620px; max-height: calc(100vh - 32px);
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 24px 64px rgba(0,30,60,0.24), 0 0 0 1px rgba(0,0,0,0.06);
  display: none; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.dlc-privacy {
  background: #fff8e1; color: #8a6a2a;
  padding: 8px 14px; font-size: 11px; line-height: 1.4;
  border-bottom: 0.5px solid #f0e3c4;
  letter-spacing: 0.2px;
  text-align: center;
}
.dlc-privacy::before {
  content: '🔒'; margin-right: 5px; opacity: 0.9;
}
.dlc-panel.dlc-panel--open { display: flex; animation: dlc-slide-up 0.35s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes dlc-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.dlc-head {
  background: #0059B3;
  color: #fff;
  padding: 14px 16px;
  display: flex; align-items: center; gap: 11px;
  border-bottom: 2px solid #c9a96e;
}
.dlc-head-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #fff; flex-shrink: 0; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.dlc-head-avatar .dlc-avatar-letter {
  color: #0059B3; font-size: 16px; font-weight: 600; line-height: 1;
  letter-spacing: 0.5px;
}
.dlc-head-avatar::after {
  content: ''; position: absolute; bottom: 0; right: 0;
  width: 10px; height: 10px; border-radius: 50%;
  background: #4ade80; border: 2px solid #0059B3;
}
.dlc-head-text { flex: 1; min-width: 0; }
.dlc-head-text h3 {
  margin: 0; font-size: 14px; font-weight: 500; letter-spacing: 0.4px;
}
.dlc-head-text p {
  margin: 2px 0 0; font-size: 11px; color: rgba(255,255,255,0.85);
  display: flex; align-items: center; gap: 5px; letter-spacing: 0.2px;
}
.dlc-head-text p .dlc-online-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
}
.dlc-head-actions { display: flex; gap: 6px; flex-shrink: 0; }
.dlc-head-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.14);
  color: #fff; cursor: pointer; padding: 6px 9px; border-radius: 6px;
  font-size: 12px; line-height: 1; transition: background 0.15s;
}
.dlc-head-btn:hover { background: rgba(255,255,255,0.18); }
.dlc-head-close {
  background: transparent; border: none; color: rgba(255,255,255,0.85); cursor: pointer;
  width: 24px; height: 24px; padding: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; line-height: 1;
}
.dlc-head-close:hover { color: #fff; background: rgba(255,255,255,0.10); }

/* ─── MESSAGES ─── */
.dlc-msgs {
  flex: 1; overflow-y: auto; padding: 16px 14px 8px;
  background: #fafbfc;
}
.dlc-msg {
  margin-bottom: 14px; max-width: 92%;
  display: flex; gap: 8px; align-items: flex-end;
}
.dlc-msg-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: #0059B3;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.dlc-msg-avatar .dlc-avatar-letter {
  color: #fff; font-size: 11px; font-weight: 600; line-height: 1;
  letter-spacing: 0.3px;
}
.dlc-msg-bubble {
  padding: 9px 13px; border-radius: 8px;
  font-size: 13px; line-height: 1.55; white-space: pre-wrap;
  word-wrap: break-word;
}
.dlc-msg--user { margin-left: auto; flex-direction: row-reverse; }
.dlc-msg--user .dlc-msg-avatar { display: none; }
.dlc-msg--user .dlc-msg-bubble {
  background: #0059B3; color: #fff; border-bottom-right-radius: 2px;
}
.dlc-msg--assistant .dlc-msg-bubble {
  background: #f4f6f8; color: #0a2540;
  border-bottom-left-radius: 2px;
}
.dlc-msg--typing .dlc-msg-bubble {
  color: #8896a3; font-style: italic;
}
.dlc-msg--typing .dlc-msg-bubble::after {
  content: '…'; display: inline-block;
  animation: dlc-dots 1.2s steps(4) infinite;
}
@keyframes dlc-dots {
  0%   { content: ''; }
  25%  { content: '.'; }
  50%  { content: '..'; }
  75%  { content: '...'; }
}

.dlc-form {
  border-top: 0.5px solid #e8edf2; padding: 11px 12px;
  background: #fff;
  display: flex; gap: 8px; align-items: flex-end;
}
.dlc-input {
  flex: 1; resize: none;
  border: 0.5px solid #d6dde5; border-radius: 6px;
  padding: 8px 11px; font-size: 13px; line-height: 1.5;
  font-family: inherit; outline: none;
  max-height: 120px; min-height: 32px;
  transition: border-color 0.15s;
}
.dlc-input:focus { border-color: #0059B3; }
.dlc-send {
  background: #0059B3; color: #fff;
  border: none; border-radius: 6px;
  padding: 8px 16px; font-size: 12px; font-weight: 500;
  letter-spacing: 0.5px;
  cursor: pointer; white-space: nowrap;
  transition: background 0.15s;
}
.dlc-send:hover:not(:disabled) { background: #003E80; }
.dlc-send:disabled { background: #bcc6d0; cursor: not-allowed; }

.dlc-foot {
  padding: 7px 14px 9px; background: #f4f6f8;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: #5f6b7c;
  border-top: 0.5px solid #e8edf2;
  letter-spacing: 0.3px;
}
.dlc-foot a { color: #0059B3; text-decoration: none; font-weight: 500; }
.dlc-foot a:hover { text-decoration: underline; }

@media (max-width: 480px) {
  .dlc-panel { right: 8px; bottom: 8px; left: 8px; width: auto; height: 80vh; }
  .dlc-bubble { right: 14px; bottom: 14px; }
}
`;
  const style = document.createElement('style');
  style.id = 'dolphlink-chat-style';
  style.textContent = css;
  document.head.appendChild(style);
}

function buildBubble() {
  const el = document.createElement('button');
  el.className = 'dlc-bubble';
  el.setAttribute('aria-label', 'Chat with DOLPHLINK');
  el.innerHTML = `
    <svg class="dlc-bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span>${escapeHtml(strings.bubbleLabel)}</span>
    <span class="dlc-bubble-dot"></span>
  `;
  el.addEventListener('click', openPanel);
  return el;
}

function buildPanel() {
  const el = document.createElement('div');
  el.className = 'dlc-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Chat with DOLPHLINK');
  el.innerHTML = `
    <header class="dlc-head">
      <div class="dlc-head-avatar">${AVATAR_HTML}</div>
      <div class="dlc-head-text">
        <h3>${escapeHtml(strings.heading)}</h3>
        <p><span class="dlc-online-dot"></span>${escapeHtml(strings.sub)}</p>
      </div>
      <div class="dlc-head-actions">
        <button class="dlc-head-btn" data-action="reset" type="button" title="Reset">↻</button>
        <button class="dlc-head-close" data-action="close" type="button" aria-label="Close">×</button>
      </div>
    </header>
    <div class="dlc-privacy">${escapeHtml(strings.privacy)}</div>
    <div class="dlc-msgs" aria-live="polite"></div>
    <form class="dlc-form" autocomplete="off">
      <textarea class="dlc-input" rows="1" placeholder="${escapeHtml(strings.placeholder)}" maxlength="${MAX_USER_LEN}"></textarea>
      <button class="dlc-send" type="submit">${escapeHtml(strings.send)}</button>
    </form>
    <div class="dlc-foot">
      <span>${escapeHtml(strings.footnote)}</span>
      <a href="mailto:Salesmarketing@dolphlink.com">${escapeHtml(strings.talk)} →</a>
    </div>
  `;
  msgsEl   = el.querySelector('.dlc-msgs');
  inputEl  = el.querySelector('.dlc-input');
  sendBtnEl= el.querySelector('.dlc-send');

  el.querySelector('[data-action="close"]').addEventListener('click', closePanel);
  el.querySelector('[data-action="reset"]').addEventListener('click', () => {
    if (confirm('Reset this conversation?')) resetSession();
  });
  el.querySelector('.dlc-form').addEventListener('submit', onSubmit);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  });
  inputEl.addEventListener('input', autoGrow);

  return el;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}


/* ─────────── Open / close / messages ─────────── */

function openPanel() {
  document.querySelector('.dlc-bubble')?.classList.add('dlc-bubble--open');
  panelEl.classList.add('dlc-panel--open');

  // Render history if any
  if (history.length === 0) {
    appendAssistant(strings.hi);
  } else if (msgsEl.childElementCount === 0) {
    history.forEach(h => {
      if (h.role === 'user') appendUser(h.content, /* skipSave */ true);
      else                   appendAssistant(h.content, /* skipSave */ true);
    });
  }

  setTimeout(() => inputEl.focus(), 100);
}

function closePanel() {
  panelEl.classList.remove('dlc-panel--open');
  document.querySelector('.dlc-bubble')?.classList.remove('dlc-bubble--open');
}

function appendUser(text, skipSave) {
  const el = document.createElement('div');
  el.className = 'dlc-msg dlc-msg--user';
  el.innerHTML = `<div class="dlc-msg-bubble"></div>`;
  el.querySelector('.dlc-msg-bubble').textContent = text;
  msgsEl.appendChild(el);
  scrollToBottom();
  if (!skipSave) {
    history.push({ role: 'user', content: text });
    saveSession();
  }
}

function appendAssistant(text, skipSave) {
  const el = document.createElement('div');
  el.className = 'dlc-msg dlc-msg--assistant';
  el.innerHTML = `
    <div class="dlc-msg-avatar">${AVATAR_HTML}</div>
    <div class="dlc-msg-bubble"></div>
  `;
  el.querySelector('.dlc-msg-bubble').textContent = text;
  msgsEl.appendChild(el);
  scrollToBottom();
  if (!skipSave) {
    history.push({ role: 'assistant', content: text });
    saveSession();
  }
  return el;
}

function appendTyping() {
  const el = document.createElement('div');
  el.className = 'dlc-msg dlc-msg--assistant dlc-msg--typing';
  el.innerHTML = `
    <div class="dlc-msg-avatar">${AVATAR_HTML}</div>
    <div class="dlc-msg-bubble"></div>
  `;
  el.querySelector('.dlc-msg-bubble').textContent = strings.sending;
  msgsEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  msgsEl.scrollTop = msgsEl.scrollHeight;
}


/* ─────────── Submit ─────────── */

async function onSubmit(e) {
  e.preventDefault();
  if (isSending) return;

  const text = (inputEl.value || '').trim();
  if (!text || text.length > MAX_USER_LEN) return;

  isSending = true;
  sendBtnEl.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  appendUser(text);
  const typingEl = appendTyping();

  try {
    turn += 1;
    const payload = {
      session_id: sessionId,
      lang,
      turn,
      message: text,
      history: history.slice(0, -1).slice(-MAX_HISTORY_TURNS),  // exclude the just-added user msg
      page_url: location.href,
    };
    const ts = Date.now().toString();
    const rawBody = JSON.stringify(payload);
    const sig = await hmacHex(HMAC_KEY_HEX, `${ts}:${rawBody}`);

    const resp = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp':  ts,
        'X-Signature':  sig,
      },
      body: rawBody,
    });

    typingEl.remove();

    if (!resp.ok) {
      const reason = (await resp.json().catch(() => ({}))).error || ('http_' + resp.status);
      handleError(reason);
      return;
    }

    const result = await resp.json();
    if (!result.ok || !result.reply) {
      handleError(result.error || 'no_reply');
      return;
    }

    appendAssistant(result.reply);

  } catch (err) {
    console.warn('[chatbot] submit failed:', err);
    typingEl?.remove();
    handleError('network');
  } finally {
    isSending = false;
    sendBtnEl.disabled = false;
    inputEl.focus();
  }
}

function handleError(reason) {
  const fallback = lang === 'zh' ? '抱歉，暂时无法回复。请稍后再试，或直接邮件 Salesmarketing@dolphlink.com。'
                  : lang === 'ja' ? '申し訳ございません、ただいま応答できません。後ほどお試しいただくか Salesmarketing@dolphlink.com までメールでご連絡ください。'
                  : lang === 'es' ? 'Disculpe, no puedo responder en este momento. Inténtelo más tarde o escriba a Salesmarketing@dolphlink.com.'
                  : lang === 'ms' ? 'Maaf, tidak dapat menjawab buat masa ini. Sila cuba lagi nanti atau e-mel Salesmarketing@dolphlink.com.'
                  : lang === 'hi' ? 'क्षमा करें, अभी जवाब नहीं दे पा रही हूं। कृपया बाद में पुनः प्रयास करें या Salesmarketing@dolphlink.com पर ईमेल करें।'
                  : "Sorry, I can't reply right now. Please try again, or email Salesmarketing@dolphlink.com.";
  appendAssistant(fallback);
  console.warn('[chatbot] reason:', reason);
}


/* ─────────── Init ─────────── */

export default function setupChatbot() {
  // Don't load on legal pages, card pages, or build form (those have their own UX)
  const dataPage = document.documentElement.getAttribute('data-page') || '';
  if (['card', 'build', 'legal-privacy', 'legal-terms'].indexOf(dataPage) >= 0) return;

  lang = getLang();
  strings = LANG_GREETINGS[lang] || LANG_GREETINGS.en;

  loadSession();
  injectStyle();

  const bubble = buildBubble();
  panelEl = buildPanel();

  document.body.appendChild(bubble);
  document.body.appendChild(panelEl);

  // Re-init copy if language changes mid-session
  document.addEventListener('dolphlink-lang-change', () => {
    lang = getLang();
    strings = LANG_GREETINGS[lang] || LANG_GREETINGS.en;

    // Bubble label
    const bubble = document.querySelector('.dlc-bubble span:not(.dlc-bubble-dot)');
    if (bubble) bubble.textContent = strings.bubbleLabel;

    // Header
    const head = panelEl.querySelector('.dlc-head-text');
    if (head) {
      head.querySelector('h3').textContent = strings.heading;
      const sub = head.querySelector('p');
      if (sub) {
        // preserve the dot, replace only text after it
        sub.innerHTML = '<span class="dlc-online-dot"></span>' + escapeHtml(strings.sub);
      }
    }

    // Form
    if (inputEl)   inputEl.placeholder = strings.placeholder;
    if (sendBtnEl) sendBtnEl.textContent = strings.send;

    // Footer
    const footSpan = panelEl.querySelector('.dlc-foot span');
    if (footSpan) footSpan.textContent = strings.footnote;
    const talkLink = panelEl.querySelector('.dlc-foot a');
    if (talkLink)  talkLink.textContent = strings.talk + ' →';
  });
}
