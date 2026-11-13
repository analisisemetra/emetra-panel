// ─── EMETRA Analítica: arranque, sesión, navegación tipo app, filtros, seguridad ───
import { api, fijarToken, hayToken, alEventos, fijarPagina, paginaActual, fijarRango, rangoActual } from './api.js';
import { $, $$, esc, aviso, ventana, haceCuanto } from './ui.js';
import { limpiarGraficas, reiniciarEstiloGraficas } from './graficas.js';

const ICONO = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  gente: 'M9 7a4 4 0 1 0 0 .01M2.5 21c.8-3.6 3.4-5.6 6.5-5.6s5.7 2 6.5 5.6M17.5 8a2.5 2.5 0 1 0 0 .01M17 14.5c2.4.2 4 1.8 4.5 4.5',
  mapa: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  noticias: 'M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM8 8h8M8 12h8M8 16h5',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  proyectos: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  actividad: 'M3 20h18M6 16v-5M10 16V6M14 16v-8M18 16v-3',
  comunicacion: 'M4 5h16v10H8l-4 4zM8 9h8M8 12h5',
  redes: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  amenazas: 'M12 3l9 16H3zM12 10v4M12 17v.5',
  credibilidad: 'M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z',
  comparar: 'M8 3v18M16 3v18M3 8h5M16 16h5M3 16h5M16 8h5',
  datos: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  informe: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
  ajustes: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .2-1.3-1.5.4-2-3-1-1 1.8h-2L9 3.7l-3 1 .4 2L5 8.2 3 8l-1 3 2 1v1l-2 1 1 3 2-.2 1.3 1.5-.4 2 3 1 1-1.8h2l1 1.8 3-1-.4-2 1.3-1.5 2 .2 1-3-2-1z',
};

// Secciones del tablero. g = grupo (botón de abajo en el celular)
const SECCIONES = {
  inicio:       { t: 'Inicio', g: 'inicio', modulo: './secciones/inicio.js', sinFiltro: false },
  ciudadania:   { t: 'Qué dice la gente', corto: 'Opinión', g: 'gente', modulo: './secciones/ciudadania.js' },
  proyectos:    { t: 'Proyectos', g: 'gente', modulo: './secciones/proyectos.js' },
  actividad:    { t: 'Actividad', g: 'gente', modulo: './secciones/actividad.js' },
  comunicacion: { t: 'Comunicación', g: 'gente', modulo: './secciones/comunicacion.js' },
  redes:        { t: 'Nuestras redes', corto: 'Redes', g: 'gente', modulo: './secciones/redes.js' },
  territorio:   { t: 'Mapa y territorio', corto: 'Territorio', g: 'mapa', modulo: './secciones/territorio.js' },
  medios:       { t: 'Noticias', g: 'noticias', modulo: './secciones/medios.js' },
  mas:          { t: 'Más', g: 'mas', modulo: './secciones/mas.js', sinFiltro: true, oculto: true },
  buscar:       { t: 'Buscar comentarios', corto: 'Buscar', g: 'mas', modulo: './secciones/buscar.js', desc: 'Encuentra cualquier comentario' },
  amenazas:     { t: 'Amenazas', g: 'mas', modulo: './secciones/amenazas.js', desc: 'Cuentas hostiles y coordinadas' },
  credibilidad: { t: 'Credibilidad', g: 'mas', modulo: './secciones/credibilidad.js', desc: 'De EMETRA, PMT y funcionarios' },
  comparar:     { t: 'Comparar', g: 'mas', modulo: './secciones/comparar.js', desc: 'Dos periodos o dos páginas', sinFiltro: true },
  datos:        { t: 'Datos', g: 'mas', modulo: './secciones/datos.js', admin: true, sinFiltro: true, desc: 'Subir Excel, respaldos, IA' },
  informe:      { t: 'Informe', g: 'mas', modulo: './secciones/informe.js', admin: true, desc: 'Para imprimir o PDF' },
  ajustes:      { t: 'Ajustes', g: 'mas', modulo: './secciones/ajustes.js', admin: true, sinFiltro: true, desc: 'Usuarios, APIs, avisos' },
};
const GRUPOS = [['inicio', 'Inicio'], ['gente', 'Gente'], ['mapa', 'Mapa'], ['noticias', 'Noticias'], ['mas', 'Más']];
const PERIODOS = [[1, '24 horas'], [7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '1 año'], [null, 'Todo']];
const INACTIVIDAD_MS = 30 * 60 * 1000;

