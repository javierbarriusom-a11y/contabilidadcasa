/**
 * tests/fcst2-escenarios-presupuesto.test.cjs
 *
 * FCST-2 (FASE 7): conecta el laboratorio de Escenarios (E13, app.js) con el forecast por
 * categoría de Presupuesto del mes (FCST-1). Sin motor nuevo por ningún lado: `canonical-e13-
 * scenarios.js` gana un campo opcional `categoryId` en sus eventos (no participa en simulate(), es
 * metadato); `budgetForecastHorizons` (FCST-1) expone los monthKey reales de sus horizontes; y una
 * función nueva (`budgetScenarioImpactForMonth`) suma el importe de los eventos de E13 etiquetados
 * con esa categoría y activos en ese mes al forecast ya calculado — sin recalcular ninguno de los
 * dos motores.
 *
 * - Parte A: canonical-e13-scenarios.js — categoryId pasa por normalizeEvent, no afecta simulate().
 * - Parte B: e13EventCoversMonth / budgetScenarioImpactForMonth — cálculo real de cobertura.
 * - Parte C: presupuestoMesForecastHorizonsRowHtml — el impacto se suma y se anota en la fila.
 * - Parte D: wiring estático (formulario, VIEW_CHUNKS).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarios = require("../canonical-e13-scenarios.js");
const engine = require("../canonical-engine.js");
const forecastContract = require("../canonical-forecast.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const htmlSrc = read("index.html");
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

function forecastFixture() {
  const input = {
    openingBalances: { checking: 2000, savings: 1000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 200, autoCapSavings: true },
    months: [
      { month: "ago 26", monthKey: "2026-08", income: 2500, coreSpend: 1600, car: 100, refi: 200 },
      { month: "sep 26", monthKey: "2026-09", income: 2500, coreSpend: 1600, car: 100, refi: 200 },
    ],
  };
  const engineScenario = engine.buildScenario(input, null, { generatedAt: "2026-08-02T10:00:00.000Z" });
  return forecastContract.buildForecast(input, engineScenario, {}, { generatedAt: "2026-08-02T10:00:00.000Z" });
}

// ============================================================================
// Parte A: canonical-e13-scenarios.js — categoryId es metadato, no toca el cálculo
// ============================================================================

test("FCST-2 · normalizeEvent conserva categoryId; por defecto vacío (retrocompatible)", () => {
  const withCategory = scenarios.normalizeEvent({ type: "car", monthKey: "2026-09", amount: 150, categoryId: "coche" });
  assert.equal(withCategory.categoryId, "coche");
  const withoutCategory = scenarios.normalizeEvent({ type: "expense", monthKey: "2026-09", amount: 50 });
  assert.equal(withoutCategory.categoryId, "");
});

test("FCST-2 · categoryId no cambia el resultado de la simulación de caja", () => {
  const forecast = forecastFixture();
  const labWithout = scenarios.buildLab(forecast, [{ id: "a", type: "car", monthKey: "2026-09", amount: 150, duration: 2 }]);
  const labWith = scenarios.buildLab(forecast, [{ id: "a", type: "car", monthKey: "2026-09", amount: 150, duration: 2, categoryId: "coche" }]);
  assert.deepEqual(
    labWith.scenarios.map((s) => s.metrics),
    labWithout.scenarios.map((s) => s.metrics),
  );
});

// ============================================================================
// Parte B: e13EventCoversMonth / budgetScenarioImpactForMonth — cálculo real
// ============================================================================

function impactSandbox(events) {
  const context = {
    e13ScenarioEvents: events,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("monthKey"),
      extractFunction("addMonths"),
      extractFunction("dateFromMonthKey"),
      extractFunction("e13EventCoversMonth"),
      extractFunction("budgetScenarioImpactForMonth"),
    ].join("\n"),
    context,
    { filename: "app.js#fcst2-impact" },
  );
  return context;
}

test("FCST-2 · un evento de 3 meses cubre su mes de inicio y los dos siguientes, no el cuarto", () => {
  const context = impactSandbox([]);
  const event = { monthKey: "2026-09", duration: 3 };
  assert.equal(context.e13EventCoversMonth(event, "2026-09"), true);
  assert.equal(context.e13EventCoversMonth(event, "2026-10"), true);
  assert.equal(context.e13EventCoversMonth(event, "2026-11"), true);
  assert.equal(context.e13EventCoversMonth(event, "2026-12"), false);
  assert.equal(context.e13EventCoversMonth(event, "2026-08"), false);
});

test("FCST-2 · budgetScenarioImpactForMonth suma solo eventos de esa categoría, activos ese mes y que no sean pérdida de ingreso", () => {
  const context = impactSandbox([
    { categoryId: "coche", type: "car", monthKey: "2026-09", duration: 3, amount: 100, label: "Coche" },
    { categoryId: "coche", type: "expense", monthKey: "2026-09", duration: 1, amount: 40, label: "Gasto extraordinario" },
    { categoryId: "comida", type: "expense", monthKey: "2026-09", duration: 3, amount: 999, label: "Gasto extraordinario" },
    { categoryId: "coche", type: "income-loss", monthKey: "2026-09", duration: 3, amount: 500, label: "Pérdida de ingreso" },
  ]);
  const impact = context.budgetScenarioImpactForMonth("coche", "2026-09");
  assert.ok(impact);
  assert.equal(impact.amount, 140);
  assert.match(impact.labels, /Coche/);
  assert.match(impact.labels, /Gasto extraordinario/);

  const impactNextMonth = context.budgetScenarioImpactForMonth("coche", "2026-10");
  assert.equal(impactNextMonth.amount, 100, "el gasto extraordinario de 1 mes ya no cubre octubre");
});

test("FCST-2 · sin eventos que coincidan, o sin categoría/mes, devuelve null", () => {
  const context = impactSandbox([{ categoryId: "comida", type: "expense", monthKey: "2026-09", duration: 1, amount: 50, label: "x" }]);
  assert.equal(context.budgetScenarioImpactForMonth("coche", "2026-09"), null);
  assert.equal(context.budgetScenarioImpactForMonth("", "2026-09"), null);
  assert.equal(context.budgetScenarioImpactForMonth("comida", ""), null);
});

test("FCST-2 · budgetScenarioImpactForMonth no revienta si e13ScenarioEvents no es un array", () => {
  const context = impactSandbox(undefined);
  assert.equal(context.budgetScenarioImpactForMonth("coche", "2026-09"), null);
});

// ============================================================================
// Parte C: presupuestoMesForecastHorizonsRowHtml — el impacto se refleja en la fila
// ============================================================================

function rowSandbox({ horizons, scenarioEvents = [], projection = { projected: 0, diff: 0 } }) {
  const context = {
    budgetForecastHorizons: () => horizons,
    budgetAlertForRow: () => ({ status: "on-track", metrics: { spent: 0, dayOfMonth: 1, daysInMonth: 30 } }),
    budgetProjection: () => projection,
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
      extractFunction("monthKey"),
      extractFunction("addMonths"),
      extractFunction("dateFromMonthKey"),
      extractFunction("budgetForecastConfidenceLabel"),
      extractFunction("e13EventCoversMonth"),
      extractFunction("budgetScenarioImpactForMonth"),
      extractFunction("presupuestoMesForecastHorizonsRowHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#fcst2-row" },
  );
  return context;
}

test("FCST-2 · sin eventos de escenario, la fila no cambia respecto a FCST-1", () => {
  const context = rowSandbox({
    horizons: { week: { predicted: 23, range: "±2", confidence: "high" }, threeMonthsOut: { predicted: 105, range: "±15", confidence: "medium" }, weekMonthKey: "2026-07", threeMonthsOutMonthKey: "2026-10" },
  });
  const html = context.presupuestoMesForecastHorizonsRowHtml({ categoryId: "coche" }, "2026-07");
  assert.doesNotMatch(html, /por escenario/);
  assert.match(html, /€23 <small class="note">±2, confianza alta<\/small>/);
  assert.match(html, /€105 <small class="note">±15, confianza media<\/small>/);
});

test("FCST-2 · un evento de escenario activo en el mes de +3 meses se suma al predicho y se anota", () => {
  const context = rowSandbox({
    horizons: { week: { predicted: 23, range: "±2", confidence: "high" }, threeMonthsOut: { predicted: 100, range: "±15", confidence: "medium" }, weekMonthKey: "2026-07", threeMonthsOutMonthKey: "2026-10" },
    scenarioEvents: [{ categoryId: "coche", type: "car", monthKey: "2026-09", duration: 3, amount: 60, label: "Coche" }],
  });
  const html = context.presupuestoMesForecastHorizonsRowHtml({ categoryId: "coche" }, "2026-07");
  assert.match(html, /€160 <small class="note">±15, confianza media<\/small>/, "100 predicho + 60 del evento");
  assert.match(html, /\+€60 por escenario «Coche»/);
});

test("FCST-2 · un evento activo en la semana (mes en curso) se prorratea a semanal (÷4,345) igual que el resto del horizonte", () => {
  const context = rowSandbox({
    horizons: { week: { predicted: 23, range: "±2", confidence: "high" }, threeMonthsOut: null, weekMonthKey: "2026-07", threeMonthsOutMonthKey: "2026-10" },
    scenarioEvents: [{ categoryId: "coche", type: "expense", monthKey: "2026-07", duration: 1, amount: 43.45, label: "Gasto extraordinario" }],
  });
  const html = context.presupuestoMesForecastHorizonsRowHtml({ categoryId: "coche" }, "2026-07");
  assert.match(html, /€33 <small class="note">±2, confianza alta<\/small>/, "23 + (43.45/4.345=10) = 33");
  assert.match(html, /\+€10 por escenario «Gasto extraordinario»/);
});

test("FCST-2 · una categoría distinta a la del evento no ve ningún impacto", () => {
  const context = rowSandbox({
    horizons: { week: { predicted: 23, range: "±2", confidence: "high" }, threeMonthsOut: { predicted: 105, range: "±15", confidence: "medium" }, weekMonthKey: "2026-07", threeMonthsOutMonthKey: "2026-10" },
    scenarioEvents: [{ categoryId: "coche", type: "car", monthKey: "2026-09", duration: 3, amount: 60, label: "Coche" }],
  });
  const html = context.presupuestoMesForecastHorizonsRowHtml({ categoryId: "comida" }, "2026-07");
  assert.doesNotMatch(html, /por escenario/);
});

// ============================================================================
// Parte D: wiring estático
// ============================================================================

test("FCST-2 · el formulario de eventos de Escenarios (E13) tiene un selector de categoría opcional", () => {
  assert.match(htmlSrc, /<select id="e13EventCategory"><option value="">Sin categoría \(solo caja\)<\/option><\/select>/);
});

test("FCST-2 · addE13ScenarioEvent lee la categoría del selector y la incluye en el evento", () => {
  assert.match(appSrc, /const categoryId = qs\("e13EventCategory"\)\?\.value \|\| "";/);
  assert.match(appSrc, /categoryId,\s*\}\];\s*\n\s*renderE13ScenarioLab\(\);\s*\n\}/);
});

test("FCST-2 · e13BudgetCategoryOptions existe y renderE13ScenarioLab rellena el selector", () => {
  assert.match(appSrc, /function e13BudgetCategoryOptions\(\)/);
  assert.match(appSrc, /categorySelect\.innerHTML = `<option value="">Sin categoría \(solo caja\)<\/option>\$\{categoryOptions\}`;/);
});

test("FCST-2 · normalizeEvent en canonical-e13-scenarios.js expone categoryId", () => {
  const src = read("canonical-e13-scenarios.js");
  assert.match(src, /categoryId: text\(raw\.categoryId \|\| ""\)/);
});
