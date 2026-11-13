// Permite instalar el tablero en el teléfono. Solo guarda la "cáscara" (páginas, estilos, íconos)
// para abrir rápido; los datos SIEMPRE se piden al servidor y nunca se guardan en el teléfono.
const VERSION = 'emetra-v4';
const CASCARA = ['./', 'index.html', 'css/estilos.css', 'js/app.js', 'js/api.js', 'js/ui.js', 'js/graficas.js', 'img/emetra-logo-blanco.svg', 'img/icono-192.png', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para tener siempre la versión nueva); si no hay internet, lo guardado
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // el servidor de datos no pasa por aquí
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
