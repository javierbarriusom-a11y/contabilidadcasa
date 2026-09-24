const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2): techo de tamaño para app.js, pedido por el hogar el
// 24 de septiembre de 2026 (sesión 233).
//
// Motivo, con cifras: T14 dejó app.js en 37.233 líneas (sesión 207) tras ocho extracciones a
// views/*.js (-10,5%). En pausa desde entonces, volvió a crecer hasta 38.674 (sesión 231, +1.441):
// casi todo el código nuevo seguía cayendo en app.js por inercia, así que cada extracción de ARQ-4
// se perdía en pocas sesiones. Este test cierra el grifo: app.js no puede superar el techo.
//
// Qué hacer si falla por ARRIBA (app.js ha crecido por encima del techo):
//   - Código de una sola pantalla → a su views/<pantalla>.js (VIEW_CHUNKS, carga diferida).
//   - Lógica de cálculo pura → a un canonical-*.js (factory UMD, con su propio test).
//   - O extrae otra porción de app.js para hacer sitio (ARQ-4 continúa T14).
//   Subir el techo NO es la salida por defecto: solo con decisión explícita del hogar, anotada en
//   PROJECT_STATE.md con el motivo.
//
// Qué hacer si falla por ABAJO (trinquete): app.js ha bajado más de RATCHET_SLACK_LINES por debajo
// del techo — una extracción ha liberado espacio. Baja CEILING_LINES a (líneas actuales + margen de
// ~130) en el mismo PR que hace la extracción, para que lo ganado no se vuelva a perder.
// Historial del techo: 38.600 (sesión 233, app.js en 38.467) → 38.235 (sesión 236, app.js en 38.105
// tras extraer «Nueva vida» simulación a views/new-life-simulation.js) → 37.436 (sesión 237, app.js en
// 37.306 tras extraer el Agente de ahorro a views/savings-agent.js y su núcleo a canonical-savings-agent.js).
const CEILING_LINES = 37436;
const RATCHET_SLACK_LINES = 300;
// Tope secundario en bytes para que el techo de líneas no se esquive con líneas kilométricas.
const CEILING_BYTES = 2000000;

const appPath = path.join(__dirname, "..", "app.js");
const source = fs.readFileSync(appPath, "utf8");
const lines = source.split("\n").length - (source.endsWith("\n") ? 1 : 0);
const bytes = fs.statSync(appPath).size;

test("ARQ-4 · app.js no supera su techo de líneas", () => {
  assert.ok(
    lines <= CEILING_LINES,
    `app.js tiene ${lines} líneas, por encima del techo de ${CEILING_LINES}. Mueve el código nuevo a views/*.js o a un canonical-*.js (ver cabecera de este test) en vez de subir el techo.`,
  );
});

test("ARQ-4 · app.js no supera su techo de bytes", () => {
  assert.ok(
    bytes <= CEILING_BYTES,
    `app.js pesa ${bytes} bytes, por encima del techo de ${CEILING_BYTES}. Mismo remedio que el techo de líneas.`,
  );
});

test("ARQ-4 · trinquete: cuando app.js baja, el techo baja con él", () => {
  assert.ok(
    lines >= CEILING_LINES - RATCHET_SLACK_LINES,
    `app.js ha bajado a ${lines} líneas, más de ${RATCHET_SLACK_LINES} por debajo del techo (${CEILING_LINES}). Baja CEILING_LINES a ~${lines + 130} en este mismo PR para fijar lo ganado.`,
  );
});
