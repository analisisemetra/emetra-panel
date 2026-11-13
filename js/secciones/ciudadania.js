// ─── Ciudadanía: qué siente, a quién culpa, qué pide, cuándo y por qué ───
import { api } from '../api.js';
import { esc, num, tarjeta, listaBarras, enlazarLista, animarBarras, animarNumeros, escalonar, vacio, aviso, ventana, comentarioHTML, haceCuanto, pestanas, marcarPestana, kpi, kpis, COLOR } from '../ui.js';
import { lineas, barras, chispa } from '../graficas.js';

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const EMO_COLOR = { enojo: '#f0616d', frustracion: '#e5835b', burla: '#d9a3ff', exigencia: '#f2b33d', preocupacion: '#7f8cff', tristeza: '#5f88a8', confusion: '#8a9a92', indiferencia: COLOR.neutro, satisfaccion: '#3cc5a0', gratitud: '#a2d441' };
const EMO_NOMBRE = { frustracion: 'frustración', preocupacion: 'preocupación', confusion: 'confusión', satisfaccion: 'satisfacción' };
const nomEmo = (e) => EMO_NOMBRE[e] || e;

export async function montar(cont, ctx) {
  const P = { dias: ctx.dias };
  const [ciu, lt, hor, nar, est, cal] = await Promise.allSettled([
    api('/api/ciudadania', { params: P }), api('/api/linea-tiempo', { params: { dias: ctx.dias || 90 } }), api('/api/horario', { params: P }),
    api('/api/narrativas'), api('/api/estadisticas', { params: P }), api('/api/calidad-ia'),
  ]);
  const v = (r) => r.status === 'fulfilled' ? r.value : null;
  const c = v(ciu); if (!c) throw new Error(ciu.reason?.message || 'No se pudo cargar.');
  const l = v(lt), h = v(hor), n = v(nar), e = v(est), q = v(cal);
  const conc = c.concentracion;

  cont.innerHTML = `
  <div class="guia">Todo lo de esta sección sale de los comentarios analizados por la IA, sin el ruido (etiquetas, emojis sueltos, spam).
    ${q?.revisados ? `En la revisión humana, la IA <b>acertó el ${q.acierto}%</b> de ${num(q.revisados)} comentarios revisados.` : 'Todavía no hay revisiones humanas de la IA.'}</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', id: 'tAhora', titulo: 'Dolores ahora', nota: 'Las últimas horas contra lo normal a esa misma hora · se actualiza sola cada 5 minutos',
      acciones: pestanas([['3', '3 horas'], ['6', '6 horas'], ['24', '24 horas']], '6', 'pAhora'),
      ayuda: 'Cuenta las quejas de las últimas horas por tipo y las compara con lo normal: el promedio de esa misma franja horaria en los 14 días anteriores. <b>Más de lo normal</b>: al menos 5 quejas y 3 veces lo normal. <b>Subiendo</b>: al menos 3 y una vez y media lo normal. <b>Nuevo</b>: casi no aparecía antes. Facebook e Instagram llegan cada 15 minutos; TikTok y X solo cuando se sube su Excel. No depende del periodo elegido arriba.',
      cuerpo: '<div id="ahora"><div class="esqueleto corto"></div><div class="esqueleto"></div></div>' })}
    ${tarjeta({ clase: 'c6', titulo: '¿Molestos con EMETRA o con el problema?', nota: 'Entre los comentarios negativos',
      ayuda: 'No toda queja es contra EMETRA. La IA separa a quien culpa a la institución ("la PMT no hace nada") de quien se queja del problema en sí ("qué tráfico hoy"). El sarcasmo ("gracias EMETRA por el tráfico") se cuenta como queja aunque suene a elogio.',
      cuerpo: molestiaHTML(c.molestia) })}
    ${tarjeta({ clase: 'c6', titulo: 'Quién nos defiende', nota: 'Comentarios que salen en defensa de EMETRA o la PMT',
      ayuda: 'Personas que en las conversaciones defienden a EMETRA o a los agentes (por ejemplo, responden a una queja diciendo que el agente hacía su trabajo). Sirve para saber si hay apoyo espontáneo.',
      cuerpo: defensoresHTML(c.defensores) })}
    ${tarjeta({ clase: 'c6', titulo: '¿A quién culpan?', nota: 'Solo comentarios negativos · toca para ver los comentarios', cuerpo: `<div id="culpables">${listaBarras(c.culpables.map(x => ({ nom: x.senalado, n: x.n })), { color: COLOR.negativo, alClic: true })}</div>` })}
    ${tarjeta({ clase: 'c3', titulo: 'Nivel de enojo', nota: 'Intensidad promedio de lo negativo (1 a 5)', cuerpo: c.enojo.negativos ? `
      <div class="kpi"><span class="valor" style="color:${c.enojo.promedio >= 3.5 ? COLOR.negativo : c.enojo.promedio >= 2.8 ? COLOR.ambar : COLOR.positivo}"><span data-num="${c.enojo.promedio}" data-dec="1">0</span><small>/5</small></span>
      <span class="pie">${num(c.enojo.fuertes)} de ${num(c.enojo.negativos)} quejas son fuertes (4 o 5)</span></div>
      <div class="sep">${chispa(c.enojo.porSemana.map(x => x.intensidad), COLOR.ambar, 220, 44)}</div><div class="nota">Tendencia por semana</div>` : vacio() })}
    ${tarjeta({ clase: 'c3', titulo: '¿Muchos o pocos?', nota: 'Qué tanto de lo negativo viene de pocas cuentas', cuerpo: conc.negativosConAutor ? `
      <div class="kpi"><span class="valor"><span data-num="${conc.top10Pct}">0</span><small>%</small></span><span class="pie">de las quejas las hicieron las 10 cuentas más activas</span></div>
      <div style="margin:12px 0 8px;font-weight:600;font-size:13px">${esc(conc.lectura)}</div>
      <div class="nota">${num(conc.cuentasPara50)} de ${num(conc.cuentas)} cuentas (${conc.pctCuentasPara50}%) generan la mitad de lo negativo.</div>` : vacio() })}

    ${tarjeta({ clase: 'c8', titulo: 'Sentimiento en el tiempo y qué lo movió', nota: 'Las marcas son noticias, alertas, picos y hechos de la bitácora',
      cuerpo: l?.serie?.length ? `<div class="grafica"><canvas id="gTiempo"></canvas></div><div id="eventos" style="margin-top:14px;display:flex;flex-direction:column;gap:6px;max-height:190px;overflow-y:auto"></div>` : vacio() })}
    ${tarjeta({ clase: 'c4', titulo: 'Emociones', nota: 'Emoción dominante de cada comentario', cuerpo: c.emociones.total.length ? `<div class="grafica alta"><canvas id="gEmo"></canvas></div>` : vacio() })}

    ${tarjeta({ clase: 'c7', titulo: '¿Cuándo se queja la gente?', nota: 'Comentarios negativos por día y hora (hora de Guatemala)', cuerpo: h?.celdas?.length ? calorHTML(h.celdas) : vacio() })}
    ${tarjeta({ clase: 'c5', titulo: 'Lo que la gente pide', nota: 'Peticiones concretas (más presencia, operativos, señales…)', cuerpo: peticionesHTML(c.peticiones) })}

    ${tarjeta({ clase: 'c12', id: 'tNarr', titulo: 'Narrativas', nota: n?.generado_en ? `Historias que se repiten en las quejas · agrupadas por IA ${haceCuanto(n.generado_en)}` : 'Historias que se repiten en las quejas',
      acciones: ctx.esAdmin ? `<button class="btn chico primario" id="btnNarr">Actualizar con IA</button>` : '', cuerpo: narrativasHTML(n) })}

    ${tarjeta({ clase: 'c6', titulo: 'Quejas por categoría', nota: 'Toca una para ver los comentarios', cuerpo: `<div id="dolores">${listaBarras((e?.dolores?.categorias || []).map(x => ({ nom: x.dolor, n: x.n })), { color: COLOR.negativo, alClic: true })}</div>` })}
    ${tarjeta({ clase: 'c6', titulo: 'Los comentarios más intensos', nota: 'Intensidad 4 y 5', cuerpo: e?.intensos?.length ? `<div class="lista-com desplazable">${e.intensos.slice(0, 12).map(x => comentarioHTML(x)).join('')}</div>` : vacio() })}
  </div>`;

  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont); animarBarras(cont);
  doloresAhora(cont.querySelector('#tAhora'));

  enlazarLista(cont.querySelector('#culpables'), c.culpables, (x) => verComentarios(`Culpan a: ${x.senalado}`, { culpable: x.senalado, sentimiento: 'negativo', dias: ctx.dias }));
  enlazarLista(cont.querySelector('#dolores'), e?.dolores?.categorias || [], (x) => verComentarios(x.dolor, { categoria: x.dolor, dias: ctx.dias }));

  if (l?.serie?.length) {
    const dias = l.serie.map(x => x.dia);
    const pct = (k) => l.serie.map(x => x.total ? Math.round(x[k] / x.total * 100) : null);
    const COL = { noticia: COLOR.info, crisis: COLOR.negativo, pico: COLOR.ambar, bitacora: COLOR.lima };
    const marcas = l.eventos.map(ev => ({ indice: dias.indexOf(ev.dia), color: COL[ev.tipo] || COLOR.neutro })).filter(m => m.indice >= 0);
    lineas(cont.querySelector('#gTiempo'), dias.map(d => d.slice(5)), [
      { nombre: 'Positivo %', datos: pct('positivos'), color: COLOR.positivo },
      { nombre: 'Negativo %', datos: pct('negativos'), color: COLOR.negativo },
      { nombre: 'Neutro %', datos: pct('neutros'), color: COLOR.neutro, punteada: true },
    ], { porcentaje: true, anotaciones: marcas });
    const NOM = { noticia: 'Noticia', crisis: 'Crisis', pico: 'Pico', bitacora: 'Bitácora' };
    cont.querySelector('#eventos').innerHTML = l.eventos.length ? l.eventos.slice().reverse().map(ev => `<div style="display:flex;gap:10px;font-size:12.5px;align-items:baseline">
      <span class="nota" style="min-width:46px">${ev.dia.slice(5)}</span><span class="chip" style="background:color-mix(in srgb, ${COL[ev.tipo]} 16%, transparent);color:${COL[ev.tipo]}">${NOM[ev.tipo]}</span>
      <span>${esc(ev.titulo)} ${ev.enlace ? `<a href="${esc(ev.enlace)}" target="_blank" rel="noopener">↗</a>` : ''}</span></div>`).join('') : '<div class="nota">Sin eventos marcados en el periodo.</div>';
  }
  if (c.emociones.total.length) {
    const top = c.emociones.total.slice(0, 8);
    barras(cont.querySelector('#gEmo'), top.map(x => nomEmo(x.emocion)), [{ nombre: 'Comentarios', datos: top.map(x => x.n), color: top.map(x => EMO_COLOR[x.emocion] || COLOR.neutro) }], { horizontal: true });
  }
  const btn = cont.querySelector('#btnNarr');
  if (btn) btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Agrupando…';
    try {
      const r = await api('/api/narrativas', { metodo: 'POST', cuerpo: { dias: ctx.dias || 90 } });
      cont.querySelector('#tNarr .cab').nextElementSibling.outerHTML = narrativasHTML({ narrativas: r.narrativas });
      aviso('Narrativas actualizadas.');
    } catch (e) { aviso(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Actualizar con IA'; }
  };
  cont.querySelectorAll('[data-peticion-zona]').forEach(el => el.onclick = () => verComentarios(`Peticiones · ${el.dataset.peticionZona}`, { peticion: '1', zona: el.dataset.peticionZona === 'Sin zona' ? '' : el.dataset.peticionZona, dias: ctx.dias }));
}

