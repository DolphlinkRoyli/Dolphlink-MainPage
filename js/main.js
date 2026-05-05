// =============================================================
// Content pipeline — all editable copy + chart data is injected
// from content/content.json. Workflow: edit JSON → push → deploy.
// HTML keeps fallback text that shows only if the fetch fails.
// =============================================================
let CONTENT = null;          // Cached JSON payload
let baiwuLocations = [];     // Map points (populated from JSON)
let chartSectorsData = [];   // Eco-graph sectors (populated from JSON)

// Resolve dotted path "a.b.c" against an object
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// HTML entity escape — defends DOM from special characters in JSON copy
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// Lightweight markdown: escape input, then convert **word** → <strong>word</strong>
// Safe because escaping happens BEFORE the regex (so any HTML in source is neutralized first)
function mdBold(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Expand date tokens: {Q} {MMM} {YYYY} {Q-MMM YYYY}
// Lets CMS author write "Verified {Q-MMM YYYY}" and have it auto-update every month.
const MONTHS_3 = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function expandDateTokens(s) {
  if (!s.includes('{')) return s;
  const now = new Date();
  const m = now.getMonth();
  const Q = 'Q' + (Math.floor(m / 3) + 1);
  const MMM = MONTHS_3[m];
  const YYYY = String(now.getFullYear());
  return s
    .replace(/\{Q-MMM YYYY\}/g, `${Q}-${MMM} ${YYYY}`)
    .replace(/\{Q-MMM\}/g, `${Q}-${MMM}`)
    .replace(/\{MMM YYYY\}/g, `${MMM} ${YYYY}`)
    .replace(/\{Q\}/g, Q)
    .replace(/\{MMM\}/g, MMM)
    .replace(/\{YYYY\}/g, YYYY);
}

// Replace text of every [data-key] element with the matching JSON value.
// Strings containing **bold** markdown render as HTML; otherwise plain textContent.
function applyTextContent(root) {
  root.querySelectorAll('[data-key]').forEach(el => {
    let v = getByPath(CONTENT, el.dataset.key);
    if (typeof v !== 'string') return;
    v = expandDateTokens(v);                       // {Q-MMM YYYY} → Q1-MAR 2026
    if (v.includes('**')) el.innerHTML = mdBold(v);
    else el.textContent = v;
  });
  // [data-href-key] swaps the href; optional [data-href-prefix] adds e.g. "mailto:"
  root.querySelectorAll('[data-href-key]').forEach(el => {
    const v = getByPath(CONTENT, el.dataset.hrefKey);
    if (typeof v === 'string') {
      const prefix = el.dataset.hrefPrefix || '';
      el.setAttribute('href', prefix + v);
    }
  });
}

// Render the 4 reliability stat-cards
function renderStats(container, stats) {
  container.innerHTML = stats.map(s => `
    <button type="button" class="stat-card" data-stat="${escapeHtml(s.key)}" data-detail="${escapeHtml(s.desc)}">
      <span class="stat-icon-wrap"><img src="media/icon/3D/${escapeHtml(s.icon)}.webp" alt="" class="stat-icon" width="88" height="88" /></span>
      <span class="stat-meta">
        <span class="stat-value">${escapeHtml(s.value)}</span>
        <span class="stat-label">${escapeHtml(s.label)}</span>
        <span class="stat-stars" aria-label="Gold standard rating">★★★★★</span>
      </span>
    </button>
  `).join('');
}

// Render the industrial portfolio buttons (variable count from portfolios.csv)
function renderPortfolios(container, items) {
  container.innerHTML = items.map(p => {
    const tagline = p.tagline ? `<span class="portfolio-tagline">${escapeHtml(p.tagline)}</span>` : '';
    return `
    <button type="button" class="btn-portfolio" data-portfolio="${escapeHtml(p.key)}" data-detail="${escapeHtml(p.desc)}">
      <span class="portfolio-icon-wrap"><img src="media/icon/3D/${escapeHtml(p.icon)}.webp" alt="" class="portfolio-icon" width="88" height="88" /></span>
      <span class="portfolio-label">${escapeHtml(p.label)}</span>
      ${tagline}
    </button>
  `;
  }).join('');
}

// Render the nav menu (variable count from menu.csv)
function renderMenu(container, items) {
  container.innerHTML = items.map(m => {
    const label = escapeHtml(m.label);
    if (m.scrollTo) {
      const id = escapeHtml(m.scrollTo);
      return `<a href="#${id}" data-scroll-to="${id}" class="menu-item">${label}</a>`;
    }
    if (m.href) {
      const target = m.target ? ` target="${escapeHtml(m.target)}" rel="noopener noreferrer"` : '';
      return `<a href="${escapeHtml(m.href)}" class="menu-item"${target}>${label}</a>`;
    }
    return '';
  }).join('');
}

// Render the 4 audit boxes (each box keeps its own positional SVG icon)
const AUDIT_ICONS = [
  '<path d="M12 2 L20 5 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V5 Z"/>',
  '<path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 Z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 14 11 16 15 12"/>',
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>',
  '<circle cx="8" cy="14" r="4"/><line x1="11" y1="11" x2="22" y2="2"/><line x1="17" y1="7" x2="20" y2="10"/><line x1="14" y1="10" x2="17" y2="13"/>'
];
function renderAudit(container, items) {
  container.innerHTML = items.map((a, i) => `
    <div class="audit-box">
      <svg class="audit-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AUDIT_ICONS[i] || AUDIT_ICONS[0]}</svg>
      <h3>${escapeHtml(a.title)}</h3>
      <p>${mdBold(a.desc)}</p>
    </div>
  `).join('');
}

// Entry point — fetch content.json then patch the page
async function loadAndRender() {
  try {
    const r = await fetch('content/content.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('fetch failed');
    CONTENT = await r.json();
  } catch (e) {
    console.warn('[content] JSON load failed; falling back to inline HTML', e);
    return; // HTML fallback stays as-is
  }

  // 1) Patch [data-key] text + [data-href-key] hrefs
  applyTextContent(document);

  // 2) Render repeating structures (stats / portfolios / audit boxes)
  document.querySelectorAll('[data-render]').forEach(node => {
    const key = node.dataset.render;
    const data = getByPath(CONTENT, key);
    if (!Array.isArray(data)) return;
    if (key === 'reliability.stats') renderStats(node, data);
    else if (key === 'portfolios.items') renderPortfolios(node, data);
    else if (key === 'audit.items') renderAudit(node, data);
    else if (key === 'nav.menuItems') renderMenu(node, data);
  });

  // 3) Chart data
  if (CONTENT.charts) {
    baiwuLocations = CONTENT.charts.locations || [];
    chartSectorsData = CONTENT.charts.sectors || [];
  }
}

// Kick off fetch immediately (don't wait for DOMContentLoaded — saves round-trip)
const contentReady = loadAndRender();

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const reduceMotion = window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let running = true;

  function init() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const count = reduceMotion ? 25 : 80;
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (reduceMotion ? 0.05 : 0.3),
        vy: (Math.random() - 0.5) * (reduceMotion ? 0.05 : 0.3)
      });
    }
  }

  // Pre-computed constants — kept outside animate() so they aren't redeclared every frame
  const CONNECT_DIST = 150;
  const CONNECT_DIST_SQ = CONNECT_DIST * CONNECT_DIST;
  const TWO_PI = Math.PI * 2;
  const PARTICLE_FILL = 'rgba(56, 189, 248, 0.4)';

  function animate() {
    if (!running) { rafId = null; return; }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const len = particles.length;
    ctx.clearRect(0, 0, w, h);

    // Pass 1: move + draw dots (single fillStyle set, batched paths)
    ctx.fillStyle = PARTICLE_FILL;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, TWO_PI);
      ctx.fill();
    }

    // Pass 2: connection lines (squared distance avoids per-pair sqrt)
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      for (let j = i + 1; j < len; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x, dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < CONNECT_DIST_SQ) {
          const dist = Math.sqrt(distSq);
          const opacity = 1 - dist / CONNECT_DIST;
          ctx.lineWidth = 0.8 * opacity;
          ctx.strokeStyle = `rgba(56, 189, 248, ${opacity * 0.4})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  // Page Visibility API — pause when tab is hidden, resume on return (saves CPU / battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      if (!rafId) animate();
    }
  });

  window.addEventListener('resize', debounce(init, 150));
  init();
  animate();
})();

function scrollToSec(id) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' });
}

window.addEventListener('load', async function () {
  // Wait for JSON render so stat-card / portfolio / audit DOM is stable before binding handlers
  await contentReady;

  document.querySelectorAll('[data-scroll-to]').forEach(a => {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      scrollToSec(this.getAttribute('data-scroll-to'));
    });
  });

  // Reveal-on-scroll: fade-up for main sections as they enter viewport
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('revealed'));
  }

  // Generic card toggle: click to expand detail, click again to collapse
  function setupCardToggle(cardSelector, detailId, placeholderText) {
    const detail = document.getElementById(detailId);
    if (!detail) return;
    // textContent + createElement is the safest way to render placeholder copy
    const setPlaceholder = () => {
      detail.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'placeholder';
      span.textContent = placeholderText;
      detail.appendChild(span);
    };
    const cards = document.querySelectorAll(cardSelector);
    cards.forEach(card => {
      card.addEventListener('click', function () {
        const wasActive = this.classList.contains('active');
        cards.forEach(c => c.classList.remove('active'));
        if (wasActive) {
          setPlaceholder();
        } else {
          this.classList.add('active');
          const detailText = this.getAttribute('data-detail') || '';
          // Wrap in a single span so the flex parent treats it as one item
          // (otherwise each <strong> becomes a separate flex item with gap)
          detail.innerHTML = '';
          const span = document.createElement('span');
          span.className = 'detail-text';
          if (detailText.includes('**')) span.innerHTML = mdBold(detailText);
          else span.textContent = detailText;
          detail.appendChild(span);
        }
      });
    });
  }
  // Placeholder copy comes from JSON; falls back to hard-coded English if JSON missing
  const statPh = (CONTENT && CONTENT.reliability && CONTENT.reliability.placeholder) || 'Select a metric to inspect details';
  const portPh = (CONTENT && CONTENT.portfolios && CONTENT.portfolios.placeholder) || 'Select a portfolio to inspect details';
  setupCardToggle('.stat-card', 'stat-detail', statPh);
  setupCardToggle('.btn-portfolio', 'portfolio-detail', portPh);

  // Hero video — play/pause toggle, no loop, rewind on end
  const heroVideo = document.querySelector('.v-frame video');
  const playBtn = document.querySelector('.v-play-btn');
  if (heroVideo && playBtn) {
    heroVideo.volume = 0.12;

    const syncBtn = () => {
      const isPlaying = !heroVideo.paused && !heroVideo.ended;
      playBtn.classList.toggle('playing', isPlaying);
    };

    // Sync button state with video play/pause events
    heroVideo.addEventListener('play', syncBtn);
    heroVideo.addEventListener('pause', syncBtn);

    // On end: rewind to start and show play button (no loop)
    heroVideo.addEventListener('ended', () => {
      heroVideo.currentTime = 0;
      syncBtn();
    });

    playBtn.addEventListener('click', () => {
      if (heroVideo.paused || heroVideo.ended) {
        // Unmute on first click (browser autoplay policies require muted start)
        heroVideo.muted = false;
        heroVideo.volume = 0.12;
        const p = heroVideo.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        heroVideo.pause();
      }
    });

    syncBtn(); // Initial state

    // Volume slider (default 0.12)
    const volSlider = document.querySelector('.v-vol-slider');
    const muteBtn = document.querySelector('.v-mute-btn');
    const fullBtn = document.querySelector('.v-full-btn');

    const syncMuteIcon = () => {
      if (!muteBtn) return;
      const effectivelyMuted = heroVideo.muted || heroVideo.volume === 0;
      muteBtn.classList.toggle('muted', effectivelyMuted);
    };

    if (volSlider) {
      volSlider.value = '0.12';
      volSlider.addEventListener('input', () => {
        const v = parseFloat(volSlider.value);
        heroVideo.volume = v;
        if (v === 0) heroVideo.muted = true;
        else if (heroVideo.muted) heroVideo.muted = false;
        syncMuteIcon();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (heroVideo.muted) {
          heroVideo.muted = false;
          if (heroVideo.volume === 0) {
            heroVideo.volume = 0.12;
            if (volSlider) volSlider.value = '0.12';
          }
        } else {
          heroVideo.muted = true;
        }
        syncMuteIcon();
      });
    }

    heroVideo.addEventListener('volumechange', syncMuteIcon);
    syncMuteIcon();

    // Fullscreen toggle (WebKit prefix fallback)
    if (fullBtn) {
      fullBtn.addEventListener('click', () => {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          const target = heroVideo;
          const req = target.requestFullscreen
            || target.webkitRequestFullscreen
            || target.webkitEnterFullscreen;
          if (req) req.call(target);
        }
      });
      const syncFullIcon = () => {
        const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        fullBtn.classList.toggle('fullscreen', fs);
      };
      document.addEventListener('fullscreenchange', syncFullIcon);
      document.addEventListener('webkitfullscreenchange', syncFullIcon);
    }
  }

  const mapEl = document.getElementById('global-map');
  const ecoEl = document.getElementById('eco-chart');
  if (!mapEl || !ecoEl) return;

  // ECharts lazy-load — IntersectionObserver injects the CDN only when charts enter viewport
  const loadECharts = () => new Promise((resolve, reject) => {
    if (typeof window.echarts !== 'undefined') return resolve(window.echarts);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    s.async = true;
    s.onload = () => resolve(window.echarts);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const initCharts = async () => {
    try {
      // Wait for both content.json and the ECharts script to be ready
      await Promise.all([contentReady, loadECharts()]);
    } catch {
      return;
    }
    runCharts();
  };

  // Trigger when chart container is within 200px of viewport
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        initCharts();
      }
    }, { rootMargin: '200px' });
    io.observe(mapEl);
  } else {
    initCharts(); // Fallback for legacy browsers without IntersectionObserver
  }

  function runCharts() {
  const mapChart = echarts.init(mapEl);
  const ecoChart = echarts.init(ecoEl);

  // Chart font — matches site-wide Inter
  const CHART_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

  // Build responsive map option (smaller layoutSize on mobile to avoid overflow)
  const buildMapOption = () => {
    const w = mapChart.getWidth();
    const isMobile = w < 560;
    const isNarrow = w < 380;
    const layoutSize = isNarrow ? '155%' : (isMobile ? '175%' : '210%');
    const labelFontSize = isMobile ? 9 : 10;
    const labelPad = isMobile ? [3, 5] : [4, 8];

    return {
      textStyle: { fontFamily: CHART_FONT, fontWeight: 500 },
      geo: {
        map: 'world',
        layoutCenter: ['50%', '50%'],
        layoutSize: layoutSize,
        roam: false,
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: '#264F78' }
        },
        itemStyle: {
          areaColor: '#1E3A5F',
          borderColor: '#38BDF8',
          borderWidth: 0.5
        }
      },
      series: [
        {
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: baiwuLocations,
          symbolSize: (val, params) => params.data.isHQ ? (isMobile ? 11 : 14) : (isMobile ? 6 : 7),
          rippleEffect: { brushType: 'stroke', scale: 3.5, period: 4 },
          label: {
            show: true,
            position: 'top',
            formatter: '{b}',
            color: '#fff',
            fontSize: labelFontSize,
            fontWeight: '700',
            fontFamily: CHART_FONT,
            backgroundColor: 'rgba(5, 12, 26, 0.7)',
            padding: labelPad,
            borderRadius: 4,
            distance: isMobile ? 6 : 10,
            textBorderColor: '#000',
            textBorderWidth: 1
          },
          labelLayout: (params) => {
            // Mobile: nudge labels back inside chart edges
            const x = params.rect.x + params.rect.width / 2;
            const chartW = mapChart.getWidth();
            const margin = isMobile ? 4 : 8;
            let dx = 0;
            if (x < params.labelRect.width / 2 + margin) {
              dx = (params.labelRect.width / 2 + margin) - x;
            } else if (x > chartW - params.labelRect.width / 2 - margin) {
              dx = (chartW - params.labelRect.width / 2 - margin) - x;
            }
            return { dx: dx, hideOverlap: false, moveOverlap: 'shiftY' };
          },
          emphasis: {
            scale: true,
            label: { show: false },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(56, 189, 248, 0.6)'
            }
          },
          itemStyle: {
            color: (params) => params.data.isHQ ? '#F59E0B' : '#38BDF8',
            shadowBlur: 10
          },
          zlevel: 2
        },
        {
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 1,
          effect: {
            show: true,
            period: 5,
            trailLength: 0.55,
            symbolSize: 4,
            color: '#FBBF24'
          },
          lineStyle: {
            color: '#F59E0B',
            width: 1,
            opacity: 0.55,
            curveness: 0.32
          },
          data: (() => {
            // Lines radiate from the HQ to every non-HQ location (HQ resolved dynamically from JSON)
            const hq = baiwuLocations.find(l => l.isHQ) || baiwuLocations[0];
            if (!hq) return [];
            return baiwuLocations
              .filter(l => !l.isHQ)
              .map(l => ({ fromName: hq.name, toName: l.name, coords: [hq.value, l.value] }));
          })()
        }
      ]
    };
  };

  // Sector data — sourced from content.json (charts.sectors)
  // Fallback: minimal hard-coded array if JSON hasn't loaded yet
  const sectorsData = (chartSectorsData && chartSectorsData.length)
    ? chartSectorsData
    : [
      { name: 'BANKING & FINTECH', color: '#0059B3', desc: 'Financial-grade SLA & Authentication' },
      { name: 'HEALTHCARE', color: '#10B981', desc: '5G RCS Reports & IoT Alerts' },
      { name: 'GOV & PUBLIC', color: '#F59E0B', desc: 'Emergency Alerts & Sovereign Encryption' },
      { name: 'E-COMMERCE', color: '#6366F1', desc: 'Global Logistics & Identity Auth' },
      { name: 'MANUFACTURING', color: '#EC4899', desc: 'IoV Commands & Monitoring' },
      { name: 'SAAS & DIGITAL', color: '#8B5CF6', desc: 'API Integration & Compliance' },
      { name: 'EDUCATION', color: '#14B8A6', desc: 'Identity Verification & High Delivery' },
      { name: 'ENERGY & MINING', color: '#F43F5E', desc: 'Safety Warnings & Low Latency' },
      { name: 'SMART OPERATIONS', color: '#0059B3', desc: 'Agentic AI & Digital Cockpit' }
    ];

  // Mobile-only label shortening / line-break map (long names get 2-line wrap on mobile)
  const mobileLabelMap = {
    'BANKING & FINTECH': 'BANKING\n& FINTECH',
    'HEALTHCARE': 'HEALTH',
    'RETAIL & E-COMMERCE': 'RETAIL &\nE-COMMERCE',
    'LOGISTICS': 'LOGISTICS',
    'ENTERTAINMENT': 'ENTER-\nTAINMENT',
    'HOSPITALITY': 'HOSPITALITY',
    'CUSTOMER SERVICE': 'CUSTOMER\nSERVICE',
    'MARKETING & SALES': 'MARKETING\n& SALES',
    'IT & OPERATIONS': 'IT &\nOPS'
  };

  const drawEco = () => {
    const w = ecoChart.getWidth(), h = ecoChart.getHeight();
    const isMobile = w < 560;
    const isNarrow = w < 380;
    const cx = w / 2, cy = h / 2;
    // Mobile nodes need extra radius so labels next to them have breathing room
    const rx = isMobile ? w * 0.12 : w * 0.14;
    const ry = isMobile ? h * 0.18 : h * 0.22;
    const centerSize = isMobile ? (isNarrow ? 48 : 54) : 64;
    const sectorSize = isMobile ? (isNarrow ? 32 : 36) : 46;
    const labelFs = isMobile ? (isNarrow ? 8 : 9) : 10;
    const centerFs = isMobile ? (isNarrow ? 9 : 10) : 10;

    let nodes = [{
      name: 'DOLPHLINK', x: cx, y: cy, fixed: true, symbolSize: centerSize,
      itemStyle: {
        color: '#0059B3',
        shadowBlur: 38,
        shadowColor: 'rgba(56, 189, 248, 0.6)',
        borderWidth: 2,
        borderColor: '#FFFFFF'
      },
      label: {
        show: true,
        fontFamily: CHART_FONT,
        fontWeight: '900',
        fontSize: centerFs,
        letterSpacing: 0.5,
        color: '#FFFFFF'
      }
    }];

    let links = [];

    sectorsData.forEach((s, i) => {
      const angle = (i * (360 / sectorsData.length) - 70) * (Math.PI / 180);
      // Boost relative offset on mobile so nodes don't crowd the center
      const offsetEven = isMobile ? 0.85 : 0.2;
      const offsetOdd = isMobile ? 0.95 : 0.35;
      const offset = i % 2 === 0 ? offsetEven : offsetOdd;
      const x = cx + rx * Math.cos(angle) * offset;
      const y = cy + ry * Math.sin(angle) * offset;

      let align = 'left', pos = 'right';
      if (Math.cos(angle) > 0.1) { align = 'left'; pos = 'right'; }
      else if (Math.cos(angle) < -0.1) { align = 'right'; pos = 'left'; }
      else { align = 'center'; pos = Math.sin(angle) > 0 ? 'bottom' : 'top'; }

      // On mobile, swap to shortened / wrapped label
      const displayName = isMobile ? (mobileLabelMap[s.name] || s.name) : s.name;

      nodes.push({
        name: s.name, x: x, y: y, fixed: true, symbolSize: sectorSize,
        itemStyle: {
          color: 'rgba(255,255,255,0.95)', borderColor: s.color,
          borderWidth: 2, shadowBlur: 10, shadowColor: s.color
        },
        label: {
          show: true,
          position: pos,
          distance: isMobile ? 2 : 1,
          color: '#FFFFFF',
          fontFamily: CHART_FONT,
          fontWeight: '700',
          fontSize: labelFs,
          align: align,
          formatter: displayName,
          lineHeight: labelFs + 3,
          backgroundColor: 'rgba(5, 12, 26, 0.7)',
          padding: isMobile ? [3, 5] : [4, 6],
          borderRadius: 4,
          hideOverlap: false
        },
        desc: s.desc
      });

      links.push({
        source: 'DOLPHLINK', target: s.name,
        lineStyle: { width: 1.5, opacity: 0.3, color: s.color, curveness: 0.1 }
      });
    });

    ecoChart.setOption({
      textStyle: { fontFamily: CHART_FONT, fontWeight: 500 },
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        textStyle: { color: '#0F172A', fontWeight: '600', fontFamily: CHART_FONT },
        formatter: (params) => {
          if (params.dataType === 'node' && params.data.desc) {
            return `<div style="padding:4px;font-family:${CHART_FONT};">
              <b style="color:#0059B3;letter-spacing:0.3px">${escapeHtml(params.data.name)}</b><br/>
              <span style="font-size:12px;color:#475569">${escapeHtml(params.data.desc)}</span>
            </div>`;
          }
          return '';
        },
        confine: true,
        extraCssText: 'z-index: 10001;'
      },
      series: [{
        type: 'graph',
        layout: 'none',
        data: nodes,
        links: links,
        z: 10,
        emphasis: { focus: 'adjacency' }
      }]
    }, true);
  };

  const renderMap = () => mapChart.setOption(buildMapOption(), true);
  if (echarts.getMap && echarts.getMap('world')) {
    renderMap();
  } else {
    fetch('https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json')
      .then(r => r.json())
      .then(geo => { echarts.registerMap('world', geo); renderMap(); })
      .catch(err => console.error('Failed to load world map GeoJSON:', err));
  }

  drawEco();

  const onResize = debounce(() => {
    mapChart.resize();
    ecoChart.resize();
    // Rebuild responsive config (layoutSize, font size, node positions all change with breakpoint)
    if (echarts.getMap && echarts.getMap('world')) renderMap();
    drawEco();
  }, 150);
  window.addEventListener('resize', onResize);

  } // end runCharts
});
