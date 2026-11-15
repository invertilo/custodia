// Pantalla, controles y menús de CUSTODIA. Mundo en pixel art con cámara que sigue al jugador.
import { ITEMS, PROTOCOLS, PROTO_FUENTE, PROTO_NIVEL, PROTO_NIVEL_EN, DIFS, PERKS } from './common.js';
import * as Meta from './meta.js';
import { NOTES, rescateLinea, NAVE } from './story.js';
import { LOCS, ROOM_EN } from './locs.js';
import * as G from './core.js';
import * as Sys from './sistemas.js';
import * as Amb from './ambientes.js';
import * as Aca from './academia.js';
import { fetchFlares, donkiEstado, sourceText, missionFlares, SHELTER } from './clima.js';
import { restriccion, dosisReales, osdr, osdUrl, escala } from './datos.js';
import { T, setLang, getLang, pickLang, IDIOMAS } from './i18n.js';
import { ficha } from './personajes.js';
import * as Quiz from './quiz.js';
import * as Voz from './voz.js';
import { arranqueDebe, arranqueLineas, vozArranque, consejo, comandoDatos, SECCIONES_DATOS, nombreSeccion } from './inicio.js';
// Idioma (ES por defecto; EN con ?lang=en, ?en o el selector del título). Solo presentación.
try { setLang(pickLang(location.search, localStorage.getItem('lfr.lang'))); document.documentElement.lang = getLang(); } catch { /* sin almacenamiento */ }
const nm = (o) => T(o.name, o.nameEn); const ds = (o) => T(o.desc, o.descEn); const rn = (n) => T(n, ROOM_EN[n] ?? n);
const idiomaHTML = () => `<div class="idioma" role="group" aria-label="Language / Idioma">${IDIOMAS.map((l) => `<button data-lang="${l}" class="${getLang() === l ? 'on' : ''}" aria-pressed="${getLang() === l}" title="${{ es: 'Español', en: 'English', he: 'עברית · טקסט בלבד' }[l]}">${l === 'he' ? 'עב' : l.toUpperCase()}</button>`).join('')}</div>`;
const HUD_TXT = [['#c-vit h3', 'TÚ', 'YOU'], ['#ov-sis h3', 'SISTEMAS DE LA BASE', 'BASE SYSTEMS'], ['.hud-crew h3', 'TRIPULACIÓN', 'CREW'], ['.hud-inv h3.cap', 'MOCHILA', 'BACKPACK'], ['#btn-mochila', 'Mochila', 'Backpack'], ['#btn-fabricar', 'Fabricar', 'Craft'], ['#btn-usar', 'Inhibir', 'Inhibit'],
  ['[data-panel="mant"]', 'Mantenim.', 'Upkeep'], ['[data-panel="plan"]', 'Plan', 'Plan'], ['[data-panel="amen"]', 'Amenazas', 'Threats'], ['[data-panel="reg"]', 'Avisos', 'Alerts'], ['#btn-nombres', 'Nombres', 'Names'], ['#btn-mapa', 'Mapa', 'Map'], ['#btn-menu .txt', 'PAUSA', 'PAUSE'], ['#btn-cerrar-mapa span', 'CERRAR MAPA', 'CLOSE MAP'], ['.girar-tit', 'GIRA EL DISPOSITIVO', 'ROTATE YOUR DEVICE'], ['.girar-txt', 'CUSTODIA se juega en horizontal. El juego queda en pausa hasta que lo gires.', 'CUSTODIA is played in landscape. The game stays paused until you rotate it.']];
const aplicaIdioma = () => { for (const [sel, es, en] of HUD_TXT) { const el = document.querySelector(sel); if (!el) continue; for (const n of el.childNodes) if (n.nodeType === 3 && [es, en, T(es, en)].includes(n.nodeValue.trim())) n.nodeValue = n.nodeValue.replace(/\S(.*\S)?/, T(es, en)); } };
const cambiaIdioma = (l, volver) => { setLang(l); try { localStorage.setItem('lfr.lang', l); } catch { /* nada */ } document.documentElement.lang = l; aplicaIdioma(); textosTactil(); Voz.parar(); volver(); };
aplicaIdioma();
import { VILLAINS } from './villains.js';
import * as M from './music.js';
import * as Snd from './sonido.js';
import * as A from './arte.js';
import * as FX from './fx.js';
import { HostSession } from './coop.js';
import { coopScreens } from './coopui.js';
import { admite, TTL } from './avisos.js';
import * as UI from './ui.js';
import { informe, estadoNivel } from './informe.js';
import { idMant } from './variedad.js';
import * as Tu from './tutorial.js';
import * as Cert from './certificado.js';
import * as Doc from './docente.js';
import * as Cu from './cuerpos.js';
const { ic } = UI;

const TS = 16;
const cv = document.getElementById('lienzo'); const cx = cv.getContext('2d');
let ZOOM = 2, VW = 512, VH = 288; // vista en píxeles del mundo
/** El lienzo ocupa toda la ventana; el zoom entero sube con el ancho para que los sprites no se vean diminutos. */
function fit() { const w = Math.max(320, innerWidth), h = Math.max(320, innerHeight); ZOOM = Math.max(2, Math.floor(w / 560)); cv.width = w; cv.height = h; VW = w / ZOOM; VH = h / ZOOM; cx.imageSmoothingEnabled = false; }
fit(); addEventListener('resize', fit);
const $ = (id) => document.getElementById(id);
let s = null; let menu = null; let last = performance.now(); let hudT = 0; let saveT = 0;
const keys = new Set(); const touch = { dx: 0, dy: 0 };
const cam = { x: 0, y: 0 };

// ---------- guardado (una ranura por destino) ----------
const SKEY = (loc) => `lfr.${loc}`;
function save() { if (!s || s.over || crew || s.mode === 'academia') return; /* la Academia no se guarda */ Meta.keepNotes(s); if (s.daily) return; try { localStorage.setItem(SKEY(s.loc), G.serialize(s)); } catch { /* sin almacenamiento */ } }
function load(loc) { try { const raw = localStorage.getItem(SKEY(loc)); return raw ? G.revive(JSON.parse(raw)) : null; } catch { return null; } }
const getDif = () => { try { return DIFS[localStorage.getItem('lfr.dif')] ? localStorage.getItem('lfr.dif') : 'cadete'; } catch { return 'cadete'; } };
const setDif = (d) => { try { localStorage.setItem('lfr.dif', d); } catch { /* nada */ } };
const getOpt = (k, d) => { try { return localStorage.getItem('lfr.' + k) ?? d; } catch { return d; } };
const setOpt = (k, v) => { try { localStorage.setItem('lfr.' + k, v); } catch { /* nada */ } };
const clearSave = (loc) => { try { localStorage.removeItem(SKEY(loc)); } catch { /* nada */ } };
const best = (loc) => { try { return +localStorage.getItem(`lfr.best.${loc}`) || 0; } catch { return 0; } };
const setBest = (loc, n) => { try { if (n > best(loc)) localStorage.setItem(`lfr.best.${loc}`, n); } catch { /* nada */ } };

// ---------- sonido ----------
// Todo el audio vive en music.js (un solo AudioContext, compresor y mudo). Aquí solo se llama: beep = tono suelto, M.ui = sonidos de interfaz.
const beep = (f = 440, d = 0.08, type = 'square', vol = 0.035) => M.tone(f, d, type, vol);
const aud = { s: null, amb: '', pend: -1, msgT: 0 }; // estado de los ganchos de audio (no toca el juego)
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, M.wake, { passive: true }); // el navegador exige un gesto: se despierta con el primero
document.addEventListener('click', (e) => { if (e.target.closest?.('button') && !['protocolo', 'codigo', 'cables', 'respira'].includes(menu)) M.ui('click'); }); // clic suave en cualquier botón (los minijuegos ya traen sus tonos)

// ---------- paletas por destino ----------
const THEMES = {
  // Estación: módulos blanco-grisáceos (tipo ISS). Luna: paneles beige aislados. Marte: metal oxidado. Así cada destino se reconoce de un vistazo.
  estacion: { void: '#02040a', floor: '#1d2733', floor2: '#232f3d', line: '#2c3a4a', wall: '#7d8a9b', wallTop: '#c1cad6', wallDark: '#38424f', corr: '#1e2833', danger: '#2a1418', out: '#000' },
  luna: { void: '#1b1e27', floor: '#2c2b28', floor2: '#33322e', line: '#43413b', wall: '#8a8476', wallTop: '#c4bdab', wallDark: '#46423a', corr: '#2a2926', danger: '#2c1719', out: '#4a4f5c' },
  marte: { void: '#33190f', floor: '#2f221b', floor2: '#382820', line: '#4a3226', wall: '#7c4a36', wallTop: '#ad7258', wallDark: '#45281c', corr: '#2c1f18', danger: '#3a1a16', out: '#6e3d2a' },
};

// ---------- capa fija del mundo (piso, paredes, objetos) ----------
let base = null; let baseLoc = null; // baseLoc = el mapa (s.L) con el que se horneó la capa fija
function hashRand(i) { let x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); }
function drawBase() {
  const L = s.L; const T = THEMES[L.theme];
  base = document.createElement('canvas'); base.width = L.W * TS; base.height = L.H * TS; baseLoc = s.L;
  const b = base.getContext('2d'); b.imageSmoothingEnabled = false;
  const g = s.map.grid; const W = L.W, H = L.H;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : g[y * W + x]);
  // fondo: espacio con estrellas y la Tierra, o suelo lunar/marciano
  b.fillStyle = T.void; b.fillRect(0, 0, base.width, base.height);
  if (L.theme === 'estacion') {
    for (let i = 0; i < 400; i++) { b.fillStyle = `rgba(220,235,255,${0.2 + hashRand(i) * 0.7})`; b.fillRect(hashRand(i + 1) * base.width | 0, hashRand(i + 2) * base.height | 0, 1, 1); }
    const ex = base.width - 40, ey = base.height + 260; const gr = b.createRadialGradient(ex - 60, ey - 120, 30, ex, ey, 330);
    gr.addColorStop(0, '#6fb6ff'); gr.addColorStop(0.7, '#1d5fae'); gr.addColorStop(1, '#0a2a55'); b.fillStyle = gr; b.beginPath(); b.arc(ex, ey, 320, 0, 7); b.fill();
    b.fillStyle = 'rgba(80,200,120,.5)'; for (let i = 0; i < 30; i++) { b.beginPath(); b.arc(ex - 200 + hashRand(i + 9) * 260, ey - 300 + hashRand(i + 19) * 120, 6 + hashRand(i + 29) * 14, 0, 7); b.fill(); }
  } else {
    for (let i = 0; i < 900; i++) { const v = hashRand(i); b.fillStyle = v > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.12)'; b.fillRect(hashRand(i + 3) * base.width | 0, hashRand(i + 4) * base.height | 0, 2, 2); }
  }
  // piso
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = at(x, y); if (!v) continue;
    const ri = s.map.room[y * W + x]; const r = L.rooms[ri];
    const px = x * TS, py = y * TS;
    if (r?.outside) {
      b.fillStyle = T.out; b.fillRect(px, py, TS, TS);
      for (let k = 0; k < 5; k++) { const h = hashRand(x * 31 + y * 17 + k); b.fillStyle = h > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.14)'; b.fillRect(px + (hashRand(h * 99) * 14 | 0), py + (hashRand(h * 77) * 14 | 0), 2, 2); }
      continue;
    }
    A.floorTile(b, s, T, x, y, r, hashRand, at);
    Amb.detallePiso(b, L.theme, px, py, hashRand(x * 13 + y * 7 + 5), !at(x, y - 1)); // pasamanos, regolito o polvo rojo según el destino
  }
  A.lightPools(b, s);
  // cráteres y rocas en el exterior
  const ext = L.rooms.find((r) => r.outside);
  if (ext) for (let i = 0; i < 26; i++) {
    const x = (ext.x + hashRand(i * 3) * ext.w) * TS, y = (ext.y + hashRand(i * 5) * ext.h) * TS, rad = 4 + hashRand(i * 7) * 12;
    if (s.objects.some((o) => Math.hypot(o.x * TS + 8 - x, o.y * TS + 8 - y) < 26)) continue;
    b.fillStyle = 'rgba(0,0,0,.22)'; b.beginPath(); b.ellipse(x, y, rad, rad * 0.6, 0, 0, 7); b.fill();
    b.fillStyle = 'rgba(255,255,255,.08)'; b.beginPath(); b.ellipse(x - 1, y - 1, rad * 0.7, rad * 0.4, 0, 0, 7); b.fill();
  }
  // paredes con relieve
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => at(x + dx, y + dy) && !L.rooms[s.map.room[(y + dy) * W + x + dx]]?.outside);
    if (!near) continue;
    A.wallTile(b, s, T, x, y, hashRand, at);
  }
  A.surfaceMarks(b, s);
  A.props(b, s);
  // (los nombres de las salas ya no se pintan fijos en el mapa: salaEtiquetas() muestra solo el de la sala en la que estás, o todos con [N])
  // objetos fijos
  for (const o of s.objects) drawObjOut(b, o, L.theme);
}

