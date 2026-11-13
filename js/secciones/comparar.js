// ─── Comparar: dos periodos cualquiera (ej. este mes contra el mismo mes del año pasado)
// o dos páginas lado a lado con el mismo periodo ───
import { api } from '../api.js';
import { esc, num, tarjeta, vacio, aviso, COLOR } from '../ui.js';

const hoyGT = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
const restar = (f, dias) => new Date(new Date(f + 'T12:00:00Z').getTime() - dias * 864e5).toISOString().slice(0, 10);

// Medidas que se comparan: [clave, etiqueta, sufijo, menosEsMejor]
const DE_COMENTARIOS = new Set(['negativo', 'positivo', 'contraEmetra', 'enojo']);
const FILAS = [
  ['comentarios', 'Comentarios', '', null], ['negativo', 'En contra', '%', true], ['positivo', 'A favor', '%', false],
  ['contraEmetra', 'Quejas que culpan a EMETRA', '%', true], ['enojo', 'Nivel de enojo (1 a 5)', '', true], ['denuncias', 'Denuncias', '', true],
  ['publicaciones', 'Publicaciones de la página', '', null], ['reacciones', 'Reacciones (likes)', '', false],
  ['notas', 'Notas en medios', '', null], ['notasEnContra', 'Notas en contra', '', true],
];