const estado = { usuario: null, dias: 30, seccion: null, cargadoEn: null, montaje: 0, paginas: [], ultimaActividad: Date.now(), bloqueado: false };
try { const d = sessionStorage.getItem('emetra.dias'); if (d !== null) estado.dias = d === 'null' ? null : parseInt(d); } catch { /* */ }

const esAdmin = () => estado.usuario?.rol === 'admin';
const svg = (d, ancho = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const visible = (id) => SECCIONES[id] && !(SECCIONES[id].admin && !esAdmin());

// ── Tema claro / oscuro ──
function temaElegido() { try { return localStorage.getItem('emetra.tema') || 'auto'; } catch { return 'auto'; } }
function aplicarTema(eleccion = temaElegido()) {
  const t = eleccion === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro') : eleccion;
  document.documentElement.dataset.tema = t;
  $$('.logo-tema').forEach(img => { img.src = t === 'claro' ? 'img/emetra-logo.svg' : 'img/emetra-logo-blanco.svg'; });
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'claro' ? '#f2f4f1' : '#0d1311');
  reiniciarEstiloGraficas();
  pintarMarcaAgua();
}
function elegirTema(eleccion) {
  try { localStorage.setItem('emetra.tema', eleccion); } catch { /* */ }
  aplicarTema(eleccion);
  if (estado.usuario) montar();
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (temaElegido() === 'auto') { aplicarTema(); if (estado.usuario) montar(); } });

// ── Pantalla de entrada ──
function mostrarEntrada(mensaje = '') {
  $('#entrada').classList.remove('oculto');
  $('#app').classList.add('oculto');
  $('#marcaAgua').classList.add('oculto');
  $('#errorEntrada').textContent = mensaje;
  setTimeout(() => $('#campoUsuario')?.focus(), 50);
}
async function entrar(e) {
  e.preventDefault();
  const usuario = $('#campoUsuario').value.trim(), pass = $('#campoPass').value;
  const btn = $('#btnEntrar'), err = $('#errorEntrada');
  btn.disabled = true; err.textContent = '';
  try {
    const r = await api('/api/login', { metodo: 'POST', cuerpo: { usuario, pass } });
    fijarToken(r.token);
    $('#campoPass').value = '';
    await iniciarSesion(r.usuario);
  } catch (ex) { err.textContent = ex.message; }
  finally { btn.disabled = false; }
}

async function iniciarSesion(usuario) {
  estado.usuario = usuario;
  estado.ultimaActividad = Date.now();
  $('#entrada').classList.add('oculto');
  $('#app').classList.remove('oculto');
  pintarMarcaAgua();
  pintarMenu();
  if (!usuario.aceptoAcuerdo) await pedirAcuerdo();
  if (usuario.debeCambiarPass) await cambiarPass(true);
  await cargarPaginas();
  navegar();
  actualizarContadores();
  if (!vioRecorrido()) setTimeout(recorrido, 900);
}

function salir() {
  fijarToken(null);
  estado.usuario = null;
  quitarBloqueo();
  limpiarGraficas();
  $$('.velo').forEach(v => v.remove());
  mostrarEntrada();
}