function R(b, c, x, y, w, h) { b.fillStyle = c; b.fillRect(x, y, w, h); }
/** Dibuja el objeto con contorno oscuro y sombra, para que se distinga del suelo y de los vecinos. */
const OBJ_NOMBRE = { cama: 'CAMA', escondite: 'CASILLERO', cajon: 'CAJÓN', mesa: 'MESA', cinta: 'CINTA', estudio: 'ESTUDIO', registro: 'REGISTRO', capcom: 'RADIO', trabajo: 'CULTIVO', caja: 'CAJA PESADA', casillero: 'CASILLERO', traje: 'TRAJE', nucleo: 'NÚCLEO', palanca: 'PALANCA', asiento: 'ASIENTO' };
const OBJ_NOMBRE_EN = { cama: 'BED', escondite: 'LOCKER', cajon: 'DRAWER', mesa: 'TABLE', cinta: 'TREADMILL', estudio: 'STUDY', registro: 'RECORD', capcom: 'RADIO', trabajo: 'CROPS', caja: 'HEAVY CRATE', casillero: 'LOCKER', traje: 'SUIT', nucleo: 'CORE', palanca: 'LEVER', asiento: 'SEAT' };
for (const k of Object.keys(OBJ_NOMBRE)) { const es = OBJ_NOMBRE[k]; Object.defineProperty(OBJ_NOMBRE, k, { get: () => T(es, OBJ_NOMBRE_EN[k]), enumerable: true, configurable: true }); }
const OBJ_COLOR = { cajon: '#ffd23d', registro: '#ff6b6b', capcom: '#5ff6ff', estudio: '#9fd4ff', mesa: '#9be39c', cinta: '#9be39c', mant: '#ffc23d', nucleo: '#ff6b6b', trabajo: '#9be39c', cama: '#b8c4ff', escondite: '#b8c4ff', casillero: '#b8c4ff', traje: '#e8eef5', palanca: '#ffc23d', caja: '#ffd23d', asiento: '#e8eef5' };
/** Cuántos letreros se pintaron en este cuadro (lo lee la prueba e2e para vigilar que no se acumulen). */
let nEtq = 0;
/** [N] Nombres: apagado por defecto. Apagado = solo el nombre del objeto sobre el que actuarías con E y el de la sala donde estás. */
const vista = { nombres: getOpt('nombres', '0') === '1', cruz: getOpt('cruz', '0') === '1', rueda: getOpt('rueda', '0') === '1' };
function alternaNombres() { vista.nombres = !vista.nombres; setOpt('nombres', vista.nombres ? '1' : '0'); hud(); }
/** Letrero del objeto sobre el que usarás con E (con marco). Con [N] activado también los cercanos, chicos y más tenues. */
function objetoEtiquetas(t) {
  const p = s.p; if (p.inDuct) { cv.dataset.etq = nEtq; return; } const objetivo = G.nearby(s).find((n) => n.kind === 'obj')?.o;
  cx.save(); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = '8px VT323';
  for (const o of s.objects) {
    const d = Math.hypot(o.x + 0.5 - p.x, o.y + 0.5 - p.y); const es = o === objetivo; if (!es && !(vista.nombres && d <= 4.5)) continue;
    const nombre = o.t === 'mant' ? Sys.SYS[o.sys].name.toUpperCase() : OBJ_NOMBRE[o.t]; if (!nombre) continue;
    const a = es ? 1 : Math.max(0.3, 1 - (d - 1.5) / 3); const x = o.x * TS + 8, y = o.y * TS - (o.t === 'nucleo' || o.t === 'asiento' ? 6 : 3);
    const w = cx.measureText(nombre).width + 4; cx.globalAlpha = a; nEtq++;
    R(cx, 'rgba(8,11,18,.78)', x - w / 2, y - 5, w, 9); R(cx, es ? '#ffc23d' : OBJ_COLOR[o.t] ?? '#fff', x - w / 2, y + 3, w, 1);
    cx.fillStyle = es ? '#ffc23d' : '#e8eef8'; cx.fillText(nombre, x, y);
    if (es) { cx.strokeStyle = `rgba(255,194,61,${0.6 + 0.4 * Math.sin(t / 140)})`; cx.lineWidth = 1; cx.strokeRect(o.x * TS - 1.5, o.y * TS - 1.5, TS + 3, TS + 3); }
  }
  cx.restore(); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cv.dataset.etq = nEtq;
}
/** Nombre de la sala: solo la que pisas, durante ~3 s al entrar (se apaga solo). Con [N] se ven todas. */
let salaVista = { s: null, id: null, t0: 0 };
function salaEtiquetas(t) {
  nEtq = 0; const id = G.playerRoom(s); if (salaVista.s !== s || salaVista.id !== id) salaVista = { s, id, t0: t };
  cx.save(); cx.font = '8px VT323'; cx.textAlign = 'left'; cx.textBaseline = 'top';
  for (const r of s.L.rooms) {
    const aqui = r.id === id; const a = vista.nombres ? (aqui ? 0.95 : 0.55) : aqui ? Math.max(0, Math.min(1, (3200 - (t - salaVista.t0)) / 800)) : 0; if (a <= 0.02) continue;
    const nombre = r.name.toUpperCase(); const w = cx.measureText(nombre).width; nEtq++; cx.globalAlpha = a;
    R(cx, 'rgba(0,0,0,.5)', r.x * TS + 2, r.y * TS + 1, w + 4, 9); cx.fillStyle = r.restricted ? '#ff6b6b' : r.outside ? '#ffffff' : '#dfe6f2'; cx.fillText(nombre, r.x * TS + 4, r.y * TS + 1.5);
  }
  cx.restore(); cx.textAlign = 'center'; cx.textBaseline = 'middle';
}
function drawObjOut(b, o, theme) {
  const t = document.createElement('canvas'); t.width = 48; t.height = 48; const c = t.getContext('2d'); c.imageSmoothingEnabled = false;
  drawObj(c, { ...o, x: 1, y: 1 }, theme);
  const sil = document.createElement('canvas'); sil.width = 48; sil.height = 48; const sc = sil.getContext('2d'); sc.drawImage(t, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#04060b'; sc.fillRect(0, 0, 48, 48);
  const x = o.x * TS - TS, y = o.y * TS - TS;
  b.globalAlpha = 0.35; b.drawImage(sil, x + 2, y + 2); b.globalAlpha = 1;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.drawImage(sil, x + dx, y + dy);
  b.drawImage(t, x, y);
}
function drawObj(b, o, theme) {
  if (Amb.objeto(b, o, theme)) return; // cada destino tiene su propia versión del objeto (ambientes.js)
  const x = o.x * TS, y = o.y * TS;
  switch (o.t) {
    case 'cama': R(b, '#3a4350', x, y + 2, 16, 12); R(b, '#c9d3dd', x + 1, y + 3, 14, 10); R(b, '#fff', x + 2, y + 4, 4, 4); R(b, o.mine ? '#2bb8c4' : '#b0505a', x + 6, y + 4, 9, 8); break;
    case 'escondite': R(b, '#3c4a5a', x + 2, y, 12, 16); R(b, '#566a80', x + 3, y + 1, 10, 14); R(b, '#2b3642', x + 4, y + 3, 8, 1); R(b, '#2b3642', x + 4, y + 5, 8, 1); R(b, '#d8e2ec', x + 11, y + 8, 1, 3); break;
    case 'cajon': R(b, '#4a3d2a', x + 1, y + 5, 14, 11); R(b, '#7a6646', x + 1, y + 4, 14, 3); R(b, '#3a2f20', x + 2, y + 9, 12, 1); R(b, '#3a2f20', x + 2, y + 12, 12, 1); R(b, '#c9b48a', x + 7, y + 10, 2, 1); break;
    case 'mesa': R(b, '#5d636e', x, y + 4, 16, 9); R(b, '#8a919e', x, y + 3, 16, 3); R(b, '#e8b04a', x + 2, y + 6, 4, 3); R(b, '#6ac46a', x + 9, y + 6, 4, 3); break;
    case 'cinta': R(b, '#2a2a2e', x, y + 6, 16, 8); R(b, '#4a4a52', x + 1, y + 7, 14, 6); R(b, '#9aa', x + 1, y + 1, 2, 7); R(b, '#9aa', x + 13, y + 1, 2, 7); R(b, '#9aa', x + 1, y + 1, 14, 2); break;
    case 'estudio': R(b, '#4a3a2c', x, y + 9, 16, 6); R(b, '#22272e', x + 3, y + 1, 10, 8); R(b, '#1c3a5a', x + 4, y + 2, 8, 6); R(b, '#9fd4ff', x + 5, y + 3, 5, 1); R(b, '#9fd4ff', x + 5, y + 5, 3, 1); break;
    case 'mant': { const c = { vida: '#5fd3ff', energia: '#ffd23d', rad: '#ffb23d', comida: '#5fd35f' }[o.sys] ?? '#fff'; R(b, '#2a3340', x + 1, y + 1, 14, 14); R(b, '#161c26', x + 2, y + 2, 12, 9); R(b, c, x + 3, y + 3, 10, 2); R(b, c, x + 3, y + 6, 6, 2); R(b, '#6a7690', x + 2, y + 12, 12, 2); break; }
    case 'registro': R(b, '#2a1416', x + 2, y, 12, 16); R(b, '#401c20', x + 3, y + 1, 10, 14); for (let i = 0; i < 4; i++) R(b, '#1a0c0e', x + 4, y + 3 + i * 3, 8, 1); break;
    case 'capcom': R(b, '#3c4450', x, y + 6, 16, 10); R(b, '#1a2a3a', x + 2, y + 7, 7, 5); R(b, '#5ff6ff', x + 3, y + 8, 5, 1); R(b, '#aab', x + 12, y, 1, 7); R(b, '#ff4b4b', x + 11, y, 3, 2); break;
    case 'trabajo':
      if (theme === 'luna') { R(b, '#2c3444', x + 1, y + 1, 14, 15); for (let i = 0; i < 3; i++) R(b, '#ffd23d', x + 3, y + 3 + i * 4, 10, 2); }
      else { R(b, '#6b4a2a', x + 3, y + 10, 10, 6); R(b, '#3a8a3a', x + 2, y + 3, 12, 8); R(b, '#5fd35f', x + 5, y + 1, 6, 6); R(b, '#ff6b9a', x + 7, y + 3, 2, 2); }
      break;
    case 'caja':
      if (theme === 'estacion') { R(b, '#6a5a3a', x, y + 1, 16, 15); R(b, '#8a7650', x + 1, y + 2, 14, 13); R(b, '#4a3d28', x + 1, y + 8, 14, 1); R(b, '#4a3d28', x + 7, y + 2, 1, 13); }
      else { R(b, '#c8ccd2', x + 2, y, 12, 16); R(b, '#e8ecf2', x + 3, y + 1, 4, 14); R(b, theme === 'luna' ? '#4a8aff' : '#ff8a3d', x + 2, y + 6, 12, 3); }
      break;
    case 'casillero': R(b, '#2a3340', x + 3, y, 10, 16); R(b, '#46556a', x + 4, y + 1, 8, 14); for (let i = 0; i < 3; i++) R(b, '#1c232d', x + 5, y + 3 + i * 2, 6, 1); R(b, '#c9d3dd', x + 10, y + 9, 1, 2); break;
    case 'traje': R(b, '#5a6066', x + 1, y, 14, 16); R(b, '#e8eef5', x + 5, y + 2, 6, 5); R(b, '#e8eef5', x + 4, y + 7, 8, 6); R(b, '#e8eef5', x + 4, y + 13, 3, 3); R(b, '#e8eef5', x + 9, y + 13, 3, 3); R(b, '#2a5a8a', x + 6, y + 3, 4, 2); break;
    case 'nucleo': R(b, '#1a0a0c', x - 2, y - 2, 20, 20); R(b, '#3a1418', x, y, 16, 16); break;
    case 'palanca': R(b, '#3a4250', x, y + 4, 16, 12); R(b, '#22303a', x + 2, y + 5, 12, 4); R(b, '#888', x + 7, y - 2, 2, 7); break;
    case 'asiento':
      if (theme === 'estacion') { R(b, '#3a3a44', x - 2, y - 2, 20, 20); R(b, '#c9b48a', x + 3, y + 3, 10, 10); R(b, '#8a7650', x + 4, y + 4, 8, 5); }
      else {
        R(b, '#d8dce2', x - 6, y - 10, 28, 20); R(b, '#aab0b8', x - 6, y + 2, 28, 8); R(b, '#2a4a7a', x + 2, y - 6, 12, 6);
        R(b, '#666', x - 10, y + 10, 4, 8); R(b, '#666', x + 22, y + 10, 4, 8); R(b, '#888', x - 2, y + 10, 20, 3);
        R(b, theme === 'luna' ? '#c9a84a' : '#ff8a3d', x - 6, y - 2, 28, 2);
      }
      break;
  }
}

// ---------- personajes ----------
/** Astronauta (el dibujo vive en cuerpos.js): oficio a la vista, ojos y boca según el ánimo; `ring` marca al jugador. */
function astro(ctx, x, y, dir, phase, shirt, moving, alpha = 1, key = 'yo', suit = false, emo = 'normal', ring = false) {
  if (suit) return suitSprite(ctx, x, y, dir, phase, shirt, moving, alpha);
  const f = Math.abs(Math.cos(dir)) > Math.abs(Math.sin(dir)) ? (Math.cos(dir) > 0 ? 'r' : 'l') : (Math.sin(dir) > 0 ? 'd' : 'u');
  Cu.dibujaCuerpo(ctx, { x: Math.round(x * TS), y: Math.round(y * TS), f, step: moving ? Math.round(Math.sin(phase * 14)) : 0, key, shirt, moving, alpha, emo, ring, anim: !FX.suave() });
}
function suitSprite(ctx, x, y, dir, phase, stripe, moving, alpha = 1) {
  ctx.globalAlpha = alpha;
  const px = Math.round(x * TS), py = Math.round(y * TS);
  const f = Math.abs(Math.cos(dir)) > Math.abs(Math.sin(dir)) ? (Math.cos(dir) > 0 ? 'r' : 'l') : (Math.sin(dir) > 0 ? 'd' : 'u');
  const step = moving ? Math.round(Math.sin(phase * 14)) : 0;
  R(ctx, 'rgba(0,0,0,.3)', px - 5, py + 5, 10, 3);
  R(ctx, '#c9d3dd', px - 4, py + 2 + Math.max(0, step), 3, 4); R(ctx, '#c9d3dd', px + 1, py + 2 + Math.max(0, -step), 3, 4);
  R(ctx, '#e8eef5', px - 5, py - 4, 10, 7);
  R(ctx, stripe, px - 5, py - 1, 10, 2);
  if (f === 'u') R(ctx, '#9aa4b0', px - 4, py - 4, 8, 6);
  R(ctx, '#f4f8fc', px - 4, py - 11, 8, 7);
  R(ctx, '#ffffff', px - 3, py - 12, 6, 1);
  const visor = '#1e3a5a'; const shine = '#5fb6ff';
  if (f === 'd') { R(ctx, visor, px - 3, py - 9, 6, 3); R(ctx, shine, px - 2, py - 9, 2, 1); }
  if (f === 'l') { R(ctx, visor, px - 4, py - 9, 4, 3); R(ctx, shine, px - 4, py - 9, 1, 1); }
  if (f === 'r') { R(ctx, visor, px, py - 9, 4, 3); R(ctx, shine, px + 3, py - 9, 1, 1); }
  ctx.globalAlpha = 1;
}
function droneSprite(ctx, d, t, off) {
  const bob = off ? 0 : Math.sin(t / 200 + d.route) * 1.5; const px = d.x * TS, py = d.y * TS + bob;
  R(ctx, 'rgba(0,0,0,.3)', px - 5, d.y * TS + 6, 10, 2);
  R(ctx, off ? '#333' : '#5a6270', px - 6, py - 4, 12, 6); R(ctx, off ? '#222' : '#8a94a2', px - 4, py - 6, 8, 3);
  const eye = off ? '#111' : d.mode === 'persigue' ? '#ff3b3b' : '#ffc23d';
  R(ctx, eye, px - 1 + Math.round(Math.cos(d.dir) * 3), py - 3 + Math.round(Math.sin(d.dir) * 1), 3, 2);
  if (!off && UI.alterna(t, 0.8)) R(ctx, eye, px - 1, py - 7, 2, 1);
}
function robotSprite(ctx, h, t, rover) {
  const px = h.x * TS, py = h.y * TS; const c = h.stun > 0 ? '#555' : h.def.color;
  R(ctx, 'rgba(0,0,0,.35)', px - 8, py + 5, 16, 3);
  if (rover) { R(ctx, '#333', px - 8, py + 1, 4, 5); R(ctx, '#333', px + 4, py + 1, 4, 5); R(ctx, c, px - 7, py - 5, 14, 7); R(ctx, '#222', px - 2, py - 8, 4, 3); R(ctx, h.stun > 0 ? '#111' : '#ff3b3b', px - 1 + Math.round(Math.cos(h.dir) * 4), py - 3, 2, 2); }
  else { R(ctx, '#333', px - 6, py + 2, 12, 4); R(ctx, c, px - 5, py - 7, 10, 9); R(ctx, '#222', px - 3, py - 5, 6, 3); R(ctx, h.stun > 0 ? '#111' : '#ff3b3b', px - 2, py - 4, 1, 1); R(ctx, h.stun > 0 ? '#111' : '#ff3b3b', px + 1, py - 4, 1, 1); R(ctx, '#888', px + 5, py - 3 + Math.round(Math.sin(t / 120) * 2), 4, 1); }
  if (h.stun > 0) { ctx.fillStyle = '#5ff6ff'; ctx.font = '9px VT323'; ctx.fillText(`${Math.ceil(h.stun)}`, px, py - 12); }
}

// ---------- dibujo de cada cuadro ----------
let drawLast = 0; const shk = { x: 0, y: 0 }; let stepAcc = 0, stepX = 0, stepY = 0;
/** Costo medio de draw() en ms (lo lee la prueba e2e; reiniciar con lfr.perf.reset()). */
const perf = { sum: 0, n: 0, max: 0, get avg() { return this.n ? this.sum / this.n : 0; }, reset() { this.sum = 0; this.n = 0; this.max = 0; } };
function draw(t) {
  const t0 = performance.now(); drawFrame(t); const ms = performance.now() - t0; perf.sum += ms; perf.n++; if (ms > perf.max) perf.max = ms;
}
/**
 * Guardia del HUD: la cámara ya centra al jugador, pero si por cualquier motivo (ventana rara, zoom del navegador, HUD más alto de lo esperado)
 * su dibujo cae debajo de un panel, se corre la cámara lo justo para que quede a la vista. Se mide contra los paneles de verdad (cada ~8 cuadros)
 * y se suaviza; el desplazamiento tiene tope y se calcula sobre la posición SIN corrimiento, así que no oscila.
 */
const guardia = { x: 0, y: 0, tx: 0, ty: 0, n: 0, rects: [] };
const MAX_CORRE = 240;
const HUD_TAPA = '.hud .caja:not([hidden]), .avisos li, .barra, .hud-teclas button, #tactil:not([hidden]) button';
function guardaHud(sx0, sy0) {
  if (guardia.n++ % 8 === 0) {
    guardia.rects = [...document.querySelectorAll(HUD_TAPA)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 4 && r.height > 4);
    let mejor = null;
    for (const r of guardia.rects) {
      const l = r.left - 16, rr = r.right + 16, a = r.top - 30, b = r.bottom + 12; // el sprite mide ~±8 px de ancho y ~26 de alto (la cabeza queda arriba)
      if (sx0 <= l || sx0 >= rr || sy0 <= a || sy0 >= b) continue;
      const opc = [[rr - sx0, 0], [-(sx0 - l), 0], [0, b - sy0], [0, -(sy0 - a)]].sort((p, q) => Math.hypot(...p) - Math.hypot(...q))[0];
      if (!mejor || Math.hypot(...opc) < Math.hypot(...mejor)) mejor = opc;
    }
    guardia.tx = mejor ? Math.max(-MAX_CORRE, Math.min(MAX_CORRE, mejor[0])) : 0; guardia.ty = mejor ? Math.max(-MAX_CORRE, Math.min(MAX_CORRE, mejor[1])) : 0;
  }
  guardia.x += (guardia.tx - guardia.x) * 0.2; guardia.y += (guardia.ty - guardia.y) * 0.2;
  if (Math.abs(guardia.x) < 0.3 && !guardia.tx) guardia.x = 0; if (Math.abs(guardia.y) < 0.3 && !guardia.ty) guardia.y = 0;
}
function drawFrame(t) {
  const pdt = Math.min(0.05, Math.max(0, (t - drawLast) / 1000)); drawLast = t;
  if (baseLoc !== s.L || !base) drawBase();
  const L = s.L; const p = s.p;
  // cámara centrada en el jugador
  const ww = L.W * TS, wh = L.H * TS;
  // el jugador va SIEMPRE en el centro de la pantalla (sin tope en los bordes del mapa): así el HUD de las esquinas nunca lo tapa; más allá del mapa solo se ve el espacio
  cam.x = ww <= VW ? (ww - VW) / 2 : p.x * TS - VW / 2;
  cam.y = wh <= VH ? (wh - VH) / 2 : p.y * TS - VH / 2;
  { const sx0 = (p.x * TS - cam.x) * ZOOM, sy0 = ((p.y - 0.3) * TS - cam.y) * ZOOM; guardaHud(sx0, sy0); cam.x -= guardia.x / ZOOM; cam.y -= guardia.y / ZOOM; } // si un panel lo tapara, la cámara se corre
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.imageSmoothingEnabled = false;
  cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
  FX.shakeOffset(s.shake, t, shk); // sacudida corta y suave (≤4 px, se apaga sola; 0 en modo suave)
  cx.setTransform(ZOOM, 0, 0, ZOOM, Math.round(-cam.x * ZOOM + shk.x), Math.round(-cam.y * ZOOM + shk.y));
  cx.drawImage(base, 0, 0);
  if (!p.hidden && !p.sleep) A.luzJugador(cx, p.x * TS, p.y * TS, L.theme);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const vis = (x, y, m = 2) => x * TS > cam.x - m * TS && x * TS < cam.x + VW + m * TS && y * TS > cam.y - m * TS && y * TS < cam.y + VH + m * TS;

  // conductos y rejillas
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) if (s.map.duct[y * L.W + x] && vis(x, y)) {
    if (p.inDuct) { R(cx, 'rgba(95,246,255,.28)', x * TS + 3, y * TS + 3, 10, 10); R(cx, 'rgba(95,246,255,.5)', x * TS + 7, y * TS + 7, 2, 2); }
    else if ((x + y) % 2 === 0 && !s.map.grid[y * L.W + x]) R(cx, 'rgba(95,246,255,.1)', x * TS + 7, y * TS + 7, 2, 2);
  }
  L.grates.forEach(([x, y], i) => { R(cx, s.grates[i] ? '#0c2a2c' : '#3a4a52', x * TS + 2, y * TS + 2, 12, 12); for (let k = 0; k < 4; k++) R(cx, s.grates[i] ? '#1b5a5e' : '#7a8a92', x * TS + 3, y * TS + 3 + k * 3, 10, 1); });
  // escotillas
  for (const d of s.map.doors) for (const [x, y] of d.tiles) {
    if (!vis(x, y)) continue; const px = x * TS, py = y * TS;
    if (d.open) { R(cx, '#3a4450', px, py, 3, TS); R(cx, '#3a4450', px + TS - 3, py, 3, TS); R(cx, d.lock ? '#ff4b4b' : '#4dff88', px + 1, py + 2, 1, 2); }
    else { R(cx, d.lock ? '#5a1c1c' : '#5a6270', px, py, TS, TS); R(cx, d.lock ? '#ff4b4b' : '#ffc23d', px, py + 6, TS, 2); R(cx, 'rgba(0,0,0,.3)', px + 7, py, 2, TS); if (d.lock) { R(cx, '#ffd23d', px + 6, py + 9, 4, 3); R(cx, '#ffd23d', px + 7, py + 7, 2, 2); } }
  }
  const nb = crew ? null : G.nearby(s)[0]; // lo que haría E ahora: brilla su objeto y se muestra su letrero (el compañero invitado usa su propio letrero)
  A.glow(cx, s, t, vis, nb?.kind === 'obj' ? nb.o : null);
  // indicadores de objetos
  for (const o of s.objects) {
    if (!vis(o.x, o.y)) continue; const px = o.x * TS, py = o.y * TS;
    if (o.t === 'cajon' && o.loot.length) R(cx, Math.floor(t / 400) % 2 ? '#ffd23d' : '#c9a030', px + 12, py + 5, 2, 2);
    if (o.t === 'mant' && s.sys) R(cx, s.sys.done[o.sys] ? '#4dff88' : G.block(s).id === 'trabajo' && UI.alterna(t, 0.8) ? '#ffc23d' : '#7a6420', px + 6, py - 3, 4, 3);
    if (o.t === 'registro') { const on = s.frags[o.frag]; R(cx, on ? '#4dff88' : UI.alterna(t, 0.8) ? '#ff4b4b' : '#7a1c1c', px + 5, py + 2, 6, 2); }
    if (o.t === 'nucleo') { const k = s.iaOn ? 0.5 + 0.5 * Math.sin(t / 220) : 0; cx.fillStyle = s.iaOn ? `rgba(255,${40 + 60 * k | 0},50,${0.6 + 0.4 * k})` : '#2a3a2a'; cx.beginPath(); cx.arc(px + 8, py + 8, 6, 0, 7); cx.fill(); if (s.iaOn) { cx.fillStyle = '#fff'; cx.fillRect(px + 7, py + 7, 2, 2); } }
    if ((o.t === 'caja' || o.t === 'traje') && o.used) R(cx, 'rgba(0,0,0,.55)', px - 1, py - 1, 18, 18);
    if (o.t === 'escondite') R(cx, '#5ff6ff', px + 12, py + 9, 1, 2);
    if (o.t === 'palanca' && s.final) R(cx, s.final.lever ? '#4dff88' : (UI.alterna(t, 0.8) ? '#ffc23d' : '#ff4b4b'), px + 6, py - 4, 4, 3);
    if (o.t === 'estudio' && Math.floor(t / 600 + o.x) % 2) R(cx, '#9fd4ff', px + 10, py + 5, 1, 1);
  }
  salaEtiquetas(t); objetoEtiquetas(t);
  // cosas tiradas
  for (const f of s.floor) if (vis(Math.floor(f.x), Math.floor(f.y))) { const c = ITEMS[f.id]?.tool ? '#ffc23d' : '#c8d2e6'; R(cx, 'rgba(0,0,0,.4)', f.x * TS - 3, f.y * TS + 1, 7, 3); R(cx, c, f.x * TS - 3, f.y * TS - 3, 6, 5); R(cx, '#fff', f.x * TS - 2, f.y * TS - 2, 2, 1); }
  // problemas
  for (const h of s.hazards) drawHazard(h, t, vis);
  const mk = coop?.session.mark; if (mk) { const k = 0.5 + 0.5 * Math.sin(t / 160); cx.strokeStyle = `rgba(95,246,255,${0.5 + k * 0.5})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(mk.x * TS, mk.y * TS, 8 + k * 6, 0, 7); cx.stroke(); R(cx, '#5ff6ff', mk.x * TS - 1, mk.y * TS - 12, 2, 7); R(cx, '#5ff6ff', mk.x * TS - 3, mk.y * TS - 12, 6, 2); }
  const emg = s.sys?.emerg; if (emg) { const k = 0.5 + 0.5 * Math.sin(t / 180); cx.strokeStyle = `rgba(255,60,60,${0.4 + k * 0.6})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(emg.x * TS, emg.y * TS, 7 + k * 6, 0, 7); cx.stroke(); R(cx, '#ff4b4b', emg.x * TS - 2, emg.y * TS - 6, 4, 8); R(cx, '#ff4b4b', emg.x * TS - 2, emg.y * TS + 4, 4, 3); }
  // tripulación
  if (s.vil) {
    for (const f of s.vil.prints) if (vis(f.x, f.y)) { R(cx, `rgba(190,190,180,${Math.min(0.6, f.t / 60)})`, f.x * TS - 3, f.y * TS + 2, 2, 3); R(cx, `rgba(190,190,180,${Math.min(0.6, f.t / 60)})`, f.x * TS + 1, f.y * TS + 4, 2, 3); }
    const m = s.vil.mission;
    if (m) { const k = 0.5 + 0.5 * Math.sin(t / 150); cx.strokeStyle = `rgba(200,120,255,${0.4 + k * 0.6})`; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(m.x * TS, m.y * TS, 6 + k * 4, 0, 7); cx.stroke(); R(cx, '#d08aff', m.x * TS - 2, m.y * TS - 2, 4, 4);
      if (m.holding) { R(cx, '#0a0e17', m.x * TS - 12, m.y * TS - 16, 24, 4); R(cx, '#d08aff', m.x * TS - 12, m.y * TS - 16, 24 * m.prog / m.need, 4); } }
  }
  if (s.noise) { const k = (t / 400) % 1; cx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; cx.lineWidth = 1; cx.beginPath(); cx.arc(s.noise.x * TS, s.noise.y * TS, 4 + k * 30, 0, 7); cx.stroke(); }
  if (s.thrown) { const k = 1 - s.thrown.t / 0.5; R(cx, '#ffc23d', (s.thrown.x0 + (s.thrown.x - s.thrown.x0) * k) * TS - 1, (s.thrown.y0 + (s.thrown.y - s.thrown.y0) * k) * TS - 1 - Math.sin(k * Math.PI) * 10, 3, 3); }
  const miedo = !!G.storm(s) || s.hazards.some((h) => h.def.type !== 'camera' && h.def.type !== 'blackout');
  for (const c of s.crew) if (vis(c.x, c.y)) { astro(cx, c.x, c.y, c.dir, t / 1000, c.color, c.moving, 1, c.name, false, c.betrayed ? 'enojo' : miedo ? 'miedo' : c.say ? 'habla' : c.trust >= 2 ? 'feliz' : 'normal'); Cu.marca(cx, Math.round(c.x * TS), Math.round(c.y * TS), c.color, !FX.suave()); }
  if (s.vil) for (const w of s.vil.walkers) drawWalker(w, t, vis);
  // vigilancia (conos y drones)
  for (const d of s.drones) {
    if (!vis(d.x, d.y, 7)) continue;
    const off = !s.iaOn || d.stun > 0;
    if (!off) {
      const k = G.storm(s) ? 0.55 : 1;
      cx.fillStyle = d.mode === 'persigue' ? 'rgba(255,60,60,.22)' : 'rgba(255,200,60,.13)';
      cx.beginPath(); cx.moveTo(d.x * TS, d.y * TS);
      for (let a = -Math.PI / 4; a <= Math.PI / 4 + 0.01; a += Math.PI / 20) {
        let r = 0.2; while (r < 5.5 * k && G.los(s, d.x, d.y, d.x + Math.cos(d.dir + a) * r, d.y + Math.sin(d.dir + a) * r)) r += 0.25;
        cx.lineTo((d.x + Math.cos(d.dir + a) * r) * TS, (d.y + Math.sin(d.dir + a) * r) * TS);
      }
      cx.closePath(); cx.fill();
    }
    droneSprite(cx, d, t, off);
    if (d.stun > 0 && s.iaOn) { cx.fillStyle = '#5ff6ff'; cx.font = '9px VT323'; cx.fillText(`${Math.ceil(d.stun)}`, d.x * TS, d.y * TS - 12); }
  }
  // jugador
  const blink = p.hit > 0 && Math.abs(Math.sin(t / 200)) > 0.5; // herido: se atenúa despacio (≈1,6 Hz), no centellea
  if (p.hidden) { cx.font = '9px VT323'; cx.fillStyle = '#9fd4ff'; cx.fillText('(escondido)', p.hidden.x * TS, p.hidden.y * TS - 14); R(cx, '#fff', p.hidden.x * TS - 3, p.hidden.y * TS - 2, 1, 1); R(cx, '#fff', p.hidden.x * TS + 2, p.hidden.y * TS - 2, 1, 1); }
  else astro(cx, p.x, p.y + (p.crouch ? 0.12 : 0), p.dir, p.walk * (p.crouch ? 0.5 : 1), crew ? crew.color : '#3d7bff', keys.size > 0 || touch.dx || touch.dy, p.inDuct ? 0.5 : blink ? 0.35 : p.crouch ? 0.8 : 1, crew ? crew.who : 'Comandante', G.isOutside(s) && G.has(s, 'traje'), p.hit > 0 ? 'miedo' : s.final ? 'miedo' : 'normal', true);
  if (p.sleep) { cx.fillStyle = '#5ff6ff'; cx.font = '10px VT323'; cx.fillText('z', p.x * TS + 7, p.y * TS - 14 - (t / 300 % 4)); }

  tutoAro(t);
  A.senales(cx, s, t, vis); // «?» que se llena, «!», rastro y aviso de embestida (lo que dejó enemy-ai: sus, qT, alarmT, tele)
  // pisadas: una por cada ~0,55 casilla recorrida (nada si va agachado, en un conducto o escondido)
  if (!menu && !p.sleep && !p.hidden && !p.inDuct && !p.crouch) {
    stepAcc += Math.hypot(p.x - stepX, p.y - stepY); if (stepAcc > 0.55 && stepAcc < 3) { stepAcc = 0; A.step(p.x * TS, p.y * TS + 5, L.theme, G.isOutside(s)); } else if (stepAcc >= 3) stepAcc = 0;
  } else stepAcc = 0;
  stepX = p.x; stepY = p.y;
  if (!menu) A.ambiente(s, pdt, vis);
  if (s.sys?.emerg && Math.floor(t / 220) !== Math.floor((t - pdt * 1000) / 220)) A.burst(s.sys.emerg.x, s.sys.emerg.y, '255,120,60', 2);
  A.particles(cx, pdt, cam, VW, VH, L.theme, G.storm(s));
  // luz: noche, tormenta, final
  const night = G.isNight(s); const st = G.storm(s);
  if (night || st || s.final) {
    const px = p.x * TS, py = p.y * TS;
    const col = s.final ? `rgba(70,0,0,${0.38 + 0.12 * Math.sin(t / 220)})` : st ? 'rgba(60,20,5,.78)' : 'rgba(0,3,10,.74)';
    const gr = cx.createRadialGradient(px, py, 10, px, py, (st ? 3.2 : 4.6) * TS);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col);
    cx.fillStyle = gr; cx.fillRect(cam.x - 2, cam.y - 2, VW + 4, VH + 4);
  }
  // (el borde rojo/ámbar de «peligro cerca» ahora es A.overlays: tinte suave según s.threat, en la capa de pantalla)
  // frentes (radiación, tormenta)
  for (const h of s.hazards) if (h.def.type === 'front' && h.phase === 'barre') {
    const [r, g, b] = h.def.color; const x0 = (h.x - h.def.width) * TS, x1 = h.x * TS;
    const gr = cx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(0.8, `rgba(${r},${g},${b},.22)`); gr.addColorStop(1, `rgba(${r},${g},${b},.5)`);
    cx.fillStyle = gr; cx.fillRect(x0, 0, x1 - x0, L.H * TS);
    for (let i = 0; i < 40; i++) { const y = hashRand(i + Math.floor(t / 60)) * L.H * TS; R(cx, `rgba(${r},${g},${b},.7)`, x1 - hashRand(i * 3 + Math.floor(t / 90)) * Math.min(h.def.width, 8) * TS, y, 3, 1); }
  }
  // globos de diálogo y texto de acción
  cx.font = '10px VT323';
  for (const c of s.crew) if (c.say && vis(c.x, c.y)) bubble(c.x * TS, c.y * TS - 18, `${c.name}: ${c.say}`, c.color);
  const n = nb;
  if (s.action) { const k = s.action.t / s.action.need; R(cx, '#0a0e17', p.x * TS - 12, p.y * TS - 20, 24, 4); R(cx, '#ffc23d', p.x * TS - 12, p.y * TS - 20, 24 * k, 4); }
  else if (!p.sleep && !menu && (crew ? crewEtiqueta() : n)) bubble(p.x * TS, p.y * TS - 20, `[E] ${crew ? crewEtiqueta() : G.label(s, n)}`, '#ffffff');

  // capa de pantalla (sin cámara)
  cx.setTransform(1, 0, 0, 1, 0, 0);
  const shl = s.hazards.find((h) => h.def.type === 'shelter'); // basura orbital en menos de 10 s y fuera del refugio: tinte ámbar
  A.overlays(cx, s, t, pdt, cv.width, cv.height, shl && shl.t <= 10 && !shl.def.safe.includes(G.playerRoom(s)) ? 0.8 : 0);
  arrowToGoal(t); tutoFlecha(t); acaFlecha(t);
  minimap();
  // carteles del mundo: se apilan justo sobre la mochila (abajo al centro), nunca bajo la barra de arriba. Pulso lento (≤1 Hz) en vez de alternar colores.
  cx.textAlign = 'center'; cartelY = (invTop || cv.height - 80) - 20; const hz = FX.suave() ? 0 : 0.8;
  if (G.isOutside(s) && !p.inDuct) cartel(`O₂ ${Math.ceil(p.o2)}%${G.has(s, 'traje') ? '' : T(' · ¡SIN TRAJE!', ' · NO SUIT!')}`, p.o2 < 30 ? '#ff7a7a' : '#5ff6ff', 20, t, p.o2 < 30 ? hz : 0);
  if (document.body.classList.contains('telefono')) { /* teléfono: «escondido/agachado» ya se ve en el personaje y en el botón; no se repite */ }
  else if (p.hidden) cartel(T('ESCONDIDO · muévete o pulsa F para salir', 'HIDDEN · move or press F to come out'), '#9fd4ff', 18, t, 0);
  else if (p.crouch) cartel(T('agachado: silencioso y difícil de ver', 'crouching: quiet and hard to see'), '#9fd4ff', 16, t, 0);
  // una noche: cuenta regresiva al amanecer
  if (s.mode === 'noche' && !s.final) { const left = ((s.day >= 2 ? 360 : 1800) - s.min) / (G.MIN_PER_SEC * G.NIGHT_SPEED); cartel(T(`☀ AMANECE EN ${Meta.fmtTime(Math.max(0, left))}`, `☀ DAWN IN ${Meta.fmtTime(Math.max(0, left))}`), left < 60 ? '#ff8a8a' : '#9fd4ff', 22, t, left < 60 ? hz : 0); }
  const ms = s.vil?.mission; if (ms) { cartel(`📻 ${ms.verb} · ${G.roomName(s, ms.room)} · ${Math.ceil(ms.left)} s`, ms.left < 20 ? '#ff8a8a' : '#d08aff', 20, t, ms.left < 20 ? hz : 0); arrowTo(ms.x, ms.y, '#d08aff', G.roomName(s, ms.room), t); }
  for (const h of s.hazards) if (h.def.type === 'front' && h.phase === 'aviso') cartel(`⚠ ${h.def.name}: ${Math.ceil(h.t)} s`, '#ff8a6a', 26, t, hz);
  for (const h of s.hazards) if (h.def.type === 'shelter') { cartel(`⚠ ${h.def.name}: ${Math.ceil(h.t)} s → ${G.roomName(s, h.def.safe[0])}`, '#ff8a6a', 26, t, hz); const sr = s.L.rooms.find((x) => x.id === h.def.safe[0]); if (sr && G.playerRoom(s) !== sr.id) arrowTo((sr.x + sr.w / 2) * TS, (sr.y + sr.h / 2) * TS, '#4dff88', sr.name, t); }
  if (s.final) cartel(T(`¡DESPEGUE! ${Math.ceil(s.final.t)} s`, `LIFTOFF! ${Math.ceil(s.final.t)} s`), '#ff6b6b', 32, t, hz);
  // persecución: aviso grande con el tiempo que llevas huyendo
  const hunted = (s.iaOn && s.drones.some((d) => d.mode === 'persigue')) || s.vil?.walkers.some((w) => w.mode === 'persigue' && !w.gone && !w.away);
  chaseT = hunted && !p.hidden ? chaseT + 1 / 60 : 0;
  if (chaseT > 0 && !s.final) cartel(T(`¡TE VIERON! ESCÓNDETE · ${chaseT.toFixed(1)} s`, `YOU WERE SEEN! HIDE · ${chaseT.toFixed(1)} s`), '#ff6b6b', 28, t, hz);
  // alerta alta: las luces bajan y suben despacio (≈0,4 Hz; antes parpadeaban al azar, y eso cansa la vista)
  if (s.iaOn && s.alert > 70 && !FX.suave()) R(cx, `rgba(0,0,0,${(0.08 + 0.14 * (0.5 + 0.5 * Math.sin(t / 400))) * Math.min(1, (s.alert - 70) / 20)})`, 0, 0, cv.width, cv.height);
  // susto: tinte rojo que se desvanece al descubrir tu escondite (suave y corto; en modo suave, nada)
  if (scareT > 0) { scareT -= pdt; if (!FX.suave()) R(cx, `rgba(160,0,0,${Math.min(0.25, scareT * 0.5)})`, 0, 0, cv.width, cv.height); }
  if (mapaOn && !menu) mapaCompleto(t);
}

/** Borde de arriba de la mochila (lo mide hud()) y posición del próximo cartel del mundo (se apilan hacia arriba). */
let invTop = 0; let cartelY = 0;
/** Cartel centrado con placa oscura. hz = ciclos por segundo del pulso de brillo (0 = fijo); nunca alterna colores. */
function cartel(txt, col, px, t, hz = 0) {
  if (document.body.classList.contains('telefono')) px = Math.round(px * 0.72); // teléfono: carteles más chicos
  cx.font = `${px}px VT323`; const w = Math.min(cv.width - 16, cx.measureText(txt).width + 28), h = px + 8; const y = cartelY; cartelY -= h + 6;
  R(cx, 'rgba(8,11,18,.82)', cv.width / 2 - w / 2, y - h / 2, w, h);
  cx.globalAlpha = hz ? 0.7 + 0.3 * UI.pulso(t, hz) : 1; cx.fillStyle = col; cx.fillText(txt, cv.width / 2, y); cx.globalAlpha = 1;
}
function bubble(x, y, txt, color) {
  const max = document.body.classList.contains('telefono') ? 38 : 46; // en el teléfono los globos son cortos
  if (txt.length > max) txt = txt.slice(0, max - 1) + '…';
  const w = Math.min(190, cx.measureText(txt).width + 8);
  R(cx, 'rgba(10,14,24,.9)', x - w / 2, y - 6, w, 12); R(cx, color, x - w / 2, y + 6, w, 1);
  cx.fillStyle = '#e8f0ff'; cx.fillText(txt, x, y);
}

function drawHazard(h, t, vis) {
  const def = h.def;
  if (def.type === 'spread') {
    const [r, g, b] = def.color;
    for (const i of h.tiles) {
      const x = i % s.L.W, y = (i / s.L.W) | 0; if (!vis(x, y)) continue; const px = x * TS, py = y * TS; const f = Math.sin(t / 110 + i) * 0.5 + 0.5;
      if (h.kind === 'fuego') { R(cx, `rgba(${r},${g},${b},${0.45 + f * 0.3})`, px, py, TS, TS); R(cx, '#ffd23d', px + 4, py + 6 - f * 3, 3, 6); R(cx, '#ff6b1a', px + 9, py + 4 - f * 2, 3, 8); R(cx, 'rgba(60,60,60,.4)', px + 3, py - 4 - f * 4, 8, 4); }
      else if (h.kind === 'grieta') { R(cx, 'rgba(0,0,0,.35)', px, py, TS, TS); R(cx, '#0a0806', px + 2, py + 7, 12, 2); R(cx, '#0a0806', px + 6, py + 3, 2, 10); R(cx, '#ffb04a', px + 7, py + 8, 1, 1); }
      else if (h.kind === 'frio') { R(cx, `rgba(${r},${g},${b},${0.25 + f * 0.15})`, px, py, TS, TS); R(cx, '#e8f8ff', px + 3, py + 3, 1, 5); R(cx, '#e8f8ff', px + 1, py + 5, 5, 1); R(cx, '#e8f8ff', px + 10, py + 9, 1, 4); R(cx, '#e8f8ff', px + 9, py + 10, 3, 1); }
      else { R(cx, `rgba(${r},${g},${b},${0.3 + f * 0.2})`, px, py, TS, TS); for (let k = 0; k < 4; k++) R(cx, `rgb(${r},${g},${b})`, px + (hashRand(i + k) * 13 | 0), py + (hashRand(i * 2 + k) * 13 | 0), 2, 2); }
    }
  } else if (def.type === 'chaser') {
    if (!vis(h.x, h.y, 3)) return;
    const [r, g, b] = def.color;
    for (let k = 0; k < 14; k++) { const a = t / (def.knock ? 120 : 500) + k * 0.9; const rr = (0.3 + (k % 5) * 0.28) * TS; cx.fillStyle = `rgba(${r},${g},${b},${0.25 + (k % 3) * 0.12})`; cx.beginPath(); cx.arc(h.x * TS + Math.cos(a) * rr, h.y * TS + Math.sin(a) * rr * (def.knock ? 0.6 : 1) - (def.knock ? k * 1.2 : 0), 4 + (k % 4), 0, 7); cx.fill(); }
    cx.fillStyle = '#fff'; cx.font = '9px VT323'; cx.fillText(def.label ?? '', h.x * TS, h.y * TS);
  } else if (def.type === 'bouncer') {
    for (const b of h.bits) { cx.save(); cx.translate(b.x * TS, b.y * TS); cx.rotate(b.rot); R(cx, '#9aa4ae', -5, -3, 10, 6); R(cx, '#cfd6dc', -5, -3, 10, 2); R(cx, '#6a737c', 2, -1, 3, 3); cx.restore(); }
  } else if (def.type === 'pull') {
    for (let k = 0; k < 10; k++) { const ph = (t / 700 + k / 10) % 1; const a = k * 2.4 + t / 900; const rr = (1 - ph) * 4.5 * TS; R(cx, 'rgba(160,230,255,.75)', h.x * TS + Math.cos(a) * rr, h.y * TS + Math.sin(a) * rr, 2, 1); }
    R(cx, '#000', h.x * TS - 3, h.y * TS - 3, 6, 6); R(cx, '#5ff6ff', h.x * TS - 1, h.y * TS - 1, 2, 2);
    cx.fillStyle = '#5ff6ff'; cx.font = '10px VT323'; cx.fillText(`Tres ${Math.ceil(h.tres)} s`, h.x * TS, h.y * TS - 12);
  } else if (def.type === 'robot') robotSprite(cx, h, t, h.kind === 'rover');
  else if (def.type === 'sweep') {
    const r = s.L.rooms.find((x) => x.id === h.room); const px = h.x * TS;
    A.zonaBrazo(cx, s, h, r, t); // hueco seguro en verde y franja de barrido en rojo (antes el hueco se veía rojo: confundía)
    for (let y = r.y; y < r.y + r.h; y++) { if (y >= h.gap && y < h.gap + 2) continue; R(cx, '#d8dce2', px - 3, y * TS, 6, TS); R(cx, '#ff4b4b', px - 3, y * TS + 7, 6, 2); }
  } else if (def.type === 'shelter') {
    A.zonaRefugio(cx, s, h, t);
  } else if (def.type === 'mold') {
    for (const i of h.blocked) { const [x, y] = s.L.grates[i]; for (let k = 0; k < 7; k++) R(cx, k % 2 ? '#b07ad8' : '#7a4aa0', x * TS + 2 + hashRand(i * 9 + k) * 11, y * TS + 2 + hashRand(i * 5 + k) * 11, 3, 3); }
  } else if (def.type === 'meteor') {
    for (const m of h.marks) {
      if (m.boom > 0) { cx.fillStyle = `rgba(255,200,80,${m.boom * 3})`; cx.beginPath(); cx.arc(m.x * TS, m.y * TS, 18, 0, 7); cx.fill(); continue; }
      // zona de impacto: círculo que se cierra (sin parpadear) y un relleno rojo tenue que se intensifica al acercarse la hora
      cx.fillStyle = `rgba(255,75,60,${0.08 + 0.12 * (1 - Math.min(1, m.t / 2))})`; cx.beginPath(); cx.arc(m.x * TS, m.y * TS, 4 + m.t * 6, 0, 7); cx.fill();
      cx.strokeStyle = m.t < 0.8 ? '#ff4b4b' : '#ffc23d'; cx.lineWidth = 1; cx.beginPath(); cx.arc(m.x * TS, m.y * TS, 4 + m.t * 6, 0, 7); cx.stroke(); R(cx, '#ff4b4b', m.x * TS - 1, m.y * TS - 1, 2, 2);
    }
  } else if (def.type === 'camera') {
    if (!vis(h.x, h.y, 8)) return;
    const on = s.iaOn && h.stun <= 0;
    if (on) {
      cx.fillStyle = h.sees ? 'rgba(255,60,60,.25)' : 'rgba(255,90,200,.12)'; cx.beginPath(); cx.moveTo(h.x * TS, h.y * TS);
      for (let a = -0.45; a <= 0.46; a += 0.09) { let r = 0.2; while (r < h.def.range && G.los(s, h.x, h.y, h.x + Math.cos(h.dir + a) * r, h.y + Math.sin(h.dir + a) * r)) r += 0.25; cx.lineTo((h.x + Math.cos(h.dir + a) * r) * TS, (h.y + Math.sin(h.dir + a) * r) * TS); }
      cx.closePath(); cx.fill();
    }
    R(cx, '#3a3f48', h.x * TS - 4, h.y * TS - 7, 8, 6); R(cx, on ? (Math.floor(t / 400) % 2 ? '#ff3b3b' : '#7a1c1c') : '#222', h.x * TS - 1, h.y * TS - 3, 2, 2);
    if (h.stun > 0) { cx.fillStyle = '#5ff6ff'; cx.font = '9px VT323'; cx.fillText(`${Math.ceil(h.stun)}`, h.x * TS, h.y * TS - 12); }
  } else if (def.type === 'blackout') {
    const r = s.L.rooms.find((x) => x.id === h.room);
    R(cx, def.quarantine ? 'rgba(255,225,74,.12)' : 'rgba(0,0,0,.72)', r.x * TS, r.y * TS, r.w * TS, r.h * TS);
    if (!def.quarantine) A.lamparas(cx, r, t); // luces de emergencia rojas con pulso lento
    if (def.quarantine && Math.floor(t / 500) % 2) { cx.fillStyle = '#ffe14a'; cx.font = '10px VT323'; cx.fillText('☣ CUARENTENA', (r.x + r.w / 2) * TS, (r.y + r.h / 2) * TS); }
  }
}
function drawWalker(w, t, vis) {
  if (w.gone || w.away || !vis(w.x, w.y, 7)) return;
  const d = VILLAINS[w.vid];
  if (w.kind === 'walker' && w.mode !== 'charla') {
    let k = G.isNight(s) ? 0.8 : 1; if (G.dark(s)) k *= 0.55;
    cx.fillStyle = w.mode === 'persigue' ? 'rgba(255,60,60,.22)' : 'rgba(190,140,255,.12)';
    cx.beginPath(); cx.moveTo(w.x * TS, w.y * TS);
    for (let a = -0.9; a <= 0.91; a += 0.15) { let r = 0.2; while (r < 6 * k && G.los(s, w.x, w.y, w.x + Math.cos(w.dir + a) * r, w.y + Math.sin(w.dir + a) * r)) r += 0.25; cx.lineTo((w.x + Math.cos(w.dir + a) * r) * TS, (w.y + Math.sin(w.dir + a) * r) * TS); }
    cx.closePath(); cx.fill();
  }
  astro(cx, w.x, w.y, w.dir, t / 1000, w.shirt, w.moving, 1, w.copy ?? w.name);
  if (d.mode === 'doble') return;
  cx.font = '8px VT323'; cx.fillStyle = w.mode === 'persigue' ? '#ff4b4b' : '#d8c8ff'; cx.fillText(w.loot ? `${w.name} 💼` : w.name, w.x * TS, w.y * TS - 17);
  if (w.mode === 'charla') { cx.fillStyle = '#fff'; cx.fillText('bla bla…', w.x * TS, w.y * TS - 25); }
}

