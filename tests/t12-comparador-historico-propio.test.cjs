const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// T12 (Contabilidadcasa 2.0): comparador «yo vs. mi propio histórico» — mejor mes, peor mes y media
// de los últimos 12 meses conciliados. Ningún motor nuevo: reconciledMonthlyNetHistory() ya
// alimentaba P6/PVC17; aquí solo se ordena, se recorta a 12 y se resume.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const analisisSource = fs.readFileSync(path.join(__dirname, "..", "views", "analisis.js"), "utf8");

function extractFunction(name, source = appSource) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function monthRecord(monthKey, actual) {
  return { monthKey, actual, planned: NaN, reconciled: true };
}

function sandbox(history) {
  const context = {
    reconciledMonthlyNetHistory: () => history,
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    registrarMesMonthName: (key) => `mes-${key}`,
    qs: () => null,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("t12HistoricalComparisonMonths"), context);
  vm.runInContext(extractFunction("renderT12HistoricalComparison"), context);
  return context;
}

test("t12HistoricalComparisonMonths · ordena por mes y recorta a los últimos 12", () => {
  const history = Array.from({ length: 15 }, (_, index) => monthRecord(`2025-${String(index + 1).padStart(2, "0")}`, index));
  const ctx = sandbox(history);
  const months = ctx.t12HistoricalComparisonMonths();
  assert.equal(months.length, 12);
  assert.equal(months[0].monthKey, "2025-04");
  assert.equal(months[months.length - 1].monthKey, "2025-15");
});

test("t12HistoricalComparisonMonths · descarta meses sin actual finito", () => {
  const history = [monthRecord("2025-01", 100), { monthKey: "2025-02", actual: NaN }, monthRecord("2025-03", 50)];
  const ctx = sandbox(history);
  const months = ctx.t12HistoricalComparisonMonths();
  assert.equal(months.length, 2);
});

test("renderT12HistoricalComparison · con menos de dos meses, oculta la tarjeta sin tocar el resumen", () => {
  const card = { hidden: false };
  const context = {
    reconciledMonthlyNetHistory: () => [monthRecord("2025-01", 100)],
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    registrarMesMonthName: (key) => `mes-${key}`,
    qs: (id) => ({ t12HistoricalComparisonCard: card, t12HistoricalComparisonSummary: {}, t12HistoricalComparisonBand: {} }[id]),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("t12HistoricalComparisonMonths"), context);
  vm.runInContext(extractFunction("renderT12HistoricalComparison"), context);
  context.renderT12HistoricalComparison();
  assert.equal(card.hidden, true);
});

test("renderT12HistoricalComparison · calcula mejor, peor y media, y las marca en el resumen", () => {
  const card = { hidden: true };
  const summary = { innerHTML: "" };
  const band = { innerHTML: "" };
  const context = {
    reconciledMonthlyNetHistory: () => [
      monthRecord("2025-01", -200),
      monthRecord("2025-02", 300),
      monthRecord("2025-03", 100),
    ],
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    registrarMesMonthName: (key) => `mes-${key}`,
    qs: (id) => ({ t12HistoricalComparisonCard: card, t12HistoricalComparisonSummary: summary, t12HistoricalComparisonBand: band }[id]),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("t12HistoricalComparisonMonths"), context);
  vm.runInContext(extractFunction("renderT12HistoricalComparison"), context);
  context.renderT12HistoricalComparison();
  assert.equal(card.hidden, false);
  assert.match(summary.innerHTML, /Mejor mes.*300€.*mes-2025-02/s);
  assert.match(summary.innerHTML, /Peor mes.*-200€.*mes-2025-01/s);
  assert.match(summary.innerHTML, /Media de los últimos 3 mes\(es\).*67€/s);
  // El mes más reciente (2025-03, 100€) está por encima de la media (67€).
  assert.match(summary.innerHTML, /por encima de tu propia media/);
  assert.match(band.innerHTML, /is-worst/);
});

test("views/analisis.js: renderAnalisis llama a renderT12HistoricalComparison", () => {
  const block = analisisSource.slice(analisisSource.indexOf("function renderAnalisis("));
  assert.match(block, /renderT12HistoricalComparison\(\)/);
});
