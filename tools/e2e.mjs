// Prueba de extremo a extremo: abre el juego en un navegador real, empieza una partida en la Estación,
// usa el teclado, la pausa y la ayuda, avanza un día completo y revisa que nada se rompa.
//
// Playwright NO es dependencia del proyecto. Se instala una sola vez, sin tocar package.json:
//   npm i --no-save playwright
// Después:  npm run e2e
// Variables opcionales:
//   CHROME_PATH=/ruta/a/chrome   usar un Chrome concreto (si no, prueba el Chrome instalado y luego Chromium)
//   E2E_OUT=carpeta              dónde guardar las capturas (por defecto e2e-out/)
//   E2E_HEADED=1                 ver el navegador mientras corre
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const salida = resolve(process.env.E2E_OUT || join(raiz, 'e2e-out'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

let playwright;
try { playwright = await import('playwright'); } catch {
  console.error('Falta Playwright. Instálalo una vez con:  npm i --no-save playwright');
  process.exit(2);
}
const { chromium } = playwright.default ?? playwright;

// Servidor estático mínimo (los módulos ES no cargan con file://).
const servidor = http.createServer(async (req, res) => {
  try {
    const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
    const archivo = resolve(raiz, ruta);
    if (archivo !== raiz && !archivo.startsWith(raiz + sep)) throw new Error('fuera de la carpeta');
    const datos = await readFile(archivo);
    res.writeHead(200, { 'content-type': MIME[extname(archivo)] || 'application/octet-stream' });
    res.end(datos);
  } catch { res.writeHead(404); res.end('no encontrado'); }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/index.html`;
await mkdir(salida, { recursive: true });

async function abrirNavegador() {
  const opciones = { headless: !process.env.E2E_HEADED, args: ['--no-sandbox'] };
  if (process.env.CHROME_PATH) return chromium.launch({ ...opciones, executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch({ ...opciones, channel: 'chrome' }); } catch { return chromium.launch(opciones); }
}

const problemas = [];
let paso = 0;
const ok = (texto) => console.log(`✔ ${++paso}. ${texto}`);
let navegador;
let pagina;
let semilla = '?';

try {
  navegador = await abrirNavegador();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 760 } }); // contexto nuevo = sin partidas guardadas
  pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => problemas.push(`error de JavaScript: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`consola: ${m.text()}`); });
  // NASA DONKI puede responder 429 (llave de prueba agotada) o no responder: el juego usa llamaradas archivadas y lo avisa, no es un error.
  const externoNasa = (u) => /api\.nasa\.gov|ccmc\.gsfc\.nasa\.gov/.test(u);
  pagina.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico') && !externoNasa(r.url())) problemas.push(`${r.status()} al pedir ${r.url()}`); });

  // 1. Pantalla de título
  await pagina.goto(url);
  await pagina.waitForSelector('[data-loc="estacion"]', { timeout: 10000 });
  assert.equal(await pagina.locator('[data-loc]').count(), 3, 'deben verse los 3 destinos');
  assert.equal(await pagina.locator('#t-jugar').count(), 1, 'hay un solo botón principal: JUGAR');
  await pagina.screenshot({ path: join(salida, '1-titulo.png') });
  ok('la pantalla de título muestra los 3 destinos y un botón JUGAR');

  // 1b. Menú: elegir destino marca la tarjeta; el interruptor de reflejos y el botón JUGAR se ven sin hacer scroll
  const visible = (sel) => pagina.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }, sel);
  assert.ok(await visible('#t-jugar'), 'JUGAR debe verse completo sin hacer scroll (1280×760)');
  assert.equal(await pagina.getAttribute('[data-loc="estacion"]', 'aria-pressed'), 'true', 'la Estación empieza elegida');
  await pagina.click('[data-loc="luna"]'); await pagina.waitForSelector('[data-loc="luna"].sel', { timeout: 2000 });
  assert.equal(await pagina.locator('.tarjeta.sel').count(), 1, 'solo una tarjeta elegida');
  assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.dest')), 'luna');
  assert.match(await pagina.textContent('.tarjeta.sel'), /ELEGIDO/, 'la tarjeta elegida lo dice con texto, no solo con color');
  await pagina.click('[data-loc="estacion"]'); await pagina.waitForSelector('[data-loc="estacion"].sel');
  assert.equal(await pagina.getAttribute('#t-reflejos', 'aria-checked'), 'false');
  await pagina.click('#t-reflejos'); assert.equal(await pagina.getAttribute('#t-reflejos', 'aria-checked'), 'true'); assert.match(await pagina.textContent('#t-reflejos'), /SÍ/);
  await pagina.click('#t-reflejos'); assert.equal(await pagina.getAttribute('#t-reflejos', 'aria-checked'), 'false');
  assert.ok((await pagina.locator('#t-coop, #t-ayuda').count()) === 2, 'cooperativo y ayuda accesibles desde el título');
  await pagina.click('#t-ayuda'); await pagina.waitForSelector('#volver', { timeout: 2000 }); await pagina.click('#volver'); await pagina.waitForSelector('#t-jugar');
  ok('menú: elegir destino marca la tarjeta (con texto), REFLEJOS es un interruptor SÍ/NO, la ayuda se abre y vuelve');

  // 2. Empezar en la Estación
  await pagina.click('#t-jugar');
  await pagina.waitForSelector('#ok', { timeout: 5000 });
  await pagina.click('#ok');
  await pagina.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
  const inicio = await pagina.evaluate(() => ({ loc: lfr.s.loc, day: lfr.s.day, min: lfr.s.min, seed: lfr.s.seed }));
  semilla = inicio.seed;
  assert.equal(inicio.loc, 'estacion');
  assert.equal(inicio.day, 1);
  assert.match(await pagina.textContent('#dia'), /DÍA 1\/10/);
  ok(`la partida de la Estación empieza el día 1 (semilla ${semilla})`);

  // 3. El reloj avanza solo
  await pagina.waitForTimeout(1500);
  const minuto = await pagina.evaluate(() => lfr.s.min);
  assert.ok(minuto > inicio.min, `el reloj debe avanzar (${inicio.min} → ${minuto})`);
  assert.match(await pagina.textContent('#reloj'), /^\d\d:\d\d$/);
  ok('el reloj avanza y se ve en la barra');

  // 4. Teclado: moverse (se salta al bloque de trabajo, cuando el personaje está despierto)
  await pagina.evaluate(() => { while (lfr.s.min < 490) lfr.G.update(lfr.s, 0.05, { dx: 0, dy: 0, crouch: false }); lfr.s.pending = null; });
  await pagina.waitForTimeout(300);
  const antes = await pagina.evaluate(() => ({ x: lfr.s.p.x, y: lfr.s.p.y }));
  await pagina.keyboard.down('ArrowRight'); await pagina.waitForTimeout(700); await pagina.keyboard.up('ArrowRight');
  await pagina.keyboard.down('ArrowDown'); await pagina.waitForTimeout(500); await pagina.keyboard.up('ArrowDown');
  const despues = await pagina.evaluate(() => ({ x: lfr.s.p.x, y: lfr.s.p.y }));
  assert.ok(Math.hypot(despues.x - antes.x, despues.y - antes.y) > 0.3, `el personaje debe moverse con las flechas (${JSON.stringify(antes)} → ${JSON.stringify(despues)})`);
  ok('las flechas mueven al personaje');

  // 4b. Sistemas de la base: panel visible, mantenimiento con la tecla E y una emergencia de reflejos
  assert.equal(await pagina.locator('#sistemas').isHidden(), true, 'los paneles de tecla empiezan cerrados');
  await pagina.keyboard.press('1'); await pagina.waitForSelector('#sistemas:not([hidden])', { timeout: 2000 });
  const panel = await pagina.textContent('#ov-sis'); const lateral = await pagina.textContent('#sistemas');
  for (const n of ['SOPORTE VITAL', 'ENERGÍA', 'RADIACIÓN', 'COMIDA']) assert.ok(panel.includes(n), `el HUD debe mostrar ${n}`);
  assert.match(panel, /mSv/); assert.match(lateral, /600 mSv/, 'debe mostrar el dato real de la NASA');
  // todo cabe en pantalla: la página no hace scroll y el HUD queda dentro del mapa
  const ajuste = await pagina.evaluate(() => { const d = document.documentElement; const l = document.getElementById('lienzo').getBoundingClientRect(); const h = [...document.querySelectorAll('.hud > .caja, .hud-izq > .caja')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()); return { scroll: d.scrollHeight - innerHeight, dentro: h.every((r) => r.left >= l.left - 1 && r.right <= l.right + 1 && r.top >= l.top - 1 && r.bottom <= l.bottom + 1) }; });
  assert.ok(ajuste.scroll <= 1, `la página no debe hacer scroll (sobran ${ajuste.scroll}px)`); assert.ok(ajuste.dentro, 'el HUD debe quedar dentro de la ventana');
  assert.equal(await pagina.locator('#sis-tareas li:not(.enc)').count(), 4);
  // HUD claro: cada barra lleva ícono vectorial, número y marca de texto cuando algo va mal (no solo color)
  const nVit = await pagina.locator('#stats .vr').count(); assert.ok(nVit >= 4, `vitales: ${nVit} filas`);
  assert.equal(await pagina.locator('#stats .vr svg.ic use').count(), nVit, 'cada vital tiene su ícono');
  assert.ok((await pagina.locator('#ov-sis .vr svg.ic use').count()) === 4 && (await pagina.locator('#filas-ia .vr svg.ic use').count()) === 2, 'sistemas e IA con ícono');
  await pagina.evaluate(() => { lfr.s.p.salud = 20; }); await pagina.waitForTimeout(400);
  assert.ok(await pagina.locator('#stats .vr.est-bad').count() >= 1, 'una barra crítica se marca en rojo...');
  assert.match(await pagina.textContent('#stats .vr.est-bad .val'), /!!/, '...y con «!!» en el texto');
  assert.ok(/crítico/.test(await pagina.getAttribute('#stats .vr.est-bad', 'title')), '...y con una frase en el title');
  await pagina.evaluate(() => { lfr.s.p.salud = 100; lfr.s.p.hit = 0; }); await pagina.waitForTimeout(1800);
  // daño: la barra destella UNA vez y aparece «−N»; en modo suave solo queda el número, sin animación
  await pagina.evaluate(() => { lfr.s.p.salud -= 18; lfr.s.p.hit = 1; }); await pagina.waitForTimeout(250);
  assert.match(await pagina.textContent('#stats .vr:first-child .dmg'), /^−\d+$/, 'aparece «−N» junto a la barra de salud');
  assert.ok(await pagina.locator('#stats .vr:first-child.golpe').count(), 'la barra recibe la clase de destello');
  await pagina.waitForTimeout(1500);
  await pagina.evaluate(() => lfr.setFx('suave')); await pagina.waitForTimeout(100);
  await pagina.evaluate(() => { lfr.s.p.salud -= 12; }); await pagina.waitForTimeout(250);
  assert.ok(await pagina.locator('#stats .vr:first-child.golpe-est').count() && !(await pagina.locator('#stats .vr:first-child.golpe').count()), 'modo suave: sin destello ni sacudida, solo el número');
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.querySelector('#stats .vr:first-child .dmg')).animationName), 'none', 'modo suave: el número no se anima');
  await pagina.evaluate(() => { lfr.setFx('normal'); lfr.s.p.salud = 100; }); await pagina.waitForTimeout(1500);
  await pagina.keyboard.press('1'); assert.equal(await pagina.locator('#sistemas').isHidden(), true, 'la tecla 1 vuelve a cerrar el panel');
  ok('el HUD muestra los 4 medidores y la dosis sobre el mapa; la tecla 1 abre y cierra las 4 revisiones');

  // avisos flotantes: salen solos, y todo queda en el historial de la pausa
  await pagina.evaluate(() => lfr.G.say(lfr.s, 'Aviso de prueba e2e', 'bad')); await pagina.waitForTimeout(400);
  assert.ok((await pagina.textContent('#avisos')).includes('Aviso de prueba e2e'), 'el aviso debe verse flotando');
  await pagina.keyboard.press('Escape'); await pagina.waitForSelector('#pest', { timeout: 2000 });
  assert.ok((await pagina.textContent('#pest')).includes('Aviso de prueba e2e'), 'el historial de la pausa debe tener el aviso');
  await pagina.click('.pestanas [data-t=plan]'); assert.match(await pagina.textContent('#pest'), /Traje/); await pagina.keyboard.press('Escape');
  ok('los avisos aparecen flotando y el historial completo se ve al pulsar Esc');

  // limpieza visual: tope de avisos, nada repetido ni "solo registro", y letreros solo cuando hacen falta
  await pagina.evaluate(() => { const { G, s } = lfr; for (let i = 0; i < 14; i++) G.say(s, `Lluvia de avisos ${i}`, ['info', 'ok', 'warn', 'bad', 'ia'][i % 5]); G.say(s, 'Solo para el registro', 'warn', true); G.say(s, 'Repetido e2e', 'warn'); G.say(s, 'Repetido e2e', 'warn'); });
  let maxAvisos = 0; for (let i = 0; i < 8; i++) { await pagina.waitForTimeout(100); maxAvisos = Math.max(maxAvisos, await pagina.locator('#avisos li:not(.sale)').count()); }
  assert.ok(maxAvisos > 0 && maxAvisos <= 3, `nunca más de 3 avisos a la vez (hubo ${maxAvisos})`);
  assert.ok(!(await pagina.textContent('#avisos')).includes('Solo para el registro'), 'lo marcado "quiet" no sube a pantalla');
  assert.ok(((await pagina.textContent('#avisos')).match(/Repetido e2e/g) ?? []).length <= 1, 'un aviso repetido no se duplica');
  await pagina.waitForTimeout(3600); const etq = () => pagina.evaluate(() => Number(document.getElementById('lienzo').dataset.etq));
  assert.ok((await etq()) <= 2, `por defecto como mucho 2 letreros en el mundo (hay ${await etq()})`);
  await pagina.keyboard.press('n'); await pagina.waitForTimeout(300); const conN = await etq(); assert.ok(conN > 2, `con [N] se ven los nombres de las salas (hay ${conN})`);
  assert.ok(await pagina.locator('#btn-nombres.sel').count(), 'el botón [N] queda marcado');
  await pagina.keyboard.press('n'); await pagina.waitForTimeout(300); assert.ok((await etq()) <= 2, 'otra vez [N] los oculta');
  ok('los avisos nunca pasan de 3, no se repiten, y los nombres solo salen cuando hacen falta ([N] los muestra todos)');

  const irA = (id) => pagina.evaluate((sid) => { const { s, Sys } = lfr; s.crew.forEach((c) => { c.x = 3.5; c.y = 3.5; c.goal = null; c.path = null; }); const o = Sys.station(s, sid); s.p.x = o.x + 0.5; s.p.y = o.y + 0.5; s.p.inDuct = false; s.p.hidden = null; s.grace = 999; }, id);
  await irA('vida'); await pagina.waitForTimeout(200);
  await pagina.keyboard.press('e'); await pagina.waitForSelector('#pasos button', { timeout: 3000 });
  assert.equal(await pagina.locator('#pasos button').count(), 3, 'el mantenimiento es un mini-protocolo de 3 pasos');
  assert.ok((await pagina.textContent('#ventana')).includes('MANTENIMIENTO'), 'el título dice MANTENIMIENTO');
  // "AHORA NO": sin castigo y el panel sigue pendiente
  await pagina.click('#pc'); await pagina.waitForTimeout(300);
  assert.equal(await pagina.evaluate(() => !!lfr.s.sys.done.vida), false, 'cancelar no cuenta la revisión');
  await pagina.keyboard.press('e'); await pagina.waitForSelector('#pasos button', { timeout: 3000 });
  await pagina.click('#pasos button[data-i="1"]'); // un error: solo resta unos segundos
  for (const i of [0, 1, 2]) await pagina.click(`#pasos button[data-i="${i}"]`);
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.evaluate(() => !!lfr.s.sys.done.vida), true, 'la revisión del soporte vital debe quedar hecha al completar los 3 pasos');
  assert.equal(await pagina.locator('#sis-tareas li.ok').count(), 1);
  ok('mantenimiento: E sobre el panel abre un mini-protocolo de 3 pasos; AHORA NO no castiga; al completarlo se marca en la lista');

  await pagina.evaluate(() => { lfr.Sys.startEmergency(lfr.s, null, 'sobrecarga'); });
  await pagina.waitForSelector('#emerg:not([hidden])', { timeout: 2000 });
  assert.match(await pagina.textContent('#emerg'), /SOBRECARGA/);
  await pagina.screenshot({ path: join(salida, '2a-emergencia.png') });
  await irA('energia'); await pagina.waitForTimeout(200);
  await pagina.keyboard.press('e'); await pagina.waitForTimeout(2000);
  assert.deepEqual(await pagina.evaluate(() => [lfr.s.sys.emerg, lfr.s.sys.st.saved, !!lfr.s.over]), [null, 1, false], 'la emergencia debe quedar resuelta');
  await pagina.waitForSelector('#emerg[hidden]', { state: 'attached', timeout: 2000 });
  ok('reflejos: llegar al panel y pulsar E resuelve la emergencia a tiempo');

  // 4c. Efectos: modo suave (lfr.fx), hitstop, tope de partículas y costo por cuadro
  await pagina.evaluate(() => { const { s, A } = lfr; s.grace = 9999; for (let i = 0; i < 6; i++) A.burst(s.p.x, s.p.y, '255,150,80', 30); lfr.perf.reset(); });
  await pagina.waitForTimeout(1500);
  const costo = await pagina.evaluate(() => ({ avg: lfr.perf.avg, max: lfr.perf.max, n: lfr.perf.n, vivas: lfr.A.vivas() }));
  assert.ok(costo.n > 20, 'el dibujo debe correr'); assert.ok(costo.vivas <= 144, `nunca más de 144 partículas vivas (hay ${costo.vivas})`); assert.ok(costo.avg < 12, `el cuadro no debe costar más de 12 ms de media (${costo.avg.toFixed(1)} ms)`);
  const hs = await pagina.evaluate(async () => { const { s } = lfr; const m0 = s.min; s.stats.caught++; s.p.hit = 1; s.shake = 0.6; await new Promise((r) => setTimeout(r, 40)); const durante = s.min - m0; await new Promise((r) => setTimeout(r, 400)); return { durante, despues: s.min - m0 }; });
  assert.ok(hs.despues > hs.durante, 'tras el hitstop el juego sigue avanzando');
  assert.equal(await pagina.evaluate(() => lfr.fx.getFx()), 'normal');
  await pagina.evaluate(() => lfr.setFx('suave')); assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.fx')), 'suave', 'el modo suave se guarda en lfr.fx');
  await pagina.evaluate(() => { lfr.s.shake = 0.8; }); await pagina.waitForTimeout(150);
  await pagina.screenshot({ path: join(salida, '2b-modo-suave.png') });
  await pagina.evaluate(() => lfr.setFx('normal'));
  ok(`efectos: ${costo.vivas} partículas vivas como máximo, dibujo ${costo.avg.toFixed(1)} ms de media (máx. ${costo.max.toFixed(1)}), hitstop y modo suave (lfr.fx) funcionan`);

  // 5. Pausa y ayuda
  await pagina.keyboard.press('Escape');
  await pagina.waitForSelector('#modal:not([hidden])', { timeout: 2000 });
  assert.match(await pagina.textContent('#ventana'), /PAUSA/);
  for (const [id, txt] of [['sw-musica', /MÚSICA/], ['sw-sfx', /EFECTOS DE SONIDO/], ['sw-suave', /EFECTOS VISUALES SUAVES/], ['sw-nombres', /NOMBRES DE OBJETOS/]]) { assert.match(await pagina.textContent('#' + id), txt); assert.ok(['true', 'false'].includes(await pagina.getAttribute('#' + id, 'aria-checked'))); assert.match(await pagina.textContent('#' + id), /SÍ|NO/, 'cada interruptor dice SÍ o NO'); }
  assert.ok(await visible('#seguir'), 'SEGUIR se ve sin hacer scroll');
  await pagina.screenshot({ path: join(salida, '6-pausa.png') });
  // interruptores: cada uno cambia su estado, lo guarda y no cierra la pausa
  assert.equal(await pagina.getAttribute('#sw-sfx', 'aria-checked'), 'true'); await pagina.click('#sw-sfx');
  assert.equal(await pagina.getAttribute('#sw-sfx', 'aria-checked'), 'false'); assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.sfx')), '0', 'efectos de sonido: guardado');
  await pagina.click('#sw-sfx'); assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.sfx')), '1');
  assert.equal(await pagina.getAttribute('#sw-suave', 'aria-checked'), 'false'); await pagina.click('#sw-suave');
  assert.equal(await pagina.getAttribute('#sw-suave', 'aria-checked'), 'true'); assert.equal(await pagina.evaluate(() => [localStorage.getItem('lfr.fx'), document.body.classList.contains('suave')].join()), 'suave,true', 'efectos suaves: guardado y aplicado al CSS');
  await pagina.click('#sw-suave'); assert.equal(await pagina.evaluate(() => [localStorage.getItem('lfr.fx'), document.body.classList.contains('suave')].join()), 'normal,false');
  await pagina.click('#sw-musica'); assert.equal(await pagina.getAttribute('#sw-musica', 'aria-checked'), 'false'); assert.ok(await pagina.locator('#btn-musica.off').count(), 'la barra de arriba refleja la música apagada'); await pagina.click('#sw-musica');
  await pagina.click('#sw-nombres'); assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.nombres')), '1'); await pagina.click('#sw-nombres'); assert.equal(await pagina.evaluate(() => localStorage.getItem('lfr.nombres')), '0');
  const v0 = await pagina.textContent('#vol'); await pagina.click('#vmenos'); assert.notEqual(await pagina.textContent('#vol'), v0, 'el volumen cambia'); await pagina.click('#vmas');
  assert.ok(await pagina.locator('#modal:not([hidden])').count(), 'los interruptores no cierran la pausa');
  await pagina.keyboard.press('Escape');
  await pagina.waitForSelector('#modal[hidden]', { state: 'attached', timeout: 2000 });
  ok('Esc abre y cierra la pausa; sus interruptores (música, efectos de sonido, efectos suaves, nombres, volumen) cambian y se guardan');
  await pagina.click('#btn-ayuda');
  await pagina.waitForSelector('#modal:not([hidden])', { timeout: 2000 });
  await pagina.keyboard.press('Escape');
  await pagina.waitForSelector('#modal[hidden]', { state: 'attached', timeout: 2000 });
  ok('el botón de ayuda abre y se cierra con Esc');

  // 6. Un día completo sin tocar nada (jugada pasiva): nada debe romperse ni volverse NaN
  await pagina.screenshot({ path: join(salida, '2-jugando.png') });
  const dia = await pagina.evaluate(() => {
    const { s, G } = lfr; let pasos = 0; let respira = 0;
    while (s.day < 2 && !s.over && pasos < 40000) {
      if (s.pending) { if (s.pending.kind === 'respira') respira++; s.pending = null; }
      G.update(s, 0.05, { dx: 0, dy: 0, crouch: false }); pasos++;
    }
    const nums = [s.p.salud, s.p.energia, s.alert, s.integ, s.min, s.p.x, s.p.y];
    return { day: s.day, over: s.over ? { won: s.over.won, title: s.over.title } : null, pasos, respira, finitos: nums.every(Number.isFinite), alert: s.alert, integ: s.integ, salud: s.p.salud };
  });
  assert.ok(dia.finitos, `hay valores no numéricos en el estado: ${JSON.stringify(dia)}`);
  assert.ok(dia.over || dia.day === 2, `el día no terminó en ${dia.pasos} pasos: ${JSON.stringify(dia)}`);
  ok(dia.over ? `una jugada pasiva termina la partida en el día 1 («${dia.over.title}»)` : `un día completo pasivo se simula sin errores (${dia.pasos} pasos, alerta ${Math.round(dia.alert)}, integridad ${Math.round(dia.integ)})`);

  // 7. La pantalla refleja el nuevo estado
  await pagina.waitForTimeout(600);
  if (dia.over) {
    await pagina.waitForSelector('#modal:not([hidden])', { timeout: 3000 });
    ok('al terminar la partida aparece la pantalla final');
  } else {
    assert.match(await pagina.textContent('#dia'), /DÍA 2\/10/);
    { const dn = await pagina.textContent('#dia-nuevo'); assert.ok(await visible('#dia-nuevo'), 'el cartel del día nuevo se ve'); assert.ok(dn.includes('DÍA 2 de 10') && dn.includes('llega en 9 días') && dn.includes('ESPERANZA'), `cartel del día nuevo: ${dn}`); assert.equal(await pagina.evaluate(() => getComputedStyle(document.getElementById('dia-nuevo')).pointerEvents), 'none', 'el cartel no estorba los clics'); await pagina.screenshot({ path: join(salida, '3a-dia-nuevo.png') }); }
    ok('la barra de arriba pasa al día 2 y el cartel del día nuevo muestra la nave de rescate');
  }
  await pagina.screenshot({ path: join(salida, '3-despues-del-dia.png') });

  // 8. Reflejos: una emergencia ignorada mata (se hace al final, porque termina la partida)
  if (!dia.over) {
    await pagina.evaluate(() => { const { s, Sys, G } = lfr; s.pending = null; Sys.startEmergency(s, null, 'meteorito'); for (let i = 0; i < 4000 && !s.over; i++) G.update(s, 0.05, { dx: 0, dy: 0, crouch: false }); });
    await pagina.waitForSelector('#modal:not([hidden])', { timeout: 3000 });
    const fin = await pagina.textContent('#ventana');
    assert.match(fin, /Despresurización/); assert.match(fin, /MISIÓN PERDIDA/);
    assert.ok(fin.includes('BITÁCORA DE LA MISIÓN'), 'el final trae la bitácora causal'); assert.ok(await pagina.evaluate(() => document.querySelectorAll('#bitacora table tbody tr').length >= 6), 'tabla día por día: 4 sistemas, revisiones, tormenta y dosis');
    assert.match(fin, /QUÉ PASÓ/); assert.match(fin, /QUÉ APRENDER/); assert.match(fin, /REFLEJOS/, 'el final dice qué aprender de esta emergencia');
    assert.ok(await visible('#otra') && await visible('#menu'), 'REINTENTAR y MENÚ se ven sin hacer scroll'); assert.match(await pagina.textContent('#otra'), /REINTENTAR/);
    assert.ok(await pagina.evaluate(() => document.body.classList.contains('derrota')), 'al perder, la pantalla se desatura (body.derrota)'); assert.ok(/¿Sabías que…?/.test(fin), 'el final trae un consejo real');
    await pagina.screenshot({ path: join(salida, '4-emergencia-fatal.png') });
    // pregunta de cierre: la primera vez es la idea central (la dosis no se borra); responder muestra explicación y fuente y se guarda
    assert.ok(fin.includes('PREGUNTA DE CIERRE') && fin.includes('Estuviste afuera durante una tormenta solar'), 'el final trae la pregunta de la idea central');
    assert.equal(await pagina.locator('.quiz-op button').count(), 3);
    await pagina.locator('.quiz-op button', { hasText: 'No se borra' }).click(); await pagina.waitForSelector('#quiz-res .quiz-v.si', { timeout: 2000 });
    const qres = await pagina.textContent('#quiz-res'); assert.ok(qres.includes('¡Correcto!') && qres.includes('NASA-STD-3001') && qres.includes('1 de 1'), qres);
    assert.equal(await pagina.locator('.quiz-op button:disabled').count(), 3, 'tras responder no se puede cambiar');
    assert.deepEqual(await pagina.evaluate(() => JSON.parse(localStorage.getItem('lfr.meta')).quiz), { 'radiacion-suma': { ok: 1, mal: 0 } }, 'el resultado se guarda');
    await pagina.keyboard.press('r'); await pagina.waitForSelector('#ok', { timeout: 3000 }); assert.ok(!(await pagina.evaluate(() => document.body.classList.contains('derrota'))), 'R reintenta al instante y vuelve el color');
    ok('reflejos: si ignoras la emergencia, la partida termina con una explicación');
  }

  // 9. Responsive: tablet chica (1024×600) y teléfono acostado (812×375, táctil; en vertical el juego pide girarlo). Cada vista: título con JUGAR a la vista, HUD dentro de la ventana,
  //    nada tapa al jugador (que va SIEMPRE en el centro de la pantalla), botones táctiles ≥ 44 px, la pausa se ve completa. Capturas 7-*.png.
  for (const [ancho, alto, movil, nombre] of [[1024, 600, false, 'tablet'], [812, 375, true, 'movil']]) {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`${nombre}: consola: ${m.text()}`); });
    await pg.goto(url); await pg.waitForSelector('#t-jugar', { timeout: 10000 }); await pg.waitForTimeout(900); // la pantalla de título entra con una animación: se mide ya asentada (si no, el test salía a veces)
    const dentro = (sel) => pg.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; }, sel);
    assert.ok(await dentro('#t-jugar'), `${nombre}: JUGAR debe verse completo sin hacer scroll`);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('ventana').scrollWidth <= document.getElementById('ventana').clientWidth + 1), `${nombre}: el título no se desborda a los lados`);
    await pg.screenshot({ path: join(salida, `7-${nombre}-titulo.png`) });
    await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.screenshot({ path: join(salida, `7-${nombre}-intro.png`) });
    assert.ok(await dentro('#ok'), `${nombre}: EMPEZAR se ve sin hacer scroll`); await pg.click('#ok');
    await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
    await pg.evaluate(() => { while (lfr.s.min < 490) lfr.G.update(lfr.s, 0.05, { dx: 0, dy: 0, crouch: false }); lfr.s.pending = null; lfr.s.grace = 9999; lfr.G.say(lfr.s, 'Primer aviso', 'ok'); lfr.G.say(lfr.s, 'Segundo aviso importante', 'bad'); lfr.G.say(lfr.s, 'Tercer aviso', 'warn'); });
    await pg.keyboard.press('1'); await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => {
      const caja = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const vis = (q) => [...document.querySelectorAll(q)].filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden');
      const tapa = vis('.hud .caja, .barra, .hud-teclas button, #tactil button, .avisos li, .hud-inv');
      const cx = innerWidth / 2, cy = innerHeight / 2; const m = 18; // el sprite del jugador mide ~±18 px alrededor del centro
      const tapan = tapa.filter((e) => { const b = e.getBoundingClientRect(); return b.left < cx + m && b.right > cx - m && b.top < cy + m && b.bottom > cy - m; }).map((e) => e.id || e.className || e.tagName);
      const fuera = vis('.hud .caja, .barra').filter((e) => { const b = e.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1; }).map((e) => e.id || e.className);
      const chicos = vis('.barra button, #tactil button, .hud-teclas button').map((e) => ({ id: e.id || e.textContent.trim().slice(0, 12), ...caja(e) })).filter((b) => b.w < 43.5 || b.h < 43.5);
      return { tapan, fuera, chicos, scroll: document.documentElement.scrollWidth - innerWidth, tactil: !document.getElementById('tactil').hidden, zoom: lfr.zoom };
    });
    assert.deepEqual(r.tapan, [], `${nombre}: el HUD no debe tapar al jugador (centro de la pantalla): ${r.tapan}`);
    assert.deepEqual(r.fuera, [], `${nombre}: el HUD debe quedar dentro de la ventana: ${r.fuera}`);
    assert.ok(r.scroll <= 1, `${nombre}: sin scroll horizontal`);
    if (movil) { assert.ok(r.tactil, 'en el teléfono se ven los controles táctiles'); assert.deepEqual(r.chicos, [], `${nombre}: objetivos táctiles de al menos 44 px: ${JSON.stringify(r.chicos)}`); }
    if (movil) { // joystick FIJO abajo a la izquierda: siempre visible; la perilla no sale del círculo; mueve y al soltar se detiene
      const mov = await pg.evaluate(async () => { const cv = document.getElementById('lienzo'); lfr.s.p.sleep = false; lfr.s.grace = 9999; const j = document.getElementById('joy'); const jr = j.getBoundingClientRect(); const cx = jr.left + jr.width / 2, cy = jr.top + jr.height / 2; const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 5, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })); const vis = getComputedStyle(j).display !== 'none' && jr.width > 40; const x0 = lfr.s.p.x, y0 = lfr.s.p.y; ev('pointerdown', cx, cy); ev('pointermove', cx, cy + 250); const k = j.firstChild.getBoundingClientRect(); const dentro = Math.hypot(k.left + k.width / 2 - cx, k.top + k.height / 2 - cy) <= jr.width / 2 + 1; const activo = j.classList.contains('activo'); await new Promise((r) => setTimeout(r, 900)); const y1 = lfr.s.p.y; ev('pointerup', cx, cy + 250); const suelto = !j.classList.contains('activo'); await new Promise((r) => setTimeout(r, 150)); const y2 = lfr.s.p.y; await new Promise((r) => setTimeout(r, 300)); return { vis, dentro, activo, suelto, avanzo: y1 - y0, parado: Math.abs(lfr.s.p.y - y2) < 0.01, cruz: getComputedStyle(document.querySelector('.cruz')).display, usar: document.getElementById('t-e').textContent, agachar: document.getElementById('t-sh').textContent }; });
      assert.ok(mov.vis && mov.activo && mov.suelto, 'el joystick fijo se ve siempre, se ilumina al usarlo y se apaga al soltar'); assert.ok(mov.dentro, 'la perilla no sale del círculo aunque el dedo se aleje'); assert.ok(mov.avanzo > 0.3, `deslizar el dedo hacia abajo mueve al personaje hacia abajo (${mov.avanzo})`); assert.ok(mov.parado, 'al soltar el dedo el personaje se detiene'); assert.equal(mov.cruz, 'none', 'la cruz de flechas no se ve por defecto'); assert.ok(/USAR/.test(mov.usar) && /AGACHAR/.test(mov.agachar), `los botones dicen qué hacen: ${mov.usar} / ${mov.agachar}`);
    }
    { // guardia del HUD: si un panel cae encima del personaje, la cámara se corre y vuelve a verse (compu y celular)
      const g = await pg.evaluate(async () => { const p = lfr.s.p; const pos = () => ({ sx: (p.x * 16 - lfr.cam.x) * lfr.zoom, sy: ((p.y - 0.3) * 16 - lfr.cam.y) * lfr.zoom }); const a = pos(); const st = document.createElement('style'); st.textContent = `#c-vit{position:fixed!important;left:${a.sx - 60}px!important;top:${a.sy - 40}px!important;width:140px!important;height:90px!important;z-index:3}`; document.head.appendChild(st); await new Promise((r) => setTimeout(r, 2200)); const d = pos(); const r = document.getElementById('c-vit').getBoundingClientRect(); st.remove(); return { libre: d.sx < r.left || d.sx > r.right || d.sy < r.top - 20 || d.sy > r.bottom, d, r: [r.left, r.top, r.right, r.bottom] }; });
      assert.ok(g.libre, `${nombre}: un panel tapa al personaje y la cámara no lo corrió: ${JSON.stringify(g)}`);
    }
    await pg.screenshot({ path: join(salida, `7-${nombre}-juego.png`) });
    await pg.keyboard.press('1'); await pg.click('#btn-menu'); await pg.waitForSelector('#seguir', { timeout: 2000 });
    assert.ok(await dentro('#seguir'), `${nombre}: SEGUIR se ve sin hacer scroll`); await pg.screenshot({ path: join(salida, `7-${nombre}-pausa.png`) });
    const sw = await pg.evaluate(() => [...document.querySelectorAll('#ventana .sw')].map((e) => e.getBoundingClientRect().height)); assert.ok(sw.length >= 4 && sw.every((h) => h >= 43.5), `${nombre}: 4 (o 5, con la voz) interruptores de pausa con altura táctil (${sw})`);
    await pg.click('#seguir'); await c.close();
  }
  ok('responsive (1024×600 y 812×375 táctil): JUGAR visible, HUD dentro de la ventana, nada tapa al jugador, botones táctiles ≥ 44 px, pausa completa');

  // 9b. TABLET (siempre horizontal): en vertical se pide girar (teléfono y tablet; la compu con mouse no); en horizontal NADA se solapa (ni entre sí ni con el jugador, que va en el centro),
  //     joystick y botones quedan a ≥ 24 px del borde, todo botón mide ≥ 44 px y el mapa abierto esconde todos los botones salvo ✕ CERRAR MAPA. Cada tamaño × (botones | rueda | cruz) × estados. Capturas 7t-*.png.
  {
    const UA_TAB = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    { // vertical: aviso de girar en tablet y en teléfono; sin aviso en la compu con mouse
      for (const [ancho, alto, tactil, nombre] of [[810, 1080, true, 'tablet'], [390, 844, true, 'teléfono'], [810, 1080, false, 'compu']]) {
        const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(tactil ? { isMobile: true, hasTouch: true, userAgent: UA_TAB } : {}) }); const pg = await c.newPage();
        await pg.goto(url); await pg.waitForSelector('#t-jugar', { timeout: 10000 }); await pg.waitForTimeout(300);
        const d = await pg.evaluate(() => getComputedStyle(document.getElementById('girar')).display);
        assert.equal(d !== 'none', tactil, `${nombre} en vertical: el aviso de girar ${tactil ? 'debe verse' : 'no debe verse'} (display=${d})`); await c.close();
      }
    }
    const MARGEN = 24;
    const medir = (pg) => pg.evaluate((MARGEN) => {
      const W = innerWidth, H = innerHeight; const vis = (e) => { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const it = []; const add = (n, e, t) => { if (!vis(e)) return; const r = e.getBoundingClientRect(); let tp = r.top, b = r.bottom; const pc = e.closest('.hud-centro'); if (pc && pc !== e && getComputedStyle(pc).overflow === 'hidden') { const q = pc.getBoundingClientRect(); tp = Math.max(tp, q.top); b = Math.min(b, q.bottom); if (b <= tp) return; } it.push({ n: n, t, l: r.left, r: r.right, tp, b }); };
      document.querySelectorAll('.barra button, .barra .chip, .barra #rev').forEach((e) => add('barra:' + (e.id || e.className.split(' ')[0] || e.tagName), e, 'barra'));
      document.querySelectorAll('.hud-izq .caja').forEach((e, i) => add('izq' + i, e, 'panel'));
      document.querySelectorAll('.hud-centro #actividad, .hud-centro #emerg, .hud-centro .avisos li').forEach((e, i) => add('centro:' + (e.id || 'aviso' + i), e, 'panel'));
      document.querySelectorAll('.hud-der .caja').forEach((e, i) => add('der:' + (e.id || i), e, 'panel'));
      document.querySelectorAll('.hud-crew .caja').forEach((e) => add('tripulación', e, 'panel')); document.querySelectorAll('.hud-inv .caja').forEach((e) => add('mochila', e, 'panel'));
      document.querySelectorAll('.hud-teclas button').forEach((e) => add('atajo:' + (e.id || e.textContent.trim()), e, 'boton')); document.querySelectorAll('#tactil button').forEach((e, i) => add('tactil:' + (e.id || e.dataset.d || i), e, 'boton'));
      const j = document.getElementById('joy'); if (j) add('joystick', j, 'joy');
      if (!document.body.classList.contains('mapa-on')) { const k = lfr.zoom + 1; it.push({ n: 'minimapa', t: 'panel', l: W - lfr.s.L.W * k - 14, r: W - 6, tp: 56, b: 60 + lfr.s.L.H * k + 4 }); }
      it.push({ n: 'JUGADOR', t: 'jugador', l: W / 2 - 22, r: W / 2 + 22, tp: H / 2 - 40, b: H / 2 + 14 });
      const sol = []; for (let i = 0; i < it.length; i++) for (let k = i + 1; k < it.length; k++) { const a = it[i], c = it[k]; if (a.t === 'barra' && c.t === 'barra') continue; if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 3 && Math.min(a.b, c.b) - Math.max(a.tp, c.tp) > 3) sol.push(`${a.n} × ${c.n}`); }
      const bordes = it.filter((x) => (x.t === 'boton' || x.t === 'joy') && !x.n.startsWith('barra')).map((x) => ({ n: x.n, m: Math.round(Math.min(x.l, W - x.r, H - x.b)) })).filter((x) => x.m < MARGEN);
      const chicos = [...document.querySelectorAll('.barra button, #tactil button, .hud-teclas button, #btn-cerrar-mapa')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return `${e.id || e.textContent.trim().slice(0, 10)} ${Math.round(r.width)}×${Math.round(r.height)}`; }).filter((t) => { const [w, h] = t.split(' ').pop().split('×').map(Number); return w < 43.5 || h < 43.5; });
      const botonesMapa = document.body.classList.contains('mapa-on') ? [...document.querySelectorAll('button')].filter(vis).map((e) => e.id || e.textContent.trim().slice(0, 12)) : [];
      return { sol, bordes, chicos, botonesMapa };
    }, MARGEN);
    for (const [ancho, alto] of [[960, 600], [1133, 744], [1194, 834]]) for (const modo of ['botones', 'rueda', 'cruz']) {
      const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.5, userAgent: UA_TAB });
      await c.addInitScript((m) => { try { localStorage.setItem('lfr.rueda', m === 'rueda' ? '1' : '0'); localStorage.setItem('lfr.cruz', m === 'cruz' ? '1' : '0'); localStorage.setItem('lfr.joyhint', '1'); } catch { /* nada */ } }, modo);
      const pg = await c.newPage(); pg.on('pageerror', (e) => problemas.push(`tablet ${ancho}×${alto}: error de JavaScript: ${e.message}`));
      await pg.goto(url); await pg.waitForSelector('#t-jugar', { timeout: 10000 }); await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok');
      await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
      assert.ok(await pg.evaluate(() => document.body.classList.contains('tablet') && !document.body.classList.contains('telefono')), `${ancho}×${alto}: debe contar como tablet`);
      await pg.evaluate(() => { while (lfr.s.min < 490) lfr.G.update(lfr.s, 0.05, { dx: 0, dy: 0, crouch: false }); lfr.s.pending = null; lfr.s.grace = 9999; lfr.G.say(lfr.s, 'Primer aviso', 'ok'); lfr.G.say(lfr.s, 'Segundo aviso importante', 'bad'); });
      const revisa = async (estado) => { await pg.waitForTimeout(450); const r = await pg.evaluate(() => 0); void r; const m = await medir(pg); const et = `tablet ${ancho}×${alto} ${modo} ${estado}`;
        assert.deepEqual(m.sol, [], `${et}: se solapan ${m.sol}`); assert.deepEqual(m.bordes, [], `${et}: controles a menos de ${MARGEN} px del borde: ${JSON.stringify(m.bordes)}`); assert.deepEqual(m.chicos, [], `${et}: botones menores de 44 px: ${m.chicos}`);
        return m; };
      await revisa('base');
      await pg.keyboard.press('1'); await revisa('panel 1'); await pg.keyboard.press('1');
      await pg.evaluate(() => { const { s, Sys, G } = lfr; Sys.startEmergency(s, null, 'meteorito'); s.grace = 9999; for (let i = 0; i < 40; i++) G.update(s, 0.05, { dx: 0, dy: 0, crouch: false }); }); await revisa('emergencia');
      await pg.evaluate(() => { const { s, Sys } = lfr; s.sys.emerg = null; s.pending = null; Object.assign(s.p, { ...((r) => ({ x: r.x + Math.floor(r.w / 2) + 0.5, y: r.y + Math.floor(r.h / 2) + 0.5 }))(s.L.rooms.find((q) => q.id === 'comedor')) }); Sys.startStorm(s); s.grace = 9999; }); await revisa('tormenta');
      await pg.evaluate(() => { lfr.s.sys.storm = null; });
      await pg.keyboard.press('Tab'); await pg.waitForTimeout(400); const mm = await revisa('mapa');
      assert.deepEqual(mm.botonesMapa, ['btn-cerrar-mapa'], `${ancho}×${alto} ${modo}: con el mapa abierto solo debe verse ✕ CERRAR MAPA (se ve: ${mm.botonesMapa})`);
      const area = await pg.evaluate(() => { const L = lfr.s.L; const cw = innerWidth, ch = innerHeight; const izq = Math.min(300, Math.round(cw * 0.27)); const k = Math.max(3, Math.min(((cw - izq) * 0.96) / L.W, (ch - 62 - 14) / L.H)); return (L.W * k * L.H * k) / (cw * ch); });
      assert.ok(area > 0.5, `${ancho}×${alto}: el mapa debe ocupar más de la mitad de la pantalla (ocupa ${(area * 100).toFixed(0)} %)`);
      if (modo === 'botones' && ancho === 1133) await pg.screenshot({ path: join(salida, '7t-tablet-mapa.png') });
      await pg.click('#btn-cerrar-mapa'); await pg.waitForTimeout(200); assert.ok(await pg.evaluate(() => !document.body.classList.contains('mapa-on')), 'el botón ✕ CERRAR MAPA cierra el mapa');
      if (modo === 'botones' && ancho === 1133) await pg.screenshot({ path: join(salida, '7t-tablet-juego.png') });
      await c.close();
    }
  }
  ok('tablet (960×600, 1133×744, 1194×834 × botones | rueda | cruz): vertical pide girar; nada se solapa ni toca al jugador, controles a ≥ 24 px del borde, botones ≥ 44 px, mapa grande con solo ✕ CERRAR MAPA');

  // 9c. TELÉFONO (acostado, con la barra del navegador: alturas reales de 320 a 412 px): NADA se solapa (ni entre sí ni con el jugador), joystick, cruceta y USAR quedan a ≥ 24 px del borde,
  //     todo botón mide ≥ 44 px y el mapa abierto muestra solo ✕ CERRAR MAPA. Cada tamaño × (joystick | cruceta) × estados. Capturas 7p-*.png.
  {
    const UA_TEL = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    const MARGEN = 24;
    const medir = (pg) => pg.evaluate((MARGEN) => {
      const W = innerWidth, H = innerHeight; const vis = (e) => { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const it = []; const add = (n, e, t) => { if (!vis(e)) return; const r = e.getBoundingClientRect(); let tp = r.top, b = r.bottom; const pc = e.closest('.hud-centro, .hud-der'); if (pc && pc !== e && ['hidden', 'auto', 'scroll'].includes(getComputedStyle(pc).overflowY)) { const q = pc.getBoundingClientRect(); tp = Math.max(tp, q.top); b = Math.min(b, q.bottom); if (b <= tp) return; } it.push({ n: n, t, l: r.left, r: r.right, tp, b }); };
      document.querySelectorAll('.barra button, .barra .chip, .barra #rev').forEach((e) => add('barra:' + (e.id || e.className.split(' ')[0] || e.tagName), e, 'barra'));
      document.querySelectorAll('.hud-izq').forEach((e, i) => add('izq' + i, e, 'panel'));
      document.querySelectorAll('.hud-centro #actividad, .hud-centro #emerg, .hud-centro .avisos li').forEach((e, i) => add('centro:' + (e.id || 'aviso' + i), e, 'panel'));
      document.querySelectorAll('.hud-der .caja').forEach((e, i) => add('der:' + (e.id || i), e, 'panel'));
      document.querySelectorAll('.hud-crew .caja').forEach((e) => add('tripulación', e, 'panel')); document.querySelectorAll('.hud-inv .caja').forEach((e) => add('mochila', e, 'panel'));
      document.querySelectorAll('.hud-teclas button').forEach((e) => add('atajo:' + (e.id || e.textContent.trim()), e, 'boton')); document.querySelectorAll('#tactil button').forEach((e, i) => add('tactil:' + (e.id || e.dataset.d || i), e, 'boton'));
      const j = document.getElementById('joy'); if (j) add('joystick', j, 'joy');
      if (!document.body.classList.contains('mapa-on')) { const k = (W <= 600 || H <= 520) ? 1.5 : lfr.zoom + 1; it.push({ n: 'minimapa', t: 'panel', l: W - lfr.s.L.W * k - 14, r: W - 6, tp: 4, b: 8 + lfr.s.L.H * k + 4 }); }
      it.push({ n: 'JUGADOR', t: 'jugador', l: W / 2 - 22, r: W / 2 + 22, tp: H / 2 - 40, b: H / 2 + 14 });
      const sol = []; for (let i = 0; i < it.length; i++) for (let k = i + 1; k < it.length; k++) { const a = it[i], c = it[k]; if (a.t === 'barra' && c.t === 'barra') continue; if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 3 && Math.min(a.b, c.b) - Math.max(a.tp, c.tp) > 3) sol.push(`${a.n} × ${c.n}`); }
      const bordes = it.filter((x) => (x.t === 'boton' || x.t === 'joy') && !x.n.startsWith('barra')).map((x) => ({ n: x.n, m: Math.round(Math.min(x.l, W - x.r, H - x.b)) })).filter((x) => x.m < MARGEN);
      const chicos = [...document.querySelectorAll('.barra button, #tactil button, .hud-teclas button, #btn-cerrar-mapa')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return `${e.id || e.textContent.trim().slice(0, 10)} ${Math.round(r.width)}×${Math.round(r.height)}`; }).filter((t) => { const [w, h] = t.split(' ').pop().split('×').map(Number); return w < 43.5 || h < 43.5; });
      const botonesMapa = document.body.classList.contains('mapa-on') ? [...document.querySelectorAll('button')].filter(vis).map((e) => e.id || e.textContent.trim().slice(0, 12)) : [];
      return { sol, bordes, chicos, botonesMapa };
    }, MARGEN);
    for (const [ancho, alto] of [[568, 320], [640, 360], [750, 338], [844, 342], [932, 350], [915, 412]]) for (const modo of ['rueda', 'cruz']) {
      const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.5, userAgent: UA_TEL });
      await c.addInitScript((m) => { try { localStorage.setItem('lfr.cruz', m === 'cruz' ? '1' : '0'); localStorage.setItem('lfr.joyhint', '1'); } catch { /* nada */ } }, modo);
      const pg = await c.newPage(); pg.on('pageerror', (e) => problemas.push(`teléfono ${ancho}×${alto}: error de JavaScript: ${e.message}`));
      await pg.goto(url); await pg.waitForSelector('#t-jugar', { timeout: 10000 }); await pg.waitForTimeout(900);
      if (ancho === 568) { // título: las tres misiones se ven y JUGAR no las tapa
        const t = await pg.evaluate(() => { const j = document.getElementById('t-jugar').getBoundingClientRect(); const ts = [...document.querySelectorAll('.tarjeta')].map((e) => e.getBoundingClientRect()); return { jt: j.top, filas: Math.max(...ts.map((r) => r.top)) - Math.min(...ts.map((r) => r.top)) < 8 ? 1 : 2, fondo: Math.max(...ts.map((r) => r.bottom)) }; });
        assert.equal(t.filas, 1, 'teléfono 568×320: las 3 misiones van en una fila'); assert.ok(t.fondo <= t.jt + 2, `teléfono 568×320: JUGAR (${Math.round(t.jt)}) no debe tapar las misiones (terminan en ${Math.round(t.fondo)})`);
        await pg.screenshot({ path: join(salida, '7p-telefono-titulo.png') });
      }
      await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok');
      await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
      assert.ok(await pg.evaluate(() => document.body.classList.contains('telefono')), `${ancho}×${alto}: debe contar como teléfono`);
      await pg.evaluate(() => { while (lfr.s.min < 490) lfr.G.update(lfr.s, 0.05, { dx: 0, dy: 0, crouch: false }); lfr.s.pending = null; lfr.s.grace = 9999; lfr.G.say(lfr.s, 'Primer aviso', 'ok'); lfr.G.say(lfr.s, 'Segundo aviso importante', 'bad'); });
      const revisa = async (estado) => { await pg.waitForTimeout(450); const m = await medir(pg); const et = `teléfono ${ancho}×${alto} ${modo} ${estado}`;
        assert.deepEqual(m.sol, [], `${et}: se solapan ${m.sol}`); assert.deepEqual(m.bordes, [], `${et}: controles a menos de ${MARGEN} px del borde: ${JSON.stringify(m.bordes)}`); assert.deepEqual(m.chicos, [], `${et}: botones menores de 44 px: ${m.chicos}`);
        return m; };
      await revisa('base');
      for (const k of ['1', '2', '3', '4']) { await pg.keyboard.press(k); await revisa('panel ' + k); await pg.keyboard.press(k); }
      await pg.evaluate(() => { const { s, Sys, G } = lfr; Sys.startEmergency(s, null, 'meteorito'); s.grace = 9999; for (let i = 0; i < 40; i++) G.update(s, 0.05, { dx: 0, dy: 0, crouch: false }); }); await revisa('emergencia');
      await pg.evaluate(() => { const { s, Sys } = lfr; s.sys.emerg = null; s.pending = null; Object.assign(s.p, { ...((r) => ({ x: r.x + Math.floor(r.w / 2) + 0.5, y: r.y + Math.floor(r.h / 2) + 0.5 }))(s.L.rooms.find((q) => q.id === 'comedor')) }); Sys.startStorm(s); s.grace = 9999; }); await revisa('tormenta');
      await pg.evaluate(() => { lfr.s.sys.storm = null; });
      await pg.keyboard.press('Tab'); await pg.waitForTimeout(400); const mm = await revisa('mapa');
      assert.deepEqual(mm.botonesMapa, ['btn-cerrar-mapa'], `${ancho}×${alto} ${modo}: con el mapa abierto solo debe verse ✕ CERRAR MAPA (se ve: ${mm.botonesMapa})`);
      if (modo === 'rueda' && ancho === 750) await pg.screenshot({ path: join(salida, '7p-telefono-mapa.png') });
      await pg.click('#btn-cerrar-mapa'); await pg.waitForTimeout(200); assert.ok(await pg.evaluate(() => !document.body.classList.contains('mapa-on')), 'el botón ✕ CERRAR MAPA cierra el mapa');
      if (modo === 'rueda' && ancho === 750) await pg.screenshot({ path: join(salida, '7p-telefono-juego.png') });
      await c.close();
    }
  }
  ok('teléfono (568×320 … 932×350, 915×412 × joystick | cruceta): nada se solapa ni toca al jugador, controles a ≥ 24 px del borde, botones ≥ 44 px, título con las 3 misiones visibles, mapa con solo ✕ CERRAR MAPA');

  // 10. Inglés para el jurado: ?lang=en, selector ES/EN en el título (se guarda), DATOS NASA, intro, mantenimiento, tormenta y final en inglés.
  {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 760 } }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`inglés: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`inglés: consola: ${m.text()}`); });
    await pg.goto(`${url}?lang=en`); await pg.waitForSelector('#t-jugar', { timeout: 10000 });
    let tit = await pg.textContent('#ventana');
    for (const frag of ['Did you know…?', 'CHOOSE YOUR DESTINATION', 'ASTRONAUT CADET TRAINING', 'STATION', 'AI: CUSTODIA', 'NASA DATA', 'HOW TO PLAY', 'DAILY CHALLENGE']) assert.ok(tit.includes(frag), `el título en inglés debe decir "${frag}"`);
    assert.match(await pg.textContent('#t-jugar'), /PLAY|NEW GAME/); assert.equal(await pg.getAttribute('[data-lang="en"]', 'aria-pressed'), 'true');
    assert.ok(!tit.includes('ELIGE TU DESTINO'), 'en inglés no queda el título en español');
    await pg.screenshot({ path: join(salida, '8-ingles-titulo.png') });
    // el selector cambia de idioma y se recuerda al recargar sin ?lang
    await pg.click('[data-lang="es"]'); await pg.waitForSelector('#t-jugar'); assert.ok((await pg.textContent('#ventana')).includes('ELIGE TU DESTINO'));
    await pg.click('[data-lang="en"]'); await pg.waitForSelector('#t-jugar'); await pg.reload(); await pg.waitForSelector('#t-jugar');
    assert.ok((await pg.textContent('#ventana')).includes('CHOOSE YOUR DESTINATION'), 'el idioma elegido se recuerda al recargar');
    // DATOS NASA en inglés
    await pg.click('#t-datos'); await pg.waitForSelector('.pant-datos, #ventana .datos-lista');
    const dat = await pg.textContent('#ventana');
    for (const frag of ['NASA DATA', 'The real constraint the game teaches', 'Radiation measured for real', 'Space weather', 'NASA DONKI', '600 mSv', 'OSD-340', 'Game scale (not real data)', 'api.nasa.gov key']) assert.ok(dat.includes(frag), `DATOS NASA en inglés debe decir "${frag}"`);
    assert.ok(!/La restricción real|Radiación medida/.test(dat), 'DATOS NASA no queda en español');
    await pg.screenshot({ path: join(salida, '8-ingles-datos.png') });
    // terminal: botones, comandos escritos, atajos 1–6 y mensaje de error
    const vis = () => pg.evaluate(() => [...document.querySelectorAll('.dt-sec')].filter((x) => !x.hidden).map((x) => x.dataset.sec));
    assert.deepEqual(await vis(), ['restriccion'], 'al abrir se ve solo la restricción real'); assert.match(await pg.textContent('.term-cab'), /NASA TERMINAL/);
    await pg.click('[data-sec="salud"]'); assert.deepEqual(await vis(), ['salud']); assert.match(await pg.textContent('.dt-sec[data-sec="salud"]:not([hidden])'), /OSD-342/); assert.ok((await pg.textContent('#term-ps')).includes('custodia@nasa:~$ ver health'));
    await pg.fill('#term-cmd', 'weather'); await pg.keyboard.press('Enter'); assert.deepEqual(await vis(), ['clima']); assert.match(await pg.textContent('.dt-sec[data-sec="clima"]:not([hidden])'), /DONKI/);
    await pg.screenshot({ path: join(salida, '8-ingles-datos-clima.png') });
    await pg.fill('#term-cmd', 'zzz'); await pg.keyboard.press('Enter'); assert.match(await pg.textContent('#term-msg'), /command not recognized: "zzz"/); assert.deepEqual(await vis(), ['clima'], 'un comando raro no cambia la sección');
    await pg.fill('#term-cmd', 'help'); await pg.keyboard.press('Enter'); assert.match(await pg.textContent('#term-msg'), /Commands: 1=constraint/);
    await pg.click('#ventana h2'); await pg.keyboard.press('3'); assert.deepEqual(await vis(), ['radiacion'], 'la tecla 3 abre radiación'); assert.match(await pg.textContent('.dt-sec[data-sec="radiacion"]:not([hidden])'), /600 mSv/);
    await pg.click('#ok'); await pg.waitForSelector('#t-jugar');
    // intro y partida
    await pg.click('#t-jugar'); await pg.waitForSelector('#ok');
    const intro = await pg.textContent('#ventana');
    for (const frag of ['STATION', 'DAY 1', 'FOLLOW THE ROUTINE', 'DODGE THE AI', 'CARE FOR THE BASE', 'keep the base alive']) assert.ok(intro.includes(frag), `la intro en inglés debe decir "${frag}"`);
    await pg.screenshot({ path: join(salida, '8-ingles-intro.png') }); await pg.click('#ok');
    await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
    // el HUD también habla inglés
    const vit = await pg.textContent('#c-vit'); assert.ok(vit.includes('YOU') && vit.includes('HEALTH') && vit.includes('ENERGY'), `HUD de vitales en inglés: ${vit}`);
    const barra = await pg.textContent('#teclas'); assert.ok(/Craft/.test(barra) && /Threats/.test(barra) && /Upkeep/.test(barra), `botones de paneles en inglés: ${barra}`);
    assert.match(await pg.textContent('#dia'), /DAY 1\/10/); assert.match(await pg.textContent('#t-alerta'), /SURVEILLANCE/);
    await pg.keyboard.press('Escape'); await pg.waitForSelector('#seguir', { timeout: 2000 }); const paus = await pg.textContent('#ventana');
    for (const frag of ['PAUSE', 'RESUME', 'SETTINGS', 'SOUND EFFECTS', 'SOFT VISUAL EFFECTS', 'VOLUME', 'HISTORY', 'MAINTENANCE', 'RETURN PLAN']) assert.ok(paus.includes(frag), `la pausa en inglés debe decir "${frag}"`);
    await pg.click('[data-t="crew"]'); const tri = await pg.textContent('#pest'); for (const frag of ['María', 'Commander', 'Calm and protective', 'Easy, cadet. One step at a time.', 'Kenji', 'Engineer', 'Joker and curious']) assert.ok(tri.includes(frag), `la ficha de la tripulación en inglés debe decir "${frag}"`);
    await pg.click('#seguir'); await pg.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 2000 });
    // mantenimiento: mini-protocolo en inglés
    await pg.evaluate(() => { const { s, Sys } = lfr; s.min = 500; s.crew.forEach((q) => { q.x = 3.5; q.y = 3.5; q.goal = null; q.path = null; }); const o = Sys.station(s, 'vida'); Object.assign(s.p, { x: o.x + 0.5, y: o.y + 0.5, inDuct: false, hidden: null }); s.grace = 9999; });
    await pg.waitForTimeout(200); await pg.keyboard.press('e'); await pg.waitForSelector('#pasos button', { timeout: 3000 });
    const mini = await pg.textContent('#ventana');
    for (const frag of ['MAINTENANCE · life support', 'Tap the steps', 'Measure the CO₂ in the air', 'NOT NOW', 'Educational fiction']) assert.ok(mini.includes(frag), `el mantenimiento en inglés debe decir "${frag}"`);
    await pg.click('#pc'); await pg.waitForTimeout(300);
    // mochila, fabricar y archivo en inglés (nada de español)
    await pg.keyboard.press('i'); await pg.waitForSelector('#archivo', { timeout: 3000 });
    const bolsa = await pg.textContent('#ventana'); for (const frag of ['BACKPACK', 'IN YOUR HIDING PLACE', 'ESCAPE ROUTES', 'RETURN PLAN', 'VIEW ARCHIVE']) assert.ok(bolsa.includes(frag), `la mochila en inglés debe decir "${frag}"`);
    await pg.click('#archivo'); await pg.waitForSelector('#volver'); const arch = await pg.textContent('#ventana'); for (const frag of ['ARCHIVE', 'in some drawer']) assert.ok(arch.includes(frag), `el archivo en inglés debe decir "${frag}"`);
    assert.ok(!/ARCHIVO|algún cajón|VOLVER/.test(arch), 'el archivo no queda en español');
    await pg.click('#volver'); await pg.waitForSelector('#cerrar'); await pg.click('#cerrar');
    await pg.keyboard.press('c'); await pg.waitForSelector('.recetas', { timeout: 3000 }); const fab = await pg.textContent('#ventana'); assert.ok(fab.includes('CRAFT') && fab.includes('MAKE') && !/FABRICAR|HACER/.test(fab), `fabricar en inglés: ${fab.slice(0, 80)}`); await pg.click('#cerrar');
    assert.match(await pg.textContent('.hud-crew'), /happy|asks for/, 'la tripulación del HUD en inglés');
    // tormenta solar: cartel del HUD en inglés
    await pg.evaluate(() => { const { s, Sys } = lfr; Object.assign(s.p, { ...((r) => ({ x: r.x + Math.floor(r.w / 2) + 0.5, y: r.y + Math.floor(r.h / 2) + 0.5 }))(s.L.rooms.find((q) => q.id === 'comedor')) }); Sys.startStorm(s); s.grace = 9999; });
    await pg.waitForFunction(() => /SOLAR STORM 1\/3/.test(document.getElementById('emerg')?.textContent ?? ''), null, { timeout: 4000 });
    const hud = await pg.textContent('#emerg'); assert.match(hud, /class X|class M|class C/); assert.match(hud, /Shelter|shelter/); assert.match(hud, /arrive in/);
    await pg.screenshot({ path: join(salida, '8-ingles-tormenta.png') });
    // final: el rescate llega
    await pg.evaluate(() => { lfr.s.sys.storm = null; lfr.G.rescue(lfr.s); });
    await pg.waitForSelector('.fin', { timeout: 4000 }); const fin = await pg.textContent('#ventana');
    for (const frag of ['YOU MADE IT HOME!', 'Rescue: mission accomplished', 'WHAT HAPPENED', 'WHAT TO LEARN', 'YOUR STARS', 'The rescue ship arrived', 'POINTS', 'PLAY AGAIN', 'MENU']) assert.ok(fin.includes(frag), `el final en inglés debe decir "${frag}"`);
    assert.ok(!/QUÉ PASÓ|QUÉ APRENDER|VOLVISTE|BITÁCORA/.test(fin), 'el final no queda en español'); assert.ok(fin.includes('MISSION LOG'), 'la bitácora sale en inglés');
    assert.ok(fin.includes('CLOSING QUESTION'), 'la pregunta de cierre también sale en inglés');
    await pg.keyboard.press('1'); await pg.waitForSelector('#quiz-res .quiz-v', { timeout: 2000 }); const qen = await pg.textContent('#quiz-res'); assert.ok(/Correct!|Not quite/.test(qen) && qen.includes('Source:') && qen.includes('COPY MY RESULT'), qen);
    await pg.screenshot({ path: join(salida, '8-ingles-final.png') }); await c.close();
    ok('inglés: ?lang=en y el selector ES/EN (se recuerda) traducen el título, DATOS NASA, la intro, el mantenimiento, el cartel de la tormenta y el final');
  }

  // 10b. Arranque dramático «CUSTODIA OS»: pantalla negra, una tecla enciende, se escribe, se puede saltar y no arranca el juego; en «reducir movimiento» aparece completo.
  for (const [reducido, nombre] of [[false, 'normal'], [true, 'suave']]) {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 760 }, reducedMotion: reducido ? 'reduce' : 'no-preference' }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`arranque: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`arranque: consola: ${m.text()}`); });
    await pg.goto(`${url}?boot`); await pg.waitForSelector('#arranque', { timeout: 10000 });
    assert.match(await pg.textContent('#arranque'), /PULSA UNA TECLA PARA ENCENDER/); await pg.screenshot({ path: join(salida, `10-arranque-${nombre}-0.png`) });
    await pg.keyboard.press('Enter'); // Enter enciende (y NO empieza la partida)
    if (reducido) { await pg.waitForFunction(() => /MANTÉN VIVA LA BASE/.test(document.getElementById('boot-txt')?.textContent ?? ''), null, { timeout: 2000 }); }
    else { await pg.waitForFunction(() => /CUSTODIA OS/.test(document.getElementById('boot-txt')?.textContent ?? ''), null, { timeout: 3000 }); await pg.waitForFunction(() => /SEÑAL PERDIDA/.test(document.getElementById('boot-txt')?.textContent ?? ''), null, { timeout: 6000 }); await pg.screenshot({ path: join(salida, '10-arranque-normal-1.png') }); await pg.keyboard.press('Space'); await pg.waitForFunction(() => /MANTÉN VIVA LA BASE/.test(document.getElementById('boot-txt')?.textContent ?? ''), null, { timeout: 1500 }); }
    await pg.screenshot({ path: join(salida, `10-arranque-${nombre}-2.png`) });
    await pg.waitForFunction(() => !document.getElementById('arranque'), null, { timeout: 7000 });
    assert.ok(await pg.evaluate(() => !!document.getElementById('t-jugar') && !window.lfr?.s?.day), 'después del arranque queda el título; el Enter no empezó la partida');
    await c.close();
  }
  ok('arranque dramático: pantalla negra → una tecla enciende → se escribe la historia (señal perdida, la IA, rescate en 10 días) → se salta con otra tecla → título; en «reducir movimiento» sale completo y sin sacudida');

  // 10c. Sin internet: el service worker guarda el juego; con la red cortada la página recarga, se puede jugar y DATOS NASA usa las llamaradas archivadas.
  {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 760 }, serviceWorkers: 'allow' }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`sin internet: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text() + m.location().url)) problemas.push(`sin internet: consola: ${m.text()}`); });
    await pg.goto(`${url}?sw`); await pg.waitForSelector('#t-jugar', { timeout: 10000 });
    await pg.waitForFunction(() => /Listo para jugar sin internet/.test(document.getElementById('t-offline')?.textContent ?? ''), null, { timeout: 20000 });
    const guardados = await pg.evaluate(async () => { const [nombre] = (await caches.keys()).filter((k) => k.startsWith('custodia-')); return nombre ? (await (await caches.open(nombre)).keys()).length : 0; }); assert.ok(guardados >= 30, `el service worker guardó ${guardados} archivos (esperaba ≥ 30)`);
    await c.setOffline(true); await pg.reload(); await pg.waitForSelector('#t-jugar', { timeout: 10000 });
    assert.ok((await pg.textContent('#ventana')).includes('CUSTODIA'), 'sin internet carga el título');
    await pg.click('#t-datos'); await pg.waitForSelector('.term'); await pg.fill('#term-cmd', 'clima'); await pg.keyboard.press('Enter');
    assert.match(await pg.textContent('.term-est'), /ARCHIVO/, 'sin internet DATOS NASA usa las llamaradas archivadas'); await pg.click('#ok'); await pg.waitForSelector('#t-jugar');
    await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok'); await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 8000 });
    const dia = await pg.evaluate(() => { const { s, G } = lfr; s.grace = 9999; for (let i = 0; i < 400; i++) G.update(s, 0.05, { dx: 0, dy: 0 }); return s.min; });
    assert.ok(dia > 340, 'sin internet el juego avanza'); await pg.screenshot({ path: join(salida, '10-sin-internet.png') });
    await c.setOffline(false); await c.close();
  }
  ok('sin internet: el service worker guarda el juego (≥ 30 archivos), con la red cortada la página recarga, se puede jugar y DATOS NASA usa las llamaradas archivadas');

  // 10d. Leer en voz alta (con una síntesis de voz simulada para poder comprobar qué se lee): botón LEER/PARAR, idioma, ajuste automático y avisos importantes.
  {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 760 } }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`voz: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`voz: consola: ${m.text()}`); });
    await pg.addInitScript(() => {
      window.__voz = []; window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      const s = { speaking: false, speak(u) { window.__voz.push({ text: u.text, lang: u.lang, rate: u.rate, voz: u.voice?.name ?? null }); this.ultima = u; }, cancel() { this.ultima = null; window.__vozCancel = (window.__vozCancel ?? 0) + 1; }, getVoices: () => [{ name: 'Voz es', lang: 'es-ES', localService: true }, { name: 'Voice en', lang: 'en-US', localService: true }] };
      Object.defineProperty(window, 'speechSynthesis', { value: s, configurable: true });
    });
    await pg.goto(`${url}?noboot`); await pg.waitForSelector('#t-jugar'); assert.equal(await pg.locator('.btn-leer').count(), 0, 'el título no lleva botón de leer');
    await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); assert.equal(await pg.locator('.btn-leer').count(), 1, 'la intro trae el botón LEER');
    await pg.click('.btn-leer'); const l1 = await pg.evaluate(() => window.__voz.at(-1)); assert.ok(l1 && /Mantén viva la base/.test(l1.text), `lee la intro (dijo: ${JSON.stringify(l1)})`);
    assert.equal(l1.lang, 'es-ES'); assert.equal(l1.voz, 'Voz es'); assert.ok(!/EMPEZAR|CONTROLES|<|undefined/.test(l1.text), `no lee botones ni etiquetas: ${l1.text.slice(0, 120)}`);
    assert.match(await pg.textContent('.btn-leer'), /PARAR/); await pg.click('.btn-leer'); assert.match(await pg.textContent('.btn-leer'), /LEER/); assert.ok(await pg.evaluate(() => window.__vozCancel >= 1), 'PARAR cancela la voz');
    // ajuste: leer solo (ventanas importantes y avisos)
    await pg.click('#ok'); await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden); await pg.keyboard.press('Escape'); await pg.waitForSelector('#sw-voz'); await pg.click('#sw-voz');
    assert.equal(await pg.evaluate(() => localStorage.getItem('lfr.voz')), '1'); await pg.click('#seguir'); await pg.waitForFunction(() => document.getElementById('modal').hidden);
    const n0 = await pg.evaluate(() => window.__voz.length); await pg.evaluate(() => { const { s, G } = lfr; s.grace = 9999; G.say(s, '¡Alerta de prueba: fuga en el módulo!', 'bad'); G.say(s, 'Dato de relleno', 'info'); });
    await pg.waitForFunction((n) => window.__voz.length > n, n0, { timeout: 3000 }); const hablados = await pg.evaluate((n) => window.__voz.slice(n).map((x) => x.text), n0);
    assert.ok(hablados.some((t) => /Alerta de prueba/.test(t)), 'los avisos importantes se leen solos'); assert.ok(!hablados.some((t) => /relleno/.test(t)), 'los avisos menores no');
    // en inglés la voz y el botón cambian
    await pg.evaluate(() => { localStorage.setItem('lfr.lang', 'en'); }); await pg.goto(`${url}?noboot&lang=en`); await pg.waitForSelector('#t-jugar'); await pg.click('#t-jugar'); await pg.waitForSelector('#ok');
    await pg.waitForFunction(() => window.__voz.some((x) => x.lang === 'en-US' && /Keep the base alive/.test(x.text)), null, { timeout: 3000 }); // con el ajuste activo la intro se lee sola
    assert.match(await pg.textContent('.btn-leer'), /STOP|READ/); await c.close();
  }
  ok('leer en voz alta: botón LEER/PARAR en las ventanas (no en el título), lee sin botones ni etiquetas con la voz del idioma, el ajuste lee solo la intro y los avisos importantes, y en inglés usa la voz en-US');

  // 11. Reto del día con la llamarada real del día: la intro la anuncia, llega a la hora marcada y el resumen cuenta qué pasó.
  {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 760 } }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`reto: error de JavaScript: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + m.location().url)) problemas.push(`reto: consola: ${m.text()}`); });
    await pg.goto(url); await pg.waitForSelector('#t-reto', { timeout: 10000 }); await pg.click('#t-reto'); await pg.waitForSelector('#ok');
    const intro = await pg.textContent('#ventana'); assert.match(intro, /Llamarada del día:.*clase X\d\.\d/); assert.match(intro, /refugio.*seguir escapando/);
    await pg.screenshot({ path: join(salida, '9-reto-intro.png') }); await pg.click('#ok');
    await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden, null, { timeout: 5000 });
    const f = await pg.evaluate(() => { const { s, G } = lfr; s.grace = 9999; const d = s.dFlare; const h = G.spawnFlare(s); return { cls: d.flare.cls, min: d.min, kind: h.kind, safe: h.def.safe, t: h.t, hit: h.def.hit, ia: s.log.some((l) => /30 s/.test(l.text)) }; });
    assert.match(f.cls, /^X/); assert.ok(f.min >= 1380 && f.min < 1560); assert.equal(f.kind, 'llamarada'); assert.ok(f.safe.length === 1 && f.t > 29 && f.hit >= 5 && f.ia, 'la llamarada avisa 30 s y marca un refugio');
    await pg.waitForTimeout(600); await pg.screenshot({ path: join(salida, '9-reto-llamarada.png') });
    const fin = await pg.evaluate(() => { const { s, G } = lfr; const r = s.L.rooms.find((x) => x.id === lfr.Sys.shelterOf(s).room); Object.assign(s.p, { x: r.x + r.w / 2, y: r.y + r.h / 2, inDuct: false, hidden: null }); for (let t = 0; t < 31; t += 0.05) G.update(s, 0.05, { dx: 0, dy: 0 }); return s.dFlare.result; });
    assert.equal(fin, 'refugio'); await c.close();
    ok('reto del día: la intro anuncia la llamarada real del día, llega con un aviso de 30 s y refugiarse cuenta como resuelto');
  }

  assert.deepEqual(problemas, [], `errores durante la prueba:\n  - ${problemas.join('\n  - ')}`);
  // 12. Entrenamiento de la BASE (compu y celular acostado): 6 pasos con tarjeta y flecha, SIN botón SALTAR (barras, panel, revisión, mapa,
  //     tormenta, finales; moverse/agacharse/esconderse los enseña la Academia); termina con la ventana de finales y la bienvenida.
  for (const [ancho, alto, movil, nombre] of [[1280, 760, false, 'tutorial compu'], [812, 375, true, 'tutorial celular']]) {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
    await pg.goto(`${url}?tuto&noboot`); await pg.waitForSelector('#t-jugar'); await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok');
    await pg.waitForSelector('#tuto:not([hidden])', { timeout: 5000 });
    const card = async () => pg.textContent('#tuto'); const paso = async (n) => pg.waitForFunction((n) => document.getElementById('tuto').textContent.includes(`· ${n}/6`), n, { timeout: 6000 });
    const toca = (id) => pg.evaluate((id) => document.getElementById(id).click(), id); // botones que en el teléfono viven en la rueda (ocultos)
    let tx = await card(); assert.ok(tx.includes('1/6') && tx.includes('TUS BARRAS'), `${nombre}: paso 1 → ${tx}`);
    assert.equal(await pg.$('#tuto-salta'), null, `${nombre}: no hay botón SALTAR`);
    assert.ok(await pg.evaluate(() => { const r = document.getElementById('tuto').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight; }), `${nombre}: la tarjeta cabe en la pantalla`);
    await pg.screenshot({ path: join(salida, `tutorial-${movil ? 'celular' : 'compu'}-1.png`) });
    await pg.evaluate(() => { const s = lfr.s; s.hazards = []; s.events = []; s.drones = []; s.grace = 9999; s.p.sleep = false; });
    await pg.click('#tuto-ok'); await paso(2); assert.ok(await pg.evaluate(() => lfr.s.min >= 479), `${nombre}: el reloj avanza al turno de trabajo`);
    await pg.evaluate(() => { const s = lfr.s; const o = lfr.Sys.station(s, 'vida'); Object.assign(s.p, { x: o.x + 0.5, y: o.y + 1.4 }); s.grace = 9999; }); await paso(3);
    await pg.screenshot({ path: join(salida, `tutorial-${movil ? 'celular' : 'compu'}-3.png`) });
    if (movil) await pg.click('#t-e'); else await pg.keyboard.press('e'); await pg.waitForSelector('#pasos button', { timeout: 4000 });
    for (let i = 0; i < 3; i++) await pg.click(`#pasos button[data-i="${i}"]`); await paso(4);
    tx = await card(); assert.ok(movil ? /minimapa/.test(tx) : /Tab/.test(tx), `${nombre}: el paso del mapa es de ${movil ? 'celular' : 'compu'}: ${tx}`);
    // 4 · abrir el mapa (Tab en compu; botón MAPA de la rueda en el teléfono) y cerrarlo
    if (movil) await toca('t-m'); else await pg.keyboard.press('Tab'); await paso(5);
    if (movil) await toca('t-m'); else await pg.keyboard.press('Tab');
    await pg.click('#tuto-ok'); // 5 · el Sol real
    await pg.waitForSelector('#tuto-fin', { timeout: 4000 }); const fines = await pg.textContent('#ventana');
    assert.ok(/ENTRENAMIENTO COMPLETO/.test(fines) && /FINALES SECRETOS/.test(fines) && (fines.match(/\?\?\?/g) ?? []).length >= 3, `${nombre}: la ventana final muestra los finales: ${fines.slice(0, 120)}`);
    await pg.keyboard.press('Escape'); assert.equal(await pg.evaluate(() => !document.getElementById('modal').hidden), true, `${nombre}: Esc no la cierra`);
    await pg.screenshot({ path: join(salida, `tutorial-${movil ? 'celular' : 'compu'}-finales.png`) });
    await pg.click('#tuto-fin'); await pg.waitForFunction(() => localStorage.getItem('lfr.tuto') === '1' && document.getElementById('modal').hidden, null, { timeout: 4000 });
    assert.ok(await pg.evaluate(() => lfr.s.log.some((l) => /Bienvenido/.test(l.text))), `${nombre}: da la bienvenida a la misión`);
    await pg.goto(`${url}?tuto&noboot`); await pg.waitForSelector('#t-jugar'); await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok'); await pg.waitForTimeout(600);
    assert.equal(await pg.evaluate(() => document.getElementById('tuto').hidden), true, `${nombre}: no vuelve a salir solo`);
    await pg.evaluate(() => { try { lfr.s && (lfr.s.over = null); } catch { /* nada */ } }); await c.close();
  }
  ok('entrenamiento de la base (compu y celular): 6 pasos sin SALTAR (barras, panel, revisión, mapa, tormenta, finales), se completa con las acciones reales, termina con los finales y no vuelve solo');

  // 13. Certificado de Cadete al ganar (compu y celular): nombre, vista previa, descarga con nombre de archivo seguro y la tecla R no reinicia al escribir.
  for (const [ancho, alto, movil, nombre] of [[1280, 760, false, 'certificado compu'], [812, 375, true, 'certificado celular']]) {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true, ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
    await pg.goto(`${url}?noboot`); await pg.waitForSelector('#t-jugar'); await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok'); await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden);
    await pg.evaluate(() => { lfr.s.sys.storm = null; lfr.G.rescue(lfr.s); }); await pg.waitForSelector('#certif', { timeout: 5000 });
    const puntos0 = await pg.evaluate(() => JSON.parse(localStorage.getItem('lfr.meta') || '{}').pts);
    await pg.click('#certif'); await pg.waitForSelector('#cert-lienzo'); await pg.fill('#cert-nombre', ''); await pg.type('#cert-nombre', 'Ruth');
    assert.equal(await pg.inputValue('#cert-nombre'), 'Ruth', `${nombre}: se puede escribir una R sin reiniciar la partida`); assert.ok(await pg.evaluate(() => !!lfr.s.over && !!document.querySelector('.fin')), `${nombre}: el final sigue ahí`);
    assert.ok(await pg.evaluate(() => { const g = document.getElementById('cert-lienzo').getContext('2d'); const d = g.getImageData(0, 0, 1200, 850).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 120 || d[i + 1] > 120) n++; return n > 40; }), `${nombre}: el certificado se dibuja`);
    assert.ok(await pg.evaluate(() => { const r = document.querySelector('.cert-ventana').getBoundingClientRect(); const q = document.getElementById('cert-lienzo').getBoundingClientRect(); return q.width <= innerWidth && r.left >= -1 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }), `${nombre}: cabe en la pantalla`);
    if (movil) assert.ok(await pg.evaluate(() => [...document.querySelectorAll('#cert-modal button, #cert-nombre')].every((b) => b.getBoundingClientRect().height >= 43.5)), `${nombre}: botones táctiles ≥ 44 px`);
    await pg.screenshot({ path: join(salida, `certificado-${movil ? 'celular' : 'compu'}.png`) });
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }), pg.click('#cert-bajar')]); assert.equal(dl.suggestedFilename(), 'certificado-custodia-ruth.png', `${nombre}: nombre de archivo`);
    await pg.click('#cert-volver'); await pg.waitForSelector('#cert-modal', { state: 'detached' }); assert.ok(await pg.evaluate(() => !!document.querySelector('.fin')), `${nombre}: vuelve al final`);
    assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem('lfr.meta') || '{}').pts), puntos0, `${nombre}: abrir el certificado no da puntos otra vez`);
    await c.close();
  }
  ok('certificado de cadete (compu y celular): se dibuja con el nombre, se descarga con nombre seguro, cabe en la pantalla, la R no reinicia y no repite puntos');

  // 14. Modo clase y panel docente (compu y celular): el alumno copia su línea y el docente la pega y ve el resumen.
  for (const [ancho, alto, movil, nombre] of [[1280, 760, false, 'docente compu'], [812, 375, true, 'docente celular']]) {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, permissions: ['clipboard-read', 'clipboard-write'], ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
    await pg.goto(`${url}?noboot`); await pg.waitForSelector('#t-jugar'); await pg.click('#t-mas summary'); await pg.click('#t-clase'); await pg.waitForSelector('#cl-nombre');
    await pg.fill('#cl-nombre', 'Ana'); await pg.fill('#cl-clase', '5b'); await pg.click('#cl-guardar'); await pg.waitForSelector('#t-clase');
    assert.ok((await pg.textContent('#t-clase')).includes('5B'), `${nombre}: el título muestra la clase`);
    await pg.click('#t-jugar'); await pg.waitForSelector('#ok'); await pg.click('#ok'); await pg.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden);
    await pg.evaluate(() => { lfr.s.sys.storm = null; lfr.G.rescue(lfr.s); }); await pg.waitForSelector('#copia-clase', { timeout: 5000 });
    await pg.click('.quiz-op button'); await pg.waitForSelector('#quiz-res .quiz-v'); await pg.click('#copia-clase');
    const linea = await pg.evaluate(() => navigator.clipboard.readText()); assert.match(linea, /^CUSTODIA1|5B|Ana|d{4}-d{2}-d{2}|estacion|cadete|1|3|d+|d+|radiacion-suma|[01]$/, `${nombre}: la línea → ${linea}`);
    await pg.click('#menu'); await pg.waitForSelector('#t-mas summary'); if (!(await pg.evaluate(() => document.getElementById('t-mas').open))) await pg.click('#t-mas summary'); await pg.click('#t-docente'); await pg.waitForSelector('#dc-texto');
    await pg.fill('#dc-texto', `Hola profe
${linea}
[10:31] Leo: CUSTODIA1|5B|Leo|2026-11-15|luna|normal|0|0|40|55|alara|0
${linea}
basura`); await pg.click('#dc-analiza'); await pg.waitForSelector('.doc-tabla');
    const res = await pg.textContent('#dc-res'); assert.ok(res.includes('2') && /partidas leídas/.test(res) && /1 repetidas ignoradas/.test(res) && res.includes('Ana') && res.includes('Leo') && res.includes('5B'), `${nombre}: resumen → ${res.slice(0, 200)}`);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('#dc-res button, #dc-analiza')].every((b) => b.getBoundingClientRect().height >= 43.5)), `${nombre}: sin desborde y botones ≥ 44 px`);
    await pg.screenshot({ path: join(salida, `docente-${movil ? 'celular' : 'compu'}.png`) });
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }), pg.click('#dc-baja')]); assert.equal(dl.suggestedFilename(), 'resultados-custodia.csv', `${nombre}: CSV`);
    await c.close();
  }
  ok('modo clase y panel docente (compu y celular): el alumno guarda nombre y clase, copia su línea al terminar y el docente la pega, ve el resumen y descarga el CSV');

  // Academia de Cadetes (compu y celular acostado): la primera vez el juego empieza en la Academia (5 salas) y al "pasarla" se abre el menú.
  for (const [ancho, alto, movil, nombre] of [[1280, 760, false, 'academia compu'], [812, 375, true, 'academia celular']]) {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }); const pg = await c.newPage();
    pg.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
    await pg.goto(`${url}?academia&noboot`); await pg.waitForSelector('#ok'); assert.match(await pg.textContent('#ventana'), /ACADEMIA DE CADETES/); assert.equal(await pg.$('#t-jugar'), null, `${nombre}: la primera vez no se ve el menú`);
    await pg.click('#ok'); await pg.waitForFunction(() => document.getElementById('tuto').textContent.includes('1/5'), null, { timeout: 4000 });
    const paso = (n) => pg.waitForFunction((n) => document.getElementById('tuto').textContent.includes(`${n}/5`), n, { timeout: 8000 });
    const junto = (q) => pg.evaluate((q) => { const s = lfr.s; const o = s.objects.find((x) => x.t === q.t && (!q.meta || x.meta) && (!q.loot || x.loot.length)); for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = o.x + dx, y = o.y + dy; if (s.map.grid[y * s.L.W + x] === 1 && !s.map.solid[y * s.L.W + x]) { Object.assign(s.p, { x: x + 0.5, y: y + 0.5, hidden: null }); return; } } }, q);
    const usa = async () => { if (movil) await pg.click('#t-e'); else await pg.keyboard.press('e'); };
    await pg.evaluate(() => { lfr.s.drones = []; const r = lfr.s.L.rooms.find((x) => x.id === 'deposito'); Object.assign(lfr.s.p, { x: r.x + 3.5, y: r.y + 3.5 }); }); await paso(2);
    for (let i = 0; i < 2; i++) { await junto({ t: 'cajon', loot: true }); await usa(); await pg.waitForTimeout(1600); }
    await paso(3); await pg.evaluate(() => { const r = lfr.s.L.rooms.find((x) => x.id === 'entreno'); Object.assign(lfr.s.p, { x: r.x + 1.5, y: r.y + 3.5 }); }); await paso(4);
    for (const t of ['cinta', 'cinta', 'caja', 'estudio', 'estudio']) { await junto({ t }); await usa(); await pg.waitForTimeout(t === 'caja' ? 2400 : 5400); }
    assert.ok(await pg.evaluate(() => lfr.s.p.inv.includes('cable') && lfr.s.p.fuerza >= 40 && lfr.s.p.conoc >= 35), `${nombre}: entrenar, abrir la caja y estudiar`);
    await pg.evaluate(() => lfr.G.craft(lfr.s, 'tarjeta')); await paso(5);
    await pg.evaluate(() => { const s = lfr.s; const d = s.map.doors.find((x) => x.room === 'egreso'); const [x, y] = d.tiles[0]; Object.assign(s.p, { x: x + 0.5, y: y + 0.5 }); }); await usa();
    assert.ok(await pg.evaluate(() => lfr.s.map.doors.find((x) => x.room === 'egreso').open), `${nombre}: la tarjeta abre la escotilla`);
    await junto({ t: 'asiento', meta: true }); await usa(); await pg.waitForFunction(() => /EGRESASTE/.test(document.getElementById('ventana').textContent), null, { timeout: 4000 });
    await pg.screenshot({ path: join(salida, `academia-${movil ? 'celular' : 'compu'}-fin.png`) });
    await pg.click('#ok'); await pg.waitForSelector('#t-jugar', { timeout: 4000 }); assert.equal(await pg.evaluate(() => localStorage.getItem('lfr.academia')), '1', `${nombre}: queda aprobada`);
    await pg.goto(`${url}?academia&noboot`); await pg.waitForSelector('#t-jugar', { timeout: 6000 }); assert.equal(await pg.evaluate(() => document.getElementById('ventana').textContent.includes('ACADEMIA DE CADETES') && !!document.getElementById('t-aca')), true, `${nombre}: ya aprobada, se ve el menú (y el botón para repetirla)`);
    await c.close();
  }
  ok('Academia de Cadetes (compu y celular): la primera vez reemplaza al menú; 5 salas (llegada, recolecta, zona vigilada, entrena y estudia, egreso) con las acciones reales; al salir con la tarjeta se abre el menú y no vuelve sola');

  ok('sin errores de JavaScript ni de red');
  console.log(`\nTodo bien (${paso} pasos). Capturas en ${salida}`);
} catch (e) {
  console.error(`\n✘ Falló en el paso ${paso + 1} (semilla ${semilla}): ${e.message}`);
  if (problemas.length) console.error(`  Problemas vistos:\n  - ${problemas.join('\n  - ')}`);
  try { await pagina?.screenshot({ path: join(salida, 'fallo.png') }); console.error(`  Captura del fallo: ${join(salida, 'fallo.png')}`); } catch { /* sin captura */ }
  process.exitCode = 1;
} finally {
  await navegador?.close();
  servidor.close();
}
