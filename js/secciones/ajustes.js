// ─── Ajustes (solo administradores): usuarios, APIs e IA, páginas de Meta, Telegram, noticias, personajes, auditoría ───
import { api } from '../api.js';
import { esc, num, fecha, haceCuanto, tarjeta, vacio, aviso, ventana, confirmar, COLOR, pestanas, marcarPestana, rotulo } from '../ui.js';

const ZONAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 25].map(n => 'Zona ' + n);
const ROLES = { admin: 'Administrador', jefe_zona: 'Jefe de zona', lectura: 'Lectura (solo ver)' };
const ESTADO_PAG = { conectado: ['pos', 'Conectada'], error: ['neg', 'Error de conexión'], desconectado: ['neu', 'Desconectada'], sin_conectar: ['ambar', 'Sin conectar'] };

export async function montar(cont, ctx) {
  const PEST = [['usuarios', 'Usuarios'], ['apis', 'APIs e IA'], ['meta', 'Facebook e Instagram'], ['telegram', 'Telegram'], ['avisos', 'Avisos urgentes'], ['noticias', 'Noticias'], ['personajes', 'Personajes'], ['auditoria', 'Auditoría']];
  const p = ctx.parametros;
  let actual = p.meta ? 'meta' : (PEST.some(x => x[0] === p.v) ? p.v : 'usuarios');
  cont.innerHTML = `${pestanas(PEST, actual)}<div id="vista"></div>`;
  const vista = cont.querySelector('#vista');
  const abrir = async (k) => {
    actual = k;
    marcarPestana(cont.querySelector('#pestanas'), k);
    history.replaceState(null, '', `#ajustes?v=${k}`);
    vista.innerHTML = '<div class="tarjeta cargando"></div>';
    const re = () => abrir(k);
    try { await VISTAS[k](vista, { ...ctx, re }); }
    catch (e) { if (e.estado !== 401 && e.estado !== 451) vista.innerHTML = `<div class="tarjeta"><div class="vacio t-neg">⚠ ${esc(e.message)}</div></div>`; }
  };
  cont.querySelectorAll('#pestanas .f').forEach(b => b.onclick = () => abrir(b.dataset.p));
  // Regreso desde Facebook después de conectar
  if (p.meta === 'ok') aviso(p.msg || 'Conectado con Facebook.');
  else if (p.meta === 'error') aviso(p.msg || 'No se pudo conectar con Facebook.', 'error');
  else if (p.meta === 'elegir') aviso('Elige qué páginas quieres analizar.');
  await abrir(actual);
}

const VISTAS = { usuarios: vUsuarios, apis: vApis, meta: vMeta, telegram: vTelegram, avisos: vAvisos, noticias: vNoticias, personajes: vPersonajes, auditoria: vAuditoria };

