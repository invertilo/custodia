# CONTEXTO · Proyecto Hackaton 2.0 (para retomar en otra compu)

Último estado: **14/11/2026**, NASA Space Apps 2026 (Santa Cruz, Bolivia), equipo **#EraConTuto**.
Desafío: **Space Mission Design Game** (chicos de 7 a 12 años manejan una base en la Luna o Marte, equilibrando soporte vital, escudo contra la radiación, energía, comida y retraso de la comunicación, con datos reales de NASA).

## 0. Instrucciones para el Claude que retome

**Primero, ubícate (5 minutos):**
1. Lee este archivo entero, y después `CLAUDE.md` (reglas técnicas del juego).
2. Mira la **Bitácora** (sección 8) y el **Siguiente paso** (sección 5): ahí está exactamente dónde quedó el trabajo.
3. Corre `git log --oneline | head -15` y `git status`. Si hay cambios sin subir, pregunta antes de tocarlos.
4. Corre `npm test`. Todo debe pasar antes de empezar.

**Por cada cambio (regla del equipo, la pidió Sergio):**
1. Un cambio a la vez, chico y con propósito claro.
2. Si toca reglas: agrega o ajusta su prueba en `tests/` y corre `npm test`. Si toca el equilibrio: `node tools/sim.mjs <destino> 4 cadete 11` en los 3 destinos. Si toca la interfaz: abre el juego y míralo, y si se puede corre `npm run e2e`.
3. **Actualiza este archivo:** agrega una fila a la Bitácora (sección 8) y reescribe el Siguiente paso (sección 5) para que quien siga sepa qué hacer.
4. `git commit` con un mensaje claro (en español) y **`git push` inmediato**. No juntes varios cambios sin subir.
5. Recién después pasa al siguiente.

**No hagas:**
- Subir nada a otros repos (`NeckHurtttt/Custodia`, `NeckHurtttt/Lifeline`, el de Leo). Este repo es el único para este trabajo.
- Tocar `referencias/`: son copias para consultar.
- Presentar como "dato real de NASA" algo sin fuente verificada. Si es de juego, dilo.
- Romper la esencia del juego (IA misteriosa, drones, notas, finales). El objetivo es **mantener viva la base**; el escape es una ruta extra.
- Agregar dependencias: el juego es HTML + JS sin librerías.

**Cómo hablar con Sergio:** en español, corto y directo; él decide el rumbo. Pregúntale solo lo que de verdad es decisión suya.

## 1. Qué es este repositorio y por qué existe

- Es **Custodia** (antes "LIFELINE: Rutina"), adaptado al desafío. Se armó aparte para no mezclar con el repo del equipo ni con la copia de Leo, y para no perder la referencia.
- **Base:** la versión de Leo (repo `leoaguilerasc-design/Custodia-Leo`, carpeta `custodia-nuestro`, su rama `trabajo-claude`). Está intacta en la etiqueta git **`base-leo`** y copiada en `referencias/custodia-leo/`.
- **Decisión del equipo (opción B):** presentar Custodia en vez de LIFELINE porque es **más amigable y memorable**, corrigiéndolo para que cumpla el desafío **sin perder su esencia** (la IA misteriosa, los drones, la tensión, los finales).
- La otra opción, LIFELINE, está como referencia en `referencias/lifeline/`. Es más rigurosa pero menos divertida. La comparación completa está en `docs/analisis/comparativa-y-prueba.md`.

## 2. Qué se hizo (los 8 puntos obligatorios del plan, todos listos)

