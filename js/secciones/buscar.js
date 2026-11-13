// ─── Buscar comentarios: filtros, resultados por página, ocultar (admin) y Excel (admin) ───
import { api, descargar } from '../api.js';
import { esc, num, tarjeta, vacio, aviso, demorar } from '../ui.js';
import { comentarioConAcciones, enlazarOcultar, fichaPublicacion } from './comunicacion.js';

const CATEGORIAS = ['Motos en banqueta', 'Multas injustas / abusivas', 'Corrupción / mordida', 'Falta de operativos', 'Cepos / inmovilizadores', 'Congestión / tráfico',
  'Transporte público', 'Taxis / transporte pirata', 'Licencias', 'Educación vial', 'Semáforos / señalización', 'Vehículos / vendedores que apartan parqueo',
  'Ventas / obstáculos en vía pública', 'Doble moral / vehículos oficiales', 'Infraestructura vial', 'Accidentes / seguridad vial'];

export async function montar(cont, ctx) {
  const op = await api('/api/opciones-filtro');
  const f = { texto: ctx.parametros.texto || '', red: '', sentimiento: '', tema: '', emocion: '', zona: '', colonia: '', categoria: '', peticion: '', agente: '', orden: '', pagina: 1 };
  const sel = (id, etq, opciones) => `<label class="campo">${etq}<select data-f="${id}"><option value="">Todos</option>${opciones.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`).join('')}</select></label>`;
  cont.innerHTML = `
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', cuerpo: `
      <div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <label class="campo doble">Palabra, frase o autor<input type="search" data-f="texto" value="${esc(f.texto)}" placeholder="Ej.: motos en banqueta, Roosevelt, cepo…"></label>
        ${sel('red', 'Red', op.redes)}
        ${sel('sentimiento', 'Sentimiento', [['negativo', 'Negativo'], ['positivo', 'Positivo'], ['neutro', 'Neutro']])}
        ${sel('categoria', 'Tipo de queja', CATEGORIAS)}
        ${sel('tema', 'Tema', op.temas)}
        ${sel('emocion', 'Emoción', op.emociones)}
        <label class="campo">Zona<input type="text" data-f="zona" placeholder="Ej.: zona 7"></label>
        <label class="campo">Colonia<input type="text" data-f="colonia" list="listaColonias" placeholder="Escribe o elige"><datalist id="listaColonias">${op.colonias.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        ${sel('orden', 'Ordenar', [['', 'Más recientes'], ['intensidad', 'Más intensos']]).replace('<option value="">Todos</option>', '')}
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:12px">
        <label class="check"><input type="checkbox" data-f="peticion" value="1"> Solo peticiones</label>
        <label class="check"><input type="checkbox" data-f="agente" value="1"> Solo sobre agentes</label>
        <span style="margin-left:auto;display:flex;gap:8px">${ctx.esAdmin ? '<button class="btn chico primario" id="btnExcel">Descargar Excel</button>' : ''}<button class="btn chico" id="btnLimpiar">Limpiar filtros</button></span>
      </div>` })}
    <div class="c12"><div class="nota" id="conteo" style="margin-bottom:10px"></div><div id="resultados"></div><div id="pag" style="display:flex;gap:8px;justify-content:center;margin-top:16px"></div></div>
  </div>`;

  const params = () => ({ ...Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'pagina')), dias: ctx.dias });
  const cargar = async () => {
    const caja = cont.querySelector('#resultados');
    caja.innerHTML = '<div class="tarjeta cargando"></div>';
    try {
      const r = await api('/api/buscar', { params: { ...params(), pagina: f.pagina, limite: 30 } });
      cont.querySelector('#conteo').textContent = `${num(r.total)} comentarios encontrados${ctx.dias ? ` en los últimos ${ctx.dias} días` : ''}`;
      caja.innerHTML = r.datos.length ? `<div class="lista-com">${r.datos.map(c => comentarioConAcciones(c, ctx)).join('')}</div>` : `<div class="tarjeta">${vacio('No hay comentarios con estos filtros.')}</div>`;
      // enlace a la publicación de cada comentario
      caja.querySelectorAll('.comentario').forEach((el, i) => {
        const c = r.datos[i]; if (!c?.post_ref) return;
        const a = document.createElement('a'); a.href = '#'; a.textContent = 'Ver publicación y su análisis'; a.style.fontSize = '12px';
        a.onclick = (e) => { e.preventDefault(); fichaPublicacion(c.post_ref, ctx); };
        el.appendChild(a);
      });
      enlazarOcultar(caja);
      cont.querySelector('#pag').innerHTML = r.paginas > 1 ? `<button class="btn chico" ${r.pagina <= 1 ? 'disabled' : ''} data-pg="-1">← Anterior</button><span class="nota">Página ${r.pagina} de ${r.paginas}</span><button class="btn chico" ${r.pagina >= r.paginas ? 'disabled' : ''} data-pg="1">Siguiente →</button>` : '';
      cont.querySelectorAll('#pag [data-pg]').forEach(b => b.onclick = () => { f.pagina += +b.dataset.pg; cargar(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    } catch (e) { caja.innerHTML = `<div class="tarjeta"><div class="vacio">⚠ ${esc(e.message)}</div></div>`; }
  };
  const recargar = demorar(() => { f.pagina = 1; cargar(); }, 400);
  cont.querySelectorAll('[data-f]').forEach(el => {
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => { f[el.dataset.f] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value.trim(); recargar(); });
  });
  cont.querySelector('#btnLimpiar').onclick = () => {
    for (const k of Object.keys(f)) f[k] = k === 'pagina' ? 1 : '';
    cont.querySelectorAll('[data-f]').forEach(el => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; });
    cargar();
  };
  const bx = cont.querySelector('#btnExcel');
  if (bx) bx.onclick = async () => {
    bx.disabled = true; bx.textContent = 'Preparando…';
    try { await descargar('/api/exportar/comentarios', params()); } catch (e) { aviso(e.message, 'error'); }
    finally { bx.disabled = false; bx.textContent = 'Descargar Excel'; }
  };
  await cargar();
}