function arrowTo(wx, wy, color, name, t) {
  const gx = wx * TS - cam.x, gy = wy * TS - cam.y; if (gx > 0 && gx < VW && gy > 0 && gy < VH) return;
  const a = Math.atan2(gy - VH / 2, gx - VW / 2); const ex = cv.width / 2 + Math.cos(a) * (cv.width / 2 - 60), ey = cv.height / 2 + Math.sin(a) * (cv.height / 2 - 60);
  cx.save(); cx.translate(ex, ey); cx.rotate(a); cx.fillStyle = color; cx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 200); cx.beginPath(); cx.moveTo(12, 0); cx.lineTo(-7, -8); cx.lineTo(-7, 8); cx.fill(); cx.restore();
  cx.font = '13px VT323'; cx.fillStyle = color; cx.fillText(name, ex - Math.cos(a) * 28, ey - Math.sin(a) * 20);
}
/** 0..1: qué tan cerca está alguien que te persigue o te busca. */
function danger() {
  const p = s.p; let best = 0;
  const hunters = [...(s.iaOn ? s.drones : []), ...(s.vil?.walkers.filter((w) => !w.gone && !w.away && w.kind === 'walker') ?? []), ...s.hazards.filter((h) => h.def.type === 'robot' && h.chasing)];
  for (const h of hunters) { const d = Math.hypot(h.x - p.x, h.y - p.y); const hot = h.mode === 'persigue' || h.mode === 'busca' || h.chasing; if (d < 7) best = Math.max(best, (1 - d / 7) * (hot ? 1 : 0.35)); }
  return best;
}
// Flecha al borde de la pantalla que apunta a donde te toca estar.
function arrowToGoal(t) {
  if (s.final) return;
  const b = G.block(s); let tg = null; const em = s.sys?.emerg;
  const stm = s.sys?.storm;
  if (em) tg = { x: em.x * TS, y: em.y * TS, label: `${Math.ceil(em.t)} s`, c1: '#ff4b4b', c2: '#ffd0d0' };
  else if (stm && !Sys.inShelter(s)) { const r = s.L.rooms.find((x) => x.id === Sys.shelterOf(s).room); tg = { x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, label: `REFUGIO ${Math.ceil(stm.t)} s`, c1: '#ffc23d', c2: '#fff0b3' }; }
  else if (s.sys && b.id === 'trabajo') { const o = Sys.pending(s).map((id) => Sys.station(s, id)).sort((a, c) => Math.hypot(a.x - s.p.x, a.y - s.p.y) - Math.hypot(c.x - s.p.x, c.y - s.p.y))[0]; if (o) tg = { x: (o.x + 0.5) * TS, y: (o.y + 0.5) * TS, label: 'Mantenimiento', c1: '#ffc23d', c2: '#ffe08a' }; }
  else if (b.room && G.playerRoom(s) !== b.room) { const r = s.L.rooms.find((x) => x.id === b.room); tg = { x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, label: r.name, c1: '#ffc23d', c2: '#ffe08a' }; }
  if (!tg) return;
  const gx = tg.x - cam.x, gy = tg.y - cam.y;
  if (gx > 0 && gx < VW && gy > 0 && gy < VH) return;
  const a = Math.atan2(gy - VH / 2, gx - VW / 2); const ex = cv.width / 2 + Math.cos(a) * (cv.width / 2 - 40), ey = cv.height / 2 + Math.sin(a) * (cv.height / 2 - 40);
  cx.save(); cx.translate(ex, ey); cx.rotate(a); cx.fillStyle = tg.c1; cx.globalAlpha = FX.suave() ? 1 : 0.65 + 0.35 * UI.pulso(t, 0.8);
  cx.beginPath(); cx.moveTo(14, 0); cx.lineTo(-8, -9); cx.lineTo(-8, 9); cx.fill(); cx.restore();
  cx.font = '14px VT323'; cx.fillStyle = tg.c1; cx.textAlign = 'center'; cx.globalAlpha = 1; cx.fillText(tg.label, ex - Math.cos(a) * 30, ey - Math.sin(a) * 22);
}

/** Teléfono: sin barra de arriba, el minimapa sube a la esquina. */
function miniG(g) { if (document.body.classList.contains('telefono')) g.oy = 8; else if (document.body.classList.contains('tablet')) g.oy = 60; return g; }
function minimap() {
  const L = s.L; const g = miniG(UI.geomMinimapa(cv.width, ZOOM, L.W, L.H, cv.height)); const k = g.k; const mw = g.w, mh = g.h; const ox = cv.width - mw - g.borde, oy = g.oy;
  R(cx, 'rgba(0,0,0,.6)', ox - 3, oy - 3, mw + 6, mh + 6); cx.strokeStyle = '#33405e'; cx.strokeRect(ox - 3.5, oy - 3.5, mw + 7, mh + 7);
  const goal = G.block(s).room;
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    const g = s.map.grid[y * L.W + x]; if (!g) continue; const r = L.rooms[s.map.room[y * L.W + x]];
    cx.fillStyle = g === 2 ? '#ffc23d' : r?.id === goal ? '#3a5f9a' : r?.restricted ? '#4a1c1c' : r?.outside ? '#555' : '#2a3448';
    cx.fillRect(ox + x * k, oy + y * k, k, k);
  }
  for (const h of s.hazards) if (h.def.type !== 'front') R(cx, '#ff8a3d', ox + h.x * k - 1, oy + h.y * k - 1, 3, 3);
  if (s.sys) { if (G.block(s).id === 'trabajo') for (const id of Sys.pending(s)) { const o = Sys.station(s, id); R(cx, '#ffc23d', ox + o.x * k - 1, oy + o.y * k - 1, 3, 3); } const e = s.sys.emerg; if (e) R(cx, UI.pulso(performance.now(), 0.8) > 0.5 ? '#ff3b3b' : '#ffb0b0', ox + e.x * k - 2, oy + e.y * k - 2, 5, 5); }
  for (const c of s.crew) R(cx, c.color, ox + c.x * k - 1, oy + c.y * k - 1, 2, 2);
  if (s.vil) for (const w of s.vil.walkers) if (!w.gone && !w.away && VILLAINS[w.vid].mode !== 'doble') R(cx, w.mode === 'persigue' ? '#ff3b3b' : '#c08aff', ox + w.x * k - 1, oy + w.y * k - 1, 3, 3);
  if (s.vil?.mission) R(cx, '#d08aff', ox + s.vil.mission.x * k - 2, oy + s.vil.mission.y * k - 2, 4, 4);
  if (s.iaOn) for (const d of s.drones) R(cx, d.mode === 'persigue' ? '#ff3b3b' : '#ffc23d', ox + d.x * k - 1, oy + d.y * k - 1, 3, 3);
  R(cx, '#5ff6ff', ox + s.p.x * k - 2, oy + s.p.y * k - 2, 4, 4);
  R(cx, 'rgba(255,255,255,.25)', ox + cam.x / TS * k, oy + cam.y / TS * k, VW / TS * k, 1);
}

/**
 * Mapa completo (tecla Tab, botón MAPA o tocar el minimapa): todas las salas con su nombre, dónde estás (TÚ), el objetivo del momento
 * y lo urgente (emergencia, misión del villano, refugio de la tormenta). El juego sigue corriendo: es para ubicarse rápido, no para pausar.
 */
let mapaOn = false;
$('btn-cerrar-mapa')?.addEventListener('click', (e) => { e.stopPropagation(); alternaMapa(false); });
function alternaMapa(on = !mapaOn) { mapaOn = !!on && !!s; document.body.classList.toggle('mapa-on', mapaOn); $('btn-mapa')?.classList.toggle('sel', mapaOn); $('t-m')?.classList.toggle('sel', mapaOn); }
function mapaCompleto(t) {
  const L = s.L; const tact = !$('tactil').hidden; const tel = document.body.classList.contains('telefono'); const tab = document.body.classList.contains('tablet');
  // teléfono y tablet: el mapa ocupa todo, salvo una columna a la izquierda para los avisos y la leyenda (todos los botones se esconden; en tablet queda solo ✕ CERRAR MAPA)
  const comp = tel || tab, f = tel ? 1 : 1.3; // f = tamaño de la letra de la leyenda (la tablet se mira desde más lejos)
  const izq = tel ? Math.min(230, Math.round(cv.width * 0.28)) : tab ? Math.min(300, Math.round(cv.width * 0.27)) : 0;
  const g = tel ? UI.geomMapa(cv.width, cv.height, L.W, L.H, 52, 8, izq) : tab ? UI.geomMapa(cv.width, cv.height, L.W, L.H, 62, 14, izq) : UI.geomMapa(cv.width, cv.height, L.W, L.H, tact ? 100 : 66, tact ? 300 : 50); const k = g.k, ox = g.ox, oy = g.oy;
  R(cx, 'rgba(4,6,12,.94)', 0, 0, cv.width, cv.height);
  const goal = G.block(s).room; const aqui = G.playerRoom(s);
  const urg = new Set(); if (s.vil?.mission) urg.add(s.vil.mission.room);
  for (const h of s.hazards) if (h.def.type === 'shelter') urg.add(h.def.safe[0]);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    const c = s.map.grid[y * L.W + x]; if (!c) continue; const r = L.rooms[s.map.room[y * L.W + x]];
    cx.fillStyle = c === 2 ? '#7a6a3a' : r?.id === goal ? '#2f5a96' : urg.has(r?.id) ? '#4a2f6a' : r?.restricted ? '#4a1c1c' : r?.outside ? '#3a3a3a' : r ? '#26324a' : '#1a2132';
    cx.fillRect(ox + x * k, oy + y * k, Math.ceil(k), Math.ceil(k));
  }
  const pul = FX.suave() ? 1 : 0.6 + 0.4 * UI.pulso(t, 0.8);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const r of L.rooms) {
    const x = ox + r.x * k, y = oy + r.y * k, w = r.w * k, h = r.h * k;
    const meta = r.id === goal, tu = r.id === aqui, u = urg.has(r.id);
    if (meta || tu || u) { cx.globalAlpha = meta ? pul : 1; cx.lineWidth = 3; cx.strokeStyle = meta ? '#ffc23d' : u ? '#d08aff' : '#5ff6ff'; cx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); cx.globalAlpha = 1; cx.lineWidth = 1; }
    const px = Math.max(11, Math.min(22, k * 1.15)); cx.font = `${px}px VT323`;
    const nom = G.roomName(s, r.id); const tw = cx.measureText(nom).width;
    if (tw > w + 40) continue; // sala muy chica: el nombre se leería encima de otra
    R(cx, 'rgba(8,11,18,.75)', x + w / 2 - tw / 2 - 4, y + h / 2 - px / 2 - 2, tw + 8, px + 4);
    cx.fillStyle = meta ? '#ffc23d' : u ? '#e0b8ff' : r.restricted ? '#ff9a9a' : '#dfe8ff'; cx.fillText(nom, x + w / 2, y + h / 2);
    if (meta) { cx.font = `${px - 2}px VT323`; cx.fillStyle = '#ffc23d'; cx.fillText(T('★ OBJETIVO', '★ GOAL'), x + w / 2, y + h / 2 + px); }
  }
  if (s.sys) { if (G.block(s).id === 'trabajo') for (const id of Sys.pending(s)) { const o = Sys.station(s, id); R(cx, '#ffc23d', ox + o.x * k - 3, oy + o.y * k - 3, 6, 6); } const e = s.sys.emerg; if (e) { cx.globalAlpha = pul; R(cx, '#ff3b3b', ox + e.x * k - 5, oy + e.y * k - 5, 10, 10); cx.globalAlpha = 1; } }
  for (const c of s.crew) R(cx, c.color, ox + c.x * k - 3, oy + c.y * k - 3, 6, 6);
  if (s.vil) for (const w of s.vil.walkers) if (!w.gone && !w.away && VILLAINS[w.vid].mode !== 'doble') R(cx, w.mode === 'persigue' ? '#ff3b3b' : '#c08aff', ox + w.x * k - 3, oy + w.y * k - 3, 6, 6);
  if (s.iaOn) for (const d of s.drones) R(cx, d.mode === 'persigue' ? '#ff3b3b' : '#ffc23d', ox + d.x * k - 3, oy + d.y * k - 3, 6, 6);
  // tú: punto grande con anillo y etiqueta
  const tx = ox + s.p.x * k, ty = oy + s.p.y * k;
  cx.beginPath(); cx.arc(tx, ty, 9, 0, Math.PI * 2); cx.strokeStyle = '#5ff6ff'; cx.lineWidth = 2; cx.stroke(); cx.lineWidth = 1; R(cx, '#5ff6ff', tx - 4, ty - 4, 8, 8);
  cx.font = '18px VT323'; cx.fillStyle = '#5ff6ff'; cx.fillText(T('TÚ', 'YOU'), tx, ty - 18);
  // título y leyenda
  cx.font = '24px VT323'; cx.fillStyle = '#dfe8ff'; cx.textBaseline = 'alphabetic';
  const gr = L.rooms.find((r) => r.id === goal);
  const t1 = T('MAPA DE LA BASE', 'BASE MAP'), t2 = T(`estás en ${aqui ? G.roomName(s, aqui) : 'un pasillo'}`, `you are in ${aqui ? G.roomName(s, aqui) : 'a corridor'}`) + (gr ? T(` · objetivo: ${G.roomName(s, goal)}`, ` · goal: ${G.roomName(s, goal)}`) : '');
  if (comp) { const mx = ox + g.w / 2; cx.font = `${Math.round(17 * f)}px VT323`; let tt = `${t1} · ${t2}`; while (cx.measureText(tt).width > g.w && tt.length > 8) tt = tt.slice(0, -2); cx.fillText(tt === `${t1} · ${t2}` ? tt : tt + '…', mx, tel ? 20 : 40); }
  else if (cx.measureText(`${t1} · ${t2}`).width < cv.width - 20) cx.fillText(`${t1} · ${t2}`, cv.width / 2, oy - 14);
  else { cx.fillText(t1, cv.width / 2, oy - 34); cx.font = '18px VT323'; cx.fillStyle = '#9fd4ff'; cx.fillText(t2, cv.width / 2, oy - 12); }
  // leyenda: cada color con su cuadrito (el significado también va escrito, no depende solo del color)
  cx.font = '17px VT323'; cx.textAlign = 'left';
  const ley = [['#5ff6ff', T('tú', 'you')], ['#ffc23d', T('objetivo / tareas', 'goal / tasks')], ['#ff3b3b', T('emergencia o te persiguen', 'emergency or chasing you')], ['#d08aff', T('amenazas', 'threats')], ['#4a1c1c', T('zona prohibida', 'restricted')], [null, comp ? T('Toca para cerrar', 'Tap to close') : T('Tab o tocar para cerrar', 'Tab or tap to close')]];
  if (comp) { // teléfono y tablet: leyenda en la columna izquierda, de abajo hacia arriba
    cx.font = `${Math.round(14 * f)}px VT323`; let ly = cv.height - 12; const q = Math.round(10 * f), paso = Math.round(17 * f);
    for (const [c, x] of [...ley].reverse()) { const lx = tel ? 10 : 14; if (c) R(cx, c, lx, ly - q, q, q); cx.fillStyle = c ? '#c8d2ea' : '#8a96b4'; cx.fillText(x, lx + (c ? q + 5 : 0), ly); ly -= paso; }
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; return;
  }
  const anchoDe = ([c, x]) => cx.measureText(x).width + (c ? 18 : 0) + 22;
  const filasL = [[]]; let acc = 0; for (const it of ley) { const a = anchoDe(it); if (acc + a > cv.width - 16 && filasL.at(-1).length) { filasL.push([]); acc = 0; } filasL.at(-1).push(it); acc += a; }
  let ly = oy + g.h + 26;
  for (const fl of filasL) {
    let lx = Math.max(8, cv.width / 2 - fl.reduce((n, it) => n + anchoDe(it), 0) / 2 + 11);
    for (const [c, x] of fl) { if (c) { R(cx, c, lx, ly - 11, 12, 12); lx += 18; } cx.fillStyle = c ? '#c8d2ea' : '#8a96b4'; cx.fillText(x, lx, ly); lx += cx.measureText(x).width + 22; }
    ly += 22;
  }
  cx.textAlign = 'center';
  cx.textBaseline = 'alphabetic';
}

// ---------- panel ----------
function slot(it) { const d = ITEMS[it]; return `<div class="slot ${d.plan ? 'plan' : d.tool ? 'tool' : ''}" title="${G.itemName(s, it)}${d.info ? ' — ' + d.info : ''}">${icon(it)}</div>`; }

// Filas de vitales: ícono + etiqueta + barra + número + marca («!» bajo, «!!» crítico). Se crean UNA vez por partida y solo se actualizan,
// así la barra se desliza con transición CSS y puede animarse el aviso de daño. Qué es «bajo/crítico» lo decide src/ui.js (con pruebas).
const filas = new Map(); let filasS = null;
/**
 * Cartel del día nuevo: «DÍA N de 10», la pista con la nave de rescate acercándose y su transmisión de la mañana.
 * No tapa el juego (no recibe clics) y se va solo; en modo suave aparece y desaparece sin animación (lo apaga el CSS).
 */
let diaDe = null, diaVisto = 0, diaT = 0;
function diaNuevo() {
  const el = $('dia-nuevo'); if (!el) return; const faltan = G.DAYS - s.day + 1; const pct = Math.round(((s.day - 1) / G.DAYS) * 100); const msg = rescateLinea(s.day);
  el.innerHTML = `<p class="dn-dia">${T('DÍA', 'DAY')} ${s.day} <small>${T('de', 'of')} ${G.DAYS}</small></p>
    <div class="dn-pista" role="img" aria-label="${T(`La nave de rescate lleva ${pct} % del camino`, `The rescue ship has covered ${pct} % of the way`)}"><span class="dn-ext">🌍</span><div class="dn-linea"><i style="width:${pct}%"></i><b style="left:${pct}%">▶</b></div><span class="dn-ext">${ic(s.loc)}</span></div>
    <p class="dn-falta">${faltan > 1 ? T(`La nave de rescate llega en ${faltan} días`, `The rescue ship arrives in ${faltan} days`) : T('La nave de rescate llega mañana', 'The rescue ship arrives tomorrow')}</p>
    ${msg ? `<p class="dn-msg">📡 ${NAVE}: «${msg}»</p>` : ''}
    ${Sys.eventoHoy(s).map((e) => `<p class="dn-evento ${e.tipo}"><b>${e.tipo === 'bueno' ? '🎲' : e.tipo === 'reto' ? '📡' : '⚠'} ${T('HOY', 'TODAY')}: ${e.name}</b><br>${e.text}</p>`).join('')}`;
  el.hidden = false; clearTimeout(diaT); diaT = setTimeout(() => { el.hidden = true; }, 4500);
}
function vigilaDia() {
  if (diaDe !== s && esTactil() && !vista.cruz && getOpt('joyhint', '0') !== '1') { setOpt('joyhint', '1'); G.say(s, T('Para moverte: usa el joystick de abajo a la izquierda (o desliza el dedo en la mitad izquierda de la pantalla).', 'To move: use the joystick at the bottom left (or slide your finger on the left half of the screen).'), 'info'); }
  if (diaDe !== s) { diaDe = s; diaVisto = s.day; const el = $('dia-nuevo'); if (el) el.hidden = true; return; }
  if (s.day === diaVisto) return;
  const subio = s.day > diaVisto; diaVisto = s.day;
  if (subio && s.mode !== 'noche' && s.day <= G.DAYS && !s.over) diaNuevo();
}
function fila(cont, id, icono, nombre, opc = {}) {
  let f = filas.get(id); if (f) return f;
  const el = document.createElement('div'); el.className = `vr est-ok${opc.neutro ? ' neutro' : ''}`; el.dataset.f = id;
  el.innerHTML = `${ic(icono)}<span class="nom">${nombre}</span><div class="bv"><i></i></div><span class="val"><b></b><em></em></span><span class="dmg"></span>${opc.sub ? '<span class="sub"></span>' : ''}`;
  cont.appendChild(el);
  f = { el, fill: el.querySelector('i'), val: el.querySelector('b'), marca: el.querySelector('em'), dmg: el.querySelector('.dmg'), sub: el.querySelector('.sub'), nombre, estado: 'ok', w: '', txt: null, tt: '', trk: null, tm: 0 };
  filas.set(id, f); return f;
}
/** Aviso de daño en la barra: un destello, un empujón de 2 px y «−7» que sube y se apaga. En modo suave solo queda el número, quieto. */
function golpeFila(f, caida, sube) {
  f.dmg.textContent = UI.textoDanio(caida, sube);
  const cl = f.el.classList; cl.remove('golpe', 'golpe-est'); void f.el.offsetWidth; cl.add(FX.suave() ? 'golpe-est' : 'golpe');
  clearTimeout(f.tm); f.tm = setTimeout(() => cl.remove('golpe', 'golpe-est'), 1300);
}
/** v = valor (0–100) · pct = ancho de la barra · texto = lo que se escribe · sube = «subir es malo» (alerta, radiación) · umbral = puntos para avisar (Infinity = nunca). */
function ponFila(f, v, estado, { pct = v, texto = String(Math.floor(v)), sube = false, umbral, sub } = {}) {
  const w = `${Math.max(0, Math.min(100, pct))}%`; if (f.w !== w) { f.w = w; f.fill.style.width = w; }
  if (f.estado !== estado) { f.el.classList.remove(`est-${f.estado}`); f.el.classList.add(`est-${estado}`); f.estado = estado; f.marca.textContent = UI.MARCA[estado]; }
  if (f.txt !== texto) { f.txt = texto; f.val.textContent = texto; }
  if (sube && !f.inv) { f.inv = true; f.el.classList.add('inv'); } // barra «al revés»: llenarse es malo → raya de límite a la derecha
  const tt = UI.descripcion(f.nombre, v, estado, sube); if (f.tt !== tt) { f.tt = tt; f.el.title = tt; }
  if (sub !== undefined && f.sub && f.sub.textContent !== sub) f.sub.textContent = sub;
  const r = UI.seguir(f.trk, sube ? -v : v, performance.now(), umbral); f.trk = r.est; if (r.caida > 0) golpeFila(f, r.caida, sube);
}
const SIS_ICONO = { vida: 'vida', energia: 'energia', rad: 'rad', comida: 'comida' };
const SIS_UMBRAL = { vida: 'vida', energia: 'energiaBase', rad: 'rad', comida: 'comida' };
function hud() {
  const p = s.p; const b = G.block(s); const L = s.L; vigilaDia();
  if (filasS !== s) { filasS = s; filas.clear(); for (const id of ['stats', 'filas-ia', 'sis-barras']) $(id).innerHTML = ''; }
  { const cb = $('coop-badge'); cb.hidden = !coop && !crew; if (crew) { cb.textContent = crew.up ? `🧑‍🚀 ${T('ERES', 'YOU ARE')}: ${(crew.who ?? '…').toUpperCase()}` : T('🧑‍🚀 RECONECTANDO…', '🧑‍🚀 RECONNECTING…'); cb.className = crew.up ? 'ok' : 'pend'; } else if (coop && coop.session.rol === 'crew') { const up = coop.session.up; cb.textContent = up ? `🧑‍🚀 ${T('JUEGA', 'PLAYS')}: ${(coop.session.who ?? '…').toUpperCase()}` : T('🧑‍🚀 COMPAÑERO: ESPERANDO…', '🧑‍🚀 CREWMATE: WAITING…'); cb.className = up ? 'ok' : 'pend'; } else if (coop) { const up = coop.session.up, rec = coop.link.estado === 'reconectando'; cb.textContent = rec ? '🛰️ RECONECTANDO…' : up ? '🛰️ CONTROL: CONECTADO' : '🛰️ CONTROL: ESPERANDO…'; cb.className = up && !rec ? 'ok' : 'pend'; } }
  $('dia').textContent = s.mode === 'noche' ? `${s.daily ? T('RETO', 'DAILY') : T('UNA NOCHE', 'ONE NIGHT')} · ${nm(G.dif(s)).toUpperCase()} · ${Meta.fmtTime(s.t)}` : `${T('DÍA', 'DAY')} ${s.day}/${G.DAYS} · ${nm(G.dif(s)).toUpperCase()}`;
  { const d = $('ic-dest'); if (d.dataset.loc !== s.loc) { d.dataset.loc = s.loc; d.innerHTML = ic(s.loc); } }
  $('reloj').textContent = G.clock(s.min);
  const late = b.room && s.checked && G.playerRoom(s) !== b.room;
  $('bloque').textContent = b.room ? `${b.name.toUpperCase()} → ${G.roomName(s, b.room)}` : b.name.toUpperCase();
  $('bloque').className = late ? 'tarde' : '';
  // tú
  const vit = $('stats');
  // Cadete (7-12): menos barras a la vista; fuerza y saber vuelven si abres el PLAN (la ruta extra de escape)
  document.body.classList.toggle('cadete', s.dif === 'cadete'); document.body.classList.toggle('ver-plan', !!ui.plan);
  ponFila(fila(vit, 'salud', 'salud', T('SALUD', 'HEALTH')), p.salud, UI.nivel('salud', p.salud));
  ponFila(fila(vit, 'energia', 'energia', T('TU ENERGÍA', 'YOUR ENERGY')), p.energia, UI.nivel('energia', p.energia));
  ponFila(fila(vit, 'fuerza', 'fuerza', T('FUERZA', 'STRENGTH'), { neutro: true }), p.fuerza, 'ok');
  ponFila(fila(vit, 'saber', 'saber', T('SABER', 'KNOWLEDGE'), { neutro: true }), p.conoc, 'ok');
  if (L.rooms.some((r) => r.outside)) ponFila(fila(vit, 'o2', 'vida', T('OXÍGENO', 'OXYGEN')), p.o2, UI.nivel('o2', p.o2));
  // vigilancia de la IA e integridad de la base
  $('t-alerta').textContent = T(`${L.ai} · VIGILANCIA`, `${L.ai} · SURVEILLANCE`);
  const ia = $('filas-ia'); const al = s.iaOn ? s.alert : 0;
  ponFila(fila(ia, 'alerta', 'alerta', T('ALERTA', 'ALERT')), al, UI.nivel('alerta', al), { sube: true, umbral: 6, texto: s.iaOn ? String(Math.floor(al)) : 'OFF' });
  ponFila(fila(ia, 'integ', 'integ', 'INTEGRIDAD'), Math.max(0, s.integ), UI.nivel('integ', s.integ));
  const sv = Sys.view(s); $('ov-sis').hidden = !sv; if (!sv) $('rev').hidden = true;
  if (sv) {
    for (const m of sv.meters) {
      const f = fila($('sis-barras'), `sis-${m.id}`, SIS_ICONO[m.id], m.name, { sub: m.id === 'rad' });
      if (m.id === 'rad') ponFila(f, sv.dosePct, UI.nivel('rad', sv.dosePct), { sube: true, umbral: Infinity, texto: `${Math.floor(sv.dosePct)}%`, sub: T(`dosis ${sv.dose.toFixed(1)}/${sv.limit} mSv · blindaje ${Math.floor(sv.blind)}%`, `dose ${sv.dose.toFixed(1)}/${sv.limit} mSv · shielding ${Math.floor(sv.blind)}%`) });
      else ponFila(f, m.v, UI.nivel(SIS_UMBRAL[m.id], m.v), { texto: `${Math.floor(m.v)}%` });
    }
    const evs = sv.events.map((e) => `<li class="evento">${ic('warn')} ${e.name}: ${e.text}</li>`).join('');
    const tareas = evs + `<li class="enc">${T('REVISIONES DE HOY · 08:00–12:00', 'TODAY\'S CHECKS · 08:00–12:00')}</li>` + sv.tasks.map((k) => `<li class="${k.done ? 'ok' : ''}" title="${k.name}">${k.short} <small>→ ${k.room}</small></li>`).join('');
    const nd = sv.tasks.filter((k) => k.done).length; const rv = $('rev'); rv.hidden = b.id !== 'trabajo'; rv.textContent = T(`REVISIONES ${nd}/${sv.tasks.length} [1]`, `CHECKS ${nd}/${sv.tasks.length} [1]`); rv.className = nd < sv.tasks.length ? 'pend' : 'ok';
    if ($('sistemas').dataset.h !== tareas) { $('sis-tareas').innerHTML = tareas; $('sistemas').dataset.h = tareas; $('sis-nota').textContent = sv.note; }
  }
  const em = sv?.emerg; const sm = !em && sv?.storm; $('emerg').hidden = !em && !sm;
  $('emerg').classList.toggle('tormenta', !!sm); $('emerg').classList.toggle('a-salvo', !!sm && sm.inShelter);
  if (em) $('emerg').innerHTML = `${ic('warn')} <b>${em.name}</b><br>${em.verb} → ${em.room} · <b>${Math.ceil(em.t)} s</b><div class="cuenta"><i style="width:${Math.max(0, em.t / em.total * 100)}%"></i></div>`;
  else if (sm) $('emerg').innerHTML = `${ic('rad')} ${T(`<b>TORMENTA SOLAR ${sm.n}/3 · clase ${sm.cls}</b>`, `<b>SOLAR STORM ${sm.n}/3 · class ${sm.cls}</b>`)}<br>${sm.phase === 'aviso'
    ? (sm.inShelter ? T(`Estás en el refugio (${sm.shelter}). Llegan en <b>${Math.ceil(sm.t)} s</b>`, `You are in the shelter (${sm.shelter}). They arrive in <b>${Math.ceil(sm.t)} s</b>`) : T(`¿Refugio (${sm.shelter}) o sigues? Llegan en <b>${Math.ceil(sm.t)} s</b> · afuera: ${sm.dose} mSv`, `Shelter (${sm.shelter}) or keep going? They arrive in <b>${Math.ceil(sm.t)} s</b> · outside: ${sm.dose} mSv`))
    : (sm.inShelter ? T(`Partículas afuera: quédate en el refugio <b>${Math.ceil(sm.t)} s</b>`, `Particles outside: stay in the shelter <b>${Math.ceil(sm.t)} s</b>`) : T(`¡Te están llegando partículas! Refugio: ${sm.shelter} · <b>${Math.ceil(sm.t)} s</b>`, `Particles are reaching you! Shelter: ${sm.shelter} · <b>${Math.ceil(sm.t)} s</b>`))}<div class="cuenta"><i style="width:${Math.max(0, sm.t / sm.total * 100)}%"></i></div><small>${sm.source}</small>`;
  if (sv?.last && sv.last.n !== stormShown && !menu && !s.over) { stormShown = sv.last.n; stormCard(sv.last); }
  // actividad actual: siempre a la vista (lo que toca hacer ahora y dónde)
  { const falta = Math.max(0, Math.round(b.to - s.min)); const enSala = !b.room || G.playerRoom(s) === b.room; let txt;
    const pend = sv && b.id === 'trabajo' ? sv.tasks.filter((k) => !k.done) : [];
    if (pend.length) txt = `<small>${T('AHORA', 'NOW')} · ${b.name.toUpperCase()}</small><b>${T('Revisar', 'Check')}: ${pend[0].name}</b> → ${pend[0].room}${pend.length > 1 ? ` <small>(+${pend.length - 1} ${T('más', 'more')})</small>` : ''}`;
    else if (b.id === 'dormir') txt = `<small>${T('AHORA', 'NOW')}</small><b>${s.min >= 1320 || s.min < 360 ? T('Duerme en tu cama', 'Sleep in your bed') : b.name}</b>${b.room ? ' → ' + G.roomName(s, b.room) : ''}`;
    else txt = `<small>${T('AHORA', 'NOW')}</small><b>${b.name}</b>${b.room ? ' → ' + G.roomName(s, b.room) : ''}`;
    const el = $('actividad'); const h = `${txt}|${enSala}|${falta}`;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = `${txt}<span class="falta">${enSala ? ic('ok') + T(' en la sala', ' in the room') : T('¡ve!', 'go!')} · ${falta} min</span>`; el.className = `caja ${enSala ? 'ok' : 'va'}`; } }
  const cap = G.capacity(s); $('cap').textContent = `${p.inv.length}/${cap}`;
  $('inv').innerHTML = Array.from({ length: cap }, (_, i) => (p.inv[i] ? slot(p.inv[i]) : '<div class="slot vacio"></div>')).join('');
  { const hi = $('inv').parentElement.parentElement; hi.classList.toggle('llena', p.inv.length >= cap); invTop = hi.getBoundingClientRect().top; }
  $('plan').innerHTML = planHTML();
  $('crew').innerHTML = crewHTML();
  const th = amenazasHTML();
  if ($('amenazas').dataset.h !== th) { $('amenazas').innerHTML = th; $('amenazas').dataset.h = th; }
  if (!$('c-reg').hidden) { const html = logHTML(8); if ($('log').dataset.h !== html) { $('log').innerHTML = html; $('log').dataset.h = html; } }
  { const g = miniG(UI.geomMinimapa(cv.width, ZOOM, L.W, L.H, cv.height)); $('cajones').style.paddingTop = `${g.oy + g.h + 12}px`; }
  toasts(); paneles();
}
/** Retrato de un compañero (el mismo dibujo del mapa, de frente): una imagen chica por personaje y ánimo, guardada para no dibujarla cada vez. */
const retratos = new Map();
function retrato(nombre, color, emo = 'normal', clase = 'retrato') {
  const k = nombre + '|' + color + '|' + emo; let u = retratos.get(k);
  if (!u) { const c = document.createElement('canvas'); c.width = 18; c.height = 26; Cu.dibujaCuerpo(c.getContext('2d'), { x: 9, y: 17, f: 'd', step: 0, key: nombre, shirt: color, emo, anim: false }); u = c.toDataURL(); retratos.set(k, u); }
  return `<img class="${clase}" src="${u}" alt="" width="18" height="26">`;
}
const emoDe = (c) => (c.betrayed ? 'enojo' : c.trust >= 2 ? 'feliz' : 'normal');
/** Ficha de cada compañero (pausa → TRIPULACIÓN): oficio, forma de ser, su frase y cómo está contigo. */
const crewFichas = () => s.crew.filter((c) => !c.host).map((c) => { const f = ficha(c.name); const estado = c.betrayed ? `<span style="color:var(--bad)">${T('te delata', 'reports you')}</span>` : c.want ? T('pide', 'asks for') + ` ${icon(c.want)} ${ITEMS[c.want].name}` : T('contento', 'happy'); return `<li class="ficha">${retrato(c.name, c.color, emoDe(c))}<b style="color:${c.color}">${c.name}</b>${f ? ` · ${f.rol} · <i>${f.rasgo}</i><br><small>“${f.frase}”</small>` : ''}<br>${c.betrayed ? '💔' : '♥'.repeat(Math.max(0, Math.min(2, c.trust))) + '♡'.repeat(Math.max(0, 2 - c.trust))} ${estado}</li>`; }).join('');
const crewHTML = () => s.crew.filter((c) => !c.host).map((c) => `<li>${retrato(c.name, c.color, emoDe(c), 'retrato-mini')} <span class="nom" title="${ficha(c.name) ? `${ficha(c.name).rol} · ${ficha(c.name).rasgo}` : ''}">${c.name}</span> <span class="cor">${c.betrayed ? '💔' : '♥'.repeat(Math.max(0, Math.min(2, c.trust))) + '♡'.repeat(Math.max(0, 2 - c.trust))}</span><span class="dos">:</span> ${c.betrayed ? `<span style="color:var(--bad)">${T('te delata', 'reports you')}</span>` : c.want ? `<span class="txt-pide">${T('pide', 'asks for')}</span> <span class="pide" title="${ITEMS[c.want].name}">${icon(c.want)}<span class="pn"> ${ITEMS[c.want].name}</span></span>` : `<span class="txt-pide">${T('contento', 'happy')}</span>`}</li>`).join('');