| # | Punto | Commit | Qué cambió |
| :--- | :--- | :--- | :--- |
| 1 | **Ganar cuidando la base** | `74019d1` | Al terminar el día 10 llega la **nave de rescate**: ganas si la tripulación vive y la base sigue en pie. Estrellas: llegar; sistemas cuidados (promedio ≥ 70 %); poca radiación (< 50 %) y base sana. La IA ahora **falla** (no es villana pura). El escape queda como **ruta extra** para volver antes. `rescue()` y `rescueStars()` en `src/core.js`. |
| 2 | **Modo Cadete (7-12)** | `c311d88` | Nivel nuevo y **por defecto** en `DIFS` (`src/common.js`). Si nadie resuelve un peligro en 45 s, un compañero lo controla contando su protocolo (`crewFix`). |
| 3+4 | **Clima espacial real y decisión de refugio** | `17456c2` | `src/clima.js`: llamaradas de **NASA DONKI** de los últimos 30 días (api.nasa.gov o el servidor CCMC sin llave); si falla, 3 llamaradas reales archivadas de 2024, y el juego lo dice. **3 tormentas por misión** (días 2, 5 y 8, a las 15:00). Aviso con cuenta atrás. **Refugio** = ~15 % de la dosis, pero se pierde lo que hacías y gasta ENERGÍA; **afuera** = la dosis completa. Tarjeta **"La restricción real"** con las dosis comparadas y el límite real de 600 mSv. Refugios: Estación = Dormitorios (blindaje como en la ISS), Luna = Refugio, Marte = Bodega (como el refugio de Orion). |
| 5 | **Armario de emergencia (Cadete)** | `d8143ac` | En Cadete, E junto a un peligro toma la herramienta y abre su **protocolo real** con fuente. En Normal hay que fabricarla, como antes. |
| 6 | **Pantalla simple (Cadete)** | `eab8460` | Se ocultan fuerza, saber e integridad; fuerza y saber vuelven si abres el PLAN. |
| 7 | **Datos NASA visibles + README** | `9f22a6d` | Botón **DATOS NASA** en el inicio; `src/datos.js`; README para el jurado (tabla de datos, cumplimiento del desafío, resumen en inglés, uso de IA). |
| 8 | **Enlaces para el jurado + revisión** | `f9422b0` | `?cadete` (fija Cadete) y `?jurado` (Estación en Cadete, día 2 a las 14:52, la tormenta real llega en segundos). `.nojekyll` para GitHub Pages. |

**Resultados medidos al cerrar:**
- `npm test`: **145/145** (las 127 de Leo + 18 nuevas).
- `tools/e2e.mjs`: **18/18**. `tools/e2e-coop.mjs`: **21/21**.
- Simulador en Cadete, jugador que cumple la rutina y se refugia: **15 de 15 rescates**. Dosis final: Estación ~35 %, Luna ~61 %, Marte ~53 %.
- Si ignora las tormentas (`STORMDEAF=1`): pierde estrellas, y en la Luna casi siempre supera el límite. Esa diferencia entre destinos es real.
- Fácil, Normal y Terror quedaron como estaban.

## 3. Cómo correrlo

```bash
python3 -m http.server 8000          # luego abrir http://127.0.0.1:8000/?cadete  (o ?jurado)
npm test                             # pruebas de la lógica (node --test tests/)
node tools/sim.mjs estacion 4 cadete 11            # simulador (destino, partidas, nivel, días)
STORMDEAF=1 node tools/sim.mjs luna 4 cadete 11    # el bot ignora las tormentas
DBG=1 node tools/sim.mjs marte 4 cadete 11         # desglose de qué daña
npm i --no-save playwright && npm run e2e          # pruebas en navegador (CHROME_PATH=... si no hay Chrome)
```

## 4. Archivos clave (lo nuevo)

- `src/clima.js`: DONKI, llamaradas archivadas, dosis de la tormenta, refugio por destino.
- `src/sistemas.js`: los 4 sistemas + tormentas (`updateStorm`, `startStorm`, `endStorm`, `shelterOf`, `inShelter`, `setFlares`).
- `src/core.js`: `rescue()`, `rescueStars()`, `crewFix` y `kit` en peligros, `emergency()` cuenta la tormenta.
- `src/datos.js`: datos reales y fuentes (restricción, dosis medidas, OSDR, escala de juego).
- `src/main.js`: cartel y flecha de la tormenta, tarjeta "La restricción real", pantalla DATOS NASA, `?cadete` y `?jurado`, pedido a DONKI al abrir (caché por día en `lfr.flares`; llave propia opcional en `lfr.nasaKey`).
- Pruebas nuevas: `tests/rescate.test.js`, `tests/clima.test.js`, `tests/tormenta.test.js`.
- Reglas del proyecto (de Leo, siguen vigentes): `CLAUDE.md`. Cero dependencias; cada regla con su prueba; azar con semilla `rand(s)`; todo dato de NASA con su fuente.

