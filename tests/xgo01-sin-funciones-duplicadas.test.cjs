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
