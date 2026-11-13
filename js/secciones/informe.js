// ─── Informe (solo administradores): reporte de datos listo para imprimir o guardar en PDF ───
// Solo datos, sin recomendaciones.
import { api, paginaActual } from '../api.js';
import { esc, num, fecha } from '../ui.js';

const flecha = (d, menosEsMejor = false, suf = '') => {
  if (d == null || d === 0) return '<span class="nota">=</span>';
  const malo = menosEsMejor ? d > 0 : d < 0;
  return `<span style="color:${malo ? '#c62f3c' : '#1f8a68'};font-weight:700">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d), Math.abs(d) < 10 && d % 1 ? 1 : 0)}${suf}</span>`;
};

export async function montar(cont, ctx) {
  // Con fechas «desde–hasta» elegidas arriba, el servidor usa ese rango (la API lo manda sola)
  const dias = ctx.rango ? Math.round((new Date(ctx.rango.hasta) - new Date(ctx.rango.desde)) / 864e5) + 1 : (ctx.dias || 7);
  const [inf, proy, act, paginas, cred] = await Promise.all([
    api('/api/informe', { params: { dias } }), api('/api/proyectos', { params: { dias } }), api('/api/actividad', { params: { dias } }), api('/api/paginas').catch(() => []),
    api('/api/credibilidad', { params: { dias } }).catch(() => []),
  ]);
  const pg = paginaActual();
  const nombrePagina = pg === 'todas' ? 'Todas las páginas' : (paginas.find(p => String(p.id) === pg) || paginas.find(p => p.principal))?.nombre || 'EMETRA';
  const p = inf.panorama, c = inf.comparativo, d = c?.delta || {};
  const conAnterior = c && c.anterior.comentarios > 0;
  const denP = inf.denuncias.find(x => x.estado === 'pendiente')?.n || 0, denA = inf.denuncias.find(x => x.estado === 'atendida')?.n || 0;
  const hasta = ctx.rango ? new Date(ctx.rango.hasta + 'T12:00:00') : new Date(inf.generado);
  const desde = ctx.rango ? new Date(ctx.rango.desde + 'T12:00:00') : new Date(hasta.getTime() - dias * 864e5);

  cont.innerHTML = `
  <div class="no-imprimir" style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap">
    <div class="nota">Informe ${ctx.rango ? `del <b>${fecha(desde)} al ${fecha(hasta)}</b>` : `de los últimos <b>${dias} días</b>`} (cámbialo con el periodo de arriba). Para guardarlo en PDF, usa «Imprimir» y elige «Guardar como PDF».</div>
    <button class="btn primario" id="btnImprimir">Imprimir / Guardar PDF</button>
  </div>
  <article class="informe">
    <header class="inf-cab">
      <div><img src="img/emetra-logo.svg" alt="EMETRA" style="height:34px"><div class="inf-sub">Analítica · Informe de opinión pública</div></div>
      <div style="text-align:right"><b>${esc(nombrePagina)}</b><br>${fecha(desde)} al ${fecha(hasta)}<br><span class="nota">Generado ${fecha(inf.generado, true)}</span></div>
    </header>

    <h3>1. Panorama</h3>
    <table class="inf-tabla"><thead><tr><th>Indicador</th><th>Periodo</th>${conAnterior ? '<th>Cambio vs periodo anterior</th>' : ''}</tr></thead><tbody>
      <tr><td>Comentarios analizados</td><td><b>${num(p.totalComentarios)}</b></td>${conAnterior ? `<td>${flecha(d.comentarios)}</td>` : ''}</tr>
      <tr><td>Negativos</td><td><b>${p.sentimiento.negativo}%</b></td>${conAnterior ? `<td>${flecha(d.negativo, true, ' pts')}</td>` : ''}</tr>
      <tr><td>Positivos</td><td><b>${p.sentimiento.positivo}%</b></td>${conAnterior ? `<td>${flecha(d.positivo, false, ' pts')}</td>` : ''}</tr>
      <tr><td>Neutros</td><td>${p.sentimiento.neutro}%</td>${conAnterior ? '<td></td>' : ''}</tr>
      <tr><td>Nivel de enojo (1 a 5)</td><td>${c?.actual.enojo ?? '—'}</td>${conAnterior ? `<td>${flecha(d.enojo, true)}</td>` : ''}</tr>
      <tr><td>Reacciones en publicaciones</td><td>${num(act.totales.reacciones)} en ${num(act.totales.publicaciones)} publicaciones</td>${conAnterior ? '<td></td>' : ''}</tr>
      <tr><td>Denuncias</td><td>${num(p.denuncias)} (${num(denP)} pendientes · ${num(denA)} atendidas)</td>${conAnterior ? `<td>${flecha(d.denuncias, true)}</td>` : ''}</tr>
      <tr><td>Notas en medios</td><td>${num(inf.medios.total.total)} (${num(inf.medios.total.contra)} en contra)</td>${conAnterior ? `<td>${flecha(d.noticias)}</td>` : ''}</tr>
    </tbody></table>

    <div class="inf-dos">
      <section><h3>2. Lo que más duele</h3>${listaSimple(inf.dolores.map(x => [x.dolor, x.n]))}</section>
      <section><h3>3. ¿A quién culpan?</h3>${listaSimple(inf.ciudadania.culpables.slice(0, 8).map(x => [x.senalado, x.n]))}</section>
      <section><h3>4. Zonas con más quejas</h3>${listaSimple(inf.zonas.filter(z => z.negativos > 0).map(z => [z.zona, z.negativos]))}</section>
      <section><h3>5. Temas que crecen</h3>${listaSimple((inf.emergentes.temas || []).filter(t => t.cambio > 0).slice(0, 8).map(t => [t.tema, `${t.actual} (${t.nuevo ? 'nuevo' : '+' + t.cambio})`]))}</section>
    </div>

    <h3>6. Proyectos</h3>
    <table class="inf-tabla"><thead><tr><th>Proyecto</th><th>Comentarios</th><th>A favor</th><th>En contra</th><th>Aceptación</th></tr></thead><tbody>
      ${proy.map(x => `<tr><td>${esc(x.nombre)}</td><td>${num(x.medido.comentarios)}</td><td>${x.medido.pctPositivo}%</td><td>${x.medido.pctNegativo}%</td><td><b>${x.medido.suficiente ? x.medido.aceptacion + '%' : (x.medido.comentarios ? 'pocos datos' : 'sin menciones')}</b></td></tr>`).join('')}
    </tbody></table>
    <p class="nota">Aceptación medida en los comentarios: de cada 100 opiniones a favor o en contra, cuántas son a favor.</p>

    <h3>7. Credibilidad (calculada)</h3>
    ${cred.length ? `<table class="inf-tabla"><thead><tr><th>Personaje</th><th>Puntaje</th><th>Respuesta</th><th>Transparencia</th><th>Consistencia</th><th>Medios</th></tr></thead><tbody>
      ${cred.map(e => { const v = (x) => x?.aplica === false ? 'no aplica' : x?.valor == null ? '—' : x.valor; return `<tr><td>${esc(e.nombre)}</td><td><b>${e.puntaje ?? 'pocos datos'}</b></td><td>${v(e.partes.respuesta)}</td><td>${v(e.partes.transparencia)}</td><td>${v(e.partes.consistencia)}</td><td>${v(e.partes.medios)}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="nota">Sin personajes configurados.</p>'}

    <div class="inf-dos">
      <section><h3>8. Medios</h3>${inf.medios.ranking.length ? `<table class="inf-tabla"><thead><tr><th>Medio</th><th>Notas</th><th>A favor</th><th>En contra</th></tr></thead><tbody>${inf.medios.ranking.map(m => `<tr><td>${esc(m.medio)}</td><td>${num(m.total)}</td><td>${m.pctFavor + m.pctInformativo}%</td><td>${m.pctContra}%</td></tr>`).join('')}</tbody></table>` : '<p class="nota">Sin notas en el periodo.</p>'}</section>
      <section><h3>9. Cuentas hostiles</h3>
        <p>${num(inf.amenazas.totalCuentas)} cuentas analizadas: <b>${num(inf.amenazas.hostiles)}</b> hostiles (${num(inf.amenazas.altaHostilidad)} con hostilidad alta), ${num(inf.amenazas.aliados)} aliadas.
        Señales de coordinación: ${num(inf.amenazas.paresSincronia)} por sincronía y ${num(inf.amenazas.paresLenguaje)} por texto calcado.</p></section>
    </div>

    <h3>10. Alertas de crisis</h3>
    ${inf.crisis.length ? `<table class="inf-tabla"><thead><tr><th>Fecha</th><th>Severidad</th><th>Alerta</th></tr></thead><tbody>${inf.crisis.map(x => `<tr><td>${fecha(x.creado_en, true)}</td><td>${esc(x.severidad)}</td><td><b>${esc(x.titulo)}</b><br><span class="nota">${esc(x.explicacion || '')}</span></td></tr>`).join('')}</tbody></table>` : '<p class="nota">Sin alertas de crisis en el periodo.</p>'}

    <h3>11. Bitácora de hechos</h3>
    ${inf.bitacora.length ? `<table class="inf-tabla"><thead><tr><th>Fecha</th><th>Tipo</th><th>Hecho</th><th>Zona</th></tr></thead><tbody>${inf.bitacora.map(b => `<tr><td>${fecha(b.fecha)}</td><td>${esc(b.tipo)}</td><td>${esc(b.titulo)}</td><td>${esc(b.zona || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="nota">Sin hechos registrados en el periodo.</p>'}

    <footer class="inf-pie">Documento de uso exclusivamente institucional. Contiene datos de opinión pública recopilados de redes sociales y medios; no incluye recomendaciones.</footer>
  </article>`;
  cont.querySelector('#btnImprimir').onclick = () => window.print();
}

function listaSimple(filas) {
  if (!filas.length) return '<p class="nota">Sin datos.</p>';
  return `<table class="inf-tabla">${filas.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="n" style="width:90px"><b>${typeof b === 'number' ? num(b) : esc(b)}</b></td></tr>`).join('')}</table>`;
}