## 5. Siguiente paso y cola de trabajo

> **README (15/11/2026):** presentación visual bilingüe con inglés principal y sección completa en español; portada SVG propia, capturas reales de los tres destinos y GIF de alerta solar (~1 MB). Propuesto desde alejondr3/custodia-invertilo, rama docs/readme-bilingual-showcase. La cola funcional sigue igual.

> **SIGUIENTE PASO:** E2 · completar los nombres del equipo en `docs/entrega-space-apps.md` (pedírselos a Sergio), revisar qué campos pide el formulario de Space Apps y hacer la prueba con 1 o 2 niños (`docs/analisis/2026-11-14-lifeline-prueba-con-ninos.md`). Antes de presentar: pegar una llave propia de api.nasa.gov en DATOS NASA y abrir el juego una vez en la compu de la demo (la llave DEMO_KEY se agota por red). Lo demás de la cola está hecho, salvo J (descartado por ahora, ver la bitácora).
>
> **También pendiente (IA progresiva, fusionada el 15/11/2026):** probar la IA progresiva con jugadores en días 1, 4, 7 y 10 (Normal/Terror), revisar el límite temporal del simulador en Cadete y después retomar C · ocultar "delatar a un compañero" en Cadete. Análisis y límites de validación: `docs/analisis/ia-progresiva.md`.

Cola en orden (marca `[x]` al terminar y sube):
- [x] A · Instrucciones para el Claude que retome + bitácora (este archivo).
- [x] B · **Campo para la llave de api.nasa.gov** en DATOS NASA: se guarda en `lfr.nasaKey`, borra la caché `lfr.flares` y vuelve a pedir DONKI (`pedirDonki()` en `src/main.js`). Si NASA no responde, lo dice y sigue con las archivadas.
- [x] C · **Ocultar "delatar a un compañero" en Cadete** (público de 7-12). Tecla B en `src/main.js` y `betray()` en `src/core.js`; también el texto "[B] delatar".
- [x] D · **Verificar 3 citas de Leo** y corregir o marcar como no verificadas: NTRS 20250003954 (despresurización, `PROTO_FUENTE.fuga`), "GeoHealth 2025, Wang et al." (`PROTO_FUENTE.perclorato`) y "250 mSv por evento" (`src/sistemas.js`, `EMERGS.llamarada.fatal`).
- [x] E · **Adaptar la entrega de Space Apps a Custodia**: nuevo `docs/entrega-space-apps.md` en inglés (nombre, resumen, enlaces, datos NASA, uso de IA, guion de 30 s, 7 diapositivas) y la descripción del equipo. Faltan los nombres del equipo: pedírselos a Sergio.
- [x] F · **El mantenimiento como mini-protocolo** de 2 o 3 pasos en orden (hoy es "E y esperar 3 s"). Sin romper el bot del simulador ni `npm run e2e`.
- [x] G · **Control de Misión (cooperativo) ve la llamarada real** y puede avisar al astronauta (con el retraso del destino).
- [x] H · **Inglés** en lo que ve el jurado: inicio, intro, tormenta, tarjeta de restricción, DATOS NASA y resumen final.
- [x] I · **Reto diario con la llamarada del día.**
- [~] J · (opcional) Traer la academia de la versión de Sergio (repo `NeckHurtttt/Custodia`) como tutorial.

Lo que hace Sergio (no Claude):
- Sacar la llave gratis en https://api.nasa.gov (con su correo) y pegarla en el inicio → DATOS NASA → "Llave de api.nasa.gov" → USAR LLAVE (en cada compu/navegador donde se juegue o presente).
- Probar con 1 o 2 niños (guía: `docs/analisis/2026-11-14-lifeline-prueba-con-ninos.md`; cambiar "refugio o ciencia" por "refugio o seguir").
- Pegar la descripción del equipo en la web de Space Apps y hacer la entrega.

