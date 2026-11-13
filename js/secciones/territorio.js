// ─── Territorio: mapa, colonias, esquinas, denuncias, bitácora y chapas ───
import { api } from '../api.js';
import { esc, num, fecha, haceCuanto, tarjeta, listaBarras, enlazarLista, animarBarras, animarNumeros, escalonar, vacio, aviso, ventana, confirmar, comentarioHTML, COLOR, pestanas, marcarPestana } from '../ui.js';
import { chispa } from '../graficas.js';
import { Mapa } from '../mapa.js';

const CATEGORIAS = ['Motos en banqueta', 'Multas injustas / abusivas', 'Corrupción / mordida', 'Falta de operativos', 'Cepos / inmovilizadores', 'Congestión / tráfico',
  'Transporte público', 'Taxis / transporte pirata', 'Licencias', 'Educación vial', 'Semáforos / señalización', 'Vehículos / vendedores que apartan parqueo',
  'Ventas / obstáculos en vía pública', 'Doble moral / vehículos oficiales', 'Infraestructura vial', 'Accidentes / seguridad vial'];
const TIPOS_HECHO = { operativo: 'Operativo', cierre: 'Cierre vial', declaracion: 'Declaración', accidente: 'Accidente', evento: 'Evento', otro: 'Otro' };
const ordenZona = (a, b) => (parseInt(String(a).replace(/\D/g, '')) || 99) - (parseInt(String(b).replace(/\D/g, '')) || 99);

export async function montar(cont, ctx) {
  const esJefe = ctx.usuario.rol === 'jefe_zona';
  const PEST = [['mapa', 'Mapa'], ['colonias', 'Colonias por zona'], ['esquinas', 'Esquinas repetidas'], ['denuncias', 'Denuncias'], ['bitacora', 'Bitácora y efecto'], ['chapas', 'Chapas']];
  if (ctx.esAdmin) PEST.push(['lugares', 'Lugares por confirmar']);
  let actual = ctx.parametros.v && PEST.some(p => p[0] === ctx.parametros.v) ? ctx.parametros.v : (esJefe ? 'denuncias' : 'mapa');

  cont.innerHTML = `${pestanas(PEST, actual)}<div id="vista"></div>`;
  const vista = cont.querySelector('#vista');
  const abrir = async (k) => {
    actual = k;
    marcarPestana(cont.querySelector('#pestanas'), k);
    history.replaceState(null, '', `#territorio?v=${k}`);
    vista.innerHTML = '<div class="tarjeta cargando"></div>';
    try { await VISTAS[k](vista, ctx); escalonar(vista.querySelector('.rejilla')); animarBarras(vista); animarNumeros(vista); }
    catch (e) { if (e.estado !== 401 && e.estado !== 451) vista.innerHTML = `<div class="tarjeta"><div class="vacio t-neg">⚠ ${esc(e.message)}</div></div>`; }
  };
  cont.querySelectorAll('#pestanas .f').forEach(b => b.onclick = () => abrir(b.dataset.p));
  await abrir(actual);
}

const VISTAS = { mapa: vistaMapa, colonias: vistaColonias, esquinas: vistaEsquinas, denuncias: vistaDenuncias, bitacora: vistaBitacora, chapas: vistaChapas, lugares: vistaLugares };