// ═════════ USUARIOS ═════════
async function vUsuarios(el, ctx) {
  const [usuarios, ents, pags] = await Promise.all([api('/api/usuarios'), api('/api/entidades'), api('/api/paginas')]);
  const nomEnt = (ids) => ids == null ? 'Todos' : ents.filter(e => ids.includes(e.id)).map(e => e.nombre).join(', ') || 'Ninguno';
  const principal = pags.find(x => x.principal);
  const nomPag = (u) => u.rol === 'admin' ? 'Todas' : (u.paginasVisibles?.length ? pags.filter(x => u.paginasVisibles.includes(x.id)).map(x => x.nombre).join(', ') : (principal?.nombre || 'Principal'));
  el.innerHTML = `<div class="guia">El <b>administrador</b> puede todo. El <b>jefe de zona</b> ve todo y marca como atendidas las denuncias de su zona. <b>Lectura</b> solo ve en pantalla (sin descargas).
    Los <b>personajes visibles</b> controlan qué figuras ve cada usuario (por ejemplo, oficiales solo EMETRA y PMT). Las <b>páginas</b> controlan qué páginas de redes puede ver.</div>
  ${tarjeta({ titulo: 'Usuarios', nota: `${usuarios.length} usuarios`, acciones: '<button class="btn chico primario" id="btnNuevo">+ Agregar usuario</button>',
    cuerpo: `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Zonas</th><th>Personajes visibles</th>${pags.length > 1 ? '<th>Páginas</th>' : ''}<th>Último acceso</th><th>Acuerdo</th><th></th></tr></thead><tbody>
    ${usuarios.map(u => `<tr style="${u.activo ? '' : 'opacity:.5'}"><td><b>${esc(u.nombre)}</b>${u.activo ? '' : ' <span class="chip neu">desactivado</span>'}</td><td>${esc(u.usuario)}</td><td>${esc(u.rolNombre)}</td>
      <td class="nota">${esc((u.zonas || []).join(', ') || '—')}</td><td class="nota">${u.rol === 'admin' ? 'Todos' : esc(nomEnt(u.entidadesVisibles))}</td>${pags.length > 1 ? `<td class="nota">${esc(nomPag(u))}</td>` : ''}
      <td class="nota">${u.ultimoAcceso ? haceCuanto(u.ultimoAcceso) : 'nunca'}</td><td>${u.aceptoEn ? '<span class="chip pos">Aceptado</span>' : '<span class="chip ambar">Pendiente</span>'}</td>
      <td class="nowrap"><button class="btn chico" data-editar="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>` })}`;
  el.querySelector('#btnNuevo').onclick = () => formUsuario(null, ents, pags, ctx);
  el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => formUsuario(usuarios.find(u => u.id === +b.dataset.editar), ents, pags, ctx));
}
function formUsuario(u, ents, pags, ctx) {
  const vis = u?.entidadesVisibles;
  const pvis = u?.paginasVisibles;
  const v = ventana(u ? `Editar a ${u.nombre}` : 'Agregar usuario', `<form class="form" id="f" style="grid-template-columns:1fr 1fr">
    <label class="campo">Nombre completo<input type="text" name="nombre" required value="${esc(u?.nombre || '')}"></label>
    <label class="campo">Usuario<input type="text" name="usuario" required value="${esc(u?.usuario || '')}" ${u ? 'disabled' : ''} pattern="[a-z0-9._\\-]{3,30}" title="Minúsculas, números, punto o guion"></label>
    <label class="campo">Rol<select name="rol">${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${u?.rol === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="campo">${u ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<input type="text" name="pass" ${u ? '' : 'required'} autocomplete="new-password" placeholder="Mín. 8, letras y números"><span class="nota" id="pistaPass" style="font-weight:400"></span></label>
    <div style="grid-column:1/-1" id="bloqueZonas"><div class="nota mb">Zonas a su cargo (jefe de zona)</div><div class="linea">${ZONAS.map(z => `<label class="check"><input type="checkbox" name="zona" value="${z}" ${(u?.zonas || []).includes(z) ? 'checked' : ''}> ${z}</label>`).join('')}</div></div>
    <div style="grid-column:1/-1" id="bloqueEnt"><div class="nota mb">Personajes que puede ver (si no marcas ninguno, ve todos)</div><div class="linea">${ents.map(e => `<label class="check"><input type="checkbox" name="ent" value="${e.id}" ${vis && vis.includes(e.id) ? 'checked' : ''}> ${esc(e.nombre)}</label>`).join('')}</div></div>
    ${pags.length > 1 ? `<div style="grid-column:1/-1" id="bloquePag"><div class="nota mb">Páginas que puede ver (si no marcas ninguna, solo la principal)</div><div class="linea">${pags.map(x => `<label class="check"><input type="checkbox" name="pag" value="${x.id}" ${pvis ? (pvis.includes(x.id) ? 'checked' : '') : (x.principal ? 'checked' : '')}> ${esc(x.nombre)}</label>`).join('')}</div></div>` : ''}
    ${u ? `<label class="check" style="grid-column:1/-1"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''}> Usuario activo (puede entrar)</label>` : ''}
  </form><div class="nota sep">Al entrar por primera vez (o después de cambiarle la contraseña) se le pedirá que la cambie y que acepte el acuerdo de confidencialidad.</div>`,
  { pie: `${u ? '<button class="btn peligro a-izquierda" data-borrar>Eliminar</button>' : ''}<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>` });
  const f = v.cuerpo.querySelector('#f');
  const ajustar = () => { const r = f.rol.value;
    f.pass.placeholder = r === 'admin' ? 'Mín. 12, letras y números' : 'Mín. 8, letras y números';
    f.pass.minLength = r === 'admin' ? 12 : 8;
    v.cuerpo.querySelector('#pistaPass').textContent = r === 'admin' ? 'Los administradores necesitan al menos 12 caracteres.' : '';
    v.cuerpo.querySelector('#bloqueZonas').style.display = r === 'jefe_zona' ? '' : 'none'; v.cuerpo.querySelector('#bloqueEnt').style.display = r === 'admin' ? 'none' : ''; const bp = v.cuerpo.querySelector('#bloquePag'); if (bp) bp.style.display = r === 'admin' ? 'none' : ''; };
  f.rol.onchange = ajustar; ajustar();
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.pie.querySelector('[data-si]').onclick = async () => {
    if (!f.reportValidity()) return;
    const marcados = (n) => [...f.querySelectorAll(`input[name=${n}]:checked`)].map(x => x.value);
    const cuerpo = { nombre: f.nombre.value.trim(), rol: f.rol.value, zonas: f.rol.value === 'jefe_zona' ? marcados('zona') : [],
      entidades: marcados('ent').map(Number), ...(f.querySelector('input[name=pag]') ? { paginas: marcados('pag').map(Number) } : {}) };
    if (f.pass.value) cuerpo.pass = f.pass.value;
    if (!u) cuerpo.usuario = f.usuario.value.trim().toLowerCase();
    if (u) cuerpo.activo = f.activo.checked;
    try { await api(u ? `/api/usuarios/${u.id}` : '/api/usuarios', { metodo: u ? 'PATCH' : 'POST', cuerpo }); v.cerrar(); aviso('Usuario guardado.'); ctx.re(); }
    catch (e) { aviso(e.message, 'error'); }
  };
  const b = v.pie.querySelector('[data-borrar]');
  if (b) b.onclick = async () => {
    if (!await confirmar('Eliminar usuario', `¿Eliminar a ${esc(u.nombre)}? Si solo quieres que no entre, mejor desactívalo.`, { texto: 'Eliminar', peligro: true })) return;
    try { await api(`/api/usuarios/${u.id}`, { metodo: 'DELETE' }); v.cerrar(); aviso('Usuario eliminado.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  };
}

// ═════════ APIs e IA ═════════
async function vApis(el, ctx) {
  const a = await api('/api/ajustes');
  const ia = a.ia, g = a.google;
  const estadoLlave = (s) => s.configurada ? `<span class="chip pos">Configurada · …${esc(s.final)}${s.origen === 'railway' ? ' (Railway)' : ''}</span>` : `<span class="chip ambar">${esc(s.error || 'Sin configurar')}</span>`;
  const pct = ia.tope ? Math.min(100, Math.round(ia.gastoMes.costo / ia.tope * 100)) : 0;
  el.innerHTML = `<div class="guia">Las llaves se guardan <b>cifradas</b> y nunca se vuelven a mostrar completas. Para cambiar una, escribe la nueva y guarda. Nunca las compartas por chat ni correo.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c6', titulo: 'Llaves de inteligencia artificial', nota: 'Puedes tener varias y elegir cuál usa cada tarea', cuerpo: Object.entries(ia.llaves).map(([k, s]) => `
      <div style="padding:12px 0;border-bottom:1px solid var(--borde)"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b>${esc(s.nombre)}</b>${estadoLlave(s)}</div>
      <div class="linea"><input type="password" data-llave="ia.${k}.key" placeholder="Pegar llave nueva" autocomplete="off"><button class="btn chico" data-guardar-llave="ia.${k}.key">Guardar</button><button class="btn chico" data-probar="${k}" ${s.configurada ? '' : 'disabled'}>Probar</button></div></div>`).join('') })}
    ${tarjeta({ clase: 'c6', titulo: 'Qué IA usa cada tarea',
      ayuda: '«Clasificar» analiza cada comentario (es lo que más gasta); «redactar» escribe resúmenes y alertas. Claude Haiku 5.5 (claude-haiku-5-5) cuesta unas 10 veces menos que Haiku 4.5: si lo pruebas, haz la revisión semanal de la IA unos días para confirmar que acierta igual antes de dejarlo.',
      cuerpo: `
      ${['clasificar', 'redactar'].map(t => `<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:6px">${t === 'clasificar' ? 'Clasificar comentarios (muchos, barato)' : 'Redactar resúmenes (pocos, mejor calidad)'}</div>
        <div class="form" style="grid-template-columns:1fr 1.4fr"><label class="campo">Proveedor<select data-ajuste="ia.${t}.proveedor">${Object.entries(ia.llaves).map(([k, s]) => `<option value="${k}" ${ia[t].proveedor === k ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></label>
        <label class="campo">Modelo<input type="text" data-ajuste="ia.${t}.modelo" value="${esc(ia[t].modelo)}" list="modelos-${t}"><datalist id="modelos-${t}"></datalist></label></div></div>`).join('')}
      <div class="form" style="grid-template-columns:1fr 1fr"><label class="campo">Tope mensual (USD)<input type="number" min="0" step="1" data-ajuste="ia.tope_mensual" value="${ia.tope}"></label>
        <div><div class="nota">Gastado este mes</div><div class="kpi"><span class="valor chico ${pct >= 80 ? 't-neg' : 't-lima'}">$${ia.gastoMes.costo.toFixed(2)} <small>(${pct}%)</small></span></div></div></div>
      <div class="nota sep">Al llegar al 80% y al 100% te llega un aviso por Telegram. Al 100% se pausa el análisis con IA hasta el mes siguiente (los comentarios quedan con la clasificación básica).</div>
      <button class="btn primario" id="btnGuardarIA" style="margin-top:12px">Guardar</button>` })}
    ${tarjeta({ clase: 'c12', titulo: 'Google Maps', nota: 'La llave del mapa va al navegador: restríngela en Google Cloud para que solo funcione en la página del tablero.', cuerpo: `
      <div class="form" style="grid-template-columns:1fr 1fr 160px">
        <label class="campo">Llave del mapa (Maps JavaScript API)<input type="text" data-ajuste="google.maps_key" value="${esc(g.maps.valor)}" placeholder="AIza…" autocomplete="off"></label>
        <label class="campo">Llave de direcciones (Geocoding API) ${estadoLlave(g.geocoding)}<input type="password" data-llave-g="google.geocoding_key" placeholder="Pegar llave nueva (opcional)" autocomplete="off"></label>
        <label class="campo">Búsquedas al mes (tope)<input type="number" min="0" data-ajuste="google.tope_mensual" value="${g.tope}"></label>
      </div><div class="nota sep">Búsquedas este mes: ${num(g.usoMes)}. Cada lugar se busca una sola vez y se guarda.</div>
      <button class="btn primario" id="btnGuardarG" style="margin-top:12px">Guardar</button>` })}
  </div>`;
  const guardar = async (cambios, msg = 'Guardado.') => { try { await api('/api/ajustes', { metodo: 'PUT', cuerpo: cambios }); aviso(msg); ctx.re(); } catch (e) { aviso(e.message, 'error'); } };
  el.querySelectorAll('[data-guardar-llave]').forEach(b => b.onclick = () => {
    const inp = el.querySelector(`[data-llave="${b.dataset.guardarLlave}"]`);
    if (!inp.value.trim()) return aviso('Pega la llave primero.', 'error');
    guardar({ [b.dataset.guardarLlave]: inp.value.trim() }, 'Llave guardada.');
  });
  el.querySelectorAll('[data-probar]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Probando…';
    try {
      const r = await api(`/api/ajustes/modelos/${b.dataset.probar}`);
      aviso(`Funciona: ${r.modelos.length} modelos disponibles.`);
      for (const t of ['clasificar', 'redactar']) if (el.querySelector(`[data-ajuste="ia.${t}.proveedor"]`).value === b.dataset.probar) el.querySelector(`#modelos-${t}`).innerHTML = r.modelos.map(m => `<option value="${esc(m.id || m)}">`).join('');
    } catch (e) { aviso('No funcionó: ' + e.message, 'error'); }
    finally { b.disabled = false; b.textContent = 'Probar'; }
  });
  const recoger = (sel) => Object.fromEntries([...el.querySelectorAll(sel)].map(x => [x.dataset.ajuste, x.value.trim()]));
  el.querySelector('#btnGuardarIA').onclick = () => guardar(recoger('[data-ajuste^="ia."]'));
  el.querySelector('#btnGuardarG').onclick = () => {
    const c = recoger('[data-ajuste^="google."]');
    const geo = el.querySelector('[data-llave-g]').value.trim(); if (geo) c['google.geocoding_key'] = geo;
    guardar(c);
  };
}

