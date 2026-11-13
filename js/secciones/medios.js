// ─── Noticias: lo que publican los medios (Google Alertas), qué domina los titulares y crisis ───
// Tres pestañas: Notas (lista con filtros), Titulares (qué tema domina por semana, mes o año)
// y Crisis (alertas, brecha medios–calle y cómo nos trata cada medio).
import { api } from '../api.js';
import { esc, num, fecha, haceCuanto, tarjeta, listaBarras, animarBarras, animarNumeros, escalonar, vacio, aviso, chipPostura, demorar, COLOR, pestanas, marcarPestana, kpi, kpis } from '../ui.js';
import { lineas, dona, barras } from '../graficas.js';

const SEV = { alta: ['neg', 'Alta'], critica: ['neg', 'Crítica'], media: ['ambar', 'Media'], baja: ['neu', 'Baja'] };
const TONO = { buena: ['pos', 'Noticia buena'], neutra: ['neu', 'Noticia neutra'], mala: ['neg', 'Noticia mala'] };
const chipTono = (t) => TONO[t] ? `<span class="chip ${TONO[t][0]}">${TONO[t][1]}</span>` : '';
// Colores para las categorías (se repiten si hay más de 11)
const PALETA = ['#7f8cff', '#f0616d', '#f2b33d', '#3cc5a0', '#a2d441', '#d9a3ff', '#5f88a8', '#e5835b', '#4fb3d9', '#c9b458', '#8a9a92'];
const PEST = [['notas', 'Notas'], ['titulares', 'Titulares'], ['crisis', 'Crisis y medios']];

export async function montar(cont, ctx) {
  const actual = PEST.some(p => p[0] === ctx.parametros.v) ? ctx.parametros.v : 'notas';
  cont.innerHTML = `${pestanas(PEST, actual)}<div id="vista"></div>`;
  const vista = cont.querySelector('#vista');
  const abrir = async (k) => {
    marcarPestana(cont.querySelector('#pestanas'), k);
    history.replaceState(null, '', `#medios?v=${k}`);
    vista.innerHTML = '<div class="tarjeta cargando"></div>';
    try { await VISTAS[k](vista, ctx); escalonar(vista.querySelector('.rejilla')); animarBarras(vista); animarNumeros(vista); }
    catch (e) { if (e.estado !== 401 && e.estado !== 451) vista.innerHTML = `<div class="tarjeta"><div class="vacio t-neg">⚠ ${esc(e.message)}</div></div>`; }
  };
  cont.querySelectorAll('#pestanas .f').forEach(b => b.onclick = () => abrir(b.dataset.p));
  // Al entrar, las noticias quedan como vistas (el contador del menú baja)
  api('/api/alertas/marcar-leidas', { metodo: 'POST' }).catch(() => {});
  await abrir(actual);
}

const VISTAS = { notas: vistaNotas, titulares: vistaTitulares, crisis: vistaCrisis };

