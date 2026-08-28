/**
 * tests/bud3-presupuesto-anual-trimestral.test.cjs
 *
 * BUD-3 (FASE 7): presupuestos anuales/trimestrales, para gastos estacionales (seguros, impuestos)
 * que hoy aparecen como "sobregasto" puntual cuando se pagan de una vez dentro de un mes con
 * presupuesto mensual. Mismo mecanismo que BUD-1 (semanal): CanonicalBudgetAlerts ya acepta un rango
 * de fechas explícito, así que un año o un trimestre natural son solo otro periodo más — sin motor
 * nuevo.
 *
 * - Parte A: esquema (canonical-budget-schema.js) — rango de año/trimestre, validación, CRUD.
 * - Parte B: cadena real de cálculo en app.js (monthKeysInRange/budgetExpenseTransactionsForLongPeriod/
 *   budgetLongPeriodDateContext/budgetLongPeriodAlertForRow/budgetLongPeriodMonthlyShare) sobre
 *   transacciones sintéticas — incluye el caso central: un pago único de todo el año se mide contra
 *   el año completo, no como sobregasto de un mes.
 * - Parte C: wiring de la vista (views/presupuesto-mes.js) — tercera cadencia, toggle año/trimestre,
 *   navegación, tabla, altas/ediciones/bajas — con budgetLongPeriodAlertForRow/budgetWeekProjection/
 *   budgetableCategories mockeados (mismo patrón que BUD-1/INTEG-1).
 * - Parte D: wiring estático — listeners en app.js, exportación, versión.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { CanonicalBudgetSchema } = require("../canonical-budget-schema.js");
const { CanonicalBudgetAlerts } = require("../canonical-budget-alerts.js");

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
// Parte A: CanonicalBudgetSchema — año/trimestre y CRUD
// ============================================================================

test("BUD-3 · currentYearKey/annualRange", () => {
  assert.equal(CanonicalBudgetSchema.currentYearKey(new Date(2026, 7, 27)), "2026");
  assert.deepEqual(CanonicalBudgetSchema.annualRange("2026"), { start: "2026-01-01", end: "2026-12-31" });
  assert.equal(CanonicalBudgetSchema.annualRange("26"), null, "formato inválido");
});

test("BUD-3 · currentQuarterKey cubre los cuatro trimestres del año", () => {
  assert.equal(CanonicalBudgetSchema.currentQuarterKey(new Date(2026, 0, 15)), "2026-Q1");
  assert.equal(CanonicalBudgetSchema.currentQuarterKey(new Date(2026, 3, 1)), "2026-Q2");
  assert.equal(CanonicalBudgetSchema.currentQuarterKey(new Date(2026, 6, 31)), "2026-Q3");
  assert.equal(CanonicalBudgetSchema.currentQuarterKey(new Date(2026, 11, 31)), "2026-Q4");
});

test("BUD-3 · quarterRange: los cuatro trimestres naturales, con el último día de mes correcto", () => {
  assert.deepEqual(CanonicalBudgetSchema.quarterRange("2026-Q1"), { start: "2026-01-01", end: "2026-03-31" });
  assert.deepEqual(CanonicalBudgetSchema.quarterRange("2026-Q2"), { start: "2026-04-01", end: "2026-06-30" });
  assert.deepEqual(CanonicalBudgetSchema.quarterRange("2026-Q3"), { start: "2026-07-01", end: "2026-09-30" });
  assert.deepEqual(CanonicalBudgetSchema.quarterRange("2026-Q4"), { start: "2026-10-01", end: "2026-12-31" });
  assert.equal(CanonicalBudgetSchema.quarterRange("2026-Q5"), null, "trimestre inválido");
  assert.equal(CanonicalBudgetSchema.quarterRange("2026"), null, "sin trimestre no es válido");
});

test("BUD-3 · quarterRange respeta años bisiestos (Q1 2020 tiene 91 días, no 90)", () => {
  const range = CanonicalBudgetSchema.quarterRange("2020-Q1");
  assert.deepEqual(range, { start: "2020-01-01", end: "2020-03-31" });
});

test("BUD-3 · validate/create: presupuesto anual válido", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200, source: "manual" });
  assert.ok(budget);
  assert.equal(budget.period, "annual");
  assert.equal(budget.year, "2026");
  assert.equal(budget.monthYear, null);
  assert.equal(budget.weekKey, null);
  assert.equal(budget.quarterKey, null);
});

test("BUD-3 · validate/create: presupuesto trimestral válido", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q1", amountCap: 300, source: "manual" });
  assert.ok(budget);
  assert.equal(budget.period, "quarterly");
  assert.equal(budget.quarterKey, "2026-Q1");
  assert.equal(budget.year, null);
  assert.equal(budget.monthYear, null);
});

test("BUD-3 · validate rechaza year/quarterKey con formato inválido", () => {
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "seguros", period: "annual", year: "26", amountCap: 100 }), null);
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "seguros", period: "annual", amountCap: 100 }), null, "sin year");
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q9", amountCap: 100 }), null);
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "impuestos", period: "quarterly", amountCap: 100 }), null, "sin quarterKey");
});

test("BUD-3 · findForYear/findForCategoryYear/byCategoryYear excluyen otras cadencias", () => {
  const budgets = [
    CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 }),
    CanonicalBudgetSchema.create({ categoryId: "ocio", period: "annual", year: "2027", amountCap: 500 }), // otro año
    CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 }), // mensual
  ];
  assert.equal(CanonicalBudgetSchema.findForYear(budgets, "2026").length, 1);
  assert.equal(CanonicalBudgetSchema.findForCategoryYear(budgets, "seguros", "2026").amountCap, 1200);
  assert.equal(CanonicalBudgetSchema.findForCategoryYear(budgets, "comida", "2026"), undefined);
  assert.deepEqual(CanonicalBudgetSchema.byCategoryYear(budgets, "2026"), { seguros: 1200 });
});

test("BUD-3 · findForQuarter/findForCategoryQuarter/byCategoryQuarter excluyen otras cadencias", () => {
  const budgets = [
    CanonicalBudgetSchema.create({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q1", amountCap: 300 }),
    CanonicalBudgetSchema.create({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q2", amountCap: 300 }),
    CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 }),
  ];
  assert.equal(CanonicalBudgetSchema.findForQuarter(budgets, "2026-Q1").length, 1);
  assert.equal(CanonicalBudgetSchema.findForCategoryQuarter(budgets, "impuestos", "2026-Q2").amountCap, 300);
  assert.deepEqual(CanonicalBudgetSchema.byCategoryQuarter(budgets, "2026-Q1"), { impuestos: 300 });
});

test("BUD-3 · upsert distingue año de trimestre (misma categoría, sin chocar entre sí)", () => {
  let budgets = [];
  budgets = CanonicalBudgetSchema.upsert(budgets, { categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 });
  budgets = CanonicalBudgetSchema.upsert(budgets, { categoryId: "seguros", period: "quarterly", quarterKey: "2026-Q1", amountCap: 300 });
  assert.equal(budgets.length, 2, "año y trimestre de la misma categoría son dos presupuestos distintos");
  budgets = CanonicalBudgetSchema.upsert(budgets, { categoryId: "seguros", period: "annual", year: "2026", amountCap: 1300 });
  assert.equal(budgets.length, 2, "reemplaza el anual existente en vez de duplicarlo");
  assert.equal(CanonicalBudgetSchema.findForCategoryYear(budgets, "seguros", "2026").amountCap, 1300);
});

test("BUD-3 · delete admite period \"annual\"/\"quarterly\"", () => {
  let budgets = [
    CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 }),
    CanonicalBudgetSchema.create({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q1", amountCap: 300 }),
  ];
  budgets = CanonicalBudgetSchema.delete(budgets, "seguros", "2026", "annual");
  assert.equal(budgets.length, 1);
  budgets = CanonicalBudgetSchema.delete(budgets, "impuestos", "2026-Q1", "quarterly");
  assert.equal(budgets.length, 0);
});

// ============================================================================
// Parte B: cadena real de cálculo (app.js)
// ============================================================================

function computationSandbox(transactions, { manualByMonth = {} } = {}) {
  const context = {
    baseData: { transactions },
    window: {
      FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema },
      FinanceCanonicalBudgetAlerts: { CanonicalBudgetAlerts },
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    syntheticManualMovements: (categoryId, monthKeys) =>
      monthKeys.filter((mk) => manualByMonth[mk] > 0).map((mk) => ({ date: `${mk}-01`, amount: -manualByMonth[mk] })),
    budgetGoalContributionMovements: () => [],
  };
  vm.createContext(context);
  vm.runInContext(
    [
      "var budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
      extractFunction("budgetNegativeTransactionsByCategory"),
      extractFunction("currentBudgetYearKey"),
      extractFunction("currentBudgetQuarterKey"),
      extractFunction("currentBudgetLongPeriodKey"),
      extractFunction("budgetLongPeriodRange"),
      extractFunction("monthKeysInRange"),
      extractFunction("budgetExpenseTransactionsForLongPeriod"),
      extractFunction("budgetLongPeriodDateContext"),
      'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
      extractFunction("isGoalBudgetCategoryId"),
      extractFunction("goalIdFromBudgetCategoryId"),
      extractFunction("budgetLongPeriodAlertForRow"),
      extractFunction("budgetWeekProjection"),
      extractFunction("budgetLongPeriodMonthlyShare"),
    ].join("\n"),
    context,
    { filename: "app.js#bud3-computation" },
  );
  return context;
}

test("BUD-3 · monthKeysInRange: un año completo da los 12 meses en orden", () => {
  const context = computationSandbox([]);
  assert.deepEqual(Array.from(context.monthKeysInRange("2026-01-01", "2026-12-31")), [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
  ]);
});

test("BUD-3 · monthKeysInRange: un trimestre da solo sus 3 meses", () => {
  const context = computationSandbox([]);
  assert.deepEqual(Array.from(context.monthKeysInRange("2026-04-01", "2026-06-30")), ["2026-04", "2026-05", "2026-06"]);
});

test("BUD-3 · monthKeysInRange: cruzar el fin de año avanza el contador de año", () => {
  const context = computationSandbox([]);
  assert.deepEqual(Array.from(context.monthKeysInRange("2026-11-01", "2027-02-28")), ["2026-11", "2026-12", "2027-01", "2027-02"]);
});

test("BUD-3 · budgetExpenseTransactionsForLongPeriod (annual): solo cuenta gasto bancario dentro del año", () => {
  const context = computationSandbox([
    { date: "2025-12-31", amount: -999, category: "seguros" }, // fuera
    { date: "2026-01-01", amount: -10, category: "seguros" }, // dentro
    { date: "2026-12-31", amount: -20, category: "seguros" }, // dentro
    { date: "2027-01-01", amount: -999, category: "seguros" }, // fuera
    { date: "2026-06-01", amount: -50, category: "ocio" }, // otra categoría, fuera
  ]);
  const rows = context.budgetExpenseTransactionsForLongPeriod("seguros", "annual", "2026");
  assert.deepEqual(Array.from(rows, (r) => r.date).sort(), ["2026-01-01", "2026-12-31"]);
});

test("BUD-3 · budgetExpenseTransactionsForLongPeriod (quarterly): solo cuenta gasto bancario dentro del trimestre", () => {
  const context = computationSandbox([
    { date: "2026-01-01", amount: -30, category: "impuestos" }, // Q1, dentro
    { date: "2026-03-31", amount: -50, category: "impuestos" }, // Q1, dentro
    { date: "2026-04-01", amount: -999, category: "impuestos" }, // Q2, fuera
  ]);
  const rows = context.budgetExpenseTransactionsForLongPeriod("impuestos", "quarterly", "2026-Q1");
  assert.deepEqual(Array.from(rows, (r) => r.date).sort(), ["2026-01-01", "2026-03-31"]);
});

test("BUD-3 · budgetLongPeriodDateContext: un año ya cerrado se trata como completo (unitIndex = unitsInPeriod)", () => {
  const context = computationSandbox([]);
  const ctx = context.budgetLongPeriodDateContext("annual", "2020");
  assert.equal(ctx.unitsInPeriod, 366, "2020 es bisiesto");
  assert.equal(ctx.unitIndex, 366);
  assert.equal(ctx.periodStart, "2020-01-01");
  assert.equal(ctx.periodEnd, "2020-12-31");
});

test("BUD-3 · budgetLongPeriodDateContext: un trimestre ya cerrado se trata como completo", () => {
  const context = computationSandbox([]);
  const ctx = context.budgetLongPeriodDateContext("quarterly", "2020-Q1"); // ene-mar 2020 (bisiesto): 31+29+31=91
  assert.equal(ctx.unitsInPeriod, 91);
  assert.equal(ctx.unitIndex, 91);
});

test("BUD-3 · budgetLongPeriodDateContext: el año en curso sitúa \"hoy\" dentro del rango real", () => {
  const context = computationSandbox([]);
  const year = CanonicalBudgetSchema.currentYearKey();
  const ctx = context.budgetLongPeriodDateContext("annual", year);
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const expectedUnitIndex = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - startOfYear) / 86400000) + 1;
  assert.equal(ctx.unitIndex, expectedUnitIndex);
  assert.ok(ctx.unitIndex >= 1 && ctx.unitIndex <= ctx.unitsInPeriod);
});

test("BUD-3 · caso central: un pago único de todo el año se mide contra el año completo, no como sobregasto de un mes", () => {
  // Seguro anual de 1200€ pagado de una vez en marzo — hoy, contra un presupuesto MENSUAL, esto se
  // vería como un sobregasto disparatado ese mes y "sin gasto" el resto. Contra el año COMPLETO
  // (ya cerrado, así que el ritmo esperado es el total), es exactamente el presupuesto: en ritmo.
  const context = computationSandbox([{ date: "2020-03-15", amount: -1200, category: "seguros" }]);
  const alert = context.budgetLongPeriodAlertForRow({ categoryId: "seguros", amountCap: 1200 }, "annual", "2020");
  assert.equal(alert.metrics.spent, 1200);
  assert.equal(alert.status, "on-track");
});

test("BUD-3 · budgetLongPeriodAlertForRow suma también las partidas registradas a mano de cada mes del periodo", () => {
  const context = computationSandbox([], { manualByMonth: { "2020-03": 400, "2020-07": 100 } });
  const alert = context.budgetLongPeriodAlertForRow({ categoryId: "seguros", amountCap: 1200 }, "annual", "2020");
  assert.equal(alert.metrics.spent, 500);
});

test("BUD-3 · budgetLongPeriodAlertForRow combina gasto bancario y partidas a mano sin duplicar", () => {
  const context = computationSandbox([{ date: "2020-01-10", amount: -200, category: "seguros" }], { manualByMonth: { "2020-06": 300 } });
  const alert = context.budgetLongPeriodAlertForRow({ categoryId: "seguros", amountCap: 1200 }, "annual", "2020");
  assert.equal(alert.metrics.spent, 500);
});

test("BUD-3 · budgetLongPeriodAlertForRow: un categoryId de objetivo delega en budgetGoalContributionMovements", () => {
  const context = computationSandbox([{ date: "2020-01-01", amount: -999, category: "goal:g1" }]);
  let askedFor = null;
  context.budgetGoalContributionMovements = (goalId) => {
    askedFor = goalId;
    return [{ date: "2020-06-01", amount: -300 }];
  };
  const alert = context.budgetLongPeriodAlertForRow({ categoryId: "goal:g1", amountCap: 300 }, "annual", "2020");
  assert.equal(askedFor, "g1");
  assert.equal(alert.metrics.spent, 300, "usa la contribución del objetivo, no el movimiento bancario de -999");
});

test("BUD-3 · budgetLongPeriodMonthlyShare: reparto informativo a 12 o 3 meses", () => {
  const context = computationSandbox([]);
  assert.equal(context.budgetLongPeriodMonthlyShare(1200, "annual"), 100);
  assert.equal(context.budgetLongPeriodMonthlyShare(300, "quarterly"), 100);
});

// ============================================================================
// Parte C: wiring de la vista — tercera cadencia
// ============================================================================

function viewSandbox({ budgetsData = [], alert = null, projection = null, categories = [] } = {}) {
  const saved = [];
  const rendered = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    saveBudgets: () => saved.push([...context.budgets]),
    renderPresupuestoMes: () => rendered.push(true),
    budgetLongPeriodAlertForRow: () => alert || { status: "on-track", metrics: { spent: 0, dayOfMonth: 1, daysInMonth: 365 } },
    budgetWeekProjection: () => projection || { projected: 0, diff: 0 },
    budgetableCategories: () => categories,
    budgetRowDisplayLabel: (id) => id,
    money: (v) => `€${v}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      'var presupuestoMesLongPeriodType = "annual";',
      "var presupuestoMesActiveLongPeriodKey = null;",
      extractFunction("currentBudgetYearKey"),
      extractFunction("currentBudgetQuarterKey"),
      extractFunction("currentBudgetLongPeriodKey"),
      extractFunction("currentPresupuestoMesLongPeriodKey"),
      extractFunction("handlePresupuestoMesLongPeriodTypeChange"),
      extractFunction("shiftPresupuestoMesLongPeriod"),
      extractFunction("budgetLongPeriodLabel"),
      extractFunction("escapeHtml"),
      extractFunction("presupuestoMesStatusPill"),
      extractFunction("budgetLongPeriodMonthlyShare"),
      extractFunction("handleLongPeriodBudgetAmountChange"),
      extractFunction("handleRemoveLongPeriodBudget"),
      extractFunction("handleAddLongPeriodBudget"),
      extractFunction("presupuestoLargoRowHtml"),
      extractFunction("presupuestoLargoAddRowHtml"),
      extractFunction("presupuestoLargoHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#bud3-view" },
  );
  return { context, saved, rendered };
}

test("BUD-3 · currentPresupuestoMesLongPeriodKey usa el año en curso la primera vez", () => {
  const { context } = viewSandbox({});
  assert.equal(context.currentPresupuestoMesLongPeriodKey(), CanonicalBudgetSchema.currentYearKey());
});

test("BUD-3 · handlePresupuestoMesLongPeriodTypeChange cambia de tipo y reinicia la clave activa", () => {
  const { context, rendered } = viewSandbox({});
  context.shiftPresupuestoMesLongPeriod(1); // aleja la clave activa del año/trimestre en curso
  context.handlePresupuestoMesLongPeriodTypeChange("quarterly");
  assert.equal(context.presupuestoMesLongPeriodType, "quarterly");
  assert.equal(context.presupuestoMesActiveLongPeriodKey, CanonicalBudgetSchema.currentQuarterKey());
  assert.ok(rendered.length >= 2);
});

test("BUD-3 · handlePresupuestoMesLongPeriodTypeChange ignora un tipo desconocido", () => {
  const { context, rendered } = viewSandbox({});
  context.handlePresupuestoMesLongPeriodTypeChange("mensual");
  assert.equal(context.presupuestoMesLongPeriodType, "annual");
  assert.equal(rendered.length, 0);
});

test("BUD-3 · shiftPresupuestoMesLongPeriod (annual): avanza y retrocede años", () => {
  const { context } = viewSandbox({});
  const startYear = Number(context.currentPresupuestoMesLongPeriodKey());
  context.shiftPresupuestoMesLongPeriod(1);
  assert.equal(context.presupuestoMesActiveLongPeriodKey, `${startYear + 1}`);
  context.shiftPresupuestoMesLongPeriod(-2);
  assert.equal(context.presupuestoMesActiveLongPeriodKey, `${startYear - 1}`);
});

test("BUD-3 · shiftPresupuestoMesLongPeriod (quarterly): Q4 avanza a Q1 del año siguiente y viceversa", () => {
  const { context } = viewSandbox({});
  context.presupuestoMesLongPeriodType = "quarterly";
  context.presupuestoMesActiveLongPeriodKey = "2026-Q4";
  context.shiftPresupuestoMesLongPeriod(1);
  assert.equal(context.presupuestoMesActiveLongPeriodKey, "2027-Q1");
  context.shiftPresupuestoMesLongPeriod(-1);
  assert.equal(context.presupuestoMesActiveLongPeriodKey, "2026-Q4");
  context.shiftPresupuestoMesLongPeriod(-5);
  assert.equal(context.presupuestoMesActiveLongPeriodKey, "2025-Q3");
});

test("BUD-3 · budgetLongPeriodLabel: anual es literal, trimestral incluye el rango de fechas", () => {
  const { context } = viewSandbox({});
  assert.equal(context.budgetLongPeriodLabel("annual", "2026"), "Año 2026");
  const label = context.budgetLongPeriodLabel("quarterly", "2026-Q1");
  assert.match(label, /2026-Q1/);
  assert.match(label, /1 ene/);
  assert.match(label, /31 mar/);
});

test("BUD-3 · handleLongPeriodBudgetAmountChange crea/actualiza un presupuesto anual válido", () => {
  const { context, saved } = viewSandbox({});
  context.handleLongPeriodBudgetAmountChange({
    dataset: { presupuestoLargoCategory: "seguros", presupuestoLargoType: "annual", presupuestoLargoKey: "2026" },
    value: "1200",
  });
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].year, "2026");
  assert.equal(context.budgets[0].period, "annual");
  assert.equal(saved.length, 1);
});

test("BUD-3 · handleLongPeriodBudgetAmountChange con un importe inválido no toca budgets[]", () => {
  const { context, saved } = viewSandbox({});
  context.handleLongPeriodBudgetAmountChange({
    dataset: { presupuestoLargoCategory: "seguros", presupuestoLargoType: "annual", presupuestoLargoKey: "2026" },
    value: "0",
  });
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 0);
});

test("BUD-3 · handleAddLongPeriodBudget lee categoría e importe de la fila y crea un presupuesto trimestral", () => {
  const { context, saved } = viewSandbox({});
  const row = { querySelector: (sel) => (sel.includes("new-category") ? { value: "impuestos" } : { value: "300" }) };
  context.handleAddLongPeriodBudget({
    dataset: { presupuestoLargoAddType: "quarterly", presupuestoLargoAddKey: "2026-Q1" },
    closest: () => row,
  });
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].quarterKey, "2026-Q1");
  assert.equal(context.budgets[0].period, "quarterly");
  assert.equal(saved.length, 1);
});

test("BUD-3 · handleRemoveLongPeriodBudget quita exactamente el presupuesto indicado", () => {
  const existing = CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 });
  const other = CanonicalBudgetSchema.create({ categoryId: "impuestos", period: "quarterly", quarterKey: "2026-Q1", amountCap: 300 });
  const { context, saved } = viewSandbox({ budgetsData: [existing, other] });
  context.handleRemoveLongPeriodBudget("seguros", "annual", "2026");
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].categoryId, "impuestos", "el trimestral no se toca");
  assert.equal(saved.length, 1);
});

test("BUD-3 · presupuestoLargoRowHtml pinta importe, ritmo, estado y el reparto mensual informativo", () => {
  const { context } = viewSandbox({
    alert: { status: "overspend", metrics: { spent: 900, dayOfMonth: 180, daysInMonth: 365 } },
    projection: { projected: 1800, diff: 600 },
  });
  const html = context.presupuestoLargoRowHtml({ categoryId: "seguros", amountCap: 1200 }, "annual", "2026");
  assert.match(html, /data-presupuesto-largo-category="seguros"/);
  assert.match(html, /data-presupuesto-largo-type="annual"/);
  assert.match(html, /data-presupuesto-largo-key="2026"/);
  assert.match(html, /€900/);
  assert.match(html, /Por encima del ritmo/);
  assert.match(html, /≈€100\/mes/, "1200€/12 = 100€/mes de reparto informativo");
  assert.match(html, /data-presupuesto-largo-remove="seguros"/);
  assert.match(html, /data-presupuesto-largo-remove-type="annual"/);
  assert.match(html, /data-presupuesto-largo-remove-key="2026"/);
});

test("BUD-3 · presupuestoLargoAddRowHtml ofrece solo categorías todavía no presupuestadas ese periodo", () => {
  const already = CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 });
  const { context } = viewSandbox({ budgetsData: [already], categories: ["seguros", "impuestos"] });
  const html = context.presupuestoLargoAddRowHtml("annual", "2026");
  assert.doesNotMatch(html, /<option value="seguros">/);
  assert.match(html, /<option value="impuestos">/);
  assert.match(html, /data-presupuesto-largo-add-type="annual"/);
  assert.match(html, /data-presupuesto-largo-add-key="2026"/);
});

test("BUD-3 · presupuestoLargoAddRowHtml no pinta nada si ya no quedan categorías disponibles", () => {
  const already = CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 });
  const { context } = viewSandbox({ budgetsData: [already], categories: ["seguros"] });
  assert.equal(context.presupuestoLargoAddRowHtml("annual", "2026"), "");
});

test("BUD-3 · presupuestoLargoHtml: sin presupuestos, dice explícitamente que no hay para ese periodo", () => {
  const { context } = viewSandbox({});
  const html = context.presupuestoLargoHtml();
  assert.match(html, /Todavía no hay presupuestos anuales/);
});

test("BUD-3 · presupuestoLargoHtml: el toggle año/trimestre refleja el tipo activo", () => {
  const { context } = viewSandbox({});
  context.presupuestoMesLongPeriodType = "quarterly";
  context.presupuestoMesActiveLongPeriodKey = "2026-Q1";
  const html = context.presupuestoLargoHtml();
  assert.match(html, /data-presupuesto-largo-type-toggle="quarterly" aria-pressed="true"/);
  assert.match(html, /data-presupuesto-largo-type-toggle="annual" aria-pressed="false"/);
  assert.match(html, /Todavía no hay presupuestos trimestrales/);
});

test("BUD-3 · presupuestoLargoHtml pinta una fila por presupuesto del periodo activo", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "seguros", period: "annual", year: "2026", amountCap: 1200 });
  const { context } = viewSandbox({ budgetsData: [budget], categories: ["seguros", "impuestos"] });
  context.presupuestoMesActiveLongPeriodKey = "2026";
  const html = context.presupuestoLargoHtml();
  assert.match(html, /data-presupuesto-largo-category="seguros"/);
  assert.match(html, /<option value="impuestos">/, "la fila de alta sigue ofreciendo la categoría todavía libre");
});

// ============================================================================
// Parte D: wiring estático
// ============================================================================

test("BUD-3 · la tercera cadencia está registrada en el toggle y en renderPresupuestoMes", () => {
  assert.match(viewSrc, /data-presupuesto-mes-cadence="longperiod"/);
  assert.match(viewSrc, /if \(presupuestoMesCadence === "longperiod"\)/);
});

test("BUD-3 · el listener de click de Presupuesto del mes conecta los controles anuales/trimestrales", () => {
  assert.match(appSrc, /data-presupuesto-largo-type-toggle\]/);
  assert.match(appSrc, /data-presupuesto-largo-prev\]/);
  assert.match(appSrc, /data-presupuesto-largo-next\]/);
  assert.match(appSrc, /data-presupuesto-largo-add\]/);
  assert.match(appSrc, /data-presupuesto-largo-remove\]/);
  assert.match(appSrc, /handleAddLongPeriodBudget\(longPeriodAddButton\)/);
  assert.match(appSrc, /handleRemoveLongPeriodBudget\(/);
});

test("BUD-3 · el listener de change conecta la edición inline anual/trimestral", () => {
  assert.match(appSrc, /data-presupuesto-largo-category\]/);
  assert.match(appSrc, /handleLongPeriodBudgetAmountChange\(longPeriodInput\)/);
});

test("BUD-3 · versión del chunk de Presupuesto del mes y de app.js actualizadas", () => {
  assert.match(appSrc, /views\/presupuesto-mes\.js\?v=20260828a1/);
  const html = read("index.html");
  assert.match(html, /<script src="app\.js\?v=20260828d1a1"><\/script>/);
});

test("BUD-3 · budgetsExportRows exporta presupuestos anuales/trimestrales con su propia clave de periodo", () => {
  const context = {
    budgets: [
      { categoryId: "seguros", period: "annual", year: "2026", monthYear: null, weekKey: null, quarterKey: null, amountCap: 1200, source: "manual", currency: "EUR" },
    ],
    budgetLongPeriodAlertForRow: (budget, periodType, periodKey) => {
      assert.equal(periodType, "annual");
      assert.equal(periodKey, "2026");
      return { metrics: { spent: 1200, deviationPercent: 0 }, status: "on-track" };
    },
    budgetAlertForRow: () => { throw new Error("no debería usarse para un presupuesto anual"); },
    budgetWeekAlertForRow: () => { throw new Error("no debería usarse para un presupuesto anual"); },
    budgetRowDisplayLabel: (id) => id,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("budgetExportPeriodKey"), extractFunction("budgetsExportRows")].join("\n"),
    context,
    { filename: "app.js#bud3-export" },
  );
  const [row] = context.budgetsExportRows();
  assert.equal(row.mes, "2026");
  assert.equal(row.gastado, 1200);
});