// ═════════ META: páginas de Facebook e Instagram ═════════
async function vMeta(el, ctx) {
  const [a, trabajos] = await Promise.all([api('/api/ajustes'), api('/api/trabajos')]);
  const m = a.meta;
  const appLista = m.appId && m.secreto.configurada;
  el.innerHTML = `
  <div class="guia">Conecta la página de EMETRA (principal) y, si quieres, <b>otras páginas que administras</b> para analizarlas por separado. En el tablero aparece un selector para cambiar de página; en Usuarios eliges quién puede ver cada una.
    Los comentarios, las visualizaciones y los seguidores llegan solos cada hora. Threads se conecta aparte en cada página (solo visualizaciones y seguidores). TikTok y X se siguen subiendo por Excel (en Datos).
    ${m.paginas.some(p => p.facebook) ? '<br><b>Si conectaste antes de noviembre de 2026</b>, vuelve a conectar con «Agregar o reconectar páginas» para dar el permiso nuevo de estadísticas de Instagram.' : ''}</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c5', titulo: '1. App de Meta', nota: 'Se crea una vez en developers.facebook.com', cuerpo: `
      <div class="form" style="grid-template-columns:1fr">
        <label class="campo">ID de la app<input type="text" data-ajuste="meta.app_id" value="${esc(m.appId)}"></label>
        <label class="campo">Clave secreta ${m.secreto.configurada ? `<span class="chip pos">…${esc(m.secreto.final)}</span>` : '<span class="chip ambar">Sin configurar</span>'}<input type="password" data-ajuste="meta.app_secret" placeholder="${m.secreto.configurada ? 'Dejar vacío para no cambiar' : 'Pegar clave secreta'}" autocomplete="off"></label>
        <label class="campo">Versión de la API<input type="text" data-ajuste="meta.version" value="${esc(m.version)}"></label>
      </div>
      <div class="nota" style="margin:10px 0 4px">Dirección de regreso (pégala en la app de Meta → Inicio de sesión con Facebook → URI de redireccionamiento válidos):</div>
      <div class="linea"><input type="text" readonly value="${esc(m.redirectUri)}" id="uri"><button class="btn chico" id="btnCopiar">Copiar</button></div>
      <div class="sep-grande">${rotulo('Threads (opcional)')}
        <div class="nota mb">En la app de Meta agrega el caso de uso <b>Threads</b> (permisos <i>threads_basic</i> y <i>threads_manage_insights</i>). Threads te da su propio ID y clave.</div>
        <div class="form" style="grid-template-columns:1fr">
          <label class="campo">ID de Threads<input type="text" data-ajuste="threads.app_id" value="${esc(m.threadsApp.appId)}"></label>
          <label class="campo">Clave secreta de Threads ${m.threadsApp.secreto.configurada ? `<span class="chip pos">…${esc(m.threadsApp.secreto.final)}</span>` : '<span class="chip ambar">Sin configurar</span>'}<input type="password" data-ajuste="threads.app_secret" placeholder="${m.threadsApp.secreto.configurada ? 'Dejar vacío para no cambiar' : 'Pegar clave secreta de Threads'}" autocomplete="off"></label>
        </div>
        <div class="nota" style="margin:10px 0 4px">Dirección de regreso de Threads (en el caso de uso Threads → Configuración → URL de devolución de llamada):</div>
        <div class="linea"><input type="text" readonly value="${esc(m.threadsApp.redirectUri)}" id="uriTh"><button class="btn chico" id="btnCopiarTh">Copiar</button></div>
      </div>
      <button class="btn primario" id="btnGuardarApp" style="margin-top:12px">Guardar</button>` })}
    ${tarjeta({ clase: 'c7', titulo: '2. Páginas', acciones: `<button class="btn chico primario" id="btnConectar" ${appLista ? '' : 'disabled title="Primero guarda la app"'}>${m.paginas.some(p => p.facebook) ? '+ Agregar o reconectar páginas' : 'Conectar con Facebook'}</button>`,
      cuerpo: `${m.paginasPorElegir.some(o => !o.yaAgregada) ? `<div class="guia"><b>Elige qué páginas analizar.</b> Estas son las páginas que administras:</div>
        <div class="lista-com" style="margin-bottom:16px">${m.paginasPorElegir.filter(o => !o.yaAgregada).map(o => `<div class="comentario"><div class="meta"><b style="color:var(--texto);font-size:14px">${esc(o.nombre)}</b>${o.instagram ? `<span>· Instagram @${esc(o.instagram)}</span>` : '<span>· sin Instagram vinculado</span>'}${o.yaAgregada ? `<span class="chip pos">Ya agregada como «${esc(o.yaAgregada)}»</span>` : ''}</div>
          ${o.yaAgregada ? '' : `<div class="linea sep">${m.paginas.find(p => p.principal && !p.facebook) ? `<button class="btn chico primario" data-elegir="${esc(o.id)}" data-como="principal">Usar como principal (EMETRA)</button>` : ''}<button class="btn chico" data-elegir="${esc(o.id)}" data-como="adicional">Agregar como página adicional</button></div>`}</div>`).join('')}</div>` : ''}
        <div class="lista-com">${m.paginas.map(p => { const [cl, tx] = ESTADO_PAG[p.estado] || ESTADO_PAG.sin_conectar; return `<div class="comentario">
          <div class="meta"><b style="color:var(--texto);font-size:14px">${esc(p.nombre)}</b>${p.principal ? '<span class="chip lima">Principal</span>' : ''}<span class="chip ${cl}">${tx}</span>${p.instagram ? `<span>Instagram @${esc(p.instagram)}</span>` : ''}${p.threads ? `<span>· Threads @${esc(p.threads.usuario || '')}</span>${p.threads.error ? '<span class="chip neg">Threads con error</span>' : ''}` : ''}</div>
          <div class="nota">${num(p.comentarios)} comentarios guardados${p.ultimaSync ? ` · última sincronización ${haceCuanto(p.ultimaSync)}` : ''}${p.ultimoError ? ` · <span class="t-neg">${esc(p.ultimoError)}</span>` : ''}</div>
          ${p.estadisticasError ? `<div class="nota t-ambar">⚠ ${esc(p.estadisticasError)}</div>` : ''}
          ${p.threads?.error ? `<div class="nota t-neg">Threads: ${esc(p.threads.error)}</div>` : p.threads?.vence ? `<div class="nota">Threads: el permiso se renueva solo (vence el ${fecha(p.threads.vence)} si no se renueva).</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            ${p.conectada ? `<button class="btn chico" data-probar="${p.id}">Probar (Fase 0)</button><button class="btn chico" data-historial="${p.id}">Importar historial</button><button class="btn chico" data-desconectar="${p.id}">Desconectar</button>` : ''}
            ${p.threads ? `<button class="btn chico" data-th-quitar="${p.id}">Desconectar Threads</button>${p.threads.error ? `<button class="btn chico primario" data-th="${p.id}">Volver a conectar Threads</button>` : ''}` : `<button class="btn chico" data-th="${p.id}" ${m.threadsApp.appId && m.threadsApp.secreto.configurada ? '' : 'disabled title="Primero guarda el ID y la clave de Threads"'}>Conectar Threads</button>`}
            <button class="btn chico" data-renombrar="${p.id}">Renombrar</button>${p.principal ? '' : `<button class="btn chico peligro" data-quitar="${p.id}">Quitar página</button>`}
          </div></div>`; }).join('')}</div>
        ${m.paginas.some(p => p.conectada) ? '<button class="btn chico" id="btnSync" style="margin-top:14px">Sincronizar ahora</button>' : ''}` })}
    ${trabajos.length ? tarjeta({ clase: 'c12', titulo: 'Importaciones y análisis en lote', cuerpo: `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Inicio</th><th>Página</th><th>Desde</th><th>Estado</th><th class="n">Publicaciones</th><th class="n">Comentarios</th><th class="n">Analizados</th><th class="n">Gastado</th></tr></thead><tbody>
      ${trabajos.map(t => { const d = t.datos || {}; return `<tr><td class="nota">${fecha(t.creado_en, true)}</td><td>${esc(t.tipo === 'analisis_lote' ? (d.nombre || 'Análisis en lote') : (d.pagina || ''))}</td><td>${esc(d.desde || '')}</td><td>${esc(t.estado)}${d.fase ? ` · ${esc(d.fase)}` : ''}${t.error ? `<div class="t-neg">${esc(t.error)}</div>` : ''}</td>
        <td class="n">${num(d.posts || 0)}</td><td class="n">${num(d.comentarios || 0)}</td><td class="n">${num(d.analizados || 0)}</td><td class="n">$${(d.gastado || 0).toFixed(2)} / $${d.presupuesto || 0}</td></tr>`; }).join('')}</tbody></table></div>` }) : ''}
  </div>`;

  el.querySelector('#btnCopiar').onclick = () => { navigator.clipboard?.writeText(m.redirectUri).then(() => aviso('Copiado.')).catch(() => el.querySelector('#uri').select()); };
  el.querySelector('#btnCopiarTh').onclick = () => { navigator.clipboard?.writeText(m.threadsApp.redirectUri).then(() => aviso('Copiado.')).catch(() => el.querySelector('#uriTh').select()); };
  el.querySelectorAll('[data-th]').forEach(b => b.onclick = async () => {
    try { const r = await api('/api/threads/iniciar', { metodo: 'POST', cuerpo: { paginaId: +b.dataset.th, volver: location.origin + location.pathname } }); location.href = r.url; } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-th-quitar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Desconectar Threads', 'Dejarán de llegar las visualizaciones y seguidores de Threads de esta página. Lo ya guardado se conserva.', { texto: 'Desconectar', peligro: true })) return;
    try { await api('/api/threads/desconectar', { metodo: 'POST', cuerpo: { paginaId: +b.dataset.thQuitar } }); aviso('Threads desconectado.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelector('#btnGuardarApp').onclick = async () => {
    const c = Object.fromEntries([...el.querySelectorAll('[data-ajuste]')].map(x => [x.dataset.ajuste, x.value.trim()]).filter(([k, v]) => !k.endsWith('app_secret') || v));
    try { await api('/api/ajustes', { metodo: 'PUT', cuerpo: c }); aviso('Guardado.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  };
  const bc = el.querySelector('#btnConectar');
  if (bc) bc.onclick = async () => { try { const r = await api('/api/meta/iniciar', { metodo: 'POST', cuerpo: { volver: location.origin + location.pathname } }); location.href = r.url; } catch (e) { aviso(e.message, 'error'); } };
  el.querySelectorAll('[data-elegir]').forEach(b => b.onclick = async () => {
    try { const r = await api('/api/meta/elegir', { metodo: 'POST', cuerpo: { id: b.dataset.elegir, como: b.dataset.como } }); aviso(`Agregada: ${r.elegida}. Ya puedes probarla.`); ctx.re(); }
    catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-probar]').forEach(b => b.onclick = () => fase0(+b.dataset.probar));
  el.querySelectorAll('[data-historial]').forEach(b => b.onclick = () => historial(+b.dataset.historial, m.paginas.find(p => p.id === +b.dataset.historial), ctx));
  el.querySelectorAll('[data-desconectar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Desconectar página', 'Dejarán de llegar comentarios nuevos de esta página. Lo ya guardado se conserva.', { texto: 'Desconectar', peligro: true })) return;
    try { await api('/api/meta/desconectar', { metodo: 'POST', cuerpo: { paginaId: +b.dataset.desconectar } }); aviso('Desconectada.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-renombrar]').forEach(b => b.onclick = async () => {
    const p = m.paginas.find(x => x.id === +b.dataset.renombrar);
    const nombre = prompt('Nombre con el que aparece en el tablero:', p.nombre); if (!nombre?.trim()) return;
    try { await api(`/api/paginas/${p.id}`, { metodo: 'PATCH', cuerpo: { nombre: nombre.trim() } }); aviso('Nombre cambiado.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => {
    const p = m.paginas.find(x => x.id === +b.dataset.quitar);
    const v = ventana('Quitar página', `<p>Se quitará <b>${esc(p.nombre)}</b> del tablero. Tiene <b>${num(p.comentarios)}</b> comentarios guardados.</p>
      ${p.comentarios ? `<label class="campo">Para borrar también sus comentarios y publicaciones, escribe BORRAR<input type="text" id="conf" autocomplete="off"></label>` : ''}`,
      { pie: '<button class="btn" data-no>Cancelar</button><button class="btn peligro" data-si>Quitar</button>' });
    v.pie.querySelector('[data-no]').onclick = v.cerrar;
    v.pie.querySelector('[data-si]').onclick = async () => {
      const conf = v.cuerpo.querySelector('#conf')?.value.trim();
      try { await api(`/api/paginas/${p.id}`, { metodo: 'DELETE', cuerpo: p.comentarios ? { borrarDatos: true, confirmar: conf } : {} }); v.cerrar(); aviso('Página quitada.'); ctx.re(); }
      catch (e) { aviso(e.message, 'error'); }
    };
  });
  const bs = el.querySelector('#btnSync');
  if (bs) bs.onclick = async () => {
    bs.disabled = true; bs.textContent = 'Sincronizando…';
    try { const r = await api('/api/meta/sincronizar', { metodo: 'POST' }); aviso(`${num(r.posts)} publicaciones revisadas · ${num(r.nuevos)} comentarios nuevos${r.errores?.length ? ' · con errores: ' + r.errores.join('; ') : ''}`, r.errores?.length ? 'error' : 'ok'); ctx.re(); }
    catch (e) { aviso(e.message, 'error'); bs.disabled = false; bs.textContent = 'Sincronizar ahora'; }
  };
}
async function fase0(paginaId) {
  const v = ventana('Prueba de conexión (Fase 0)', '<div class="cargando bloque"></div><div class="nota" style="text-align:center">Trayendo una muestra de publicaciones y comentarios… no se guarda nada.</div>', { ancha: true });
  try {
    const r = await api('/api/meta/probar', { metodo: 'POST', cuerpo: { paginaId } });
    v.cuerpo.innerHTML = `<div class="guia"><b>${esc(r.pagina)}</b>${r.instagram ? ` · Instagram @${esc(r.instagram)}` : ''}<ul style="margin:8px 0 0;padding-left:18px">${r.conclusiones.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      <h4>Facebook</h4>${r.facebook.map(p => `<div class="comentario"><div class="meta"><span>${fecha(p.fecha, true)}</span>${p.chapas.map(c => `<span class="chip">#chapa${esc(c)}</span>`).join('')}<span>· ${num(p.reacciones)} reacciones · ${num(p.comentariosTotal)} comentarios</span></div>
        <div class="txt">${esc(p.texto)}</div>${p.comentarios.map(k => `<div class="nota sep">💬 <b>${esc(k.autor || '(autor no disponible)')}</b>: ${esc(k.texto || '')}</div>`).join('')}</div>`).join('') || vacio()}
      ${r.instagramMuestras.length ? `<h4>Instagram</h4>${r.instagramMuestras.map(p => `<div class="comentario"><div class="txt">${esc(p.texto)}</div>${p.comentarios.map(k => `<div class="nota sep">💬 <b>${esc(k.autor || '')}</b>: ${esc(k.texto || '')}</div>`).join('')}</div>`).join('')}` : ''}`;
  } catch (e) { v.cuerpo.innerHTML = `<div class="vacio t-neg">⚠ ${esc(e.message)}</div>`; }
}
function historial(paginaId, p, ctx) {
  const v = ventana(`Importar historial · ${p.nombre}`, `<p class="nota" style="margin-top:0">Trae las publicaciones y comentarios desde la fecha que elijas. Primero se calcula cuánto costaría analizarlos con IA; luego apruebas un presupuesto (aparte del tope mensual).</p>
    <div class="form" style="grid-template-columns:1fr auto"><label class="campo">Desde<input type="date" id="desde" value="2026-01-01"></label><button class="btn" id="btnEst">Calcular</button></div><div id="est" style="margin-top:14px"></div>`,
    { pie: '<button class="btn" data-no>Cerrar</button>' });
  v.pie.querySelector('[data-no]').onclick = v.cerrar;
  v.cuerpo.querySelector('#btnEst').onclick = async (e) => {
    const b = e.target; b.disabled = true; b.textContent = 'Calculando…';
    const desde = v.cuerpo.querySelector('#desde').value;
    try {
      const r = await api('/api/meta/historial/estimar', { metodo: 'POST', cuerpo: { desde, paginaId } });
      v.cuerpo.querySelector('#est').innerHTML = `<div class="guia">${num(r.publicacionesFacebook)} publicaciones de Facebook y ${num(r.publicacionesInstagram)} de Instagram, con unos <b>${num(r.comentarios)} comentarios</b>.
        Analizar con IA unos ${num(r.comentariosConIA)} (sin contar el ruido) costaría aproximadamente <b>$${r.costoEstimado.toFixed(2)}</b>.</div>
        <div class="form" style="grid-template-columns:1fr auto"><label class="campo">Presupuesto que apruebas (USD)<input type="number" id="pres" min="1" step="1" value="${Math.max(1, Math.ceil(r.costoEstimado * 1.15))}"></label><button class="btn primario" id="btnImp">Aprobar e importar</button></div>
        <div class="nota sep">Si se acaba el presupuesto, lo que falte se analiza poco a poco dentro del tope mensual.</div>`;
      v.cuerpo.querySelector('#btnImp').onclick = async () => {
        try { await api('/api/meta/historial/importar', { metodo: 'POST', cuerpo: { desde, presupuesto: +v.cuerpo.querySelector('#pres').value, paginaId } }); v.cerrar(); aviso('Importación iniciada. Te avisará por Telegram al terminar.'); ctx.re(); }
        catch (err) { aviso(err.message, 'error'); }
      };
    } catch (err) { aviso(err.message, 'error'); }
    finally { b.disabled = false; b.textContent = 'Calcular'; }
  };
}

// ═════════ TELEGRAM ═════════
async function vTelegram(el, ctx) {
  const [a, dest, usuarios] = await Promise.all([api('/api/ajustes'), api('/api/telegram/destinatarios'), api('/api/usuarios')]);
  const t = a.telegram;
  el.innerHTML = `<div class="guia">Cada persona recibe solo lo que puede ver en el tablero (por ejemplo, un oficial no recibe noticias de personajes que no tiene visibles, y un jefe de zona solo las denuncias de su zona).
    <b>Fallas, gasto y respaldo</b> son solo para administradores.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c4', titulo: 'Bot de Telegram', nota: 'Se crea con @BotFather en Telegram', cuerpo: `
      <div class="mb">${t.token.configurada ? `<span class="chip pos">Configurado${t.bot ? ' · @' + esc(t.bot) : ''}</span>` : '<span class="chip ambar">Sin configurar</span>'}</div>
      <label class="campo">Token del bot<input type="password" id="tgToken" placeholder="Pegar token nuevo" autocomplete="off"></label>
      <button class="btn primario chico" id="btnTg" style="margin-top:10px">Guardar</button>` })}
    ${tarjeta({ clase: 'c8', titulo: 'Quién recibe avisos', acciones: '<button class="btn chico primario" id="btnDest">+ Agregar persona</button>', cuerpo: dest.length ? `<div class="lista-com">${dest.map(d => `
      <div class="comentario"><div class="meta"><b style="color:var(--texto);font-size:14px">${esc(d.nombre)}</b>${d.cargo ? `<span>· ${esc(d.cargo)}</span>` : ''}${d.telefono ? `<span>· ${esc(d.telefono)}</span>` : ''}
        ${d.vinculado ? '<span class="chip pos">Vinculado</span>' : '<span class="chip ambar">Falta abrir su enlace</span>'}${d.activo ? '' : '<span class="chip neu">Pausado</span>'}${d.sinUsuario ? '<span class="chip neg">Sin usuario del tablero</span>' : ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0">${Object.entries(t.tipos).map(([k, n]) => { const soloAdm = t.soloAdmin.includes(k), bloqueado = soloAdm && d.rol !== 'admin';
          return `<label class="check" style="${bloqueado ? 'opacity:.4' : ''}" title="${bloqueado ? 'Solo para administradores' : ''}"><input type="checkbox" data-tipo="${k}" data-dest="${d.id}" ${d.tipos.includes(k) ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}> ${esc(n)}</label>`; }).join('')}</div>
        ${d.vinculado ? '' : `<div class="nota">Envíale este enlace personal; al abrirlo en Telegram queda vinculado: <input type="text" readonly value="${esc(d.enlace || 'Configura primero el bot')}" style="margin-top:4px"></div>`}
        <div class="linea sep">${d.vinculado ? `<button class="btn chico" data-prueba="${d.id}">Enviar prueba</button>` : ''}<button class="btn chico" data-pausar="${d.id}" data-activo="${d.activo ? 1 : 0}">${d.activo ? 'Pausar' : 'Reanudar'}</button><button class="btn chico peligro" data-quitar="${d.id}">Quitar</button></div>
      </div>`).join('')}</div>` : vacio('Nadie recibe avisos todavía.') })}
  </div>`;
  el.querySelector('#btnTg').onclick = async () => {
    const v = el.querySelector('#tgToken').value.trim(); if (!v) return aviso('Pega el token.', 'error');
    try { await api('/api/ajustes', { metodo: 'PUT', cuerpo: { 'telegram.bot_token': v } }); aviso('Bot conectado.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  };
  el.querySelectorAll('[data-tipo]').forEach(c => c.onchange = async () => {
    const id = +c.dataset.dest;
    const tipos = [...el.querySelectorAll(`[data-dest="${id}"]:checked`)].map(x => x.dataset.tipo);
    try { await api(`/api/telegram/destinatarios/${id}`, { metodo: 'PATCH', cuerpo: { tipos } }); aviso('Guardado.'); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-prueba]').forEach(b => b.onclick = async () => { try { await api(`/api/telegram/destinatarios/${b.dataset.prueba}/prueba`, { metodo: 'POST' }); aviso('Mensaje de prueba enviado.'); } catch (e) { aviso(e.message, 'error'); } });
  el.querySelectorAll('[data-pausar]').forEach(b => b.onclick = async () => { try { await api(`/api/telegram/destinatarios/${b.dataset.pausar}`, { metodo: 'PATCH', cuerpo: { activo: b.dataset.activo !== '1' } }); ctx.re(); } catch (e) { aviso(e.message, 'error'); } });
  el.querySelectorAll('[data-quitar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Quitar persona', 'Dejará de recibir avisos.', { texto: 'Quitar', peligro: true })) return;
    try { await api(`/api/telegram/destinatarios/${b.dataset.quitar}`, { metodo: 'DELETE' }); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelector('#btnDest').onclick = () => {
    const libres = usuarios.filter(u => u.activo && !dest.some(d => d.usuarioId === u.id));
    const v = ventana('Agregar persona a los avisos', `<form class="form" id="f" style="grid-template-columns:1fr 1fr">
      <label class="campo ancho">Usuario del tablero<select name="usuarioId" required>${libres.map(u => `<option value="${u.id}" data-rol="${u.rol}">${esc(u.nombre)} (${esc(u.rolNombre)})</option>`).join('')}</select></label>
      <label class="campo">Cargo<input type="text" name="cargo" placeholder="Ej.: Jefe zona 11"></label>
      <label class="campo">Teléfono (referencia)<input type="tel" name="telefono" placeholder="+502 …"></label>
      <div style="grid-column:1/-1"><div class="nota mb">Qué recibe</div><div style="display:flex;flex-wrap:wrap;gap:6px 14px" id="tipos">${Object.entries(t.tipos).map(([k, n]) => `<label class="check"><input type="checkbox" name="tipo" value="${k}" ${t.soloAdmin.includes(k) ? '' : 'checked'}> ${esc(n)}</label>`).join('')}</div></div>
    </form><div class="nota sep">Telegram no permite escribirle a un número directamente: la persona debe abrir su enlace personal una vez. El enlace aparece al guardar.</div>`,
      { pie: '<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>' });
    const f = v.cuerpo.querySelector('#f');
    if (!libres.length) { v.cuerpo.innerHTML = vacio('Todos los usuarios ya están en la lista. Crea primero el usuario en la pestaña Usuarios.'); }
    const ajustar = () => { const esAdm = f.usuarioId?.selectedOptions[0]?.dataset.rol === 'admin'; f.querySelectorAll('input[name=tipo]').forEach(c => { const s = t.soloAdmin.includes(c.value); c.disabled = s && !esAdm; if (c.disabled) c.checked = false; c.parentElement.style.opacity = c.disabled ? .4 : 1; }); };
    if (f.usuarioId) { f.usuarioId.onchange = ajustar; ajustar(); }
    v.pie.querySelector('[data-no]').onclick = v.cerrar;
    v.pie.querySelector('[data-si]').onclick = async () => {
      if (!libres.length) return v.cerrar();
      const cuerpo = { usuarioId: +f.usuarioId.value, cargo: f.cargo.value.trim(), telefono: f.telefono.value.trim(), tipos: [...f.querySelectorAll('input[name=tipo]:checked')].map(c => c.value) };
      try { await api('/api/telegram/destinatarios', { metodo: 'POST', cuerpo }); v.cerrar(); aviso('Agregado. Envíale su enlace personal.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
    };
  };
}

// ═════════ NOTICIAS (RSS de Google Alertas) ═════════
async function vNoticias(el, ctx) {
  const [fuentes, ents, aj] = await Promise.all([api('/api/fuentes'), api('/api/entidades'), api('/api/ajustes')]);
  const cats = aj.noticias.categorias.filter(c => c !== 'Otros');
  el.innerHTML = `<div class="guia">En <b>google.com/alerts</b> crea una alerta (por ejemplo «PMT Guatemala»), en «Enviar a» elige <b>Feed RSS</b>, copia el enlace del feed y pégalo aquí. Las noticias nuevas se revisan cada hora y todos los usuarios las ven en Medios.
    Si una alerta es sobre un personaje, vincúlala para que solo la vean quienes pueden ver a ese personaje.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c12', titulo: 'Agregar fuente', cuerpo: `<form class="form" id="f" style="grid-template-columns:1fr 2fr 1fr auto">
      <label class="campo">Nombre<input type="text" name="nombre" required placeholder="Ej.: Alerta PMT"></label>
      <label class="campo">Enlace del feed RSS<input type="text" name="url" required placeholder="https://www.google.com/alerts/feeds/…"></label>
      <label class="campo">Personaje (opcional)<select name="entidad_id"><option value="">Ninguno</option>${ents.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <button class="btn primario">Agregar</button></form>` })}
    ${tarjeta({ clase: 'c12', titulo: 'Fuentes', nota: `${fuentes.length} fuentes`, cuerpo: fuentes.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Personaje</th><th>Estado</th><th>Última lectura</th><th></th></tr></thead><tbody>
      ${fuentes.map(f => `<tr><td><b>${esc(f.nombre)}</b><div class="nota" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.url)}</div></td><td>${esc(f.entidad_nombre || '—')}</td>
        <td>${f.activa === false ? '<span class="chip neu">Pausada</span>' : f.fallos >= 3 ? `<span class="chip neg">Falla</span><div class="nota">${esc(f.ultimo_error || '')}</div>` : '<span class="chip pos">Activa</span>'}</td>
        <td class="nota">${f.ultima_lectura ? haceCuanto(f.ultima_lectura) : '—'}</td>
        <td class="nowrap"><button class="btn chico" data-pausar="${f.id}" data-activa="${f.activa === false ? 0 : 1}">${f.activa === false ? 'Reanudar' : 'Pausar'}</button> <button class="btn chico peligro" data-borrar="${f.id}">Quitar</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn chico" id="btnLeer" style="margin-top:12px">Revisar noticias ahora</button>` : vacio('Agrega la primera alerta de Google.') })}
    ${tarjeta({ clase: 'c12', titulo: 'Categorías de las noticias', nota: 'Con estas se mide qué domina los titulares',
      ayuda: 'La IA pone cada nota en una de estas categorías. Si las cambias, las notas se vuelven a clasificar poco a poco (usa un poco del presupuesto de IA). «Otros» siempre existe para lo que no encaja.',
      cuerpo: `<div class="mb">${cats.map(c => `<span class="chip info" style="margin:2px">${esc(c)}</span>`).join('')}<span class="chip neu" style="margin:2px">Otros</span></div>
        <label class="campo">Categorías separadas por coma<textarea id="txtCats" rows="3">${esc(cats.join(', '))}</textarea></label>
        <div class="linea sep"><button class="btn chico primario" id="btnCats">Guardar categorías</button><button class="btn chico" id="btnCatsFabrica">Volver a las de fábrica</button></div>` })}
  </div>`;
  const guardarCats = async (valor) => {
    if (!await confirmar('Cambiar categorías', 'Las notas se volverán a clasificar con las categorías nuevas (usa un poco del presupuesto de IA). ¿Seguir?', { texto: 'Guardar' })) return;
    try { await api('/api/ajustes', { metodo: 'PUT', cuerpo: { 'medios.categorias': valor } }); aviso('Categorías guardadas.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  };
  el.querySelector('#btnCats').onclick = () => guardarCats(el.querySelector('#txtCats').value.split(',').map(x => x.trim()).filter(Boolean).join(', '));
  el.querySelector('#btnCatsFabrica').onclick = () => guardarCats('');
  const f = el.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/fuentes', { metodo: 'POST', cuerpo: { nombre: f.nombre.value.trim(), url: f.url.value.trim(), entidad_id: f.entidad_id.value ? +f.entidad_id.value : null } }); aviso('Fuente agregada.'); ctx.re(); }
    catch (err) { aviso(err.message, 'error'); }
  };
  el.querySelectorAll('[data-pausar]').forEach(b => b.onclick = async () => {
    const fu = fuentes.find(x => x.id === +b.dataset.pausar);
    try { await api(`/api/fuentes/${fu.id}`, { metodo: 'PATCH', cuerpo: { activa: b.dataset.activa !== '1', entidad_id: fu.entidad_id } }); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  el.querySelectorAll('[data-borrar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('Quitar fuente', 'Las noticias ya guardadas se conservan.', { texto: 'Quitar', peligro: true })) return;
    try { await api(`/api/fuentes/${b.dataset.borrar}`, { metodo: 'DELETE' }); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  });
  const bl = el.querySelector('#btnLeer');
  if (bl) bl.onclick = async () => { bl.disabled = true; try { const r = await api('/api/alertas/refrescar', { metodo: 'POST' }); aviso(`${num(r.nuevas || 0)} noticias nuevas.`); ctx.re(); } catch (e) { aviso(e.message, 'error'); bl.disabled = false; } };
}

// ═════════ PERSONAJES (entidades) ═════════
async function vPersonajes(el, ctx) {
  const ents = await api('/api/entidades');
  el.innerHTML = `<div class="guia">Personajes e instituciones que se siguen (EMETRA, PMT, el gerente…). Se usan para decidir qué ve cada usuario: si a un usuario no se le marca un personaje, no ve comentarios, noticias ni fichas que lo mencionen.</div>
  ${tarjeta({ titulo: 'Personajes', acciones: '<button class="btn chico primario" id="btnNuevo">+ Agregar</button>', cuerpo: `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Nombre</th><th>Tipo</th><th>Cuentas</th><th>Palabras clave</th><th></th></tr></thead><tbody>
    ${ents.map(e => `<tr><td><b>${esc(e.nombre)}</b>${e.es_base ? ' <span class="chip">base</span>' : ''}</td><td>${esc(e.tipo || '')}</td><td class="nota">${esc(e.handles || '')}</td><td class="nota">${esc(e.keywords || '')}</td><td><button class="btn chico" data-editar="${e.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>` })}`;
  const form = (e) => {
    const v = ventana(e ? `Editar ${e.nombre}` : 'Agregar personaje', `<form class="form" id="f" style="grid-template-columns:1fr 1fr">
      <label class="campo">Nombre<input type="text" name="nombre" required value="${esc(e?.nombre || '')}"></label>
      <label class="campo">Tipo<input type="text" name="tipo" value="${esc(e?.tipo || 'Institución')}"></label>
      <label class="campo ancho">Cuentas en redes<input type="text" name="handles" value="${esc(e?.handles || '')}" placeholder="@cuenta, @otra"></label>
      <label class="campo ancho">Palabras clave<input type="text" name="keywords" value="${esc(e?.keywords || '')}" placeholder="Separadas por coma"></label></form>`,
      { pie: `${e ? '<button class="btn peligro a-izquierda" data-borrar>Quitar</button>' : ''}<button class="btn" data-no>Cancelar</button><button class="btn primario" data-si>Guardar</button>` });
    const f = v.cuerpo.querySelector('#f');
    v.pie.querySelector('[data-no]').onclick = v.cerrar;
    v.pie.querySelector('[data-si]').onclick = async () => {
      if (!f.reportValidity()) return;
      try { await api(e ? `/api/entidades/${e.id}` : '/api/entidades', { metodo: e ? 'PATCH' : 'POST', cuerpo: Object.fromEntries(new FormData(f)) }); v.cerrar(); aviso('Guardado.'); ctx.re(); } catch (err) { aviso(err.message, 'error'); }
    };
    const b = v.pie.querySelector('[data-borrar]');
    if (b) b.onclick = async () => {
      if (!await confirmar('Quitar personaje', `¿Quitar a ${esc(e.nombre)}? Los usuarios que lo tenían visible dejarán de tenerlo.`, { texto: 'Quitar', peligro: true })) return;
      try { await api(`/api/entidades/${e.id}`, { metodo: 'DELETE' }); v.cerrar(); ctx.re(); } catch (err) { aviso(err.message, 'error'); }
    };
  };
  el.querySelector('#btnNuevo').onclick = () => form(null);
  el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => form(ents.find(e => e.id === +b.dataset.editar)));
}

// ═════════ AUDITORÍA ═════════
async function vAuditoria(el, ctx) {
  const nomSec = (x) => { const [id, q] = String(x || '').split('?'); const t = ctx.secciones?.[id]?.t || id; return q ? `${t} (${q.replace('v=', '')})` : t; };
  const nomPag = (id) => (ctx.paginas || []).find(p => String(p.id) === String(id))?.nombre || (id ? 'Página ' + id : 'Principal');
  const [filas, vis] = await Promise.all([api('/api/auditoria', { params: { limite: 300 } }), api('/api/vistas').catch(() => ({ vistas: [], resumen: [] }))]);
  el.innerHTML = `<div class="rejilla">${tarjeta({ clase: 'c4', titulo: 'Uso del tablero', nota: 'Pantallas vistas por usuario en 30 días',
    ayuda: 'Cada vez que alguien abre una sección queda registrado (como mucho una vez por minuto por sección). Todos los usuarios aceptaron este registro en el acuerdo.',
    cuerpo: vis.resumen.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Usuario</th><th class="n">Vistas</th><th>Última</th></tr></thead><tbody>
      ${vis.resumen.map(r => `<tr><td>${esc(r.usuario)}</td><td class="n">${num(r.vistas)}</td><td class="nota">${haceCuanto(r.ultima)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin registros.') })}
  ${tarjeta({ clase: 'c8', titulo: 'Quién vio qué', nota: 'Últimas 500 pantallas abiertas', cuerpo: vis.vistas.length ? `<div class="tabla-caja desplazable bajo"><table class="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Sección</th><th>Página</th></tr></thead><tbody>
      ${vis.vistas.map(r => `<tr><td class="chica">${fecha(r.creado_en, true)}</td><td>${esc(r.usuario)}</td><td>${esc(nomSec(r.seccion))}</td><td class="nota">${esc(r.pagina === 'todas' ? 'Todas' : nomPag(r.pagina))}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin registros.') })}
  ${tarjeta({ clase: 'c12', titulo: 'Auditoría', nota: 'Quién hizo qué (últimas 300 acciones). No se puede borrar.', cuerpo: filas.length ? `<div class="tabla-caja desplazable"><table class="tabla"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
    ${filas.map(a => `<tr><td class="chica">${fecha(a.creado_en, true)}</td><td>${esc(a.usuario || '')}</td><td><span class="chip">${esc(String(a.etiqueta || '').replace(/[[\]]/g, ''))}</span></td><td>${esc(a.texto)}</td></tr>`).join('')}</tbody></table></div>` : vacio() })}</div>`;
}

// ═════════ AVISOS URGENTES (umbrales) ═════════
async function vAvisos(el, ctx) {
  const a = (await api('/api/ajustes')).avisos;
  el.innerHTML = `<div class="guia">Estos avisos llegan por Telegram a quienes tienen marcado «Avisos urgentes» o «Pico de quejas en una zona» (pestaña Telegram). Cada aviso se manda una sola vez.</div>
  <div class="rejilla">
    ${tarjeta({ clase: 'c6', titulo: 'Publicación que se incendia', ayuda: 'Se revisa cada 15 minutos. Si una publicación junta este número de comentarios en contra en su primera hora, se avisa de inmediato.',
      cuerpo: `<label class="campo">Comentarios en contra en la primera hora<input type="number" id="aIncendio" min="3" value="${a.incendio}"></label>` })}
    ${tarjeta({ clase: 'c6', titulo: 'Pico de quejas en una zona', ayuda: 'Se revisa cada hora. Si las quejas de una zona en 24 horas superan varias veces lo normal (y al menos el mínimo), se avisa al jefe de esa zona.',
      cuerpo: `<div class="form" style="grid-template-columns:1fr 1fr"><label class="campo">Veces lo normal<input type="number" id="aFactor" min="1.5" step="0.5" value="${a.picoFactor}"></label>
        <label class="campo">Mínimo de quejas en 24 h<input type="number" id="aMinimo" min="1" value="${a.picoMinimo}"></label></div>` })}
    ${tarjeta({ clase: 'c12', titulo: 'Palabras graves', ayuda: 'Si un comentario nuevo trae alguna de estas palabras, se avisa al momento (sin esperar a la IA). Se buscan sin importar acentos ni mayúsculas.',
      acciones: '<button class="btn chico" id="btnProbarPal">¿Cuántos avisos darían?</button>',
      cuerpo: `<label class="campo">Palabras separadas por coma<textarea id="aPalabras" rows="3">${esc(a.palabras || '')}</textarea></label>
        <div id="resPal" class="sep"></div>` })}
  </div>
  <div><button class="btn primario" id="btnAvisos">Guardar</button></div>`;
  // Prueba las palabras contra los comentarios de los últimos 30 días, antes de guardarlas
  el.querySelector('#btnProbarPal').onclick = async () => {
    const caja = el.querySelector('#resPal');
    caja.innerHTML = '<div class="cargando bloque"></div>';
    try {
      const r = await api('/api/avisos/probar', { params: { palabras: el.querySelector('#aPalabras').value } });
      const tono = r.porDia > 10 ? 'neg' : r.porDia > 3 ? 'ambar' : 'pos';
      caja.innerHTML = `<div class="guia">En los últimos 30 días, <b class="t-${tono}">${num(r.total)} comentarios</b> (unos ${num(r.porDia, 1)} al día) habrían disparado un aviso, de ${num(r.comentarios)} revisados.
        ${r.porDia > 10 ? ' Son muchos: considera quitar las palabras más comunes.' : ''}</div>
        ${r.palabras.length ? `<div class="linea">${r.palabras.map(p => `<span class="chip ${p.n / 30 > 3 ? 'ambar' : ''}">${esc(p.palabra)} · ${num(p.n)}</span>`).join('')}</div>` : ''}`;
    } catch (e) { caja.innerHTML = `<div class="vacio t-neg">⚠ ${esc(e.message)}</div>`; }
  };
  el.querySelector('#btnAvisos').onclick = async () => {
    const cuerpo = { 'avisos.incendio': el.querySelector('#aIncendio').value, 'avisos.pico_factor': el.querySelector('#aFactor').value,
      'avisos.pico_minimo': el.querySelector('#aMinimo').value, 'avisos.palabras': el.querySelector('#aPalabras').value.split(',').map(x => x.trim()).filter(Boolean).join(', ') };
    try { await api('/api/ajustes', { metodo: 'PUT', cuerpo }); aviso('Avisos guardados.'); ctx.re(); } catch (e) { aviso(e.message, 'error'); }
  };
}
