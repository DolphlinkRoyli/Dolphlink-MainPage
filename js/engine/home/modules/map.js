/**
 * ECharts world map — lazy-loaded, IntersectionObserver-deferred.
 * HOMEPAGE ONLY.
 *
 * Self-hosted only. If lib/echarts.min.js or lib/world.json fails to
 * load, we paint a hand-written city-list fallback (../fallbacks.js).
 */
import { loadScriptOnce } from '../lib-loader.js';
import { debounce } from '../utils.js';
import { mapFallback } from '../fallbacks.js';

let _locations = [];

export function setMapLocations(locations) {
  _locations = Array.isArray(locations) ? locations : [];
}

export function bindMap(mapEl) {
  if (!mapEl) return;

  const loadECharts = () => {
    if (typeof window.echarts !== 'undefined') return Promise.resolve(window.echarts);
    return loadScriptOnce('lib/echarts.min.js').then(() => window.echarts);
  };

  const initCharts = async () => {
    try {
      await loadECharts();
    } catch {
      mapFallback(mapEl, _locations);
      return;
    }
    runCharts(mapEl);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        initCharts();
      }
    }, { rootMargin: '200px' });
    io.observe(mapEl);
  } else {
    initCharts();
  }
}

function runCharts(mapEl) {
  const echarts = window.echarts;
  const mapChart = echarts.init(mapEl);
  const CHART_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

  const buildMapOption = () => {
    const w = mapChart.getWidth();
    const h = mapChart.getHeight();
    const isMobile = w < 560;

    let targetMapW;
    if (w >= 720)        targetMapW = w * 0.95;
    else if (w >= 480)   targetMapW = w * (0.95 + ((720 - w) / 240) * 0.45);
    else                 targetMapW = w * 1.60;
    targetMapW = Math.max(targetMapW, 540);

    const minDim = Math.min(w, h);
    const layoutSizePct = Math.round(targetMapW / minDim * 100) + '%';
    const enableRoam = targetMapW > w + 6;
    const labelFontSize = isMobile ? 9.5 : 11;
    const labelPad = isMobile ? [3, 6] : [4, 8];
    const layoutCenterX = enableRoam ? '40%' : '50%';

    return {
      textStyle: { fontFamily: CHART_FONT, fontWeight: 500 },
      geo: {
        map: 'world',
        layoutCenter: [layoutCenterX, '50%'],
        layoutSize: layoutSizePct,
        aspectScale: 0.75,
        roam: enableRoam ? 'move' : false,
        scaleLimit: { min: 1, max: 1 },
        label: { show: false },
        emphasis: { label: { show: false }, itemStyle: { areaColor: '#264F78' } },
        itemStyle: { areaColor: '#1E3A5F', borderColor: '#38BDF8', borderWidth: 0.5 }
      },
      series: [
        {
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: _locations,
          symbolSize: (val, params) =>
            params.data.isHQ ? (isMobile ? 11 : 14) : (isMobile ? 6 : 7),
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
            const x = params.rect.x + params.rect.width / 2;
            const chartW = mapChart.getWidth();
            const margin = isMobile ? 4 : 8;
            let dx = 0;
            if (x < params.labelRect.width / 2 + margin) {
              dx = (params.labelRect.width / 2 + margin) - x;
            } else if (x > chartW - params.labelRect.width / 2 - margin) {
              dx = (chartW - params.labelRect.width / 2 - margin) - x;
            }
            return { dx, hideOverlap: false, moveOverlap: 'shiftY' };
          },
          emphasis: {
            scale: true,
            label: { show: false },
            itemStyle: { shadowBlur: 20, shadowColor: 'rgba(56, 189, 248, 0.6)' }
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
          effect: { show: true, period: 5, trailLength: 0.55, symbolSize: 4, color: '#FBBF24' },
          lineStyle: { color: '#F59E0B', width: 1, opacity: 0.55, curveness: 0.32 },
          data: (() => {
            const hq = _locations.find(l => l.isHQ) || _locations[0];
            if (!hq) return [];
            return _locations
              .filter(l => !l.isHQ)
              .map(l => ({ fromName: hq.name, toName: l.name, coords: [hq.value, l.value] }));
          })()
        }
      ]
    };
  };

  const renderMap = () => {
    const opt = buildMapOption();
    mapChart.setOption(opt, true);
    const card = mapEl.parentElement;
    if (card && card.classList) {
      const roamOn = opt.geo && opt.geo.roam === 'move';
      card.classList.toggle('map-roam-on', roamOn);
    }
  };

  if (echarts.getMap && echarts.getMap('world')) {
    renderMap();
  } else {
    fetch('lib/world.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('local world.json missing — run lib/download script')))
      .then(geo => { echarts.registerMap('world', geo); renderMap(); })
      .catch(err => {
        console.error('Failed to load world map GeoJSON:', err);
        try { mapChart.dispose(); } catch (_) {}
        mapFallback(mapEl, _locations);
      });
  }

  const onResize = debounce(() => {
    mapChart.resize();
    if (echarts.getMap && echarts.getMap('world')) renderMap();
  }, 150);
  window.addEventListener('resize', onResize);

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(debounce(() => {
      mapChart.resize();
      if (echarts.getMap && echarts.getMap('world')) renderMap();
    }, 100));
    ro.observe(mapEl);
  }
}
