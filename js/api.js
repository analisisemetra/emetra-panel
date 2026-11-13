// ─── Conexión con el servidor ───
// Si algún día cambia la dirección del servidor, solo se cambia esta línea.
export const SERVIDOR = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? (localStorage.getItem('emetra.servidor') || 'http://localhost:4100')
  : 'https://sentinela-emetra.up.railway.app';

let token = null;
try { token = sessionStorage.getItem('emetra.token'); } catch { token = null; }

export function fijarToken(t) {
  token = t;
  try { t ? sessionStorage.setItem('emetra.token', t) : sessionStorage.removeItem('emetra.token'); } catch { /* sin almacenamiento */ }
}
export function hayToken() { return !!token; }

// Página de redes que se está viendo (EMETRA, otra página, o "todas")
let pagina = null;
try { pagina = sessionStorage.getItem('emetra.pagina'); } catch { pagina = null; }
export function fijarPagina(p) {
  pagina = p ? String(p) : null;
  try { pagina ? sessionStorage.setItem('emetra.pagina', pagina) : sessionStorage.removeItem('emetra.pagina'); } catch { /* */ }
}
export function paginaActual() { return pagina; }

// Rango de fechas "desde–hasta" (si está elegido, manda sobre "últimos N días")
let rango = null;
try { rango = JSON.parse(sessionStorage.getItem('emetra.rango') || 'null'); } catch { rango = null; }
export function fijarRango(r) {
  rango = r && r.desde && r.hasta ? { desde: r.desde, hasta: r.hasta } : null;
  try { rango ? sessionStorage.setItem('emetra.rango', JSON.stringify(rango)) : sessionStorage.removeItem('emetra.rango'); } catch { /* */ }
}
export function rangoActual() { return rango; }

export class ErrorApi extends Error {
  constructor(mensaje, estado, datos) { super(mensaje); this.estado = estado; this.datos = datos; }
}

// Al recibir 401 o 451 la aplicación decide qué hacer (volver a entrar / aceptar acuerdo)
let alExpirar = () => {}, alFaltaAcuerdo = () => {}, alCambiarPass = () => {};
export function alEventos({ expiro, acuerdo, cambiarPass }) { if (expiro) alExpirar = expiro; if (acuerdo) alFaltaAcuerdo = acuerdo; if (cambiarPass) alCambiarPass = cambiarPass; }

export async function api(ruta, { metodo = 'GET', cuerpo, form, params } = {}) {
  let url = SERVIDOR + ruta;
  if (rango && metodo === 'GET' && !(params && ('desde' in params || 'aDesde' in params))) params = { ...(params || {}), desde: rango.desde, hasta: rango.hasta };
  if (params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
    const s = q.toString(); if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (pagina) headers['X-Pagina'] = pagina;
  if (cuerpo) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(url, { method: metodo, headers, body: form || (cuerpo ? JSON.stringify(cuerpo) : undefined) });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. Revisa tu internet o que el servidor esté encendido.', 0);
  }
  let datos = null;
  try { datos = await r.json(); } catch { datos = null; }
  if (r.status === 401 && ruta !== '/api/login') { alExpirar(datos?.error); throw new ErrorApi(datos?.error || 'Sesión vencida.', 401); }
  if (r.status === 451) { alFaltaAcuerdo(); throw new ErrorApi(datos?.error || 'Debes aceptar el acuerdo.', 451); }
  if (r.status === 403 && datos?.cambiarPass) { alCambiarPass(); throw new ErrorApi(datos.error, 403); }
  if (!r.ok) throw new ErrorApi(datos?.error || `Error ${r.status}`, r.status, datos);
  return datos;
}

// Descarga un archivo (Excel) respetando la sesión
export async function descargar(ruta, params, nombreRespaldo = 'emetra.xlsx') {
  if (rango) params = { ...(params || {}), desde: rango.desde, hasta: rango.hasta };
  const q = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  const r = await fetch(SERVIDOR + ruta + q, { headers: { Authorization: 'Bearer ' + token, ...(pagina ? { 'X-Pagina': pagina } : {}) } });
  if (!r.ok) { let e = null; try { e = await r.json(); } catch {} throw new ErrorApi(e?.error || 'No se pudo descargar.', r.status); }
  const blob = await r.blob();
  const nombre = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || nombreRespaldo;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