function calorHTML(celdas) {
  const m = new Map(celdas.map(c => [`${c.dia}-${c.hora}`, c]));
  const max = Math.max(...celdas.map(c => c.negativos), 1);
  let html = '<div class="calor" role="img" aria-label="Cuadro de comentarios negativos por día y hora"><span></span>';
  for (let hr = 0; hr < 24; hr++) html += `<span class="h">${hr % 3 === 0 ? hr : ''}</span>`;
  for (let d = 1; d <= 7; d++) {
    html += `<span class="d">${DIAS_SEM[d - 1]}</span>`;
    for (let hr = 0; hr < 24; hr++) {
      const c = m.get(`${d}-${hr}`), n = c?.negativos || 0, t = n / max;
      const fondo = n === 0 ? '#1a2520' : `rgba(240, 97, 109, ${0.18 + 0.82 * t})`;
      html += `<span class="c" style="background:${fondo}" title="${DIAS_SEM[d - 1]} ${hr}:00 · ${n} negativos de ${c?.total || 0}"></span>`;
    }
  }
  html += '</div>';
  // horas pico
  const porHora = Array.from({ length: 24 }, (_, hr) => celdas.filter(c => c.hora === hr).reduce((s, c) => s + c.negativos, 0));
  const pico = porHora.indexOf(Math.max(...porHora));
  const porDia = Array.from({ length: 7 }, (_, d) => celdas.filter(c => c.dia === d + 1).reduce((s, c) => s + c.negativos, 0));
  const diaPico = porDia.indexOf(Math.max(...porDia));
  return html + `<div class="nota sep">Hora con más quejas: <b>${pico}:00–${pico + 1}:00</b> · Día con más quejas: <b>${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][diaPico]}</b></div>`;
}

