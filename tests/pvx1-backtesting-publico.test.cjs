const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// PVX1 (Oleada 2 Bloque 3): backtesting público del propio motor de previsión. Reutiliza
// learnFromHistory() (E12b/A11-3) sobre reconciledMonthlyNetHistory() — el mismo aprendizaje que ya
// alimenta PV1/PV2/PV3/PV4 dentro del Laboratorio de escenarios (E13), pero mostrado en Ajustes en
// vez de escondido en esa pantalla avanzada. El único concepto real disponible hoy es
// "monthly-net" — no se inventa un desglose por partida para meses ya cerrados.

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
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvx1BacktestHtml"), context);
  return context;
}

test("pvx1BacktestHtml · sin meses conciliados, mensaje explícito en vez de tabla vacía", () => {
  const context = sandbox();
  const result = context.pvx1BacktestHtml([], {});
  assert.match(result, /Sin meses conciliados todavía/);
});

test("pvx1BacktestHtml · una fila por mes, con lo previsto, lo real y la desviación con signo", () => {
  const context = sandbox();
  const result = context.pvx1BacktestHtml(
    [
      { monthKey: "2026-01", planned: 500, actual: 600 },
      { monthKey: "2026-02", planned: 500, actual: 450 },
    ],
    {},
  );
  assert.match(result, /2026-01/);
  assert.match(result, /2026-02/);
  assert.match(result, /\+100\.00 €/);
  assert.match(result, /-50\.00 €/);
});

test("pvx1BacktestHtml · descarta registros sin previsto o real numérico, nunca inventa el hueco", () => {
  const context = sandbox();
  const result = context.pvx1BacktestHtml([{ monthKey: "2026-03", planned: NaN, actual: 100 }], {});
  assert.match(result, /Sin meses conciliados todavía/);
});

test("pvx1BacktestHtml · con aprendizaje disponible, añade el resumen de desviación media y el aviso de muestra insuficiente si aplica", () => {
  const context = sandbox();
  const result = context.pvx1BacktestHtml(
    [{ monthKey: "2026-01", planned: 500, actual: 550 }],
    { deviations: [{ averageDelta: 50, sampleMonths: 1, confidence: "low" }], warning: "Muestra insuficiente: no apliques ajustes sin revisión manual." },
  );
  assert.match(result, /Desviación media histórica/);
  assert.match(result, /Muestra insuficiente/);
});

test("index.html: la tarjeta de backtesting existe", () => {
  assert.match(html, /id="pvx1Backtest"/);
  assert.match(html, /Backtesting: cómo ha acertado la previsión/);
});

test("app.js: renderPvx1Backtest reutiliza reconciledMonthlyNetHistory y learnFromHistory, y está cableado en el render central", () => {
  const block = extractFunction("renderPvx1Backtest");
  assert.match(block, /reconciledMonthlyNetHistory\(\)/);
  assert.match(block, /window\.FinanceCanonicalForecast\?\.learnFromHistory\(/);
  assert.match(app, /renderPvx1Backtest\(\);/);
});