const planHTML = (L = s.L) => G.PLAN_IDS.map((id) => `<li class="${G.has(s, id) ? 'ok' : ''}" title="${L.plan[id].hint}">${L.plan[id].name}</li>`).join('') + `<li class="${s.iaOn ? '' : 'ok'}" title="${T('Opcional: núcleo de la IA con tarjeta y 50 de conocimiento.', 'Optional: the AI core, with a card and 50 knowledge.')}">${T('(Opcional) Apagar a ', '(Optional) Shut down ')}${L.ai}</li>` + G.routes(s).filter((r) => r.id !== 'plan').map((r) => `<li class="ruta ${r.ok ? 'ok' : ''}" title="${r.desc}">${T('Ruta ', 'Route ')}${r.name}${r.ok ? ' ✓' : ''}</li>`).join('');
function amenazasHTML() {
  const v = s.vil; if (!v) return `<li>${T('Sin amenazas especiales.', 'No special threats.')}</li>`;
  return v.today.map((id, i) => `<li class="${i === 0 ? 'ia' : ''}">${i === 0 && !s.iaOn ? '<s>' + VILLAINS[id].name + '</s>' : VILLAINS[id].name}<small>${VILLAINS[id].desc}</small></li>`).join('')
    + (v.mission ? `<li class="mision">📻 ${v.mission.verb} (${Math.ceil(v.mission.left)} s)<small>${v.mission.text}</small></li>` : '');
}
const logHTML = (n) => s.log.slice(-n).reverse().map((l) => `<li class="${l.kind}">${l.kind === 'day' ? '' : G.clock(l.min) + ' '}${l.text}</li>`).join('');
function mantHTML() {
  const sv = Sys.view(s); if (!sv) return `<li>${T('Este destino no tiene sistemas que mantener.', 'This destination has no systems to maintain.')}</li>`;
  return sv.events.map((e) => `<li class="evento ${e.tipo ?? 'malo'}">${e.tipo === 'bueno' ? '🎲' : e.tipo === 'reto' ? '📡' : '⚠'} ${e.name}: ${e.text}</li>`).join('') + `<li class="enc">${T('REVISIONES DE HOY · 08:00–12:00', 'TODAY\'S CHECKS · 08:00–12:00')}</li>` + sv.tasks.map((k) => `<li class="${k.done ? 'ok' : ''}" title="${k.name}">${k.name} <small>→ ${k.room}</small></li>`).join('') + `<li class="nota">${sv.note}</li>`;
}

// ---------- paneles con tecla y avisos flotantes ----------
const ui = { mant: false, plan: false, amen: false, reg: false };
const PANEL_ID = { mant: 'sistemas', plan: 'c-plan', amen: 'c-amen', reg: 'c-reg' };
function togglePanel(k) { ui[k] = !ui[k]; M.ui(ui[k] ? 'abrir' : 'cerrar'); hud(); }
function paneles() {
  const sv = Sys.view(s);
  for (const k of Object.keys(ui)) { const el = $(PANEL_ID[k]); el.hidden = !ui[k] || (k === 'mant' && !sv); }
  document.querySelectorAll('#teclas [data-panel]').forEach((b) => b.classList.toggle('sel', !!ui[b.dataset.panel]));
  $('btn-nombres')?.classList.toggle('sel', vista.nombres);
  document.body.classList.toggle('panel-abierto', Object.values(ui).some(Boolean)); // en el teléfono el panel abierto tapa los avisos
}
let toastS = null; let seenLog = 0;
const KIND_IC = { ok: 'ok', warn: 'warn', bad: 'bad', ia: 'alerta', day: 'dia', info: 'info' }; // cada aviso lleva su ícono: el tipo no depende solo del color
const vivos = []; // avisos que están en pantalla ahora: { id, kind, text, li, timer }
function quitaAviso(v) { clearTimeout(v.timer); if (document.body.classList.contains('telefono')) v.li.remove(); else { v.li.classList.add('sale'); setTimeout(() => v.li.remove(), 500); } // teléfono: se va al instante (nunca se ven dos)
  const i = vivos.indexOf(v); if (i >= 0) vivos.splice(i, 1); }
/** Pasa los mensajes nuevos del registro a pantalla SOLO si caben en el presupuesto (src/avisos.js): tope de 3, sin repetidos, sin ruido en emergencias. */
function toasts() {
  const ul = $('avisos');
  if (toastS !== s) { toastS = s; seenLog = s.logSeq ?? 0; ul.innerHTML = ''; vivos.length = 0; return; }
  const emergencia = !$('emerg').hidden;
  for (const l of s.log) {
    if ((l.id ?? 0) <= seenLog) continue; seenLog = l.id;
    const tel = document.body.classList.contains('telefono'), tab = document.body.classList.contains('tablet');
    const r = admite(vivos, l, tel ? { emergencia, max: 1, minPrio: 3 } : tab && emergencia ? { emergencia, max: 1 } : { emergencia }); // teléfono: 1 aviso y solo lo importante; tablet con un cartel de emergencia: 1 (así la columna no llega al jugador)
    for (const id of r.quitar) { const v = vivos.find((x) => x.id === id); if (v) quitaAviso(v); }
    if (!r.mostrar) continue; if (vozAuto() && ['bad', 'ia', 'warn'].includes(l.kind)) Voz.hablar(l.text, { prio: l.kind === 'warn' ? 'baja' : 'alta' });
    const li = document.createElement('li'); li.className = l.kind; li.innerHTML = `${ic(KIND_IC[l.kind] ?? 'info')}<span>${l.text}</span>`; ul.appendChild(li);
    const v = { id: l.id, kind: l.kind, text: l.text, li }; v.timer = setTimeout(() => quitaAviso(v), TTL[l.kind] ?? 3000); vivos.push(v);
  }
}
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }

// Íconos de piezas en pixel art (SVG chico).
const ICON = {
  cinta: ['#c9c9c9', 'M3 5h10v6H3z M6 7h4v2H6z'], tela: ['#e0c080', 'M2 3h12v10H2z'], tornillos: ['#aab', 'M4 3h3v3H4z M9 7h3v3H9z M5 10h3v3H5z'], placa: ['#9aa4b0', 'M2 5h12v6H2z'],
  cable: ['#ff6b3d', 'M2 8h4v-4h4v8h4'], tubo: ['#c8ccd2', 'M6 1h4v14H6z'], chip: ['#3dd68c', 'M4 4h8v8H4z M2 6h2v1H2z M12 9h2v1h-2z'], bateria: ['#ffd23d', 'M4 3h8v11H4z M6 1h4v2H6z'],
  filtro: ['#555', 'M3 3h10v10H3z'], sellador: ['#5fb6ff', 'M5 2h6v12H5z'], cartucho: ['#e8e8e8', 'M5 3h6v10H5z'],
  destornillador: ['#ffc23d', 'M3 13l7-7 2 2-7 7z M10 3h3v3h-3z'], amarra: ['#ffc23d', 'M3 5h10v2H3z M3 9h10v2H3z'], parche: ['#5ff6ff', 'M3 3h10v10H3z'],
  extintor: ['#ff4b4b', 'M5 4h6v11H5z M7 1h3v3H7z'], mascara: ['#9aa4b0', 'M3 4h10v6l-3 3H6l-3-3z'], aspiradora: ['#ffc23d', 'M3 6h8v7H3z M11 8h3v2h-3z'],
  resina: ['#c96bff', 'M5 2h6v12H5z'], fungicida: ['#7ad35f', 'M5 3h6v11H5z M7 1h2v2H7z'], kit: ['#ff8a3d', 'M2 5h12v8H2z M6 3h4v2H6z'],
  inhibidor: ['#5ff6ff', 'M8 1l-4 8h4l-2 6 6-9H8z'], tarjeta: ['#4dff88', 'M2 4h12v8H2z M4 6h4v1H4z'], llave: ['#ffd23d', 'M2 6h5v4H2z M7 7h7v2H7z M12 9h2v2h-2z'],
  traje_roto: ['#aa8888', 'M5 1h6v5H5z M4 6h8v6H4z M4 12h3v3H4z M9 12h3v3H9z'], traje: ['#e8eef5', 'M5 1h6v5H5z M4 6h8v6H4z M4 12h3v3H4z M9 12h3v3H9z'],
  codigo: ['#5ff6ff', 'M2 3h12v10H2z M4 6h2v1H4z M7 6h2v1H7z M10 6h2v1h-2z M4 9h8v1H4z'], celda: ['#ff8a3d', 'M4 2h8v12H4z M6 5h4v2H6z'],
};
function icon(id) { const [c, d] = ICON[id] ?? ['#fff', 'M4 4h8v8H4z']; return `<svg viewBox="0 0 16 16" width="22" height="22" shape-rendering="crispEdges"><path d="${d}" fill="${c}" stroke="${c}" stroke-width=".5"/></svg>`; }

// ---------- ventanas ----------
function open(html, cls = '') { $('modal').className = `modal ${cls}`.trim(); $('ventana').innerHTML = html; $('modal').hidden = false; $('ventana').scrollTop = 0; $('modal').scrollTop = 0; M.ui('abrir'); ponBotonLeer(); }
function close() { Voz.parar(); if (!$('modal').hidden) M.ui('cerrar'); $('modal').hidden = true; menu = null; document.body.classList.remove('sin-juego'); }

/** Interruptor accesible (role=switch): ícono + etiqueta + palanca + SÍ/NO. El estado se lee y se ve, no depende solo del color. */
function interruptor(id, icono, etiqueta, activo, pista = '', extra = '') {
  return `<button class="sw" id="${id}" role="switch" aria-checked="${!!activo}" ${extra}>${ic(icono)}<span>${etiqueta}${pista ? `<br><small>${pista}</small>` : ''}</span><span class="pista"></span><span class="on-off">${activo ? 'SÍ' : 'NO'}</span></button>`;
}
function pintaInterruptor(id, activo) { const b = $(id); if (!b) return; b.setAttribute('aria-checked', String(!!activo)); b.querySelector('.on-off').textContent = activo ? T('SÍ', 'YES') : 'NO'; }
/** Ajustes de sonido y vista (los mismos en el título y en la pausa). get() = estado actual; set() = lo cambia. */
const AJ = {
  musica: { id: 'sw-musica', ico: 'musica', get txt() { return T('MÚSICA', 'MUSIC'); }, get pista() { return T('Tecla M', 'Key M'); }, get: () => M.on(), set: () => { M.toggle(); if (M.on()) M.ui('ok'); } },
  sfx: { id: 'sw-sfx', ico: 'sfx', get txt() { return T('EFECTOS DE SONIDO', 'SOUND EFFECTS'); }, get pista() { return T('Pasos, alarmas y avisos', 'Steps, alarms and alerts'); }, get: () => M.sfxOn(), set: () => M.toggleSfx() },
  suave: { id: 'sw-suave', ico: 'suave', get txt() { return T('EFECTOS VISUALES SUAVES', 'SOFT VISUAL EFFECTS'); }, get pista() { return T('Sin sacudidas ni destellos', 'No shaking or flashes'); }, get: () => FX.suave(), set: () => FX.toggleFx() },
  voz: { id: 'sw-voz', ico: 'sfx', get txt() { return T('LEER EN VOZ ALTA', 'READ ALOUD'); }, get pista() { return T('Lee las ventanas y los avisos importantes', 'Reads windows and important alerts'); }, get: () => vozAuto(), set: () => { alternaVoz(); } },
  cruz: { id: 'sw-cruz', ico: 'jugar', get txt() { return T('CRUZ DE FLECHAS', 'ARROW PAD'); }, get pista() { return T('Si NO, te mueves deslizando el dedo por el mapa', 'If NO, you move by sliding your finger on the map'); }, get: () => vista.cruz, set: () => { vista.cruz = !vista.cruz; setOpt('cruz', vista.cruz ? '1' : '0'); sincTactil(); } },
  rueda: { id: 'sw-rueda', ico: 'jugar', get txt() { return T('CONTROLES COMO EN EL CELULAR', 'PHONE-STYLE CONTROLS'); }, get pista() { return T('Joystick y un solo botón USAR: mantenlo 2 s y desliza el dedo a la acción', 'Joystick and a single USE button: hold it 2 s and slide your finger to the action'); }, get: () => vista.rueda, set: () => { vista.rueda = !vista.rueda; setOpt('rueda', vista.rueda ? '1' : '0'); sincTactil(); } },
  nombres: { id: 'sw-nombres', ico: 'nombres', get txt() { return T('NOMBRES DE OBJETOS', 'OBJECT NAMES'); }, get pista() { return T('Tecla N', 'Key N'); }, get: () => vista.nombres, set: () => alternaNombres() },
};
const ajustesHTML = (claves) => claves.map((k) => interruptor(AJ[k].id, AJ[k].ico, AJ[k].txt, AJ[k].get(), AJ[k].pista)).join('');
function cableaAjustes(claves) { for (const k of claves) { const a = AJ[k]; $(a.id).onclick = () => { a.set(); pintaInterruptor(a.id, a.get()); sincBotones(); }; } }
/** Refleja en los botones de la barra de arriba el estado real de la música (la tecla M, el botón y la pausa llegan aquí). */
function sincBotones() { const b = $('btn-musica'); b.classList.toggle('off', !M.on()); b.setAttribute('aria-pressed', String(M.on())); b.title = M.on() ? T('Música: sí (M)', 'Music: on (M)') : T('Música: no (M)', 'Music: off (M)'); }
FX.onFx((m) => document.body.classList.toggle('suave', m === 'suave')); document.body.classList.toggle('suave', FX.suave());

let masAbierto = false; // «más opciones» del título se queda abierto/cerrado al cambiar algo
// ---------- Academia de Cadetes (tutorial de 5 salas; la lógica vive en academia.js) ----------
// La PRIMERA vez (lfr.academia ≠ '1') el juego empieza en la Academia en lugar del menú; al "pasarla" se abre el menú con todo.
// Las pruebas automáticas (navigator.webdriver) no la ven salvo con ?academia. Se repite desde el título (MÁS OPCIONES → APRENDER).
let aca = null;
const debeAcademia = () => getOpt('academia', '0') !== '1' && (!navigator.webdriver || new URLSearchParams(location.search).has('academia'));
function academia() {
  M.start(); s = G.newGame('academia', undefined, 'cadete'); base = null; aca = Aca.nuevo(); document.body.classList.remove('derrota', 'sin-juego'); document.body.classList.add('en-academia');
  const c = Aca.contexto();
  open(`<h2>🎓 ${c.titulo}</h2>${c.parrafos.map((x) => `<p>${x}</p>`).join('')}
    <ol class="aca-salas">${[T('Llegada', 'Arrival'), T('Recolecta', 'Collect'), T('Zona vigilada', 'Watched zone'), T('Entrena y estudia', 'Train and study'), T('Egreso', 'Graduation')].map((x) => `<li>${x}</li>`).join('')}</ol>
    <div class="fila fila-fija"><button id="ok" class="grande">${ic('jugar')} ${T('EMPEZAR', 'START')}</button></div>`);
  menu = 'aca-intro'; $('ok').onclick = close; pintaAca();
}
let acaT = 0;
function academiaFrame(dt) {
  if (!s || s.mode !== 'academia' || !aca || menu || s.over) return;
  if (Aca.tick(aca, s)) { M.ui('ok'); acaT = 0; }
  if ((acaT -= dt) <= 0) { acaT = 0.25; pintaAca(); } // los contadores (fuerza, saber, ✔) cambian mientras juegas
}
function pintaAca() {
  const el = $('tuto'); if (!el || !s || s.mode !== 'academia' || !aca) return; document.body.classList.add('tuto-on'); if (el.hidden || !el.innerHTML) el.dataset.h = '';
  const x = Aca.texto(aca, s, esTactil(), document.body.classList.contains('rueda-on')); if (!x) { el.hidden = true; return; }
  const h = `<small>🎓 ${T('ACADEMIA', 'ACADEMY')} · ${x.n}</small><b>${x.titulo}</b><p>${x.texto}</p>`;
  if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } el.hidden = false;
}
function acaFlecha(t) { if (!s || s.mode !== 'academia' || !aca) return; const o = Aca.objetivo(aca, s); if (o) arrowTo(o.x, o.y, '#ffc23d', T('AQUÍ', 'HERE'), t); }
/** Al sentarse en el asiento de salida: la Academia queda aprobada y se abre el menú. */
function academiaFin() {
  setOpt('academia', '1'); aca = null; $('tuto').hidden = true; document.body.classList.remove('tuto-on'); M.sfx('fin_bien');
  open(`<h2>🎓 ${T('¡EGRESASTE DE LA ACADEMIA!', 'YOU GRADUATED FROM THE ACADEMY!')}</h2>
    <p>${T('Usaste lo que fabricaste para salir. Ya sabes moverte, recolectar, esconderte del dron, entrenar, estudiar, fabricar y usar lo que fabricas.', 'You used what you crafted to get out. You can now move, collect, hide from the drone, train, study, craft and use what you craft.')}</p>
    <p>${T('Ahora se abre el menú: elige destino (Estación, Luna o Marte), modo y dificultad. En tu primera misión, un entrenamiento corto te enseñará a cuidar la base.', 'Now the menu opens: choose a destination (Station, Moon or Mars), mode and difficulty. On your first mission, a short training will teach you to look after the base.')}</p>
    <div class="fila fila-fija"><button id="ok" class="grande">${ic('jugar')} ${T('IR AL MENÚ', 'GO TO THE MENU')}</button></div>`);
  menu = 'aca-fin'; $('ok').onclick = () => { s = null; base = null; document.body.classList.remove('en-academia'); titleScreen(); };
}

