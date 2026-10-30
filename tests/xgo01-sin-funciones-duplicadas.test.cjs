const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// XGO-01 · PR-1 (sesión 329, 20/10/2026): al partir app.js, sus funciones pasan a otros scripts clásicos que comparten
// el mismo ámbito global. Si dos de esos scripts declaran una función con el mismo nombre, gana en silencio la del que
// se carga último y la otra no se ejecuta nunca, sin error. Antes del desalojo app.js iba el último y siempre ganaba;
// ahora el orden de carga decidiría. Esta prueba lo impide: cada función de primer nivel se declara una sola vez entre
// todos los scripts del sitio, los de index.html y las vistas que app.js carga al visitarlas (VIEW_CHUNKS).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function scriptsDelSitio() {
  const html = read("index.html");
  const enHtml = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]).filter((src) => !/^https?:/.test(src));
  const enVistas = [...read("app.js").matchAll(/\bsrc: "(views\/[^"]+)"/g)].map((m) => m[1]);
  return [...new Set([...enHtml, ...enVistas].map((src) => src.split("?")[0]))];
}

test("cada función de primer nivel se declara en un solo script del sitio", () => {
  const scripts = scriptsDelSitio();
  assert.ok(scripts.includes("app.js") && scripts.includes("registrar-ui.js") && scripts.includes("views/escenarios.js"));
  const dondeSeDeclara = new Map();
  for (const file of scripts) {
    for (const [, name] of read(file).matchAll(/^(?:async )?function\*? (\w+)\(/gm)) {
      dondeSeDeclara.set(name, [...(dondeSeDeclara.get(name) || []), file]);
    }
  }
  const duplicadas = [...dondeSeDeclara].filter(([, files]) => files.length > 1).map(([name, files]) => `${name}: ${files.join(", ")}`);
  assert.deepEqual(duplicadas, [], "una función global declarada en dos scripts: la del que carga último anula a la otra");
});

test("Registrar y Datos viven fuera de app.js, en scripts que se cargan antes que él", () => {
  const app = read("app.js");
  const registrar = read("registrar-ui.js");
  const datos = read("datos-ui.js");
  ["renderRegistrar", "renderRegistrarMes", "renderRegistrarActuals", "handleManualData", "processRegistrarExcelFile", "confirmReceiptCapture"].forEach((name) => {
    assert.match(registrar, new RegExp(`^(async )?function ${name}\\(`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(async )?function ${name}\\(`, "m"), `${name} ya no está en app.js`);
  });
  ["renderDetailedMovements", "handleMovementExcelImport", "renderDataAudit", "handleMovementsBulkApply"].forEach((name) => {
    assert.match(datos, new RegExp(`^(async )?function ${name}\\(`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(async )?function ${name}\\(`, "m"), `${name} ya no está en app.js`);
  });
  // El cargador del motor de tickets se queda junto a su URL y su huella SRI (RQ-13, tests/ntc6-conexiones-externas).
  assert.match(app, /^function loadReceiptOcrEngine\(/m);
});

// XGO-01 · PR-2 (sesión 334, 21/10/2026): Plan › Partidas a partidas-ui.js y el motor de escenarios al nuevo
// escenarios-ui.js. El motor no puede ir a views/escenarios.js: esa vista se descarga al visitarla y el motor lo usan
// también Plan › Partidas, la segunda opinión y el comparador de estrategias de deuda, que no la cargan.
test("Partidas y el motor de escenarios viven fuera de app.js, en scripts que se cargan antes que él", () => {
  const app = read("app.js");
  const partidas = read("partidas-ui.js");
  const escenarios = read("escenarios-ui.js");
  ["renderPlanificacionPartidas", "renderPartidasGestionTable", "handlePartidasAddRow", "handlePartidasBulkEdit", "partidasSimuladorEvaluate", "applySeriesChange"].forEach((name) => {
    assert.match(partidas, new RegExp(`^(async )?function ${name}\\(`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(async )?function ${name}\\(`, "m"), `${name} ya no está en app.js`);
  });
  ["runEscenarioMotor", "escenarioMotorSummaryFor", "loadEscenarioMotorSaved", "escenarioMotorFieldControlHtml", "retractPlanningRowsFromEscenario"].forEach((name) => {
    assert.match(escenarios, new RegExp(`^(async )?function ${name}\\(`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(async )?function ${name}\\(`, "m"), `${name} ya no está en app.js`);
  });
  const html = read("index.html");
  const pos = (src) => html.search(new RegExp(`<script defer src="${src.replace(".", "\\.")}\\?`));
  ["partidas-ui.js", "escenarios-ui.js"].forEach((src) => {
    assert.ok(pos(src) !== -1 && pos(src) < pos("app.js"), `${src} se carga con defer antes que app.js`);
  });
  assert.doesNotMatch(read("views/escenarios.js"), /^(async )?function (runEscenarioMotor|escenarioMotorSummaryFor)\(/m, "el motor no va en la vista que se carga bajo demanda");
});

// XGO-01 · PR-3 (sesión 362, 27/10/2026): el asistente «Importar extracto» en cuatro pasos (V4-4, R-8) al nuevo
// importar-extracto-ui.js, tal cual. Declara `let` y `const` de nivel superior: si app.js los declarara también, el
// navegador rechazaría app.js entero al cargarlo (mismo ámbito global), así que se comprueba que no queda ninguno.
test("el asistente de importar extracto vive fuera de app.js, en un script que se carga antes que él", () => {
  const app = read("app.js");
  const importar = read("importar-extracto-ui.js");
  ["datosImportarApply", "handleDatosImportarFile", "renderDatosImportar", "datosImportarRestoreSession", "datosImportarDuplicateCandidates", "movementsFromStatementRows", "daysBetweenIsoDates"].forEach((name) => {
    assert.match(importar, new RegExp(`^(async )?function ${name}\\(`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(async )?function ${name}\\(`, "m"), `${name} ya no está en app.js`);
  });
  ["datosImportarSession", "datosImportarLastResult", "DATOS_IMPORTAR_TARGETS", "DATOS_IMPORTAR_ACCOUNTS", "DATOS_IMPORTAR_DRAFT_KEY"].forEach((name) => {
    assert.match(importar, new RegExp(`^(let|const) ${name}\\b`, "m"), name);
    assert.doesNotMatch(app, new RegExp(`^(let|const|var) ${name}\\b`, "m"), `${name} no se declara dos veces`);
  });
  assert.doesNotMatch(importar, /^(?!function |async function |const |let |\/\/|\s|\}|\]|$)/m, "solo declaraciones y comentarios: nada se ejecuta al cargarse");
  const html = read("index.html");
  const pos = (src) => html.search(new RegExp(`<script defer src="${src.replace(".", "\\.")}\\?`));
  assert.ok(pos("importar-extracto-ui.js") !== -1 && pos("importar-extracto-ui.js") < pos("app.js"), "se carga con defer antes que app.js");
  assert.match(html, /<script defer src="app\.js\?v=20261030planC1">/, "app.js cambia de versión con el desalojo: un app.js viejo en la caché HTTP junto al script nuevo declararía dos veces lo mismo");
});
