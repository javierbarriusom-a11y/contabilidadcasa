const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// PVX2 (Oleada 2 Bloque 3): multihorizonte simultáneo. Reutiliza tal cual adaptiveHorizon() (A7-1,
// canonical-forecast.js) — hasta ahora la tarjeta "Horizonte adaptativo" del Laboratorio de
// escenarios (E13) solo mostraba un recuento (X periodos, Y bandas); ahora pinta los periodos de
// verdad, corto/medio/largo plazo a la vez en una sola tabla, sin motor de cálculo nuevo.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = {
    escapeHtml: (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    money: (value) => `${Number(value).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvx2AdaptiveHorizonHtml"), context);
  return context;
}

test("pvx2AdaptiveHorizonHtml · sin horizonte, cadena vacía en vez de una tabla vacía", () => {
  const context = sandbox();
  assert.equal(context.pvx2AdaptiveHorizonHtml([]), "");
  assert.equal(context.pvx2AdaptiveHorizonHtml(null), "");
});

test("pvx2AdaptiveHorizonHtml · un mes (resolución \"month\") muestra la liquidez de cierre, no un rango", () => {
  const context = sandbox();
  const html = context.pvx2AdaptiveHorizonHtml([{ period: "2026-09", resolution: "month", display: "point", closingLiquidity: 1500, minLiquidity: 1500, maxLiquidity: 1500 }]);
  assert.match(html, /2026-09/);
  assert.match(html, /month/);
  assert.match(html, /1500\.00 €/);
  assert.doesNotMatch(html, / a /, "un mes no debe mostrar un rango mín-máx");
});

test("pvx2AdaptiveHorizonHtml · un trimestre/año (resolución \"range\") muestra el rango mín-máx", () => {
  const context = sandbox();
  const html = context.pvx2AdaptiveHorizonHtml([{ period: "2027-T1", resolution: "quarter", display: "range", closingLiquidity: 2000, minLiquidity: 1000, maxLiquidity: 2000 }]);
  assert.match(html, /2027-T1/);
  assert.match(html, /1000\.00 € a 2000\.00 €/);
});

test("pvx2AdaptiveHorizonHtml · pinta corto, medio y largo plazo a la vez, en el mismo orden que llegan", () => {
  const context = sandbox();
  const html = context.pvx2AdaptiveHorizonHtml([
    { period: "2026-09", resolution: "month", display: "point", closingLiquidity: 100, minLiquidity: 100, maxLiquidity: 100 },
    { period: "2027-T1", resolution: "quarter", display: "range", closingLiquidity: 300, minLiquidity: 200, maxLiquidity: 300 },
    { period: "2029", resolution: "year", display: "range", closingLiquidity: 900, minLiquidity: 500, maxLiquidity: 900 },
  ]);
  assert.equal((html.match(/<tr>/g) || []).length, 4, "1 cabecera + 3 filas de periodo");
  const monthIndex = html.indexOf("2026-09");
  const quarterIndex = html.indexOf("2027-T1");
  const yearIndex = html.indexOf("2029");
  assert.ok(monthIndex < quarterIndex && quarterIndex < yearIndex, "corto, medio y largo plazo en el mismo orden que adaptiveHorizon() los da");
});

test("app.js: renderE13ScenarioLab pinta la tabla de PVX2 junto a la tarjeta de horizonte adaptativo", () => {
  const start = app.indexOf('qs("e13AdvancedAnalysis").innerHTML');
  assert.ok(start >= 0, "No existe el render de e13AdvancedAnalysis en app.js");
  const end = app.indexOf(";\n", start);
  const body = app.slice(start, end);
  assert.match(body, /pvx2AdaptiveHorizonHtml\(horizon\)/);
});
