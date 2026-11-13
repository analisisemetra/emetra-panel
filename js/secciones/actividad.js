// ─── Actividad: cuántos comentarios y reacciones, por hora, día, semana, mes o año ───
import { api } from '../api.js';
import { esc, num, compacto, fecha, tarjeta, animarNumeros, escalonar, vacio, COLOR } from '../ui.js';
import { grafica, barras, rejillaColor } from '../graficas.js';

const AGRUPAR = [['hora', 'Hora'], ['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']];
const NOM_AGRUPAR = { hora: 'hora', dia: 'día', semana: 'semana', mes: 'mes', anio: 'año' };
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const COLOR_RED = { Facebook: '#7f8cff', Instagram: '#d9a3ff', TikTok: '#3cc5a0', X: '#a9b8b0' };

// Etiqueta legible de cada periodo
function etiqueta(p, agrupar) {
  if (agrupar === 'anio') return p;
  if (agrupar === 'mes') { const [y, m] = p.split('-'); return `${MESES[+m - 1]} ${y}`; }
  const [f, h] = p.split(' '); const [, m, d] = f.split('-');
  if (agrupar === 'hora') return `${+d} ${MESES[+m - 1]} ${h}`;
  return agrupar === 'semana' ? `sem. ${+d} ${MESES[+m - 1]}` : `${+d} ${MESES[+m - 1]}`;
}
const pico = (p, agrupar) => p ? `${etiqueta(p.periodo, agrupar)} (${num(p.n)})` : '—';

export async function montar(cont, ctx) {
  const f = { agrupar: ctx.parametros.agrupar || '', red: '' };
  cont.innerHTML = `
  <div class="guia">Cuánta gente comenta y reacciona. Las <b>reacciones</b> suman todas: me gusta, me encanta, me divierte, me asombra, me entristece y me enoja.
    Los comentarios se cuentan con su fecha y hora exactas; las reacciones, en la fecha de la publicación (Meta solo entrega el total de cada publicación).</div>
  <section class="tarjeta" style="padding:14px 18px;margin-bottom:20px">
    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">
      <div class="linea"><span class="nota">Ver por</span><div class="filtros" id="fAgrupar">${AGRUPAR.map(([k, t]) => `<button class="f" data-a="${k}">${t}</button>`).join('')}</div></div>
      <div class="linea"><span class="nota">Red</span><div class="filtros" id="fRed">${[['', 'Todas'], ['Facebook', 'Facebook'], ['Instagram', 'Instagram'], ['TikTok', 'TikTok'], ['X', 'X']].map(([k, t]) => `<button class="f" data-r="${k}">${t}</button>`).join('')}</div></div>
    </div>
  </section>
  <div id="cuerpo"></div>`;

  const cuerpo = cont.querySelector('#cuerpo');
  const cargar = async () => {
    cuerpo.innerHTML = '<div class="tarjeta cargando"></div>';
    const d = await api('/api/actividad', { params: { dias: ctx.dias, agrupar: f.agrupar, red: f.red } });
    f.agrupar = d.agrupar;
    cont.querySelectorAll('#fAgrupar .f').forEach(b => b.classList.toggle('activo', b.dataset.a === d.agrupar));
    cont.querySelectorAll('#fRed .f').forEach(b => b.classList.toggle('activo', b.dataset.r === f.red));
    pintar(cuerpo, d, f);
  };
  cont.querySelectorAll('#fAgrupar .f').forEach(b => b.onclick = () => { f.agrupar = b.dataset.a; cargar(); });
  cont.querySelectorAll('#fRed .f').forEach(b => b.onclick = () => { f.red = b.dataset.r; cargar(); });
  await cargar();
}

