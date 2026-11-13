// ─── Proyectos: qué siente la gente de cada proyecto de EMETRA ───
import { api } from '../api.js';
import { esc, num, fecha, tarjeta, listaBarras, animarBarras, animarNumeros, escalonar, vacio, aviso, ventana, confirmar, comentarioHTML, delta, COLOR } from '../ui.js';
import { grafica, chispa, rejillaColor } from '../graficas.js';

const colorAcep = (v) => v == null ? COLOR.neutro : v >= 60 ? COLOR.positivo : v >= 40 ? COLOR.ambar : COLOR.negativo;

export async function montar(cont, ctx) {
  const lista = await api('/api/proyectos', { params: { dias: ctx.dias } });
  const conDatos = lista.filter(p => p.medido.comentarios > 0);
  cont.innerHTML = `
  <div class="guia">Para cada proyecto se buscan sus <b>palabras clave</b> en los comentarios (como palabras completas y sin importar acentos).
    La <b>aceptación medida</b> es el porcentaje de opiniones a favor entre las que están a favor o en contra.
    Con menos de 5 opiniones se indica «pocos datos».</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: 'Proyectos de un vistazo', nota: `${lista.length} proyectos · ${num(lista.reduce((s, p) => s + p.medido.comentarios, 0))} comentarios en el periodo`,
      acciones: ctx.esAdmin ? '<button class="btn chico primario" id="btnNuevo">+ Agregar proyecto</button>' : '',
      ayuda: 'Aceptación = de cada 100 personas que opinan a favor o en contra de un proyecto, cuántas están a favor. Verde es 60% o más, ámbar entre 40% y 60%, rojo menos de 40%.',
      cuerpo: conDatos.length ? `<div style="height:${Math.max(220, lista.length * 46)}px"><canvas id="gComp"></canvas></div>` : vacio('Ningún proyecto tiene comentarios en este periodo.') })}
    ${lista.map((p, i) => tarjetaProyecto(p, i, ctx)).join('')}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont); animarBarras(cont);

  if (conDatos.length) {
    grafica(cont.querySelector('#gComp'), {
      type: 'bar',
      data: { labels: lista.map(p => p.nombre), datasets: [
        { label: 'Aceptación medida en comentarios (%)', data: lista.map(p => p.medido.aceptacion), backgroundColor: lista.map(p => colorAcep(p.medido.aceptacion)), borderRadius: 5, maxBarThickness: 16 },
      ] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x == null ? 'sin dato' : c.parsed.x + '%'}` } } },
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: rejillaColor() } }, y: { grid: { display: false } } } },
    });
  }
  cont.querySelectorAll('[data-detalle]').forEach(b => { b.onclick = () => detalle(+b.dataset.detalle, ctx); b.onkeydown = (e) => { if (e.key === 'Enter') detalle(+b.dataset.detalle, ctx); }; });
  cont.querySelectorAll('[data-editar]').forEach(b => b.onclick = (e) => { e.stopPropagation(); editar(lista.find(p => p.id === +b.dataset.editar), ctx); });
  const nuevo = cont.querySelector('#btnNuevo'); if (nuevo) nuevo.onclick = () => editar(null, ctx);
}

