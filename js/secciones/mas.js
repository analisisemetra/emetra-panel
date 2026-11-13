// ─── Más: el resto de las herramientas, en tarjetas grandes fáciles de tocar ───
import { esc } from '../ui.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export async function montar(cont, ctx) {
  const ids = Object.keys(ctx.secciones).filter(k => ctx.secciones[k].g === 'mas' && !ctx.secciones[k].oculto && !(ctx.secciones[k].admin && !ctx.esAdmin));
  const comunes = ids.filter(k => !ctx.secciones[k].admin), admin = ids.filter(k => ctx.secciones[k].admin);
  const boton = (k) => { const s = ctx.secciones[k]; return `<a href="#${k}">${svg(ctx.iconos[k] || ctx.iconos.mas)}${esc(s.corto || s.t)}<span>${esc(s.desc || '')}</span></a>`; };
  cont.insertAdjacentHTML('beforeend', `
    <div class="menu-mas">${comunes.map(boton).join('')}</div>
    ${admin.length ? `<h3 class="rotulo sep-grande">ADMINISTRACIÓN</h3><div class="menu-mas">${admin.map(boton).join('')}</div>` : ''}
    <h3 class="rotulo sep-grande">MI CUENTA</h3>
    <div class="menu-mas"><a href="#" id="masCuenta">${svg('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6')}${esc(ctx.usuario.nombre)}<span>Apariencia, contraseña y salir</span></a></div>`);
  cont.querySelector('#masCuenta').onclick = (e) => { e.preventDefault(); ctx.abrirCuenta(); };
}
