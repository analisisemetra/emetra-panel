// ─── Inicio: cuatro preguntas que se responden de un vistazo (pensado para el celular) ───
// Cada tarjeta es una pregunta y lleva a la sección con el detalle. El jefe de zona ve su
// zona primero; el administrador ve además el estado del sistema y el resumen con IA.
import { api } from '../api.js';
import { esc, num, haceCuanto, tarjeta, barraSentimiento, delta, animarBarras, animarNumeros, escalonar, vacio, aviso, rotulo, COLOR } from '../ui.js';

const nombrePeriodo = (ctx) => ctx.rango ? `del ${ctx.rango.desde} al ${ctx.rango.hasta}` : ctx.dias == null ? 'todo el histórico' : ctx.dias === 1 ? 'las últimas 24 horas' : `los últimos ${ctx.dias} días`;
const NIVEL = { alto: ['Riesgo alto', 'neg'], medio: ['Riesgo medio', 'ambar'], bajo: ['Riesgo bajo', 'pos'] };

// Tarjeta-pregunta: toda la tarjeta lleva al detalle; el "?" explica qué significa
function pregunta({ q, ir, clase = '', ayuda, cuerpo }) {
  return `<section class="tarjeta pregunta ${clase}" data-ir="${ir}" role="link" tabindex="0">
    <div class="q"><span>${q}</span><span class="linea"><span class="nota">Ver ›</span>${ayuda ? `<button class="ayuda" type="button" aria-label="¿Qué significa?" aria-expanded="false">?</button>` : ''}</span></div>
    ${ayuda ? `<div class="ayuda-txt oculto">${ayuda}</div>` : ''}${cuerpo}</section>`;
}

