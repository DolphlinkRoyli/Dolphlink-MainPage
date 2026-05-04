// 1. 百悟科技全球核心位置全量集合 (精准经纬度编排)
const baiwuLocations = [
  { name: "SINGAPORE (International HQ)", value: [103.8513, 1.2830], isHQ: true },
  { name: "HONG KONG", value: [114.1694, 22.3193], isHQ: false },
  { name: "BEIJING", value: [116.4074, 39.9042], isHQ: false },
  { name: "SHANGHAI", value: [121.4737, 31.2304], isHQ: false },
  { name: "SHENZHEN", value: [114.0579, 22.5431], isHQ: false },
  { name: "XIAMEN", value: [118.0894, 24.4798], isHQ: false },
  { name: "HANGZHOU", value: [120.1551, 30.2741], isHQ: false },
  { name: "SILICON VALLEY", value: [-122.0575, 37.3875], isHQ: false },
  { name: "LONDON", value: [-0.1278, 51.5074], isHQ: false },
  { name: "FRANKFURT", value: [8.6821, 50.1109], isHQ: false },
  { name: "DUBAI", value: [55.2708, 25.2048], isHQ: false },
  { name: "TOKYO", value: [139.6917, 35.6895], isHQ: false }
];

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

  function animate() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 150) {
          const opacity = 1 - dist / 150;
          ctx.lineWidth = 0.8 * opacity;
          ctx.strokeStyle = `rgba(56, 189, 248, ${opacity * 0.4})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', debounce(init, 150));
  init();
  animate();
})();

function scrollToSec(id) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' });
}

window.addEventListener('load', function () {
  document.querySelectorAll('[data-scroll-to]').forEach(a => {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      scrollToSec(this.getAttribute('data-scroll-to'));
    });
  });

  // Reveal-on-scroll: 主要 section 入场淡入上移
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

  // 通用卡片切换器：点击展开 detail，再次点击收起
  function setupCardToggle(cardSelector, detailId, placeholderText) {
    const detail = document.getElementById(detailId);
    if (!detail) return;
    const placeholderHTML = `<span class="placeholder">${placeholderText}</span>`;
    const cards = document.querySelectorAll(cardSelector);
    cards.forEach(card => {
      card.addEventListener('click', function () {
        const wasActive = this.classList.contains('active');
        cards.forEach(c => c.classList.remove('active'));
        if (wasActive) {
          detail.innerHTML = placeholderHTML;
        } else {
          this.classList.add('active');
          detail.textContent = this.getAttribute('data-detail') || '';
        }
      });
    });
  }
  setupCardToggle('.stat-card', 'stat-detail', 'Select a metric to inspect details');
  setupCardToggle('.btn-portfolio', 'portfolio-detail', 'Select a portfolio to inspect details');

  // Hero video — Play/Pause toggle + 不循环 + 结束回到开始
  const heroVideo = document.querySelector('.v-frame video');
  const playBtn = document.querySelector('.v-play-btn');
  if (heroVideo && playBtn) {
    heroVideo.volume = 0.3;

    const syncBtn = () => {
      const isPlaying = !heroVideo.paused && !heroVideo.ended;
      playBtn.classList.toggle('playing', isPlaying);
    };

    // 视频播放/暂停状态变化时同步按钮
    heroVideo.addEventListener('play', syncBtn);
    heroVideo.addEventListener('pause', syncBtn);

    // 视频结束后回到开头并显示播放按钮（不循环）
    heroVideo.addEventListener('ended', () => {
      heroVideo.currentTime = 0;
      syncBtn();
    });

    playBtn.addEventListener('click', () => {
      if (heroVideo.paused || heroVideo.ended) {
        // 第一次点击同时解除静音（autoplay 限制需要静音启动）
        heroVideo.muted = false;
        heroVideo.volume = 0.3;
        const p = heroVideo.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else {
        heroVideo.pause();
      }
    });

    syncBtn(); // 初始化

    // 音量滑块（默认 0.3）
    const volSlider = document.querySelector('.v-vol-slider');
    const muteBtn = document.querySelector('.v-mute-btn');
    const fullBtn = document.querySelector('.v-full-btn');

    const syncMuteIcon = () => {
      if (!muteBtn) return;
      const effectivelyMuted = heroVideo.muted || heroVideo.volume === 0;
      muteBtn.classList.toggle('muted', effectivelyMuted);
    };

    if (volSlider) {
      volSlider.value = '0.3';
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
            heroVideo.volume = 0.3;
            if (volSlider) volSlider.value = '0.3';
          }
        } else {
          heroVideo.muted = true;
        }
        syncMuteIcon();
      });
    }

    heroVideo.addEventListener('volumechange', syncMuteIcon);
    syncMuteIcon();

    // 全屏切换（兼容 webkit）
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
  if (!mapEl || !ecoEl || typeof echarts === 'undefined') return;

  const mapChart = echarts.init(mapEl);
  const ecoChart = echarts.init(ecoEl);

  // 全局字体配置，与站点 Inter 主字体保持一致
  const CHART_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

  const mapOption = {
    textStyle: { fontFamily: CHART_FONT, fontWeight: 500 },
    geo: {
      map: 'world',
      // 用 layoutCenter + layoutSize 让地图自动上下左右居中
      layoutCenter: ['50%', '50%'],
      layoutSize: '210%',
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
        symbolSize: (val, params) => params.data.isHQ ? 14 : 7,
        rippleEffect: { brushType: 'stroke', scale: 3.5, period: 4 },
        label: {
          show: true,
          position: 'top',
          formatter: '{b}',
          color: '#fff',
          fontSize: 10,
          fontWeight: '700',
          fontFamily: CHART_FONT,
          backgroundColor: 'rgba(5, 12, 26, 0.7)',
          padding: [4, 8],
          borderRadius: 4,
          distance: 10,
          textBorderColor: '#000',
          textBorderWidth: 1
        },
        labelLayout: { hideOverlap: false, moveOverlap: 'shiftY' },
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
      // Light beams from Singapore HQ to all other locations
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
        data: baiwuLocations
          .filter(loc => !loc.isHQ)
          .map(loc => ({
            fromName: 'SINGAPORE',
            toName: loc.name,
            coords: [[103.8513, 1.2830], loc.value]
          }))
      }
    ]
  };

  const sectorsData = [
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

  const drawEco = () => {
    const w = ecoChart.getWidth(), h = ecoChart.getHeight();
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.14;
    const ry = h * 0.22;

    let nodes = [{
      name: 'DOLPHLINK', x: cx, y: cy, fixed: true, symbolSize: 64,
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
        fontSize: 10,
        letterSpacing: 0.5,
        color: '#FFFFFF'
      }
    }];

    let links = [];

    sectorsData.forEach((s, i) => {
      const angle = (i * (360 / sectorsData.length) - 70) * (Math.PI / 180);
      const offset = i % 2 === 0 ? 0.2 : 0.35;
      const x = cx + rx * Math.cos(angle) * offset;
      const y = cy + ry * Math.sin(angle) * offset;

      let align = 'left', pos = 'right';
      if (Math.cos(angle) > 0.1) { align = 'left'; pos = 'right'; }
      else if (Math.cos(angle) < -0.1) { align = 'right'; pos = 'left'; }
      else { align = 'center'; pos = Math.sin(angle) > 0 ? 'bottom' : 'top'; }

      nodes.push({
        name: s.name, x: x, y: y, fixed: true, symbolSize: 46,
        itemStyle: {
          color: 'rgba(255,255,255,0.95)', borderColor: s.color,
          borderWidth: 2, shadowBlur: 10, shadowColor: s.color
        },
        label: {
          show: true,
          position: pos,
          distance: 1,
          color: '#FFFFFF',
          fontFamily: CHART_FONT,
          fontWeight: '700',
          fontSize: 10,
          align: align,
          backgroundColor: 'rgba(5, 12, 26, 0.7)',
          padding: [4, 6],
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
              <b style="color:#0059B3;letter-spacing:0.3px">${params.data.name}</b><br/>
              <span style="font-size:12px;color:#475569">${params.data.desc}</span>
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

  const renderMap = () => mapChart.setOption(mapOption);
  const finishLoader = () => {
    if (window.__dolphlinkLoaderFinish) window.__dolphlinkLoaderFinish();
  };
  if (window.__dolphlinkLoader) window.__dolphlinkLoader.set(82, 'Connecting to global mesh');
  if (echarts.getMap && echarts.getMap('world')) {
    renderMap();
    finishLoader();
  } else {
    fetch('https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json')
      .then(r => r.json())
      .then(geo => {
        if (window.__dolphlinkLoader) window.__dolphlinkLoader.set(94, 'Mounting world geometry');
        echarts.registerMap('world', geo);
        renderMap();
        finishLoader();
      })
      .catch(err => {
        console.error('Failed to load world map GeoJSON:', err);
        finishLoader();
      });
  }

  drawEco();

  const onResize = debounce(() => {
    mapChart.resize();
    ecoChart.resize();
    drawEco();
  }, 150);
  window.addEventListener('resize', onResize);
});
