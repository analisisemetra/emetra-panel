// ─── Gráficas (Chart.js) con el estilo de EMETRA ───
import { COLOR, reducirMovimiento, num } from './ui.js';

const graficas = new Map();
let configurado = false;
const claro = () => document.documentElement.dataset.tema === 'claro';
export const rejillaColor = () => claro() ? 'rgba(20,32,26,.08)' : 'rgba(255,255,255,.05)';
// Se llama al cambiar entre modo claro y oscuro
export function reiniciarEstiloGraficas() { configurado = false; }
function configurar() {
  if (configurado || !window.Chart) return;
  const C = window.Chart;
  const css = getComputedStyle(document.documentElement);
  C.defaults.color = css.getPropertyValue('--texto-2').trim() || '#a9b8b0';
  C.defaults.font.family = "'Montserrat', system-ui, sans-serif";
  C.defaults.font.size = 11.5;
  C.defaults.borderColor = claro() ? 'rgba(20,32,26,.10)' : 'rgba(255,255,255,.06)';
  C.defaults.plugins.legend.labels.boxWidth = 10;
  C.defaults.plugins.legend.labels.boxHeight = 10;
  C.defaults.plugins.legend.labels.usePointStyle = true;
  C.defaults.plugins.tooltip.backgroundColor = claro() ? '#ffffff' : '#0d1311';
  C.defaults.plugins.tooltip.titleColor = claro() ? '#13201a' : '#ffffff';
  C.defaults.plugins.tooltip.bodyColor = claro() ? '#13201a' : '#e8efea';
  C.defaults.plugins.tooltip.borderColor = claro() ? '#c7d1ca' : '#33463d';
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.plugins.tooltip.titleFont = { weight: '700' };
  C.defaults.animation.duration = reducirMovimiento() ? 0 : 900;
  C.defaults.maintainAspectRatio = false;
  configurado = true;
}

export function grafica(canvas, config) {
  configurar();
  if (!canvas || !window.Chart) return null;
  const previa = graficas.get(canvas.id || canvas);
  if (previa) previa.destroy();
  const g = new window.Chart(canvas.getContext('2d'), config);
  graficas.set(canvas.id || canvas, g);
  return g;
}
export function limpiarGraficas() { for (const g of graficas.values()) g.destroy(); graficas.clear(); }

const ejes = (extra = {}) => ({
  x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, ...extra.x },
  y: { beginAtZero: true, grid: { color: rejillaColor() }, ticks: { precision: 0 }, ...extra.y },
});

// desdeCero: false para totales grandes que cambian poco (p. ej. seguidores), así se ve la tendencia
export function lineas(canvas, etiquetas, series, { apilado = false, porcentaje = false, anotaciones = [], desdeCero = true } = {}) {
  return grafica(canvas, {
    type: 'line',
    data: { labels: etiquetas, datasets: series.map(s => ({
      label: s.nombre, data: s.datos, borderColor: s.color, backgroundColor: s.relleno || (s.color + '22'),
      fill: !!s.relleno || apilado, tension: .35, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, borderWidth: s.grosor || 2.2, borderDash: s.punteada ? [5, 5] : undefined,
    })) },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: porcentaje ? { label: c => `${c.dataset.label}: ${c.parsed.y}%` } : {} } },
      scales: ejes({ y: { stacked: apilado, beginAtZero: desdeCero, max: porcentaje ? 100 : undefined, ticks: { callback: v => porcentaje ? v + '%' : num(v) } } }),
    },
    plugins: anotaciones.length ? [marcasVerticales(anotaciones)] : [],
  });
}

// Líneas verticales punteadas en ciertos días (eventos de la línea de tiempo)
function marcasVerticales(marcas) {
  return {
    id: 'marcas',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      for (const m of marcas) {
        const x = scales.x.getPixelForValue(m.indice);
        if (x == null || isNaN(x)) continue;
        ctx.strokeStyle = m.color; ctx.globalAlpha = .7; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.arc(x, chartArea.top + 4, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  };
}

export function barras(canvas, etiquetas, series, { horizontal = false, apilado = false, porcentaje = false } = {}) {
  return grafica(canvas, {
    type: 'bar',
    data: { labels: etiquetas, datasets: series.map(s => ({ label: s.nombre, data: s.datos, backgroundColor: s.color, borderRadius: 5, maxBarThickness: 34 })) },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: series.length > 1, position: 'bottom' }, tooltip: { callbacks: porcentaje ? { label: c => `${c.dataset.label}: ${c.parsed[horizontal ? 'x' : 'y']}%` } : {} } },
      scales: horizontal
        ? { x: { stacked: apilado, beginAtZero: true, max: porcentaje ? 100 : undefined, grid: { color: rejillaColor() } }, y: { stacked: apilado, grid: { display: false } } }
        : ejes({ x: { stacked: apilado }, y: { stacked: apilado, max: porcentaje ? 100 : undefined } }),
    },
  });
}

export function dona(canvas, etiquetas, datos, colores) {
  return grafica(canvas, {
    type: 'doughnut',
    data: { labels: etiquetas, datasets: [{ data: datos, backgroundColor: colores, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#151e1a', borderWidth: 3, hoverOffset: 6 }] },
    options: { cutout: '68%', plugins: { legend: { position: 'bottom' } } },
  });
}

// Mini gráfica de línea (sparkline) en SVG
export function chispa(valores, color = COLOR.lima, ancho = 140, alto = 36) {
  const v = (valores || []).filter(x => x != null);
  if (v.length < 2) return '';
  const max = Math.max(...v), min = Math.min(...v), r = (max - min) || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * ancho).toFixed(1)},${(alto - 3 - (x - min) / r * (alto - 6)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