export async function montar(cont, ctx) {
  const P = ctx.dias ? { dias: ctx.dias } : {};
  const [ini, res] = await Promise.allSettled([
    api('/api/inicio', { params: P }),
    ctx.esAdmin ? api('/api/resumen-ejecutivo') : Promise.resolve(null),
  ]);
  if (ini.status !== 'fulfilled') throw new Error(ini.reason?.message || 'No se pudo cargar el inicio.');
  const d = ini.value, re = res.status === 'fulfilled' ? res.value : null;
  const o = d.opinion, periodo = nombrePeriodo(ctx);
  const [nivelTxt, nivelColor] = NIVEL[o.riesgo.nivel] || NIVEL.bajo;

  // ¿Cómo nos ven?
  const opinion = pregunta({ q: '¿Cómo nos ven?', ir: '#ciudadania', clase: 'c6',
    ayuda: `De cada 100 comentarios ${periodo}, cuántos están en contra. "Contra EMETRA" separa a quien culpa a la institución de quien solo se queja del problema (el tráfico, un bache). El riesgo mide las últimas 24 horas.`,
    cuerpo: o.comentarios ? `
      <div class="linea"><div class="grande t-neg"><span data-num="${o.negativo}">0</span><small>% en contra</small></div>${delta(o.cambioNegativo, { menosEsMejor: true, sufijo: ' pts' })}</div>
      ${barraSentimiento(o.positivo, o.negativo, o.neutro)}
      <div class="frase">${num(o.comentarios)} comentarios · ${o.positivo}% a favor · ${o.neutro}% neutral${o.contraEmetra != null ? `<br>De las quejas, <b>${o.contraEmetra}%</b> culpa a EMETRA; el resto se queja del problema.` : ''}</div>
      <div><span class="chip ${nivelColor}">${nivelTxt} hoy · ${o.riesgo.puntaje}/100</span></div>`
      : `<div class="frase">No hay comentarios en ${periodo}. Elige un periodo más largo arriba.</div>` });

  // ¿Qué está quemando?
  const q = d.quema;
  const urgente = q.tipo !== 'calma';
  const quema = pregunta({ q: '¿Qué está quemando?', ir: q.tipo === 'crisis' ? '#medios?v=crisis' : q.tipo === 'publicacion' ? '#comunicacion' : '#ciudadania', clase: 'c6' + (urgente ? ' quema' : ''),
    ayuda: 'Lo más urgente de ahora: primero una alerta de crisis sin leer (48 horas), si no hay, la publicación con más comentarios en contra en 24 horas, y si no, la queja que más creció hoy.',
    cuerpo: `<div class="dato">${esc(q.titulo)}</div><div class="frase">${esc(q.detalle)}${q.cuando ? ` · ${haceCuanto(q.cuando)}` : ''}</div>` });

  // ¿Dónde se quejan?
  const w = d.donde;
  const donde = pregunta({ q: '¿Dónde se quejan?', ir: '#territorio', clase: 'c6',
    ayuda: `La zona con más comentarios en contra ${periodo}, según el lugar que la gente menciona. Toca para ver el mapa.`,
    cuerpo: w ? `<div class="grande">${esc(w.zona)}<small>${num(w.quejas)} quejas</small></div>
      <div class="frase">${w.queReclaman.length ? `Reclaman: <b>${w.queReclaman.map(esc).join(', ')}</b>` : ''}${w.colonias.length ? `<br>Sobre todo en ${w.colonias.map(esc).join(' y ')}` : ''}
      ${w.siguientes.length ? `<br>Le siguen ${w.siguientes.map(z => `${esc(z.zona)} (${num(z.n)})`).join(' y ')}` : ''}</div>`
      : '<div class="frase">Nadie mencionó una zona en las quejas de este periodo.</div>' });

  // ¿Qué dicen los medios?
  const m = d.medios;
  const medios = pregunta({ q: '¿Qué dicen los medios?', ir: '#medios', clase: 'c6',
    ayuda: `Notas de prensa ${periodo}. "En contra" son notas críticas con EMETRA. El tema es la categoría que más titulares ocupó.`,
    cuerpo: m.notas ? `<div class="grande"><span data-num="${m.notas}">0</span><small>notas</small></div>
      <div class="frase"><b class="t-neg">${num(m.contra)}</b> en contra · <b class="t-pos">${num(m.favor)}</b> a favor o propias
      ${m.categoria ? `<br>Tema que domina: <b>${esc(m.categoria.nombre)}</b> (${m.categoria.pct}% de los titulares)` : ''}
      ${m.historia ? `<br>Más cubierta: “${esc(m.historia.titulo)}” · ${m.historia.medios} medios` : ''}</div>`
      : `<div class="frase">Sin notas de prensa en ${periodo}.</div>` });

  // ¿Qué proyecto preocupa?
  const pr = d.proyectos;
  const proyectos = pr ? pregunta({ q: '¿Cómo van los proyectos?', ir: '#proyectos', clase: 'c12',
    ayuda: 'Aceptación medida en los comentarios que hablan de cada proyecto (a favor contra en contra). Solo cuentan los proyectos con suficientes comentarios.',
    cuerpo: `<div class="rejilla interna">
      <div class="c6"><div class="nota">Preocupa más</div><div class="dato">${esc(pr.peor.nombre)}</div><div class="frase"><b class="${pr.peor.aceptacion < 50 ? 't-neg' : 't-ambar'}">${pr.peor.aceptacion}%</b> de aceptación · ${num(pr.peor.comentarios)} comentarios</div></div>
      ${pr.mejor.nombre !== pr.peor.nombre ? `<div class="c6"><div class="nota">Va mejor</div><div class="dato">${esc(pr.mejor.nombre)}</div><div class="frase"><b class="t-pos">${pr.mejor.aceptacion}%</b> de aceptación</div></div>` : ''}
    </div>` }) : '';

  // Jefe de zona: lo suyo primero
  const z = d.miZona;
  const miZona = z ? pregunta({ q: `¿Cómo está mi zona? · ${z.zonas.map(esc).join(', ') || 'sin zona asignada'}`, ir: '#territorio?v=denuncias', clase: 'c12' + (z.pendientes ? ' quema' : ''),
    ayuda: 'Denuncias de tus zonas que todavía no se marcan como atendidas, y las quejas de la gente en tus zonas en el periodo elegido.',
    cuerpo: `<div class="kpis">
      <div><div class="grande ${z.pendientes ? 't-ambar' : 't-pos'}" data-num="${z.pendientes}">0</div><div class="nota">denuncias pendientes</div></div>
      <div><div class="grande" data-num="${z.atendidasSemana}">0</div><div class="nota">atendidas esta semana</div></div>
      <div><div class="grande" data-num="${z.quejas}">0</div><div class="nota">quejas en el periodo</div></div></div>
      ${z.queReclaman.length ? `<div class="frase">Lo que más reclaman: <b>${z.queReclaman.map(esc).join(', ')}</b></div>` : ''}` }) : '';

  // Administrador: estado del sistema y resumen con IA
  const s = d.sistema;
  const sistema = s ? tarjeta({ clase: 'c5', titulo: 'Estado del sistema', nota: 'Solo administradores', acciones: '<a class="btn chico" href="#datos">Datos</a>',
    ayuda: 'Gasto de IA del mes contra el tope, comentarios que esperan análisis, lugares que hay que confirmar en el mapa y páginas de Facebook o Instagram con error de conexión.',
    cuerpo: `<div class="lista-barras">
      <div class="fila"><span class="nom">Gasto de IA del mes</span><span class="num">$${s.gasto} de $${s.tope}</span><div class="pista"><span data-w="${Math.min(100, s.pctGasto)}" style="background:${s.pctGasto >= 80 ? COLOR.negativo : s.pctGasto >= 50 ? COLOR.ambar : COLOR.positivo}"></span></div></div></div>
      <div class="pila junta sep">
        <div>${s.pendientesIA ? `<span class="chip ambar">${num(s.pendientesIA)}</span> comentarios esperan análisis` : '✓ Todos los comentarios analizados'}</div>
        <div>${s.lugaresPorConfirmar ? `<a href="#territorio?v=lugares"><span class="chip ambar">${num(s.lugaresPorConfirmar)}</span> lugares por confirmar en el mapa</a>` : '✓ Sin lugares por confirmar'}</div>
        <div>${s.paginasConError.length ? `<a href="#ajustes?v=meta" class="t-neg">⚠ Páginas con error: ${s.paginasConError.map(esc).join(', ')}</a>` : '✓ Páginas conectadas sin errores'}</div>
        ${s.trabajos ? `<div><span class="chip info">${s.trabajos}</span> trabajos corriendo</div>` : ''}
      </div>` }) : '';
  const resumen = ctx.esAdmin ? tarjeta({ clase: s ? 'c7' : 'c12', id: 'tarjetaResumenIA', titulo: 'Resumen ejecutivo',
    nota: re?.generado_en ? `Generado ${haceCuanto(re.generado_en)}${re.dias ? ` · ${re.dias} días` : ''}` : 'Lo redacta la IA con los datos; no incluye recomendaciones',
    acciones: '<button class="btn chico primario" id="btnResumen">Generar con IA</button>',
    ayuda: 'Un párrafo que resume el periodo para leer en un minuto. Se genera cuando lo pides (usa un poco del presupuesto de IA).',
    cuerpo: `<div id="cuerpoResumen">${resumenHTML(re)}</div>` }) : '';

  cont.insertAdjacentHTML('beforeend', `<div class="rejilla">${miZona}${opinion}${quema}${donde}${medios}${proyectos}${sistema}${resumen}</div>`);
  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont); animarBarras(cont);

  // Navegar al tocar una pregunta (el "?" no navega)
  cont.querySelectorAll('.pregunta').forEach(t => {
    const ir = (e) => { if (e.target.closest('.ayuda, a')) return; ctx.ir(t.dataset.ir.replace('#', '')); };
    t.addEventListener('click', ir);
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(e); });
  });
  const btn = cont.querySelector('#btnResumen');
  if (btn) btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Redactando…';
    try {
      const nuevo = await api('/api/resumen-ejecutivo', { metodo: 'POST', params: { dias: ctx.dias || 30 } });
      if (nuevo.vacio) aviso(nuevo.mensaje, 'error');
      cont.querySelector('#cuerpoResumen').innerHTML = resumenHTML(nuevo);
    } catch (e) { aviso(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Generar con IA'; }
  };
}

function resumenHTML(re) {
  if (re?.restringido) return vacio('El resumen ejecutivo solo está disponible para usuarios con acceso a todas las entidades.');
  if (!re || re.vacio) return vacio(re?.mensaje || 'Todavía no se ha generado un resumen.');
  const color = re.nivel_riesgo === 'alto' ? 'neg' : re.nivel_riesgo === 'medio' ? 'ambar' : 'pos';
  return `<div class="pila">
    <div class="dato titular">${esc(re.titular)}</div>
    <p class="texto-2">${esc(re.panorama)}</p>
    <div class="rejilla interna">
      <div class="c6">${rotulo('Preocupa', 'neg')}${(re.preocupaciones || []).map(x => `<div class="mb">• ${esc(x)}</div>`).join('')}</div>
      <div class="c6">${rotulo('Funciona', 'pos')}${(re.positivo || []).map(x => `<div class="mb">• ${esc(x)}</div>`).join('')}</div>
    </div>
    <div><span class="chip ${color}">Riesgo ${esc(re.nivel_riesgo || '—')}</span></div></div>`;
}
