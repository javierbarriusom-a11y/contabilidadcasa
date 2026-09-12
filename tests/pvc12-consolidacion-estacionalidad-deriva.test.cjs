/**
 * tests/pvc12-consolidacion-estacionalidad-deriva.test.cjs
 *
 * PVC12 (Oleada 4, alcance confirmado por VER-6 y por el hogar en sesión dedicada): consolida la
 * estacionalidad duplicada entre `_detectMonthlySeasonality` (canonical-budget-forecast-category.js,
 * invisible, alimentaba solo el forecast interno) y `budgetSeasonalPatterns` (ML-1, ya visible y
 * validada en Presupuesto del mes) en una única función pura, `seasonalPatternsFromCalendarSpend`,
 * que ahora usan ambas. El sesgo de PVC4 (`categoryDriftWindows`, meses cerrados y conciliados) se
 * mantiene deliberadamente separado — mide algo distinto sobre una fuente de datos distinta, tal y
 * como confirmó `VER-6` — pero cuando una partida con sesgo sistemático tiene una categoría bancaria
 * equivalente con un patrón estacional real, se añade una nota cruzada de solo lectura.
 *
 * - Parte A: `seasonalPatternsFromCalendarSpend` — función pura, tests directos.
 * - Parte B: `_detectMonthlySeasonality`/`forecast()` — el patrón validado sustituye al índice
 *   interno solo cuando hay señal real; si no, cae al cálculo interno de siempre (compatible).
 * - Parte C: `categoryDriftWindows` — pasa `categoryId` sin tocar el cálculo de sesgo.
 * - Parte D: `budgetSeasonalPatterns` (views/presupuesto-mes.js) delega en la función canónica.
 * - Parte E: `pvc12SeasonalCrossReferenceNote` (app.js) — puente de solo lectura.
 * - Parte F: wiring estático.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { CanonicalBudgetForecastCategory } = require("../canonical-budget-forecast-category.js");
const F = require("../canonical-forecast.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

// ============================================================================
// Parte A: seasonalPatternsFromCalendarSpend — función pura
// ============================================================================

test("PVC12 · seasonalPatternsFromCalendarSpend: sin muestras suficientes, sin patrones", () => {
  const entries = [
    { monthKey: "2026-01", spent: 100 },
    { monthKey: "2026-02", spent: 100 },
  ];
  assert.deepEqual(CanonicalBudgetForecastCategory.seasonalPatternsFromCalendarSpend(entries), []);
});

test("PVC12 · seasonalPatternsFromCalendarSpend: detecta diciembre por encima de la media con umbral por defecto", () => {
  const entries = [];
  ["2024", "2025"].forEach((year) => {
    for (let month = 1; month <= 11; month += 1) entries.push({ monthKey: `${year}-${String(month).padStart(2, "0")}`, spent: 100 });
    entries.push({ monthKey: `${year}-12`, spent: 200 });
  });
  const patterns = CanonicalBudgetForecastCategory.seasonalPatternsFromCalendarSpend(entries);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].calendarMonth, 12);
  assert.ok(patterns[0].deviationPct > 10);
});

test("PVC12 · seasonalPatternsFromCalendarSpend: un mes con una sola muestra no cuenta como patrón (mínimo 2 por mes)", () => {
  const entries = [
    { monthKey: "2026-01", spent: 100 },
    { monthKey: "2026-02", spent: 100 },
    { monthKey: "2026-03", spent: 100 },
    { monthKey: "2026-04", spent: 100 },
    { monthKey: "2026-05", spent: 100 },
    { monthKey: "2026-12", spent: 500 },
  ];
  assert.deepEqual(CanonicalBudgetForecastCategory.seasonalPatternsFromCalendarSpend(entries), []);
});

// ============================================================================
// Parte B: _detectMonthlySeasonality / forecast() — solo sustituye cuando hay señal real
// ============================================================================

test("PVC12 · _detectMonthlySeasonality: sin patrón validado, conserva el índice interno de siempre", () => {
  const monthlyHistory = [
    { month: "2026-01", total: 100 }, { month: "2026-02", total: 110 }, { month: "2026-03", total: 105 },
    { month: "2026-04", total: 120 }, { month: "2026-05", total: 100 }, { month: "2026-06", total: 130 },
    { month: "2026-07", total: 90 }, { month: "2026-08", total: 110 },
  ];
  const index = CanonicalBudgetForecastCategory._detectMonthlySeasonality(monthlyHistory);
  const globalAvg = monthlyHistory.reduce((s, m) => s + m.total, 0) / monthlyHistory.length;
  assert.ok(Math.abs(index[1] - 100 / globalAvg) < 1e-9);
});

test("PVC12 · _detectMonthlySeasonality: el patrón validado (mismo umbral que ML-1) sustituye al índice interno para ese mes", () => {
  const monthlyHistory = [];
  ["2024", "2025"].forEach((year) => {
    for (let month = 1; month <= 11; month += 1) monthlyHistory.push({ month: `${year}-${String(month).padStart(2, "0")}`, total: 100 });
    monthlyHistory.push({ month: `${year}-12`, total: 250 });
  });
  const index = CanonicalBudgetForecastCategory._detectMonthlySeasonality(monthlyHistory);
  const validated = CanonicalBudgetForecastCategory.seasonalPatternsFromCalendarSpend(monthlyHistory.map((m) => ({ monthKey: m.month, spent: m.total })));
  const decemberPattern = validated.find((p) => p.calendarMonth === 12);
  assert.ok(decemberPattern, "El escenario debe producir un patrón validado en diciembre");
  assert.equal(index[12], 1 + decemberPattern.deviationPct / 100);
});

test("PVC12 · forecast(): sigue devolviendo null con <6 movimientos (compatibilidad, Budget Forecast Category)", () => {
  const movements = [{ date: "2026-08-01", amount: -100 }];
  assert.equal(CanonicalBudgetForecastCategory.forecast(movements), null);
});

// ============================================================================
// Parte C: categoryDriftWindows — categoryId pasa sin tocar el cálculo de sesgo
// ============================================================================

function driftRecord(conceptId, monthKey, planned, actual, categoryId) {
  return { conceptId, label: conceptId, monthKey, planned, actual, reconciled: true, categoryId };
}

test("PVC12 · categoryDriftWindows: propaga categoryId del registro más reciente sin alterar systematic/windows", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const records = months.map((m) => driftRecord("ocio", m, 100, 130, "Ocio"));
  const [result] = F.categoryDriftWindows(records, [3, 6, 12]);
  assert.equal(result.categoryId, "Ocio");
  assert.equal(result.systematic, true);
  assert.equal(result.windows[0].averageDelta, 30);
});

test("PVC12 · categoryDriftWindows: sin categoryId en los registros (p. ej. ingresos), categoryId es null", () => {
  const records = [driftRecord("income:Salario", "2026-01", 2000, 2000, null)];
  const [result] = F.categoryDriftWindows(records, [3]);
  assert.equal(result.categoryId, null);
});

// ============================================================================
// Parte D: budgetSeasonalPatterns (views/presupuesto-mes.js) delega en la función canónica
// ============================================================================

function seasonalPatternsSandbox(spendByMonthKey) {
  const context = {
    window: { FinanceCanonicalBudgetForecastCategory: { CanonicalBudgetForecastCategory } },
    budgetAlertForRow: (_row, monthKey) => ({ metrics: { spent: spendByMonthKey[monthKey] || 0 } }),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("recentBudgetMonthKeys"), extractFunction("budgetSeasonalPatterns")].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#pvc12" },
  );
  return context;
}

test("PVC12 · budgetSeasonalPatterns sigue detectando diciembre por encima de la media tras delegar en la función canónica", () => {
  const spendByMonthKey = {};
  ["2024", "2025"].forEach((year) => {
    for (let month = 1; month <= 11; month += 1) spendByMonthKey[`${year}-${String(month).padStart(2, "0")}`] = 100;
    spendByMonthKey[`${year}-12`] = 200;
  });
  const context = seasonalPatternsSandbox(spendByMonthKey);
  const patterns = context.budgetSeasonalPatterns("cat1", "2026-01");
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].calendarMonth, 12);
});

// ============================================================================
// Parte E: pvc12SeasonalCrossReferenceNote (app.js) — puente de solo lectura
// ============================================================================

function crossReferenceSandbox(transactions) {
  const context = {
    baseData: { transactions },
    window: { FinanceCanonicalBudgetForecastCategory: { CanonicalBudgetForecastCategory } },
  };
  vm.createContext(context);
  vm.runInContext(
    [
      "var budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
      extractFunction("budgetNegativeTransactionsByCategory"),
      extractFunction("pvc12SeasonalCrossReferenceNote"),
    ].join("\n"),
    context,
    { filename: "app.js#pvc12-cross-reference" },
  );
  return context;
}

test("PVC12 · pvc12SeasonalCrossReferenceNote: sin categoryId, no hay nota", () => {
  const context = crossReferenceSandbox([]);
  assert.equal(context.pvc12SeasonalCrossReferenceNote(null), "");
});

test("PVC12 · pvc12SeasonalCrossReferenceNote: con patrón estacional real en la categoría, añade la nota nombrando el mes", () => {
  const rows = [];
  ["2024", "2025"].forEach((year) => {
    for (let month = 1; month <= 11; month += 1) rows.push({ category: "Ocio", amount: -100, month: `${year}-${String(month).padStart(2, "0")}` });
    rows.push({ category: "Ocio", amount: -250, month: `${year}-12` });
  });
  const context = crossReferenceSandbox(rows);
  const note = context.pvc12SeasonalCrossReferenceNote("Ocio");
  assert.match(note, /diciembre/i);
});

test("PVC12 · pvc12SeasonalCrossReferenceNote: sin patrón real detectado, no fabrica ninguna nota", () => {
  const rows = ["2026-01", "2026-02", "2026-03"].map((m) => ({ category: "Ocio", amount: -100, month: m }));
  const context = crossReferenceSandbox(rows);
  assert.equal(context.pvc12SeasonalCrossReferenceNote("Ocio"), "");
});

// ============================================================================
// Parte F: wiring estático
// ============================================================================

test("wiring: pvc4CategoryHistoryRecords añade categoryId solo para gastos, vía categoryForPartidaEntry", () => {
  const block = extractFunction("pvc4CategoryHistoryRecords");
  assert.match(block, /categoryId:\s*entry\.kind === "expense" \? categoryForPartidaEntry\(entry\) : null/);
});

test("wiring: pvc4CategoryDriftHtml cruza cada partida con pvc12SeasonalCrossReferenceNote", () => {
  const block = extractFunction("pvc4CategoryDriftHtml");
  assert.match(block, /pvc12SeasonalCrossReferenceNote\(item\.categoryId\)/);
});

test("wiring: budgetSeasonalPatterns delega en seasonalPatternsFromCalendarSpend, sin duplicar el umbral", () => {
  const block = extractFunction("budgetSeasonalPatterns");
  assert.match(block, /seasonalPatternsFromCalendarSpend/);
  assert.doesNotMatch(block, /deviationPct\)\s*>=\s*10/);
});

test("wiring: _detectMonthlySeasonality reutiliza seasonalPatternsFromCalendarSpend en vez de un segundo umbral propio", () => {
  const src = read("canonical-budget-forecast-category.js");
  const start = src.indexOf("static _detectMonthlySeasonality(");
  assert.ok(start >= 0);
  const block = src.slice(start, start + 1800);
  assert.match(block, /this\.seasonalPatternsFromCalendarSpend\(/);
});