function tarjetaProyecto(p, i, ctx) {
  const m = p.medido;
  const neu = Math.max(0, 100 - m.pctPositivo - m.pctNegativo);
  return `<section class="tarjeta c4 proyecto" data-detalle="${p.id}" role="button" tabindex="0" style="cursor:pointer">
    <div class="cab"><div><h2>${esc(p.nombre)}</h2><div class="nota">${num(m.comentarios)} ${m.comentarios === 1 ? 'comentario' : 'comentarios'}${m.publicaciones.n ? ` · ${num(m.publicaciones.n)} ${m.publicaciones.n === 1 ? 'publicación' : 'publicaciones'}` : ''}</div></div>
      ${ctx.esAdmin ? `<div class="acciones"><button class="btn icono chico" data-editar="${p.id}" aria-label="Editar ${esc(p.nombre)}" title="Editar">✎</button></div>` : ''}</div>
    <div style="display:flex;gap:18px;align-items:flex-start;margin:6px 0 14px">
      <div class="kpi"><span class="etq">Aceptación</span>${m.suficiente
        ? `<span class="valor" style="color:${colorAcep(m.aceptacion)}"><span data-num="${m.aceptacion}">0</span><small>%</small></span>`
        : `<span class="sin-dato">${m.comentarios ? 'Pocos datos' : 'Sin menciones'}</span>`}
        ${m.cambio != null ? `<span class="pie">${delta(m.cambio, { sufijo: ' pts' })} vs periodo anterior</span>` : ''}</div>
      <div style="margin-left:auto">${chispa(m.serie.map(s => s.aceptacion ?? null).filter(v => v !== null), colorAcep(m.aceptacion), 110, 36)}</div>
    </div>
    ${m.comentarios ? `<div class="apilada" style="height:9px"><span style="width:${m.pctPositivo}%;background:${COLOR.positivo}"></span><span style="width:${neu}%;background:${COLOR.neutro}"></span><span style="width:${m.pctNegativo}%;background:${COLOR.negativo}"></span></div>
    <div class="leyenda" style="margin-top:8px"><span><i style="background:${COLOR.positivo}"></i>${m.pctPositivo}% a favor</span><span><i style="background:${COLOR.neutro}"></i>${neu}% neutro</span><span><i style="background:${COLOR.negativo}"></i>${m.pctNegativo}% en contra</span></div>`
      : '<div class="nota">Nadie lo mencionó en este periodo.</div>'}
    ${m.publicaciones.n ? `<div class="nota sep">Reacciones en sus publicaciones: <b style="color:var(--texto)">${num(m.publicaciones.reacciones)}</b></div>` : ''}
  </section>`;
}