// ═════════ NOTAS ═════════
async function vistaNotas(el, ctx) {
  const P = { dias: ctx.dias };
  const [sent, tem, amb] = await Promise.all([api('/api/alertas-sentimiento', { params: P }), api('/api/medios-temas', { params: P }), api('/api/medios-ambiente', { params: P })]);
  const f = { postura: '', tono: '', tema: ctx.parametros.tema || '', zona: ctx.parametros.zona || '', medio: '', texto: '', historia: '', pagina: 1 };
  const pctDe = (n) => sent.total ? Math.round(n / sent.total * 100) : 0;
  el.innerHTML = `
  <div class="rejilla">
    <section class="tarjeta c12">${kpis([
      kpi({ etq: 'Notas', valor: sent.total, pie: 'en el periodo' }),
      kpi({ etq: 'A favor o propias', valor: sent.favor + sent.informativo, pie: `${pctDe(sent.favor + sent.informativo)}% del total`, tono: 'pos' }),
      kpi({ etq: 'En contra', valor: sent.contra, pie: `${pctDe(sent.contra)}% del total`, tono: 'neg' }),
      kpi({ etq: 'Neutrales', valor: sent.neutral, pie: `${pctDe(sent.neutral)}% del total` }),
    ])}</section>

    ${tarjeta({ clase: 'c8', id: 'tNoticias', titulo: 'Noticias', nota: 'Filtra por postura, tipo de noticia, categoría, zona, medio o palabra',
      acciones: ctx.esAdmin ? '<button class="btn chico" id="btnRefrescar">Buscar noticias nuevas</button>' : '',
      ayuda: '<b>Postura</b>: cómo trata la nota a EMETRA/PMT (a favor, en contra, neutral, o informativa propia cuando la fuente es la misma institución). <b>Noticia buena/mala</b>: si el hecho en sí es bueno o malo para la ciudad, sin importar a EMETRA (un accidente es una noticia mala aunque la nota no critique a nadie). «Cubierta por N medios» agrupa la misma historia publicada por varios medios.',
      cuerpo: `<div class="form" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:14px">
        <label class="campo">Postura<select id="fPostura"><option value="">Todas</option><option value="contra">En contra</option><option value="favor">A favor</option><option value="informativo_propio">Informativa propia</option><option value="neutral">Neutral</option></select></label>
        <label class="campo">Noticia<select id="fTono"><option value="">Todas</option><option value="buena">Buena</option><option value="neutra">Neutra</option><option value="mala">Mala</option></select></label>
        <label class="campo">Categoría<select id="fTema"><option value="">Todas</option>${tem.temas.map(t => `<option ${t.tema === f.tema ? 'selected' : ''}>${esc(t.tema)}</option>`).join('')}</select></label>
        <label class="campo">Zona<select id="fZona"><option value="">Todas</option>${tem.zonas.map(z => `<option ${z.zona === f.zona ? 'selected' : ''}>${esc(z.zona)}</option>`).join('')}</select></label>
        <label class="campo">Medio<select id="fMedio"><option value="">Todos</option>${amb.map(m => `<option>${esc(m.medio)}</option>`).join('')}</select></label>
        <label class="campo">Buscar<input type="search" id="fTexto" placeholder="Palabra o frase"></label>
      </div><div id="filtroHistoria"></div><div id="listaNoticias"></div><div id="pagNot" style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap"></div>` })}
    <div class="c4" style="display:flex;flex-direction:column;gap:20px">
      ${tarjeta({ titulo: 'Postura de las notas', cuerpo: sent.total ? '<div class="grafica baja"><canvas id="gPostura"></canvas></div>' : vacio() })}
      ${tarjeta({ titulo: '¿De qué hablan?', nota: 'Toca una categoría para filtrar', cuerpo: `<div id="listaTemas">${listaBarras(tem.temas.slice(0, 11).map(t => ({ nom: t.tema, n: t.total, contra: t.contra })), { colorFn: (t) => t.contra / t.n >= .5 ? COLOR.negativo : COLOR.info, alClic: true })}</div>` })}
      ${tarjeta({ titulo: 'Zonas en las noticias', cuerpo: `<div id="listaZonasMed">${listaBarras(tem.zonas.slice(0, 8).map(z => ({ nom: z.zona, n: z.total })), { color: COLOR.pizarra, alClic: true })}</div>` })}
    </div>
  </div>`;
  if (sent.total) dona(el.querySelector('#gPostura'), ['A favor', 'Informativa propia', 'Neutral', 'En contra'], [sent.favor, sent.informativo, sent.neutral, sent.contra], [COLOR.positivo, COLOR.lima, COLOR.neutro, COLOR.negativo]);

  const cargar = async () => {
    const caja = el.querySelector('#listaNoticias');
    caja.innerHTML = '<div class="cargando bloque"></div>';
    try {
      const r = await api('/api/alertas', { params: { dias: ctx.dias, postura: f.postura, tono: f.tono, tema: f.tema, zona: f.zona, medio: f.medio, texto: f.texto, historia: f.historia, pagina: f.pagina, limite: 15 } });
      el.querySelector('#filtroHistoria').innerHTML = f.historia ? `<div class="guia" style="display:flex;gap:10px;align-items:center;margin-bottom:12px">Mostrando una sola historia en todos los medios que la cubrieron.<button class="btn chico" id="quitarHistoria" style="margin-left:auto">Ver todas</button></div>` : '';
      const qh = el.querySelector('#quitarHistoria'); if (qh) qh.onclick = () => { f.historia = ''; f.pagina = 1; cargar(); };
      caja.innerHTML = r.datos.length ? `<div class="lista-com">${r.datos.map(a => `
        <div class="comentario"><div class="meta">${chipPostura(a.sentimiento_medio)}${chipTono(a.tono)}<b style="color:var(--texto)">${esc(a.medio || a.fuente_nombre || '')}</b><span>· ${fecha(a.publicado, true)}</span>
          ${a.tema ? `<span class="chip info">${esc(a.tema)}</span>` : ''}${a.zona ? `<span class="chip">${esc(a.zona)}</span>` : ''}${a.leida ? '' : '<span class="chip lima">Nueva</span>'}</div>
          <div class="txt"><a href="${esc(a.enlace)}" target="_blank" rel="noopener" style="color:var(--texto);font-weight:700">${esc(a.titulo)} ↗</a></div>
          ${a.motivo_medio ? `<div class="nota">${esc(a.motivo_medio)}</div>` : ''}
          ${a.medios_historia >= 2 && !f.historia ? `<div class="meta"><a href="#" data-historia="${a.historia_id}">Cubierta por ${a.medios_historia} medios · ver todas</a></div>` : ''}</div>`).join('')}</div>` : vacio('Sin noticias con este filtro.');
      el.querySelector('#pagNot').innerHTML = r.paginas > 1 ? `<button class="btn chico" ${r.pagina <= 1 ? 'disabled' : ''} data-pg="-1">← Anterior</button><span class="nota">Página ${r.pagina} de ${r.paginas} · ${num(r.total)} notas</span><button class="btn chico" ${r.pagina >= r.paginas ? 'disabled' : ''} data-pg="1">Siguiente →</button>` : '';
      el.querySelectorAll('#pagNot [data-pg]').forEach(b => b.onclick = () => { f.pagina += +b.dataset.pg; cargar(); });
      caja.querySelectorAll('[data-historia]').forEach(a => a.onclick = (e) => { e.preventDefault(); f.historia = a.dataset.historia; f.pagina = 1; cargar(); });
    } catch (e) { caja.innerHTML = vacio(e.message); }
  };
  const cambio = (campo) => (e) => { f[campo] = e.target.value; f.pagina = 1; cargar(); };
  el.querySelector('#fPostura').onchange = cambio('postura');
  el.querySelector('#fTono').onchange = cambio('tono');
  el.querySelector('#fTema').onchange = cambio('tema');
  el.querySelector('#fZona').onchange = cambio('zona');
  el.querySelector('#fMedio').onchange = cambio('medio');
  el.querySelector('#fTexto').oninput = demorar(cambio('texto'), 400);
  const filtrarPor = (campo, sel) => (x) => { f[campo] = x.nom; f.pagina = 1; el.querySelector(sel).value = x.nom; cargar(); el.querySelector('#tNoticias').scrollIntoView({ behavior: 'smooth' }); };
  const temasL = tem.temas.slice(0, 11).map(t => ({ nom: t.tema })), zonasL = tem.zonas.slice(0, 8).map(z => ({ nom: z.zona }));
  el.querySelectorAll('#listaTemas .fila.click').forEach(x => x.onclick = () => filtrarPor('tema', '#fTema')(temasL[+x.dataset.i]));
  el.querySelectorAll('#listaZonasMed .fila.click').forEach(x => x.onclick = () => filtrarPor('zona', '#fZona')(zonasL[+x.dataset.i]));
  const br = el.querySelector('#btnRefrescar');
  if (br) br.onclick = async () => {
    br.disabled = true; br.textContent = 'Buscando…';
    try { const r = await api('/api/alertas/refrescar', { metodo: 'POST' }); aviso(`${num(r.nuevas || 0)} noticias nuevas.`); ctx.recargar(); }
    catch (e) { aviso(e.message, 'error'); br.disabled = false; br.textContent = 'Buscar noticias nuevas'; }
  };
  await cargar();
}

// ═════════ TITULARES: qué domina por semana, mes o año ═════════
const AGRUPAR = { semana: ['semana', 'Por semana'], mes: ['mes', 'Por mes'], anio: ['año', 'Por año'] };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

async function vistaTitulares(el, ctx, agrupar = 'semana') {
  const d = await api('/api/medios-dominio', { params: { agrupar } });
  const etiqueta = (p) => agrupar === 'semana' ? `${p.slice(8)} ${MESES[+p.slice(5, 7) - 1]}` : agrupar === 'mes' ? `${MESES[+p.slice(5) - 1]} ${p.slice(2, 4)}` : p;
  const cats = [...new Set(d.serie.flatMap(s => Object.keys(s.categorias)))];
  const color = (c) => PALETA[cats.indexOf(c) % PALETA.length];
  const top = d.resumen[0], nombre = AGRUPAR[agrupar][0];
  const este = agrupar === 'semana' ? 'Esta semana' : `Este ${nombre}`;
  const cambio = (c) => c == null ? '' : `<span class="nota">${c > 0 ? '+' : ''}${c} pts</span>`;
  el.innerHTML = `
  <div class="filtros" style="margin-bottom:16px">${Object.entries(AGRUPAR).map(([k, [, t]]) => `<button class="f ${k === agrupar ? 'activo' : ''}" data-ag="${k}">${t}</button>`).join('')}</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: top ? `${este} domina: ${esc(top.categoria)}` : '¿Qué domina los titulares?',
      nota: top ? `${top.pct}% de ${num(d.totalActual)} notas${top.cambio != null ? ` · ${top.cambio >= 0 ? '+' : ''}${top.cambio} pts contra ${agrupar === 'semana' ? 'la semana' : `el ${nombre}`} anterior` : ''}` : 'Sin notas clasificadas todavía',
      ayuda: 'Cada nota se clasifica en una categoría (se editan en Ajustes → Noticias). La gráfica muestra cuántas notas hubo de cada categoría por periodo; la tabla compara el periodo actual con el anterior. Esta pestaña no usa el periodo de arriba: muestra las últimas 12 semanas, 12 meses o 5 años.',
      cuerpo: d.serie.length ? `<div class="grafica alta"><canvas id="gDominio"></canvas></div>` : vacio('Todavía no hay notas clasificadas por categoría.') })}
    ${tarjeta({ clase: 'c7', titulo: `Categorías · ${este.toLowerCase()}`, nota: 'Cuánto ocupa cada una, postura hacia EMETRA y tipo de noticia',
      cuerpo: d.resumen.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Categoría</th><th class="n">Notas</th><th class="n">% titulares</th><th class="n">Cambio</th><th class="n">En contra</th><th class="n">Malas</th></tr></thead><tbody>
        ${d.resumen.map(c => `<tr><td><span class="punto" style="background:${color(c.categoria)}"></span>${esc(c.categoria)}</td><td class="n">${num(c.notas)}</td>
          <td class="n fuerte">${c.pct}%</td><td class="n">${cambio(c.cambio)}</td>
          <td class="n" style="color:${c.contra ? COLOR.negativo : 'inherit'}">${num(c.contra)}</td><td class="n">${num(c.malas)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin notas en este periodo.') })}
    ${tarjeta({ clase: 'c5', titulo: 'Historias más cubiertas', nota: 'La misma noticia publicada por varios medios',
      cuerpo: d.historias.length ? `<div class="lista-com">${d.historias.map(h => `<div class="comentario">
        <div class="meta">${h.medios >= 2 ? `<span class="chip lima">${h.medios} medios</span>` : '<span class="chip neu">1 medio</span>'}${h.categoria ? `<span class="chip info">${esc(h.categoria)}</span>` : ''}${chipPostura(h.postura)}${chipTono(h.tono)}</div>
        <div class="txt">${h.enlace ? `<a href="${esc(h.enlace)}" target="_blank" rel="noopener" style="color:var(--texto);font-weight:700">${esc(h.titulo)} ↗</a>` : `<b>${esc(h.titulo)}</b>`}</div>
        <div class="nota">${(h.lista_medios || []).map(esc).join(' · ')}</div></div>`).join('')}</div>` : vacio('Sin historias en este periodo.') })}
  </div>`;
  if (d.serie.length) barras(el.querySelector('#gDominio'), d.serie.map(s => etiqueta(s.periodo)), cats.map(c => ({ nombre: c, datos: d.serie.map(s => s.categorias[c] || 0), color: color(c) })), { apilado: true });
  el.querySelectorAll('[data-ag]').forEach(b => b.onclick = async () => {
    el.innerHTML = '<div class="tarjeta cargando"></div>';
    try { await vistaTitulares(el, ctx, b.dataset.ag); escalonar(el.querySelector('.rejilla')); animarBarras(el); }
    catch (e) { el.innerHTML = `<div class="tarjeta">${vacio(e.message)}</div>`; }
  });
}

// ═════════ CRISIS, BRECHA Y MEDIOS ═════════
async function vistaCrisis(el, ctx) {
  const P = { dias: ctx.dias };
  const [amb, bre, cri] = await Promise.all([api('/api/medios-ambiente', { params: P }), api('/api/brecha', { params: { dias: ctx.dias || 90 } }), api('/api/alertas-crisis', { params: P })]);
  const alertas = bre.serie.filter(s => s.alerta);
  el.innerHTML = `
  <div class="rejilla">
    ${tarjeta({ clase: 'c6', titulo: 'Alertas de crisis', nota: cri.length ? `${cri.filter(c => !c.leida).length} sin revisar de ${cri.length}` : 'Se generan solas cuando algo cruza un umbral',
      acciones: ctx.esAdmin ? '<button class="btn chico" id="btnEvaluar">Revisar ahora</button>' : '',
      ayuda: 'El sistema genera una alerta cuando hay un pico de quejas, varias notas en contra en poco tiempo o actividad de cuentas hostiles. «Marcar revisada» la quita de la tarjeta «¿Qué está quemando?» del inicio.',
      cuerpo: cri.length ? `<div class="lista-com desplazable">${cri.map(c => { const [cl, tx] = SEV[c.severidad] || SEV.media; return `
        <div class="comentario" style="${c.leida ? 'opacity:.65' : ''}"><div class="meta"><span class="chip ${cl}">${tx}</span><span>${fecha(c.creado_en, true)}</span>${c.leida ? '' : `<button class="btn chico" data-leida="${c.id}" style="margin-left:auto">Marcar revisada</button>`}</div>
        <div class="txt"><b>${esc(c.titulo)}</b></div><div class="nota">${esc(c.explicacion || '')}</div></div>`; }).join('')}</div>` : vacio('Sin alertas de crisis en el periodo.') })}
    ${tarjeta({ clase: 'c6', titulo: 'Cómo nos trata cada medio', ayuda: 'Para cada medio: cuántas notas publicó y qué parte fue a favor (incluye las informativas propias) o en contra de EMETRA.',
      cuerpo: amb.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Medio</th><th class="n">Notas</th><th style="min-width:140px">Postura</th><th>Última</th></tr></thead><tbody>
      ${amb.map(m => `<tr><td><b>${esc(m.medio)}</b></td><td class="n">${num(m.total)}</td>
        <td><div class="apilada" style="height:8px"><span style="width:${m.pctFavor + m.pctInformativo}%;background:${COLOR.positivo}"></span><span style="width:${m.pctNeutral}%;background:${COLOR.neutro}"></span><span style="width:${m.pctContra}%;background:${COLOR.negativo}"></span></div>
        <div class="nota">${m.pctFavor + m.pctInformativo}% a favor · ${m.pctContra}% en contra</div></td><td class="nota">${haceCuanto(m.ultima)}</td></tr>`).join('')}</tbody></table></div>` : vacio() })}
    ${tarjeta({ clase: 'c12', titulo: 'Brecha medios – calle', nota: 'Semana a semana: lo favorable en medios contra lo que siente la gente en redes',
      ayuda: 'Si los medios nos tratan bien pero la gente está molesta (o al revés), hay una brecha. Las alertas marcan las semanas en que la diferencia fue grande.',
      cuerpo: bre.serie.length ? `<div class="grafica"><canvas id="gBrecha"></canvas></div>${alertas.length ? `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">${alertas.map(a => `<div style="font-size:13px"><span class="chip ambar">Semana ${a.semana.slice(5)}</span> ${esc(a.alerta)}</div>`).join('')}</div>` : ''}` : vacio() })}
  </div>`;
  if (bre.serie.length) lineas(el.querySelector('#gBrecha'), bre.serie.map(s => s.semana.slice(5)), [
    { nombre: 'Medios favorables %', datos: bre.serie.map(s => s.mediosFavorables), color: COLOR.info },
    { nombre: 'Gente positiva %', datos: bre.serie.map(s => s.callePositivo), color: COLOR.positivo },
    { nombre: 'Gente negativa %', datos: bre.serie.map(s => s.calleNegativo), color: COLOR.negativo, punteada: true },
  ], { porcentaje: true });
  el.querySelectorAll('[data-leida]').forEach(b => b.onclick = async () => {
    try { await api(`/api/alertas-crisis/${b.dataset.leida}`, { metodo: 'PATCH' }); b.closest('.comentario').style.opacity = '.65'; b.remove(); } catch (e) { aviso(e.message, 'error'); }
  });
  const be = el.querySelector('#btnEvaluar');
  if (be) be.onclick = async () => {
    be.disabled = true;
    try { const r = await api('/api/alertas-crisis/evaluar', { metodo: 'POST' }); aviso(r.generada ? 'Se generó una alerta nueva.' : 'No hay nada que cruce los umbrales ahora.'); if (r.generada) vistaCrisis(el, ctx); }
    catch (e) { aviso(e.message, 'error'); } finally { be.disabled = false; }
  };
}
