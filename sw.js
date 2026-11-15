// Service worker de CUSTODIA: después de la primera visita el juego funciona SIN INTERNET.
//  · Al instalarse guarda todos los archivos del juego (PRECACHE).
//  · Después usa «red primero»: si hay conexión siempre baja la versión más nueva (y la guarda); si no hay red, o la red tarda más de 4 s, usa lo guardado.
//  · Solo toca archivos de esta misma página. NASA DONKI, el servidor del cooperativo (la ruta /coop/…, no el archivo src/coop.js) y todo lo de otros sitios siguen yendo por la red.
// Si se agrega o quita un archivo del juego: actualizar PRECACHE (tests/offline.test.js lo comprueba) y subir el número de VERSION.
const VERSION = 'custodia-v14';
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'fonts/VT323-Regular.ttf',
  'audio/voz/ia-1-es.mp3',
  'audio/voz/ia-2-es.mp3',
  'audio/voz/ia-1-en.mp3',
  'audio/voz/ia-2-en.mp3',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/academia.js',
  'src/ambientes.js',
  'src/disposicion.js',
  'src/arte.js',
  'src/avisos.js',
  'src/certificado.js',
  'src/clima.js',
  'src/common.js',
  'src/coop.js',
  'src/coopui.js',
  'src/core.js',
  'src/cuerpos.js',
  'src/datos.js',
  'src/docente.js',
  'src/fx.js',
  'src/he.js',
  'src/i18n.js',
  'src/ia.js',
  'src/informe.js',
  'src/inicio.js',
  'src/link.js',
  'src/locs.js',
  'src/main.js',
  'src/meta.js',
  'src/music.js',
  'src/personajes.js',
  'src/quiz.js',
  'src/sistemas.js',
  'src/sonido.js',
  'src/story.js',
  'src/ui.js',
  'src/villains.js',
  'src/tutorial.js',
  'src/variedad.js',
  'src/voz.js',
];
const INICIO = new URL('./', self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || u.pathname.split('/').includes('coop')) return; // lo demás va por la red, como siempre
  e.respondWith(redPrimero(r));
});

async function redPrimero(r) {
  const c = await caches.open(VERSION); const clave = r.mode === 'navigate' ? INICIO : r; // todas las variantes (?boot, ?lang=en…) comparten la misma página guardada
  try {
    const resp = await Promise.race([fetch(r, { cache: 'no-cache' }), new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]);
    if (resp && resp.ok) c.put(clave, resp.clone());
    return resp;
  } catch {
    const guardado = await c.match(clave, { ignoreSearch: true });
    if (guardado) return guardado;
    return r.mode === 'navigate' ? (await c.match(INICIO)) ?? Response.error() : Response.error();
  }
}
