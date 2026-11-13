// ─── Credibilidad: calculada de comentarios, denuncias y noticias; sentimiento mensual (manual) ───
// La credibilidad se arma con 4 partes; si hay menos de 2 con datos se muestra «pocos datos».
// El sentimiento mensual de EMETRA, Héctor Flores, Policía MT y Amílcar Montejo se registra a mano
// y se muestra solo (sin un valor medido al lado).
import { api } from '../api.js';
import { esc, num, fecha, tarjeta, animarNumeros, animarBarras, escalonar, vacio, aviso, ventana, confirmar, chipPostura, delta, COLOR } from '../ui.js';
import { barras } from '../graficas.js';

const PARTES = [
  ['respuesta', 'Respuesta', 'Qué parte de las quejas en Facebook e Instagram responde la página y qué tan rápido (en 2 horas o menos es lo mejor). Para EMETRA cuentan todas las quejas; para otras instituciones, las que las mencionan. Solo aplica a instituciones.'],
  ['transparencia', 'Transparencia', 'Qué parte de los comentarios que la mencionan la asocian con corrupción, mordidas o encubrimiento. Mientras menos, más alto el puntaje.'],
  ['consistencia', 'Consistencia', 'Qué tan estable es la opinión semana a semana. Ojo: mide estabilidad, no si la opinión es buena; una opinión mala pero constante también sale alta.'],
  ['medios', 'Medios', 'Porcentaje de notas de prensa a favor o informativas sobre la entidad.'],
];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const colorP = (v) => v == null ? COLOR.neutro : v >= 60 ? COLOR.positivo : v >= 40 ? COLOR.ambar : COLOR.negativo;