// ── Marca de agua con el nombre de quien está viendo ──
function pintarMarcaAgua() {
  const el = $('#marcaAgua');
  if (!el) return;
  if (!estado.usuario) { el.classList.add('oculto'); return; }
  const hoy = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const texto = `${estado.usuario.nombre} · ${estado.usuario.usuario} · ${hoy}`.replace(/[<>&"]/g, '');
  const color = document.documentElement.dataset.tema === 'claro' ? '#13201a' : '#ffffff';
  const marca = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><text x="20" y="130" fill="${color}" font-family="Montserrat, Arial, sans-serif" font-size="15" font-weight="600" transform="rotate(-24 210 110)">${texto}</text></svg>`;
  el.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(marca)}")`;
  el.classList.remove('oculto');
}

// ── Cierre por inactividad: 30 minutos sin usar el tablero → pide la contraseña ──
function registrarActividad() { if (!estado.bloqueado) estado.ultimaActividad = Date.now(); }
function revisarInactividad() {
  if (!estado.usuario || estado.bloqueado) return;
  if (Date.now() - estado.ultimaActividad > INACTIVIDAD_MS) bloquear();
}
function bloquear() {
  estado.bloqueado = true;
  const u = estado.usuario;
  const caja = document.createElement('div');
  caja.className = 'bloqueo'; caja.id = 'bloqueo';
  caja.innerHTML = `<form class="caja" autocomplete="off">
    <div class="avatar">${esc(u.avatar || u.nombre.slice(0, 2).toUpperCase())}</div>
    <h2 style="font-size:20px">${esc(u.nombre)}</h2>
    <p class="nota" style="margin:-6px 0 4px">Por seguridad, la sesión se pausó tras 30 minutos sin uso. Escribe tu contraseña para seguir donde estabas.</p>
    <input type="text" value="${esc(u.usuario)}" autocomplete="username" hidden>
    <input type="password" id="passBloqueo" autocomplete="current-password" placeholder="Contraseña" aria-label="Contraseña">
    <button class="btn primario" type="submit">Continuar</button>
    <div class="nota" id="errBloqueo" style="color:var(--negativo);min-height:18px" role="alert"></div>
    <button class="btn chico" type="button" id="salirBloqueo">Salir</button></form>`;
  document.body.appendChild(caja);
  setTimeout(() => $('#passBloqueo')?.focus(), 50);
  caja.querySelector('#salirBloqueo').onclick = salir;
  caja.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/login', { metodo: 'POST', cuerpo: { usuario: u.usuario, pass: $('#passBloqueo').value } });
      fijarToken(r.token);
      quitarBloqueo();
      if (r.usuario?.debeCambiarPass) await cambiarPass(true);
    } catch (ex) { $('#errBloqueo').textContent = ex.message; }
  };
}
function quitarBloqueo() { estado.bloqueado = false; estado.ultimaActividad = Date.now(); $('#bloqueo')?.remove(); }

