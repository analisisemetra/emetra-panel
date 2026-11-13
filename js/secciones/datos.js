// ─── Datos (solo administradores): cargar Excel, revisar la IA, descargar, respaldar ───
import { api, descargar } from '../api.js';
import { esc, num, fecha, haceCuanto, tarjeta, vacio, aviso, ventana, chipSent, escalonar, animarBarras, animarNumeros, kpi, kpis, COLOR } from '../ui.js';

const EXPORTES = [['comentarios', 'Comentarios'], ['denuncias', 'Denuncias'], ['zonas', 'Zonas'], ['colonias', 'Colonias'], ['amenazas', 'Amenazas'], ['medios', 'Noticias'], ['chapas', 'Chapas'], ['bitacora', 'Bitácora']];

export async function montar(cont, ctx) {
  const [cargas, uso, cal, conteo, paginas, limpieza, trabajos] = await Promise.all([
    api('/api/cargas'), api('/api/uso'), api('/api/calidad-ia'), api('/api/datos/conteo-meta'), api('/api/paginas').catch(() => []),
    api('/api/datos/limpieza').catch(() => null), api('/api/trabajos').catch(() => []),
  ]);
  const lote = trabajos.find(t => t.tipo === 'analisis_lote');
  const tope = await api('/api/ajustes').then(a => a.ia.tope).catch(() => 20);
  const pctGasto = tope ? Math.min(100, Math.round(uso.ia.costo / tope * 100)) : 0;
  const fbig = conteo.conteo.filter(c => ['Facebook', 'Instagram'].includes(c.red));
  const fbigExcel = fbig.filter(c => c.origen !== 'meta').reduce((s, c) => s + c.n, 0);
  const tkx = conteo.conteo.filter(c => ['TikTok', 'X'].includes(c.red)).reduce((s, c) => s + c.n, 0);

  const colorGasto = pctGasto >= 80 ? 'neg' : pctGasto >= 50 ? 'ambar' : 'lima';
  const tonoAcierto = cal.acierto == null ? '' : cal.acierto >= 85 ? 'pos' : cal.acierto >= 70 ? 'ambar' : 'neg';
  cont.innerHTML = `
  <div class="rejilla">
    ${tarjeta({ clase: 'c7', titulo: 'Subir comentarios de TikTok y X', nota: 'Archivos Excel de ExportComments. Puedes subir varios a la vez; los repetidos se ignoran solos.',
      cuerpo: `<label class="zona-subida" id="zonaSubida"><input type="file" id="archivos" accept=".xlsx,.xls" multiple hidden>
        <b>Arrastra aquí los archivos</b><span class="nota">o toca para elegirlos</span></label>
        ${paginas.length > 1 ? `<label class="campo sep">¿De qué página son estos comentarios?<select id="paginaCarga">${paginas.map(p => `<option value="${p.id}" ${p.principal ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>` : ''}
        <div id="resCarga" class="sep"></div>` })}
    ${tarjeta({ clase: 'c5', titulo: 'Gasto de IA este mes', acciones: '<button class="btn chico" id="btnPendientes">Analizar pendientes</button>',
      ayuda: 'Lo que lleva gastado la IA este mes contra el tope que pusiste en Ajustes. Al 80% y al 100% llega un aviso por Telegram; al 100% el análisis se pausa hasta el mes siguiente. Los análisis en lote se aprueban aparte.',
      cuerpo: `${kpi({ valor: '$' + uso.ia.costo.toFixed(2), tono: colorGasto, pie: `de $${num(tope)} de tope mensual · ${num(uso.ia.llamadas)} consultas` })}
      <div class="apilada sep"><span data-w="${pctGasto}" style="background:${COLOR[colorGasto === 'neg' ? 'negativo' : colorGasto === 'ambar' ? 'ambar' : 'lima']}"></span></div>
      ${uso.ia.porTarea.length ? `<div class="nota sep">${uso.ia.porTarea.map(t => `${esc(t.tarea)} (${esc(t.modelo)}): $${t.costo.toFixed(3)}`).join('<br>')}</div>` : ''}
      <div class="nota sep">Búsquedas de direcciones en Google este mes: ${num(uso.google)}</div>` })}

    ${tarjeta({ clase: 'c12', titulo: 'Revisión semanal de la IA', nota: `20 comentarios a la semana para medir qué tan bien clasifica. Esta semana: ${num(cal.revisadosEstaSemana)} de ${cal.metaSemanal}.`,
      acciones: '<button class="btn chico primario" id="btnMuestra">Revisar 20 comentarios</button>',
      ayuda: 'Una persona lee comentarios al azar y dice si la IA acertó. El acierto de los últimos 90 días dice qué tanto confiar en los números del tablero; cada corrección se usa como ejemplo para que la IA aprenda.',
      cuerpo: `<div class="kpis">
        ${kpi({ etq: 'Acierto (90 días)', valor: cal.acierto, sufijo: '%', tono: tonoAcierto, pie: `${num(cal.revisados)} revisados` })}
        <div class="crece"><div class="rotulo">Errores más comunes</div>${cal.errores.length ? `<div class="pila junta">${cal.errores.slice(0, 5).map(e => `<div>La IA dijo <b>${esc(e.sentimiento_ia)}</b> y era <b>${esc(e.sentimiento_humano)}</b> · ${num(e.n)} veces</div>`).join('')}</div>` : '<div class="nota">Sin errores registrados.</div>'}</div>
      </div>` })}

    ${tarjeta({ clase: 'c6', titulo: 'Volver a analizar con IA (en lote)', nota: 'Postura hacia EMETRA, sarcasmo y quién la defiende',
      ayuda: 'El análisis en lote cuesta la mitad, pero tarda: la IA devuelve los resultados en minutos u horas. Primero se calcula el costo con el largo real de cada comentario; solo empieza cuando apruebas un presupuesto, y se manda solo lo que cabe en él (lo demás queda para después). Las correcciones hechas a mano no se tocan.',
      cuerpo: `<div class="filtros mb" id="alcanceLote"><button class="f activo" data-a="reanalisis">Comentarios ya analizados</button><button class="f" data-a="pendientes">Solo pendientes</button></div>
        <div id="estimacion" class="nota">Calculando costo…</div>
        ${lote ? `<div class="nota sep">Último lote: <b>${esc(lote.estado)}</b> · ${num(lote.datos?.aplicados || 0)} de ${num(lote.datos?.total || lote.datos?.enviados || 0)} aplicados · $${(lote.datos?.gastado || 0).toFixed(2)} de $${lote.datos?.presupuesto ?? '—'} · ${haceCuanto(lote.actualizado_en)}</div>` : ''}` })}
    ${tarjeta({ clase: 'c6', titulo: 'Descargar a Excel', nota: `Del periodo elegido arriba${ctx.dias ? ` (${ctx.dias} días)` : ' (todo)'} y de la página seleccionada`,
      cuerpo: `<div class="linea">${EXPORTES.map(([k, t]) => `<button class="btn chico" data-exportar="${k}">${t}</button>`).join('')}</div>` })}

    ${tarjeta({ clase: 'c6', titulo: 'Respaldo', nota: conteo.ultimoRespaldo ? `Último: ${haceCuanto(conteo.ultimoRespaldo.en)} por ${esc(conteo.ultimoRespaldo.por)} (${esc(Array.isArray(conteo.ultimoRespaldo.redes) ? conteo.ultimoRespaldo.redes.join(', ') : conteo.ultimoRespaldo.redes)})` : 'Todavía no se ha descargado ningún respaldo',
      cuerpo: `<div class="nota mb">Cada lunes también llega un respaldo completo por Telegram a los administradores. Guárdalo en un lugar seguro: contiene todos los datos.</div>
        <div class="linea"><button class="btn chico primario" data-respaldo="">Respaldo completo</button><button class="btn chico" data-respaldo="Facebook,Instagram">Solo Facebook e Instagram</button><button class="btn chico" data-respaldo="TikTok,X">Solo TikTok y X</button></div>` })}
    ${tarjeta({ clase: 'c6', titulo: 'Privacidad: borrar los datos de una persona', nota: 'Para atender a quien pida que se borren sus comentarios',
      ayuda: 'Busca a la persona por su nombre, su usuario o pegando el enlace de uno de sus comentarios. Al borrar, se eliminan todos sus comentarios de esa red y queda en una lista para no volver a traerlos de Facebook o Instagram. No borra nada de la red social. Queda registrado en la auditoría.',
      cuerpo: `<form class="linea abajo" id="fPriv"><label class="campo crece">Nombre, usuario o enlace<input type="search" id="qPriv" placeholder="Ej. Juan Pérez o https://facebook.com/…" autocomplete="off"></label><button class="btn chico" type="submit">Buscar</button></form>
        <div id="resPriv" class="sep"></div>` })}

    ${tarjeta({ clase: 'c12', titulo: 'Historial de cargas', cuerpo: cargas.length ? `<div class="tabla-caja desplazable bajo"><table class="tabla"><thead><tr><th>Fecha</th><th>Archivo</th><th class="n">Comentarios</th><th class="n">Positivos</th><th class="n">Negativos</th><th>Subió</th></tr></thead><tbody>
      ${cargas.map(c => `<tr><td class="chica">${fecha(c.creado_en, true)}</td><td>${esc(c.archivo || '')}</td><td class="n">${num(c.total)}</td><td class="n">${num(c.positivos)}</td><td class="n">${num(c.negativos)}</td><td>${esc(c.subido_por || '')}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no se ha subido ningún archivo.') })}

    ${tarjeta({ clase: 'c6 alerta', titulo: 'Empezar de cero con Facebook e Instagram', nota: 'Borra los comentarios de Facebook e Instagram subidos por Excel, para que la conexión con Meta los traiga ordenados. TikTok y X NO se tocan.',
      cuerpo: `${kpis([kpi({ etq: 'FB/IG por Excel (se borrarían)', valor: fbigExcel, tono: 'neg', tam: 'chico' }), kpi({ etq: 'TikTok y X (se conservan)', valor: tkx, tono: 'pos', tam: 'chico' })])}
        <div class="linea sep"><button class="btn chico peligro" id="btnBorrar" ${fbigExcel ? '' : 'disabled'}>Borrar FB/IG subidos por Excel</button><span class="nota">Requiere el respaldo de hace menos de 24 horas.</span></div>` })}
    ${limpieza?.pendiente ? tarjeta({ clase: 'c6 alerta', titulo: 'Quitar los datos manuales antiguos', nota: 'Ahora todo sale de los comentarios: estos datos ya no se usan',
      ayuda: 'Borra la plantilla de métricas (y sus publicaciones, incluidas las reacciones de TikTok y X que venían en ella), la credibilidad manual, los actores y los nombres de chapas. Los comentarios de TikTok y X NO se borran. Antes hay que descargar el respaldo completo: ahí queda todo guardado en Excel.',
      cuerpo: `<div class="tabla-caja mb"><table class="tabla"><thead><tr><th>Qué se borra</th><th class="n">Filas</th></tr></thead><tbody>
        ${limpieza.publicacionesPlantilla ? `<tr><td>Publicaciones de la plantilla de métricas</td><td class="n">${num(limpieza.publicacionesPlantilla)}</td></tr>` : ''}
        ${limpieza.tablas.filter(t => t.filas > 0).map(t => `<tr><td>${esc(t.nombre)}</td><td class="n">${num(t.filas)}</td></tr>`).join('')}
        ${limpieza.tablas.some(t => !t.filas) ? `<tr><td class="nota">${limpieza.tablas.filter(t => !t.filas).length} tablas antiguas vacías</td><td class="n">0</td></tr>` : ''}
        ${limpieza.columnasProyectos.length ? '<tr><td>Aceptación oficial y números manuales de los proyectos</td><td class="n">—</td></tr>' : ''}
      </tbody></table></div>
      <div class="linea"><button class="btn chico peligro" id="btnLimpieza">Quitar datos antiguos</button><span class="nota">Requiere el respaldo completo de hace menos de 24 horas.</span></div>` }) : ''}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarBarras(cont); animarNumeros(cont);

  // Subida de archivos (arrastrar o elegir)
  const zona = cont.querySelector('#zonaSubida'), input = cont.querySelector('#archivos');
  const subir = async (archivos) => {
    if (!archivos.length) return;
    const fd = new FormData();
    for (const a of archivos) fd.append('archivos', a, a.name);
    const pg = cont.querySelector('#paginaCarga'); if (pg) fd.append('paginaId', pg.value);
    const res = cont.querySelector('#resCarga');
    res.innerHTML = `<div class="cargando bloque"></div><div class="nota centro">Procesando ${archivos.length} archivo(s)… puede tardar si la IA está analizando.</div>`;
    try {
      const r = await api('/api/cargar', { metodo: 'POST', form: fd });
      res.innerHTML = `<div class="guia"><b>${num(r.nuevos)} comentarios nuevos.</b></div>
        <div class="tabla-caja"><table class="tabla"><thead><tr><th>Archivo</th><th>Red</th><th class="n">Nuevos</th><th class="n">Repetidos</th><th class="n">Ruido</th><th>Análisis</th></tr></thead><tbody>
        ${r.resultados.map(x => x.ok ? `<tr><td>${esc(x.archivo)}</td><td>${esc(x.red || '')}</td><td class="n">${num(x.nuevos)}</td><td class="n">${num(x.repetidos)}</td><td class="n">${num(x.ruido)}</td>
          <td class="nota">${x.motor === 'IA' ? `IA: ${num(x.analizadosIA)}${x.pausadoPorTope ? ' (pausado por tope)' : ''}` : 'Básico (sin IA)'}</td></tr>`
          : `<tr><td>${esc(x.archivo)}</td><td colspan="5" class="t-neg">⚠ ${esc(x.error)}</td></tr>`).join('')}</tbody></table></div>`;
      aviso(`${num(r.nuevos)} comentarios nuevos.`);
    } catch (e) { res.innerHTML = `<div class="vacio t-neg">⚠ ${esc(e.message)}</div>`; }
    input.value = '';
  };
  input.onchange = () => subir([...input.files]);
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('encima'); subir([...e.dataTransfer.files].filter(f => /\.xlsx?$/i.test(f.name))); });

  // Análisis en lote: estimar el costo y pedir presupuesto antes de empezar
  let alcance = 'reanalisis';
  const estimar = async () => {
    const caja = cont.querySelector('#estimacion');
    caja.innerHTML = 'Calculando costo…';
    try {
      const e = await api('/api/analisis/estimar', { params: { alcance } });
      if (e.enCurso) {
        caja.innerHTML = `<div class="guia">Ya hay un análisis de este tipo en curso: ${num(e.enCurso.aplicados || 0)} de ${num(e.enCurso.total || e.enCurso.enviados || 0)} comentarios aplicados. Cuando termine te avisa por Telegram; no hace falta lanzarlo otra vez.</div>`;
        return;
      }
      if (!e.comentarios) { caja.innerHTML = alcance === 'reanalisis' ? '✓ Todos los comentarios ya tienen el análisis nuevo.' : '✓ No hay comentarios pendientes.'; return; }
      const sugerido = Math.max(1, Math.ceil(e.costoEstimado * 1.1));
      caja.innerHTML = `${kpis([kpi({ etq: 'Comentarios', valor: e.comentarios, tam: 'chico' }), kpi({ etq: 'Costo estimado', valor: '$' + e.costoEstimado.toFixed(2), tam: 'chico', pie: e.conDescuento ? 'con el descuento de lote (50%)' : 'sin descuento' })])}
        <div class="linea abajo sep"><label class="campo">Presupuesto aprobado (US$)<input type="number" id="presupuesto" min="0.5" step="0.5" value="${sugerido}"></label>
          <button class="btn chico primario" id="btnLote">Aprobar y empezar</button></div>
        <div class="nota sep">Se manda solo lo que cabe en el presupuesto; el costo final puede variar unos centavos.</div>`;
      animarNumeros(caja);
      cont.querySelector('#btnLote').onclick = async (ev) => {
        const pres = parseFloat(cont.querySelector('#presupuesto').value);
        if (!(pres > 0)) return aviso('Escribe el presupuesto aprobado.', 'error');
        const b = ev.target; b.disabled = true;
        try { await api('/api/analisis/lote', { metodo: 'POST', cuerpo: { alcance, presupuesto: pres } }); aviso('Análisis en lote enviado. Te avisaremos por Telegram al terminar.'); ctx.recargar(); }
        catch (err) { aviso(err.message, 'error'); b.disabled = false; }
      };
    } catch (err) { caja.innerHTML = `<span class="t-neg">⚠ ${esc(err.message)}</span>`; }
  };
  cont.querySelectorAll('#alcanceLote .f').forEach(b => b.onclick = () => { alcance = b.dataset.a; cont.querySelectorAll('#alcanceLote .f').forEach(x => x.classList.toggle('activo', x === b)); estimar(); });
  estimar();

  const bl = cont.querySelector('#btnLimpieza');
  if (bl) bl.onclick = () => {
    const v = ventana('Quitar datos manuales antiguos', `
      <div class="guia">Se borran para siempre la plantilla de métricas, la credibilidad manual, los actores y los nombres de chapas. <b>Los comentarios (incluidos TikTok y X) no se tocan.</b> Asegúrate de haber guardado el respaldo completo.</div>
      <label class="campo">Escribe BORRAR para confirmar<input type="text" id="conf" autocomplete="off"></label>`,
      { pie: '<button class="btn" data-no>Cancelar</button><button class="btn peligro" data-si>Borrar</button>' });
    v.pie.querySelector('[data-no]').onclick = v.cerrar;
    v.pie.querySelector('[data-si]').onclick = async () => {
      try { const r = await api('/api/datos/limpieza', { metodo: 'POST', cuerpo: { confirmar: v.cuerpo.querySelector('#conf').value.trim() } }); v.cerrar(); aviso(`Listo: ${r.resumen}`); ctx.recargar(); }
      catch (e) { aviso(e.message, 'error'); }
    };
  };

  // Privacidad: buscar a una persona y borrar sus comentarios
  cont.querySelector('#fPriv').onsubmit = async (e) => {
    e.preventDefault();
    const caja = cont.querySelector('#resPriv'), q = cont.querySelector('#qPriv').value.trim();
    if (q.length < 3) return aviso('Escribe al menos 3 letras.', 'error');
    caja.innerHTML = '<div class="cargando bloque"></div>';
    try {
      const lista = await api('/api/datos/privacidad/buscar', { params: { q } });
      caja.innerHTML = lista.length ? `<div class="lista-com">${lista.map((p, i) => `<div class="comentario">
          <div class="meta"><b class="texto">${esc(p.autor || p.username || 'Sin nombre')}</b><span>${esc(p.red)}</span><span>· ${num(p.comentarios)} comentarios</span><span>· ${fecha(p.primero)} a ${fecha(p.ultimo)}</span></div>
          ${(p.ejemplos || []).map(t => `<div class="txt nota">«${esc(String(t).slice(0, 140))}»</div>`).join('')}
          <div class="linea"><button class="btn chico peligro" data-borrar-persona="${i}">Borrar sus comentarios</button></div></div>`).join('')}</div>`
        : vacio('No se encontró a nadie con ese nombre, usuario o enlace.');
      caja.querySelectorAll('[data-borrar-persona]').forEach(b => b.onclick = () => borrarPersona(lista[+b.dataset.borrarPersona], ctx));
    } catch (err) { caja.innerHTML = `<div class="vacio t-neg">⚠ ${esc(err.message)}</div>`; }
  };

  cont.querySelector('#btnPendientes').onclick = async (e) => {
    const b = e.target; b.disabled = true; b.textContent = 'Analizando…';
    try {
      const r = await api('/api/analizar-pendientes', { metodo: 'POST' });
      aviso(r.sinIA ? 'No hay llave de IA configurada (Ajustes → IA).' : r.pausado ? `Se analizaron ${num(r.analizados)}; se pausó por el tope mensual.` : `${num(r.analizados)} comentarios analizados.`, r.sinIA ? 'error' : 'ok');
    } catch (err) { aviso(err.message, 'error'); }
    finally { b.disabled = false; b.textContent = 'Analizar pendientes'; }
  };
  cont.querySelector('#btnMuestra').onclick = () => revisarMuestra(ctx);
  cont.querySelectorAll('[data-exportar]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await descargar(`/api/exportar/${b.dataset.exportar}`, { dias: ctx.dias }); } catch (e) { aviso(e.message, 'error'); }
    finally { b.disabled = false; }
  });
  cont.querySelectorAll('[data-respaldo]').forEach(b => b.onclick = async () => {
    b.disabled = true; const t = b.textContent; b.textContent = 'Preparando…';
    try { await descargar('/api/respaldo', b.dataset.respaldo ? { redes: b.dataset.respaldo } : null); aviso('Respaldo descargado.'); }
    catch (e) { aviso(e.message, 'error'); }
    finally { b.disabled = false; b.textContent = t; }
  });
  cont.querySelector('#btnBorrar').onclick = () => {
    const v = ventana('Borrar comentarios de Facebook e Instagram', `
      <div class="guia">Se borrarán <b>${num(fbigExcel)}</b> comentarios de Facebook e Instagram que se subieron por Excel. Los de TikTok y X (${num(tkx)}) <b>no se tocan</b>.
        Después, la conexión con Meta trae el historial desde enero, ordenado por publicación.</div>
      <label class="campo">Escribe BORRAR para confirmar<input type="text" id="conf" autocomplete="off"></label>`,
      { pie: '<button class="btn" data-no>Cancelar</button><button class="btn peligro" data-si>Borrar</button>' });
    v.pie.querySelector('[data-no]').onclick = v.cerrar;
    v.pie.querySelector('[data-si]').onclick = async () => {
      try { const r = await api('/api/datos/borrar-facebook-instagram', { metodo: 'POST', cuerpo: { confirmar: v.cuerpo.querySelector('#conf').value.trim() } }); v.cerrar(); aviso(`${num(r.borrados)} comentarios borrados.`); ctx.recargar(); }
      catch (e) { aviso(e.message, 'error'); }
    };
  };
}