function titleScreen() {
  if (debeAcademia()) { academia(); return; } // la primera vez: Academia antes que el menú
  document.body.classList.remove('en-academia');
  document.body.classList.remove('derrota');
  coopStop(); menu = 'titulo'; document.body.classList.add('sin-juego'); M.idle(); aud.amb = ''; const mt = Meta.load(); const mode = getOpt('modo', 'campana'); let perk = getOpt('perk', 'novato'); if (!Meta.isUnlocked(mt, perk)) perk = 'novato';
  if (!Meta.difUnlocked(mt, getDif())) setDif('normal');
  const reflejos = getOpt('reflejos', '0') === '1'; const sel = LOCS[getOpt('dest', 'estacion')] ? getOpt('dest', 'estacion') : 'estacion';
  const dd = Meta.daily(); const dy = { done: mt.daily[dd.key]?.best ?? null };
  const cards = Object.values(LOCS).map((L) => { const st = best(L.id); return `<button class="tarjeta ${L.id === sel ? 'sel' : ''}" data-loc="${L.id}" aria-pressed="${L.id === sel}"><svg class="arte" aria-hidden="true"><use href="#a-${L.id}"/></svg><span class="txt"><span class="nombre">${nm(L).toUpperCase()}</span><span class="tag">${T(L.tag, L.tagEn)}</span><span class="ia">${T('IA', 'AI')}: ${L.ai}</span><span class="est" title="${T('Tus estrellas aquí', 'Your stars here')}">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span></span><span class="marca">${ic('ok')} ${T('ELEGIDO', 'SELECTED')}</span></button>`; }).join('');
  const sv = load(sel); const hayGuardada = !!(sv && !sv.over);
  open(`<div class="inicio${tituloEntra ? ' entra' : ''}">
    ${idiomaHTML()}<p class="kicker">${T('ENTRENAMIENTO DE CADETES ASTRONAUTA', 'ASTRONAUT CADET TRAINING')}</p>
    <h1 class="logo-grande">${ic('integ')}CUSTODIA</h1>
    <p class="sublema">${T('MANTÉN VIVA LA BASE · VUELVE A CASA', 'KEEP THE BASE ALIVE · COME HOME')}</p>
    <p class="lema">${T(`El rescate llega en 10 días: cumple la rutina, cuida los sistemas y esquiva a la IA que falla.`, `Rescue arrives in 10 days: follow the routine, take care of the systems and dodge the malfunctioning AI.`)}</p>
    <p class="puntos"${mt.pts || mt.bestStreak || Object.keys(mt.medals).length ? '' : ' hidden'}>${ic('estrella')} ${T(`${mt.pts} PUNTOS · racha ${mt.streak} (mejor ${mt.bestStreak}) · medallas ${Object.keys(mt.medals).length}/${Object.keys(Meta.MEDALS).length}`, `${mt.pts} POINTS · streak ${mt.streak} (best ${mt.bestStreak}) · medals ${Object.keys(mt.medals).length}/${Object.keys(Meta.MEDALS).length}`)}</p>
    <h2 class="paso"><span class="num">1</span> ${T(`ELIGE TU DESTINO`, `CHOOSE YOUR DESTINATION`)}</h2>
    <div class="tarjetas">${cards}</div>
    <div class="ajustes-rapidos">
      <div class="grupo"><span class="lbl paso"><span class="num">2</span> ${T(`ELIGE TU NIVEL`, `CHOOSE YOUR LEVEL`)}</span><div class="seg">${Object.entries(DIFS).map(([k, d]) => Meta.difUnlocked(mt, k) ? `<button data-dif="${k}" class="${k === getDif() ? 'on' : ''}" title="${ds(d)}">${nm(d).toUpperCase()}</button>` : `<button data-comprar="dif:${k}" class="bloq" title="${ds(d)}">${ic('info')} ${nm(d).toUpperCase()} · ${d.locked}</button>`).join('')}</div></div>
      ${interruptor('t-reflejos', 'energia', T('REFLEJOS', 'REFLEXES'), reflejos, T('Cuenta atrás en la Estación', 'Countdown on the Station'), 'data-reflejos')}
    </div>
    <p class="desc-nivel">${ds(DIFS[getDif()])}</p>
    <div class="accion">
      <button id="t-jugar" class="grande">${ic('jugar')} ${hayGuardada ? T('NUEVA PARTIDA', 'NEW GAME') : T('JUGAR', 'PLAY')}</button>
      ${hayGuardada ? `<button id="t-cont" class="sec" data-cont="${sel}">${ic('reintentar')} ${T(`CONTINUAR · DÍA ${sv.day}`, `CONTINUE · DAY ${sv.day}`)}</button>` : ''}
    </div>
    <div class="secundarios">
      <button id="t-coop" class="reto" title="${T('Dos computadoras: un astronauta en la base y Control de Misión que lo ayuda', 'Two computers: an astronaut in the base and Mission Control helping')}">${ic('tripulacion')} ${T('COOPERATIVO', 'COOPERATIVE')}</button>
      <button id="t-reto" class="reto">${ic('dia')} ${T('RETO DEL DÍA', 'DAILY CHALLENGE')}${dy.done ? ' · ' + Meta.fmtTime(dy.done) : ''}</button>
      <button id="t-medallas">${ic('medalla')} ${T('MEDALLAS', 'MEDALS')}</button><button id="t-archivo">${ic('archivo')} ${T('ARCHIVO', 'ARCHIVE')}</button><button id="t-ayuda">${ic('ayuda')} ${T('CÓMO SE JUEGA', 'HOW TO PLAY')}</button><button id="t-datos" class="reto">${ic('rad')} ${T('DATOS NASA', 'NASA DATA')}</button>
    </div>
    <details class="mas" id="t-mas" ${masAbierto ? 'open' : ''}><summary>${T(`MÁS OPCIONES · modo de juego, personaje, sonido y vista`, `MORE OPTIONS · game mode, character, sound and view`)}</summary>
      <div class="bloque-op">${T(`<span class="lbl">MODO</span>`, `<span class="lbl">MODE</span>`)}<div class="seg">${[['campana', T('CAMPAÑA · 10 días', 'CAMPAIGN · 10 days')], ['noche', T('UNA NOCHE · 7 min', 'ONE NIGHT · 7 min')]].map(([k, n]) => `<button data-modo="${k}" class="${k === mode ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="bloque-op">${T(`<span class="lbl">PERSONAJE</span>`, `<span class="lbl">CHARACTER</span>`)}<div class="seg">${Object.entries(PERKS).map(([k, d]) => Meta.isUnlocked(mt, k) ? `<button data-perk="${k}" class="${k === perk ? 'on' : ''}" title="${ds(d)}">${nm(d).toUpperCase()}</button>` : `<button data-comprar="${k}" class="bloq" title="${ds(d)}">${ic('info')} ${nm(d).toUpperCase()} · ${d.cost}</button>`).join('')}</div><small>${ds(PERKS[perk])}</small></div>
      <div class="bloque-op"><span class="lbl">${T('APRENDER', 'LEARN')}</span><button id="t-tuto">🎓 ${T('ENTRENAMIENTO GUIADO', 'GUIDED TRAINING')}</button><button id="t-aca">🏫 ${T('ACADEMIA DE CADETES', 'CADET ACADEMY')}</button><button id="t-clase">🏫 ${T('MODO CLASE', 'CLASS MODE')}${getOpt('clase', '') ? ' · ' + esc2(getOpt('clase', '')) : ''}</button><button id="t-docente">🧑‍🏫 ${T('PANEL DOCENTE', 'TEACHER PANEL')}</button></div>
      <div class="bloque-op">${ajustesHTML(conVoz(['musica', 'sfx', 'suave']))}</div>
    </details>
    <p class="consejo">💡 ${T('¿Sabías que…?', 'Did you know…?')} ${consejo(consejoN++)}</p>
    <p class="offline" id="t-offline" hidden></p>
    <p class="pie">${T(`UN JUEGO DE #EraConTuto · NASA Space Apps 2026 · desafío Space Mission Design Game`, `A GAME BY #EraConTuto · NASA Space Apps 2026 · Space Mission Design Game challenge`)}</p>
  </div>`, 'pant-titulo'); tituloEntra = false;
  const V = $('ventana');
  $('t-mas').ontoggle = () => { masAbierto = $('t-mas').open; };
  cableaAjustes(conVoz(['musica', 'sfx', 'suave']));
  $('t-coop').onclick = () => coopUI.roles();
  $('t-datos').onclick = () => datos(titleScreen);
  V.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => cambiaIdioma(b.dataset.lang, titleScreen)));
  pintaOffline();
  const nueva = (loc, opts) => { M.start(); clearSave(loc); s = G.newGame(loc, undefined, getDif(), { variar: true, ...opts, flares: liveFlares }); base = null; close(); intro(); };
  $('t-clase').onclick = claseScreen; $('t-docente').onclick = docenteScreen;
  $('t-aca').onclick = () => academia();
  $('t-tuto').onclick = () => { setOpt(Tu.CLAVE, '0'); nueva(sel, { mode: 'campana', perk, reflex: false, seen: Meta.seenNotes(sel) }); }; // el entrenamiento siempre es una campaña tranquila
  $('t-jugar').onclick = () => nueva(sel, { mode, perk, reflex: getOpt('reflejos', '0') === '1', seen: Meta.seenNotes(sel) });
  V.querySelectorAll('[data-loc]').forEach((b) => (b.onclick = () => { setOpt('dest', b.dataset.loc); titleScreen(); }));
  V.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => { setOpt('modo', b.dataset.modo); titleScreen(); }));
  V.querySelectorAll('[data-reflejos]').forEach((b) => (b.onclick = () => { setOpt('reflejos', reflejos ? '0' : '1'); titleScreen(); }));
  V.querySelectorAll('[data-perk]').forEach((b) => (b.onclick = () => { setOpt('perk', b.dataset.perk); titleScreen(); }));
  V.querySelectorAll('[data-comprar]').forEach((b) => (b.onclick = () => { const id = b.dataset.comprar; if (Meta.buy(id)) { M.ui('ok'); if (id.startsWith('dif:')) setDif(id.slice(4)); else setOpt('perk', id); } else { M.ui('error'); b.textContent = T('FALTAN PUNTOS', 'NOT ENOUGH POINTS'); setTimeout(titleScreen, 700); return; } titleScreen(); }));
  $('t-reto').onclick = () => { M.start(); s = G.newGame(dd.loc, dd.seed, dd.dif, { variar: true, mode: dd.mode, perk: dd.perk, daily: true, flare: dd.flare, flareMin: dd.flareMin, seen: Meta.seenNotes(dd.loc) }); base = null; close(); intro(); };
  $('t-medallas').onclick = medalsScreen; $('t-archivo').onclick = () => archiveScreen(null);
  V.querySelectorAll('[data-dif]').forEach((b) => (b.onclick = () => { setDif(b.dataset.dif); titleScreen(); }));
  V.querySelectorAll('[data-cont]').forEach((b) => (b.onclick = () => { M.start(); s = load(b.dataset.cont); base = null; close(); }));
  $('t-ayuda').onclick = () => help(titleScreen);
}

// ---------- tutorial guiado (lógica en tutorial.js) ----------
let tu = null, tuDe = null;
/** Las pruebas automáticas (navigator.webdriver) no ven el tutorial salvo que se pida con ?tuto. */
const tutoPermitido = () => !navigator.webdriver || new URLSearchParams(location.search).has('tuto');
function estacionVida() { return s?.sys ? Sys.station(s, 'vida') : null; }
function tutoFrame(dt) {
  if (!s || menu || crew || s.over || s.mode === 'academia') return; // la Academia tiene su propia tarjeta (academiaFrame)
  if (tuDe !== s) { tuDe = s; tu = tutoPermitido() && !coop && getOpt(Tu.CLAVE, '0') !== '1' && Tu.aplica(s) ? Tu.nuevo(s) : null; pintaTuto(); }
  if (!tu) return;
  const r = Tu.tick(tu, s, dt, { crouch: !!s.p.crouch, mapa: mapaOn, estacion: estacionVida() });
  if (r.salta != null) { s.min = Math.max(s.min, r.salta); G.flash(s, T('⏩ El reloj avanzó a las 08:00 para que practiques.', '⏩ The clock moved to 08:00 so you can practice.'), 'info'); }
  if (r.cambio) { M.ui('ok'); pintaTuto(); }
  if (r.fin) { tutoFin(true); G.flash(s, T('🚀 ¡Bienvenido a CUSTODIA, cadete! La misión empieza ahora: mantén viva la base 10 días.', '🚀 Welcome to CUSTODIA, cadet! The mission starts now: keep the base alive for 10 days.'), 'ok'); M.ui('ok'); }
}
function tutoFin(guardar) { tu = null; if (guardar) setOpt(Tu.CLAVE, '1'); pintaTuto(); }
function pintaTuto() {
  const el = $('tuto'); if (!el) return; document.body.classList.toggle('tuto-on', !!tu); // con el tutorial a la vista se esconde «AHORA» para dejar sitio (no estorba en celular)
  if (!tu) { el.hidden = true; el.innerHTML = ''; return; }
  const e = estacionVida(); const x = Tu.texto(tu, esTactil(), e ? G.roomName(s, G.roomIdAt(s, e.x + 0.5, e.y + 0.5)) : '', document.body.classList.contains('rueda-on'));
  if (!x) { tutoFin(true); return; }
  if (Tu.actual(tu) === 'finales') { el.hidden = true; finalesTuto(x); return; } // el último paso es una ventana con los finales
  el.hidden = false;
  // Sin botón SALTAR: el entrenamiento es obligatorio la primera vez (se aprende jugando, son pocos minutos).
  el.innerHTML = `<small>🎓 ${T('ENTRENAMIENTO', 'TRAINING')} · ${x.n}</small><b>${x.titulo}</b><p>${x.texto}</p>${Tu.pideOk(tu) ? `<div class="tuto-bt"><button id="tuto-ok" class="grande">${ic('ok')} ${T('ENTENDIDO', 'GOT IT')}</button></div>` : ''}`;
  const ok = $('tuto-ok'); if (ok) ok.onclick = () => { Tu.entendido(tu); M.ui('click'); };
}
/** Fin del entrenamiento: los finales por descubrir (los secretos como «???» con pista; si ya ganaste la medalla, se revela) y bienvenida. */
function finalesTuto(x) {
  const md = Meta.load().medals ?? {};
  const fila = (f) => { const ya = f.medalla && md[f.medalla]; return `<li class="fin-tuto${f.secreto && !ya ? ' secreto' : ''}"><span class="fi">${ya ? '🏅' : f.ico}</span><span><b>${ya ? f.revela : f.nombre}</b><br><small>${f.como}</small></span></li>`; };
  const L = Tu.FINALES();
  open(`<h2>🎓 ${x.titulo}</h2><p>${T('Ya sabes cuidar la base: leer sus barras, revisar los paneles, usar el mapa y protegerte del Sol. Ahora empieza la misión de verdad.', 'You can now look after the base: read its bars, check the panels, use the map and shelter from the Sun. Now the real mission begins.')}</p>
    <h3>${T('FINALES POR DESCUBRIR', 'ENDINGS TO DISCOVER')}</h3><ul class="fines-tuto">${L.filter((f) => !f.secreto).map(fila).join('')}</ul>
    <h3>${T('FINALES SECRETOS', 'SECRET ENDINGS')}</h3><ul class="fines-tuto">${L.filter((f) => f.secreto).map(fila).join('')}</ul>
    <p class="nota-aj">${T('También hay muchas formas de perder (aire, comida, radiación, incendios…): cada una te enseña algo.', 'There are also many ways to lose (air, food, radiation, fires…): each one teaches you something.')}</p>
    <div class="dos"><button id="tuto-fin" class="grande">🚀 ${T('¡EMPEZAR LA MISIÓN!', 'START THE MISSION!')}</button></div>`, 'finales-tuto');
  menu = 'finales';
  $('tuto-fin').onclick = () => { close(); Tu.entendido(tu); M.ui('ok'); };
}
/** Aro dorado alrededor del panel (en el mundo) y flecha al borde si está fuera de la pantalla. */
function tutoAro(t) {
  if (!tu) return; const o = Tu.objetivo(tu, estacionVida()); if (!o) return;
  const k = 0.5 + 0.5 * Math.sin(t / 600); cx.strokeStyle = `rgba(255,194,61,${0.55 + 0.45 * k})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(o.x * TS, o.y * TS, 10 + k * 3, 0, 7); cx.stroke();
}
function tutoFlecha(t) { if (!tu) return; const o = Tu.objetivo(tu, estacionVida()); if (o) arrowTo(o.x, o.y, '#ffc23d', Tu.actual(tu) === 'esconder' ? T('ESCONDITE', 'HIDING SPOT') : T('PANEL', 'PANEL'), t); }

// ---------- cooperativo: TRIPULANTE (la otra persona maneja a un compañero en el mismo mapa) ----------
// El anfitrión (astronauta) manda el estado ~15 veces por segundo; aquí se copia en `s` (sin simular) y se dibuja desde el compañero elegido.
// Cada quien manda sus entradas (dirección) y el anfitrión las aplica; el movimiento propio se predice aquí para que responda al instante.
let crew = null; // { link, who, color, up, pred, walk, dir, moving, sent, fin, paused, ack } cuando esta computadora es el compañero
function startCrew(link) {
  coopStop(); M.start(); s = null; base = null;
  crew = { link, who: null, color: '#fff', up: true, pred: null, walk: 0, dir: 0, moving: false, sent: { dx: 0, dy: 0, t: 0 }, fin: false, paused: false, hostMsgT: 0, prev: null, astroMoving: false };
  document.body.classList.add('invitado');
  link.onmessage = crewMsg; link.onclose = () => { if (crew) { crew.up = false; avisoInvitado(T('Se cortó la conexión con el anfitrión.', 'The connection to the host was lost.')); } };
  link.onpeer = (up) => { if (!crew) return; crew.up = up; avisoInvitado(up ? '' : T('Reconectando con el anfitrión…', 'Reconnecting to the host…')); if (up) link.send({ t: 'hello', rol: 'crew' }); };
  link.onestado = () => { if (crew) crew.up = link.estado !== 'reconectando'; };
  menu = 'coop'; open(`<h2>🧑‍🚀 ${T('CONECTANDO…', 'CONNECTING…')}</h2><p>${T('Esperando al anfitrión.', 'Waiting for the host.')}</p><div class="fila"><button id="volver">${T('SALIR', 'LEAVE')}</button></div>`);
  $('volver').onclick = crewSalir; link.send({ t: 'hello', rol: 'crew' });
}
function crewMsg(m) {
  if (!crew) return;
  if (m.t === 'hi') { // el anfitrión saluda (al conectar y cada vez que empieza otra partida): elegir personaje o recuperar el que ya tenía
    if (m.rol !== 'crew') { crew.link.send({ t: 'hello', rol: 'crew' }); return; }
    crew.fin = false; const libre = (n) => m.crew.find((c) => c.name === n && !c.taken && !c.betrayed);
    if (crew.who && libre(crew.who)) crew.link.send({ t: 'pick', who: crew.who }); else eligePersonaje(m.crew);
  } else if (m.t === 'you') {
    crew.who = m.who; crew.color = LOCS[s?.loc ?? 'estacion'].crew.find((c) => c.name === m.who)?.color ?? '#fff'; crew.pred = null;
    if (menu === 'coop') close(); avisoInvitado(''); if (!crew.hint) { crew.hint = true; setTimeout(() => { if (crew && !menu) avisoInvitado(esTactil() ? T('Desliza el dedo en el mapa para caminar. USAR: panel, emergencia, cajón o pasarle objetos al astronauta. DISTRAER: un dron se queda mirándote.', 'Slide your finger on the map to walk. USE: panel, emergency, drawer or hand items to the astronaut. DISTRACT: a drone stares at you.') : T('Camina con WASD. USAR (E): panel, emergencia, cajón o pasarle objetos al astronauta. DISTRAER (F): un dron se queda mirándote.', 'Walk with WASD. USE (E): panel, emergency, drawer or hand items to the astronaut. DISTRACT (F): a drone stares at you.'), 9000); }, 600); } textosTactil();
  } else if (m.t === 'st') {
    if (!s) { s = G.revive(JSON.parse(m.s)); base = null; filasS = null; diaDe = null; } else s = G.applyState(s, m.s);
    const c = s.crew.find((x) => x.name === crew.who); if (c) crew.color = c.color;
    crew.paused = !!m.paused; crew.hostMsgT = performance.now();
  } else if (m.t === 'ack' && (m.k === 'mant' || m.k === 'acc')) {
    avisoInvitado(m.text || '', 3000); M.ui(m.ok ? 'ok' : 'error');
  }
}
function eligePersonaje(lista) {
  menu = 'coop';
  open(`<h2>${T('¿QUIÉN QUIERES SER?', 'WHO DO YOU WANT TO BE?')}</h2><p>${T('Caminas por la base con tu compañero y haces las revisiones de la mañana.', 'You walk around the base with your crewmate and do the morning checks.')}</p>
    <div class="elige">${lista.map((c) => { const f = ficha(c.name); return `<button data-n="${c.name}" ${c.taken || c.betrayed ? 'disabled' : ''}>${retrato(c.name, c.color, 'feliz')}<b style="color:${c.color}">${c.name}</b><small>${f ? f.rol : ''}</small></button>`; }).join('')}</div>
    <div class="fila"><button id="volver">${T('SALIR', 'LEAVE')}</button></div>`);
  $('ventana').querySelectorAll('.elige button').forEach((b) => (b.onclick = () => { M.ui('ok'); crew.link.send({ t: 'pick', who: b.dataset.n }); }));
  $('volver').onclick = crewSalir;
}
/** Texto corto arriba del mapa (pausa del anfitrión, reconexión, resultado de una revisión). */
let avisoT = 0;
function avisoInvitado(txt, ms = 0) {
  let el = $('inv-aviso'); if (!el) { el = document.createElement('div'); el.id = 'inv-aviso'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.textContent = txt; el.hidden = !txt; clearTimeout(avisoT); if (txt && ms) avisoT = setTimeout(() => { if (crew?.paused) avisoInvitado(T('⏸ El anfitrión pausó el juego.', '⏸ The host paused the game.')); else el.hidden = true; }, ms);
}
/** Lo que se dibuja y se muestra en el HUD sale del compañero: `s.p` pasa a ser él y el astronauta se dibuja como un compañero más. */
function conVista(fn) {
  if (!crew || !s || !crew.who) return fn();
  const me = s.crew.find((c) => c.name === crew.who); if (!me) return fn();
  const real = s.p, todos = s.crew; crew.pred ??= { x: me.x, y: me.y };
  const ap = crew.prev; crew.astroMoving = !!ap && Math.hypot(real.x - ap.x, real.y - ap.y) > 0.005; crew.prev = { x: real.x, y: real.y };
  s.p = { ...real, x: crew.pred.x, y: crew.pred.y, dir: crew.dir, walk: crew.walk, hidden: null, inDuct: false, crouch: false, sleep: false, hit: 0, noisy: crew.moving, inv: me.inv ?? [], o2: 100 };
  s.crew = [...todos.filter((c) => c !== me), { name: 'Comandante', host: true, color: '#3d7bff', x: real.x, y: real.y, dir: real.dir, moving: crew.astroMoving, trust: 0, betrayed: false, say: null, want: null }];
  try { return fn(); } finally { s.p = real; s.crew = todos; }
}
/** Cada cuadro del invitado: manda la dirección (si cambió o cada 120 ms), predice su paso y se acerca a lo que dice el anfitrión. */
function crewFrame(dt, inp) {
  if (!s || !crew?.who) return;
  const me = s.crew.find((c) => c.name === crew.who); if (!me) return;
  crew.pred ??= { x: me.x, y: me.y };
  const quieto = !!menu || s.over; const dx = quieto ? 0 : inp.dx, dy = quieto ? 0 : inp.dy, len = Math.hypot(dx, dy);
  const ahora = performance.now(); const cambio = Math.abs(dx - crew.sent.dx) > 0.15 || Math.abs(dy - crew.sent.dy) > 0.15;
  if (crew.up && (cambio || (len > 0.1 && ahora - crew.sent.t > 120) || ahora - crew.sent.t > 400)) { crew.link.send({ t: 'inp', dx: +dx.toFixed(2), dy: +dy.toFixed(2) }); crew.sent = { dx, dy, t: ahora }; }
  crew.moving = len > 0.1;
  if (crew.moving) { const sp = G.HUMAN_SPEED * dt; const b = { x: crew.pred.x, y: crew.pred.y }; G.moveBody(s, b, (dx / len) * sp, (dy / len) * sp, 0.28, 'h'); crew.pred.x = b.x; crew.pred.y = b.y; crew.dir = Math.atan2(dy, dx); crew.walk += dt; }
  const ex = me.x - crew.pred.x, ey = me.y - crew.pred.y, d = Math.hypot(ex, ey);
  if (d > 2.5) { crew.pred.x = me.x; crew.pred.y = me.y; } else { const k = Math.min(1, dt * (crew.moving ? 3 : 8)); crew.pred.x += ex * k; crew.pred.y += ey * k; }
  if (!crew.moving && d < 0.05) crew.dir = me.dir ?? crew.dir;
  if (crew.paused && (!$('inv-aviso') || $('inv-aviso').hidden)) avisoInvitado(T('⏸ El anfitrión pausó el juego.', '⏸ The host paused the game.'));
  else if (!crew.paused && $('inv-aviso') && !$('inv-aviso').hidden && /pausó|paused/.test($('inv-aviso').textContent)) avisoInvitado('');
}
/** Teclas del invitado: E (revisar el panel), paneles 1-4, nombres, música y pantalla completa. */
function actCrew(k) {
  if (!s || s.over || !crew?.who) return;
  if (k === 'm') { M.toggle(); if (M.on()) M.ui('ok'); sincBotones(); pintaInterruptor('sw-musica', M.on()); return; }
  if (k === 'v') return toggleFull();
  if (menu) return;
  if ('1234'.includes(k) && k.length === 1) return togglePanel(['mant', 'plan', 'amen', 'reg'][+k - 1]);
  if (k === 'n') return alternaNombres();
  if (k === 'e') crewUsa(); else if (k === 'f') crewDistrae();
}
/** Lo que haría E ahora para el compañero invitado (el mismo orden de crewUsa), para el letrero sobre su cabeza. */
function crewEtiqueta() {
  if (!crew?.pred || !s.crew) return null; const pr = crew.pred; const d = (x, y) => Math.hypot(pr.x - x, pr.y - y); const me = s.crew.find((c) => c.name === crew.who);
  const em = s.sys?.emerg; if (em && d(em.x, em.y) < 2.2) return T('¡Atender la emergencia!', 'Handle the emergency!');
  if (s.sys) for (const id of Sys.pending(s)) { const o = Sys.station(s, id); if (d(o.x + 0.5, o.y + 0.5) < 2.2) return G.block(s).id === 'trabajo' ? `${T('Revisar', 'Check')}: ${Sys.taskName(s, id)}` : null; }
  if (me?.inv?.length && d(s.p.x, s.p.y) < 2.4) return T('Pasarle objetos al astronauta', 'Hand items to the astronaut');
  if (s.objects.some((o) => o.t === 'cajon' && o.loot?.length && d(o.x + 0.5, o.y + 0.5) < 2.2)) return T('Revisar el cajón', 'Search the drawer');
  return null;
}
/** USAR (E) del compañero, por prioridad: emergencia cercana, panel de revisión pendiente, pasarle objetos al astronauta, revisar un cajón. */
function crewUsa() {
  if (!crew.pred || !s.crew) return; const pr = crew.pred; const me = s.crew.find((c) => c.name === crew.who); const d = (x, y) => Math.hypot(pr.x - x, pr.y - y); const y = s.sys;
  const em = y?.emerg; if (em && d(em.x, em.y) < 2.2) { M.sfx('interactuar'); return crew.link.send({ t: 'emerg' }); }
  let panel = null, lejos = false; if (y) for (const id of Sys.pending(s)) { const o = Sys.station(s, id); const dd = d(o.x + 0.5, o.y + 0.5); if (dd < 2.2 && (!panel || dd < panel.d)) panel = { id, d: dd }; }
  if (panel && G.block(s).id === 'trabajo') { M.sfx('interactuar'); const id = panel.id; return protocolGame(idMant(y.sem ?? 0, s.day, id), (ok) => { if (ok) crew.link.send({ t: 'mant', sys: id }); }); }
  if (me?.inv?.length && d(s.p.x, s.p.y) < 2.4) { M.sfx('soltar'); return crew.link.send({ t: 'give' }); }
  let cj = null; s.objects.forEach((o, i) => { if (o.t === 'cajon' && o.loot?.length) { const dd = d(o.x + 0.5, o.y + 0.5); if (dd < 2.2 && (!cj || dd < cj.d)) cj = { i, d: dd }; } });
  if (cj) { M.sfx('recoger'); return crew.link.send({ t: 'search', i: cj.i }); }
  if (panel) return avisoInvitado(T('El mantenimiento se hace en el turno de trabajo (08:00–12:00).', 'Maintenance is done during the work shift (08:00–12:00).'), 2800);
  avisoInvitado(T('Aquí no hay nada que usar. Acércate a un panel, un cajón con cosas, el astronauta (si llevas objetos) o una emergencia.', 'Nothing to use here. Get close to a panel, a drawer with items, the astronaut (if you carry items) or an emergency.'), 3200);
}
/** DISTRAER (F): el dron o guardia más cercano se queda mirando al compañero un rato, para que el astronauta pase. */
function crewDistrae() { if (!crew?.who || menu || s?.over) return; M.sfx('interactuar'); crew.link.send({ t: 'dis' }); }
function crewPausa() {
  if (menu && menu !== 'pausa-inv') return;
  if (menu === 'pausa-inv') return close();
  menu = 'pausa-inv'; M.ui('abrir');
  open(`<h2>${ic('pausa', 'g')} ${T('PAUSA', 'PAUSE')}</h2><p style="color:var(--dim)">${T('El juego sigue en la computadora del anfitrión: quédate cerca de tu compañero.', "The game keeps running on the host's computer: stay close to your crewmate.")}</p>
    <div class="fila"><button id="seguir" class="grande">${ic('jugar')} ${T('SEGUIR', 'RESUME')}</button></div>
    <h3>${T('AJUSTES', 'SETTINGS')}</h3><div class="ajustes">${ajustesHTML(['musica', 'sfx', 'suave', 'nombres'])}</div>
    <div class="fila"><button id="salir" class="sec">${ic('menu')} ${T('SALIR DE LA SALA', 'LEAVE THE ROOM')}</button></div>`);
  cableaAjustes(['musica', 'sfx', 'suave', 'nombres']); $('seguir').onclick = close; $('salir').onclick = crewSalir;
}
function crewFin() {
  const o = s.over; menu = 'fin'; document.body.classList.toggle('derrota', !o.won);
  open(`<div class="fin ${o.won ? 'gana' : 'pierde'}"><div class="fin-cab"><span class="sello">${ic(o.won ? 'ok' : 'bad')}</span><div><p class="etq">${o.won ? T('¡VOLVIERON A CASA!', 'YOU MADE IT HOME!') : T('MISIÓN PERDIDA', 'MISSION LOST')}</p><h2>${UI.tituloFin(o.title)}</h2></div></div>
    <section class="bloque"><h3>${T('QUÉ PASÓ', 'WHAT HAPPENED')}</h3><p>${o.text}</p></section>
    <p style="color:var(--dim)">${T('Si el anfitrión empieza otra partida, volverás a entrar solo.', 'If the host starts another game, you will rejoin by yourself.')}</p>
    <div class="fila"><button id="salir" class="sec">${ic('menu')} ${T('SALIR DE LA SALA', 'LEAVE THE ROOM')}</button></div></div>`);
  $('salir').onclick = crewSalir;
}
function crewSalirSilencio() { try { crew?.link.close(); } catch { /* ya cerrado */ } crew = null; textosTactil(); s = null; base = null; document.body.classList.remove('invitado', 'derrota'); $('inv-aviso')?.remove(); touch.dx = 0; touch.dy = 0; }
function crewSalir() { crewSalirSilencio(); close(); titleScreen(); }

// ---------- cooperativo (Astronauta + Control de Misión) ----------
let coop = null; // { session, link, kind } cuando esta computadora es el astronauta
function coopStop() { if (coop) { coop.link.close(); coop = null; } if (crew) crewSalirSilencio(); coopUI?.destroyGuest(); }
const coopUI = coopScreens({ $, open, close, beep, setMenu: (v) => { menu = v; }, titleScreen, getDif, startCrew,
  startHost(locId, link, kind) {
    M.start(); clearSave(locId); s = G.newGame(locId, undefined, getDif(), { variar: true, flares: liveFlares, mode: 'campana', perk: getOpt('perk', 'novato'), reflex: getOpt('reflejos', '0') === '1', seen: Meta.seenNotes(locId) });
    base = null; coop = { link, kind, session: new HostSession(link, s) }; close(); intro();
  } });

function medalsScreen() {
  menu = 'medallas'; const mt = Meta.load();
  open(`<h2>🏅 ${T('MEDALLAS', 'MEDALS')} (${Object.keys(mt.medals).length}/${Object.keys(Meta.MEDALS).length})</h2><p style="color:var(--dim)">${T('Cada medalla nueva da +50 puntos.', 'Each new medal gives +50 points.')}</p>
    <div class="medallas">${Object.entries(Meta.MEDALS).map(([k, [n, d]]) => `<div class="medalla ${mt.medals[k] ? 'si' : ''}"><b>${mt.medals[k] ? '🏅' : '🔒'} ${n}</b><small>${d}</small></div>`).join('')}</div>
    <div class="fila"><button id="volver">${T('VOLVER', 'BACK')}</button></div>`);
  $('volver').onclick = titleScreen;
}
function archiveScreen(back) {
  menu = 'archivo'; const mt = Meta.load();
  const block = (loc) => { const L = LOCS[loc]; const known = new Set([...(mt.notes[loc] ?? []), ...(s && s.loc === loc ? s.notes : [])]);
    return `<h3>${L.icon} ${L.name.toUpperCase()} · ${known.size}/${NOTES[loc].length}${known.size >= NOTES[loc].length ? T(' · ★ FINAL VERDADERO DESBLOQUEADO', ' · ★ TRUE ENDING UNLOCKED') : ''}</h3>${NOTES[loc].map(([t, x], i) => known.has(i) ? `<details class="nota"><summary>📄 ${t}</summary><p>${x}</p></details>` : `<p class="nota no">📄 ??? <small>${T('(en algún cajón)', '(in some drawer)')}</small></p>`).join('')}`; };
  open(`<h2>📄 ${T('ARCHIVO', 'ARCHIVE')}</h2><p style="color:var(--dim)">${T('Las notas aparecen al revisar cajones. Junta las 6 de un destino y gana allí para ver su final verdadero.', 'Notes appear when you search drawers. Collect all 6 of a destination and win there to see its true ending.')}</p>${(back ? [s.loc] : Object.keys(LOCS)).map(block).join('')}<div class="fila"><button id="volver">${T('VOLVER', 'BACK')}</button></div>`);
  $('volver').onclick = () => (back ? back() : titleScreen());
}

// Clima espacial real: se pide a NASA DONKI al abrir el juego (una vez por día, guardado). Si llega cuando la
// partida ya empezó y aún no pasó ninguna tormenta, se usan las llamaradas nuevas.
let liveFlares = (() => { try { const c = JSON.parse(localStorage.getItem('lfr.flares') || 'null'); return c && c.day === new Date().toISOString().slice(0, 10) ? c.list : null; } catch { return null; } })();
const nasaKey = () => { try { return localStorage.getItem('lfr.nasaKey') || 'DEMO_KEY'; } catch { return 'DEMO_KEY'; } };
/** Pide las llamaradas a DONKI; devuelve true si llegaron datos en vivo. */
const pedirDonki = () => fetchFlares({ key: nasaKey() }).then((l) => {
  if (!l) return false; liveFlares = l;
  try { localStorage.setItem('lfr.flares', JSON.stringify({ day: new Date().toISOString().slice(0, 10), list: l })); } catch { /* sin espacio */ }
  if (s?.sys && !s.sys.storm && s.sys.storms === 0) Sys.setFlares(s, l);
  return true;
});
if (!liveFlares) pedirDonki();

// Pantalla DATOS NASA: qué es real, de dónde sale y qué es escala de juego.
/** Ir a una sección de la terminal DATOS NASA (la pone datos()). */
let finQuiz = null;
let datosIr = null; let datosSec = 'restriccion';
function datos(back, sec0 = 'restriccion') {
  menu = 'datos'; const fl = missionFlares(liveFlares); const enVivo = fl.some((f) => f.source === 'donki');
  const estado = enVivo ? T('EN VIVO', 'LIVE') : donkiEstado.error === 'limite' ? T('ARCHIVO · llave agotada', 'ARCHIVE · key used up') : T('ARCHIVO · sin conexión', 'ARCHIVE · offline');
  open(`<h2>${ic('rad', 'g')} ${T('DATOS NASA', 'NASA DATA')}</h2>
    <div class="term">
      <div class="term-cab"><span>${T('TERMINAL NASA · ACCESO: CADETE', 'NASA TERMINAL · ACCESS: CADET')}</span><span class="term-est ${enVivo ? 'vivo' : ''}">● ${estado}</span></div>
      <nav class="term-cmds" aria-label="${T('Secciones', 'Sections')}">${SECCIONES_DATOS.map((id, i) => `<button type="button" data-sec="${id}" aria-pressed="false">[${i + 1}] ${nombreSeccion(id)}</button>`).join('')}</nav>
      <p class="term-ps" id="term-ps" aria-live="polite"></p>
      <div class="term-out" id="term-out">
        <section class="dt-sec" data-sec="restriccion" hidden>
          <p class="grande-txt"><b>${T('La restricción real que enseña el juego:', 'The real constraint the game teaches:')}</b> ${restriccion()}</p>
          <p class="term-nota">${T('Escribe un comando (clima, radiacion, salud, protocolos, escala) o pulsa un botón. Cada dato trae su fuente.', 'Type a command (weather, radiation, health, protocols, scale) or press a button. Every fact comes with its source.')}</p>
        </section>
        <section class="dt-sec" data-sec="clima" hidden>
          <h3>☀️ ${T('Clima espacial', 'Space weather')}: NASA DONKI ${enVivo ? T('(EN VIVO, último mes)', '(LIVE, last month)') : donkiEstado.error === 'limite' ? T('(la llave se agotó por ahora: llamaradas reales archivadas)', '(the key ran out for now: real archived flares)') : T('(sin conexión: llamaradas reales archivadas)', '(offline: real archived flares)')}</h3>
          <div class="llave">${T(`<label for="llave-nasa">Llave de api.nasa.gov</label>`, `<label for="llave-nasa">api.nasa.gov key</label>`)}
            <input id="llave-nasa" type="text" autocomplete="off" spellcheck="false" placeholder="${T('pega tu llave (gratis en api.nasa.gov)', 'paste your key (free at api.nasa.gov)')}" value="${nasaKey() === 'DEMO_KEY' ? '' : nasaKey()}">
            <button id="llave-ok" class="sec">${T(`USAR LLAVE`, `USE KEY`)}</button>
            <small id="llave-est">${nasaKey() === 'DEMO_KEY' ? T('Usando la llave de prueba DEMO_KEY: se agota rápido y entonces salen llamaradas archivadas. Saca una gratis en <a href="https://api.nasa.gov" target="_blank" rel="noopener">api.nasa.gov</a>.', 'Using the DEMO_KEY test key: it runs out quickly and then archived flares are used. Get a free one at <a href="https://api.nasa.gov" target="_blank" rel="noopener">api.nasa.gov</a>.') : T('Usando tu llave propia (guardada solo en este navegador).', 'Using your own key (saved only in this browser).')}</small></div>
          <ul class="datos-lista">${fl.map((f, i) => `<li>${T(`Tormenta ${i + 1} · día ${[2, 5, 8][i]}: clase <b>${f.cls}</b>`, `Storm ${i + 1} · day ${[2, 5, 8][i]}: class <b>${f.cls}</b>`)} · ${f.date} · ${f.source === 'donki' ? T('DONKI en vivo', 'DONKI live') : T('archivo DONKI', 'DONKI archive')}</li>`).join('')}</ul>
          <p><small>${T('Refugios', 'Shelters')}: ${Object.entries(SHELTER).map(([k, v]) => `<b>${nm(LOCS[k])}</b>: ${rn(LOCS[k].rooms.find((r) => r.id === v.room)?.name)}. ${v.why}`).join(' ')}</small></p>
        </section>
        <section class="dt-sec" data-sec="radiacion" hidden>
          ${T(`<h3>☢ Radiación medida de verdad</h3>`, `<h3>☢ Radiation measured for real</h3>`)}
          <ul class="datos-lista">${dosisReales().map((d) => `<li><b>${d.donde}:</b> ${d.valor} <small>(${d.fuente})</small></li>`).join('')}</ul>
        </section>
        <section class="dt-sec" data-sec="salud" hidden>
          ${T(`<h3>🧬 Salud de astronautas: estudios del repositorio OSDR de NASA</h3>`, `<h3>🧬 Astronaut health: studies from NASA's OSDR repository</h3>`)}
          <ul class="datos-lista">${osdr().map((o) => `<li><a href="${osdUrl(o.id)}" target="_blank" rel="noopener">${o.id}</a>: ${o.texto}</li>`).join('')}</ul>
        </section>
        <section class="dt-sec" data-sec="protocolos" hidden>
          ${T(`<h3>🚨 Protocolos de emergencia</h3>`, `<h3>🚨 Emergency protocols</h3>`)}
          <ul class="datos-lista">${Object.entries(PROTO_FUENTE).filter(([, f]) => f.nivel !== 'ficcion').map(([k, f]) => `<li><b>${T(PROTOCOLS[k].title, PROTOCOLS[k].titleEn)}</b> — ${T(PROTO_NIVEL[f.nivel], PROTO_NIVEL_EN[f.nivel])}. <small>${T(f.fuente, f.fuenteEn)}</small></li>`).join('')}</ul>
          ${T(`<p><small>Los demás protocolos del juego están marcados como ficción dentro del minijuego.</small></p>`, `<p><small>The other protocols in the game are marked as fiction inside the minigame.</small></p>`)}
        </section>
        <section class="dt-sec" data-sec="escala" hidden>
          ${T(`<h3>🎮 Escala de juego (no es dato real)</h3>`, `<h3>🎮 Game scale (not real data)</h3>`)}
          <ul class="datos-lista">${escala().map((t) => `<li>${t}</li>`).join('')}</ul>
        </section>
      </div>
      <form class="term-in" id="term-form" autocomplete="off"><label for="term-cmd">custodia@nasa:~$</label><input id="term-cmd" type="text" spellcheck="false" autocapitalize="off" placeholder="${T('escribe un comando… (ayuda)', 'type a command… (help)')}" maxlength="30"><button type="submit" class="sec">${T('ENTER', 'ENTER')}</button></form>
      <p class="term-msg" id="term-msg" aria-live="polite"></p>
    </div>
    <div class="fila fila-fija"><button id="ok" class="grande">${ic('ok')} ${T('VOLVER', 'BACK')}</button></div>`, 'pant-datos');
  const ir = (id, eco) => {
    const sec = $('term-out').querySelector(`[data-sec="${id}"]`); if (!sec) return;
    $('term-out').querySelectorAll('.dt-sec').forEach((x) => { x.hidden = x !== sec; });
    $('ventana').querySelectorAll('.term-cmds button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sec === id)));
    $('term-ps').innerHTML = `custodia@nasa:~$ ${eco ?? `ver ${nombreSeccion(id)}`}<span class="cursor">█</span>`; $('term-msg').textContent = '';
    $('term-out').classList.remove('nueva'); void $('term-out').offsetWidth; $('term-out').classList.add('nueva'); // cada comando "imprime" sus líneas una tras otra (apagado en modo suave)
    $('ventana').scrollTop = 0; datosSec = id;
  };
  datosIr = (i) => ir(SECCIONES_DATOS[i]);
  $('ventana').querySelectorAll('.term-cmds button').forEach((b) => { b.onclick = () => { M.ui('click'); ir(b.dataset.sec); }; });
  $('term-form').onsubmit = (e) => {
    e.preventDefault(); const txt = $('term-cmd').value; $('term-cmd').value = ''; const c = comandoDatos(txt);
    if (c.tipo === 'sec') { M.ui('ok'); ir(c.id, txt.trim()); }
    else if (c.tipo === 'salir') { $('ok').click(); }
    else if (c.tipo === 'ayuda') { M.ui('info'); $('term-ps').innerHTML = `custodia@nasa:~$ ${T('ayuda', 'help')}<span class="cursor">█</span>`; $('term-msg').textContent = T('Comandos: ', 'Commands: ') + SECCIONES_DATOS.map((id, i) => `${i + 1}=${nombreSeccion(id)}`).join(' · ') + T(' · salir', ' · exit'); }
    else if (c.tipo === 'desconocido') { M.ui('error'); $('term-msg').textContent = T(`comando no reconocido: "${c.texto}". Escribe ayuda.`, `command not recognized: "${c.texto}". Type help.`); }
  };
  ir(sec0); $('ok').onclick = () => (back ? back() : close());
  $('llave-ok').onclick = () => {
    const k = $('llave-nasa').value.trim();
    try { if (k) localStorage.setItem('lfr.nasaKey', k); else localStorage.removeItem('lfr.nasaKey'); localStorage.removeItem('lfr.flares'); } catch { /* sin almacenamiento */ }
    $('llave-est').textContent = T('Consultando NASA DONKI…', 'Asking NASA DONKI…'); M.ui('click');
    pedirDonki().then((ok) => { if (ok) datos(back, 'clima'); else $('llave-est').textContent = donkiEstado.error === 'limite' ? T('NASA dice que esta llave ya gastó su cupo (la de prueba, DEMO_KEY, da unas 30 consultas por hora por red). Pega tu llave gratis de api.nasa.gov o espera un rato. Mientras, se usan las llamaradas archivadas.', 'NASA says this key has used up its quota (the DEMO_KEY test key allows about 30 requests per hour per network). Paste your free api.nasa.gov key or wait a while. Meanwhile the archived flares are used.') : T('NASA no respondió (llave inválida o sin internet). Se siguen usando las llamaradas archivadas.', 'NASA did not answer (invalid key or no internet). The archived flares are still used.'); });
  };
}

// Tarjeta "LA RESTRICCIÓN REAL" al terminar cada tormenta solar (pausa el juego para leerla).
let stormShown = 0;
function stormCard(l) {
  menu = 'tormenta'; const lim = Sys.DOSE_LIMIT; const pctBar = (v) => Math.min(100, Math.round((v / lim) * 100));
  open(`<h2>${ic('rad', 'g')} ${T(`LA RESTRICCIÓN REAL · TORMENTA ${l.n}/3`, `THE REAL CONSTRAINT · STORM ${l.n}/3`)}</h2>
    <p class="fuente">${sourceText(l.flare)}</p>
    <p class="grande-txt">${l.refugio ? T('Te refugiaste: <b>casi sin radiación</b>, pero perdiste lo que estabas haciendo y el refugio gastó energía.', 'You sheltered: <b>almost no radiation</b>, but you lost what you were doing and the shelter used power.') : T('Te quedaste afuera: avanzaste en lo tuyo, pero <b>esa radiación ya no se borra</b>.', 'You stayed outside: you made progress on your own tasks, but <b>that radiation never goes away</b>.')}</p>
    <div class="dosis-comp">
      <div>${T(`<span>Recibiste</span>`, `<span>You received</span>`)}<i style="width:${pctBar(l.got)}%" class="${l.refugio ? 'ok' : 'bad'}"></i><b>${l.got} mSv</b></div>
      <div>${T(`<span>En el refugio</span>`, `<span>In the shelter</span>`)}<i style="width:${pctBar(l.could)}%" class="ok"></i><b>${l.could} mSv</b></div>
      <div>${T(`<span>Afuera</span>`, `<span>Outside</span>`)}<i style="width:${pctBar(l.worst)}%" class="bad"></i><b>${l.worst} mSv</b></div>
    </div>
    ${T(`<p><small>Barras sobre el límite de esta misión del juego (${lim} mSv, una escala chica para 10 días). En la vida real, la NASA permite como máximo <b>600 mSv en TODA la carrera</b> de un astronauta, y trabaja con el lema ALARA: tan poca radiación como sea razonable.</small></p>`, `<p><small>Bars over this game mission's limit (${lim} mSv, a small scale for 10 days). In real life, NASA allows at most <b>600 mSv in an astronaut's WHOLE career</b>, and works with the motto ALARA: as little radiation as reasonably achievable.</small></p>`)}
    ${T(`<p><b>Así lo hacen de verdad:</b> ${Sys.shelterOf(s).why} En la Estación, en una tormenta solar la tripulación se va a los módulos con más blindaje.</p>`, `<p><b>This is how it is done for real:</b> ${Sys.shelterOf(s).why} On the Station, during a solar storm the crew goes to the modules with the most shielding.</p>`)}
    ${T(`<p><small>Estudio real de NASA (OSDR · OSD-340): ratones expuestos a radiación como la del espacio profundo tuvieron más riesgo de cáncer de la sangre. Por eso se limita la dosis.</small></p>`, `<p><small>Real NASA study (OSDR · OSD-340): mice exposed to deep-space-like radiation had a higher risk of blood cancer. That is why the dose is limited.</small></p>`)}
    <div class="fila fila-fija"><button id="ok" class="grande">${ic('ok')} ${T('ENTENDIDO', 'GOT IT')}</button></div>`, 'tormenta-card');
  $('ok').onclick = close;
}

/**
 * Ventana de inicio de partida. Primero lo ESENCIAL (la misión en una línea, los controles de ESTE aparato y EMPEZAR) y debajo, plegado,
 * lo OPCIONAL (historia, las 3 reglas y más detalles). Los textos cambian según el aparato: teclado (PC), botones (tablet) o rueda (teléfono).
 * Arriba hay una ✕ que la cierra (igual que EMPEZAR).
 */
function intro() {
  document.body.classList.remove('derrota');
  menu = 'intro'; const L = s.L;
  const night = s.mode === 'noche';
  const tact = esTactil(), rueda = document.body.classList.contains('rueda-on');
  const dev = (pc, tab, cel) => (rueda ? cel : tact ? tab : pc); // compu / tablet / teléfono (o tablet con rueda)
  const mision = night ? T('Escapa antes de las <b>06:00</b> sin que te descubran en el pase de lista.', 'Escape before <b>06:00</b> without being caught at roll call.')
    : T('Mantén viva la base <b>10 días</b>: cuida aire, energía, radiación y comida hasta que llegue la nave de rescate.', 'Keep the base alive for <b>10 days</b>: look after air, power, radiation and food until the rescue ship arrives.');
  const controles = dev(
    T('<span><kbd>WASD</kbd> o <kbd>flechas</kbd> moverse</span><span><kbd>E</kbd> usar / hablar</span><span><kbd>Shift</kbd> agacharse</span><span><kbd>F</kbd> esconderse</span><span><kbd>Tab</kbd> mapa</span><span><kbd>Esc</kbd> pausa</span>', '<span><kbd>WASD</kbd> or <kbd>arrows</kbd> move</span><span><kbd>E</kbd> use / talk</span><span><kbd>Shift</kbd> crouch</span><span><kbd>F</kbd> hide</span><span><kbd>Tab</kbd> map</span><span><kbd>Esc</kbd> pause</span>'),
    T('<span><kbd>🕹</kbd> joystick: moverse</span><span><kbd>USAR</kbd> usar / hablar</span><span><kbd>AGACHAR</kbd> <kbd>ESCONDER</kbd></span><span><kbd>MAPA</kbd></span><span><kbd>⏸</kbd> pausa</span>', '<span><kbd>🕹</kbd> joystick: move</span><span><kbd>USE</kbd> use / talk</span><span><kbd>CROUCH</kbd> <kbd>HIDE</kbd></span><span><kbd>MAP</kbd></span><span><kbd>⏸</kbd> pause</span>'),
    T('<span><kbd>🕹</kbd> joystick: moverse</span><span><kbd>USAR</kbd> toca: usar / hablar</span><span><kbd>USAR</kbd> mantén 2 s: más acciones</span><span><kbd>⏸</kbd> pausa</span>', '<span><kbd>🕹</kbd> joystick: move</span><span><kbd>USE</kbd> tap: use / talk</span><span><kbd>USE</kbd> hold 2 s: more actions</span><span><kbd>⏸</kbd> pause</span>'));
  const esconde = dev(T('Agáchate (Shift) y escóndete (F).', 'Crouch (Shift) and hide (F).'), T('Agáchate (AGACHAR) y escóndete (ESCONDER).', 'Crouch (CROUCH) and hide (HIDE).'), T('Mantén USAR y elige AGACHAR o ESCONDER.', 'Hold USE and pick CROUCH or HIDE.'));
  const panel = (n, es, en) => dev(T(`tecla ${n}`, `key ${n}`), T(`botón ${n} ${es}`, `button ${n} ${en}`), T(`en la pausa ⏸`, `in the pause ⏸`));
  open(`<button type="button" id="x-intro" class="btn-x" aria-label="${T('Cerrar y empezar', 'Close and start')}">✕</button>
    <h2>${ic(s.loc, 'g')} ${nm(L).toUpperCase()} · ${s.daily ? T('RETO DEL DÍA', 'DAILY CHALLENGE') : night ? T('UNA NOCHE', 'ONE NIGHT') : T('DÍA 1', 'DAY 1')}</h2>
    <p class="mision">🎯 ${mision}</p>
    ${s.dFlare ? T(`<p>☀️ <b>Llamarada del día:</b> clase ${s.dFlare.flare.cls} (${s.dFlare.flare.date}, archivo real de NASA DONKI). En algún momento de la noche sonará un aviso de 30 s: <b>refugio</b> (pierdes tiempo) o <b>seguir escapando</b> (pierdes salud). Es la misma para todos.</p>`, `<p>☀️ <b>Flare of the day:</b> class ${s.dFlare.flare.cls} (${s.dFlare.flare.date}, real NASA DONKI archive). At some point during the night a 30 s warning will sound: <b>shelter</b> (you lose time) or <b>keep escaping</b> (you lose health). It is the same for everyone.</p>`) : ''}
    <div class="basico">${controles}</div>
    <details class="mas-info"><summary>${T('VER MÁS: historia y cómo se juega', 'MORE: story and how to play')}</summary>
      ${night ? T(`<p>Son las 21:00. Llevas semanas preparando el escape y esta es la noche. Tienes hasta las <b>06:00</b> (unos 7 minutos).</p>`, `<p>It is 21:00. You have spent weeks preparing your escape and tonight is the night. You have until <b>06:00</b> (about 7 minutes).</p>`) : T(L.intro, L.introEn).map((x) => `<p>${x}</p>`).join('')}
      <div class="pasos3">
        <div><b>${ic('reloj')} ${T(`1 · CUMPLE LA RUTINA`, `1 · FOLLOW THE ROUTINE`)}</b><p>${T(`Arriba dice dónde ir y una flecha te guía. Faltar sube la alerta de ${L.ai}.`, `The top says where to go and an arrow guides you. Missing it raises the alert of ${L.ai}.`)}</p></div>
        <div><b>${ic('alerta')} ${T(`2 · ESQUIVA A LA IA`, `2 · DODGE THE AI`)}</b><p>${T('El cono amarillo es lo que ve; rojo, te persigue.', 'The yellow cone is what it sees; red means it is chasing you.')} ${esconde}</p></div>
        <div><b>${ic('mant')} ${T(`3 · CUIDA LA BASE`, `3 · CARE FOR THE BASE`)}</b><p>${T(`De 08:00 a 12:00 haz las 4 revisiones (${panel(1, 'Mantenim.', 'Upkeep')}). Si un sistema baja, la base sufre. Extra: el PLAN para volver antes (${panel(2, 'Plan', 'Plan')}).`, `From 08:00 to 12:00 do the 4 checks (${panel(1, 'Mantenim.', 'Upkeep')}). If a system drops, the base suffers. Extra: the PLAN to return sooner (${panel(2, 'Plan', 'Plan')}).`)}</p></div>
      </div>
      ${night ? T('<p>En tu escondite ya tienes parte del plan.</p>', '<p>You already have part of the plan in your hiding place.</p>') : ''}
      ${T(`<p><b>3 formas de escapar:</b> el PLAN (4 piezas), el SABOTAJE (apaga la IA: código + llave) o el MOTÍN (gánate a los 3 compañeros: código + combustible). Personaje: <b>${nm(G.perk(s))}</b>.</p>`, `<p><b>3 ways to escape:</b> the PLAN (4 pieces), SABOTAGE (shut down the AI: code + key) or MUTINY (win over the 3 crewmates: code + fuel). Character: <b>${nm(G.perk(s))}</b>.</p>`)}
      ${T(`<p>Si faltas al horario o te ven haciendo algo raro, sube la <span style="color:var(--amber)">alerta</span>. A 100: bloqueo y te quitan lo que llevas.</p>`, `<p>If you miss the schedule or they see you doing something strange, the <span style="color:var(--amber)">alert</span> rises. At 100: lockdown and they take what you carry.</p>`)}
      ${T(`<p>Tus 3 compañeros te piden piezas: ayúdalos y te devuelven favores. Los problemas se resuelven con protocolos de la NASA.</p>`, `<p>Your 3 crewmates ask you for parts: help them and they return the favor. Problems are solved with NASA protocols.</p>`)}
    </details>
    <div class="fila fila-fija"><button id="ok" class="grande">${ic('jugar')} ${T('EMPEZAR', 'START')}</button><button id="ay" class="sec">${ic('ayuda')} ${T('CONTROLES', 'CONTROLS')}</button></div>`);
  $('ok').onclick = close; $('x-intro').onclick = close; $('ay').onclick = () => help(intro);
}

function help(back) {
  if (getLang() !== 'es') return helpEn(back);
  menu = 'ayuda';
  const sec = (titulo, cuerpo, abierta = false) => `<details class="mas-info" ${abierta ? 'open' : ''}><summary>${titulo}</summary>${cuerpo}</details>`;
  open(`<h2>${ic('ayuda', 'g')} CÓMO SE JUEGA</h2>
    <div class="basico esencial"><span>${ic('reloj')} Cumple el horario: arriba dice <b>dónde ir ahora</b></span><span>${ic('alerta')} Esquiva a la IA: <b>cono amarillo</b> = te ve, <b>rojo</b> = te persigue</span><span>${ic('salud')} Vigila las barras: <b>«!»</b> es que algo va mal</span><span>${ic('mochila')} Junta las 4 piezas del PLAN para escapar (tecla <kbd>2</kbd>)</span></div>
    ${sec('TECLAS', `<p><kbd>WASD</kbd>/<kbd>flechas</kbd> moverse · <kbd>Shift</kbd> agacharse (silencioso) · <kbd>E</kbd> usar / hablar · <kbd>N</kbd> ver/ocultar nombres de objetos y salas · <kbd>F</kbd> esconderse · <kbd>T</kbd> lanzar pieza (ruido) · <kbd>G</kbd> soltar lo último (o SOLTAR en la mochila) · ${s && G.dif(s).noBetray ? '' : '<kbd>B</kbd> delatar a un compañero · '}<kbd>I</kbd> mochila · <kbd>C</kbd> fabricar · <kbd>Q</kbd> inhibidor · <kbd>M</kbd> música · <kbd>1</kbd> mantenimiento · <kbd>2</kbd> plan · <kbd>3</kbd> amenazas · <kbd>4</kbd> últimos avisos (cada tecla abre y cierra su panel) · <kbd>V</kbd> pantalla completa · <kbd>Esc</kbd> pausa, ajustes (música, efectos de sonido, efectos suaves, nombres) y el historial completo</p>`, true)}
    ${sec('SIGILO Y COMPAÑEROS', `<p><b>Sigilo:</b> si un dron o un guardia te <b>toca</b> con algo raro encima, te atrapan. Caminar hace ruido: agáchate. Escóndete en <b>casilleros</b> o bajo las camas; si te vieron entrar, vendrán a revisar y tendrás que <b>contener la respiración</b>. Lanza piezas para distraerlos.</p>
      <p><b>Manipula:</b> cuando un compañero está contento (ya le hiciste el favor), pídele que distraiga a un dron o guardia 30 s. Soborna al Soplón, desenmascara al Doble, entretén a Volkov.</p>
      <p><b>Vigilancia:</b> el cono amarillo es lo que ve; rojo = te persigue. Los <b>conductos</b> (rejillas) los esquivan: necesitas un destornillador.</p>
      <p><b>Villanos:</b> cada destino tiene 10. La IA siempre está; los demás se sortean cada día (mira «Amenazas de hoy»). Las <b>misiones por radio</b> tienen reloj y dan premios.</p>
      <p><b>Emergencias:</b> los drones se distraen yendo al problema. Es tu momento.</p>`)}
    ${sec('ESCAPE Y PROGRESO', `<p><b>3 rutas de escape:</b> PLAN (4 piezas) · SABOTAJE (IA apagada + código + llave) · MOTÍN (los 3 compañeros con ♥♥ + código + combustible).${s && G.dif(s).noBetray ? '' : ' <b>Delatar</b> (B) baja tu alerta y te da una tarjeta, pero ese compañero te odiará y te acusará.'}</p>
      <p><b>Notas:</b> en los cajones hay notas que cuentan qué pasó. Junta las 6 de un destino para el <b>final verdadero</b>.</p>
      <p><b>Entre partidas:</b> ganas puntos (más si ganas, rachas, medallas y notas) para desbloquear personajes y el nivel Pesadilla. <b>Una noche</b> = partida corta de 7 min. <b>Reto del día</b> = la misma partida para todos: compara tu tiempo.</p>
      <p><b>Mejora:</b> la cinta del Gimnasio sube la <b>fuerza</b> (cargas más y mueves cosas pesadas). Las terminales del Laboratorio suben el <b>conocimiento</b> (desbloquean recetas).</p>
      <p><b>Cajones</b> con luz amarilla tienen piezas (se llenan cada mañana). Guarda herramientas en tu <b>escondite</b>: en el pase de lista te revisan si llevas 2 o más.</p>`)}
    ${sec('LA BASE Y LA RUTINA', `<p><b>Rutina:</b> 06:00 pase de lista · 07:00 desayuno · 08:00 trabajo · 12:00 almuerzo · 13:00 ejercicio · 15:00 libre · 18:00 pase de lista · 19:00 cena · 20:00 libre · 22:00 luces apagadas.</p>
      <p><b>Sistemas de la Estación:</b> soporte vital, energía, radiación y comida bajan solos cada día. De 08:00 a 12:00 haz las 4 <b>revisiones</b> (E sobre cada panel de color: un mini-protocolo de 3 pasos en orden): lo que omitas te cuesta nivel, integridad y alerta. Con poca energía todo lo demás se degrada más rápido. La radiación se mide como % del límite de la misión: si llega a 100 %, pierdes. Con <b>⚡ REFLEJOS</b> (en el título), al terminar una revisión puede sonar una emergencia: corre al punto rojo y pulsa E antes de que se acabe la cuenta o la misión termina.</p>
      <p><b>Afuera</b> (Luna y Marte) solo se sobrevive con el traje: mira el oxígeno.</p>`)}
    <div class="fila fila-fija"><button id="volver" class="grande">${T('VOLVER', 'BACK')}</button></div>`);
  $('volver').onclick = () => (back ? back() : close());
}

function craftMenu() {
  menu = 'fabricar';
  const rows = G.recipes(s).map((r) => {
    const ok = G.canCraft(s, r); const it = ITEMS[r.id];
    return `<div class="receta ${ok ? '' : 'no'}"><span>${icon(r.id)}</span><span>${G.itemName(s, r.id)}<small>${r.need.map((n) => `${G.has(s, n) ? '✓' : '✗'} ${ITEMS[n].name}`).join(' · ')}${r.k ? ` · ${T('conocimiento', 'knowledge')} ${r.k}` : ''}${it.info ? ' — ' + it.info : ''}</small></span><button data-r="${r.id}" ${ok ? '' : 'disabled'}>${T('HACER', 'MAKE')}</button></div>`;
  }).join('');
  open(`<h2>${T('FABRICAR', 'CRAFT')}</h2><p style="color:var(--dim)">${T('Fabricar es sospechoso si la vigilancia te ve.', 'Crafting looks suspicious if surveillance sees you.')}</p><div class="recetas">${rows}</div><div class="fila"><button id="cerrar">${T('CERRAR', 'CLOSE')} [C]</button></div>`);
  $('ventana').querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { if (G.craft(s, b.dataset.r)) M.sfx('fabricar'); craftMenu(); }));
  $('cerrar').onclick = close;
}

function stashMenu() {
  menu = 'escondite';
  const list = (arr, act) => arr.map((it, i) => `<button data-${act}="${i}">${icon(it)} ${G.itemName(s, it)}</button>`).join('') || `<p style="color:var(--dim)">${T('(vacío)', '(empty)')}</p>`;
  open(`<h2>${T('TU ESCONDITE', 'YOUR HIDING PLACE')}</h2><p>${T('Lo que guardas aquí no te lo quitan en los pases de lista ni en un bloqueo.', 'What you keep here is not taken at roll calls or lockdowns.')}</p>
    <div class="dos"><div><h3>${T('LLEVAS', 'CARRYING')} (${s.p.inv.length}/${G.capacity(s)})</h3><div class="lista-it">${list(s.p.inv, 'poner')}</div></div>
    <div><h3>${T('ESCONDIDO', 'HIDDEN')} (${s.stash.length}/${G.STASH_MAX})</h3><div class="lista-it">${list(s.stash, 'sacar')}</div></div></div>
    <div class="fila"><button id="cerrar">${T('CERRAR', 'CLOSE')}</button></div>`);
  $('ventana').querySelectorAll('[data-poner]').forEach((b) => (b.onclick = () => { if (G.stashPut(s, +b.dataset.poner)) M.sfx('soltar'); stashMenu(); }));
  $('ventana').querySelectorAll('[data-sacar]').forEach((b) => (b.onclick = () => { if (G.stashTake(s, +b.dataset.sacar)) M.sfx('recoger'); stashMenu(); }));
  $('cerrar').onclick = () => { s.pending = null; close(); };
}

function bagMenu() {
  menu = 'mochila';
  const it = (id, i) => { const d = ITEMS[id]; return `<div class="it ${d.plan ? 'plan' : d.tool ? 'tool' : ''}">${icon(id)}<span>${G.itemName(s, id)}<small>${d.info ?? (d.tool ? T('Herramienta (te la quitan si te pillan).', 'Tool (they take it if you get caught).') : T('Pieza para fabricar. Se puede lanzar (T) para hacer ruido.', 'Crafting part. You can throw it (T) to make noise.'))}</small>${i != null && !(id in s.L.plan) ? `<button class="soltar" data-soltar="${i}">${T('SOLTAR', 'DROP')}</button>` : ''}</span></div>`; };
  const plan = G.PLAN_IDS.map((id) => `<li class="${G.has(s, id) ? 'ok' : ''}">${s.L.plan[id].name}${G.has(s, id) ? '' : ' — ' + s.L.plan[id].hint}</li>`).join('');
  open(`<h2>${T('MOCHILA', 'BACKPACK')} (${s.p.inv.length}/${G.capacity(s)})</h2>
    <div class="mochila">${s.p.inv.map((x, i) => it(x, i)).join('') || `<p style="color:var(--dim)">${T('(vacía)', '(empty)')}</p>`}</div>
    <h3>${T('EN TU ESCONDITE', 'IN YOUR HIDING PLACE')} (${s.stash.length}/${G.STASH_MAX})</h3><div class="mochila">${s.stash.map((x) => it(x)).join('') || `<p style="color:var(--dim)">${T('(vacío)', '(empty)')}</p>`}</div>
    <h3>${T('RUTAS DE ESCAPE', 'ESCAPE ROUTES')}</h3><ul class="plan">${G.routes(s).map((r) => `<li class="${r.ok ? 'ok' : ''}"><b>${r.name}</b> — ${r.desc}</li>`).join('')}</ul>
    <h3>${T('PLAN DE REGRESO', 'RETURN PLAN')}</h3><ul class="plan">${plan}</ul>
    ${s.notes.length ? `<h3>${T('NOTAS ENCONTRADAS EN ESTA PARTIDA', 'NOTES FOUND THIS GAME')}</h3>${s.notes.map((i) => `<details class="nota"><summary>📄 ${NOTES[s.loc][i][0]}</summary><p>${NOTES[s.loc][i][1]}</p></details>`).join('')}` : ''}<p style="color:var(--dim)">${T('Notas de', 'Notes from')} ${s.L.name}: ${G.notesKnown(s)}/${NOTES[s.loc].length} <button class="mini" id="archivo">${T('VER ARCHIVO', 'VIEW ARCHIVE')}</button></p>
    <p style="color:var(--dim)">${T('Herramientas encima', 'Tools on you')}: ${s.p.inv.filter(G.isContraband).length} · ${T('con 2 o más te las quitan en el pase de lista.', 'with 2 or more they are taken at roll call.')}</p>
    <div class="fila"><button id="cerrar">${T('CERRAR', 'CLOSE')} [I]</button></div>`);
  $('cerrar').onclick = close;
  $('archivo').onclick = () => archiveScreen(bagMenu);
  $('ventana').querySelectorAll('[data-soltar]').forEach((b) => (b.onclick = () => { const n0 = s.p.inv.length; G.dropItem(s, +b.dataset.soltar); if (s.p.inv.length < n0) M.sfx('soltar'); bagMenu(); }));
}

// Minijuego 0: contener la respiración. Mantén ESPACIO (o el botón) para empujar la aguja dentro de la zona.
function breathGame() {
  menu = 'respira'; M.sting('susto', { suave: FX.suave() }); scareT = 0.5; s.stats.hid++; const who = s.pending.who; const name = who.vid ? VILLAINS[who.vid].name : T(`Un ${s.L.watcher}`, `A ${s.L.watcher === 'dron' ? 'drone' : s.L.watcher === 'vigía' ? 'lookout' : s.L.watcher}`);
  open(`<h2>${T('NO RESPIRES', 'HOLD YOUR BREATH')}</h2><p>${T(`${name} está revisando tu escondite… Mantén <kbd>ESPACIO</kbd> (o el botón) para controlar la respiración y deja la aguja dentro de la zona.`, `${name} is checking your hiding place… Hold <kbd>SPACE</kbd> (or the button) to control your breathing and keep the needle inside the zone.`)}</p>
    <div class="respira-latido" id="lat">♥</div><div class="respira"><div class="zona" id="zona"></div><div class="aguja" id="aguja"></div></div><div class="tiempo"><i id="rt"></i></div>
    <div class="fila"><button id="aguanta">${T('AGUANTAR (mantener)', 'HOLD ON (keep pressed)')}</button></div>`);
  let x = 50, v = 0, time = 0, out = 0; const total = 6; let zc = 50; const zw = 26; let ptr = false;
  const b = $('aguanta'); b.onpointerdown = () => (ptr = true); b.onpointerup = b.onpointerleave = () => (ptr = false);
  const tick = setInterval(() => {
    const dt = 0.05; time += dt; const hold = ptr || keys.has(' ');
    zc = 50 + Math.sin(time * 1.3) * 25 + Math.sin(time * 3.1) * 8;
    v += (hold ? -70 : 55) * dt + (Math.random() - 0.5) * 40 * dt; v *= 0.9; x = Math.max(0, Math.min(100, x + v * dt * 6));
    const inside = Math.abs(x - zc) < zw / 2; if (!inside) out += dt;
    $('zona').style.left = `${zc - zw / 2}%`; $('zona').style.width = `${zw}%`; $('aguja').style.left = `${x}%`; $('aguja').style.background = inside ? '#fff' : '#ff4b4b';
    $('rt').style.width = `${(1 - time / total) * 100}%`; $('lat').style.transform = `scale(${1 + (Math.sin(time * (8 + out * 6)) > 0.6 ? 0.3 : 0)})`;
    if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) beep(55 + out * 30, 0.1, 'sine', 0.08);
    if (out > 1.6) done(false); else if (time >= total) done(true);
  }, 50);
  function done(ok) { clearInterval(tick); M.ui(ok ? 'ok' : 'error'); G.resolveBreath(s, ok); close(); }
}

// Minijuego 1: protocolo NASA, tocar los pasos en orden.
function protocolGame(id, alFin = null) {
  menu = 'protocolo';
  const pr = PROTOCOLS[id]; const order = T(pr.steps, pr.stepsEn); const shuffled = order.map((x, i) => [x, i]).sort(() => Math.random() - 0.5);
  const total = pr.time ?? 16; let next = 0; let time = total;
  open(`<h2>${T(pr.title, pr.titleEn)}</h2><p>${T('Toca los pasos <b>en orden</b>.', 'Tap the steps <b>in order</b>.')} ${pr.mant ? T('Sin prisa: si te equivocas solo pierdes unos segundos.', 'No rush: if you make a mistake you only lose a few seconds.') : T('Error = −2 s.', 'Mistake = −2 s.')}</p><p class="fuente"><b>${T(PROTO_NIVEL[(PROTO_FUENTE[id]||{}).nivel] || '', PROTO_NIVEL_EN[(PROTO_FUENTE[id]||{}).nivel])}</b><br>${T((PROTO_FUENTE[id]||{}).fuente || '', (PROTO_FUENTE[id]||{}).fuenteEn)}</p><div class="tiempo"><i id="pt"></i></div>
    <div class="pasos" id="pasos">${shuffled.map(([x, i]) => `<button data-i="${i}">${x}</button>`).join('')}</div>${pr.mant ? `<div class="fila"><button id="pc" class="sec">${T('AHORA NO', 'NOT NOW')}</button></div>` : ''}`);
  const tick = setInterval(() => { time -= 0.1; const el = $('pt'); if (el) el.style.width = `${Math.max(0, time / total * 100)}%`; if (time <= 0) done(false); }, 100);
  function done(ok) { clearInterval(tick); M.ui(ok ? 'ok' : 'error'); if (alFin) alFin(ok); else G.resolveProtocol(s, ok); close(); }
  if (pr.mant) $('pc').onclick = () => { clearInterval(tick); M.ui('cerrar'); if (alFin) alFin(false); else G.resolveProtocol(s, false); close(); }; // el mantenimiento se puede dejar para después, sin castigo
  $('pasos').querySelectorAll('button').forEach((b) => (b.onclick = () => {
    if (+b.dataset.i === next) { b.classList.add('hecho'); b.disabled = true; b.textContent = `${next + 1}. ${b.textContent}`; next++; beep(520 + next * 60, 0.06); if (next === order.length) done(true); }
    else { time -= 2; M.ui('error'); shake(); }
  }));
}
function shake() { const v = $('ventana'); v.classList.remove('sacudir'); void v.offsetWidth; v.classList.add('sacudir'); }

// Minijuego 2: hackeo, memorizar una secuencia y repetirla.
function codeGame() {
  menu = 'codigo';
  const len = 4 + s.frags.filter(Boolean).length; const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
  let pos = 0; let showing = true;
  open(`<h2>${T('HACKEO · registro de ', 'HACK · record of ')}${s.L.ai}</h2><p id="cg-msg">${T('Memoriza la secuencia…', 'Memorize the sequence…')}</p>
    <div class="teclado" id="teclado">${Array.from({ length: 9 }, (_, i) => `<button data-k="${i}" disabled>${'▲●■◆★✚♦▼◉'[i]}</button>`).join('')}</div>`);
  const btns = [...$('teclado').querySelectorAll('button')];
  seq.forEach((k, i) => { setTimeout(() => { btns[k].classList.add('lit'); beep(300 + k * 60, 0.15); }, 600 + i * 650); setTimeout(() => btns[k].classList.remove('lit'), 1000 + i * 650); });
  setTimeout(() => { showing = false; btns.forEach((b) => (b.disabled = false)); $('cg-msg').textContent = T('Ahora repítela.', 'Now repeat it.'); }, 700 + len * 650);
  btns.forEach((b) => (b.onclick = () => {
    if (showing) return; const k = +b.dataset.k;
    b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 150);
    if (k === seq[pos]) { pos++; beep(300 + k * 60, 0.08); if (pos === len) { M.ui('ok'); G.resolveCodigo(s, true); close(); } }
    else { M.ui('error'); shake(); setTimeout(() => { G.resolveCodigo(s, false); close(); }, 300); showing = true; }
  }));
}

// Minijuego 3: cables, unir cada color con su par.
function cablesGame() {
  menu = 'cables';
  const colors = ['#ff4b4b', '#4dff88', '#5fb6ff', '#ffd23d']; const right = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  let sel = null; let done = 0; let errors = 0; let time = 14;
  open(`<h2>${T('CABLES', 'WIRES')} · ${s.pending.h.def.name}</h2><p>${T('Une cada cable con su color (toca uno a la izquierda y luego su par). 2 errores = falla.', 'Connect each wire to its color (tap one on the left, then its match). 2 mistakes = fail.')}</p><div class="tiempo"><i id="ct"></i></div>
    <div class="cables"><div>${colors.map((c, i) => `<button data-l="${i}" style="background:${c}"></button>`).join('')}</div><div>${right.map((i) => `<button data-r="${i}" style="background:${colors[i]}"></button>`).join('')}</div></div>`);
  const tick = setInterval(() => { time -= 0.1; const el = $('ct'); if (el) el.style.width = `${Math.max(0, time / 14 * 100)}%`; if (time <= 0) finish(false); }, 100);
  function finish(ok) { clearInterval(tick); M.ui(ok ? 'ok' : 'error'); G.resolveProtocol(s, ok); close(); }
  $('ventana').querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { $('ventana').querySelectorAll('[data-l]').forEach((x) => x.classList.remove('sel')); sel = +b.dataset.l; b.classList.add('sel'); beep(400, 0.05); }));
  $('ventana').querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    if (sel === null || b.disabled) return;
    if (+b.dataset.r === sel) { b.disabled = true; b.textContent = '✓'; const l = $('ventana').querySelector(`[data-l="${sel}"]`); l.disabled = true; l.textContent = '✓'; sel = null; done++; beep(700 + done * 80, 0.08); if (done === 4) finish(true); }
    else { errors++; M.ui('error'); shake(); if (errors >= 2) finish(false); }
  }));
}

function nextUnlock(total) {
  const mt = Meta.load(); const all = [...Object.entries(PERKS).map(([k, d]) => [k, d.name, d.cost]), ...Object.entries(DIFS).filter(([, d]) => d.locked).map(([k, d]) => ['dif:' + k, d.name, d.locked])];
  const n = all.filter(([k, , c]) => c && !mt.unlocked.includes(k)).sort((a, b) => a[2] - b[2])[0];
  return n ? `${n[1]} (${n[2]} pts, te faltan ${Math.max(0, n[2] - total)})` : 'ya tienes todo';
}
/** Bitácora de la misión: las causas («Día N: hiciste X → pasó Y») y la tabla día por día de los 4 sistemas, las revisiones, las tormentas y la dosis. */
function bitacoraHTML() {
  const inf = informe(s); if (!inf) return '';
  const celda = (v, est, extra = '') => `<td class="${est}">${v}${UI.MARCA[est]}${extra}</td>`;
  const fila = (id) => `<tr><th>${ic(id)} ${Sys.SYS[id].name}</th>${inf.dias.map((d) => celda(d.lvl[id], estadoNivel(d.lvl[id]))).join('')}</tr>`;
  return `<section class="bloque bitacora" id="bitacora"><h3>${T('BITÁCORA DE LA MISIÓN · POR QUÉ PASÓ', 'MISSION LOG · WHY IT HAPPENED')}</h3>
    ${inf.causas.length ? `<ul class="causas">${inf.causas.map((c) => `<li class="${c.tipo}">${ic(c.ic)} ${c.txt}</li>`).join('')}</ul>` : ''}
    <p class="bit-desliza">${T('← Desliza la tabla para ver todos los días →', '← Slide the table to see all the days →')}</p>
    <div class="bit-tabla"><table><thead><tr><th>${T('Día', 'Day')}</th>${inf.dias.map((d) => `<th>${d.day}</th>`).join('')}</tr></thead><tbody>
      ${Sys.SYS_IDS.map(fila).join('')}
      <tr><th>${ic('ok')} ${T('Revisiones', 'Checks')}</th>${inf.dias.map((d) => d.curso ? `<td title="${T('turno en curso', 'shift in progress')}">${d.hechas}/4…</td>` : celda(`${d.hechas}/4`, d.hechas === 4 ? 'ok' : d.hechas >= 2 ? 'warn' : 'bad')).join('')}</tr>
      <tr><th>☀ ${T('Tormenta', 'Storm')}</th>${inf.dias.map((d) => d.storm ? `<td class="${d.storm === 'refugio' ? 'ok' : 'bad'}" title="${d.storm === 'refugio' ? T('en el refugio', 'in the shelter') : T('afuera', 'outside')}">${d.storm === 'refugio' ? T('ref.', 'shel.') : T('afuera', 'out')}</td>` : '<td>·</td>').join('')}</tr>
      <tr><th>${ic('rad')} ${T('Dosis %', 'Dose %')}</th>${inf.dias.map((d) => celda(d.dosePct, d.dosePct >= 75 ? 'bad' : d.dosePct >= 50 ? 'warn' : 'ok')).join('')}</tr>
    </tbody></table></div>
    <small>${T('Cada columna es un día. Los números son el nivel de cada sistema al terminar el día; «!» avisa que estuvo bajo. La dosis solo sube: nunca se borra.', 'Each column is one day. The numbers are each system level at the end of the day; “!” warns it was low. The dose only goes up: it never goes away.')}</small></section>`;
}
// ---------- modo clase (alumno) y panel docente (docente): sin servidor; el alumno copia una línea y el docente pega todas ----------
let ultimoQuiz = null; // la pregunta de cierre de la partida que acaba de terminar (para la línea del docente)
const hoyISO = () => new Date().toISOString().slice(0, 10);
function lineaClase(o) {
  const sis = s.sys ? Math.round(Object.values(s.sys.lvl).reduce((a, b) => a + b, 0) / 4) : 0;
  return Doc.formatoLinea({ clase: getOpt('clase', ''), nombre: getOpt('nombre', ''), fecha: hoyISO(), destino: s.loc, nivel: s.dif, gano: !!o.won, estrellas: o.stars ?? 0, dosis: s.sys ? Math.min(100, Sys.dosePct(s)) : 0, sistemas: sis, quizId: ultimoQuiz?.id ?? '', quizOk: !!ultimoQuiz?.ok });
}
function claseScreen() {
  menu = 'clase';
  open(`<h2>🏫 ${T('MODO CLASE', 'CLASS MODE')}</h2>
    <p>${T('Tu docente te da un <b>código de clase</b> (por ejemplo 5B). Al terminar una partida aparece el botón <b>COPIAR PARA MI DOCENTE</b>: copias una línea y se la mandas (chat o correo).', 'Your teacher gives you a <b>class code</b> (for example 5B). When a game ends, the <b>COPY FOR MY TEACHER</b> button appears: you copy one line and send it (chat or email).')}</p>
    <p style="color:var(--dim)">${T('No se envía nada por internet: todo se queda en este aparato hasta que tú copias la línea.', 'Nothing is sent over the internet: everything stays on this device until you copy the line.')}</p>
    <label class="cert-nombre"><span>${T('Tu nombre:', 'Your name:')}</span><input id="cl-nombre" maxlength="${Doc.MAX_NOMBRE}" autocomplete="off" value="${esc2(Doc.limpiaNombre(getOpt('nombre', '')))}"></label>
    <label class="cert-nombre"><span>${T('Código de clase:', 'Class code:')}</span><input id="cl-clase" maxlength="${Doc.MAX_CLASE}" autocomplete="off" value="${esc2(Doc.limpiaClase(getOpt('clase', '')))}" placeholder="5B"></label>
    <div class="fila"><button id="cl-guardar" class="grande">${ic('ok')} ${T('GUARDAR', 'SAVE')}</button><button id="cl-borrar" class="sec">${T('QUITAR', 'REMOVE')}</button><button id="volver" class="sec">${T('VOLVER', 'BACK')}</button></div>`);
  $('cl-guardar').onclick = () => { setOpt('nombre', Doc.limpiaNombre($('cl-nombre').value)); setOpt('clase', Doc.limpiaClase($('cl-clase').value)); M.ui('ok'); titleScreen(); };
  $('cl-borrar').onclick = () => { setOpt('clase', ''); M.ui('cerrar'); titleScreen(); };
  $('volver').onclick = titleScreen;
}
function docenteScreen() {
  menu = 'docente';
  open(`<h2>🧑‍🏫 ${T('PANEL DOCENTE', 'TEACHER PANEL')}</h2>
    <p>${T('Pega aquí las líneas que te mandan tus alumnos (una por línea; se aceptan mensajes completos de chat) y toca ANALIZAR.', 'Paste here the lines your students send you (one per line; whole chat messages are fine) and tap ANALYZE.')}</p>
    <textarea id="dc-texto" rows="5" placeholder="CUSTODIA1|5B|Ana|2026-11-15|estacion|cadete|1|3|12|92|radiacion-suma|1" aria-label="${T('Líneas de los alumnos', 'Student lines')}"></textarea>
    <div class="fila"><button id="dc-analiza" class="grande">${ic('ok')} ${T('ANALIZAR', 'ANALYZE')}</button><button id="volver" class="sec">${T('VOLVER', 'BACK')}</button></div>
    <div id="dc-res" aria-live="polite"></div>`);
  $('volver').onclick = titleScreen;
  $('dc-analiza').onclick = () => {
    const { partidas, invalidas, repetidas } = Doc.leeVarias($('dc-texto').value); const res = Doc.resumen(partidas); const cont = $('dc-res');
    if (!partidas.length) { cont.innerHTML = `<p class="quiz-v no">${T('No encontré resultados de CUSTODIA en lo que pegaste.', 'I did not find CUSTODIA results in what you pasted.')}${invalidas ? ' (' + invalidas + ')' : ''}</p>`; return; }
    const pq = (id) => { const q = Quiz.PREGUNTAS().find((x) => x.id === id); return q ? q.q : id; };
    cont.innerHTML = `<p><b>${partidas.length}</b> ${T('partidas leídas', 'games read')}${repetidas ? ' · ' + repetidas + ' ' + T('repetidas ignoradas', 'duplicates ignored') : ''}${invalidas ? ' · ' + invalidas + ' ' + T('líneas no válidas', 'invalid lines') : ''}</p>
      <div class="bit-tabla"><table class="doc-tabla"><thead><tr><th>${T('Clase', 'Class')}</th><th>${T('Alumnos', 'Students')}</th><th>${T('Partidas', 'Games')}</th><th>${T('% ganó', '% won')}</th><th>${T('% aciertos', '% correct')}</th></tr></thead><tbody>${res.clases.map((c) => `<tr><td>${esc2(c.clase)}</td><td>${c.alumnos}</td><td>${c.partidas}</td><td>${c.pctGanadas} %</td><td>${c.pctQuiz === null ? '—' : c.pctQuiz + ' %'}</td></tr>`).join('')}</tbody></table></div>
      <div class="bit-tabla"><table class="doc-tabla"><thead><tr><th>${T('Alumno', 'Student')}</th><th>${T('Clase', 'Class')}</th><th>${T('Partidas', 'Games')}</th><th>${T('Ganadas', 'Won')}</th><th>★</th><th>${T('Preguntas', 'Questions')}</th></tr></thead><tbody>${res.alumnos.map((a) => `<tr><td>${esc2(a.nombre)}</td><td>${esc2(a.clase)}</td><td>${a.partidas}</td><td>${a.ganadas}</td><td>${a.estrellasProm}</td><td class="${a.pctQuiz === null ? '' : a.pctQuiz >= 60 ? 'ok' : 'bad'}">${a.pctQuiz === null ? '—' : a.pctQuiz + ' %' + (a.pctQuiz < 60 ? '!' : '')}</td></tr>`).join('')}</tbody></table></div>
      ${res.masDificil ? `<p class="bloque aprende"><b>${T('La idea que más cuesta', 'The idea that is hardest')}:</b> ${esc2(pq(res.masDificil.id))} (${res.masDificil.pct} % ${T('de aciertos', 'correct')})</p>` : ''}
      <div class="fila"><button id="dc-copia" class="sec">📋 ${T('COPIAR CSV', 'COPY CSV')}</button><button id="dc-baja" class="sec">⬇ ${T('DESCARGAR CSV', 'DOWNLOAD CSV')}</button></div>`;
    const csv = Doc.aCSV(res);
    $('dc-copia').onclick = () => navigator.clipboard?.writeText(csv).then(() => { $('dc-copia').textContent = T('✓ COPIADO', '✓ COPIED'); M.ui('ok'); });
    $('dc-baja').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'resultados-custodia.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); M.ui('ok'); };
  };
}
/** Certificado de Cadete (ventana encima del final, así el final no se vuelve a calcular). Funciona igual en compu y en celular: nombre, vista previa, descargar y compartir. */
function certificado(o) {
  if ($('cert-modal')) return; const antes = menu; menu = 'cert';
  const sis = s.sys ? Math.round(Object.values(s.sys.lvl).reduce((a, b) => a + b, 0) / 4) : 0;
  const base = { destino: nm(s.L), estrellas: o.stars ?? 0, dias: Math.min(G.DAYS, s.day), sistemas: sis, dosis: s.sys ? Math.min(100, Sys.dosePct(s)) : 0, fecha: new Date().toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es-ES'), nivel: nm(G.dif(s)).toUpperCase() };
  const m = document.createElement('div'); m.id = 'cert-modal'; m.className = 'modal'; document.body.appendChild(m);
  m.innerHTML = `<div class="ventana cert-ventana"><h2>🎓 ${T('CERTIFICADO DE CADETE', 'CADET CERTIFICATE')}</h2>
    <label class="cert-nombre"><span>${T('Escribe tu nombre:', 'Type your name:')}</span><input id="cert-nombre" maxlength="24" autocomplete="off" value="${esc2(Cert.limpiaNombre(getOpt('nombre', '')))}" placeholder="${T('Cadete astronauta', 'Astronaut cadet')}"></label>
    <canvas id="cert-lienzo" class="cert" width="${Cert.ANCHO}" height="${Cert.ALTO}" role="img" aria-label="${T('Vista previa del certificado', 'Certificate preview')}"></canvas>
    <div class="fila"><button id="cert-bajar" class="grande">⬇ ${T('DESCARGAR', 'DOWNLOAD')}</button>${navigator.share ? `<button id="cert-comp" class="sec">${T('COMPARTIR', 'SHARE')}</button>` : ''}<button id="cert-volver" class="sec">${T('VOLVER', 'BACK')}</button></div></div>`;
  const cv2 = $('cert-lienzo'), g = cv2.getContext('2d'); const nombre = () => Cert.limpiaNombre($('cert-nombre').value);
  const pinta = () => Cert.dibujaCertificado(g, { ...base, nombre: nombre() });
  pinta(); document.fonts?.ready?.then(pinta); $('cert-nombre').oninput = () => { setOpt('nombre', nombre()); pinta(); };
  const archivo = () => new Promise((res) => cv2.toBlob((b) => res(b), 'image/png'));
  $('cert-bajar').onclick = async () => { M.ui('ok'); const b = await archivo(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = Cert.nombreArchivo({ nombre: nombre() }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  if ($('cert-comp')) $('cert-comp').onclick = async () => { try { const f = new File([await archivo()], Cert.nombreArchivo({ nombre: nombre() }), { type: 'image/png' }); const datos = { title: 'CUSTODIA', text: T('Mi certificado de Cadete Astronauta en CUSTODIA', 'My Astronaut Cadet certificate in CUSTODIA'), files: [f] }; if (navigator.canShare && !navigator.canShare(datos)) delete datos.files; await navigator.share(datos); } catch { /* el usuario canceló */ } };
  const cierra = () => { m.remove(); menu = antes; }; $('cert-volver').onclick = cierra; m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); cierra(); } });
  $('cert-nombre').focus({ preventScroll: true });
}
const esc2 = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function endScreen() {
  if (s.mode === 'academia') { academiaFin(); return; }
  ultimoQuiz = null; menu = 'fin'; clearSave(s.loc); document.body.classList.toggle('derrota', !s.over.won);
  const o = s.over; if (o.won && !s.daily) setBest(s.loc, o.stars);
  const r = Meta.finish(s); const dr = r.daily; const R_ = UI.resumenFin(s);
  // pregunta de cierre (mide si se aprendió lo central; ver quiz.js)
  const qz = Quiz.preguntaPara(s.seed ?? 0, Meta.quizHist()); const qop = Quiz.opciones(qz, s.seed ?? 0);
  const quizHTML = `<section class="bloque quiz" id="quiz"><h3>${T('PREGUNTA DE CIERRE', 'CLOSING QUESTION')}</h3><p><b>${qz.q}</b></p><div class="quiz-op">${qop.map((o, i) => `<button type="button" data-qi="${i}"><kbd>${i + 1}</kbd> ${o.t}</button>`).join('')}</div><div id="quiz-res" aria-live="polite"></div></section>\n    `;
  const share = s.daily ? `CUSTODIA · ${T('Reto', 'Challenge')} ${Meta.today()} · ${s.L.name}: ${o.won ? T(`escapé en ${Meta.fmtTime(s.t)} `, `I escaped in ${Meta.fmtTime(s.t)} `) + '★'.repeat(o.stars) : T('no escapé 💀', 'I did not escape 💀')} · ${T('atrapado', 'caught')} ${s.stats.caught}×${s.dFlare ? ` · ☀️ ${s.dFlare.flare.cls}: ${s.dFlare.result === 'refugio' ? T('refugio', 'shelter') : s.dFlare.result === 'impacto' ? T('afuera', 'outside') : '—'}` : ''} · ${location.origin}${location.pathname}` : '';
  open(`<div class="fin ${o.won ? 'gana' : 'pierde'}">
    <div class="fin-cab"><span class="sello">${ic(o.won ? 'ok' : 'bad')}</span><div><p class="etq">${o.won ? T('¡VOLVISTE A CASA!', 'YOU MADE IT HOME!') : T('MISIÓN PERDIDA', 'MISSION LOST')}</p><h2>${R_.titulo}</h2></div></div>
    ${o.won ? `<div class="estrellas" aria-label="${o.stars} ${T('de 3 estrellas', 'of 3 stars')}">${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}</div>` : ''}
    <section class="bloque">${T(`<h3>QUÉ PASÓ</h3>`, `<h3>WHAT HAPPENED</h3>`)}<p>${o.text}</p></section>
    <section class="bloque aprende">${T(`<h3>QUÉ APRENDER</h3>`, `<h3>WHAT TO LEARN</h3>`)}<p>${R_.aprende}</p>${R_.pistas.length ? `<ul>${R_.pistas.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}</section>
    ${bitacoraHTML()}${quizHTML}${o.won ? `<section class="bloque">${T(`<h3>TUS ESTRELLAS</h3>`, `<h3>YOUR STARS</h3>`)}<ul class="crit">${R_.estrellas.map((e) => `<li class="${e.ok ? 'si' : 'no'}">${ic(e.ok ? 'estrella' : 'bad')} ${e.txt}${e.ok ? '' : T(' (pendiente)', ' (pending)')}</li>`).join('')}</ul></section>` : ''}
    <div class="datos">${R_.datos.map((d) => `<span>${ic(d.ic)} ${d.txt}</span>`).join('')}${s.sys ? `<span>${ic('rad')} ${T(`Radiación ${Math.round(Sys.dosePct(s))} % del límite`, `Radiation ${Math.round(Sys.dosePct(s))} % of the limit`)}</span><span>${ic('alerta')} ${T(`Emergencias salvadas ${s.sys.st.saved}`, `Emergencies saved ${s.sys.st.saved}`)}</span>` : ''}</div>
    <p class="consejo">💡 ${T('¿Sabías que…?', 'Did you know…?')} ${consejo(consejoN++)}</p>
    <div class="premio">${T(`+${r.pts} PUNTOS (total ${r.total})${r.streak > 1 ? ` · RACHA ${r.streak}` : ''}${r.newNotes ? ` · ${r.newNotes} nota(s) nueva(s)` : ''}`, `+${r.pts} POINTS (total ${r.total})${r.streak > 1 ? ` · STREAK ${r.streak}` : ''}${r.newNotes ? ` · ${r.newNotes} new note(s)` : ''}`)}</div>
    ${r.medals.map((id) => `<div class="medalla si nueva"><b>${ic('medalla')} ${Meta.MEDALS[id][0]}</b><small>${Meta.MEDALS[id][1]}</small></div>`).join('')}
    ${dr ? `<p>${dr.isNew ? T('¡NUEVO RÉCORD DEL DÍA!', 'NEW RECORD OF THE DAY!') : dr.best ? T(`Tu récord de hoy: ${Meta.fmtTime(dr.best)}`, `Your record today: ${Meta.fmtTime(dr.best)}`) : ''}</p>` : ''}
    ${!o.won ? `<p style="color:var(--dim)">${T(`Siguiente desbloqueo: ${nextUnlock(r.total)}`, `Next unlock: ${nextUnlock(r.total)}`)}</p>` : ''}
    <div class="fila">${getOpt('clase', '') && getOpt('nombre', '') ? `<button id="copia-clase" class="sec">📋 ${T('COPIAR PARA MI DOCENTE', 'COPY FOR MY TEACHER')}</button>` : ''}${o.won && s.sys ? `<button id="certif" class="sec">🎓 ${T('CERTIFICADO', 'CERTIFICATE')}</button>` : ''}${s.daily ? `<button id="compartir" class="sec">${ic('archivo')} ${T('COMPARTIR RESULTADO', 'SHARE RESULT')}</button>` : `<button id="otra" class="grande">${ic('reintentar')} ${o.won ? T('JUGAR OTRA VEZ', 'PLAY AGAIN') : T('REINTENTAR', 'TRY AGAIN')} <kbd>R</kbd></button>`}<button id="menu" class="sec">${ic('menu')} ${T('MENÚ', 'MENU')}</button></div></div>`);
  if (s.daily) $('compartir').onclick = () => { navigator.clipboard?.writeText(share).then(() => ($('compartir').textContent = '✓ COPIADO'), () => prompt('Copia tu resultado:', share)); };
  else $('otra').onclick = () => { s = G.newGame(s.loc, undefined, s.dif, { variar: true, flares: liveFlares, mode: s.mode, perk: s.perk, reflex: !!s.sys?.reflex, seen: Meta.seenNotes(s.loc) }); base = null; close(); intro(); };
  $('menu').onclick = titleScreen;
  if ($('certif')) $('certif').onclick = () => certificado(o, R_);
  if ($('copia-clase')) $('copia-clase').onclick = () => { const l = lineaClase(o); navigator.clipboard?.writeText(l).then(() => { $('copia-clase').textContent = T('✓ COPIADO', '✓ COPIED'); M.ui('ok'); }, () => prompt(T('Copia esta línea y mándasela a tu docente:', 'Copy this line and send it to your teacher:'), l)); };
  let respondida = false;
  const responde = (i) => {
    if (respondida || !qop[i]) return; respondida = true; const acerto = qop[i].ok; ultimoQuiz = { id: qz.id, ok: acerto }; const hist = Meta.quizAnota(qz.id, acerto); M.ui(acerto ? 'ok' : 'error');
    $('ventana').querySelectorAll('.quiz-op button').forEach((b, k) => { b.disabled = true; b.classList.toggle('ok', qop[k].ok); b.classList.toggle('mal', k === i && !acerto); });
    const rs = Quiz.resumen(hist); const copia = Quiz.textoResultado(qz.id, acerto, hist);
    $('quiz-res').innerHTML = `<p class="quiz-v ${acerto ? 'si' : 'no'}"><b>${acerto ? T('✔ ¡Correcto!', '✔ Correct!') : T('✘ Casi. Ahora ya lo sabes:', '✘ Not quite. Now you know:')}</b> ${qz.expl}</p><p><small>${T('Fuente', 'Source')}: ${qz.fuente}</small></p><p><small>${T(`Llevas ${rs.aciertos} de ${rs.intentos} respuestas correctas · preguntas dominadas ${rs.dominadas}/${rs.total}`, `You have ${rs.aciertos} of ${rs.intentos} answers right · questions mastered ${rs.dominadas}/${rs.total}`)}</small> <button type="button" id="quiz-copia" class="mini">${T('COPIAR MI RESULTADO', 'COPY MY RESULT')}</button></p>`;
    $('quiz-copia').onclick = () => { navigator.clipboard?.writeText(copia); $('quiz-copia').textContent = T('✓ COPIADO', '✓ COPIED'); };
  };
  $('ventana').querySelectorAll('.quiz-op button').forEach((b) => (b.onclick = () => responde(+b.dataset.qi)));
  finQuiz = responde;
}

// ---------- controles ----------
function act(k) {
  if (crew) return actCrew(k);
  if (!s || s.over) return;
  if (menu === 'fabricar' && k === 'c') return close();
  if (menu === 'mochila' && k === 'i') return close();
  if (k === 'm') { M.toggle(); if (M.on()) M.ui('ok'); sincBotones(); pintaInterruptor('sw-musica', M.on()); return; }
  if (k === 'v') return toggleFull();
  if (menu) return;
  if ('1234'.includes(k) && k.length === 1) return togglePanel(['mant', 'plan', 'amen', 'reg'][+k - 1]);
  if (k === 'e') {
    const n0 = s.p.inv.length; G.interact(s); M.sfx(s.p.inv.length > n0 ? 'recoger' : 'interactuar');
    const pd = s.pending?.kind;
    if (pd === 'escondite') stashMenu(); else if (pd === 'protocolo') protocolGame(s.pending.id); else if (pd === 'codigo') codeGame(); else if (pd === 'cables') cablesGame();
  } else if (k === 'q') G.useQ(s);
  else if (k === 'c') craftMenu();
  else if (k === 'f') G.toggleHide(s);
  else if (k === 't') { const n0 = s.p.inv.length; G.throwItem(s); if (s.p.inv.length < n0) M.sfx('lanzar'); }
  else if (k === 'g') { const n0 = s.p.inv.length; G.dropItem(s); if (s.p.inv.length < n0) M.sfx('soltar'); }
  else if (k === 'b') G.betray(s);
  else if (k === 'i') bagMenu();
  else if (k === 'p' || k === 'escape') pausa();
}
/** Pausa (Esc): seguir, ajustes con etiquetas claras (música, volumen, efectos de sonido, efectos suaves, nombres) y el historial. */
function pausa() {
  if (crew) return crewPausa();
  open(`<h2>${ic('pausa', 'g')} ${T('PAUSA', 'PAUSE')}</h2>
    <div class="pausa-cab"><button id="seguir" class="grande">${ic('jugar')} ${T('SEGUIR', 'RESUME')} <kbd>Esc</kbd></button><button id="ay" class="sec">${ic('ayuda')} ${T('AYUDA', 'HELP')}</button><button id="salir" class="sec">${ic('menu')} ${T('SALIR AL MENÚ (se guarda)', 'EXIT TO MENU (saved)')}</button></div>
    <h3>${T('AJUSTES', 'SETTINGS')}</h3>
    <div class="ajustes">${ajustesHTML(conVoz(['musica', 'sfx', 'suave', 'nombres']))}
      <div class="vol"><span class="lbl">${T('VOLUMEN', 'VOLUME')}</span><button id="vmenos" aria-label="${T('Bajar volumen', 'Lower volume')}">−</button><span id="vol">${Math.round(M.volume() * 100)} %</span><button id="vmas" aria-label="${T('Subir volumen', 'Raise volume')}">+</button></div>
      <p class="nota-aj">${T('Los efectos visuales suaves quitan sacudidas y destellos (útil si te mareas o te cansa la vista).', 'Soft visual effects remove shaking and flashes (useful if you feel dizzy or your eyes get tired).')}</p></div>
    <div class="pestanas"><button data-t="reg">${T('HISTORIAL', 'HISTORY')}</button><button data-t="mant">${T('MANTENIMIENTO', 'MAINTENANCE')}</button><button data-t="plan">${T('PLAN DE REGRESO', 'RETURN PLAN')}</button><button data-t="amen">${T('AMENAZAS', 'THREATS')}</button><button data-t="crew">${T('TRIPULACIÓN', 'CREW')}</button>${s.sys ? `<button data-t="bit">${T('BITÁCORA', 'MISSION LOG')}</button>` : ''}</div><ul id="pest" class="log pest"></ul>`);
  menu = 'pausa';
  const tab = (t) => { $('pest').innerHTML = { reg: () => logHTML(50), mant: mantHTML, plan: planHTML, amen: amenazasHTML, crew: crewFichas, bit: () => `<li class="bit">${bitacoraHTML()}</li>` }[t](); $('pest').className = (t === 'reg' ? 'log' : 'plan') + ' pest'; $('ventana').querySelectorAll('.pestanas button').forEach((x) => x.classList.toggle('sel', x.dataset.t === t)); };
  $('ventana').querySelectorAll('.pestanas button').forEach((x) => (x.onclick = () => tab(x.dataset.t))); tab('reg');
  cableaAjustes(conVoz(['musica', 'sfx', 'suave', 'nombres']));
  $('vmenos').onclick = () => { $('vol').textContent = Math.round(M.volume(-0.25) * 100) + ' %'; }; $('vmas').onclick = () => { $('vol').textContent = Math.round(M.volume(0.25) * 100) + ' %'; };
  $('seguir').onclick = close; $('ay').onclick = () => help(pausa); $('salir').onclick = () => { save(); titleScreen(); };
}
let avisoAgachar = false; // la explicación de agacharse sale una vez por sesión
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === 'shift' && s && !menu && !avisoAgachar) { avisoAgachar = true; G.flash(s, T('Agachado (Shift): haces menos ruido y te ven menos, pero caminas más lento. Suelta Shift para pararte.', 'Crouching (Shift): you make less noise and are seen less, but you walk slower. Release Shift to stand up.'), 'info'); }
  if (k === 'escape' && menu && !['titulo', 'fin', 'protocolo', 'intro', 'codigo', 'cables', 'respira', 'finales'].includes(menu)) { if (menu === 'escondite') s.pending = null; close(); return; }
  if (k === 'n' && s && !menu) { alternaNombres(); return; }
  if (k === 'tab') { e.preventDefault(); if (s && !menu) alternaMapa(); return; }
  if (k === 'escape' && mapaOn) { alternaMapa(false); return; }
  if (menu === 'fin' && /^[1-3]$/.test(k) && !e.target.closest?.('input, textarea')) { finQuiz?.(+k - 1); return; } // 1–3 responden la pregunta de cierre
  if (menu === 'fin' && !e.target.closest?.('input, textarea') && (k === 'r' || (k === 'enter' && !e.target.closest?.('button, summary')))) { ($('otra') ?? $('menu'))?.click(); return; } // reintento inmediato con una tecla
  if (menu === 'datos' && /^[1-6]$/.test(k) && !e.target.closest?.('input, textarea')) { datosIr?.(+k - 1); return; } // atajos 1–6 en la terminal de DATOS NASA
  if (k === 'enter' && menu === 'titulo' && !e.target.closest?.('button, summary, input, textarea')) { $('t-jugar')?.click(); return; } // Enter = JUGAR en el título
  if (['e', 'q', 'c', 'p', 'f', 't', 'g', 'b', 'i', 'm', 'v', '1', '2', '3', '4', 'escape'].includes(k)) act(k);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
$('btn-nombres').onclick = () => { if (s && !menu) alternaNombres(); }; $('btn-fabricar').onclick = () => act('c'); $('btn-full').onclick = toggleFull; document.querySelectorAll('#teclas [data-panel]').forEach((b) => { b.onclick = () => { if (s && !menu) togglePanel(b.dataset.panel); }; }); $('btn-mochila').onclick = () => act('i'); $('btn-menu').onclick = () => { if (!menu) act('p'); else if (menu === 'pausa') close(); }; $('btn-musica').onclick = () => { M.toggle(); sincBotones(); }; $('btn-usar').onclick = () => act('q'); $('btn-ayuda').onclick = () => { if (!menu) help(null); };
// Celular y tablet: se juega SIEMPRE en HORIZONTAL (no hay diseño vertical). Al primer toque pide pantalla completa y fija la orientación (Android/Chrome lo permite;
// en iPhone/iPad no, y ahí queda el aviso «Gira el dispositivo» del CSS). Si lo pones en vertical a mitad de partida, el juego se pausa.
const tacto = matchMedia('(pointer: coarse)'); const vertical = matchMedia('(orientation: portrait)');
/** Teléfono = pantalla táctil cuyo lado corto mide menos de 600 px. Tablets y PC quedan fuera (no se fuerza horizontal ni hay rueda). */
// Algunos Android (y el «modo escritorio») informan screen en píxeles físicos: por eso también cuenta la ventana visible
// (un teléfono acostado mide < 520 px de alto; una tablet, bastante más).
const esTelefono = () => tacto.matches && (Math.min(screen.width, screen.height) < 600 || Math.min(innerWidth, innerHeight) < 520);
function aHorizontal() {
  if (!tacto.matches) return; // pantalla táctil (teléfono o tablet); la compu con mouse no se fuerza
  if (screen.orientation?.type?.startsWith('landscape') && document.fullscreenElement) return;
  const fija = () => screen.orientation?.lock?.('landscape').catch(() => {});
  if (document.fullscreenElement) fija(); else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(fija).catch(fija);
}
addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') aHorizontal(); }, { capture: true });
vertical.addEventListener?.('change', () => { if (tacto.matches && vertical.matches && s && !menu && !crew) pausa(); });
/**
 * Rueda de acciones (pantalla táctil): para que la pantalla no se llene de botones, quedan solo USAR y ☰ ATAJOS.
 * USAR: un toque = usar (E); mantenerlo RUEDA_MS = se abre la rueda con esconder, lanzar, inhibir, agachar, mochila y mapa.
 * ☰ ATAJOS: un toque abre la rueda de fabricar, paneles 1-4, nombres y mochila.
 * En la rueda: desliza el dedo hasta una opción y suéltalo, o suelta y luego toca la opción. Tocar fuera la cierra.
 * Cada opción reusa el botón original (oculto), así el texto (ESCONDER/DISTRAER) y el estado (agachado) siguen iguales.
 */
const RUEDA_MS = 2000;
/** ¿Los controles van con rueda? Siempre en el teléfono; en tablet, si se eligió CONTROLES COMO EN EL CELULAR en los ajustes. */
const conRuedaOn = () => document.body.classList.contains('rueda-on');
const rueda = document.createElement('div'); rueda.id = 'rueda'; rueda.hidden = true; document.body.appendChild(rueda);
let ruedaSel = null;
const RUEDA_ACC = ['t-f', 't-t', 't-q', 't-sh', 't-i', 't-m'];
const RUEDA_ATAJOS = [['btn-fabricar', '🔧'], ['[data-panel="mant"]', '1'], ['[data-panel="plan"]', '2'], ['[data-panel="amen"]', '3'], ['[data-panel="reg"]', '4'], ['btn-nombres', 'N'], ['btn-mochila', 'I']];
function cierraRueda() { rueda.hidden = true; rueda.innerHTML = ''; ruedaSel = null; }
function abreRueda(cx0, cy0, ops) {
  const R0 = Math.min(104, Math.max(78, Math.min(innerWidth, innerHeight) * 0.26)); const m = R0 + 40;
  const x = Math.min(innerWidth - m, Math.max(m, cx0)), y = Math.min(innerHeight - m, Math.max(m, cy0));
  rueda.innerHTML = `<div class="r-centro" style="left:${x}px;top:${y}px">✕</div>` + ops.map((o, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ops.length;
    return `<button class="r-op${o.sel ? ' sel' : ''}" data-i="${i}" style="left:${x + Math.cos(a) * R0}px;top:${y + Math.sin(a) * R0}px">${o.html}</button>`;
  }).join('');
  // Solo cuenta un toque que EMPIEZA y TERMINA en la rueda (nada de clic): así el «clic fantasma» que el teléfono manda al soltar
  // después de mantener apretado no elige ni cierra nada por error.
  let baja = null;
  rueda.onpointerdown = (e) => { baja = e.target.closest('.r-op') ?? 'fondo'; };
  rueda.onpointerup = (e) => {
    const el = e.target.closest('.r-op') ?? 'fondo'; if (baja !== el) { baja = null; return; } baja = null;
    if (el === 'fondo') cierraRueda(); else { const o = ops[+el.dataset.i]; cierraRueda(); o.run(); }
  };
  rueda.onclick = (e) => e.stopPropagation();
  rueda.hidden = false; rueda._ops = ops; M.ui('abrir');
}
function ruedaMarca(e) { // con el dedo aún apoyado: resalta la opción que está debajo
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.r-op');
  rueda.querySelectorAll('.r-op').forEach((b) => b.classList.toggle('apunta', b === el)); ruedaSel = el ? +el.dataset.i : null;
}
const opDe = (id) => { const b = $(id); return { html: b.innerHTML, sel: b.classList.contains('sel'), run: () => b.click() }; };
// Teléfono sin ☰: FABRICAR entra a la rueda de USAR (los paneles 1-4 y Nombres están en la pausa)
const opFabricar = () => ({ html: `<b>🔧</b><small>${T('FABRICAR', 'CRAFT')}</small>`, sel: false, run: () => $('btn-fabricar').click() });
const opsAcciones = () => { const o = RUEDA_ACC.map(opDe); if (conRuedaOn()) o.splice(o.length - 1, 0, opFabricar()); return o; };
const opsAtajos = () => RUEDA_ATAJOS.map(([q, k]) => { const b = q.startsWith('[') ? document.querySelector(`#teclas ${q}`) : $(q); const nom = [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); return { html: `<b>${k}</b><small>${nom}</small>`, sel: b.classList.contains('sel'), run: () => b.click() }; });
/** Botón con toque corto + mantener: corto() al soltar rápido; largo() abre la rueda tras RUEDA_MS (con anillo de carga). */
function conRueda(btn, corto, ops, ms) {
  let tim = 0, abierta = false, id = null;
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // mantener apretado no abre el menú del navegador
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (!s || menu) return; id = e.pointerId; abierta = false; try { btn.setPointerCapture(e.pointerId); } catch { /* nada */ }
    if (!ms || !conRuedaOn()) return; // sin rueda (PC, tablet por defecto) USAR es un botón normal
    btn.style.setProperty('--carga', `${ms}ms`); btn.classList.add('cargando');
    tim = setTimeout(() => { btn.classList.remove('cargando'); abierta = true; const r = btn.getBoundingClientRect(); abreRueda(r.left + r.width / 2, r.top + r.height / 2, ops()); navigator.vibrate?.(20); }, ms);
  });
  btn.addEventListener('pointermove', (e) => { if (e.pointerId === id && abierta) ruedaMarca(e); });
  const fin = (e, cancel) => {
    if (e.pointerId !== id) return; id = null; clearTimeout(tim); btn.classList.remove('cargando');
    if (abierta) { if (ruedaSel !== null) { const o = rueda._ops[ruedaSel]; cierraRueda(); o.run(); } return; } // soltó sobre una opción; si no, la rueda queda abierta para tocar
    if (cancel || !s || menu) return;
    if (ms || !conRuedaOn()) corto?.(); else { const r = btn.getBoundingClientRect(); abreRueda(r.left + r.width / 2, r.top + r.height / 2, ops()); }
  };
  btn.addEventListener('pointerup', (e) => fin(e, false)); btn.addEventListener('pointercancel', (e) => fin(e, true));
  btn.addEventListener('click', (e) => { if (e.detail === 0 && s && !menu) corto(); }); // teclado / lector de pantalla: Enter = toque corto
}
conRueda($('t-e'), () => act('e'), opsAcciones, RUEDA_MS);
conRueda($('t-menu'), null, opsAtajos, 0);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !rueda.hidden) cierraRueda(); });
// controles táctiles: en pantallas táctiles o angostas (teléfono); body.tactil-on deja sitio a los atajos
const esTactil = () => matchMedia('(pointer: coarse)').matches || UI.esAngosta(innerWidth);
function sincTactil() { const on = esTactil(); $('tactil').hidden = !on; document.body.classList.toggle('tactil-on', on); document.body.classList.toggle('telefono', esTelefono()); document.body.classList.toggle('tablet', tacto.matches && !esTelefono()); document.body.classList.toggle('rueda-on', on && (esTelefono() || vista.rueda)); document.body.classList.toggle('cruz-on', on && vista.cruz); }
sincTactil(); addEventListener('resize', sincTactil); sincBotones();
const dirs = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
/**
 * Joystick FIJO y visible (pantallas táctiles): base abajo a la izquierda, siempre a la vista durante la partida.
 * Restricción: la perilla nunca sale del círculo (se queda en el borde aunque el dedo se vaya más lejos) y la base no se mueve.
 * Se toma tocando en cualquier parte de la mitad izquierda de la pantalla; la dirección es siempre desde el centro de la base.
 * Con la «cruz de flechas» activada no se usa. Los botones (USAR, ☰…) no lo activan.
 */
