// ─── Utilidades de pantalla compartidas por todas las secciones ───

// Escapa texto para insertarlo en HTML (evita que un comentario malicioso ejecute código)
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function num(n, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function compacto(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' M';
  if (a >= 1e4) return Math.round(n / 1e3) + ' mil';
  return num(n);
}
export function fecha(f, conHora = false) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-GT', { timeZone: 'America/Guatemala', day: 'numeric', month: 'short', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
export function haceCuanto(f) {
  if (!f) return '—';
  const s = Math.round((Date.now() - new Date(f).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}

export const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Cuenta hacia arriba un número (animación suave, respeta "reducir movimiento")
export function contar(el, valor, { dec = 0, sufijo = '', duracion = 900 } = {}) {
  if (!el) return;
  if (valor === null || valor === undefined || isNaN(valor)) { el.textContent = '—'; return; }
  if (reducirMovimiento()) { el.textContent = num(valor, dec) + sufijo; return; }
  const ini = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - ini) / duracion);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = num(valor * e, dec) + sufijo;
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// Anima los anchos de barras declarados en data-w (después de insertarlas)
export function animarBarras(raiz = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('[data-w]', raiz).forEach(b => { b.style.width = Math.max(0, Math.min(100, parseFloat(b.dataset.w) || 0)) + '%'; });
  }));
}
export function animarNumeros(raiz = document) {
  $$('[data-num]', raiz).forEach(el => contar(el, parseFloat(el.dataset.num), { dec: parseInt(el.dataset.dec || '0'), sufijo: el.dataset.suf || '' }));
}
export function escalonar(raiz) {
  $$(':scope > *', raiz).forEach((h, i) => { h.classList.add('entra'); h.style.animationDelay = Math.min(i * 40, 400) + 'ms'; });
}

// Avisos flotantes
export function aviso(texto, tipo = 'ok') {
  let cont = $('.avisos');
  if (!cont) { cont = document.createElement('div'); cont.className = 'avisos'; cont.setAttribute('role', 'status'); document.body.appendChild(cont); }
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'error' ? ' error' : '');
  t.textContent = texto;
  cont.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 7000 : 4000);
}