function pintar(el, d, f) {
  const t = d.totales, ag = d.agrupar, por = NOM_AGRUPAR[ag];
  const hayCom = t.comentarios > 0, hayPub = t.publicaciones > 0;
  const mejorHora = d.horaDelDia.reduce((a, x) => x.comentarios > a.comentarios ? x : a, d.horaDelDia[0]);
  const mejorDia = d.diaSemana.reduce((a, x) => x.comentarios > a.comentarios ? x : a, d.diaSemana[0]);
  const conPub = d.horaDelDia.filter(x => x.publicaciones >= 2);
  const horaReac = conPub.length ? conPub.reduce((a, x) => x.reaccionesPromedio > a.reaccionesPromedio ? x : a) : null;

  el.innerHTML = `
  ${d.aviso ? `<div class="guia aviso-ambar">${esc(d.aviso)}</div>` : ''}
  <div class="rejilla">
    <section class="tarjeta c12"><div class="kpis">
    ${kpi('Comentarios', t.comentarios, `${num(t.comentariosPorPeriodo)} por ${por} en promedio`)}
    ${kpi('Reacciones', t.reacciones, `en ${num(t.publicaciones)} publicaciones`, COLOR.lima)}
    ${kpi('Reacciones por publicación', t.reaccionesPorPublicacion, 'promedio')}
    ${kpi('Compartidos', t.compartidos, `+ ${num(t.likesComentarios)} me gusta en comentarios`)}
    </div></section>

    ${tarjeta({ clase: 'c12', titulo: `Comentarios por ${por}`, nota: `Pico: ${pico(t.picoComentarios, ag)} · ${num(t.ruido)} son ruido (etiquetas, emojis sueltos, spam)`,
      cuerpo: hayCom ? '<div class="grafica alta"><canvas id="gCom"></canvas></div>' : vacio('Sin comentarios en este periodo.') })}
    ${tarjeta({ clase: 'c12', titulo: `Reacciones y publicaciones por ${por}`, nota: `Pico de reacciones: ${pico(t.picoReacciones, ag)}`,
      cuerpo: hayPub ? '<div class="grafica alta"><canvas id="gReac"></canvas></div>' : vacio('Sin publicaciones registradas en este periodo.') })}

    ${tarjeta({ clase: 'c6', titulo: '¿A qué hora se comenta?', nota: `Hora de Guatemala · la más activa: ${mejorHora.comentarios ? `<b>${mejorHora.hora}:00–${mejorHora.hora + 1}:00</b>` : '—'}`,
      cuerpo: hayCom ? '<div class="grafica"><canvas id="gHora"></canvas></div>' : vacio() })}
    ${tarjeta({ clase: 'c6', titulo: '¿Qué día se comenta más?', nota: `El más activo: ${mejorDia.comentarios ? `<b>${DIAS[mejorDia.dia - 1].toLowerCase()}</b>` : '—'}`,
      cuerpo: hayCom ? '<div class="grafica"><canvas id="gDia"></canvas></div>' : vacio() })}

    ${tarjeta({ clase: 'c6', titulo: 'Reacciones según la hora de publicación', nota: horaReac ? `Las publicaciones de las <b>${horaReac.hora}:00</b> reciben más reacciones en promedio (${num(horaReac.reaccionesPromedio)})` : 'Promedio de reacciones por publicación',
      cuerpo: d.horaDelDia.some(x => x.publicaciones) ? '<div class="grafica"><canvas id="gHoraReac"></canvas></div>' : vacio('Se necesitan publicaciones con hora exacta (llegan al conectar Meta).') })}
    ${tarjeta({ clase: 'c6', titulo: 'Por red', cuerpo: d.porRed.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Red</th><th class="n">Coment.</th><th class="n">Public.</th><th class="n">Reacc.</th><th style="text-align:right" title="Reacciones por publicación">Prom.</th><th class="n">Compart.</th></tr></thead><tbody>
      ${d.porRed.map(r => `<tr><td class="nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COLOR_RED[r.red] || COLOR.neutro};margin-right:8px"></span><b>${esc(r.red)}</b></td>
        <td class="n">${num(r.comentarios)}</td><td class="n">${num(r.publicaciones)}</td><td class="n fuerte">${num(r.reacciones)}</td>
        <td class="n">${num(r.reaccionesPorPublicacion)}</td><td class="n">${num(r.compartidos)}</td></tr>`).join('')}</tbody></table></div>` : vacio() })}

    ${tarjeta({ clase: 'c12', titulo: 'Publicaciones con más reacciones', nota: 'En el periodo elegido', cuerpo: d.topPublicaciones.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Fecha</th><th>Red</th><th>Publicación</th><th class="n">Reacciones</th><th class="n">Comentarios</th><th class="n">Compartidos</th><th></th></tr></thead><tbody>
      ${d.topPublicaciones.map(p => `<tr><td class="chica">${fecha(p.fecha_hora || p.fecha, !!p.fecha_hora)}</td><td>${esc(p.red || '')}</td><td>${esc((p.texto || '(sin texto)').slice(0, 140))}${(p.texto || '').length > 140 ? '…' : ''}</td>
        <td class="n" style="font-weight:700;color:${COLOR.lima}">${num(p.reacciones)}</td><td class="n">${num(p.comentarios)}</td><td class="n">${num(p.compartidos)}</td>
        <td>${p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener">Ver ↗</a>` : ''}</td></tr>`).join('')}</tbody></table></div>` : vacio() })}
  </div>`;
  escalonar(el.querySelector('.rejilla'));
  animarNumeros(el);

  const etq = d.serie.map(x => etiqueta(x.periodo, ag));
  if (hayCom) barras(el.querySelector('#gCom'), etq, [
    { nombre: 'Positivos', datos: d.serie.map(x => x.positivos), color: COLOR.positivo },
    { nombre: 'Neutros', datos: d.serie.map(x => x.neutros), color: COLOR.neutro },
    { nombre: 'Negativos', datos: d.serie.map(x => x.negativos), color: COLOR.negativo },
    { nombre: 'Ruido', datos: d.serie.map(x => x.ruido), color: '#2b3a33' },
  ], { apilado: true });
  if (hayPub) grafica(el.querySelector('#gReac'), {
    type: 'bar',
    data: { labels: etq, datasets: [
      { type: 'bar', label: 'Reacciones', data: d.serie.map(x => x.reacciones), backgroundColor: COLOR.lima, borderRadius: 5, maxBarThickness: 34, yAxisID: 'y', order: 2 },
      { type: 'line', label: 'Publicaciones', data: d.serie.map(x => x.publicaciones), borderColor: COLOR.info, backgroundColor: COLOR.info, tension: .3, cubicInterpolationMode: 'monotone', pointRadius: 2, borderWidth: 2, yAxisID: 'y2', order: 1 },
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { beginAtZero: true, grid: { color: rejillaColor() }, ticks: { callback: v => compacto(v) }, title: { display: true, text: 'Reacciones' } },
        y2: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { precision: 0 }, title: { display: true, text: 'Publicaciones' } },
      },
    },
  });
  if (hayCom) {
    barras(el.querySelector('#gHora'), d.horaDelDia.map(x => `${x.hora}h`), [{ nombre: 'Comentarios', datos: d.horaDelDia.map(x => x.comentarios), color: d.horaDelDia.map(x => x.hora === mejorHora.hora ? COLOR.lima : '#3e5a74') }]);
    barras(el.querySelector('#gDia'), DIAS.map(x => x.slice(0, 3)), [{ nombre: 'Comentarios', datos: d.diaSemana.map(x => x.comentarios), color: d.diaSemana.map(x => x.dia === mejorDia.dia ? COLOR.lima : '#3e5a74') }]);
  }
  const gHR = el.querySelector('#gHoraReac');
  if (gHR) barras(gHR, d.horaDelDia.map(x => `${x.hora}h`), [{ nombre: 'Reacciones promedio', datos: d.horaDelDia.map(x => x.reaccionesPromedio), color: d.horaDelDia.map(x => horaReac && x.hora === horaReac.hora ? COLOR.lima : COLOR.pizarra) }]);
}

function kpi(titulo, valor, pie, color) {
  return `<div class="kpi"><span class="etq">${titulo}</span><span class="valor" ${color ? `style="color:${color}"` : ''}><span data-num="${valor}">0</span></span><span class="pie">${pie}</span></div>`;
}
