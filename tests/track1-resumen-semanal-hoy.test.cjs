/**
 * tests/track1-resumen-semanal-hoy.test.cjs
 *
 * TRACK-1 (FASE 7): "Presupuesto del mes" en Hoy (U-2) solo tenía lectura mensual. Añade el ritmo
 * de la semana ISO en curso como una segunda línea dentro de la misma tarjeta — reutiliza
 * homeBudgetWeekSummary() (construida en TRACK-3) sin tocar la rejilla 2×2 ni añadir una tarjeta
 * nueva.
 *
 * - Parte A: homeBudgetWeekNoteSuffix (app.js) — formateo puro.
 * - Parte B: renderHomeBudgetGlance — la tarjeta "Presupuesto del mes" incorpora el sufijo semanal
 *   en las dos ramas (con y sin presupuestos mensuales), motores mockeados en el límite.
 * - Parte C: wiring estático — la llamada a homeBudgetWeekSummary() vive dentro de
 *   renderHomeBudgetGlance y la versión de app.js está actualizada.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");

function extractFunction(name) {
  const start = appSrc.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = appSrc.indexOf("(", start); index < appSrc.length; index += 1) {
    if (appSrc[index] === "(") parenDepth += 1;
    else if (appSrc[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = appSrc.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSrc.length; index += 1) {
    if (appSrc[index] === "{") depth += 1;
    else if (appSrc[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSrc.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// ============================================================================
// Parte A: homeBudgetWeekNoteSuffix — formateo puro
// ============================================================================

function suffixSandbox() {
  const context = { money: (v) => `${v.toFixed(2)} €` };
  vm.createContext(context);
  vm.runInContext(extractFunction("homeBudgetWeekNoteSuffix"), context, { filename: "app.js#track1-suffix" });
  return context;
}

test("TRACK-1 · homeBudgetWeekNoteSuffix sin resumen semanal da cadena vacía", () => {
  const context = suffixSandbox();
  assert.equal(context.homeBudgetWeekNoteSuffix(null), "");
});

test("TRACK-1 · homeBudgetWeekNoteSuffix formatea gastado/presupuestado de la semana", () => {
  const context = suffixSandbox();
  const suffix = context.homeBudgetWeekNoteSuffix({ totalSpent: 25, totalBudgeted: 70 });
  assert.equal(suffix, " Esta semana: 25.00 € / 70.00 €.");
});

// ============================================================================
// Parte B: renderHomeBudgetGlance — la tarjeta "Presupuesto del mes" con sufijo semanal
// ============================================================================

function glanceSandbox({ monthlySummary = null, weeklySummary = null, goals = null } = {}) {
  const kpiCalls = [];
  const context = {
    qs: () => ({ innerHTML: "" }),
    homeBudgetSummary: () => monthlySummary,
    homeBudgetWeekSummary: () => weeklySummary,
    homeBudgetGoalsSummary: () => goals,
    money: (v) => `${Number(v).toFixed(2)} €`,
    renderHomeKpi: (opts) => {
      kpiCalls.push(opts);
      return `<article>${opts.label}</article>`;
    },
    renderHomeBudgetGlanceActions: () => "<article>Acciones</article>",
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("homeBudgetWeekNoteSuffix"), extractFunction("renderHomeBudgetGlance")].join("\n"),
    context,
    { filename: "app.js#track1-glance" },
  );
  return { context, kpiCalls };
}

test("TRACK-1 · con presupuestos mensuales y semanales, la nota incluye ambas lecturas", () => {
  const { context, kpiCalls } = glanceSandbox({
    monthlySummary: { count: 3, totalBudgeted: 300, totalSpent: 200, status: "good", worstMessage: "" },
    weeklySummary: { totalBudgeted: 70, totalSpent: 25, status: "good" },
  });
  context.renderHomeBudgetGlance({ total: 0, caixa: 0, mediolanum: 0 });
  const budgetCard = kpiCalls.find((c) => c.label === "Presupuesto del mes");
  assert.ok(budgetCard, "debe pintarse la tarjeta de presupuesto del mes");
  assert.match(budgetCard.note, /3 categorías con presupuesto, en ritmo\./);
  assert.match(budgetCard.note, /Esta semana: 25\.00 € \/ 70\.00 €\./);
});

test("TRACK-1 · sin resumen semanal (sin presupuestos semanales), la nota no cambia", () => {
  const { kpiCalls, context } = glanceSandbox({
    monthlySummary: { count: 1, totalBudgeted: 100, totalSpent: 50, status: "good", worstMessage: "" },
    weeklySummary: null,
  });
  context.renderHomeBudgetGlance({ total: 0, caixa: 0, mediolanum: 0 });
  const budgetCard = kpiCalls.find((c) => c.label === "Presupuesto del mes");
  assert.equal(budgetCard.note, "1 categoría con presupuesto, en ritmo.");
});

test("TRACK-1 · sin presupuestos mensuales pero con semanales, la rama \"Sin presupuestos\" también avisa del ritmo semanal", () => {
  const { kpiCalls, context } = glanceSandbox({
    monthlySummary: null,
    weeklySummary: { totalBudgeted: 40, totalSpent: 45, status: "warn" },
  });
  context.renderHomeBudgetGlance({ total: 0, caixa: 0, mediolanum: 0 });
  const budgetCard = kpiCalls.find((c) => c.label === "Presupuesto del mes");
  assert.equal(budgetCard.value, "Sin presupuestos");
  assert.match(budgetCard.note, /Aún no hay presupuestos para este mes\./);
  assert.match(budgetCard.note, /Esta semana: 45\.00 € \/ 40\.00 €\./);
});

test("TRACK-1 · sin presupuestos en ninguna cadencia, la nota se queda como antes", () => {
  const { kpiCalls, context } = glanceSandbox({ monthlySummary: null, weeklySummary: null });
  context.renderHomeBudgetGlance({ total: 0, caixa: 0, mediolanum: 0 });
  const budgetCard = kpiCalls.find((c) => c.label === "Presupuesto del mes");
  assert.equal(budgetCard.note, "Aún no hay presupuestos para este mes.");
});

test("TRACK-1 · el estado (status) de la tarjeta sigue dependiendo solo del resumen mensual", () => {
  const { kpiCalls, context } = glanceSandbox({
    monthlySummary: { count: 2, totalBudgeted: 200, totalSpent: 190, status: "good", worstMessage: "" },
    weeklySummary: { totalBudgeted: 50, totalSpent: 80, status: "danger" },
  });
  context.renderHomeBudgetGlance({ total: 0, caixa: 0, mediolanum: 0 });
  const budgetCard = kpiCalls.find((c) => c.label === "Presupuesto del mes");
  assert.equal(budgetCard.status, "good", "el aviso semanal es solo texto, no cambia el semáforo de la tarjeta mensual");
});

// ============================================================================
// Parte C: wiring estático
// ============================================================================

test("TRACK-1 · renderHomeBudgetGlance consulta homeBudgetWeekSummary()", () => {
  const glanceSrc = extractFunction("renderHomeBudgetGlance");
  assert.match(glanceSrc, /const weekSummary = homeBudgetWeekSummary\(\); \/\/ TRACK-1/);
  assert.match(glanceSrc, /homeBudgetWeekNoteSuffix\(weekSummary\)/g);
});

test("TRACK-1 · la versión de app.js está actualizada en index.html", () => {
  const html = read("index.html");
  assert.match(html, /<script defer src="app.js\?v=20260831h5"><\/script>/);
});