// Ventana modal. Devuelve { cuerpo, cerrar }
// fija: no se puede cerrar con Escape, tocando afuera ni con la ✕ (ej. cambio de contraseña obligatorio)
export function ventana(titulo, html = '', { ancha = false, pie = '', fija = false } = {}) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="ventana ${ancha ? 'ancha' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="vcab"><h3>${esc(titulo)}</h3>${fija ? '' : '<button class="btn icono chico" aria-label="Cerrar">✕</button>'}</div>
    <div class="vcuerpo">${html}</div>${pie ? `<div class="vpie">${pie}</div>` : ''}</div>`;
  const cerrar = () => { velo.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') cerrar(); };
  if (!fija) {
    velo.addEventListener('click', (e) => { if (e.target === velo) cerrar(); });
    velo.querySelector('.vcab .btn').addEventListener('click', cerrar);
    document.addEventListener('keydown', esc_);
  }
  document.body.appendChild(velo);
  return { velo, cuerpo: velo.querySelector('.vcuerpo'), pie: velo.querySelector('.vpie'), cerrar };
}

export function confirmar(titulo, mensaje, { texto = 'Confirmar', peligro = false } = {}) {
  return new Promise((res) => {
    const v = ventana(titulo, `<p class="texto-2">${mensaje}</p>`,
      { pie: `<button class="btn" data-no>Cancelar</button><button class="btn ${peligro ? 'peligro' : 'primario'}" data-si>${esc(texto)}</button>` });
    v.pie.querySelector('[data-no]').onclick = () => { v.cerrar(); res(false); };
    v.pie.querySelector('[data-si]').onclick = () => { v.cerrar(); res(true); };
  });
}

// Chips de sentimiento / postura
const SENT = { positivo: ['pos', 'Positivo'], negativo: ['neg', 'Negativo'], neutro: ['neu', 'Neutro'] };
export function chipSent(s) { const [c, t] = SENT[s] || ['neu', s || '—']; return `<span class="chip ${c}">${t}</span>`; }
const POST = { favor: ['pos', 'A favor'], informativo_propio: ['info', 'Informativa propia'], contra: ['neg', 'En contra'], neutral: ['neu', 'Neutral'] };
export function chipPostura(p) { const [c, t] = POST[p] || ['neu', 'Sin clasificar']; return `<span class="chip ${c}">${t}</span>`; }

// Colores del tema ACTUAL (claro u oscuro), leídos de las variables de estilos.css.
// Así un número en rojo o ámbar se lee bien en los dos modos, y las gráficas usan los mismos tonos.
const RESPALDO = { positivo: '#3cc5a0', negativo: '#f0616d', neutro: '#8a9a92', lima: '#a2d441', info: '#7f8cff', ambar: '#f2b33d', pizarra: '#3e5a74', azul: '#060e97' };
export const COLOR = new Proxy(RESPALDO, {
  get(base, k) {
    if (typeof k !== 'string' || !(k in base)) return base[k];
    try { return getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim() || base[k]; } catch { return base[k]; }
  },
});

// ── Piezas comunes, para que todas las secciones se vean igual ──
// Pestañas de una sección (se desplazan de lado en el celular)
export function pestanas(lista, activa, id = 'pestanas') {
  return `<nav class="pestanas" id="${id}" role="tablist">${lista.map(([k, t]) => `<button class="f ${k === activa ? 'activo' : ''}" role="tab" aria-selected="${k === activa}" data-p="${k}">${t}</button>`).join('')}</nav>`;
}
export function marcarPestana(raiz, k) {
  $$('[data-p]', raiz).forEach(b => { b.classList.toggle('activo', b.dataset.p === k); b.setAttribute('aria-selected', b.dataset.p === k); });
}
// Indicador: etiqueta, número grande y una línea de apoyo. tono: pos | neg | ambar | info | lima
export function kpi({ etq = '', valor, sufijo = '', pie = '', tono = '', tam = '', animar = true, dec = 0, extra = '' }) {
  const v = valor == null || (typeof valor === 'number' && isNaN(valor)) ? '—'
    : typeof valor === 'number' && animar ? `<span data-num="${valor}"${dec ? ` data-dec="${dec}"` : ''}>0</span>` : (typeof valor === 'number' ? num(valor, dec) : valor);
  return `<div class="kpi ${tam}">${etq ? `<span class="etq">${etq}</span>` : ''}<span class="valor ${tono ? 't-' + tono : ''}">${v}${sufijo && v !== '—' ? `<small>${sufijo}</small>` : ''}</span>${extra}${pie ? `<span class="pie">${pie}</span>` : ''}</div>`;
}
export const kpis = (lista) => `<div class="kpis">${lista.join('')}</div>`;
// Contenedor de gráfica con alto estándar (baja 220 · normal 270 · alta 330)
export const grafica = (id, tam = '') => `<div class="grafica ${tam}"><canvas id="${id}"></canvas></div>`;
// Rótulo pequeño en mayúsculas (para separar bloques dentro de una tarjeta)
export const rotulo = (texto, tono = '') => `<div class="rotulo ${tono ? 't-' + tono : ''}">${texto}</div>`;
// Tarjeta de carga mientras llegan los datos
export const cargandoTarjeta = (alto = '') => `<div class="tarjeta cargando ${alto}"></div>`;

// Barra apilada positivo / neutro / negativo
export function barraSentimiento(p, n, neu) {
  return `<div class="apilada" role="img" aria-label="${p}% positivo, ${neu}% neutro, ${n}% negativo">
    <span data-w="${p}" style="background:${COLOR.positivo}"></span><span data-w="${neu}" style="background:${COLOR.neutro}"></span><span data-w="${n}" style="background:${COLOR.negativo}"></span></div>`;
}

// Delta respecto al periodo anterior. menosEsMejor: para "negativo", "denuncias"...
export function delta(valor, { menosEsMejor = false, sufijo = '', dec = 0 } = {}) {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  if (Math.abs(valor) < 0.5 && dec === 0) return `<span class="delta igual">= sin cambio</span>`;
  const sube = valor > 0;
  const malo = menosEsMejor ? sube : !sube;
  return `<span class="delta ${sube ? 'sube' : 'baja'}-${malo ? 'malo' : 'bueno'}">${sube ? '▲' : '▼'} ${num(Math.abs(valor), dec)}${sufijo}</span>`;
}

// Lista con barras proporcionales
export function listaBarras(items, { etiqueta = 'nom', valor = 'n', color = COLOR.lima, colorFn, alClic, max } = {}) {
  if (!items?.length) return `<div class="vacio">Sin datos en este periodo.</div>`;
  const m = max || Math.max(...items.map(i => i[valor] || 0), 1);
  return `<div class="lista-barras">${items.map((it, i) => `
    <div class="fila ${alClic ? 'click' : ''}" ${alClic ? `data-i="${i}" role="button" tabindex="0"` : ''}>
      <span class="nom" title="${esc(it[etiqueta])}">${esc(it[etiqueta])}</span><span class="num">${num(it[valor])}</span>
      <div class="pista"><span data-w="${(it[valor] || 0) / m * 100}" style="background:${colorFn ? colorFn(it) : color}"></span></div>
    </div>`).join('')}</div>`;
}
export function enlazarLista(raiz, items, fn) {
  $$('.fila.click', raiz).forEach(f => {
    const ir = () => fn(items[parseInt(f.dataset.i)]);
    f.addEventListener('click', ir);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
  });
}

export function comentarioHTML(c, { mostrarPost = false } = {}) {
  return `<div class="comentario">
    <div class="meta">${chipSent(c.sentimiento)}${c.red ? `<span>${esc(c.red)}</span>` : ''}${c.autor ? `<span>· ${esc(c.autor)}</span>` : ''}
      <span>· ${fecha(c.fecha, true)}</span>${c.zona ? `<span class="chip">${esc(c.zona)}</span>` : ''}${c.colonia ? `<span class="chip">${esc(c.colonia)}</span>` : ''}
      ${c.oculto ? '<span class="chip ambar">Oculto en la red</span>' : ''}
      ${c.permalink ? `<a class="a-derecha" href="${esc(c.permalink)}" target="_blank" rel="noopener">Ver ↗</a>` : ''}</div>
    <div class="txt">${esc(c.texto)}</div>
    ${c.resumen || c.dolor || c.senalado ? `<div class="meta">${c.dolor ? `<span>Queja: <b>${esc(c.dolor)}</b></span>` : ''}${c.senalado ? `<span>· Culpa a: <b>${esc(c.senalado)}</b></span>` : ''}${c.peticion ? `<span>· Pide: <b>${esc(c.peticion)}</b></span>` : ''}</div>` : ''}
    ${mostrarPost && c.post_ref ? `<div class="meta"><a href="#" data-post="${esc(c.post_ref)}">Ver publicación y su análisis</a></div>` : ''}
  </div>`;
}

export function vacio(texto = 'Sin datos en este periodo.') { return `<div class="vacio">${esc(texto)}</div>`; }

// ayuda: una línea que explica qué significa la tarjeta (se abre con el botón "?")
export function tarjeta({ titulo, nota = '', acciones = '', cuerpo = '', clase = '', id = '', ayuda = '' }) {
  const botonAyuda = ayuda ? `<button class="ayuda" type="button" aria-label="¿Qué significa?" aria-expanded="false">?</button>` : '';
  return `<section class="tarjeta ${clase}" ${id ? `id="${id}"` : ''}>
    ${titulo ? `<div class="cab"><div class="cab-texto"><h2>${titulo}</h2>${nota ? `<div class="nota">${nota}</div>` : ''}</div><div class="acciones">${acciones}${botonAyuda}</div></div>` : ''}
    ${ayuda ? `<div class="ayuda-txt oculto">${ayuda}</div>` : ''}
    ${cuerpo}</section>`;
}

export function cargando(el) { if (el) el.innerHTML = `<div class="esqueleto corto"></div><div class="esqueleto"></div><div class="esqueleto medio"></div>`; }

// Debounce
export function demorar(fn, ms = 350) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