async function revisarMuestra(ctx) {
  const v = ventana('Revisión de la IA', '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const lista = await api('/api/calidad-ia/muestra');
    if (!lista.length) { v.cuerpo.innerHTML = vacio('No hay comentarios analizados por IA pendientes de revisar.'); return; }
    let hechos = 0, iguales = 0;
    v.cuerpo.innerHTML = `<div class="guia">Lee cada comentario y elige el sentimiento correcto. La etiqueta actual es la que puso la IA. <span id="progreso"></span></div>
      <div class="lista-com">${lista.map(c => `<div class="comentario" data-id="${c.id}">
        <div class="meta">${chipSent(c.sentimiento)}<span>${esc(c.red || '')}</span>${c.emocion ? `<span>· ${esc(c.emocion)}</span>` : ''}${c.tema ? `<span>· ${esc(c.tema)}</span>` : ''}</div>
        <div class="txt">${esc(c.texto)}</div>
        <div class="linea sep">${[['positivo', 'Positivo'], ['neutro', 'Neutro'], ['negativo', 'Negativo']].map(([k, t]) => `<button class="btn chico" data-s="${k}">${t}</button>`).join('')}</div>
      </div>`).join('')}</div>`;
    v.cuerpo.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
      const caja = b.closest('[data-id]');
      try {
        const r = await api('/api/calidad-ia/revisar', { metodo: 'POST', cuerpo: { id: +caja.dataset.id, sentimiento: b.dataset.s } });
        hechos++; if (r.coincidio) iguales++;
        caja.style.opacity = '.5'; caja.querySelectorAll('button').forEach(x => { x.disabled = true; if (x === b) x.classList.add('primario'); });
        v.cuerpo.querySelector('#progreso').innerHTML = `<b>${hechos} de ${lista.length}</b> revisados · la IA acertó ${iguales}.`;
      } catch (e) { aviso(e.message, 'error'); }
    });
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

