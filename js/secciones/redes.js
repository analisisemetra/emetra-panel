// ─── Nuestras redes: cuántos nos siguen y cuánta gente ve lo que publicamos ───
// Facebook, Instagram y Threads llegan solos cada hora; TikTok y X se anotan a mano.
import { api } from '../api.js';
import { esc, num, compacto, fecha, tarjeta, kpi, kpis, grafica, pestanas, marcarPestana, delta, animarNumeros, escalonar, vacio, aviso, ventana, confirmar, COLOR } from '../ui.js';
import { lineas, barras, chispa } from '../graficas.js';

// Un color fijo por red, para que se reconozca en todas las gráficas
const colorRed = (red) => ({ Facebook: COLOR.info, Instagram: COLOR.ambar, Threads: COLOR.neutro, TikTok: COLOR.positivo, X: COLOR.pizarra, YouTube: COLOR.negativo }[red] || COLOR.lima);
const corta = (f) => f ? `${+f.slice(8, 10)}/${+f.slice(5, 7)}` : '';

export async function montar(cont, ctx) {
  const d = await api('/api/redes', { params: { dias: ctx.dias } });
  const tot = d.redes.reduce((a, r) => ({ vistas: a.vistas + r.vistas, alcance: a.alcance + r.alcance, inter: a.inter + r.interacciones, pubs: a.pubs + r.publicaciones, medidas: a.medidas + r.conVistas }),
    { vistas: 0, alcance: 0, inter: 0, pubs: 0, medidas: 0 });
  const tasa = tot.vistas ? Math.round(tot.inter / tot.vistas * 1000) / 10 : null;
  const semanas = [...new Set(d.semanas.map(s => s.semana))];
  const redesVistas = [...new Set(d.semanas.map(s => s.red))];

  cont.innerHTML = `
  <div class="guia">Aquí se ve <b>cuánto crecen las cuentas de la institución</b> y <b>cuánta gente ve lo que publicamos</b>. Facebook, Instagram y Threads se actualizan solos cada hora; TikTok y X se anotan a mano.
    Las visualizaciones de cada publicación se vuelven a pedir durante 28 días, porque siguen subiendo después de publicar.</div>
  ${d.faltas.length ? `<div class="guia aviso-ambar">${d.faltas.map(esc).join(' ')}${ctx.esAdmin ? ' Se arregla en <a href="#ajustes?v=meta">Ajustes → Facebook e Instagram</a>.' : ''}</div>` : ''}
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: 'Seguidores', nota: `Crecimiento ${esc(ctx.periodo || 'en el periodo')}`,
      acciones: ctx.esAdmin ? '<button class="btn chico primario" id="btnAnotar">Anotar TikTok o X</button>' : '',
      ayuda: 'El total de seguidores de cada cuenta, una foto por día. «En el periodo» compara el último dato con el del inicio del periodo elegido. Instagram además da cuántos se ganaron y cuántos se perdieron cada día. La historia empieza el día en que se conectó cada red: Meta no da los días anteriores.',
      cuerpo: d.cuentas.length ? `<div class="rejilla interna">${d.cuentas.map(cuentaHTML).join('')}</div>` : vacio('Todavía no hay datos de seguidores. Llegan solos al conectar Facebook, Instagram o Threads (o se anotan a mano los de TikTok y X).') })}
    ${d.cuentas.some(c => c.serie.length > 1) ? tarjeta({ clase: 'c12', titulo: 'Curva de seguidores', nota: 'Elige una cuenta',
      cuerpo: `${pestanas(d.cuentas.filter(c => c.serie.length > 1).map((c, i) => [String(i), esc(c.nombre)]), '0', 'pCuenta')}${grafica('gSeg')}<div id="tablaSeg"></div>` }) : ''}

    ${tarjeta({ clase: 'c12', titulo: 'Visualizaciones de lo que publicamos', nota: `Publicaciones propias ${esc(ctx.periodo || '')}`,
      ayuda: '<b>Visualizaciones</b>: cuántas veces se vio la publicación. <b>Personas</b>: cuántas personas distintas la vieron (Facebook e Instagram). <b>Interacción</b>: reacciones, comentarios, compartidos y guardados por cada 100 visualizaciones. En Facebook la medida cambió en junio de 2026: no conviene comparar con cifras de antes.',
      cuerpo: tot.medidas ? `${kpis([
        kpi({ etq: 'Visualizaciones', valor: tot.vistas, pie: `en ${num(tot.medidas)} publicaciones medidas` }),
        kpi({ etq: 'Personas que las vieron', valor: tot.alcance || null, pie: 'Facebook e Instagram' }),
        kpi({ etq: 'Interacción', valor: tasa, dec: 1, sufijo: ' por 100', pie: 'reacciones, comentarios y compartidos' }),
        kpi({ etq: 'Promedio por publicación', valor: Math.round(tot.vistas / tot.medidas), pie: 'visualizaciones' }),
      ])}
      <div class="sep-grande tabla-caja"><table class="tabla"><thead><tr><th>Red</th><th class="n">Publicaciones</th><th class="n">Visualizaciones</th><th class="n">Promedio</th><th class="n">Personas</th><th class="n">Interacción</th></tr></thead><tbody>
        ${d.redes.map(r => `<tr><td><span class="punto" style="background:${colorRed(r.red)}"></span>${esc(r.red)}</td><td class="n">${num(r.publicaciones)}${r.conVistas < r.publicaciones ? ` <span class="nota">(${num(r.conVistas)} medidas)</span>` : ''}</td>
          <td class="n fuerte">${num(r.vistas)}</td><td class="n">${num(r.promedio)}</td><td class="n">${r.alcance ? num(r.alcance) : '<span class="nota">—</span>'}</td><td class="n">${r.tasa == null ? '—' : num(r.tasa, 1)}</td></tr>`).join('')}
      </tbody></table></div>` : vacio('Todavía no hay visualizaciones medidas en este periodo. Llegan al conectar Facebook, Instagram y Threads.') })}
    ${semanas.length > 1 ? tarjeta({ clase: 'c12', titulo: 'Visualizaciones por semana', nota: 'Según la semana en que se publicó', cuerpo: grafica('gSem') }) : ''}
    ${tarjeta({ clase: 'c12', titulo: 'Las publicaciones más vistas', nota: 'Toca una para ver su ficha y lo que dice la gente', cuerpo: masVistasHTML(d.masVistas) })}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont);

  // Curva de una cuenta
  const conCurva = d.cuentas.filter(c => c.serie.length > 1);
  const pintarCurva = (i) => {
    const c = conCurva[i]; if (!c) return;
    marcarPestana(cont.querySelector('#pCuenta'), String(i));
    lineas(cont.querySelector('#gSeg'), c.serie.map(x => corta(x.fecha)), [{ nombre: c.nombre, datos: c.serie.map(x => x.total), color: colorRed(c.red) }], { desdeCero: false });
    const conMov = c.serie.filter(x => x.ganados != null);
    const filas = c.serie.slice().reverse().slice(0, 14);
    cont.querySelector('#tablaSeg').innerHTML = `<div class="tabla-caja desplazable bajo sep"><table class="tabla chica"><thead><tr><th>Día</th><th class="n">Seguidores</th><th class="n">Cambio</th>${conMov.length ? '<th class="n">Ganados</th><th class="n">Perdidos</th>' : ''}${ctx.esAdmin && c.manual ? '<th></th>' : ''}</tr></thead><tbody>
      ${filas.map((x, k) => { const ant = c.serie[c.serie.length - 2 - k]; const dif = ant ? x.total - ant.total : null; return `<tr><td>${fecha(x.fecha + 'T12:00:00')}</td><td class="n">${num(x.total)}</td>
        <td class="n">${dif == null ? '—' : `<span class="${dif > 0 ? 't-pos' : dif < 0 ? 't-neg' : ''}">${dif > 0 ? '+' : ''}${num(dif)}</span>`}</td>
        ${conMov.length ? `<td class="n">${x.ganados == null ? '—' : num(x.ganados)}</td><td class="n">${x.perdidos == null ? '—' : num(x.perdidos)}</td>` : ''}
        ${ctx.esAdmin && c.manual ? `<td class="n">${x.origen === 'manual' ? `<button class="btn chico" data-borrar-seg="${x.id}" aria-label="Borrar dato">✕</button>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
    cont.querySelectorAll('[data-borrar-seg]').forEach(b => b.onclick = async () => {
      if (!await confirmar('Borrar dato', '¿Borrar este dato de seguidores anotado a mano?', { texto: 'Borrar', peligro: true })) return;
      try { await api(`/api/redes/seguidores/${b.dataset.borrarSeg}`, { metodo: 'DELETE' }); aviso('Dato borrado.'); ctx.recargar(); } catch (e) { aviso(e.message, 'error'); }
    });
  };
  if (conCurva.length) {
    cont.querySelectorAll('#pCuenta [data-p]').forEach(b => b.onclick = () => pintarCurva(+b.dataset.p));
    pintarCurva(0);
  }
  if (semanas.length > 1) barras(cont.querySelector('#gSem'), semanas.map(corta), redesVistas.map(red => ({
    nombre: red, color: colorRed(red), datos: semanas.map(s => d.semanas.find(x => x.semana === s && x.red === red)?.vistas || 0) })), { apilado: true });
  cont.querySelectorAll('[data-post]').forEach(el => el.onclick = async (e) => { e.preventDefault(); (await import('./comunicacion.js')).fichaPublicacion(el.dataset.post, ctx); });
  const ba = cont.querySelector('#btnAnotar'); if (ba) ba.onclick = () => anotar(d.redesManuales, ctx);
}

function cuentaHTML(c) {
  const col = colorRed(c.red);
  return `<div class="c3 tarjeta plana pila junta">
    <div class="linea entre"><b><span class="punto" style="background:${col}"></span>${esc(c.nombre)}</b>${c.manual ? '<span class="chip">a mano</span>' : ''}</div>
    ${kpi({ valor: c.actual, tam: 'chico', pie: `al ${fecha(c.al + 'T12:00:00')}` })}
    <div class="linea">${c.cambio == null ? '<span class="nota">Falta un dato anterior para medir el cambio</span>'
      : `${delta(c.cambio)}<span class="nota">${c.pctCambio != null ? `${c.pctCambio > 0 ? '+' : ''}${num(c.pctCambio, 1)}% ` : ''}desde el ${fecha(c.desde + 'T12:00:00')}</span>`}</div>
    ${c.ultimos7 != null ? `<div class="nota">Últimos 7 días: <b>${c.ultimos7 > 0 ? '+' : ''}${num(c.ultimos7)}</b></div>` : ''}
    ${c.ganados != null ? `<div class="nota">Instagram: <b class="t-pos">+${num(c.ganados)}</b> ganados · <b class="t-neg">−${num(c.perdidos)}</b> perdidos</div>` : ''}
    ${chispa(c.serie.map(x => x.total), col, 220, 40)}
  </div>`;
}

function masVistasHTML(lista) {
  if (!lista.length) return vacio('Sin publicaciones con visualizaciones en este periodo.');
  return `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Publicación</th><th class="n">Visualizaciones</th><th class="n">Personas</th><th class="n">Interacción</th><th class="n">En contra</th></tr></thead><tbody>
    ${lista.map(p => `<tr><td><div class="linea"><span class="punto" style="background:${colorRed(p.red)}"></span><span class="nota">${esc(p.red)} · ${fecha(p.fecha_hora, true)}</span></div>
        <a href="#" data-post="${esc(p.post_ref)}">${esc((p.texto || '(sin texto)').slice(0, 110))}${(p.texto || '').length > 110 ? '…' : ''}</a></td>
      <td class="n fuerte">${compacto(p.vistas)}</td><td class="n">${p.alcance == null ? '—' : compacto(p.alcance)}</td><td class="n">${p.tasa == null ? '—' : num(p.tasa, 1)}</td>
      <td class="n">${p.pctNegativo == null ? '<span class="nota" title="Menos de 5 comentarios analizados">—</span>' : `<span class="${p.pctNegativo >= 50 ? 't-neg' : ''}">${p.pctNegativo}%</span>`}</td></tr>`).join('')}
  </tbody></table></div><div class="nota sep">«En contra»: % de comentarios negativos de esa publicación (si tiene al menos 5 analizados).</div>`;
}

function anotar(redes, ctx) {
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const v = ventana('Anotar seguidores', `<form class="form" id="f">
    <label class="campo">Red<select name="red">${redes.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
    <label class="campo">Día<input type="date" name="fecha" value="${hoy}" max="${hoy}" required></label>
    <label class="campo ancho">Total de seguidores ese día<input type="number" name="total" min="0" step="1" required inputmode="numeric"></label>
  </form><div class="nota sep">Se copia el número que muestra el perfil. Con anotarlo una vez por semana (el mismo día) basta para ver la tendencia. Si ese día ya tenía un dato, se reemplaza.</div>`,
  { pie: '<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>' });
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    const f = v.cuerpo.querySelector('#f');
    if (!f.reportValidity()) return;
    try { const r = await api('/api/redes/seguidores', { metodo: 'POST', cuerpo: Object.fromEntries(new FormData(f)) }); v.cerrar(); aviso(`Guardado en ${r.pagina}.`); ctx.recargar(); }
    catch (e) { aviso(e.message, 'error'); }
  };
}