const joy = { id: null }; const JOY_R = 52, JOY_MUERTO = 10;
const joyEl = document.createElement('div'); joyEl.id = 'joy'; joyEl.innerHTML = '<i></i>'; document.body.appendChild(joyEl);
/** Centro de la base en pantalla (lo pone el CSS: abajo a la izquierda). */
const joyCentro = () => { const r = joyEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
function joyMueve(e) {
  const c = joyCentro(); let dx = e.clientX - c.x, dy = e.clientY - c.y; const len = Math.hypot(dx, dy); const R = joyEl.offsetWidth ? joyEl.offsetWidth * (JOY_R / 124) : JOY_R; // en tablet la base es más grande y el recorrido crece con ella
  if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; } // restricción: la perilla se queda dentro del círculo
  const l = Math.hypot(dx, dy);
  if (l < JOY_MUERTO) { touch.dx = 0; touch.dy = 0; } else { touch.dx = dx / l; touch.dy = dy / l; }
  joyEl.firstChild.style.transform = `translate(${dx}px, ${dy}px)`; joyEl.classList.add('activo');
}
function joySuelta(e) { if (e.pointerId !== joy.id) return; joy.id = null; touch.dx = 0; touch.dy = 0; joyEl.firstChild.style.transform = ''; joyEl.classList.remove('activo'); }
{
  const pant = document.querySelector('.pantalla');
  pant.addEventListener('pointerdown', (e) => {
    if (s && !menu && !e.target.closest('button, input, textarea, a')) {
      if (mapaOn) { alternaMapa(false); return; }
      const g = miniG(UI.geomMinimapa(cv.width, ZOOM, s.L.W, s.L.H, cv.height)); const r = cv.getBoundingClientRect(); const mx = (e.clientX - r.left) * (cv.width / r.width), my = (e.clientY - r.top) * (cv.height / r.height);
      if (mx >= cv.width - g.w - g.borde - 6 && my >= g.oy - 6 && my <= g.oy + g.h + 6) { alternaMapa(true); return; }
    }
    if (e.pointerType === 'mouse' || joy.id !== null || menu || !s || vista.cruz || e.target.closest('button, input, textarea, a')) return;
    if (e.clientX > innerWidth * 0.5) return; // solo la mitad izquierda maneja el joystick
    joy.id = e.pointerId; try { pant.setPointerCapture(e.pointerId); } catch { /* sin captura */ } joyMueve(e);
  });
  pant.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMueve(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pant.addEventListener(ev, joySuelta);
}
/** Los botones de acción dicen QUÉ hacen (no solo la letra del teclado). */
const TACTIL_TXT = { 't-e': ['E', 'USAR', 'USE'], 't-f': ['F', 'ESCONDER', 'HIDE'], 't-t': ['T', 'LANZAR', 'THROW'], 't-sh': ['⇩', 'AGACHAR', 'CROUCH'], 't-q': ['Q', 'INHIBIR', 'JAM'], 't-i': ['I', 'MOCHILA', 'BAG'], 't-m': ['🗺', 'MAPA', 'MAP'], 't-menu': ['☰', 'ATAJOS', 'SHORTCUTS'] };
function textosTactil() { for (const [id, base] of Object.entries(TACTIL_TXT)) { const [k, es, en] = crew && id === 't-f' ? ['F', 'DISTRAER', 'DISTRACT'] : base; const b = $(id); if (b) b.innerHTML = `<b>${k}</b><small>${T(es, en)}</small>`; } }
textosTactil();
document.querySelectorAll('.cruz button').forEach((b) => {
  const on = (e) => { e.preventDefault(); [touch.dx, touch.dy] = dirs[b.dataset.d]; };
  const off = (e) => { e.preventDefault(); touch.dx = 0; touch.dy = 0; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
$('t-f').onclick = () => act('f'); $('t-t').onclick = () => act('t'); $('t-i').onclick = () => act('i'); $('t-sh').onclick = () => { touch.crouch = !touch.crouch; $('t-sh').classList.toggle('sel', touch.crouch); if (s && !menu) G.flash(s, touch.crouch ? T('Agachado: haces menos ruido y te ven menos, pero caminas más lento. Vuelve a tocar para pararte.', 'Crouching: you make less noise and are seen less, but you walk slower. Tap again to stand up.') : T('Te pusiste de pie.', 'You stood up.'), 'info'); }; $('t-q').onclick = () => act('q'); $('t-m').onclick = () => { if (s && !menu) alternaMapa(); }; $('btn-mapa').onclick = () => { if (s && !menu) alternaMapa(); };

function input() {
  let dx = touch.dx, dy = touch.dy;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1; if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1; if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  return { dx, dy, crouch: keys.has('shift') || !!touch.crouch };
}

// ---------- ganchos de audio (solo LEEN el estado; las reglas viven en sonido.js y el sonido en music.js) ----------
const musicLevel = () => Snd.nivelMusica({ over: !!s.over, final: !!s.final, threat: s.threat, danger: danger(), alert: s.alert, emerg: G.emergency(s), mission: !!s.vil?.mission, hidden: !!s.p.hidden });
function audioFrame(t, dt, inp, ev) {
  const p = s.p, suave = FX.suave(), th = s.threat ?? null;
  if (aud.s !== s) { aud.s = s; aud.pend = -1; aud.amb = ''; }
  const claves = []; while (s.sfx?.length) { const k = s.sfx.shift(); claves.push(k); M.sting(k, { suave }); } // alertas del núcleo (visto, sospecha, perdido, aviso…)
  if (ev.hit && !claves.includes('boom') && !claves.includes('atrapado')) M.sfx('golpe', { suave }); // golpe suave (si ya sonó boom/atrapado no se repite)
  if (ev.saved) M.sfx('salvado'); else if (ev.solved) M.sfx('resuelto');
  if (s.sys) { const n = Sys.pending(s).length; if (aud.pend >= 0 && n < aud.pend && !ev.saved) M.sfx('mant'); aud.pend = n; } else aud.pend = -1; // revisión de mantenimiento terminada
  M.set(s.loc, musicLevel(), G.isNight(s), th?.sus ?? 0);
  if (!menu && !p.sleep) M.heartbeat(Snd.tasaLatido({ threat: th, final: !!s.final }));
  if (menu !== 'titulo') { // ambiente: solo se reajusta cuando cambia destino, zona, noche o tormenta
    const storm = G.storm(s) ? 2 : s.hazards.some((h) => h.def.type === 'front' && h.def.dark) ? 1 : 0;
    const zona = Snd.zonaJugador({ outside: G.isOutside(s), inDuct: p.inDuct, shelter: !!G.roomAt(s, p.x, p.y)?.shelter }), noche = G.isNight(s);
    const key = `${s.loc}|${zona}|${noche}|${storm}`;
    if (key !== aud.amb) { aud.amb = key; M.ambiente(Snd.mezclaAmbiente({ loc: s.loc, zona, noche, tormenta: storm })); }
  }
  if (s.msg && s.msg !== lastMsg) { lastMsg = s.msg; if (t - aud.msgT > 150) { aud.msgT = t; M.ui(s.msg.kind === 'bad' ? 'error' : s.msg.kind === 'ok' ? 'ok' : 'info'); } }
  if (!menu && (inp.dx || inp.dy) && (stepT -= dt) <= 0) { stepT = 0.3; M.paso(Snd.superficiePaso({ loc: s.loc, outside: G.isOutside(s), inDuct: p.inDuct, crouch: inp.crouch, sleep: p.sleep })); }
  if (!menu && s.sys?.emerg && Math.floor(t / 400) !== Math.floor((t - dt * 1000) / 400)) M.sfx('emerg', { u: s.sys.emerg.t < 5 });
  if (!menu && (s.final || s.hazards.some((h) => h.def.type === 'front' && h.phase === 'aviso')) && Math.floor(t / 500) !== Math.floor((t - dt * 1000) / 500)) M.sfx('tic');
}
// ---------- bucle ----------
let lastMsg = null; let stepT = 0; let scareT = 0; let chaseT = 0;
function frame(t) {
  Cu.reloj.t = t;
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (s) {
    const inp = input();
    if (crew) crewFrame(dt, inp, t); else if (!menu && !FX.frozen(t)) G.update(s, dt, inp); // hitstop: unos cuadros congelados (60-90 ms) al golpe/captura/emergencia salvada; solo se salta el avance, core.js no se entera
    const ev = FX.watch(s, t);
    { const p = s.p; // chispas y ondas en el sitio del impacto o del éxito
      if (ev.caught) { A.burst(p.x, p.y, '255,150,80', 14); A.ring(p.x, p.y, '255,130,80', 30); }
      else if (ev.hit) { A.burst(p.x, p.y, '255,175,95', 8); A.ring(p.x, p.y, '255,150,70', 22); }
      if (ev.saved) { A.burst(p.x, p.y, '90,255,170', 18); A.burst(p.x, p.y, '95,246,255', 8); A.ring(p.x, p.y, '90,255,170', 38); }
      else if (ev.solved) { A.burst(p.x, p.y, '120,255,160', 10); A.ring(p.x, p.y, '90,255,170', 26); } }
    tutoFrame(dt); academiaFrame(dt);
    if (coop) coop.session.tick(s, dt, !!menu);
    if (!menu && s.pending?.kind === 'respira') breathGame();
    try { audioFrame(t, dt, inp, ev); } catch { /* el sonido nunca debe romper el juego */ }
    conVista(() => draw(t));
    hudT -= dt; if (hudT <= 0) { conVista(hud); hudT = 0.12; }
    saveT -= dt; if (saveT <= 0) { save(); saveT = 10; }
    if (crew) { if (s.over && !crew.fin) { crew.fin = true; crewFin(); } } else if (s.over && !s.over.shown) { s.over.shown = true; hud(); M.sfx(s.over.won ? 'fin_bien' : 'fin_mal'); endScreen(); }
  }
  requestAnimationFrame(frame);
}
addEventListener('beforeunload', save);
let consejoN = Math.floor(Math.random() * 11);
// ---------- sin internet (aplicación instalable) ----------
// sw.js guarda el juego después de la primera visita; aquí se registra, se avisa «listo sin internet» y se ofrece INSTALAR.
// En localhost y en las pruebas no se registra (para no ver archivos viejos mientras se programa); `?sw` lo fuerza.
let offlineListo = false; let instalarEv = null;
function pintaOffline() {
  const el = document.getElementById('t-offline'); if (!el) return;
  el.hidden = !(offlineListo || instalarEv);
  el.innerHTML = (offlineListo ? T('✔ Listo para jugar sin internet', '✔ Ready to play offline') : '') + (instalarEv ? ` <button type="button" id="t-instalar" class="mini">📲 ${T('INSTALAR', 'INSTALL')}</button>` : '');
  const b = document.getElementById('t-instalar'); if (b) b.onclick = () => { instalarEv?.prompt?.(); instalarEv = null; pintaOffline(); };
}
function registraOffline() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  if ((local || navigator.webdriver) && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { offlineListo = true; pintaOffline(); }).catch(() => { /* sin service worker: el juego funciona igual, con internet */ });
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalarEv = e; pintaOffline(); });
addEventListener('appinstalled', () => { instalarEv = null; pintaOffline(); });
// ---------- leer en voz alta (voz del navegador, ver voz.js) ----------
// Botón 🔊 LEER en cada ventana; el ajuste «LEER EN VOZ ALTA» lee solo la intro, la tormenta y el final, y los avisos importantes.
const vozAuto = () => { try { return localStorage.getItem('lfr.voz') === '1'; } catch { return false; } };
const alternaVoz = () => { const v = !vozAuto(); try { localStorage.setItem('lfr.voz', v ? '1' : '0'); } catch { /* nada */ } if (!v) Voz.parar(); return v; };
const conVoz = (lista) => { const l = esTactil() ? [...lista, 'cruz', ...(esTelefono() ? [] : ['rueda'])] : lista; /* la rueda es opcional solo en tablet (en el teléfono ya viene) */ return Voz.disponible() ? [...l, 'voz'] : l; };
const MENUS_SIN_VOZ = ['titulo', 'protocolo', 'codigo', 'cables', 'respira']; // el título son botones y el resto son minijuegos: no se leen
/** Texto de la ventana abierta, sin botones ni cosas ocultas (por ejemplo, las secciones cerradas de DATOS NASA). */
function textoVentana() {
  const c = $('ventana').cloneNode(true);
  c.querySelectorAll('button, kbd, svg, input, textarea, script, style, [hidden], .btn-leer, .term-cmds, .term-in').forEach((x) => x.remove());
  return Voz.limpiaTexto(c.innerHTML);
}
function ponBotonLeer() {
  Voz.parar();
  if (!Voz.disponible() || MENUS_SIN_VOZ.includes(menu)) return;
  const v = $('ventana'); const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-leer'; b.setAttribute('aria-label', T('Leer en voz alta', 'Read aloud'));
  const pinta = (habla) => { b.innerHTML = habla ? `⏹ ${T('PARAR', 'STOP')}` : `🔊 ${T('LEER', 'READ')}`; b.setAttribute('aria-pressed', String(habla)); }; pinta(false);
  b.onclick = () => { if (Voz.estaHablando()) Voz.parar(); else Voz.hablar(textoVentana()); };
  Voz.alCambiar(pinta); v.prepend(b);
  if (vozAuto() && ['intro', 'tormenta', 'fin'].includes(menu)) setTimeout(() => { if (!$('modal').hidden && v.contains(b)) Voz.hablar(textoVentana()); }, 350);
}
/**
 * Arranque dramático «CUSTODIA OS» (una vez por sesión; ?boot lo fuerza, ?noboot o ?jurado lo quitan; nunca en pruebas automáticas).
 * Pantalla negra → una tecla enciende (y desbloquea el audio) → texto que se escribe, una sacudida breve en «SEÑAL PERDIDA» y la IA que habla →
 * se disuelve en el título. Cualquier tecla o toque lo salta. En modo suave (o «reducir movimiento»): el texto aparece completo, sin sacudida.
 */
function arranque() {
  let visto = null; try { visto = sessionStorage.getItem('lfr.boot'); } catch { /* nada */ }
  if (!arranqueDebe({ search: location.search, visto: visto === '1', automatizado: !!navigator.webdriver })) return;
  try { sessionStorage.setItem('lfr.boot', '1'); } catch { /* nada */ }
  const lineas = arranqueLineas(); const suave = FX.suave();
  const el = document.createElement('div'); el.id = 'arranque'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="boot-marco">
    <header class="boot-cab"><span class="boot-marca">${ic('integ')} CUSTODIA OS</span><span class="boot-ojo" aria-hidden="true"><i></i></span><span class="boot-estado" id="boot-estado">STANDBY</span></header>
    <pre class="boot-txt" id="boot-txt"></pre>
    <div class="boot-barra" aria-hidden="true"><i id="boot-prog"></i></div>
    <p class="boot-pie" id="boot-pie"></p>
  </div>
  <div class="boot-sello" aria-hidden="true">${ic('integ')}<b>CUSTODIA</b><span>${T('MANTÉN VIVA LA BASE · VUELVE A CASA', 'KEEP THE BASE ALIVE · COME HOME')}</span></div>`;
  document.body.append(el); document.querySelector('.inicio')?.classList.remove('entra'); // el título entra animado cuando el arranque se disuelve
  const pre = el.querySelector('#boot-txt'); const pie = el.querySelector('#boot-pie'); const prog = el.querySelector('#boot-prog'); const estado = el.querySelector('#boot-estado');
  const pieTxt = (txt) => { pie.textContent = txt + ' '; const c = document.createElement('span'); c.className = 'cursor'; c.textContent = '█'; pie.append(c); };
  const fila = (l) => { const d = document.createElement('div'); d.className = 'bl ' + l.c; pre.append(d); return d; };
  const avance = (i) => { prog.style.width = `${Math.round(100 * Math.min(1, i / lineas.length))}%`; };
  let fase = 'espera'; let timer = 0; let clip = null;
  // voz grabada de la IA: suena solo si el sonido está encendido; si el archivo falta o el navegador no deja, el renglón sale escrito y nada más
  const callaVoz = () => { try { clip?.pause(); } catch { /* nada */ } clip = null; el.classList.remove('habla'); };
  const diceVoz = (l, sigue) => {
    const src = M.on() ? vozArranque(l.v, getLang()) : null; if (!src) return false;
    let hecho = false; const ya = () => { if (hecho) return; hecho = true; clearTimeout(tope); el.classList.remove('habla'); sigue(); };
    const tope = setTimeout(ya, 7000);
    try { clip = new Audio(src); clip.volume = 0.9; clip.onended = ya; clip.onerror = ya; el.classList.add('habla'); clip.play().catch(ya); } catch { ya(); }
    return true;
  };
  pieTxt('PULSA UNA TECLA PARA ENCENDER · PRESS ANY KEY TO POWER ON');
  const quita = () => { if (!suave) document.querySelector('.inicio')?.classList.add('entra'); removeEventListener('keydown', entrada, true); el.removeEventListener('pointerdown', entrada); el.classList.add('fuera'); setTimeout(() => el.remove(), suave ? 50 : 800); };
  const fin = () => { if (fase === 'fin') return; fase = 'fin'; clearTimeout(timer); callaVoz(); quita(); };
  // cierre: el texto se apaga y queda el sello «CUSTODIA» un momento antes de disolverse en el título
  const cierre = (espera) => { fase = 'cierre'; avance(lineas.length); estado.textContent = 'ONLINE'; timer = setTimeout(() => { if (fase !== 'cierre') return; if (suave) return fin(); el.classList.add('sello'); M.ui('ok'); timer = setTimeout(fin, 1500); }, espera); };
  const todo = () => { pre.textContent = ''; for (const l of lineas) fila(l).textContent = l.t; };
  const tipea = (i = 0, ch = 0) => {
    if (fase !== 'tipea') return;
    if (i >= lineas.length) return cierre(1100);
    const l = lineas[i]; const row = ch === 0 ? fila(l) : pre.lastChild;
    if (ch === 0) { avance(i); if (l.g) { el.classList.add('glitch'); setTimeout(() => el.classList.remove('glitch'), 420); M.ui('error'); estado.textContent = T('SIN SEÑAL', 'NO SIGNAL'); estado.classList.add('mal'); } }
    ch = Math.min(l.t.length, ch + 2); row.textContent = l.t.slice(0, ch);
    if (ch % 4 === 0 && l.t) M.tone(1500 + (ch % 7) * 60, 0.012, 'square', 0.008); // tecleo suave
    if (ch < l.t.length) { timer = setTimeout(() => tipea(i, ch), 24); return; }
    const sigue = () => { if (fase === 'tipea') timer = setTimeout(() => tipea(i + 1, 0), 90 + (l.p ?? 0)); };
    if (!diceVoz(l, sigue)) sigue();
  };
  function entrada(e) {
    e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
    if (e.type === 'keydown' && (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta')) return;
    if (fase === 'espera') {
      fase = 'tipea'; try { M.wake(); M.tone(55, 2.8, 'sine', 0.02); } catch { /* sin audio */ }
      el.classList.add('encendido'); estado.textContent = T('ARRANCANDO', 'BOOTING');
      pieTxt(T('toca o pulsa una tecla para saltar', 'tap or press a key to skip'));
      if (suave) { todo(); cierre(2600); } else timer = setTimeout(() => tipea(), 420);
    } else if (fase === 'tipea') { clearTimeout(timer); callaVoz(); todo(); cierre(700); } else fin();
  }
  addEventListener('keydown', entrada, true); el.addEventListener('pointerdown', entrada);
}
let tituloEntra = true; // la entrada escalonada del título se ve una vez (no en cada clic que lo vuelve a pintar)

document.fonts?.load('16px VT323').finally(() => {
  // Enlaces para el jurado: ?cadete fija el nivel Cadete; ?jurado entra directo a la Estación (Cadete) poco antes
  // de la primera tormenta solar real, para ver la mecánica central en menos de un minuto.
  const q = new URLSearchParams(location.search);
  if (q.has('cadete') || q.has('jurado')) setDif('cadete');
  titleScreen(); requestAnimationFrame(frame); arranque(); registraOffline();
  if (q.has('jurado')) {
    M.start(); s = G.newGame('estacion', undefined, 'cadete', { variar: true, flares: liveFlares, mode: 'campana' }); base = null; close();
    s.day = 2; s.min = 14 * 60 + 52; s.p.sleep = false; G.say(s, T('Modo jurado: día 2, 14:52. En unos segundos llega la primera tormenta solar real (NASA DONKI). ¿Refugio o sigues?', 'Judge mode: day 2, 14:52. In a few seconds the first real solar storm (NASA DONKI) arrives. Shelter or keep going?'), 'info');
    intro();
  }
  const sala = new URLSearchParams(location.search).get('sala'); // enlace directo del astronauta: ...?sala=ABCD → entra como Control de Misión
  if (sala && /^[A-Za-z0-9]{3,12}$/.test(sala)) coopUI.unirse(sala.toUpperCase(), new URLSearchParams(location.search).get('rol') === 'mcc' ? 'mcc' : 'crew');
});
window.lfr = { get crew() { return crew; }, get s() { return s; }, get base() { return base; }, G, Sys, A, fx: FX, perf, setFx: FX.setFx, cam, get zoom() { return ZOOM; } }; // para depurar y para los bots de prueba

// Ayuda en inglés (misma estructura que help()).
function helpEn(back) {
  menu = 'ayuda';
  const sec = (titulo, cuerpo, abierta = false) => `<details class="mas-info" ${abierta ? 'open' : ''}><summary>${titulo}</summary>${cuerpo}</details>`;
  open(`<h2>${ic('ayuda', 'g')} HOW TO PLAY</h2>
    <div class="basico esencial"><span>${ic('reloj')} Follow the schedule: the top says <b>where to go now</b></span><span>${ic('alerta')} Dodge the AI: <b>yellow cone</b> = it sees you, <b>red</b> = it chases you</span><span>${ic('salud')} Watch the bars: <b>«!»</b> means something is wrong</span><span>${ic('mochila')} Collect the 4 pieces of the PLAN to escape (key <kbd>2</kbd>)</span></div>
    ${sec('KEYS', `<p><kbd>WASD</kbd>/<kbd>arrows</kbd> move · <kbd>Shift</kbd> crouch (quiet) · <kbd>E</kbd> use / talk · <kbd>N</kbd> show/hide object and room names · <kbd>F</kbd> hide · <kbd>T</kbd> throw a part (noise) · <kbd>G</kbd> drop the last item (or DROP in the bag) · ${s && G.dif(s).noBetray ? '' : '<kbd>B</kbd> betray a crewmate · '}<kbd>I</kbd> bag · <kbd>C</kbd> craft · <kbd>Q</kbd> inhibitor · <kbd>M</kbd> music · <kbd>1</kbd> maintenance · <kbd>2</kbd> plan · <kbd>3</kbd> threats · <kbd>4</kbd> latest alerts (each key opens and closes its panel) · <kbd>V</kbd> full screen · <kbd>Esc</kbd> pause, settings (music, sound effects, soft effects, names) and the full history</p>`, true)}
    ${sec('THE BASE AND THE ROUTINE', `<p><b>Routine:</b> 06:00 roll call · 07:00 breakfast · 08:00 work · 12:00 lunch · 13:00 exercise · 15:00 free · 18:00 roll call · 19:00 dinner · 20:00 free · 22:00 lights out.</p>
      <p><b>Station systems:</b> life support, power, radiation and food drop by themselves every day. From 08:00 to 12:00 do the 4 <b>checks</b> (E on each colored panel: a mini-protocol of 3 steps in order): what you skip costs you level, integrity and alert. With low power everything else degrades faster. Radiation is measured as a % of the mission limit: if it reaches 100 %, you lose. With <b>⚡ REFLEXES</b> (on the title screen), when you finish a check an emergency may sound: run to the red dot and press E before the countdown ends or the mission is over.</p>
      <p><b>Outside</b> (Moon and Mars) you only survive with the suit: watch the oxygen.</p>`)}
    ${sec('STEALTH AND CREWMATES', `<p><b>Stealth:</b> if a drone or guard <b>touches</b> you while you carry something suspicious, you are caught. Walking makes noise: crouch. Hide in <b>lockers</b> or under the beds; if they saw you go in, they will come to check and you will have to <b>hold your breath</b>. Throw parts to distract them.</p>
      <p><b>Manipulate:</b> when a crewmate is happy (you already did them a favor), ask them to distract a drone or guard for 30 s. Bribe the Snitch, unmask the Double, keep Volkov busy.</p>
      <p><b>Surveillance:</b> the yellow cone is what it sees; red = it chases you. The <b>ducts</b> (grates) dodge them: you need a screwdriver.</p>
      <p><b>Villains:</b> each destination has 10. The AI is always there; the others are drawn every day (see "Today's threats"). <b>Radio missions</b> have a clock and give rewards.</p>
      <p><b>Emergencies:</b> the drones get distracted going to the problem. That is your moment.</p>`)}
    ${sec('ESCAPE AND PROGRESS', `<p><b>3 escape routes:</b> PLAN (4 pieces) · SABOTAGE (AI off + code + key) · MUTINY (the 3 crewmates with ♥♥ + code + fuel).${s && G.dif(s).noBetray ? '' : ' <b>Betraying</b> (B) lowers your alert and gives you a card, but that crewmate will hate you and report you.'}</p>
      <p><b>Notes:</b> in the drawers there are notes that tell what happened. Collect the 6 of a destination for the <b>true ending</b>.</p>
      <p><b>Between games:</b> you earn points (more if you win, streaks, medals and notes) to unlock characters and the Nightmare level. <b>One night</b> = a short 7-minute game. <b>Daily challenge</b> = the same game for everyone: compare your time.</p>`)}
    <div class="fila fila-fija"><button id="volver" class="grande">BACK</button></div>`);
  $('volver').onclick = () => (back ? back() : close());
}