### Publicar en GitHub (ya hecho; por si hay que repetirlo en otro lado)
```bash
gh repo create proyecto-Hackaton-2.0 --public --source . --remote origin --push
git push origin base-leo
gh api repos/NeckHurtttt/proyecto-Hackaton-2.0/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

## 6. Los proyectos de referencia

| Proyecto | Dónde | Qué aporta |
| :--- | :--- | :--- |
| **Custodia de Leo** (base) | `referencias/custodia-leo/` · etiqueta `base-leo` · repo `leoaguilerasc-design/Custodia-Leo` | Los 4 sistemas como rutina, protocolos con etiqueta de honestidad (`PROTO_NIVEL` y `PROTO_FUENTE`), cooperativo en red con retraso. Sus reglas originales: `referencias/custodia-leo/CLAUDE-de-leo.md`. |
| **LIFELINE completo** | `referencias/lifeline/` (código fuente; sin las versiones armadas) · repo `NeckHurtttt/Lifeline` (commit `c7aa7e3`) · https://neckhurtttt.github.io/Lifeline/ | De ahí vino la lógica de DONKI y los estudios OSDR. Tiene Academia (14 pruebas), Arcade, Centro de cadetes, modo niños de 3 recursos, inglés. Para armarlo: `node scripts/empaquetar.mjs` (usa esbuild por npx). |
| **Custodia del equipo** (versión de Sergio) | repo `NeckHurtttt/Custodia` (no copiado aquí) | Academia de cadetes (12 misiones), panel del profesor, cooperativo en el mismo teclado, más salas. Se separó de la de Leo en el commit `f1fcd5e`. |

## 7. Notas del análisis (resumen)

- **Prueba a fondo de la base de Leo (antes de cambiarla):**
  - Los 3 mapas se completan, sin errores.
  - Pero en Normal, quien solo cumple la rutina perdía entre los días 2 y 5, y en Fácil también.
  - Se ganaba escapando, no cuidando la base.
  - Los protocolos reales solo aparecían si habías fabricado la herramienta.
  - No había DONKI ni OSDR.
  - Esos 5 problemas son lo que corrigieron los puntos 1 a 7.
- **Lo que no hay que perder:** la esencia de Custodia (misterio de la IA, drones, notas ocultas, rutas, finales). El villano complica la misión, pero **la misión es mantener viva la base**.
- Detalle completo: `docs/analisis/comparativa-y-prueba.md`.

## 8. Bitácora (una fila por cambio subido)

| Fecha | Commit | Cambio | Siguiente |
| :--- | :--- | :--- | :--- |
| 15/11 | (este cambio) | Tablet y vertical: el vertical se descarta en todo aparato táctil (aviso «Gira el dispositivo» también en tablet, manifest en horizontal); tablet horizontal reordenada (márgenes seguros ≥ 28 px, joystick más grande, atajos sin duplicados al centro-abajo, botones ≥ 44 px, nada sobre el jugador); ajuste «Controles como en el celular» (antes «Rueda de acciones»); mapa más grande en tablet con solo ✕ CERRAR MAPA. Pruebas: e2e paso 18 (3 tamaños × 3 modos × 5 estados). | Revisar en una tablet real (iPad/Android) y decidir si el teléfono horizontal también necesita la pantalla de título sin botón fijo encima de las tarjetas |
| 15/11 | (este cambio) | Teléfono acostado jugable con los pulgares: joystick, cruceta y USAR a ≥ 26 px del borde (más chicos si la pantalla mide ≤ 340 px de alto); el panel derecho (Mantenimiento/Plan/Amenazas/Avisos) va pegado a la derecha, debajo del minimapa y sobre USAR, sin tapar al jugador; en ≤ 660 px los avisos se corren a la derecha de la barra superior y la mochila va abajo al centro; ventanas largas con el botón de abajo (CERRAR/SEGUIR) siempre a la vista y botones ≥ 44 px; título compacto con las 3 misiones en una fila y JUGAR sin taparlas; mapa con ✕ CERRAR MAPA también en celular; globos de texto de hasta 38 letras; el radio del joystick sigue su tamaño real. Nuevo paso 19 del e2e (568×320 … 932×350 × joystick/cruceta × estados). SW v13. |
| 15/11 | (este cambio) | Banner principal animado: GIF de 6 segundos y 60 fotogramas; estación flotando, estrellas, órbita y pulso solar suave. Texto fijo y portada SVG estática enlazada. Sin cambios al juego. | Revisar y fusionar el PR del banner; luego continúa E2 |
| 15/11 | (este cambio) | README visual bilingüe: inglés principal, español completo, portada SVG, siete capturas reales y GIF de alerta solar. Sin cambios al juego. Validación: 236 pruebas, enlaces y revisión visual en escritorio/móvil. | Revisar y fusionar el PR visual; luego continúa E2 |
| 15/11 | (este cambio) | README: expediente de misión, voseo y tono épico; cooperativo Tripulante/Control actualizado. Enlaces locales verificados y 236 pruebas correctas con node --test. | Revisar y fusionar el PR; luego continúa E2 |
| 14/11 | (este cambio) | README renovado: portada SVG propia, enlaces a jugar/demo, guía de misión, controles, IA, ciencia, cooperativo, desarrollo y resumen en inglés. Portada revisada en navegador y enlaces locales verificados. | Continúa el siguiente paso de la sección 5 |
| 14/11 | (este cambio) | IA progresiva: visión, velocidad, reacción y persistencia por avance y nivel; memoria local de recorridos observados y escondites; 151 pruebas correctas y simulaciones Cadete/Normal en tres destinos. Análisis: `docs/analisis/ia-progresiva.md`. | Validar balance con jugadores y métricas del simulador; retomar C |
| 14/11 | `630b97a` | Base: copia de la versión de Leo (etiqueta `base-leo`) | — |
| 14/11 | `74019d1`…`f9422b0` | Los 8 puntos (rescate, Cadete, tormentas DONKI, armario, pantalla simple, DATOS NASA, enlaces del jurado) | — |
| 14/11 | `b7c3663`, `3cd072f` | CONTEXTO, referencias, análisis; publicado en GitHub y Pages | — |
| 14/11 | (este commit) | A · Instrucciones para el Claude que retome y cola de trabajo | B |
| 14/11 | `1732dd0` | B · Campo para la llave de api.nasa.gov en DATOS NASA (probado con llave falsa: avisa y sigue con archivadas); e2e 18/18 | C |
| 14/11 | `d43bfdc` | C · En Cadete no se puede delatar: `noBetray` en `DIFS.cadete`; `betray()` no hace nada, la etiqueta no ofrece [B] y la ayuda no lo menciona. Prueba nueva en `tests/meta.test.js`; 146/146 y e2e 18/18 | D |
| 14/11 | `14ec944` | D · Citas verificadas: **NTRS 20250003954** existe (Chen, Walker y Williams 2025, emergencias ECLSS de la ISS: fuego, derrames tóxicos, despresurización rápida); se quitó la frase "el tiempo restante es el dato clave" porque el resumen no la dice. **GeoHealth 2025** es real (Wang et al., doi:10.1029/2024GH001213); el perclorato "podría frenar la tiroides" (hipótesis de la revisión), ya no "daña". **250 mSv por evento** confirmado en el Technical Brief de NASA (OCHMO-TB-020, NASA-STD-3001 Vol. 1 Rev B, requisito V1 4031); el texto ahora lo cita. 146/146 y e2e 18/18 | E |
| 14/11 | `e4f36e3` | E · `docs/entrega-space-apps.md` en inglés (nombre, resumen ≤150 palabras, descripción, datos NASA, uso de IA, guion de 30 s, 7 diapositivas, descripción del equipo ES/EN). Faltan los nombres del equipo. Se verificaron las citas NTRS 20030053429, 20220019247 y 20250003954; **20120002562 sin confirmar** (no se lista en la entrega). Nota: el README dice "12 de 12 rescates" y CONTEXTO "15 de 15": la entrega no cita esa cifra | E2 / F |
| 14/11 | `f2ad5e5` | F · El mantenimiento es un mini-protocolo de 3 pasos en orden (`mant_vida`, `mant_energia`, `mant_rad`, `mant_comida` en `PROTOCOLS`, nivel `ficcion` con su fuente): E abre el minijuego de protocolo, 40 s, sin castigo; "AHORA NO" o fallar deja el panel pendiente. `S.resolveMant()` aplica el resultado y `finish()` es el mismo de antes. Simulador: el bot ahora resuelve protocolos y cables (antes se quedaba pegado: 1 de 4 partidas no terminaba); Cadete, 4 partidas por destino: 12 de 12 rescates, dosis Estación 35 %, Luna 53 %, Marte 47 %. 147/147 y e2e 18/18 (el paso 9 ahora juega el minijuego) | G |
| 14/11 | `9e26653` | G · Control de Misión ve el clima espacial real: `sys.clima` y `sys.storm` en la foto (`coop.js`), `climaView()` (lógica pura) y la caja «CLIMA ESPACIAL REAL» en `coopui.js` con la próxima llamarada de DONKI, la cuenta atrás, el refugio y si el astronauta ya está dentro. Botón «AVISAR: ¡AL REFUGIO!» (usa el mensaje `refugio` ya existente, ahora con el nombre de la sala; llega con el retraso del destino; Control ve si su aviso llegaría tarde). Sin órdenes nuevas: Control sigue con solo 4. 151/151, e2e 18/18, e2e:coop 24/24 (3 pasos nuevos) | H |
| 14/11 | `cd15a17` | H · Inglés para el jurado: `src/i18n.js` (`T(es, en)`, `pickLang`), `?lang=en` / `?en` / selector ES·EN en el título (se guarda en `lfr.lang`). Traducido: título, intro, ayuda, DATOS NASA, tormenta (avisos, cartel, tarjeta de la restricción), mini-protocolo de mantenimiento, HUD, rescate y resumen final. `datos.js` ahora son funciones. **No traducido** (sigue en español): pasos de los protocolos de peligros, notas y finales de la historia, villanos, objetos y recetas, medallas, la mayoría de los avisos de juego, el texto de las derrotas, la vista de Control (`coopui.js`) y los rótulos del mapa. Reglas y simulador idénticos (mismos números). 157/157, e2e 19/19 (paso 18 nuevo en inglés), e2e:coop 24/24 | I |
| 14/11 | `f38db58` | Marca: el juego se llama **CUSTODIA** en el título, la pestaña del navegador, el logo del HUD, el texto de compartir el reto diario (ahora apunta a `neckhurtttt.github.io/proyecto-Hackaton-2.0/`) y `package.json`. Los comentarios de los módulos dicen CUSTODIA; «LIFELINE: Rutina» queda solo como crédito del juego original en el README | I |
| 14/11 | `da8aae7` | I · Reto del día con la llamarada real del día: `clima.dailyFlare` (rota entre las 3 archivadas de DONKI, igual para todos y sin red), `Meta.daily` trae `flare` y `flareMin` (23:00–02:00), `core.spawnFlare` + peligro `llamarada` (refugio del destino, 30 s de aviso, salud según `flareHit`: Estación 20, Marte 30, Luna 40). La intro del reto la anuncia, el resumen y el texto de compartir cuentan si te refugiaste. 162/162, e2e 20/20 (paso 19 nuevo). **Ojo:** el 15/11/2026 `api.nasa.gov/DONKI/FLR` respondía 404 y el servidor CCMC no abría desde esta red, así que no pude verificar ni ampliar las llamaradas archivadas (solo se usan las 3 de Sergio) y conviene probar el modo «en vivo» antes de presentar. **Bug previo, no tocado:** en Una noche, el evento aleatorio `s.events` (1350–1550) nunca salta si cae después de 1440 (pasada la medianoche `s.min` vuelve a 0) | J |
| 15/11 | (este commit) | DONKI revisado: el 15/11 `api.nasa.gov/DONKI/FLR` dio 404 un rato (ya no) y después **429 `OVER_RATE_LIMIT`** con DEMO_KEY desde esta red (también CCMC no abría), así que no pude ver una respuesta en vivo; la lógica se probó con respuestas simuladas. CORS es `*`. Cambios: `fetchFlares` reintenta una vez un 404/5xx, no reintenta un 429, y `donkiEstado.error` explica en DATOS NASA por qué no hay datos en vivo (cupo agotado vs. sin conexión). **Recomendación para la demo:** llave propia gratis de api.nasa.gov pegada en DATOS NASA y abrir el juego una vez antes (queda guardada por día). | E2 |
| 15/11 | (este commit) | Cita **NTRS 20120002562 verificada** leyendo el PDF: trata del entrenamiento de la respuesta a incendios en la ISS (reunirse en un lugar seguro, coordinar con Control); no nombra PBA ni PFE, que sí están en NTRS 20030053429 (leído también). La fuente del protocolo `fuego` ahora dice qué aporta cada una (ES y EN) y la entrega ya no la marca como dudosa | E2 |
| 15/11 | (este commit) | Inglés 2: nombres de peligros, objetos y su descripción, pasos de los 12 protocolos, horario del día, tareas de mantenimiento de Luna y Marte, pausa, ajustes y carteles del mundo (getters en `common.js` y `locs.js`; `tests/i18n.test.js`). Sigue en español: notas y finales de la historia, villanos, recetas, medallas y la mayoría de los avisos de juego | E2 |
| 15/11 | (este commit) | **J descartado por ahora:** la Academia de Sergio (`academia.js` 14 KB + `cadete-data.js` 30 KB + `academia-ui.js` 39 KB, 12 misiones, rangos, panel del profesor) depende de su núcleo con varios jugadores (`G.players`, `s.ps`, `s.cadet` dentro del bucle del juego), que aquí no existe: el núcleo tiene un solo `s.p`. Traerla es reescribirla, no copiarla. Opciones si se quiere: enlazar su repo desde DATOS NASA, o hacer un tutorial corto propio | E2 |
| 15/11 | (este commit) | **Vida y drama:** (1) inicio dramático «CUSTODIA OS» (`src/inicio.js` + `arranque()`): pantalla negra → una tecla enciende → texto que se escribe con una sacudida en «SEÑAL PERDIDA» y la voz de la IA → título; se salta con cualquier tecla, una vez por sesión, `?boot`/`?noboot`, sin sacudida en modo suave. (2) **Personalidad de la tripulación** (`src/personajes.js`): 9 compañeros con oficio, forma de ser, frase y 10 tipos de línea en ES/EN (María calmada, Kenji bromista, Amara optimista, Sofía soñadora, Nikolai gruñón de buen corazón, Wei tímido, Lucía cálida, Tomás presumido, Aisha competitiva); hablan según la tormenta, la noche, el trabajo, el peligro, los favores y el rescate; ficha en la pausa y tooltip en el HUD. Las frases no gastan azar: el simulador da los mismos números. (3) Consejos «¿Sabías que…?» con datos reales y fuente (título y final). (4) Final dramático: mapa en gris al perder y **R** reintenta; fundido de ventanas. (5) Agentes `narrative-architect` y `quest-designer`, comando `/verificar` y reglas por ruta; se copiaron aquí los 8 agentes anteriores. **Descartado a propósito:** librerías (Tone.js, xterm.js, inkjs, ZzFX), NPCs con LLM y generadores de imagen/sonido (ver la conversación: cero dependencias, privacidad de niños, llaves de pago). **Pendiente de la lista de ideas:** estilo terminal opcional para DATOS NASA y Control de Misión, tecleo/zumbido al abrir la pantalla de Control. 170+ pruebas, e2e 21/21 | E2 |
| 15/11 | (este commit) | **DATOS NASA como terminal:** cabecera «TERMINAL NASA · ACCESO: CADETE» con el estado de DONKI, 6 secciones que se abren con botones `[1]…[6]`, las teclas 1–6 o escribiendo un comando (`clima`, `weather`, `ver radiación`, `ayuda`, `salir`; parser puro `comandoDatos` con pruebas), prompt `custodia@nasa:~$` con cursor, líneas que aparecen una tras otra y líneas de escaneo muy tenues (apagadas en modo suave). Mismo contenido y fuentes que antes (la llave de api.nasa.gov sigue en la sección clima). Control de Misión recibe la misma piel (escaneo tenue, fuente monoespaciada). 171 pruebas, e2e 21/21 (el paso en inglés prueba botones, comando escrito, error, ayuda y atajo) | E2 |
| 15/11 | (este commit) | **Pregunta de cierre** (`src/quiz.js`): 7 preguntas con fuente (la dosis no se borra, energía y soporte vital, ALARA, fuego en la ISS, retraso a Marte, dosis en la Luna, refugio y blindaje), en ES/EN; la primera vez siempre sale la idea central; se guarda en `lfr.meta.quiz` (aciertos/fallos por pregunta) y hay botón COPIAR MI RESULTADO. Sirve como evidencia de aprendizaje para la entrega (Impacto/Validez): pedir a los niños de la prueba que respondan y anotar cuántos aciertan. No toca puntos ni simulador. 175+ pruebas, e2e 21/21 | E2 |
| 15/11 | (este commit) | **Modo sin internet (PWA):** `sw.js` (PRECACHE de 31 archivos, «red primero» con 4 s de espera, no toca NASA ni `/coop/`), `manifest.webmanifest`, `icons/` (192, 512 y maskable, generados con `tools/icono.mjs`), `<link rel=manifest>` y `theme-color`; el título muestra «✔ Listo para jugar sin internet» y el botón 📲 INSTALAR cuando el navegador lo ofrece. Se probó con Playwright: se instala, se corta la red, la página recarga, se puede jugar y DATOS NASA usa las llamaradas archivadas. **Bug encontrado y arreglado:** la regla «no tocar /coop» también bloqueaba `src/coop.js` y `src/coopui.js` y el juego no cargaba sin internet. No se registra en localhost ni en pruebas (usar `?sw`). Pendiente de probar a mano: instalar en un celular real y jugar en modo avión. 179 pruebas, e2e 22/22 | E2 |
| 15/11 | (este commit) | **Leer en voz alta** (`src/voz.js`): botón 🔊 LEER / ⏹ PARAR en cada ventana (intro, ayuda, DATOS NASA, tormenta, final con la pregunta de cierre), voz del idioma del juego (es-ES / en-US) y partida en frases para que no se corte. Ajuste «LEER EN VOZ ALTA» (pausa y título): lee solo la intro, la tormenta, el final y los avisos importantes. Limpia el texto (sin emojis ni etiquetas; «mSv» → «milisieverts»). Sin librerías: usa la voz del navegador. `sw.js` pasó a `custodia-v2` con `voz.js`. Pruebas: 185 y e2e 23/23 (con síntesis simulada). **Sin verificar:** cómo suena de verdad (depende de las voces del dispositivo; en celulares Android/iOS suelen ser buenas, en algunas compus la voz en español es robótica) | E2 |
| 15/11 | (este commit) | **Inglés completo (2.ª pasada):** villanos, misiones por radio, notas y finales verdaderos, medallas, emergencias de reflejos, rótulos/plan/líneas de la IA/finales de cada destino, objetos, mochila, fabricar, archivo, minijuegos, final y todo el cooperativo (Control de Misión y sus mensajes) salen en inglés con `?lang=en`. Sin cambiar reglas: simulador igual (4,3 / 42,2 / 53,8), prueba nueva de que jugar en inglés da el mismo estado, e2e con pasos nuevos (mochila, archivo, fabricar). Queda en español: recetas y frases de respaldo de la tripulación. |
| 15/11 | (este commit) | **Auditoría de código + mejoras:** (1) arreglo de un fallo viejo: en UNA NOCHE el peligro programado después de medianoche nunca llegaba (ahora usa minutos corridos); (2) **bitácora causal** en el final y en la pausa (`src/informe.js`); (3) **radio con la Tierra** con consejos sobre la base y retraso de señal real en Luna/Marte; (4) **nave de rescate ESPERANZA**: cartel de cada día con su transmisión y la barra de su viaje; (5) el texto de compartir usa la URL actual, «ALERTA/ALERT» y el error de conexión del cooperativo en inglés. Simulador sin cambios (4,3 / 42,2 / 53,8), 197 pruebas, e2e 23/23 y coop 24/24. |
