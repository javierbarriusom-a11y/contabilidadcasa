const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// SP5 · Bloque 2: la nota del deducible óptimo es puramente derivada — sin campo nuevo, reutiliza el
// colchón líquido actual (accountBalancesFromState) y el mismo suelo que ya usan Plan y el mapa de
// calor (cushionFloor con lastSimulation y la reserva operativa configurada).

// OPT-25 (11 sept. 2026): la tarjeta se trasladó de #ajustes a Herramientas avanzadas →
// Seguros (#herramientas-seguros) — mismo id, misma función, solo cambia dónde vive en el DOM.
test("la nota del deducible óptimo vive en #herramientas-seguros", () => {
  const openTag = /<section[^>]*id="herramientas-seguros"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #herramientas-seguros");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const herramientasSeguros = html.slice(start, end);
  assert.match(herramientasSeguros, /id="ajustesOptimalDeductibleNote"/);
});

test("renderAjustesOptimalDeductibleNote reutiliza cushionFloor y el colchón líquido actual, sin campo nuevo que guardar", () => {
  const start = app.indexOf("function renderAjustesOptimalDeductibleNote(");
  assert.ok(start >= 0, "No existe renderAjustesOptimalDeductibleNote en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /accountBalancesFromState\(\)\.total/);
  assert.match(body, /FinanceCanonicalCushion\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)/);
  assert.match(body, /optimalDeductibleFor\(cushion, floor\)/);
  assert.doesNotMatch(body, /saveScenarioSettings/, "no debe persistir nada: es puramente derivada");
});

test("renderAjustes rellena la nota del deducible óptimo", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderAjustesOptimalDeductibleNote\(\);/);
});