async function detalle(id, ctx) {
  const v = ventana('Proyecto', '<div class="cargando bloque"></div>', { ancha: true });
  try {
    const d = await api(`/api/proyectos/${id}/detalle`, { params: { dias: ctx.dias } });
    const m = d.medido;
    v.velo.querySelector('.vcab h3').textContent = d.proyecto.nombre;
    const lista = (items, color) => listaBarras(items.map(x => ({ nom: x.k ?? x.senalado, n: x.n })), { color });
    v.cuerpo.innerHTML = `
      <div class="kpis mb">
        <div class="kpi"><span class="etq">Aceptación medida</span><span class="valor" style="color:${colorAcep(m.aceptacion)}">${m.suficiente ? `${m.aceptacion}<small>%</small>` : '<span style="font-size:18px">Pocos datos</span>'}</span>${m.cambio != null ? `<span class="pie">${delta(m.cambio, { sufijo: ' pts' })}</span>` : ''}</div>
        <div class="kpi"><span class="etq">Comentarios</span><span class="valor">${num(m.comentarios)}</span><span class="pie">${num(m.positivos)} a favor · ${num(m.negativos)} en contra</span></div>
        <div class="kpi"><span class="etq">Publicaciones</span><span class="valor">${num(m.publicaciones.n)}</span><span class="pie">${num(m.publicaciones.reacciones)} reacciones</span></div>
      </div>
      <div class="nota mb">Palabras que se buscan: ${d.proyecto.palabras.map(p => `<span class="chip" style="margin:2px">${esc(p)}</span>`).join('')}</div>
      <div class="rejilla interna">
        ${m.serie.length ? `<div class="c12"><h4 style="margin:0 0 8px">Semana a semana</h4><div class="grafica baja"><canvas id="gProy"></canvas></div></div>` : ''}
        <div class="c4"><h4>Emociones</h4>${lista(d.emociones.slice(0, 6), COLOR.info)}</div>
        <div class="c4"><h4>Lo que reclaman</h4>${lista(d.quejas, COLOR.negativo)}</div>
        <div class="c4"><h4>Lo que piden</h4>${lista(d.peticiones, COLOR.lima)}</div>
        <div class="c4"><h4>¿A quién culpan?</h4>${lista(d.culpables, COLOR.ambar)}</div>
        <div class="c4"><h4>Zonas</h4>${lista(d.zonas, COLOR.pizarra)}</div>
        <div class="c4"><h4>Por red</h4>${lista(d.porRed, COLOR.pizarra)}</div>
        <div class="c6"><h4 class="t-pos">A favor</h4><div class="lista-com desplazable bajo">${d.masPositivos.map(c => comentarioHTML(c)).join('') || vacio()}</div></div>
        <div class="c6"><h4 class="t-neg">En contra</h4><div class="lista-com desplazable bajo">${d.masNegativos.map(c => comentarioHTML(c)).join('') || vacio()}</div></div>
        ${d.publicaciones.length ? `<div class="c12"><h4>Publicaciones sobre el proyecto</h4><div class="tabla-caja"><table class="tabla"><thead><tr><th>Fecha</th><th>Red</th><th>Publicación</th><th class="n">Reacciones</th><th class="n">Comentarios</th><th></th></tr></thead><tbody>
          ${d.publicaciones.map(p => `<tr><td class="nota">${fecha(p.fecha_hora || p.fecha)}</td><td>${esc(p.red || '')}</td><td>${esc((p.texto || '').slice(0, 120))}</td><td class="n">${num(p.likes)}</td><td class="n">${num(p.comentarios)}</td><td>${p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener">Ver ↗</a>` : ''}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
        <div class="c12"><h4>Comentarios recientes</h4><div class="lista-com desplazable">${d.recientes.map(c => comentarioHTML(c)).join('') || vacio()}</div></div>
      </div>`;
    animarBarras(v.cuerpo);
    const g = v.cuerpo.querySelector('#gProy');
    if (g) grafica(g, {
      type: 'bar',
      data: { labels: m.serie.map(s => s.semana.slice(5)), datasets: [
        { type: 'line', label: 'Aceptación %', data: m.serie.map(s => s.aceptacion), borderColor: COLOR.lima, backgroundColor: COLOR.lima, yAxisID: 'y2', tension: .3, cubicInterpolationMode: 'monotone', spanGaps: true, pointRadius: 3, order: 1 },
        { label: 'A favor', data: m.serie.map(s => s.positivos), backgroundColor: COLOR.positivo, stack: 's', order: 2, maxBarThickness: 46 },
        { label: 'En contra', data: m.serie.map(s => s.negativos), backgroundColor: COLOR.negativo, stack: 's', order: 2, maxBarThickness: 46 },
        { label: 'Neutros', data: m.serie.map(s => s.total - s.positivos - s.negativos), backgroundColor: '#3a4a43', stack: 's', order: 2, maxBarThickness: 46 },
      ] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: rejillaColor() }, ticks: { precision: 0 } },
          y2: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } } } },
    });
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio">⚠ ${esc(e.message)}</div>`; }
}

function editar(p, ctx) {
  const v = ventana(p ? `Editar ${p.nombre}` : 'Agregar proyecto', `
    <form class="form" id="fProy" style="grid-template-columns:1fr">
      <label class="campo">Nombre<input type="text" name="nombre" required maxlength="80" value="${esc(p?.nombre || '')}" placeholder="Ej.: Ciclovía"></label>
      <label class="campo">Palabras clave (separadas por coma)<textarea name="keywords" rows="3" placeholder="Ej.: ciclovia, ciclovias, carril para bicicletas">${esc(p?.keywords || '')}</textarea></label>
      <div class="nota" style="margin-top:-6px">Se buscan como palabras completas y sin importar acentos o mayúsculas. El nombre del proyecto también se busca.</div>
    </form>`, { pie: `${p ? '<button class="btn peligro a-izquierda" data-borrar>Quitar</button>' : ''}<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>` });
  const f = v.cuerpo.querySelector('#fProy');
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    if (!f.nombre.value.trim()) return aviso('Falta el nombre.', 'error');
    const cuerpo = { nombre: f.nombre.value.trim(), keywords: f.keywords.value.trim() };
    try {
      await api(p ? `/api/proyectos/${p.id}` : '/api/proyectos', { metodo: p ? 'PATCH' : 'POST', cuerpo });
      v.cerrar(); aviso(p ? 'Proyecto actualizado.' : 'Proyecto agregado.'); ctx.recargar();
    } catch (e) { aviso(e.message, 'error'); }
  };
  const b = v.pie.querySelector('[data-borrar]');
  if (b) b.onclick = async () => {
    if (!await confirmar('Quitar proyecto', `¿Quitar «${esc(p.nombre)}»? Los comentarios no se borran; solo deja de medirse.`, { texto: 'Quitar', peligro: true })) return;
    try { await api(`/api/proyectos/${p.id}`, { metodo: 'DELETE' }); v.cerrar(); aviso('Proyecto quitado.'); ctx.recargar(); } catch (e) { aviso(e.message, 'error'); }
  };
}