export async function montar(cont, ctx) {
  const [cred, sm, ficha, ents] = await Promise.all([
    api('/api/credibilidad', { params: { dias: ctx.dias } }), api('/api/sentimiento-mensual'),
    api('/api/ficha-principal', { params: { dias: ctx.dias } }), api('/api/entidades'),
  ]);
  const conSM = ents.filter(e => sm.some(r => r.entidad_id === e.id));
  cont.innerHTML = `
  <div class="guia">La <b>credibilidad</b> se calcula sola con los comentarios, las denuncias y las noticias del periodo, en cuatro partes. Cuando hay menos de dos partes con datos suficientes se indica «pocos datos».
    El <b>sentimiento mensual</b> lo registra el equipo a mano.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: 'Credibilidad', nota: 'De 0 a 100 · calculada en el periodo elegido',
      ayuda: PARTES.map(([, t, a]) => `<b>${t}</b>: ${a}`).join('<br>') + '<br>El puntaje es el promedio de las partes que tienen datos.',
      cuerpo: cred.length ? `<div class="rejilla interna">${cred.map(credHTML).join('')}</div>` : vacio('No hay personajes configurados (se agregan en Ajustes → Personajes).') })}
    ${ficha ? fichaHTML(ficha) : ''}
    ${tarjeta({ clase: 'c12', titulo: 'Sentimiento mensual', nota: 'Registro manual del equipo',
      acciones: ctx.esAdmin ? '<button class="btn chico primario" id="btnSM">Registrar mes</button>' : '',
      ayuda: 'Porcentajes de opinión positiva, neutra y negativa que el equipo registra cada mes para cada personaje. No se calcula: es el dato oficial que ustedes cargan.',
      cuerpo: conSM.length ? `<div class="filtros" id="selEnt" style="margin-bottom:12px">${conSM.map((e, i) => `<button class="f ${i === 0 ? 'activo' : ''}" data-e="${e.id}">${esc(e.nombre)}</button>`).join('')}</div>
        <div class="rejilla interna"><div class="c7"><div class="grafica"><canvas id="gSM"></canvas></div></div><div class="c5" id="tablaSM"></div></div>`
        : vacio(ctx.esAdmin ? 'Todavía no hay meses registrados. Usa «Registrar mes».' : 'Todavía no hay meses registrados.') })}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont); animarBarras(cont);

  const pintarSM = (id) => {
    cont.querySelectorAll('#selEnt .f').forEach(b => b.classList.toggle('activo', +b.dataset.e === id));
    const filas = sm.filter(r => r.entidad_id === id).slice(-12);
    barras(cont.querySelector('#gSM'), filas.map(r => `${MESES[r.mes - 1]} ${String(r.anio).slice(2)}`), [
      { nombre: 'Positivo', datos: filas.map(r => r.positivo), color: COLOR.positivo },
      { nombre: 'Neutro', datos: filas.map(r => r.neutro), color: COLOR.neutro },
      { nombre: 'Negativo', datos: filas.map(r => r.negativo), color: COLOR.negativo },
    ], { apilado: true });
    cont.querySelector('#tablaSM').innerHTML = `<div class="tabla-caja desplazable bajo"><table class="tabla"><thead><tr><th>Mes</th><th class="n">Pos.</th><th class="n">Neu.</th><th class="n">Neg.</th>${ctx.esAdmin ? '<th></th>' : ''}</tr></thead><tbody>
      ${filas.slice().reverse().map(r => `<tr><td>${MESES[r.mes - 1]} ${r.anio}</td><td class="n t-pos">${r.positivo}%</td><td class="n">${r.neutro}%</td><td class="n t-neg">${r.negativo}%</td>
        ${ctx.esAdmin ? `<td class="n"><button class="btn chico" data-borrar-sm="${r.id}" aria-label="Borrar ${MESES[r.mes - 1]} ${r.anio}">✕</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    cont.querySelectorAll('[data-borrar-sm]').forEach(b => b.onclick = async () => {
      if (!await confirmar('Borrar mes', '¿Borrar este registro de sentimiento mensual?', { texto: 'Borrar', peligro: true })) return;
      try { await api(`/api/sentimiento-mensual/${b.dataset.borrarSm}`, { metodo: 'DELETE' }); aviso('Registro borrado.'); ctx.recargar(); } catch (e) { aviso(e.message, 'error'); }
    });
  };
  if (conSM.length) {
    cont.querySelectorAll('#selEnt .f').forEach(b => b.onclick = () => pintarSM(+b.dataset.e));
    pintarSM(conSM[0].id);
  }
  const b = cont.querySelector('#btnSM'); if (b) b.onclick = () => formSM(ents, ctx);
}

function credHTML(c) {
  const color = colorP(c.puntaje);
  return `<div class="c3 tarjeta plana" style="padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b>${esc(c.nombre)}</b><span class="nota">${esc(c.tipo || '')}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;margin:6px 0 10px">${c.puntaje == null
      ? '<div class="sin-dato">Pocos datos</div>'
      : `<div class="kpi"><span class="valor" style="color:${color}"><span data-num="${c.puntaje}">0</span><small>/100</small></span></div>${delta(c.cambio, { sufijo: ' pts' })}`}</div>
    ${PARTES.map(([k, t]) => { const p = c.partes[k] || {}; return p.aplica === false ? '' : `<div style="margin-bottom:8px" title="${esc(p.detalle || '')}">
      <div style="display:flex;justify-content:space-between;font-size:12px"><span class="nota">${t}</span><b>${p.valor == null ? '<span class="nota">—</span>' : p.valor}</b></div>
      <div style="height:5px;background:var(--fondo-2);border-radius:3px;overflow:hidden"><span data-w="${p.valor || 0}" style="display:block;height:100%;width:0;background:${colorP(p.valor)};transition:width .9s"></span></div>
      <div class="nota" style="font-size:11px">${esc(p.detalle || '')}</div></div>`; }).join('')}
    <div class="nota sep">${num(c.menciones)} menciones en comentarios</div>
  </div>`;
}

function fichaHTML(f) {
  const c = f.credibilidad, s = f.sentimiento;
  return tarjeta({ clase: 'c12 acento', titulo: esc(f.nombre), nota: 'Gerente General · visible solo para usuarios autorizados', cuerpo: `
    <div class="kpis">
      <div class="kpi"><span class="etq">Credibilidad</span><span class="valor">${c?.puntaje != null ? `<span data-num="${c.puntaje}">0</span><small>/100</small>` : '<span style="font-size:18px">Pocos datos</span>'}</span><span class="pie">calculada</span></div>
      <div class="kpi"><span class="etq">Sentimiento ${s ? `${MESES[s.mes - 1]} ${s.anio}` : ''}</span>${s ? `<span class="valor t-pos">${s.positivo}<small>%</small></span><span class="pie">${s.negativo}% negativo · ${s.neutro}% neutro (registro manual)</span>` : '<span class="valor">—</span><span class="pie">sin registro manual</span>'}</div>
      <div class="kpi"><span class="etq">Lo mencionan en comentarios</span><span class="valor"><span data-num="${f.mencionesComentarios}">0</span></span><span class="pie">en el periodo</span></div>
      <div style="flex:1;min-width:260px"><div class="nota mb">Últimas notas en medios</div>${f.ultimasMedios.length ? f.ultimasMedios.map(m => `<div style="font-size:13px;margin-bottom:6px">${chipPostura(m.sentimiento_medio)} <a href="${esc(m.enlace)}" target="_blank" rel="noopener">${esc(m.titulo)}</a> <span class="nota">· ${esc(m.medio || '')} · ${fecha(m.publicado)}</span></div>`).join('') : '<div class="nota">Sin notas recientes.</div>'}</div>
    </div>` });
}

function formSM(ents, ctx) {
  const hoy = new Date();
  const v = ventana('Registrar sentimiento mensual', `<form class="form" id="f" style="grid-template-columns:1fr 1fr 1fr">
    <label class="campo ancho">Personaje<select name="entidad_id">${ents.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
    <label class="campo">Año<input type="number" name="anio" value="${hoy.getFullYear()}" min="2020" max="2100" required></label>
    <label class="campo doble">Mes<select name="mes">${MESES.map((m, i) => `<option value="${i + 1}" ${i === hoy.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="campo">Positivo %<input type="number" name="positivo" min="0" max="100" required></label>
    <label class="campo">Neutro %<input type="number" name="neutro" min="0" max="100" required></label>
    <label class="campo">Negativo %<input type="number" name="negativo" min="0" max="100" required></label>
  </form><div class="nota sep">Si el mes ya estaba registrado, se reemplaza. Lo ideal es que los tres sumen 100.</div>`, { pie: '<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>' });
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    const f = v.cuerpo.querySelector('#f');
    if (!f.reportValidity()) return;
    const x = Object.fromEntries(new FormData(f));
    const suma = +x.positivo + +x.neutro + +x.negativo;
    if (suma < 95 || suma > 105) return aviso(`Los tres porcentajes suman ${suma}; deberían sumar 100.`, 'error');
    try { await api('/api/sentimiento-mensual', { metodo: 'POST', cuerpo: x }); v.cerrar(); aviso('Sentimiento registrado.'); ctx.recargar(); }
    catch (e) { aviso(e.message, 'error'); }
  };
}