function borrarPersona(p, ctx) {
  const nombre = p.autor || p.username || p.profile_id;
  const v = ventana('Borrar los datos de una persona', `
    <div class="guia">Se borrarán los <b>${num(p.comentarios)}</b> comentarios de <b>${esc(nombre)}</b> en ${esc(p.red)}, y ya no se volverán a traer de la red social. Esto no se puede deshacer (salvo desde un respaldo anterior).</div>
    <label class="campo">¿Cómo lo pidió? (queda en la auditoría)<input type="text" id="motivo" placeholder="Ej. correo del 12 de noviembre" autocomplete="off"></label>
    <label class="campo">Escribe BORRAR para confirmar<input type="text" id="conf" autocomplete="off"></label>`,
    { pie: '<button class="btn" data-no>Cancelar</button><button class="btn peligro" data-si>Borrar</button>' });
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    try {
      const r = await api('/api/datos/privacidad/borrar', { metodo: 'POST', cuerpo: { red: p.red, profileId: p.profile_id, autor: p.autor, motivo: v.cuerpo.querySelector('#motivo').value.trim(), confirmar: v.cuerpo.querySelector('#conf').value.trim() } });
      v.cerrar(); aviso(`${num(r.borrados)} comentarios borrados. Ya no se volverán a guardar.`); ctx.recargar();
    } catch (e) { aviso(e.message, 'error'); }
  };
}
