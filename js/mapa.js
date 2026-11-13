// ─── Mapa de Google (solo Ciudad de Guatemala) ───
// La llave de Maps la guarda el administrador en Ajustes; el navegador la pide al
// servidor. Se protege restringiéndola al dominio del tablero en Google Cloud.
// Nota: la "capa de calor" de Google quedó obsoleta, por eso la intensidad se
// dibuja con círculos de color y tamaño proporcional (funciona igual de bien).
import { api } from './api.js';
import { esc, COLOR } from './ui.js';

let promesa = null;
export function cargarGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(true);
  if (promesa) return promesa;
  promesa = (async () => {
    const { mapsKey } = await api('/api/config-publica');
    if (!mapsKey) throw new Error('SIN_LLAVE');
    await new Promise((ok, mal) => {
      window.__mapaListo = () => ok();
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&v=weekly&language=es&region=GT&callback=__mapaListo&loading=async`;
      s.async = true;
      s.onerror = () => mal(new Error('No se pudo cargar Google Maps. Revisa la llave en Ajustes.'));
      document.head.appendChild(s);
    });
    return true;
  })();
  promesa.catch(() => { promesa = null; });
  return promesa;
}

const ESTILO = [
  { elementType: 'geometry', stylers: [{ color: '#121a17' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1311' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8fa097' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2b3a33' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#a9b8b0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#16251c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2b26' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#121a17' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#26342d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33463d' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#c4d0c9' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1a24' }] },
];
const CENTRO = { lat: 14.6150, lng: -90.5200 };
const LIMITES = { north: 14.72, south: 14.50, west: -90.62, east: -90.40 };

// Color por intensidad relativa (0 a 1): pizarra → lima → ámbar → coral
function colorIntensidad(t) {
  if (t >= .75) return COLOR.negativo;
  if (t >= .5) return COLOR.ambar;
  if (t >= .25) return COLOR.lima;
  return '#5f88a8';
}

export class Mapa {
  constructor(contenedor) { this.cont = contenedor; this.capas = []; this.info = null; }

  async iniciar() {
    try { await cargarGoogleMaps(); }
    catch (e) {
      this.cont.innerHTML = e.message === 'SIN_LLAVE'
        ? `<div class="mapa-aviso"><b>Falta la llave de Google Maps</b><span>Un administrador debe agregarla en Ajustes → APIs.</span></div>`
        : `<div class="mapa-aviso">⚠ ${esc(e.message)}</div>`;
      return false;
    }
    this.mapa = new google.maps.Map(this.cont, {
      center: CENTRO, zoom: 12, minZoom: 11, maxZoom: 18, styles: ESTILO,
      restriction: { latLngBounds: LIMITES, strictBounds: false },
      mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false,
      gestureHandling: 'cooperative',
    });
    this.info = new google.maps.InfoWindow();
    this.mapa.addListener('zoom_changed', () => this.ajustarVisibilidad());
    return true;
  }

  limpiar() { for (const c of this.capas) c.obj.setMap(null); this.capas = []; }

  // puntos: [{lat,lng,total,titulo,detalle,nivel:'zona'|'colonia'|'punto', datos}]
  dibujar(puntos, { alClic } = {}) {
    if (!this.mapa) return;
    this.limpiar();
    const porNivel = { zona: [], colonia: [], punto: [], post: [] };
    puntos.forEach(p => (porNivel[p.nivel] || porNivel.punto).push(p));
    const radioBase = { zona: 900, colonia: 260, punto: 90, post: 70 };
    for (const [nivel, lista] of Object.entries(porNivel)) {
      if (!lista.length) continue;
      const max = Math.max(...lista.map(p => p.total || 1), 1);
      for (const p of lista) {
        if (p.lat == null || p.lng == null) continue;
        const t = (p.total || 1) / max;
        const color = p.color || colorIntensidad(t);
        const c = new google.maps.Circle({
          map: this.mapa, center: { lat: +p.lat, lng: +p.lng },
          radius: radioBase[nivel] * (0.55 + Math.sqrt(t)),
          fillColor: color, fillOpacity: nivel === 'zona' ? .22 + .3 * t : .45 + .3 * t,
          strokeColor: color, strokeOpacity: .9, strokeWeight: nivel === 'zona' ? 1 : 1.5, clickable: true, zIndex: { zona: 1, colonia: 2, punto: 3, post: 4 }[nivel],
        });
        c.addListener('click', (ev) => {
          this.info.setContent(`<div style="font-family:Montserrat,sans-serif;color:#111;max-width:260px"><b>${esc(p.titulo)}</b><br>${p.detalle || ''}</div>`);
          this.info.setPosition(ev.latLng); this.info.open(this.mapa);
          if (alClic) alClic(p);
        });
        this.capas.push({ obj: c, nivel });
      }
    }
    this.ajustarVisibilidad();
  }

  // Zonas de lejos, colonias al acercarse, direcciones exactas de cerca
  ajustarVisibilidad() {
    const z = this.mapa?.getZoom() || 12;
    for (const c of this.capas) {
      const visible = c.nivel === 'zona' ? z <= 14 : c.nivel === 'colonia' ? z >= 12 : z >= 13;
      c.obj.setVisible(visible);
    }
  }
}

