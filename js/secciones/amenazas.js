// ─── Amenazas: cuentas hostiles, red de coordinación, amplificadores y reincidentes ───
import { api } from '../api.js';
import { esc, num, tarjeta, animarNumeros, escalonar, vacio, ventana, COLOR } from '../ui.js';
import { fichaPublicacion } from './comunicacion.js';

const NIVEL = { ALTA: ['neg', 'Alta'], SOSPECHOSA: ['ambar', 'Sospechosa'], BAJA: ['neu', 'Baja'] };
const BANDO = { hostil: ['neg', 'Hostil'], aliado: ['pos', 'Aliado'], neutral: ['neu', 'Neutral'] };
const COLOR_BANDO = { hostil: COLOR.negativo, aliado: COLOR.positivo, neutral: COLOR.neutro };

export async function montar(cont, ctx) {
  const [d, fo] = await Promise.all([api('/api/amenazas', { params: { dias: ctx.dias } }), api('/api/forense', { params: { dias: ctx.dias } })]);
  const r = d.resumen;
  const f = { bando: r.hostiles ? 'hostil' : '', nivel: '', red: '' };
  const redes = [...new Set(d.cuentas.map(c => c.red).filter(Boolean))];
  cont.innerHTML = `
  <div class="guia">Cuentas que comentan de forma repetida y negativa, y señales de coordinación: <b>sincronía</b> (comentan en la misma publicación con minutos de diferencia) y <b>lenguaje calcado</b> (textos casi iguales).
    Es un indicio para revisar, no una prueba. Solo se analizan comentarios con autor identificado.</div>
  <div class="rejilla">
    <section class="tarjeta c12"><div class="kpis">
    ${kpi('Cuentas analizadas', r.totalCuentas, `${num(r.neutrales)} neutrales`)}
    ${kpi('Hostiles', r.hostiles, `${num(r.altaHostilidad)} con hostilidad alta`, COLOR.negativo)}
    ${kpi('Aliadas', r.aliados, 'defienden o agradecen', COLOR.positivo)}
    ${kpi('Señales de coordinación', r.paresSincronia + r.paresLenguaje, `${num(r.paresSincronia)} por sincronía · ${num(r.paresLenguaje)} por texto calcado`, COLOR.ambar)}
    </div></section>

    ${tarjeta({ clase: 'c7', titulo: 'Red de cuentas coordinadas', nota: 'Cada punto es una cuenta; las líneas unen cuentas que comentaron al mismo tiempo o con texto casi igual. Toca un punto.',
      cuerpo: d.red.nodos.length ? `<div id="red" style="height:420px;border-radius:12px;background:var(--fondo-2);border:1px solid var(--borde);overflow:hidden"></div>
        <div class="leyenda" style="margin-top:10px"><span><i style="background:${COLOR.negativo}"></i>Hostil</span><span><i style="background:${COLOR.neutro}"></i>Neutral</span><span><i style="background:${COLOR.positivo}"></i>Aliada</span><span><i style="background:${COLOR.ambar}"></i>Línea gruesa = sincronía</span></div>` : vacio('No se detectó coordinación entre cuentas en este periodo.') })}
    ${tarjeta({ clase: 'c5', titulo: 'Publicaciones más atacadas', nota: 'Donde coinciden varias cuentas hostiles', cuerpo: d.patrones.objetivo.length ? `<div class="lista-barras">${d.patrones.objetivo.map((o, i) => `
      <div class="fila click" data-obj="${i}" role="button" tabindex="0"><span class="nom">${esc(o.post.replace(/^(fb|ig|url):/, ''))}</span><span class="num">${num(o.ataques)} ataques · ${num(o.cuentas)} cuentas</span>
      <div class="pista"><span data-w="${o.ataques / d.patrones.objetivo[0].ataques * 100}" style="background:${COLOR.negativo}"></span></div></div>`).join('')}</div>` : vacio() })}

    ${tarjeta({ clase: 'c12', titulo: 'Cuentas', nota: 'Ordenadas por puntaje de hostilidad (0 a 100)', acciones: `<div class="filtros" id="fBando">${[['hostil', 'Hostiles'], ['', 'Todas'], ['aliado', 'Aliadas'], ['neutral', 'Neutrales']].map(([k, t]) => `<button class="f" data-b="${k}">${t}</button>`).join('')}</div>
        <select id="fNivel" style="width:auto"><option value="">Cualquier nivel</option><option value="ALTA">Alta</option><option value="SOSPECHOSA">Sospechosa</option><option value="BAJA">Baja</option></select>
        ${redes.length > 1 ? `<select id="fRed" style="width:auto"><option value="">Todas las redes</option>${redes.map(x => `<option>${esc(x)}</option>`).join('')}</select>` : ''}`,
      cuerpo: '<div id="tablaCuentas"></div>' })}

    ${tarjeta({ clase: 'c6', titulo: 'Amplificadores', nota: 'Cuentas con muchos seguidores que repiten la crítica', cuerpo: d.amplificadores.length ? tabla(['Cuenta', 'Red', 'Seguidores', 'Negativos', 'Impacto'], d.amplificadores.map(a => [cuenta(a), esc(a.red || ''), num(a.followers), num(a.negativos), `<b>${num(a.impacto)}</b>`])) : vacio('Sin datos de seguidores (llegan en los Excel de X y TikTok).') })}
    ${tarjeta({ clase: 'c6', titulo: 'Reincidentes', nota: 'Personas que comentan varias veces', cuerpo: fo.reincidentes.length ? tabla(['Cuenta', 'Red', 'Veces', 'Negativos', 'Positivos'], fo.reincidentes.slice(0, 20).map(x => [cuenta(x), esc(x.red || ''), num(x.apariciones), `<span class="t-neg">${num(x.negativos)}</span>`, num(x.positivos)])) : vacio() })}
    ${fo.influyentes.length ? tarjeta({ clase: 'c12', titulo: 'Cuentas influyentes en X', nota: 'Las de más seguidores que hablaron del tema', cuerpo: tabla(['Cuenta', 'Seguidores', 'Ubicación', 'Postura', 'Comentario'], fo.influyentes.map(x => [cuenta(x) + (x.verificado ? ' ✔' : ''), num(x.followers), esc(x.ubicacion || '—'), esc(x.sentimiento || ''), `${esc((x.texto || '').slice(0, 120))}${x.permalink ? ` <a href="${esc(x.permalink)}" target="_blank" rel="noopener">↗</a>` : ''}`]), [1]) }) : ''}
  </div>`;
  escalonar(cont.querySelector('.rejilla'));
  animarNumeros(cont);
  cont.querySelectorAll('.pista span[data-w]').forEach(s => s.style.width = s.dataset.w + '%');

  const pintarCuentas = () => {
    cont.querySelectorAll('#fBando .f').forEach(b => b.classList.toggle('activo', b.dataset.b === f.bando));
    const lista = d.cuentas.filter(c => (!f.bando || c.bando === f.bando) && (!f.nivel || c.nivel === f.nivel) && (!f.red || c.red === f.red)).slice(0, 60);
    cont.querySelector('#tablaCuentas').innerHTML = lista.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Cuenta</th><th>Red</th><th>Bando</th><th>Nivel</th><th class="n">Puntaje</th><th class="n">Comentarios</th><th class="n">Negativos</th><th class="n">Publicaciones</th></tr></thead><tbody>
      ${lista.map(c => { const [nc, nt] = NIVEL[c.nivel] || NIVEL.BAJA, [bc, bt] = BANDO[c.bando] || BANDO.neutral; return `<tr data-cuenta="${esc(c.profile_id)}" style="cursor:pointer">
        <td>${cuenta(c)}</td><td>${esc(c.red || '')}</td><td><span class="chip ${bc}">${bt}</span></td><td><span class="chip ${nc}">${nt}</span></td>
        <td class="n" style="min-width:110px"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><div class="pista" style="width:60px;height:6px;background:var(--fondo-2);border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${c.puntaje}%;background:${c.puntaje >= 70 ? COLOR.negativo : c.puntaje >= 40 ? COLOR.ambar : COLOR.neutro}"></span></div><b class="tnum">${c.puntaje}</b></div></td>
        <td class="n">${num(c.comentarios)}</td><td class="n">${num(c.negativos)}</td><td class="n">${num(c.posts)}</td></tr>`; }).join('')}</tbody></table></div>` : vacio('Ninguna cuenta con este filtro.');
    cont.querySelectorAll('#tablaCuentas tr[data-cuenta]').forEach(tr => tr.onclick = () => verCuenta(d.cuentas.find(c => c.profile_id === tr.dataset.cuenta)));
  };
  cont.querySelectorAll('#fBando .f').forEach(b => b.onclick = () => { f.bando = b.dataset.b; pintarCuentas(); });
  cont.querySelector('#fNivel').onchange = (e) => { f.nivel = e.target.value; pintarCuentas(); };
  const fr = cont.querySelector('#fRed'); if (fr) fr.onchange = (e) => { f.red = e.target.value; pintarCuentas(); };
  pintarCuentas();

  cont.querySelectorAll('[data-obj]').forEach(el => el.onclick = () => {
    const o = d.patrones.objetivo[+el.dataset.obj];
    if (/^(fb|ig|url):/.test(o.post)) fichaPublicacion(o.post, ctx); else if (o.enlace) window.open(o.enlace, '_blank', 'noopener');
  });
  if (d.red.nodos.length) dibujarRed(cont.querySelector('#red'), d.red, (id) => verCuenta(d.cuentas.find(c => c.profile_id === id)));
}

function verCuenta(c) {
  if (!c) return;
  const e = c.evidencia || {};
  const barra = (t, v, max, nota) => `<div class="mb"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${t}</span><b>${v} / ${max}</b></div>
    <div style="height:6px;background:var(--fondo-2);border-radius:4px;margin-top:4px;overflow:hidden"><span style="display:block;height:100%;width:${v / max * 100}%;background:${COLOR.ambar}"></span></div>${nota ? `<div class="nota">${nota}</div>` : ''}</div>`;
  ventana(c.autor || c.username || 'Cuenta', `
    <div class="kpis mb">
      <div class="kpi"><span class="etq">Puntaje</span><span class="valor" style="color:${c.puntaje >= 70 ? COLOR.negativo : c.puntaje >= 40 ? COLOR.ambar : COLOR.neutro}">${c.puntaje}</span></div>
      <div class="kpi"><span class="etq">Comentarios</span><span class="valor">${num(c.comentarios)}</span><span class="pie">${num(c.negativos)} negativos</span></div>
      <div class="kpi"><span class="etq">Publicaciones</span><span class="valor">${num(c.posts)}</span></div>
      ${c.followers != null ? `<div class="kpi"><span class="etq">Seguidores</span><span class="valor">${num(c.followers)}</span></div>` : ''}
    </div>
    <h4>Por qué tiene ese puntaje</h4>
    ${barra('Volumen de quejas', e.volumen || 0, 30)}
    ${barra('Reincidencia (varias publicaciones)', e.reincidencia || 0, 20)}
    ${barra('Sincronía con otras cuentas', e.sincronia || 0, 20, e.sincronizaciones ? `${e.sincronizaciones} veces comentó junto a otra cuenta hostil` : '')}
    ${barra('Lenguaje calcado', e.lenguaje || 0, 20, e.similitudMax ? `Hasta ${e.similitudMax}% igual al texto de otra cuenta` : '')}
    ${barra('Perfil', e.perfil || 0, 10)}
    ${c.enlace ? `<a class="btn chico" href="${esc(c.enlace)}" target="_blank" rel="noopener" style="margin-top:8px">Ver un comentario de esta cuenta ↗</a>` : ''}`);
}

// Red simple con un acomodo por fuerzas (sin librerías)
function dibujarRed(el, red, alClic) {
  const W = el.clientWidth || 700, H = el.clientHeight || 420;
  const nodos = red.nodos.map((n, i) => ({ ...n, x: W / 2 + Math.cos(i) * W / 3 * Math.random(), y: H / 2 + Math.sin(i) * H / 3 * Math.random(), vx: 0, vy: 0 }));
  const idx = new Map(nodos.map((n, i) => [n.id, i]));
  const aristas = red.aristas.map(a => ({ ...a, s: idx.get(a.a), t: idx.get(a.b) })).filter(a => a.s != null && a.t != null);
  for (let it = 0; it < 320; it++) {
    for (let i = 0; i < nodos.length; i++) for (let j = i + 1; j < nodos.length; j++) {
      const a = nodos[i], b = nodos[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy || 1; const f = 1800 / d2;
      const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const e of aristas) {
      const a = nodos[e.s], b = nodos[e.t]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; const f = (d - 70) * 0.02;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const n of nodos) { n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004; n.x += n.vx * 0.5; n.y += n.vy * 0.5; n.vx *= 0.6; n.vy *= 0.6; n.x = Math.max(18, Math.min(W - 18, n.x)); n.y = Math.max(18, Math.min(H - 18, n.y)); }
  }
  const radio = (n) => 5 + Math.min(12, n.puntaje / 9);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="Red de cuentas coordinadas">
    ${aristas.map(e => { const a = nodos[e.s], b = nodos[e.t]; return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${e.sincronia ? COLOR.ambar : '#4b5d55'}" stroke-opacity="${e.sincronia ? .75 : .5}" stroke-width="${e.sincronia ? Math.min(5, 1 + e.sincronia) : 1}"/>`; }).join('')}
    ${nodos.map(n => `<g data-n="${esc(n.id)}" style="cursor:pointer"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${radio(n)}" fill="${COLOR_BANDO[n.bando] || COLOR.neutro}" fill-opacity=".85" style="stroke:var(--panel)" stroke-width="2"><title>${esc(n.autor || n.username || '')} · puntaje ${n.puntaje}</title></circle>
      ${n.puntaje >= 60 ? `<text x="${(n.x + radio(n) + 4).toFixed(1)}" y="${(n.y + 4).toFixed(1)}" font-size="10.5" fill="#c4d0c9">${esc((n.autor || n.username || '').slice(0, 18))}</text>` : ''}</g>`).join('')}
  </svg>`;
  el.querySelectorAll('[data-n]').forEach(g => g.onclick = () => alClic(g.dataset.n));
}

const cuenta = (c) => `<b>${esc(c.autor || c.username || '—')}</b>${c.username && c.username !== c.autor ? ` <span class="nota">@${esc(c.username)}</span>` : ''}`;
function tabla(cab, filas, der = [2, 3, 4]) {
  const al = (i) => der.includes(i) ? 'class="tnum" style="text-align:right"' : '';
  return `<div class="tabla-caja desplazable"><table class="tabla"><thead><tr>${cab.map((c, i) => `<th ${der.includes(i) ? 'class="n"' : ''}>${c}</th>`).join('')}</tr></thead><tbody>
    ${filas.map(f => `<tr>${f.map((v, i) => `<td ${al(i)}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function kpi(t, v, pie, color) {
  return `<div class="kpi"><span class="etq">${t}</span><span class="valor" ${color ? `style="color:${color}"` : ''}><span data-num="${v}">0</span></span><span class="pie">${pie}</span></div>`;
}