function peticionesHTML(p) {
  if (!p.porZona.length && !p.frecuentes.length) return vacio('No se detectaron peticiones en este periodo.');
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${p.porZona.map(z => `<button class="f btn chico" data-peticion-zona="${esc(z.zona)}">${esc(z.zona)} · ${num(z.n)}</button>`).join('')}</div>
    ${p.frecuentes.length ? `<div class="nota mb">Lo más pedido</div>${p.frecuentes.slice(0, 6).map(x => `<div style="font-size:13px;margin-bottom:5px">• ${esc(x.texto)} <span class="nota">(${x.n})</span></div>`).join('')}` : ''}`;
}

function narrativasHTML(n) {
  if (!n?.narrativas?.length) return vacio('Aún no se han agrupado narrativas.');
  const TEND = { sube: ['neg', '▲ crece'], baja: ['pos', '▼ baja'], estable: ['neu', '= estable'] };
  return `<div class="rejilla interna">${n.narrativas.map(x => {
    const [cl, tx] = TEND[x.tendencia] || TEND.estable;
    return `<div class="c4 tarjeta plana" style="padding:16px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><b style="font-size:14px">${esc(x.nombre)}</b><span class="chip ${cl}">${tx}</span></div>
      <div class="nota" style="margin:6px 0 10px">${esc(x.descripcion)}</div>
      <div style="display:flex;align-items:end;justify-content:space-between;gap:8px"><div><span style="font-size:24px;font-weight:800">${num(x.total)}</span> <span class="nota">quejas (8 semanas)</span></div>${chispa((x.serie || []).map(s => s.n), COLOR.ambar, 110, 30)}</div>
    </div>`;
  }).join('')}</div>`;
}

export async function verComentarios(titulo, filtros) {
  const v = ventana(titulo, '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const r = await api('/api/buscar', { params: { ...filtros, limite: 60 } });
    v.cuerpo.innerHTML = `<div class="nota">${num(r.total)} comentarios${r.total > 60 ? ' · se muestran los 60 más recientes (usa "Buscar comentarios" para ver todos)' : ''}</div>
      <div class="lista-com">${r.datos.map(x => comentarioHTML(x)).join('') || vacio()}</div>`;
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

function molestiaHTML(m) {
  if (!m || m.analizados < 5) return vacio('Todavía hay pocos comentarios negativos con este análisis. Se completa al reanalizar (en Datos).');
  const otros = Math.max(0, 100 - m.pctContra - m.pctProblema);
  return `<div class="kpis mb">
      <div class="kpi"><span class="etq">Contra EMETRA</span><span class="valor t-neg"><span data-num="${m.pctContra}">0</span><small>%</small></span><span class="pie">${num(m.contraEmetra)} comentarios</span></div>
      <div class="kpi"><span class="etq">Con el problema</span><span class="valor t-ambar"><span data-num="${m.pctProblema}">0</span><small>%</small></span><span class="pie">${num(m.conElProblema)} comentarios</span></div></div>
    <div class="apilada" role="img" aria-label="${m.pctContra}% contra EMETRA, ${m.pctProblema}% con el problema"><span data-w="${m.pctContra}" style="background:${COLOR.negativo}"></span><span data-w="${m.pctProblema}" style="background:${COLOR.ambar}"></span><span data-w="${otros}" style="background:${COLOR.neutro}"></span></div>
    <div class="nota sep">${num(m.analizados)} quejas analizadas${m.sarcasmo ? ` · ${num(m.sarcasmo)} con sarcasmo` : ''}</div>`;
}

function defensoresHTML(d) {
  if (!d || !d.comentarios) return vacio('Nadie salió en defensa de EMETRA en este periodo (o falta reanalizar los comentarios).');
  return `<div class="kpi" style="margin-bottom:12px"><span class="valor" data-num="${d.comentarios}">0</span><span class="pie">comentarios de ${num(d.cuentas.length)}${d.cuentas.length >= 10 ? ' o más' : ''} cuentas</span></div>
    ${d.cuentas.length ? `<div class="nota mb">Los que más defienden: ${d.cuentas.slice(0, 5).map(x => `<span class="chip" style="margin:2px">${esc(x.autor || 'Sin nombre')} · ${num(x.n)}</span>`).join('')}</div>` : ''}
    <div class="lista-com desplazable bajo">${d.ejemplos.slice(0, 4).map(x => comentarioHTML(x)).join('')}</div>`;
}

// ── Dolores ahora: se pinta aparte (no frena la sección) y se refresca cada 5 minutos mientras esté en pantalla ──
const NIVEL = { alto: ['neg', 'Más de lo normal'], sube: ['ambar', 'Subiendo'], normal: ['neu', 'Normal'] };
function doloresAhora(tarj) {
  let horas = '6', timer = null;
  const caja = tarj.querySelector('#ahora');
  const cargar = async () => {
    if (!document.body.contains(tarj)) { clearInterval(timer); return; }
    try { caja.innerHTML = ahoraHTML(await api('/api/dolores/ahora', { params: { horas } })); animarNumeros(caja); }
    catch (e) { caja.innerHTML = vacio('No se pudo cargar: ' + e.message); }
  };
  tarj.querySelectorAll('#pAhora [data-p]').forEach(b => b.onclick = () => { horas = b.dataset.p; marcarPestana(tarj, horas); cargar(); });
  timer = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, 5 * 60e3);
  cargar();
}
function ahoraHTML(d) {
  const t = d.horas === 24 ? 'el último día' : `las últimas ${d.horas} horas`;
  const cab = kpis([
    kpi({ etq: 'Comentarios', valor: d.comentarios, pie: `en ${t} · lo normal: ${num(d.comentariosNormal, d.comentariosNormal < 10 ? 1 : 0)}` }),
    kpi({ etq: 'En contra', valor: d.comentarios ? d.pctNegativo : null, sufijo: '%', tono: d.pctNegativoNormal != null && d.pctNegativo > d.pctNegativoNormal + 10 ? 'neg' : '',
      pie: d.pctNegativoNormal != null ? `lo normal: ${d.pctNegativoNormal}%` : 'sin historia para comparar' }),
    kpi({ etq: 'Último comentario recibido', valor: d.ultimaLlegada ? haceCuanto(d.ultimaLlegada) : '—', animar: false, tam: 'chico', pie: 'de Facebook o Instagram' }),
  ]);
  if (!d.dolores.length) return cab + `<div class="sep">${vacio(`Sin quejas con tipo identificado en ${t}.`)}</div>`;
  const alertas = d.dolores.filter(x => x.nivel !== 'normal').length;
  return cab + `<div class="sep-grande nota mb">${alertas ? `<b class="t-neg">${alertas} ${alertas === 1 ? 'tipo de queja está' : 'tipos de queja están'} por encima de lo normal.</b>` : 'Todo dentro de lo normal.'} Toca una para ver ejemplos.</div>
    <div class="lista-com">${d.dolores.slice(0, 10).map(x => {
      const [cl, tx] = x.nuevo && x.nivel !== 'normal' ? ['info', 'Nuevo'] : NIVEL[x.nivel];
      return `<details class="comentario">
        <summary class="linea entre"><span class="linea"><span class="chip ${cl}">${tx}</span><b>${esc(x.dolor)}</b>${x.zonas.map(z => `<span class="chip">${esc(z.zona)} · ${num(z.n)}</span>`).join('')}</span>
          <span class="nowrap"><b>${num(x.n)}</b> <span class="nota">${x.veces != null ? `· ${num(x.veces, 1)} veces lo normal (${num(x.esperado, 1)})` : '· antes casi no aparecía'}</span></span></summary>
        <div class="pila junta sep">${x.ejemplos.map(c => comentarioHTML(c)).join('')}</div>
      </details>`;
    }).join('')}</div>`;
}
