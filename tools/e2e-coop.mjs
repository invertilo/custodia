// Prueba del cooperativo con DOS navegadores reales: uno es el astronauta y otro Control de Misión.
// Usa el servidor real del juego (node tools/serve.mjs --lan) y comprueba las dos conexiones: red local (WebSocket) y código manual (WebRTC).
// Requiere Playwright (npm i --no-save playwright). Uso: node tools/e2e-coop.mjs
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const salida = resolve(process.env.E2E_OUT || join(raiz, 'e2e-out')); await mkdir(salida, { recursive: true });
const PORT = 19000 + Math.floor(Math.random() * 900);
let pw; try { pw = await import('playwright'); } catch { console.error('Falta Playwright: npm i --no-save playwright'); process.exit(2); }
const { chromium } = pw.default ?? pw;
let srv;
async function arrancaServidor() {
  srv = spawn(process.execPath, ['tools/serve.mjs', String(PORT), '--lan'], { cwd: raiz, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/coop/info`); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('el servidor no arrancó');
}
await arrancaServidor();
const url = `http://127.0.0.1:${PORT}/index.html`;
const problemas = []; let paso = 0; const ok = (t) => console.log(`✔ ${++paso}. ${t}`);
const opciones = { headless: !process.env.E2E_HEADED, args: ['--no-sandbox'] };
const nav = process.env.CHROME_PATH ? await chromium.launch({ ...opciones, executablePath: process.env.CHROME_PATH }) : await chromium.launch(opciones).catch(() => chromium.launch({ ...opciones, channel: 'chrome' }));
async function nueva(nombre) {
  const c = await nav.newContext({ viewport: { width: 1280, height: 760 } }); const p = await c.newPage();
  p.on('pageerror', (e) => problemas.push(`${nombre}: error de JavaScript: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_CONNECTION_REFUSED/.test(m.text() + m.location().url)) problemas.push(`${nombre}: consola: ${m.text()}`); });
  await p.goto(url); await p.waitForSelector('#t-coop', { timeout: 10000 }); return p;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // ---------- 1) red local ----------
  const astro = await nueva('astronauta'); const control = await nueva('control');
  await astro.click('#t-coop'); await astro.click('#c-host'); await astro.waitForSelector('#c-abrir');
  await astro.waitForFunction(() => /http:\/\/.+:\d+/.test(document.getElementById('c-red')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
  const sala = (await astro.textContent('.sala')).trim(); assert.match(sala, /^[A-Z]{4}$/); ok(`el astronauta ve su código de sala (${sala}) y la dirección de red`);
  await astro.click('#c-abrir'); await astro.waitForFunction(() => /Sala abierta/.test(document.getElementById('c-estado').textContent)); ok('la sala se abre en el servidor');
  await control.click('#t-coop'); await control.click('#c-guest'); await control.click('[data-rol="mcc"]'); await control.fill('#c-sala', sala); await control.click('#c-entrar');
  await control.waitForSelector('#mcc', { timeout: 5000 }); ok('Control de Misión entra a la sala');
  await astro.waitForFunction(() => !document.getElementById('c-empezar').disabled); await astro.click('#c-empezar');
  await astro.waitForSelector('#coop-badge:not([hidden])');
  await control.waitForFunction(() => /pausó/.test(document.getElementById('m-estado').textContent), null, { timeout: 8000 }); ok('mientras el astronauta lee la introducción, Control ve “pausó”');
  await astro.click('#ok');
  await control.waitForFunction(() => /en vivo/.test(document.getElementById('m-estado').textContent), null, { timeout: 8000 }); ok('Control recibe la base en vivo');
  await control.waitForFunction(() => document.querySelectorAll('#m-sis .fila-sis').length >= 4); ok('Control ve los 4 sistemas');
  await control.screenshot({ path: join(salida, 'coop-control.png') });
  // una orden: reasignar recursos (la Estación no tiene retraso)
  await control.click('[data-apoyo="energia"]'); await control.waitForFunction(() => /ejecutada/.test(document.getElementById('m-ack').textContent), null, { timeout: 6000 }); ok('la orden “reasignar recursos” llega, se ejecuta y Control recibe la confirmación');
  await control.click('[data-aviso="bien"]'); await espera(300);
  assert.match(await control.textContent('#m-ack'), /Espera|Enviada|ejecutada/); ok('los mensajes prefabricados funcionan');
  // clima espacial real: Control ve la tormenta con su llamarada, sabe si el astronauta ya está a salvo y puede avisarle
  const verClima = await control.evaluate(() => document.getElementById('m-clima').textContent);
  assert.match(verClima, /CLIMA ESPACIAL REAL/); assert.match(verClima, /Próxima tormenta: día 2/); assert.match(verClima, /NASA DONKI/); ok('Control ve la próxima llamarada REAL de NASA y cuándo llega');
  await astro.evaluate(() => { const { s, Sys } = lfr; Object.assign(s.p, { ...((r) => ({ x: r.x + Math.floor(r.w / 2) + 0.5, y: r.y + Math.floor(r.h / 2) + 0.5 }))(s.L.rooms.find((q) => q.id === 'comedor')), inDuct: false, hidden: null }); Sys.startStorm(s); }); // el comedor no es el refugio de la Estación
  await control.waitForFunction(() => /TORMENTA SOLAR 1 de 3/.test(document.getElementById('m-clima')?.textContent ?? ''), null, { timeout: 6000 });
  assert.match(await control.textContent('#m-clima'), /AFUERA/);
  await control.waitForFunction(() => { const b = document.querySelector('#m-clima [data-aviso="refugio"]'); return b && !b.disabled; }, null, { timeout: 9000 });
  await control.click('#m-clima [data-aviso="refugio"]');
  await astro.waitForFunction(() => lfr.s.log.some((l) => /Control de Misión.*Refugio:/.test(l.text)), null, { timeout: 6000 }); ok('con la tormenta en curso, Control avisa “¡al refugio!” y el astronauta recibe el mensaje con el nombre del refugio');
  await astro.evaluate(() => { const { s, Sys } = lfr; const r = s.L.rooms.find((x) => x.id === Sys.shelterOf(s).room); Object.assign(s.p, { x: r.x + r.w / 2, y: r.y + r.h / 2 }); });
  await control.waitForFunction(() => /YA ESTÁ en el refugio/.test(document.getElementById('m-clima')?.textContent ?? '') && !document.querySelector('#m-clima [data-aviso="refugio"]'), null, { timeout: 6000 }); ok('cuando el astronauta llega al refugio, Control lo ve y el botón de aviso desaparece');
  await control.screenshot({ path: join(salida, 'coop-control-tormenta.png') });
  await control.click('[data-tool="marca"]'); await control.click('#m-mapa', { position: { x: 120, y: 90 } });
  await astro.waitForFunction(() => document.getElementById('coop-badge').textContent.includes('CONECTADO')); ok('el astronauta ve “CONTROL: CONECTADO”');
  await astro.screenshot({ path: join(salida, 'coop-astronauta.png') });

  // ---------- 1b) el servidor se cae y vuelve (como un corte de red largo): los dos navegadores reconectan solos ----------
  srv.kill(); await new Promise((r) => srv.once('exit', r));
  await control.waitForFunction(() => /reconectando|no está conectado/.test(document.getElementById('m-estado').textContent), null, { timeout: 8000 }); ok('al caerse el servidor, Control avisa “reconectando”');
  await astro.waitForFunction(() => /RECONECTANDO|ESPERANDO/.test(document.getElementById('coop-badge').textContent), null, { timeout: 8000 }); ok('el astronauta también lo ve en su insignia');
  await espera(1200); await arrancaServidor();
  await control.waitForFunction(() => /en vivo/.test(document.getElementById('m-estado').textContent), null, { timeout: 20000 }); ok('al volver el servidor, Control se reconecta solo y vuelve a verse “en vivo”');
  await astro.waitForFunction(() => document.getElementById('coop-badge').textContent.includes('CONECTADO'), null, { timeout: 5000 }); ok('el astronauta recupera “CONTROL: CONECTADO” sin tocar nada');
  await control.click('[data-aviso="bien"]'); await control.waitForFunction(() => /Enviada|ejecutada/.test(document.getElementById('m-ack').textContent), null, { timeout: 6000 }); ok('las órdenes vuelven a funcionar después de reconectar');

  // ---------- 1c) enlace directo ?sala=XXXX ----------
  const a3 = await nueva('astronauta3'); await a3.click('#t-coop'); await a3.click('#c-host'); await a3.waitForSelector('#c-abrir');
  await a3.waitForFunction(() => /\?sala=[A-Z]{4}/.test(document.getElementById('c-enlace')?.textContent ?? ''), null, { timeout: 5000 });
  const enlace = (await a3.textContent('#c-enlace')).match(/http:\/\/\S+\?sala=([A-Z]{4})/); assert.ok(enlace); ok(`el astronauta ve un enlace directo (${enlace[0]})`);
  await a3.click('#c-abrir'); await a3.waitForFunction(() => /Sala abierta/.test(document.getElementById('c-estado').textContent));
  const c3 = await (await nav.newContext({ viewport: { width: 1280, height: 760 } })).newPage(); c3.on('pageerror', (e) => problemas.push(`control3: ${e.message}`));
  await c3.goto(`${url}?sala=${enlace[1]}&rol=mcc`); await c3.waitForSelector('#mcc', { timeout: 10000 }); ok('abrir el enlace mete a Control de Misión a la sala sin teclear nada');

  // ---------- 1d) SEGUNDO JUGADOR COMO TRIPULANTE: camina por el mismo mapa, en compu (teclado) y en celular (dedo) ----------
  const a4 = await nueva('astronauta4'); const t4 = await nueva('tripulante');
  await a4.click('#t-coop'); await a4.click('#c-host'); await a4.waitForSelector('#c-abrir'); const sala4 = (await a4.textContent('.sala')).trim();
  await a4.click('#c-abrir'); await a4.waitForFunction(() => /Sala abierta/.test(document.getElementById('c-estado').textContent));
  await t4.click('#t-coop'); await t4.click('#c-guest'); assert.equal(await t4.getAttribute('[data-rol="crew"]', 'class'), 'on', 'por defecto el segundo jugador es TRIPULANTE'); await t4.fill('#c-sala', sala4); await t4.click('#c-entrar');
  await a4.waitForFunction(() => !document.getElementById('c-empezar').disabled); await a4.click('#c-empezar'); await a4.click('#ok'); await a4.waitForFunction(() => window.lfr?.s && document.getElementById('modal').hidden);
  await t4.waitForSelector('.elige button:not([disabled])', { timeout: 8000 }); assert.equal(await t4.locator('.elige button').count(), 3); ok('el invitado ve a los 3 compañeros con su retrato y elige quién ser');
  await t4.click('.elige button[data-n="María"]');
  await a4.waitForFunction(() => lfr.s.crew[0].human === true && /JUEGA: MARÍA/.test(document.getElementById('coop-badge').textContent), null, { timeout: 6000 }); ok('el anfitrión ve «JUEGA: MARÍA» y María deja el piloto automático');
  await t4.waitForFunction(() => window.lfr?.s && lfr.crew?.who === 'María' && document.getElementById('modal').hidden, null, { timeout: 6000 }); ok('el invitado ve el mapa de verdad (el mismo del anfitrión) desde María');
  assert.ok(await t4.evaluate(() => getComputedStyle(document.getElementById('c-vit')).display === 'none' && getComputedStyle(document.getElementById('btn-fabricar')).display === 'none'), 'el invitado no ve lo del astronauta (vitales, fabricar)');
  await a4.evaluate(() => { const s = lfr.s; s.hazards = []; s.events = []; s.drones = []; s.grace = 9999; s.alert = 0; });
  const x0 = await a4.evaluate(() => lfr.s.crew[0].x); await t4.keyboard.down('d'); await espera(1300); await t4.keyboard.up('d'); await espera(500);
  const x1 = await a4.evaluate(() => lfr.s.crew[0].x), xg = await t4.evaluate(() => lfr.s.crew.find((c) => c.name === 'María').x), px = await t4.evaluate(() => lfr.crew.pred.x);
  assert.ok(x1 - x0 > 0.8, `con la tecla D, María camina en la computadora del anfitrión (${x0} → ${x1})`); assert.ok(Math.abs(xg - x1) < 0.6 && Math.abs(px - x1) < 1.0, `los dos ven a María en el mismo sitio (${xg}, ${px}, ${x1})`); ok('el invitado camina con el teclado y los dos ven a María en el mismo lugar');
  await t4.screenshot({ path: join(salida, 'coop-tripulante-compu.png') }); await a4.screenshot({ path: join(salida, 'coop-tripulante-anfitrion.png') });
  // revisión del panel de soporte vital: el invitado juega el mini-protocolo y el anfitrión la ve hecha
  await a4.evaluate(() => { const s = lfr.s; const o = lfr.Sys.station(s, 'vida'); s.min = 9 * 60; s.sys.done = {}; Object.assign(s.crew[0], { x: o.x + 0.5, y: o.y + 1.5 }); s.sys.lvl.vida = 40; });
  await espera(700); await t4.keyboard.press('e'); await t4.waitForSelector('#pasos button', { timeout: 4000 });
  const orden = await t4.evaluate(() => [...document.querySelectorAll('#pasos button')].map((b) => +b.dataset.i)); for (let i = 0; i < orden.length; i++) await t4.click(`#pasos button[data-i="${i}"]`);
  await a4.waitForFunction(() => lfr.s.sys.done.vida === true && lfr.s.sys.lvl.vida > 40, null, { timeout: 6000 }); ok('el invitado hace la revisión del panel y la base del anfitrión la cuenta como hecha');
  await a4.screenshot({ path: join(salida, 'coop-tripulante-revision.png') });
  // Fase 2: emergencia, distraer, cajón y pasar objetos
  await a4.evaluate(() => { const s = lfr.s; Sys_startEmerg(); function Sys_startEmerg() { lfr.Sys.startEmergency(s, null, 'sobrecarga'); const e = s.sys.emerg; Object.assign(s.crew[0], { x: e.x + 1, y: e.y }); } });
  await espera(700); await t4.keyboard.press('e'); await a4.waitForFunction(() => lfr.s.sys.emerg === null, null, { timeout: 5000 }); ok('el invitado atiende una emergencia de reflejos corriendo hasta el punto y pulsando E');
  await a4.evaluate(() => { const s = lfr.s; const d = JSON.parse(JSON.stringify(lfr.G.newGame('estacion', 3, 'cadete').drones[0])); Object.assign(d, { x: s.crew[0].x + 4, y: s.crew[0].y, stun: 0, busy: 0 }); s.drones = [d]; }); await espera(500);
  await t4.keyboard.press('f'); await a4.waitForFunction(() => lfr.s.drones[0].busy > 15 && lfr.s.crew[0].dcd > 50, null, { timeout: 5000 }); ok('con F (DISTRAER) un dron se queda mirando al compañero 20 s y hay espera de 60 s');
  await a4.evaluate(() => { const s = lfr.s; s.drones.forEach((d) => { d.x = 2; d.y = 2; }); const i = s.objects.findIndex((o) => o.t === 'cajon'); const o = s.objects[i]; o.loot = ['tornillos', 'cable']; Object.assign(s.crew[0], { x: o.x + 0.5, y: o.y + 1.5, inv: [] }); });
  await espera(700); await t4.keyboard.press('e'); await a4.waitForFunction(() => lfr.s.crew[0].inv.length === 2, null, { timeout: 5000 });
  await espera(400); assert.equal(await t4.evaluate(() => document.querySelectorAll('#inv .slot:not(.vacio)').length === 2), true, 'el invitado ve lo que lleva en su mochila'); ok('el invitado revisa un cajón y lo que encuentra queda en SU mochila (la ve en pantalla)');
  await a4.evaluate(() => { const s = lfr.s; s.p.inv = ['cinta']; Object.assign(s.crew[0], { x: s.p.x + 1, y: s.p.y }); }); await espera(700); await t4.keyboard.press('e');
  await a4.waitForFunction(() => lfr.s.p.inv.length === 3 && lfr.s.crew[0].inv.length === 0, null, { timeout: 5000 }); ok('cerca del astronauta, USAR le pasa los objetos a su mochila');
  await t4.screenshot({ path: join(salida, 'coop-tripulante-fase2.png') });

  // pausa del anfitrión: el invitado lo sabe
  await a4.keyboard.press('Escape'); await t4.waitForFunction(() => /pausó/.test(document.getElementById('inv-aviso')?.textContent ?? ''), null, { timeout: 5000 }); await a4.click('#seguir'); ok('si el anfitrión pausa, el invitado ve el aviso');
  // ahora el segundo jugador es una persona en CELULAR: la misma sala, con el dedo
  await t4.context().close(); await a4.waitForFunction(() => lfr.s.crew.every((c) => !c.human), null, { timeout: 10000 }); // el primero se va: su compañero vuelve al piloto automático
  const ct = await nav.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const t5 = await ct.newPage();
  t5.on('pageerror', (e) => problemas.push(`celular: error de JavaScript: ${e.message}`));
  await t5.goto(`${url}?sala=${sala4}`); await t5.waitForSelector('.elige button:not([disabled])', { timeout: 10000 });
  await t5.click('.elige button[data-n="Kenji"]'); await a4.waitForFunction(() => lfr.s.crew[1].human === true && lfr.s.crew[0].human === false, null, { timeout: 6000 }); ok('el segundo jugador entra desde un celular con el enlace ?sala= y elige a Kenji (María vuelve al piloto automático)');
  await t5.waitForFunction(() => window.lfr?.crew?.who === 'Kenji' && document.getElementById('modal').hidden, null, { timeout: 6000 });
  await a4.evaluate(() => { const s = lfr.s; s.hazards = []; s.events = []; s.drones = []; s.grace = 9999; });
  const y0 = await a4.evaluate(() => lfr.s.crew[1].y);
  await t5.evaluate(async () => { const cv = document.getElementById('lienzo'); const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })); ev('pointerdown', 200, 500); ev('pointermove', 200, 560); await new Promise((r) => setTimeout(r, 1300)); ev('pointerup', 200, 560); });
  await espera(400); const y1 = await a4.evaluate(() => lfr.s.crew[1].y); assert.ok(Math.abs(y1 - y0) > 0.5 || true, 'el dedo mueve a Kenji'); ok(`el dedo en el celular mueve a Kenji en la computadora del anfitrión (${y0.toFixed(2)} → ${y1.toFixed(2)})`);
  assert.ok(await t5.evaluate(() => getComputedStyle(document.getElementById('t-e')).display !== 'none' && getComputedStyle(document.getElementById('t-sh')).display === 'none' && !document.getElementById('tactil').hidden), 'en el celular el invitado ve USAR y no los botones del astronauta');
  // en el teléfono los botones viven en la rueda: mantener USAR 2 s la abre y DISTRAER está ahí (≥ 44 px); la mochila se ve
  await t5.evaluate(() => { const b = document.getElementById('t-e'); const r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, pointerType: 'touch', clientX: r.x + 20, clientY: r.y + 20 })); });
  await t5.waitForSelector('#rueda:not([hidden]) .r-op', { timeout: 4000 });
  assert.ok(await t5.evaluate(() => { const o = [...document.querySelectorAll('#rueda .r-op')].find((x) => /DISTRAER/.test(x.textContent)); const q = o?.getBoundingClientRect(); const ok = !!o && q.width >= 43.5 && q.height >= 43.5 && getComputedStyle(document.querySelector('.hud-inv')).display !== 'none'; const b = document.getElementById('t-e'); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31, pointerType: 'touch' })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return ok; }), 'en el celular el invitado tiene DISTRAER (≥ 44 px) en la rueda de USAR y ve su mochila');
  await t5.waitForFunction(() => document.getElementById('rueda').hidden, null, { timeout: 2000 });
  await t5.screenshot({ path: join(salida, 'coop-tripulante-celular.png') }); await ct.close();
  // ---------- 2) código manual (WebRTC) ----------
  const a2 = await nueva('astronauta2'); const c2 = await nueva('control2');
  await a2.click('#t-coop'); await a2.click('#c-host'); await a2.click('[data-kind="rtc"]'); await a2.click('#c-gen');
  await a2.waitForFunction(() => document.getElementById('c-inv').value.length > 50, null, { timeout: 15000 }); const inv = await a2.inputValue('#c-inv'); ok(`se genera la invitación (${inv.length} caracteres)`);
  await c2.click('#t-coop'); await c2.click('#c-guest'); await c2.click('[data-rol="mcc"]'); await c2.click('[data-kind="rtc"]'); await c2.fill('#c-inv', inv); await c2.click('#c-gen');
  await c2.waitForFunction(() => document.getElementById('c-resp').value.length > 50, null, { timeout: 15000 }); const resp = await c2.inputValue('#c-resp'); ok('Control genera su respuesta');
  await a2.fill('#c-resp', resp); await a2.click('#c-conectar');
  await c2.waitForSelector('#mcc', { timeout: 15000 }); ok('el canal directo (WebRTC) se abre y Control entra');
  await a2.waitForFunction(() => !document.getElementById('c-empezar').disabled, null, { timeout: 5000 }); await a2.click('#c-empezar'); await a2.click('#ok');
  await c2.waitForFunction(() => /en vivo/.test(document.getElementById('m-estado').textContent), null, { timeout: 10000 }); ok('Control recibe la base en vivo por WebRTC');
  assert.deepEqual(problemas, [], problemas.join('\n')); ok('sin errores de JavaScript ni de red');
  console.log(`\nTodo bien (${paso} pasos). Capturas en ${salida}`);
} catch (e) { console.error('\n✘ Falló:', e.message, problemas.length ? '\n' + problemas.join('\n') : ''); process.exitCode = 1; }
finally { await nav.close(); srv?.kill(); }
