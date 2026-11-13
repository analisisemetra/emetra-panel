// ─── Comunicación: qué publicaciones generan apoyo o rechazo, por tipo, por red y mejor hora ───
import { api, descargar } from '../api.js';
import { esc, num, fecha, haceCuanto, tarjeta, listaBarras, animarBarras, animarNumeros, escalonar, vacio, aviso, ventana, comentarioHTML, COLOR } from '../ui.js';
import { barras } from '../graficas.js';

export async function montar(cont, ctx) {
  const [d, rsp, anu] = await Promise.all([
    api('/api/comunicacion', { params: { dias: ctx.dias } }),
    api('/api/comunicacion/respuestas', { params: { dias: ctx.dias } }).catch(() => null),
    api('/api/comunicacion/anuncios', { params: { dias: ctx.dias } }).catch(() => []),
  ]);
  const horas = d.mejorHora.horas || [];
  const mejor = horas.filter(h => h.posts >= 2).sort((a, b) => b.interaccion_promedio - a.interaccion_promedio)[0];
  cont.innerHTML = `
  <div class="guia">Aquí se mide cada publicación por lo que <b>dice la gente en sus comentarios</b>, no solo por los likes. Se toman en cuenta las publicaciones con al menos ${d.minimoComentarios} comentarios (${num(d.totalPublicacionesConComentarios)} en el periodo). Toca una publicación para ver su ficha completa.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c6', titulo: 'Las que generan más apoyo', nota: 'Más comentarios a favor que en contra', cuerpo: listaPosts(d.apoyo, 'apoyo') })}
    ${tarjeta({ clase: 'c6', titulo: 'Las que generan más rechazo', nota: 'Más comentarios en contra que a favor', cuerpo: listaPosts(d.rechazo, 'rechazo') })}
    ${tarjeta({ clase: 'c5', titulo: '¿Respondemos a la gente?', nota: 'Respuestas de la página a los comentarios',
      ayuda: 'Cuántos comentarios recibieron respuesta de la propia página y en cuánto tiempo. "Ánimo" compara el % de comentarios en contra antes y después de que la página empezó a responder en una publicación.',
      cuerpo: respuestasHTML(rsp) })}
    ${tarjeta({ clase: 'c7', titulo: '¿Cómo cambia el ánimo después de cada anuncio?', nota: '% en contra en todas las redes: 24 h antes, 24 h después y hasta 72 h después',
      ayuda: 'Para cada publicación de la página se mide cuántos comentarios negativos hubo en general (no solo en esa publicación) el día antes, el día después y los dos días siguientes. Si baja, el anuncio calmó; si sube, lo empeoró. Se necesitan al menos 8 comentarios en cada tramo.',
      cuerpo: anunciosHTML(anu) })}
    ${tarjeta({ clase: 'c7', titulo: 'Reacción por tipo de publicación', nota: 'Tipo de hecho detectado en el texto (operativo, accidente, cierre…)', cuerpo: d.porTipo.length ? `<div style="height:${Math.max(200, d.porTipo.length * 40)}px"><canvas id="gTipo"></canvas></div>` : vacio() })}
    ${tarjeta({ clase: 'c5', titulo: 'Sentimiento por red', cuerpo: d.porRed.length ? d.porRed.map(r => `
      <div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><b>${esc(r.red)}</b><span class="nota">${num(r.total)} comentarios</span></div>
      <div class="apilada" style="height:10px"><span style="width:${r.pctPositivo}%;background:${COLOR.positivo}"></span><span style="width:${r.pctNeutro}%;background:${COLOR.neutro}"></span><span style="width:${r.pctNegativo}%;background:${COLOR.negativo}"></span></div>
      <div class="nota sep">${r.pctPositivo}% positivo · ${r.pctNeutro}% neutro · ${r.pctNegativo}% negativo</div></div>`).join('') : vacio() })}
    ${tarjeta({ clase: 'c12', titulo: 'Mejor hora para publicar', nota: mejor ? `Las publicaciones de las <b>${mejor.hora}:00</b> tienen más interacción promedio (${num(mejor.interaccion_promedio)} entre reacciones, comentarios y compartidos)` : 'Interacción promedio según la hora de publicación (hora de Guatemala)',
      cuerpo: d.mejorHora.disponible ? '<div class="grafica"><canvas id="gHora"></canvas></div>' : vacio('Se necesita la hora exacta de las publicaciones; llega al conectar Facebook e Instagram.') })}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarBarras(cont); animarNumeros(cont);
  if (d.porTipo.length) barras(cont.querySelector('#gTipo'), d.porTipo.map(t => `${t.tipo} (${t.posts})`), [
    { nombre: 'A favor %', datos: d.porTipo.map(t => t.pctPositivo), color: COLOR.positivo },
    { nombre: 'En contra %', datos: d.porTipo.map(t => t.pctNegativo), color: COLOR.negativo },
  ], { horizontal: true, porcentaje: true });
  if (d.mejorHora.disponible) {
    const todas = Array.from({ length: 24 }, (_, h) => horas.find(x => x.hora === h) || { hora: h, posts: 0, interaccion_promedio: 0 });
    barras(cont.querySelector('#gHora'), todas.map(h => `${h.hora}h`), [{ nombre: 'Interacción promedio', datos: todas.map(h => h.interaccion_promedio || 0), color: todas.map(h => mejor && h.hora === mejor.hora ? COLOR.lima : '#3e5a74') }]);
  }
  cont.querySelectorAll('[data-post]').forEach(el => el.onclick = (e) => { e.preventDefault(); fichaPublicacion(el.dataset.post, ctx); });
}

function listaPosts(lista, tipo) {
  if (!lista.length) return vacio();
  return `<div style="display:flex;flex-direction:column;gap:10px">${lista.map(p => `
    <a href="#" data-post="${esc(p.post_ref)}" class="comentario" style="display:block;color:inherit;text-decoration:none">
      <div class="meta"><span>${esc(p.red || '')}</span><span>· ${fecha(p.fecha)}</span>${p.tipo_hecho ? `<span class="chip lima">${esc(p.tipo_hecho)}</span>` : ''}${(p.chapas || []).map(c => `<span class="chip">#${esc(c)}</span>`).join('')}
        <span style="margin-left:auto;font-weight:800;color:${tipo === 'apoyo' ? COLOR.positivo : COLOR.negativo}">${tipo === 'apoyo' ? p.pctPositivo : p.pctNegativo}% ${tipo === 'apoyo' ? 'a favor' : 'en contra'}</span></div>
      <div class="txt" style="font-size:13px">${esc((p.texto || '(publicación sin texto guardado)').slice(0, 160))}${(p.texto || '').length > 160 ? '…' : ''}</div>
      <div class="apilada" style="height:6px;margin-top:8px"><span style="width:${p.pctPositivo}%;background:${COLOR.positivo}"></span><span style="width:${100 - p.pctPositivo - p.pctNegativo}%;background:${COLOR.neutro}"></span><span style="width:${p.pctNegativo}%;background:${COLOR.negativo}"></span></div>
      <div class="nota sep">${num(p.comentarios)} comentarios${p.likes != null ? ` · ${num(p.likes)} reacciones` : ''}${p.vistas != null ? ` · ${num(p.vistas)} visualizaciones` : ''}</div>
    </a>`).join('')}</div>`;
}

// Ficha completa de una publicación (se usa también desde Buscar y Territorio)
export async function fichaPublicacion(ref, ctx) {
  const v = ventana('Publicación', '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const d = await api('/api/posts/ficha', { params: { ref } });
    const a = d.analisis, p = d.post || {}, s = a.sentimiento;
    const lb = (items, color) => listaBarras(items.slice(0, 6).map(x => ({ nom: x.k ?? x.senalado, n: x.n })), { color });
    v.cuerpo.innerHTML = `
      <div class="comentario" style="margin-bottom:16px">
        <div class="meta"><span>${esc(p.red || '')}</span><span>· ${fecha(p.fecha_hora || p.fecha, !!p.fecha_hora)}</span>${p.tipo_hecho ? `<span class="chip lima">${esc(p.tipo_hecho)}</span>` : ''}
          ${(p.chapas || []).map(c => `<span class="chip">#chapa${esc(c)}</span>`).join('')}${p.zona ? `<span class="chip">${esc(p.zona)}</span>` : ''}
          ${p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener" class="a-derecha">Abrir en la red ↗</a>` : ''}</div>
        <div class="txt">${esc(p.texto || '(sin texto guardado)')}</div>
        <div class="meta">${p.likes != null ? `<span>${num(p.likes)} reacciones</span>` : ''}${p.comentarios != null ? `<span>· ${num(p.comentarios)} comentarios</span>` : ''}${p.compartidos ? `<span>· ${num(p.compartidos)} compartidos</span>` : ''}${p.vistas != null ? `<span>· ${num(p.vistas)} visualizaciones</span>` : ''}${p.alcance ? `<span>· ${num(p.alcance)} personas la vieron</span>` : ''}${p.guardados ? `<span>· ${num(p.guardados)} guardados</span>` : ''}${p.metricas_en ? `<span class="nota">(cifras de ${haceCuanto(p.metricas_en)})</span>` : ''}</div>
      </div>
      <div style="display:flex;gap:26px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="kpi"><span class="etq">Comentarios analizados</span><span class="valor">${num(a.comentarios)}</span><span class="pie">+ ${num(d.ruido)} de ruido (etiquetas, emojis)</span></div>
        <div class="kpi"><span class="etq">A favor</span><span class="valor t-pos">${s.pctPositivo}<small>%</small></span></div>
        <div class="kpi"><span class="etq">En contra</span><span class="valor t-neg">${s.pctNegativo}<small>%</small></span></div>
        <div class="kpi"><span class="etq">Sobre el agente</span><span class="valor">${num(a.sobreAgente)}</span></div>
        <div class="kpi"><span class="etq">Respuestas de la página</span><span class="valor">${num(d.respuestasPagina || 0)}</span></div>
        <div style="margin-left:auto;display:flex;gap:8px">${ctx.esAdmin ? `<button class="btn chico" id="btnResumen">${d.resumenIA ? 'Rehacer resumen IA' : 'Resumir con IA'}</button><button class="btn chico primario" id="btnExcel">Descargar Excel</button>` : ''}</div>
      </div>
      <div id="resumenIA">${resumenHTML(d.resumenIA)}</div>
      <div class="rejilla interna">
        <div class="c4"><h4>Emociones</h4>${lb(a.emociones, COLOR.info)}</div>
        <div class="c4"><h4>Quejas</h4>${lb(a.quejas, COLOR.negativo)}</div>
        <div class="c4"><h4>¿A quién culpan?</h4>${lb(a.culpables, COLOR.ambar)}</div>
        <div class="c4"><h4>Zonas mencionadas</h4>${lb(a.zonas, COLOR.pizarra)}</div>
        <div class="c4"><h4>Colonias</h4>${lb(a.colonias, COLOR.pizarra)}</div>
        <div class="c4"><h4>Lo que piden</h4>${a.peticiones.length ? a.peticiones.slice(0, 8).map(x => `<div style="font-size:13px;margin-bottom:5px">• ${esc(x)}</div>`).join('') : '<div class="nota">Sin peticiones.</div>'}</div>
        <div class="c12"><h4>Comentarios</h4><div class="lista-com desplazable">${d.comentarios.map(c => comentarioConAcciones(c, ctx)).join('') || vacio()}</div></div>
      </div>`;
    animarBarras(v.cuerpo);
    const bx = v.cuerpo.querySelector('#btnExcel');
    if (bx) bx.onclick = () => descargar('/api/exportar/publicacion', { ref }).catch(e => aviso(e.message, 'error'));
    const br = v.cuerpo.querySelector('#btnResumen');
    if (br) br.onclick = async () => {
      br.disabled = true; br.textContent = 'Resumiendo…';
      try { v.cuerpo.querySelector('#resumenIA').innerHTML = resumenHTML(await api('/api/posts/resumen', { metodo: 'POST', cuerpo: { ref } })); }
      catch (e) { aviso(e.message, 'error'); }
      finally { br.disabled = false; br.textContent = 'Rehacer resumen IA'; }
    };
    enlazarOcultar(v.cuerpo);
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

function resumenHTML(r) {
  if (!r) return '';
  return `<div class="guia" style="margin-bottom:16px"><b>Qué dice la gente (resumen de IA):</b> ${esc(r.resumen || '')}
    ${r.temas?.length ? `<div style="margin-top:6px">${r.temas.map(t => `<span class="chip" style="margin:2px">${esc(t)}</span>`).join('')}</div>` : ''}
    ${r.tono ? `<div class="nota sep">Tono: ${esc(r.tono)}</div>` : ''}</div>`;
}

// Comentario con el botón de ocultar en la red (solo administradores, solo comentarios que llegaron por Meta)
export function comentarioConAcciones(c, ctx) {
  const puede = ctx.esAdmin && (c.se_puede_ocultar || (c.origen === 'meta' && c.plataforma_id));
  if (!puede) return comentarioHTML(c);
  return comentarioHTML(c).replace(/<\/div>\s*$/, `<div style="margin-top:8px"><button class="btn chico" data-ocultar="${c.id}" data-estado="${c.oculto ? '1' : '0'}">${c.oculto ? 'Volver a mostrar en la red' : 'Ocultar en la red'}</button></div></div>`);
}
export function enlazarOcultar(raiz) {
  raiz.querySelectorAll('[data-ocultar]').forEach(b => b.onclick = async () => {
    const ocultar = b.dataset.estado !== '1';
    const { confirmar } = await import('../ui.js');
    if (!await confirmar(ocultar ? 'Ocultar comentario' : 'Mostrar comentario', ocultar
      ? 'El comentario quedará oculto en Facebook/Instagram: el autor y sus amigos lo siguen viendo, el resto no. Queda registrado en la auditoría.'
      : 'El comentario volverá a ser visible para todos en la red.', { texto: ocultar ? 'Ocultar' : 'Mostrar', peligro: ocultar })) return;
    try {
      await api(`/api/menciones/${b.dataset.ocultar}/ocultar`, { metodo: 'POST', cuerpo: { ocultar } });
      b.dataset.estado = ocultar ? '1' : '0'; b.textContent = ocultar ? 'Volver a mostrar en la red' : 'Ocultar en la red';
      aviso(ocultar ? 'Comentario ocultado.' : 'Comentario visible otra vez.');
    } catch (e) { aviso(e.message, 'error'); }
  });
}

function respuestasHTML(r) {
  if (!r || !r.hilos) return vacio('Sin comentarios de Facebook o Instagram en el periodo.');
  const a = r.animo;
  return `<div class="kpis mb">
      <div class="kpi"><span class="etq">Comentarios respondidos</span><span class="valor"><span data-num="${r.pctRespondidos}">0</span><small>%</small></span><span class="pie">${num(r.respondidos)} de ${num(r.hilos)}</span></div>
      <div class="kpi"><span class="etq">Quejas respondidas</span><span class="valor" style="color:${r.quejasRespondidas >= 30 ? COLOR.positivo : COLOR.ambar}"><span data-num="${r.quejasRespondidas}">0</span><small>%</small></span></div>
      <div class="kpi"><span class="etq">Tiempo promedio</span><span class="valor">${r.horasPromedio == null ? '—' : r.horasPromedio < 1 ? `${Math.round(r.horasPromedio * 60)}<small>min</small>` : `${num(r.horasPromedio, 1)}<small>h</small>`}</span></div></div>
    ${r.porRed.map(x => `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>${esc(x.red)}</span><span class="nota">${x.pctRespondidos}% respondidos${x.horas != null ? ` · ${num(x.horas, 1)} h` : ''}</span></div>`).join('')}
    <div class="nota sep">${a.suficiente ? `Ánimo en las ${num(a.publicaciones)} publicaciones donde respondimos: <b class="t-neg">${a.negativoAntes}%</b> en contra antes de responder → <b style="color:${a.negativoDespues <= a.negativoAntes ? COLOR.positivo : COLOR.negativo}">${a.negativoDespues}%</b> después.` : 'Todavía hay pocos comentarios para medir si responder cambia el ánimo.'}</div>`;
}

function anunciosHTML(lista) {
  const conDatos = (lista || []).filter(x => x.negativoAntes != null && (x.negativo24 != null || x.negativo72 != null));
  if (!conDatos.length) return vacio('Hace falta más volumen de comentarios alrededor de las publicaciones para medir el cambio.');
  const celda = (v, c) => v == null ? '<span class="nota">—</span>' : `${v}%${c != null ? ` ${c === 0 ? '<span class="delta igual">=</span>' : `<span class="delta ${c > 0 ? 'sube-malo' : 'baja-bueno'}">${c > 0 ? '▲' : '▼'} ${Math.abs(c)}</span>`}` : ''}`;
  const caja = (t, v, c) => `<div style="flex:1;min-width:70px"><div class="nota">${t}</div><div style="font-weight:700;white-space:nowrap">${celda(v, c)}</div></div>`;
  return `<div class="lista-com desplazable">${conDatos.slice(0, 15).map(x => `<div class="comentario">
    <div class="meta"><span>${esc(x.red || '')}</span><span>· ${fecha(x.fecha, true)}</span>${x.terminado ? '' : '<span class="chip ambar">en curso</span>'}</div>
    <div class="txt"><a href="#" data-post="${esc(x.post_ref)}">${esc((x.texto || 'Publicación').slice(0, 110))}${(x.texto || '').length > 110 ? '…' : ''}</a></div>
    <div style="display:flex;gap:10px;margin-top:8px">${caja('24 h antes', x.negativoAntes)}${caja('24 h después', x.negativo24, x.cambio24)}${caja('Hasta 72 h', x.negativo72, x.cambio72)}</div></div>`).join('')}</div>`;
}