export async function montar(cont, ctx) {
  const pags = ctx.paginas || [];
  const hoy = hoyGT();
  const f = {
    modo: ctx.parametros.modo === 'paginas' && pags.length > 1 ? 'paginas' : 'periodos',
    aDesde: restar(hoy, 29), aHasta: hoy, bDesde: restar(hoy, 59), bHasta: restar(hoy, 30),
    a: String(pags.find(p => p.principal)?.id || pags[0]?.id || ''), b: String(pags.find(p => !p.principal)?.id || 'todas'), dias: 30,
  };
  const atajos = [
    ['Últimos 30 días vs. 30 anteriores', () => ({ aDesde: restar(hoy, 29), aHasta: hoy, bDesde: restar(hoy, 59), bHasta: restar(hoy, 30) })],
    ['Este mes vs. mes pasado', () => { const i = hoy.slice(0, 8) + '01'; const fp = restar(i, 1); return { aDesde: i, aHasta: hoy, bDesde: fp.slice(0, 8) + '01', bHasta: fp }; }],
    ['Este mes vs. hace un año', () => { const i = hoy.slice(0, 8) + '01'; const y = String(Number(hoy.slice(0, 4)) - 1); return { aDesde: i, aHasta: hoy, bDesde: y + i.slice(4), bHasta: y + hoy.slice(4) }; }],
  ];

  cont.insertAdjacentHTML('beforeend', `
    ${tarjeta({ titulo: '¿Qué quieres comparar?', ayuda: 'Pon dos periodos uno junto al otro (por ejemplo, el mes de un operativo contra el mes anterior), o dos páginas con el mismo periodo. Las flechas dicen si el lado A está mejor o peor que el B.',
      cuerpo: `<div class="filtros" id="cModo" style="margin-bottom:14px"><button class="f" data-m="periodos">Dos periodos</button>${pags.length > 1 ? '<button class="f" data-m="paginas">Dos páginas</button>' : ''}</div>
      <div id="cForm"></div><div class="sep"><button class="btn primario" id="cComparar">Comparar</button></div>` })}
    <div id="cRes" style="margin-top:18px"></div>`);
  const form = cont.querySelector('#cForm'), res = cont.querySelector('#cRes');

  const pintarForm = () => {
    cont.querySelectorAll('#cModo .f').forEach(b => b.classList.toggle('activo', b.dataset.m === f.modo));
    if (f.modo === 'periodos') {
      form.innerHTML = `<div class="filtros" style="margin-bottom:12px">${atajos.map(([t], i) => `<button class="f" data-at="${i}">${t}</button>`).join('')}</div>
        <div class="rejilla interna">
          <div class="c6"><div class="nota" style="font-weight:700;margin-bottom:6px;color:var(--lima)">PERIODO A</div><div class="linea"><label class="campo crece">Desde<input type="date" id="aDesde" value="${f.aDesde}" max="${hoy}"></label><label class="campo crece">Hasta<input type="date" id="aHasta" value="${f.aHasta}" max="${hoy}"></label></div></div>
          <div class="c6"><div class="nota" style="font-weight:700;margin-bottom:6px">PERIODO B</div><div class="linea"><label class="campo crece">Desde<input type="date" id="bDesde" value="${f.bDesde}" max="${hoy}"></label><label class="campo crece">Hasta<input type="date" id="bHasta" value="${f.bHasta}" max="${hoy}"></label></div></div>
        </div>`;
      form.querySelectorAll('[data-at]').forEach(b => b.onclick = () => { Object.assign(f, atajos[b.dataset.at][1]()); pintarForm(); comparar(); });
      form.querySelectorAll('input[type=date]').forEach(i => i.onchange = () => { f[i.id] = i.value; });
    } else {
      const opciones = (sel) => `<option value="todas" ${sel === 'todas' ? 'selected' : ''}>Todas las páginas</option>${pags.map(p => `<option value="${p.id}" ${String(p.id) === sel ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}`;
      form.innerHTML = `<div class="rejilla interna">
          <label class="campo c6">Página A<select id="pA">${opciones(f.a)}</select></label>
          <label class="campo c6">Página B<select id="pB">${opciones(f.b)}</select></label></div>
        <div class="filtros" style="margin-top:12px">${[7, 30, 90, 365].map(d => `<button class="f ${f.dias === d ? 'activo' : ''}" data-d="${d}">${d === 365 ? 'Último año' : `Últimos ${d} días`}</button>`).join('')}</div>`;
      form.querySelector('#pA').onchange = (e) => { f.a = e.target.value; };
      form.querySelector('#pB').onchange = (e) => { f.b = e.target.value; };
      form.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { f.dias = Number(b.dataset.d); pintarForm(); });
    }
  };

  const comparar = async () => {
    if (f.modo === 'periodos' && (!f.aDesde || !f.aHasta || !f.bDesde || !f.bHasta || f.aDesde > f.aHasta || f.bDesde > f.bHasta)) return aviso('Revisa las fechas: cada "desde" debe ser antes de su "hasta".', 'error');
    if (f.modo === 'paginas' && f.a === f.b) return aviso('Elige dos páginas distintas.', 'error');
    res.innerHTML = '<div class="tarjeta cargando"></div>';
    try {
      const params = f.modo === 'periodos' ? { modo: 'periodos', aDesde: f.aDesde, aHasta: f.aHasta, bDesde: f.bDesde, bHasta: f.bHasta }
        : { modo: 'paginas', a: f.a, b: f.b, desde: restar(hoy, f.dias - 1), hasta: hoy };
      res.innerHTML = resultado(await api('/api/comparar', { params }));
    } catch (e) { res.innerHTML = ''; aviso(e.message, 'error'); }
  };

  cont.querySelectorAll('#cModo .f').forEach(b => b.onclick = () => { f.modo = b.dataset.m; pintarForm(); res.innerHTML = ''; });
  cont.querySelector('#cComparar').onclick = comparar;
  pintarForm();
  await comparar();
}

function resultado(r) {
  const { a, b } = r;
  const sinComentarios = !a.comentarios || !b.comentarios;
  const flecha = (k, va, vb, menosEsMejor) => {
    if (va == null || vb == null || menosEsMejor === null) return '';
    if (sinComentarios && DE_COMENTARIOS.has(k)) return '';   // un lado sin comentarios: el % no se puede comparar
    const dif = Math.round((va - vb) * 10) / 10;
    if (dif === 0) return '<span class="delta igual">=</span>';
    const malo = menosEsMejor ? dif > 0 : dif < 0;
    return `<span class="delta ${dif > 0 ? 'sube' : 'baja'}-${malo ? 'malo' : 'bueno'}">${dif > 0 ? '▲' : '▼'} ${num(Math.abs(dif), Number.isInteger(dif) ? 0 : 1)}</span>`;
  };
  const val = (v, suf) => v == null ? '<span class="nota">—</span>' : `${num(v, Number.isInteger(v) ? 0 : 1)}${suf}`;
  const listas = (clave, titulo, color) => tarjeta({ clase: 'c6', titulo, cuerpo: `<div class="rejilla interna">
    ${[a, b].map((x, i) => `<div class="c6"><div class="nota" style="font-weight:700;margin-bottom:8px;${i === 0 ? 'color:var(--lima)' : ''}">${i === 0 ? 'A' : 'B'}</div>
      ${x[clave].length ? x[clave].map(it => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:6px"><span>${esc(it.nombre)}</span><b style="color:${color}">${num(it.n)}</b></div>`).join('') : vacio('Sin datos')}</div>`).join('')}</div>` });
  return `<div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: 'Lado a lado', nota: `<b style="color:var(--lima)">A</b>: ${esc(a.titulo)} · <b>B</b>: ${esc(b.titulo)}`,
      cuerpo: `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Medida</th><th class="n" style="color:var(--lima)">A</th><th class="n">B</th><th class="n">A contra B</th></tr></thead><tbody>
        ${FILAS.map(([k, t, suf, menos]) => `<tr><td>${t}</td><td class="n fuerte">${val(a[k], suf)}</td><td class="n">${val(b[k], suf)}</td><td class="n">${flecha(k, a[k], b[k], menos)}</td></tr>`).join('')}
      </tbody></table></div>${sinComentarios ? `<div class="nota sep">${!a.comentarios ? 'El lado A' : 'El lado B'} no tiene comentarios en ese periodo; los porcentajes no se comparan.</div>` : ''}` })}
    ${listas('quejas', 'Lo que más reclaman', COLOR.negativo)}
    ${listas('zonas', 'Zonas con más quejas', COLOR.ambar)}
    ${listas('culpables', '¿A quién culpan?', COLOR.negativo)}
  </div>`;
}
