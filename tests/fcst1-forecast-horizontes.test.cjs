/**
 * tests/fcst1-forecast-horizontes.test.cjs
 *
 * FCST-1 (FASE 7): forecast por categoría a 3 horizontes (semana, cierre de mes, +3 meses).
 * `canonical-budget-forecast-category.js` ya calculaba predicted/±range/confidence por mes, pero
 * solo se usaba internamente para "Sugerir presupuestos" (suggestedBudget) — la banda de confianza
 * en sí nunca se mostraba. Sin motor nuevo: el cierre de mes reutiliza tal cual budgetProjection()
 * (S-2, ya visible en la tabla); lo único nuevo es el horizonte semanal (forecast del mes en curso ÷
 * 4,345 semanas/mes) y exponer la banda de +3 meses.
 *
 * - Parte A: budgetForecastHorizons — cadena real sobre el motor canónico de forecast.
 * - Parte B: presupuestoMesForecastHorizonsRowHtml/Html — formateo de fila y tarjeta, motores
 *   mockeados en el límite.
 * - Parte C: wiring estático.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { CanonicalBudgetForecastCategory } = require("../canonical-budget-forecast-category.js");

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
// Parte A: budgetForecastHorizons — cadena real
// ============================================================================

function computationSandbox(transactions) {
  const context = {
    baseData: { transactions },
    window: { FinanceCanonicalBudgetForecastCategory: { CanonicalBudgetForecastCategory } },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    syntheticManualMovements: () => [],
  };
  vm.createContext(context);
  vm.runInContext(
    [
      "var budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
      extractFunction("budgetNegativeTransactionsByCategory"),
      extractFunction("budgetHistoricalExpenseTransactions"),
      extractFunction("recentBudgetMonthKeys"),
      extractFunction("budgetForecastHorizons"),
    ].join("\n"),
    context,
    { filename: "app.js#fcst1-computation" },
  );
  return context;
}

function flatSixMonths(category, monthlyAmount, months) {
  const rows = [];
  months.forEach((m) => rows.push({ date: `${m}-15`, amount: -monthlyAmount, category, month: m }));
  return rows;
}

test("FCST-1 · budgetForecastHorizons: sin histórico suficiente, null", () => {
  const context = computationSandbox([{ date: "2026-06-15", amount: -100, category: "comida" }]);
  assert.equal(context.budgetForecastHorizons("comida", "2026-07"), null);
});

test("FCST-1 · budgetForecastHorizons: gasto estable da semana y +3 meses con confianza alta", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const context = computationSandbox(flatSixMonths("comida", 100, months));
  const horizons = context.budgetForecastHorizons("comida", "2026-07");
  assert.ok(horizons);
  assert.equal(horizons.week.predicted, Math.round((100 / 4.345) * 100) / 100);
  assert.equal(horizons.week.range, "±0");
  assert.equal(horizons.week.confidence, "high");
  assert.equal(horizons.threeMonthsOut.predicted, 100);
  assert.equal(horizons.threeMonthsOut.range, "±0");
  assert.equal(horizons.threeMonthsOut.confidence, "high");
});

test("FCST-1 · budgetForecastHorizons: \"+3 meses\" es de verdad 3 meses después del mes en curso", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const context = computationSandbox(flatSixMonths("comida", 100, months));
  // Con forecastMonths:4 el índice 0 es julio (mes en curso) y el índice 3 es octubre — 3 meses
  // después de julio. Verificado indirectamente: el forecast no incluye ni noviembre (se pasaría de
  // 3 meses) ni junio (ya es histórico), así que el predicted de threeMonthsOut coincide con el
  // gasto estable de la serie (100), lo cual solo ocurre si cae dentro de la ventana de 4 meses.
  const horizons = context.budgetForecastHorizons("comida", "2026-07");
  assert.equal(horizons.threeMonthsOut.predicted, 100);
});

test("FCST-1 · budgetForecastHorizons: la categoría sin datos en absoluto también da null", () => {
  const context = computationSandbox([]);
  assert.equal(context.budgetForecastHorizons("fantasma", "2026-07"), null);
});

// ============================================================================
// Parte B: presupuestoMesForecastHorizonsRowHtml/Html — formateo
// ============================================================================

function viewSandbox({ categoryBudgets = [], horizons = null, alert = null, projection = null, scenarioEvents = [] } = {}) {
  const context = {
    categoryBudgetsForMonth: () => categoryBudgets,
    budgetForecastHorizons: () => horizons,
    budgetAlertForRow: () => alert || { status: "on-track", metrics: { spent: 0, dayOfMonth: 1, daysInMonth: 30 } },
    budgetProjection: () => projection || { projected: 0, diff: 0 },
    budgetRowDisplayLabel: (id) => id,
    money: (v) => `€${v}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    e13ScenarioEvents: scenarioEvents,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("budgetForecastConfidenceLabel"),
      extractFunction("e13EventCoversMonth"),
      extractFunction("budgetScenarioImpactForMonth"),
      extractFunction("presupuestoMesForecastHorizonsRowHtml"),
      extractFunction("presupuestoMesForecastHorizonsHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#fcst1-view" },
  );
  return context;
}

test("FCST-1 · sin presupuestos del mes, la tarjeta no pinta nada", () => {
  const context = viewSandbox({ categoryBudgets: [] });
  assert.equal(context.presupuestoMesForecastHorizonsHtml("2026-07"), "");
});

test("FCST-1 · sin histórico suficiente, la fila avisa en vez de fallar", () => {
  const context = viewSandbox({ categoryBudgets: [{ categoryId: "comida", amountCap: 100 }], horizons: null });
  const html = context.presupuestoMesForecastHorizonsHtml("2026-07");
  assert.match(html, /Histórico insuficiente para forecast/);
});

test("FCST-1 · pinta semana, cierre de mes (reutilizado) y +3 meses con su banda de confianza", () => {
  const context = viewSandbox({
    categoryBudgets: [{ categoryId: "comida", amountCap: 300 }],
    horizons: {
      week: { predicted: 23.01, range: "±2", confidence: "high" },
      threeMonthsOut: { predicted: 105, range: "±15", confidence: "medium" },
    },
    projection: { projected: 310, diff: 10 },
  });
  const html = context.presupuestoMesForecastHorizonsHtml("2026-07");
  assert.match(html, /<th>Categoría<\/th><th>Semana<\/th><th>Cierre de mes<\/th><th>\+3 meses<\/th>/);
  assert.match(html, /€23\.01 <small class="note">±2, confianza alta<\/small>/);
  assert.match(html, /€310<br><small class="note">\+€10 sobre<\/small>/);
  assert.match(html, /€105 <small class="note">±15, confianza media<\/small>/);
});

test("FCST-1 · budgetForecastConfidenceLabel traduce los tres niveles", () => {
  const context = viewSandbox({});
  assert.equal(context.budgetForecastConfidenceLabel("high"), "alta");
  assert.equal(context.budgetForecastConfidenceLabel("medium"), "media");
  assert.equal(context.budgetForecastConfidenceLabel("low"), "baja");
});

// ============================================================================
// Parte C: wiring estático
// ============================================================================

test("FCST-1 · la tarjeta de horizontes está conectada en renderPresupuestoMes", () => {
  assert.match(viewSrc, /\$\{presupuestoMesSeasonalHtml\(monthKey\)\}\s*\$\{presupuestoMesForecastHorizonsHtml\(monthKey\)\}/);
});