// ═════════ MAPA ═════════
async function vistaMapa(el, ctx) {
  const f = { capa: 'quejas', categoria: '', tema: '', posts: false };
  const opciones = await api('/api/opciones-filtro').catch(() => ({ temas: [] }));
  el.innerHTML = `
  <div class="rejilla">
    <section class="tarjeta c12" style="padding:14px 18px">
      <div class="form" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <label class="campo">Qué mostrar<select id="fCapa"><option value="quejas">Solo quejas (negativos)</option><option value="todos">Todos los comentarios</option></select></label>
        <label class="campo">Tipo de queja<select id="fCat"><option value="">Todas</option>${CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label class="campo">Tema<select id="fTema"><option value="">Todos</option>${(opciones.temas || []).map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
        <label class="check" style="padding-bottom:10px"><input type="checkbox" id="fPosts"> Ver publicaciones (chapas)</label>
      </div>
    </section>
    <section class="tarjeta c12"><div class="kpis" id="kpisMapa"></div></section>
    ${tarjeta({ clase: 'c8', titulo: 'Mapa de la ciudad', nota: 'De lejos se ven las zonas; al acercarte aparecen colonias y direcciones exactas. Toca un círculo para ver el detalle.', cuerpo: '<div class="mapa" id="mapa"></div><div class="leyenda" style="margin-top:10px"><span><i style="background:#f2b33d"></i>Pocas</span><span><i style="background:#f0616d"></i>Muchas</span><span id="leyPost" class="oculto"><i style="background:#7f8cff"></i>Publicación con chapa</span></div>' })}
    ${tarjeta({ clase: 'c4', titulo: 'Zonas', nota: 'Toca una zona para ver sus colonias', cuerpo: '<div id="listaZonas"></div>' })}
    ${tarjeta({ clase: 'c6', titulo: 'Colonias con más quejas', nota: 'Toca una colonia para abrir su ficha', cuerpo: '<div id="listaColonias"></div>' })}
    ${tarjeta({ clase: 'c6', titulo: 'Fuera de la capital', nota: 'Se cuentan aparte y no van al mapa', cuerpo: '<div id="listaFuera"></div>' })}
  </div>`;
  const mapa = new Mapa(el.querySelector('#mapa'));
  const listo = await mapa.iniciar();

  const cargar = async () => {
    const d = await api('/api/mapa', { params: { dias: ctx.dias, capa: f.capa, categoria: f.categoria, tema: f.tema } });
    const ubicados = d.total - d.sinUbicar;
    el.querySelector('#kpisMapa').innerHTML = [
      ['Con ubicación', ubicados, `${d.total ? Math.round(ubicados / d.total * 100) : 0}% de ${num(d.total)} ${f.capa === 'quejas' ? 'quejas' : 'comentarios'}`],
      ['Zonas con menciones', d.zonas.length, 'de la Ciudad de Guatemala'],
      ['Colonias ubicadas', d.colonias.length, 'se agregan solas al catálogo'],
      ['Fuera de la capital', d.fueraCapital.reduce((s, x) => s + x.n, 0), `${d.fueraCapital.length} municipios`],
    ].map(([t, v, p]) => `<div class="kpi"><span class="etq">${t}</span><span class="valor"><span data-num="${v}">0</span></span><span class="pie">${p}</span></div>`).join('')
      + (ctx.esAdmin && d.porConfirmar ? `<div class="guia ancho-total">Hay <b>${num(d.porConfirmar)} lugares por confirmar</b> (nombres ambiguos que Google no pudo ubicar con seguridad). Revísalos en la pestaña «Lugares por confirmar».</div>` : '');
    animarNumeros(el.querySelector('#kpisMapa'));

    const zonas = d.zonas.slice().sort((a, b) => b.total - a.total);
    el.querySelector('#listaZonas').innerHTML = listaBarras(zonas.map(z => ({ nom: z.zona, n: z.total })), { color: f.capa === 'quejas' ? COLOR.negativo : COLOR.lima, alClic: true });
    enlazarLista(el.querySelector('#listaZonas'), zonas, (z) => coloniasDeZona(z.zona, ctx));
    el.querySelector('#listaColonias').innerHTML = d.colonias.length ? `<div class="tabla-caja desplazable"><table class="tabla"><thead><tr><th>Colonia</th><th>Zona</th><th class="n">${f.capa === 'quejas' ? 'Quejas' : 'Coment.'}</th><th>Lo que más se repite</th></tr></thead><tbody>
      ${d.colonias.slice(0, 40).map((c, i) => `<tr data-i="${i}" style="cursor:pointer"><td><b>${esc(c.colonia)}</b></td><td>${esc(c.zona || '—')}</td><td style="text-align:right" class="tnum">${num(c.total)}</td><td class="nota">${c.topDolores.map(x => esc(x.dolor)).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no hay colonias ubicadas en este periodo.');
    el.querySelectorAll('#listaColonias tr[data-i]').forEach(tr => tr.onclick = () => { const c = d.colonias[+tr.dataset.i]; fichaColonia(c.colonia, c.zona, ctx); });
    el.querySelector('#listaFuera').innerHTML = listaBarras(d.fueraCapital.map(x => ({ nom: x.municipio, n: x.n })), { color: COLOR.pizarra });
    animarBarras(el);

    if (listo) {
      const puntos = [
        ...d.zonas.filter(z => z.lat).map(z => ({ nivel: 'zona', lat: z.lat, lng: z.lng, total: z.total, titulo: z.zona, detalle: `${num(z.total)} ${f.capa === 'quejas' ? 'quejas' : 'comentarios'}`, datos: z })),
        ...d.colonias.map(c => ({ nivel: 'colonia', lat: c.lat, lng: c.lng, total: c.total, titulo: `${c.colonia} · ${c.zona || ''}`, detalle: `${num(c.total)} · ${c.topDolores.map(x => esc(x.dolor)).join(', ')}<br><a href="#" style="color:#060e97">Abrir ficha de la colonia</a>`, datos: c })),
        ...d.puntos.map(p => ({ nivel: 'punto', lat: p.lat, lng: p.lng, total: p.total, titulo: p.lugar, detalle: `${esc([p.colonia, p.zona].filter(Boolean).join(' · '))}<br>${num(p.total)} menciones`, datos: p })),
        ...(f.posts ? d.publicaciones.map(p => ({ nivel: 'post', lat: p.lat, lng: p.lng, total: 1, color: COLOR.info, titulo: (p.chapas || []).length ? `Chapa ${p.chapas.join(', ')}` : 'Publicación', detalle: `${esc(fecha(p.fecha))} · ${esc(p.tipo_hecho || '')}<br>${esc((p.texto || '').slice(0, 120))}…`, datos: p })) : []),
      ];
      mapa.dibujar(puntos, { alClic: (p) => { if (p.nivel === 'colonia') fichaColonia(p.datos.colonia, p.datos.zona, ctx); } });
    }
  };
  el.querySelector('#fCapa').onchange = (e) => { f.capa = e.target.value; cargar(); };
  el.querySelector('#fCat').onchange = (e) => { f.categoria = e.target.value; cargar(); };
  el.querySelector('#fTema').onchange = (e) => { f.tema = e.target.value; cargar(); };
  el.querySelector('#fPosts').onchange = (e) => { f.posts = e.target.checked; el.querySelector('#leyPost').classList.toggle('oculto', !f.posts); cargar(); };
  await cargar();
}

async function coloniasDeZona(zona, ctx) {
  const v = ventana(`Colonias de ${zona}`, '<div class="cargando bloque"></div>', { ancha: true });
  const d = await api('/api/colonias', { params: { dias: ctx.dias } });
  const lista = d.porZona[zona] || [];
  v.cuerpo.innerHTML = lista.length ? tablaColonias(lista) : vacio('Nadie ha mencionado colonias de esta zona en el periodo.');
  v.cuerpo.querySelectorAll('tr[data-c]').forEach(tr => tr.onclick = () => { v.cerrar(); fichaColonia(tr.dataset.c, zona, ctx); });
}
function tablaColonias(lista) {
  return `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Colonia</th><th class="n">Comentarios</th><th class="n">Quejas</th><th>Última mención</th></tr></thead><tbody>
    ${lista.map(c => `<tr data-c="${esc(c.colonia)}" style="cursor:pointer"><td><b>${esc(c.colonia)}</b></td><td class="n">${num(c.total)}</td>
    <td class="n" style="color:${c.negativos ? COLOR.negativo : 'inherit'}">${num(c.negativos)}</td><td class="nota">${c.ultima ? haceCuanto(c.ultima) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

export async function fichaColonia(nombre, zona, ctx) {
  const v = ventana(`${nombre}${zona ? ' · ' + zona : ''}`, '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const d = await api('/api/colonia', { params: { nombre, zona: zona && zona !== 'Sin zona' ? zona : '', dias: ctx.dias } });
    const s = d.sentimiento;
    v.cuerpo.innerHTML = `
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:18px">
        <div class="kpi"><span class="etq">Comentarios</span><span class="valor">${num(d.total)}</span></div>
        <div class="kpi"><span class="etq">Negativo</span><span class="valor t-neg">${s.negativo}<small>%</small></span></div>
        <div class="kpi"><span class="etq">Positivo</span><span class="valor t-pos">${s.positivo}<small>%</small></span></div>
        <div style="margin-left:auto">${chispa(d.tendencia.map(t => t.negativos), COLOR.negativo, 180, 40)}<div class="nota">Quejas por semana</div></div>
      </div>
      <div class="rejilla interna">
        <div class="c6"><h4>Quejas ordenadas</h4>${listaBarras(d.quejas.map(x => ({ nom: x.dolor, n: x.n })), { color: COLOR.negativo })}</div>
        <div class="c6"><h4>¿A quién culpan?</h4>${listaBarras(d.culpables.slice(0, 6).map(x => ({ nom: x.senalado, n: x.n })), { color: COLOR.ambar })}
          <h4 style="margin:18px 0 10px">Lugares exactos que mencionan</h4>${d.esquinas.length ? d.esquinas.map(e => `<div style="font-size:13px;margin-bottom:5px">📍 ${esc(e.lugar)} <span class="nota">(${e.n})</span></div>`).join('') : '<div class="nota">Sin direcciones exactas.</div>'}</div>
        <div class="c12"><h4 style="margin:6px 0 10px">Comentarios recientes</h4><div class="lista-com desplazable">${d.comentarios.map(c => comentarioHTML(c)).join('') || vacio()}</div></div>
      </div>`;
    animarBarras(v.cuerpo);
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

// ═════════ COLONIAS ═════════
async function vistaColonias(el, ctx) {
  const d = await api('/api/colonias', { params: { dias: ctx.dias } });
  const zonas = Object.keys(d.porZona).sort(ordenZona);
  el.innerHTML = `<div class="guia">El catálogo se arma solo: cada colonia que la gente menciona queda guardada dentro de su zona. ${num(d.total)} colonias en el periodo.</div>
    <div class="rejilla">${zonas.length ? zonas.map(z => {
      const l = d.porZona[z]; const neg = l.reduce((s, c) => s + c.negativos, 0);
      return tarjeta({ clase: 'c4', titulo: esc(z), nota: `${l.length} colonias · ${num(neg)} quejas`, cuerpo: `<div data-z="${esc(z)}">${listaBarras(l.slice(0, 8).map(c => ({ nom: c.colonia, n: c.negativos })), { color: COLOR.negativo, alClic: true })}${l.length > 8 ? `<button class="btn chico" data-todas style="margin-top:10px">Ver las ${l.length}</button>` : ''}</div>` });
    }).join('') : `<div class="c12 tarjeta">${vacio('Aún no se han mencionado colonias.')}</div>`}</div>`;
  el.querySelectorAll('[data-z]').forEach(box => {
    const z = box.dataset.z, l = d.porZona[z];
    enlazarLista(box, l.slice(0, 8), (c) => fichaColonia(c.colonia, z, ctx));
    const b = box.querySelector('[data-todas]'); if (b) b.onclick = () => coloniasDeZona(z, ctx);
  });
}

// ═════════ ESQUINAS ═════════
async function vistaEsquinas(el, ctx) {
  const d = await api('/api/esquinas', { params: { dias: ctx.dias } });
  el.innerHTML = `<div class="guia">Direcciones y puntos de referencia exactos que la gente repite (por ejemplo «Calzada Roosevelt y 17 avenida»). Donde se repite una queja, hay un problema concreto.</div>
  <div class="rejilla">${tarjeta({ clase: 'c12', titulo: 'Esquinas y puntos que más se repiten', cuerpo: d.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>#</th><th>Lugar</th><th>Zona / colonia</th><th class="n">Quejas</th><th class="n">Total</th><th>Qué reclaman</th><th>Última</th></tr></thead><tbody>
    ${d.map((x, i) => `<tr><td class="nota">${i + 1}</td><td><b>${esc(x.lugar)}</b>${x.estado !== 'confirmado' ? ' <span class="chip ambar">sin ubicar</span>' : ''}</td><td>${esc([x.zona, x.colonia].filter(Boolean).join(' · ') || '—')}</td>
    <td class="n" style="color:${COLOR.negativo};font-weight:700">${num(x.negativos)}</td><td class="n">${num(x.total)}</td><td class="nota">${x.topDolores.map(t => esc(t.dolor)).join(' · ') || '—'}</td><td class="nota">${haceCuanto(x.ultima)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Todavía no hay direcciones exactas repetidas.') })}</div>`;
}

// ═════════ DENUNCIAS ═════════
async function vistaDenuncias(el, ctx) {
  const esJefe = ctx.usuario.rol === 'jefe_zona';
  const f = { estado: 'pendiente', zona: '', mias: esJefe ? '1' : '', pagina: 1 };
  const tiempos = await api('/api/denuncias/tiempos', { params: { dias: ctx.dias } });
  const tot = tiempos.reduce((a, t) => ({ total: a.total + t.total, at: a.at + t.atendidas, pe: a.pe + t.pendientes }), { total: 0, at: 0, pe: 0 });
  const conHoras = tiempos.filter(t => t.horas_promedio != null);
  const prom = conHoras.length ? conHoras.reduce((s, t) => s + t.horas_promedio * t.atendidas, 0) / Math.max(1, conHoras.reduce((s, t) => s + t.atendidas, 0)) : null;
  el.innerHTML = `
  ${esJefe ? `<div class="guia">Eres jefe de <b>${esc((ctx.usuario.zonas || []).join(', ') || 'zona sin asignar')}</b>. Ves todas las denuncias, pero solo puedes marcar como atendidas las de tu zona.</div>` : '<div class="guia">Una queja se vuelve <b>denuncia</b> cuando pide algo concreto o da un lugar exacto (dirección, esquina o colonia), y se asigna al jefe de esa zona. Las quejas generales se ven en Opinión pero no hay que atenderlas una por una.</div>'}
  <div class="rejilla">
    <section class="tarjeta c12"><div class="kpis">
    <div class="kpi"><span class="etq">Pendientes</span><span class="valor t-ambar"><span data-num="${tot.pe}">0</span></span><span class="pie">de ${num(tot.total)} denuncias del periodo</span></div>
    <div class="kpi"><span class="etq">Atendidas</span><span class="valor t-pos"><span data-num="${tot.at}">0</span></span><span class="pie">${tot.total ? Math.round(tot.at / tot.total * 100) : 0}% del total</span></div>
    <div class="kpi"><span class="etq">Tiempo promedio</span><span class="valor">${prom == null ? '—' : prom < 48 ? `${num(prom, 1)}<small> h</small>` : `${num(prom / 24, 1)}<small> días</small>`}</span><span class="pie">desde el comentario hasta marcarla</span></div>
    <div class="kpi"><span class="etq">Zonas con pendientes</span><span class="valor"><span data-num="${tiempos.filter(t => t.pendientes).length}">0</span></span><span class="pie">de ${tiempos.length} con denuncias</span></div>
    </div></section>
    ${tarjeta({ clase: 'c12', titulo: 'Respuesta por zona', nota: 'Vista por jefe de zona', cuerpo: tiempos.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Zona</th><th>Jefe asignado</th><th class="n">Total</th><th class="n">Pendientes</th><th class="n">Atendidas</th><th class="n">Tiempo promedio</th></tr></thead><tbody>
      ${tiempos.map(t => `<tr data-zona="${esc(t.zona)}" style="cursor:pointer"><td><b>${esc(t.zona)}</b></td><td>${t.jefe ? esc(t.jefe) : '<span class="chip ambar">Sin jefe</span>'}</td><td class="n">${num(t.total)}</td>
      <td class="n" style="color:${t.pendientes ? COLOR.ambar : 'inherit'};font-weight:700">${num(t.pendientes)}</td><td class="n">${num(t.atendidas)}</td>
      <td class="n">${t.horas_promedio == null ? '—' : t.horas_promedio < 48 ? num(t.horas_promedio, 1) + ' h' : num(t.horas_promedio / 24, 1) + ' días'}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin denuncias en el periodo.') })}
    ${tarjeta({ clase: 'c12', id: 'tDen', titulo: 'Denuncias', acciones: `<div class="filtros" id="fEstado">${[['pendiente', 'Pendientes'], ['atendida', 'Atendidas'], ['descartada', 'Descartadas'], ['', 'Todas']].map(([k, t]) => `<button class="f" data-e="${k}">${t}</button>`).join('')}
        ${esJefe ? `<label class="check" style="margin-left:8px"><input type="checkbox" id="fMias" checked> Solo mi zona</label>` : ''}</div>`,
      cuerpo: '<div id="filtroZona" class="nota" style="margin-bottom:8px"></div><div id="listaDen"></div><div id="pagDen" style="display:flex;gap:8px;justify-content:center;margin-top:14px"></div>' })}
  </div>`;

  const cargar = async () => {
    el.querySelectorAll('#fEstado .f').forEach(b => b.classList.toggle('activo', b.dataset.e === f.estado));
    el.querySelector('#filtroZona').innerHTML = f.zona ? `Mostrando solo <b>${esc(f.zona)}</b> · <a href="#" id="quitarZona">quitar filtro</a>` : '';
    const q = el.querySelector('#quitarZona'); if (q) q.onclick = (e) => { e.preventDefault(); f.zona = ''; f.pagina = 1; cargar(); };
    const caja = el.querySelector('#listaDen'); caja.innerHTML = '<div class="cargando bloque"></div>';
    const r = await api('/api/denuncias', { params: { dias: ctx.dias, estado: f.estado, zona: f.zona, mias: f.mias, pagina: f.pagina, limite: 20 } });
    caja.innerHTML = r.datos.length ? `<div class="lista-com">${r.datos.map(denunciaHTML).join('')}</div>` : vacio(f.estado === 'pendiente' ? 'No hay denuncias pendientes. 👍' : 'Sin denuncias con este filtro.');
    el.querySelector('#pagDen').innerHTML = r.paginas > 1 ? `<button class="btn chico" ${r.pagina <= 1 ? 'disabled' : ''} data-pg="-1">← Anterior</button><span class="nota">Página ${r.pagina} de ${r.paginas} · ${num(r.total)}</span><button class="btn chico" ${r.pagina >= r.paginas ? 'disabled' : ''} data-pg="1">Siguiente →</button>` : '';
    el.querySelectorAll('#pagDen [data-pg]').forEach(b => b.onclick = () => { f.pagina += +b.dataset.pg; cargar(); });
    caja.querySelectorAll('[data-marcar]').forEach(b => b.onclick = () => marcar(b.dataset.id, b.dataset.marcar, cargar, ctx));
  };
  el.querySelectorAll('#fEstado .f').forEach(b => b.onclick = () => { f.estado = b.dataset.e; f.pagina = 1; cargar(); });
  const m = el.querySelector('#fMias'); if (m) m.onchange = () => { f.mias = m.checked ? '1' : ''; f.pagina = 1; cargar(); };
  el.querySelectorAll('tr[data-zona]').forEach(tr => tr.onclick = () => { f.zona = tr.dataset.zona === 'Sin zona' ? '' : tr.dataset.zona; f.pagina = 1; cargar(); el.querySelector('#tDen').scrollIntoView({ behavior: 'smooth' }); });
  await cargar();

  function denunciaHTML(d) {
    const EST = { pendiente: ['ambar', 'Pendiente'], atendida: ['pos', 'Atendida'], descartada: ['neu', 'Descartada'] };
    const [cl, tx] = EST[d.estado] || EST.pendiente;
    const lugar = [d.direccion || d.lugar_texto, d.colonia, d.zona].filter(Boolean).join(' · ');
    return `<div class="comentario">
      <div class="meta"><span class="chip ${cl}">${tx}</span><span>${esc(d.red || '')}</span>${d.autor ? `<span>· ${esc(d.autor)}</span>` : ''}<span>· ${fecha(d.fecha, true)}</span>
        ${d.permalink ? `<a href="${esc(d.permalink)}" target="_blank" rel="noopener" class="a-derecha">Ver ↗</a>` : ''}</div>
      <div class="txt">${esc(d.texto)}</div>
      <div class="meta">${lugar ? `<span>📍 <b>${esc(lugar)}</b></span>` : ''}${d.dolor ? `<span>· ${esc(d.dolor)}</span>` : ''}<span>· Asignada a: <b>${esc(d.asignada_a_nombre || 'sin jefe')}</b></span>
        ${d.estado === 'atendida' ? `<span>· Atendida ${haceCuanto(d.atendida_en)} por ${esc(d.atendida_por || '')}</span>` : ''}${d.nota ? `<span>· Nota: ${esc(d.nota)}</span>` : ''}</div>
      ${d.puedoMarcar ? `<div class="linea sep">
        ${d.estado !== 'atendida' ? `<button class="btn chico primario" data-marcar="atendida" data-id="${d.id}">Marcar atendida</button>` : `<button class="btn chico" data-marcar="pendiente" data-id="${d.id}">Volver a pendiente</button>`}
        ${ctx.esAdmin && d.estado !== 'descartada' ? `<button class="btn chico" data-marcar="descartada" data-id="${d.id}">Descartar</button>` : ''}</div>` : ''}
    </div>`;
  }
}
async function marcar(id, estado, recargar) {
  const titulo = { atendida: 'Marcar como atendida', pendiente: 'Volver a pendiente', descartada: 'Descartar denuncia' }[estado];
  const v = ventana(titulo, `<label class="campo">Nota (opcional)<textarea id="nota" rows="3" maxlength="500" placeholder="${estado === 'atendida' ? 'Ej.: se envió patrulla, se retiraron las motos' : 'Motivo'}"></textarea></label>`,
    { pie: `<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>` });
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    try { await api(`/api/denuncias/${id}`, { metodo: 'PATCH', cuerpo: { estado, nota: v.cuerpo.querySelector('#nota').value.trim() || undefined } }); v.cerrar(); aviso('Denuncia actualizada.'); recargar(); }
    catch (e) { aviso(e.message, 'error'); }
  };
}

// ═════════ BITÁCORA ═════════
async function vistaBitacora(el, ctx) {
  const lista = await api('/api/bitacora', { params: { dias: ctx.dias || 365 } });
  el.innerHTML = `<div class="guia">Registra operativos, cierres o declaraciones. Para cada hecho, el tablero compara la zona <b>7 días antes y 7 días después</b> para responder: ¿funcionó? Los hechos también aparecen como marcas en la línea de tiempo de Ciudadanía.</div>
  <div class="rejilla">
    ${ctx.esAdmin ? tarjeta({ clase: 'c12', titulo: 'Registrar un hecho', cuerpo: `<form class="form" id="fBit">
      <label class="campo">Fecha y hora<input type="datetime-local" name="fecha" required></label>
      <label class="campo">Tipo<select name="tipo">${Object.entries(TIPOS_HECHO).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
      <label class="campo doble">Título<input type="text" name="titulo" required maxlength="160" placeholder="Ej.: Operativo contra motos en banqueta"></label>
      <label class="campo">Zona<input type="text" name="zona" placeholder="Ej.: zona 7"></label>
      <label class="campo">Colonia<input type="text" name="colonia" placeholder="Opcional"></label>
      <label class="campo ancho">Descripción<textarea name="descripcion" rows="2" placeholder="Opcional"></textarea></label>
      <div><button class="btn primario" type="submit">Guardar en la bitácora</button></div></form>` }) : ''}
    ${tarjeta({ clase: 'c12', titulo: 'Hechos registrados', nota: `${lista.length} en el periodo`, cuerpo: lista.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Fecha</th><th>Tipo</th><th>Hecho</th><th>Lugar</th><th></th></tr></thead><tbody>
      ${lista.map(b => `<tr><td class="chica">${fecha(b.fecha, true)}</td><td><span class="chip lima">${esc(TIPOS_HECHO[b.tipo] || b.tipo)}</span></td><td><b>${esc(b.titulo)}</b>${b.descripcion ? `<div class="nota">${esc(b.descripcion)}</div>` : ''}</td>
        <td>${esc([b.zona, b.colonia, b.lugar_texto].filter(Boolean).join(' · ') || 'Toda la ciudad')}</td>
        <td style="white-space:nowrap;text-align:right"><button class="btn chico primario" data-efecto="${b.id}">¿Funcionó?</button>${ctx.esAdmin ? ` <button class="btn chico" data-borrar="${b.id}" aria-label="Borrar">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no hay hechos registrados.') })}
    ${tarjeta({ clase: 'c12', titulo: 'Esquinas donde la queja vuelve', nota: 'Después de cada operativo con zona registrada',
      ayuda: 'Para cada hecho de la bitácora se miran los lugares de esa zona con quejas en las 2 semanas anteriores. «Volvió»: la queja bajó la semana del operativo pero regresó entre el día 8 y el 30. «Mejoró»: bajó y se mantuvo baja. Sirve para saber dónde repetir el operativo.',
      cuerpo: '<div id="vuelven"><div class="cargando bloque"></div></div>' })}
  </div>`;
  api('/api/esquinas-vuelven', { params: { dias: ctx.dias && ctx.dias > 90 ? ctx.dias : 90 } })
    .then(r => { const c = el.querySelector('#vuelven'); if (c) c.innerHTML = vuelvenHTML(r); })
    .catch(e => { const c = el.querySelector('#vuelven'); if (c) c.innerHTML = vacio(e.message); });
  const form = el.querySelector('#fBit');
  if (form) {
    const ahora = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 16); // hora de Guatemala
    form.fecha.value = ahora;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const x = Object.fromEntries(new FormData(form));
      try { await api('/api/bitacora', { metodo: 'POST', cuerpo: { ...x, fecha: x.fecha } }); aviso('Hecho registrado.'); vistaBitacora(el, ctx); }
      catch (err) { aviso(err.message, 'error'); }
    };
  }
  el.querySelectorAll('[data-efecto]').forEach(b => b.onclick = () => efecto(b.dataset.efecto));
  el.querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Borrar hecho', '¿Seguro que quieres borrar este hecho de la bitácora?', { texto: 'Borrar', peligro: true })) return;
    try { await api(`/api/bitacora/${b.dataset.borrar}`, { metodo: 'DELETE' }); aviso('Borrado.'); vistaBitacora(el, ctx); } catch (e) { aviso(e.message, 'error'); }
  });
}
async function efecto(id, dias = 7) {
  const v = ventana('¿Funcionó?', '<div class="cargando bloque"></div>');
  const pintar = async (n) => {
    const d = await api(`/api/bitacora/${id}/efecto`, { params: { dias: n } });
    const col = (x) => `<div style="flex:1;text-align:center;padding:14px;border:1px solid var(--borde);border-radius:12px">
      <div class="nota">${x === d.antes ? `${n} días antes` : `${n} días después`}</div>
      <div class="kpi"><span class="valor t-neg">${x.pctNegativo}<small>%</small></span></div><div class="nota">quejas · ${num(x.total)} comentarios</div></div>`;
    const c = d.cambioNegativo;
    v.cuerpo.innerHTML = `<div style="margin-bottom:6px"><b>${esc(d.hecho.titulo)}</b></div><div class="nota mb">${fecha(d.hecho.fecha, true)} · ${esc(d.zona)}</div>
      <div class="filtros" style="margin-bottom:14px">${[3, 7, 14, 30].map(k => `<button class="f ${k === n ? 'activo' : ''}" data-n="${k}">${k} días</button>`).join('')}</div>
      <div style="display:flex;gap:12px;align-items:center">${col(d.antes)}<div style="font-size:22px;font-weight:800;color:${c < -5 ? COLOR.positivo : c > 5 ? COLOR.negativo : COLOR.neutro}">${c > 0 ? '▲' : c < 0 ? '▼' : '='} ${Math.abs(c)}</div>${col(d.despues)}</div>
      <div class="guia" style="margin:16px 0 0"><b>${esc(d.lectura)}</b>${d.periodoCompleto ? '' : ' (El periodo de después aún no termina.)'}</div>`;
    v.cuerpo.querySelectorAll('[data-n]').forEach(b => b.onclick = () => pintar(+b.dataset.n));
  };
  try { await pintar(dias); } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

// ═════════ CHAPAS ═════════
async function vistaChapas(el, ctx) {
  const d = await api('/api/chapas', { params: { dias: ctx.dias } });
  el.innerHTML = `<div class="guia">Las chapas salen de los hashtags de las publicaciones (#chapa984). El sentimiento por chapa es <b>solo un dato de referencia</b> para revisar procedimientos: refleja la reacción al hecho publicado, no necesariamente la actuación del agente. Con menos de 15 comentarios se muestra «datos insuficientes».</div>
  <div class="rejilla">${tarjeta({ clase: 'c12', titulo: 'Agentes por chapa', nota: `${d.length} chapas en el periodo · toca una para ver su ficha`, cuerpo: d.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Chapa</th><th class="n">Hechos</th><th>Zonas donde trabaja</th><th class="n">Comentarios</th><th>Reacción de la gente</th><th>Último</th></tr></thead><tbody>
    ${d.map(c => `<tr data-chapa="${esc(c.numero)}" style="cursor:pointer"><td><b>#${esc(c.numero)}</b>${c.porConfirmar ? ' <span class="chip ambar" title="Solo aparece en una publicación: puede ser un error al escribir el hashtag">por confirmar</span>' : ''}</td><td class="n">${num(c.hechos)}</td>
      <td>${c.zonas.sort(ordenZona).map(z => `<span class="chip" style="margin:1px">${esc(z)}</span>`).join('') || '—'}</td><td class="n">${num(c.comentarios)}</td>
      <td style="min-width:150px">${c.suficiente ? `<div class="apilada" style="height:8px"><span style="width:${c.pctPositivo}%;background:${COLOR.positivo}"></span><span style="width:${100 - c.pctPositivo - c.pctNegativo}%;background:${COLOR.neutro}"></span><span style="width:${c.pctNegativo}%;background:${COLOR.negativo}"></span></div><div class="nota">${c.pctPositivo}% pos · ${c.pctNegativo}% neg</div>` : '<span class="nota">Datos insuficientes</span>'}</td>
      <td class="nota">${haceCuanto(c.ultimo)}</td></tr>`).join('')}</tbody></table></div>` : vacio('No hay publicaciones con #chapa en el periodo.') })}</div>`;
  el.querySelectorAll('tr[data-chapa]').forEach(tr => tr.onclick = () => fichaChapa(tr.dataset.chapa, ctx));
}
async function fichaChapa(numero, ctx) {
  const v = ventana(`Chapa #${numero}`, '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const d = await api(`/api/chapas/${numero}`, { params: { dias: ctx.dias } });
    const s = d.sentimiento;
    v.cuerpo.innerHTML = `
      ${d.porConfirmar ? '<div class="guia" style="margin-bottom:14px">Esta chapa aparece en una sola publicación: confirma que el número esté bien escrito en el hashtag.</div>' : ''}
      <div class="kpis mb">
        <div class="kpi"><span class="etq">Hechos publicados</span><span class="valor">${num(d.hechos)}</span></div>
        <div class="kpi"><span class="etq">Comentarios</span><span class="valor">${num(s.comentarios)}</span></div>
        ${s.suficiente ? `<div class="kpi"><span class="etq">Positivo</span><span class="valor t-pos">${s.pctPositivo}<small>%</small></span></div><div class="kpi"><span class="etq">Negativo</span><span class="valor t-neg">${s.pctNegativo}<small>%</small></span></div>`
          : `<div class="kpi"><span class="etq">Reacción</span><span class="valor" style="font-size:18px">Datos insuficientes</span><span class="pie">se necesitan ${s.minimo} comentarios</span></div>`}
      </div>
      <div class="nota" style="margin:-8px 0 16px">${esc(s.nota)}</div>
      <div class="rejilla interna">
        <div class="c4"><h4>Zonas</h4>${listaBarras(d.zonas.map(z => ({ nom: z.zona, n: z.n })), { color: COLOR.info })}</div>
        <div class="c4"><h4>Colonias</h4>${listaBarras(d.colonias.slice(0, 8).map(z => ({ nom: z.colonia, n: z.n })), { color: COLOR.info })}</div>
        <div class="c4"><h4>Tipo de hecho</h4>${listaBarras(Object.entries(d.tipos).map(([k, n]) => ({ nom: k, n })), { color: COLOR.lima })}</div>
        ${d.publicaciones.some(p => p.lat) ? `<div class="c12"><div class="mapa" id="mapaChapa" style="height:300px"></div></div>` : ''}
        <div class="c6"><h4>Publicaciones</h4><div style="max-height:340px;overflow-y:auto">${d.publicaciones.map(p => `<div class="comentario"><div class="meta"><span>${fecha(p.fecha_hora || p.fecha, !!p.fecha_hora)}</span>${p.tipo_hecho ? `<span class="chip lima">${esc(p.tipo_hecho)}</span>` : ''}${p.zona ? `<span class="chip">${esc(p.zona)}</span>` : ''}${p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener" class="a-derecha">Ver ↗</a>` : ''}</div><div class="txt">${esc((p.texto || '').slice(0, 220))}</div></div>`).join('') || vacio()}</div></div>
        <div class="c6"><h4>Comentarios sobre el agente</h4><div class="lista-com desplazable bajo">${d.sobreAgente.map(c => comentarioHTML(c)).join('') || vacio('Nadie comentó sobre el agente.')}</div></div>
      </div>`;
    animarBarras(v.cuerpo);
    const mc = v.cuerpo.querySelector('#mapaChapa');
    if (mc) { const m = new Mapa(mc); if (await m.iniciar()) m.dibujar(d.publicaciones.filter(p => p.lat).map(p => ({ nivel: 'post', lat: p.lat, lng: p.lng, total: 1, color: COLOR.info, titulo: p.lugar_texto || p.zona || 'Publicación', detalle: esc(fecha(p.fecha)) }))); }
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

// ═════════ LUGARES POR CONFIRMAR (admin) ═════════
async function vistaLugares(el, ctx, estado = 'por_confirmar') {
  const d = await api('/api/lugares', { params: { estado } });
  const cnt = Object.fromEntries(d.conteo.map(c => [c.estado, c.n]));
  const EST = [['por_confirmar', 'Por confirmar'], ['no_encontrado', 'No encontrados'], ['pendiente', 'En cola'], ['confirmado', 'Confirmados'], ['fuera_capital', 'Fuera de la capital'], ['descartado', 'Descartados']];
  el.innerHTML = `<div class="guia">Cuando alguien menciona un lugar ambiguo («la San Juan», «el puente»), Google puede devolver varias opciones. Aquí eliges la correcta, le pones una zona, lo marcas fuera de la capital o lo descartas. Se busca <b>una sola vez</b> por lugar. Búsquedas de Google este mes: <b>${num(d.busquedasGoogleMes)}</b>.</div>
  <div class="rejilla">${tarjeta({ clase: 'c12', titulo: 'Lugares', acciones: `<button class="btn chico" id="btnUbicar">Ubicar pendientes ahora</button>`,
    cuerpo: `<div class="filtros" style="margin-bottom:14px">${EST.map(([k, t]) => `<button class="f ${k === estado ? 'activo' : ''}" data-e="${k}">${t} · ${num(cnt[k] || 0)}</button>`).join('')}</div>
    ${d.lugares.length ? `<div class="lista-com">${d.lugares.map(l => `<div class="comentario" data-id="${l.id}">
      <div class="meta"><b style="color:var(--texto);font-size:14px">${esc(l.texto_original)}</b><span class="chip">${esc(l.tipo || 'lugar')}</span><span>· ${num(l.menciones)} menciones</span>${l.zona ? `<span>· ${esc(l.zona)}</span>` : ''}${l.colonia ? `<span>· ${esc(l.colonia)}</span>` : ''}${l.municipio ? `<span>· ${esc(l.municipio)}</span>` : ''}${l.confirmado_por ? `<span>· por ${esc(l.confirmado_por)}</span>` : ''}</div>
      ${(l.candidatos || []).length ? `<div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">${l.candidatos.map((c, i) => `<label class="check"><input type="radio" name="cand${l.id}" value="${i}"> ${esc(c.direccion || '')} ${c.zona ? `<span class="chip">${esc(c.zona)}</span>` : ''}</label>`).join('')}</div>` : ''}
      ${estado !== 'confirmado' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">
        <label class="campo" style="width:120px">Zona<input type="text" data-zona placeholder="zona 1" value="${esc(l.zona || '')}"></label>
        <label class="campo" style="width:180px">Colonia<input type="text" data-colonia placeholder="Opcional" value="${esc(l.colonia || '')}"></label>
        <button class="btn chico primario" data-acc="confirmar">Confirmar</button><button class="btn chico" data-acc="fuera">Fuera de la capital</button><button class="btn chico" data-acc="descartar">Descartar</button></div>` : ''}
    </div>`).join('')}</div>` : vacio('Nada en esta lista.')}` })}</div>`;
  el.querySelectorAll('.filtros [data-e]').forEach(b => b.onclick = () => vistaLugares(el, ctx, b.dataset.e));
  el.querySelector('#btnUbicar').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Ubicando…';
    try { const r = await api('/api/lugares/ubicar', { metodo: 'POST' }); aviso(`Listo: ${num(r.procesados || 0)} lugares revisados.`); vistaLugares(el, ctx, estado); }
    catch (err) { aviso(err.message, 'error'); e.target.disabled = false; e.target.textContent = 'Ubicar pendientes ahora'; }
  };
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => {
    const caja = b.closest('[data-id]'); const id = caja.dataset.id; const l = d.lugares.find(x => String(x.id) === id);
    let cuerpo;
    if (b.dataset.acc === 'descartar') cuerpo = { descartar: true };
    else if (b.dataset.acc === 'fuera') { const mu = prompt('¿Qué municipio? (ej.: Mixco, Villa Nueva)', l.municipio || ''); if (mu === null) return; cuerpo = { fueraCapital: true, municipio: mu.trim() || undefined }; }
    else {
      const sel = caja.querySelector('input[type=radio]:checked');
      cuerpo = { candidato: sel ? l.candidatos[+sel.value] : undefined, zona: caja.querySelector('[data-zona]').value.trim() || undefined, colonia: caja.querySelector('[data-colonia]').value.trim() || undefined };
      if (!cuerpo.candidato && !cuerpo.zona) return aviso('Elige una opción de Google o escribe la zona.', 'error');
    }
    try { await api(`/api/lugares/${id}`, { metodo: 'PATCH', cuerpo }); aviso('Lugar actualizado.'); caja.remove(); }
    catch (e) { aviso(e.message, 'error'); }
  });
}

function vuelvenHTML(lista) {
  const con = lista.filter(h => h.lugares.length);
  if (!con.length) return vacio('Todavía no hay operativos con zona y lugares con quejas antes del hecho para comparar.');
  const EST = { volvio: ['neg', 'Volvió'], mejoro: ['pos', 'Mejoró'], igual: ['neu', 'Sin cambio'] };
  return con.map(h => `<div style="margin-bottom:18px">
    <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px"><b>${esc(h.hecho.titulo)}</b><span class="nota">${fecha(h.hecho.fecha)} · ${esc(h.hecho.zona)}${h.periodoCompleto ? '' : ' · aún no pasan 30 días'}</span>
      ${h.volvieron ? `<span class="chip neg">${h.volvieron} volvieron</span>` : ''}${h.mejoraron ? `<span class="chip pos">${h.mejoraron} mejoraron</span>` : ''}</div>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th>Lugar</th><th class="n">2 sem. antes</th><th class="n">Semana del hecho</th><th class="n">Día 8 a 30</th><th></th></tr></thead><tbody>
      ${h.lugares.slice(0, 8).map(l => `<tr><td>${esc(l.lugar)}${l.colonia ? `<div class="nota">${esc(l.colonia)}</div>` : ''}</td><td class="n">${num(l.antes)}</td><td class="n">${num(l.semana)}</td><td class="n">${num(l.despues)}</td><td><span class="chip ${EST[l.estado][0]}">${EST[l.estado][1]}</span></td></tr>`).join('')}
    </tbody></table></div></div>`).join('');
}