// ── Página y periodo (panel que sube desde abajo en el celular) ──
async function cargarPaginas() {
  let lista = [];
  try { lista = await api('/api/paginas'); } catch { lista = []; }
  estado.paginas = lista;
  if (lista.length <= 1) { fijarPagina(null); pintarFiltro(); return; }
  const principal = lista.find(p => p.principal) || lista[0];
  let actual = paginaActual();
  if (actual !== 'todas' && !lista.some(p => String(p.id) === actual)) actual = String(principal.id);
  fijarPagina(actual);
  pintarFiltro();
}
function nombrePaginaActual() {
  const p = paginaActual();
  if (!p || !estado.paginas || estado.paginas.length <= 1) return null;
  if (p === 'todas') return 'Todas las páginas';
  return estado.paginas.find(y => String(y.id) === p)?.nombre || null;
}
const fechaCorta = (s) => new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
function textoPeriodo() {
  const r = rangoActual();
  if (r) return `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
  return (PERIODOS.find(p => p[0] === estado.dias) || [null, 'Todo'])[1];
}
function pintarFiltro() {
  const pg = nombrePaginaActual();
  $('#botonFiltro').innerHTML = `${svg('M3 5h18M6 12h12M10 19h4', 2)}<span>${esc(textoPeriodo())}</span>${pg ? `<span class="texto-largo">·</span><span class="pagina-activa texto-largo">${esc(pg)}</span>` : ''}`;
  const s = SECCIONES[estado.seccion || 'inicio'];
  $('#botonFiltro').classList.toggle('oculto', !!s?.sinFiltro);
}
function abrirFiltro() {
  const r = rangoActual();
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const v = ventana('Periodo y página', `
    <div><div class="nota mb">Periodo</div>
      <div class="filtros">${PERIODOS.map(([d, t]) => `<button class="f ${!r && d === estado.dias ? 'activo' : ''}" data-dias="${d}">${t}</button>`).join('')}</div></div>
    <div><div class="nota mb">O elige las fechas</div>
      <div class="form" style="grid-template-columns:1fr 1fr auto">
        <label class="campo">Desde<input type="date" id="fDesde" value="${r?.desde || ''}" max="${hoy}"></label>
        <label class="campo">Hasta<input type="date" id="fHasta" value="${r?.hasta || hoy}" max="${hoy}"></label>
        <button class="btn primario" id="fAplicar">Aplicar</button></div>
      <div class="nota" id="fErr" style="color:var(--negativo)"></div></div>
    ${estado.paginas.length > 1 ? `<div><div class="nota mb">Página</div><div class="filtros">
      ${estado.paginas.map(p => `<button class="f ${paginaActual() === String(p.id) ? 'activo' : ''}" data-pagina="${p.id}">${esc(p.nombre)}</button>`).join('')}
      <button class="f ${paginaActual() === 'todas' ? 'activo' : ''}" data-pagina="todas">Todas juntas</button></div></div>` : ''}`);
  v.velo.classList.add('hoja');
  const listo = () => { v.cerrar(); pintarFiltro(); montar(); actualizarContadores(); };
  v.cuerpo.querySelectorAll('[data-dias]').forEach(b => b.onclick = () => {
    estado.dias = b.dataset.dias === 'null' ? null : parseInt(b.dataset.dias);
    try { sessionStorage.setItem('emetra.dias', String(estado.dias)); } catch { /* */ }
    fijarRango(null); listo();
  });
  v.cuerpo.querySelector('#fAplicar').onclick = () => {
    const desde = v.cuerpo.querySelector('#fDesde').value, hasta = v.cuerpo.querySelector('#fHasta').value;
    if (!desde || !hasta) { v.cuerpo.querySelector('#fErr').textContent = 'Elige las dos fechas.'; return; }
    if (hasta < desde) { v.cuerpo.querySelector('#fErr').textContent = '«Hasta» debe ser después de «Desde».'; return; }
    fijarRango({ desde, hasta }); listo();
  };
  v.cuerpo.querySelectorAll('[data-pagina]').forEach(b => b.onclick = () => { fijarPagina(b.dataset.pagina); listo(); });
}

// ── Acuerdo de confidencialidad (obligatorio antes de ver datos) ──
let acuerdoAbierto = null;
function pedirAcuerdo() {
  if (!acuerdoAbierto) acuerdoAbierto = mostrarAcuerdo().finally(() => { acuerdoAbierto = null; });
  return acuerdoAbierto;
}
async function mostrarAcuerdo() {
  const a = await api('/api/acuerdo');
  return new Promise((res) => {
    const v = ventana('Acuerdo de confidencialidad', `<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.65;color:var(--texto-2)">${esc(a.texto)}</div>
      <label class="check"><input type="checkbox" id="chkAcuerdo"> He leído y acepto el acuerdo</label>`,
      { pie: `<button class="btn" data-salir>Salir</button><button class="btn primario" data-aceptar disabled>Aceptar y entrar</button>`, fija: true });
    const chk = v.cuerpo.querySelector('#chkAcuerdo'), btn = v.pie.querySelector('[data-aceptar]');
    chk.onchange = () => { btn.disabled = !chk.checked; };
    v.pie.querySelector('[data-salir]').onclick = () => { v.cerrar(); salir(); };
    btn.onclick = async () => {
      await api('/api/acuerdo/aceptar', { metodo: 'POST' });
      estado.usuario.aceptoAcuerdo = true;
      v.cerrar(); res();
    };
  });
}

export function cambiarPass(obligatorio = false) {
  const minimo = esAdmin() ? 12 : 8;
  return new Promise((res) => {
    const v = ventana(obligatorio ? 'Cambia tu contraseña' : 'Cambiar contraseña', `
      ${obligatorio ? '<div class="guia">Por seguridad, debes poner una contraseña nueva antes de continuar.</div>' : ''}
      <label class="campo">Contraseña actual<input type="password" id="pAct" autocomplete="current-password"></label>
      <label class="campo">Nueva contraseña<input type="password" id="pNue" autocomplete="new-password"></label>
      <label class="campo">Repite la nueva<input type="password" id="pRep" autocomplete="new-password"></label>
      <div class="nota">Mínimo ${minimo} caracteres${esAdmin() ? ' (administradores)' : ''}, con letras y números, y sin incluir tu usuario.</div>
      <div class="nota" id="pErr" style="color:var(--negativo)"></div>`, { pie: `<button class="btn primario" data-ok>Guardar</button>`, fija: obligatorio });
    if (!obligatorio) v.velo.addEventListener('click', (e) => { if (e.target === v.velo) res(); });
    v.pie.querySelector('[data-ok]').onclick = async () => {
      const act = $('#pAct', v.cuerpo).value, nue = $('#pNue', v.cuerpo).value, rep = $('#pRep', v.cuerpo).value;
      if (nue !== rep) { $('#pErr', v.cuerpo).textContent = 'Las contraseñas nuevas no coinciden.'; return; }
      try { const r = await api('/api/yo/cambiar-pass', { metodo: 'POST', cuerpo: { actual: act, nueva: nue } }); if (r.token) fijarToken(r.token); if (estado.usuario) estado.usuario.debeCambiarPass = false; v.cerrar(); aviso('Contraseña actualizada. Las sesiones abiertas en otros equipos se cerraron.'); res(); }
      catch (e) { $('#pErr', v.cuerpo).textContent = e.message; }
    };
  });
}

// ── Menú (computadora) y barra de abajo (celular) ──
function pintarMenu() {
  const u = estado.usuario;
  const item = (id) => { const s = SECCIONES[id]; return `<a class="item" href="#${id}" data-sec="${id}">${svg(ICONO[id] || ICONO[s.g])}${s.corto || s.t}${id === 'medios' ? '<span class="contador oculto" data-contador="medios"></span>' : ''}</a>`; };
  let html = item('inicio');
  html += `<div class="grupo">Gente</div>${['ciudadania', 'proyectos', 'actividad', 'comunicacion', 'redes'].map(item).join('')}`;
  html += `<div class="grupo">Territorio y noticias</div>${item('territorio')}${item('medios')}`;
  html += `<div class="grupo">Vigilancia</div>${['buscar', 'amenazas', 'credibilidad', 'comparar'].map(item).join('')}`;
  if (esAdmin()) html += `<div class="grupo">Administración</div>${['datos', 'informe', 'ajustes'].map(item).join('')}`;
  $('#nav').innerHTML = html;
  $('#navbar').innerHTML = GRUPOS.map(([g, t]) => `<a href="#${g === 'gente' ? 'ciudadania' : g === 'mapa' ? 'territorio' : g === 'noticias' ? 'medios' : g}" data-grupo="${g}">${svg(ICONO[g], 1.9)}${t}${g === 'noticias' ? '<span class="contador oculto" data-contador="medios"></span>' : ''}</a>`).join('');
  $('#usuarioNombre').textContent = u.nombre;
  $('#usuarioRol').textContent = u.rolNombre + (u.zonas?.length ? ' · ' + u.zonas.join(', ') : '');
  $('#usuarioAvatar').textContent = u.avatar || u.nombre.slice(0, 2).toUpperCase();
}

// Panel de la cuenta (contraseña, tema, recorrido, salir). En el celular está en «Más».
export function abrirCuenta() {
  const t = temaElegido();
  const v = ventana(estado.usuario.nombre, `
    <div class="nota" style="margin-top:-6px">${esc(estado.usuario.rolNombre)}${estado.usuario.zonas?.length ? ' · ' + esc(estado.usuario.zonas.join(', ')) : ''}</div>
    <div><div class="nota mb">Apariencia</div><div class="filtros">
      ${[['auto', 'Automática'], ['claro', 'Clara (para la calle)'], ['oscuro', 'Oscura']].map(([k, n]) => `<button class="f ${t === k ? 'activo' : ''}" data-tema="${k}">${n}</button>`).join('')}</div></div>
    <div class="linea"><button class="btn" data-pass>Cambiar contraseña</button><button class="btn" data-recorrido>Ver cómo se usa</button><button class="btn peligro" data-salir>Salir</button></div>`);
  v.velo.classList.add('hoja');
  v.cuerpo.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { v.cerrar(); elegirTema(b.dataset.tema); });
  v.cuerpo.querySelector('[data-pass]').onclick = () => { v.cerrar(); cambiarPass(false); };
  v.cuerpo.querySelector('[data-recorrido]').onclick = () => { v.cerrar(); recorrido(); };
  v.cuerpo.querySelector('[data-salir]').onclick = () => { v.cerrar(); salir(); };
}

// Barra de sub-secciones (celular): Gente y Más
function pintarSubnav(id) {
  const g = SECCIONES[id].g;
  if (g !== 'gente' && !(g === 'mas' && id !== 'mas')) return '';
  const ids = Object.keys(SECCIONES).filter(k => SECCIONES[k].g === g && visible(k) && !SECCIONES[k].oculto);
  return `<nav class="subnav" aria-label="Sub-secciones">${ids.map(k => `<a href="#${k}" class="${k === id ? 'activo' : ''}">${SECCIONES[k].corto || SECCIONES[k].t}</a>`).join('')}</nav>`;
}

// ── Recorrido de bienvenida (3 pasos) ──
function vioRecorrido() { try { return localStorage.getItem('emetra.recorrido') === '1'; } catch { return true; } }
function recorrido() {
  const C = 'var(--lima)', G = 'var(--borde-2)';
  const pasos = [
    ['Todo está a un toque', 'Abajo tienes cinco botones: Inicio, Gente, Mapa, Noticias y Más. El que está en verde te dice dónde estás.',
      `<svg viewBox="0 0 220 120" width="220"><rect x="10" y="10" width="200" height="100" rx="12" fill="none" stroke="${G}"/><rect x="10" y="80" width="200" height="30" rx="0" fill="none" stroke="${G}"/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${30 + i * 40}" cy="95" r="6" fill="${i === 0 ? C : G}"/>`).join('')}</svg>`],
    ['Cada tarjeta responde una pregunta', 'Toca una tarjeta para ver el detalle. El «?» explica qué significa el número.',
      `<svg viewBox="0 0 220 120" width="220"><rect x="20" y="15" width="180" height="90" rx="12" fill="none" stroke="${C}"/><text x="36" y="45" fill="${C}" font-size="12" font-family="Montserrat">¿Cómo nos ven?</text><text x="36" y="80" fill="${C}" font-size="28" font-weight="800" font-family="Montserrat">31%</text><circle cx="182" cy="38" r="9" fill="none" stroke="${C}"/><text x="179" y="42" fill="${C}" font-size="11" font-family="Montserrat">?</text></svg>`],
    ['Elige periodo, página y busca', 'Arriba eliges el periodo (o fechas exactas) y la página. La lupa busca cualquier comentario.',
      `<svg viewBox="0 0 220 120" width="220"><rect x="20" y="40" width="120" height="34" rx="17" fill="none" stroke="${C}"/><text x="40" y="62" fill="${C}" font-size="12" font-family="Montserrat">30 días</text><circle cx="175" cy="57" r="14" fill="none" stroke="${C}"/><path d="M182 64l8 8" stroke="${C}" stroke-width="2"/></svg>`],
  ];
  let i = 0;
  const v = ventana('Cómo se usa', '', { pie: `<button class="btn" data-saltar>Saltar</button><button class="btn primario" data-sig>Siguiente</button>` });
  const pintar = () => {
    const [t, d, dib] = pasos[i];
    v.cuerpo.innerHTML = `<div class="paso-dibujo">${dib}</div><h3 style="font-size:17px;margin:0">${t}</h3><p style="margin:0;color:var(--texto-2)">${d}</p>
      <div class="puntos">${pasos.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    v.pie.querySelector('[data-sig]').textContent = i === pasos.length - 1 ? 'Empezar' : 'Siguiente';
  };
  const terminar = () => { try { localStorage.setItem('emetra.recorrido', '1'); } catch { /* */ } v.cerrar(); };
  v.pie.querySelector('[data-saltar]').onclick = terminar;
  v.pie.querySelector('[data-sig]').onclick = () => { if (i < pasos.length - 1) { i++; pintar(); } else terminar(); };
  pintar();
}

// ── Navegación ──
function seccionActual() {
  let id = (location.hash.replace('#', '').split('?')[0]) || 'inicio';
  if (id === 'resumen') id = 'inicio';
  if (!visible(id)) return 'inicio';
  return id;
}
export function parametrosHash() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}
function navegar() { estado.seccion = seccionActual(); montar(); }

async function montar() {
  if (!estado.usuario) return;
  const id = estado.seccion || seccionActual();
  const s = SECCIONES[id];
  const turno = ++estado.montaje;
  $$('#nav a.item').forEach(a => a.classList.toggle('activo', a.dataset.sec === id));
  $$('#navbar a').forEach(a => a.classList.toggle('activo', a.dataset.grupo === s.g));
  $('#tituloSeccion').textContent = s.t;
  $('#migas').textContent = (GRUPOS.find(g => g[0] === s.g) || [null, ''])[1];
  document.title = `${s.t} · EMETRA Analítica`;
  pintarFiltro();
  limpiarGraficas();
  const cont = $('#contenido');
  cont.innerHTML = `${pintarSubnav(id)}<div class="tarjeta cargando"></div>`;
  window.scrollTo({ top: 0 });
  try {
    const mod = await import(s.modulo);
    if (turno !== estado.montaje) return;
    // La barra de sub-secciones queda fuera del área que cada sección redibuja
    cont.innerHTML = `${pintarSubnav(id)}<div id="cuerpoSeccion"></div>`;
    const r = rangoActual();
    await mod.montar(cont.querySelector('#cuerpoSeccion'), {
      dias: r ? null : estado.dias, rango: r, periodo: textoPeriodo(), usuario: estado.usuario, esAdmin: esAdmin(), parametros: parametrosHash(),
      recargar: montar, ir: (h) => { location.hash = h; }, secciones: SECCIONES, abrirCuenta, iconos: ICONO, paginas: estado.paginas,
    });
    estado.cargadoEn = Date.now();
    pintarActualizado();
    api('/api/vistas', { metodo: 'POST', cuerpo: { seccion: id + (parametrosHash().v ? '?v=' + parametrosHash().v : '') } }).catch(() => {});
  } catch (e) {
    if (turno !== estado.montaje) return;
    if (e.estado === 401 || e.estado === 451) return;
    console.error(e);
    cont.innerHTML = `${pintarSubnav(id)}<div class="tarjeta"><div class="vacio t-neg">⚠ ${esc(e.message)}</div><div style="text-align:center"><button class="btn" id="reintentar">Reintentar</button></div></div>`;
    $('#reintentar').onclick = montar;
  }
}

function pintarActualizado() {
  $('#actualizado').innerHTML = estado.cargadoEn ? `<i></i>Actualizado ${haceCuanto(estado.cargadoEn)}` : '';
}

async function actualizarContadores() {
  if (!estado.usuario?.aceptoAcuerdo) return;
  try {
    const r = await api('/api/alertas/nuevas');
    const n = (r.nuevas || 0) + (r.crisis || 0);
    $$('[data-contador="medios"]').forEach(el => { el.textContent = n > 99 ? '99+' : n; el.classList.toggle('oculto', !n); });
  } catch { /* silencioso */ }
}

// ── Arranque ──
alEventos({
  expiro: (msg) => { fijarToken(null); estado.usuario = null; quitarBloqueo(); mostrarEntrada(msg || 'Tu sesión venció. Vuelve a entrar.'); },
  acuerdo: () => { if (estado.usuario) { estado.usuario.aceptoAcuerdo = false; pedirAcuerdo().then(montar); } },
  // El servidor pide cambiar la contraseña antes de mostrar datos (una sola ventana aunque fallen varias consultas)
  cambiarPass: () => {
    if (!estado.usuario || estado.pidiendoPass) return;
    estado.pidiendoPass = true;
    cambiarPass(true).then(() => { estado.pidiendoPass = false; montar(); });
  },
});
window.addEventListener('hashchange', () => {
  if (!estado.usuario) return;
  const nueva = seccionActual();
  if (nueva !== estado.seccion) { estado.seccion = nueva; montar(); }
});
// Ayuda "?" de las tarjetas: muestra u oculta la explicación
document.addEventListener('click', (e) => {
  const b = e.target.closest('.ayuda');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const txt = b.closest('.tarjeta')?.querySelector('.ayuda-txt');
  if (!txt) return;
  const abrir = txt.classList.contains('oculto');
  txt.classList.toggle('oculto', !abrir);
  b.setAttribute('aria-expanded', abrir);
}, true);
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, registrarActividad, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarInactividad(); });

document.addEventListener('DOMContentLoaded', async () => {
  aplicarTema();
  $('#formEntrada').addEventListener('submit', entrar);
  $('#botonFiltro').addEventListener('click', abrirFiltro);
  $('#botonUsuario').addEventListener('click', abrirCuenta);
  setInterval(pintarActualizado, 30000);
  setInterval(actualizarContadores, 120000);
  setInterval(revisarInactividad, 30000);
  // Refresco suave cada 10 minutos si la pestaña está visible y no hay ventanas abiertas
  setInterval(() => { if (document.visibilityState === 'visible' && estado.usuario && !estado.bloqueado && !document.querySelector('.velo')) montar(); }, 10 * 60 * 1000);
  // App instalable en el teléfono
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (hayToken()) {
    try { await iniciarSesion(await api('/api/yo')); return; } catch { /* token vencido */ }
  }
  mostrarEntrada();
});
