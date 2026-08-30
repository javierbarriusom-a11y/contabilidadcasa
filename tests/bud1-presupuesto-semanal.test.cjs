/**
 * tests/bud1-presupuesto-semanal.test.cjs
 *
 * BUD-1 (FASE 7): periodicidad semanal en presupuestos.
 * - Parte A: esquema (canonical-budget-schema.js) — semanas ISO-8601, validación, CRUD period-aware.
 * - Parte B: alertas (canonical-budget-alerts.js) — calculateAlert generalizado a un periodo
 *   explícito, sin cambiar su comportamiento mensual por defecto (ya cubierto además por los 20
 *   tests existentes de tests/budget-core.test.cjs, que siguen en verde tal cual).
 * - Parte C: cadena real de cálculo semanal en app.js (budgetExpenseTransactionsForWeek/
 *   budgetWeekDateContext/budgetWeekAlertForRow/budgetWeekProjection) sobre transacciones sintéticas.
 * - Parte D: wiring de la vista (views/presupuesto-mes.js) — selector de cadencia, tabla semanal,
 *   altas/ediciones/bajas — con budgetWeekAlertForRow/budgetWeekProjection/budgetableCategories
 *   mockeados (mismo patrón que tests/integ1-exportar-presupuestos.test.cjs).
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
const app = read("app.js") + "\n" + read("views/presupuesto-mes.js");

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
// Parte A: CanonicalBudgetSchema — semanas ISO-8601 y CRUD period-aware
// ============================================================================

test("BUD-1 · weekKeyFromDate: lunes y domingo de la misma semana comparten clave", () => {
  const monday = new Date(2026, 7, 24); // 24 de agosto de 2026 es lunes
  const sunday = new Date(2026, 7, 30);
  assert.equal(CanonicalBudgetSchema.weekKeyFromDate(monday), "2026-W35");
  assert.equal(CanonicalBudgetSchema.weekKeyFromDate(sunday), "2026-W35");
});

test("BUD-1 · weekKeyFromDate: una semana a caballo entre años usa el año ISO del jueves", () => {
  // 29 de diciembre de 2025 (lunes) — su jueves (1 de enero de 2026) decide que es la semana 1 de 2026.
  assert.equal(CanonicalBudgetSchema.weekKeyFromDate(new Date(2025, 11, 29)), "2026-W01");
  assert.equal(CanonicalBudgetSchema.weekKeyFromDate(new Date(2026, 0, 1)), "2026-W01");
});

test("BUD-1 · weekRange: devuelve lunes-domingo como fechas ISO, y null si la clave no es válida", () => {
  assert.deepEqual(CanonicalBudgetSchema.weekRange("2026-W35"), { start: "2026-08-24", end: "2026-08-30" });
  assert.equal(CanonicalBudgetSchema.weekRange("no-una-semana"), null);
  assert.equal(CanonicalBudgetSchema.weekRange("2026-W00"), null);
  // 2025 solo tiene 52 semanas ISO — W53 no debe aceptarse como si fuera válida.
  assert.equal(CanonicalBudgetSchema.weekRange("2025-W53"), null);
  // 2026 sí tiene 53 semanas ISO.
  assert.ok(CanonicalBudgetSchema.weekRange("2026-W53"));
});

test("BUD-1 · monthYearForWeek: agrupa por el mes del jueves de la semana", () => {
  assert.equal(CanonicalBudgetSchema.monthYearForWeek("2026-W35"), "2026-08");
  // Semana 2026-W01 (29 dic 2025 - 4 ene 2026): su jueves cae en enero de 2026.
  assert.equal(CanonicalBudgetSchema.monthYearForWeek("2026-W01"), "2026-01");
});

test("BUD-1 · validate: un presupuesto semanal exige weekKey válido", () => {
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "comida", period: "weekly", amountCap: 70 }), null);
  assert.equal(
    CanonicalBudgetSchema.validate({ categoryId: "comida", period: "weekly", weekKey: "no-valido", amountCap: 70 }),
    null,
  );
  const valid = CanonicalBudgetSchema.validate({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  assert.ok(valid);
  assert.equal(valid.period, "weekly");
  assert.equal(valid.weekKey, "2026-W35");
  assert.equal(valid.monthYear, "2026-08", "monthYear se deriva de la semana si no se da");
});

test("BUD-1 · validate: un presupuesto semanal puede fijar su monthYear de agrupación explícitamente", () => {
  const valid = CanonicalBudgetSchema.validate({
    categoryId: "comida",
    period: "weekly",
    weekKey: "2026-W35",
    monthYear: "2026-09",
    amountCap: 70,
  });
  assert.equal(valid.monthYear, "2026-09");
});

test("BUD-1 · validate: sin period explícito se sigue tratando como mensual, comportamiento intacto", () => {
  const valid = CanonicalBudgetSchema.validate({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 });
  assert.equal(valid.period, "monthly");
  assert.equal(valid.weekKey, null);
});

test("BUD-1 · findForWeek/findForCategoryWeek/byCategoryWeek", () => {
  const b1 = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const b2 = CanonicalBudgetSchema.create({ categoryId: "ocio", period: "weekly", weekKey: "2026-W35", amountCap: 30 });
  const b3 = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W36", amountCap: 75 });
  const all = [b1, b2, b3];

  assert.deepEqual(
    CanonicalBudgetSchema.findForWeek(all, "2026-W35").map((b) => b.categoryId).sort(),
    ["comida", "ocio"],
  );
  assert.equal(CanonicalBudgetSchema.findForCategoryWeek(all, "comida", "2026-W36").amountCap, 75);
  assert.equal(CanonicalBudgetSchema.findForCategoryWeek(all, "comida", "2026-W99"), undefined);
  assert.deepEqual(CanonicalBudgetSchema.byCategoryWeek(all, "2026-W35"), { comida: 70, ocio: 30 });
});

test("BUD-1 · un presupuesto semanal nunca aparece en las búsquedas mensuales, aunque su mes derivado coincida", () => {
  const weekly = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const monthly = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 150 });
  const all = [weekly, monthly];

  assert.equal(weekly.monthYear, "2026-08", "precondición: el mes derivado de la semana coincide con el mensual de prueba");
  assert.equal(CanonicalBudgetSchema.findForCategoryMonth(all, "comida", "2026-08"), undefined);
  assert.deepEqual(CanonicalBudgetSchema.findForMonth(all, "2026-08").map((b) => b.categoryId), ["ocio"]);
  assert.deepEqual(CanonicalBudgetSchema.byCategory(all, "2026-08"), { ocio: 150 });
});

test("BUD-1 · upsert semanal: reemplaza por categoría+semana, no colisiona con presupuestos mensuales", () => {
  let budgets = [CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 })];
  budgets = CanonicalBudgetSchema.upsert(budgets, { categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  assert.equal(budgets.length, 2, "el semanal se añade sin tocar el mensual existente");

  budgets = CanonicalBudgetSchema.upsert(budgets, { categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 80 });
  assert.equal(budgets.length, 2, "la segunda vez reemplaza el semanal, no lo duplica");
  assert.equal(CanonicalBudgetSchema.findForCategoryWeek(budgets, "comida", "2026-W35").amountCap, 80);
  assert.equal(CanonicalBudgetSchema.findForCategoryMonth(budgets, "comida", "2026-08").amountCap, 300, "el mensual sigue intacto");
});

test("BUD-1 · delete: la firma de 3 argumentos (retrocompatible) solo borra presupuestos mensuales", () => {
  const weekly = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const monthly = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 });
  let budgets = [weekly, monthly];

  budgets = CanonicalBudgetSchema.delete(budgets, "comida", "2026-08"); // sin 4º argumento, como en todo el código existente
  assert.deepEqual(budgets.map((b) => b.id), [weekly.id], "solo desaparece el mensual");
});

test("BUD-1 · delete: con period=\"weekly\" borra el semanal por categoría+semana", () => {
  const weekly = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const monthly = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 });
  let budgets = [weekly, monthly];

  budgets = CanonicalBudgetSchema.delete(budgets, "comida", "2026-W35", "weekly");
  assert.deepEqual(budgets.map((b) => b.id), [monthly.id]);
});

// ============================================================================
// Parte B: CanonicalBudgetAlerts.calculateAlert generalizado a un periodo explícito
// ============================================================================

test("BUD-1 · calculateAlert con periodo explícito: on-track en una semana de 7 unidades", () => {
  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 70, // 10€/día
    movements: [
      { date: "2026-08-24", amount: -10 },
      { date: "2026-08-25", amount: -10 },
      { date: "2026-08-26", amount: -10 },
      { date: "2026-09-01", amount: -999 }, // fuera del rango: no debe contar
    ],
    stdDev: 0,
    dateContext: { today: new Date(2026, 7, 26), periodStart: "2026-08-24", periodEnd: "2026-08-30", unitsInPeriod: 7, unitIndex: 3 },
  });
  assert.equal(alert.metrics.spent, 30);
  assert.equal(alert.metrics.expectedAccumulated, 30);
  assert.equal(alert.status, "on-track");
});

test("BUD-1 · calculateAlert con periodo explícito: overspend si se dispara por encima del ritmo semanal", () => {
  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 70,
    movements: [{ date: "2026-08-24", amount: -50 }],
    stdDev: 0,
    dateContext: { today: new Date(2026, 7, 25), periodStart: "2026-08-24", periodEnd: "2026-08-30", unitsInPeriod: 7, unitIndex: 2 },
  });
  assert.equal(alert.status, "overspend");
});

test("BUD-1 · calculateAlert: sin periodo explícito, el comportamiento mensual original no cambia", () => {
  const today = new Date(2026, 7, 15);
  const movements = [{ date: "2026-08-01", amount: -75 }, { date: "2026-08-10", amount: -75 }];
  const alert = CanonicalBudgetAlerts.calculateAlert({ budgetAmount: 300, movements, stdDev: 20, dateContext: { today, daysInMonth: 31 } });
  assert.equal(alert.status, "on-track");
  assert.equal(alert.metrics.dayOfMonth, 15);
  assert.equal(alert.metrics.daysInMonth, 31);
});

// ============================================================================
// Parte C: cadena real de cálculo semanal en app.js, sobre transacciones sintéticas
// ============================================================================

function computationSandbox(transactions) {
  const context = {
    baseData: { transactions },
    window: {
      FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema },
      FinanceCanonicalBudgetAlerts: { CanonicalBudgetAlerts },
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      "var budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
      extractFunction("budgetNegativeTransactionsByCategory"),
      extractFunction("currentBudgetWeekKey"),
      extractFunction("budgetExpenseTransactionsForWeek"),
      extractFunction("budgetWeekDateContext"),
      // BUD-2: budgetWeekAlertForRow ahora comprueba isGoalBudgetCategoryId antes de decidir cómo
      // calcular "gastado"; ninguno de estos tests usa presupuestos de objetivos, pero la función
      // debe existir para que la rama category-only no lance ReferenceError.
      'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
      extractFunction("isGoalBudgetCategoryId"),
      extractFunction("budgetWeekAlertForRow"),
      extractFunction("budgetWeekProjection"),
    ].join("\n"),
    context,
    { filename: "app.js#bud1-computation" },
  );
  return context;
}

test("BUD-1 · budgetExpenseTransactionsForWeek: solo cuenta gasto bancario dentro del rango de la semana", () => {
  const context = computationSandbox([
    { date: "2026-08-23", amount: -999, category: "comida" }, // domingo anterior, fuera
    { date: "2026-08-24", amount: -10, category: "comida" }, // lunes, dentro
    { date: "2026-08-30", amount: -20, category: "comida" }, // domingo, dentro
    { date: "2026-08-31", amount: -999, category: "comida" }, // fuera
    { date: "2026-08-25", amount: -50, category: "ocio" }, // otra categoría, fuera
    { date: "2026-08-25", amount: 500, category: "comida" }, // ingreso (positivo), ya excluido por el índice
  ]);
  const rows = context.budgetExpenseTransactionsForWeek("comida", "2026-W35");
  assert.deepEqual(Array.from(rows, (r) => r.date).sort(), ["2026-08-24", "2026-08-30"]);
});

test("BUD-1 · budgetWeekAlertForRow/budgetWeekProjection: ritmo y proyección reales sobre una semana ya cerrada", () => {
  // Semana 2026-W20 (11-17 de mayo de 2026), claramente pasada respecto a la fecha de referencia del
  // proyecto (27 de agosto de 2026) — budgetWeekDateContext debe tratarla como semana completa
  // (unitIndex = 7) sin depender de la fecha real del sistema al ejecutar el test.
  const range = CanonicalBudgetSchema.weekRange("2026-W20");
  const context = computationSandbox([
    { date: range.start, amount: -20, category: "comida" },
    { date: range.end, amount: -20, category: "comida" },
  ]);
  const budget = { categoryId: "comida", amountCap: 70, period: "weekly", weekKey: "2026-W20" };
  const alert = context.budgetWeekAlertForRow(budget, "2026-W20");
  assert.equal(alert.metrics.spent, 40);
  assert.equal(alert.metrics.daysInMonth, 7, "unitsInPeriod expuesto con el nombre histórico daysInMonth");
  assert.equal(alert.metrics.dayOfMonth, 7, "semana ya cerrada: la unidad actual es la última (7)");
  const projection = context.budgetWeekProjection(alert);
  assert.equal(projection.projected, 40, "semana completa: la proyección coincide con lo gastado");
  assert.equal(projection.diff, -30);
});

test("BUD-1 · currentBudgetWeekKey delega en el esquema canónico", () => {
  const context = computationSandbox([]);
  assert.equal(context.currentBudgetWeekKey(new Date(2026, 7, 27)), "2026-W35");
});

// ============================================================================
// Parte D: wiring de la vista — cadencia, tabla semanal, altas/ediciones/bajas
// ============================================================================

function viewSandbox({ budgetsData = [], alert = null, projection = null, categories = [], goals = [] } = {}) {
  const saved = [];
  const rendered = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    saveBudgets: () => saved.push([...context.budgets]),
    renderPresupuestoMes: () => rendered.push(true),
    budgetWeekAlertForRow: () => alert || { status: "on-track", metrics: { spent: 0, dayOfMonth: 1, daysInMonth: 7 } },
    budgetWeekProjection: () => projection || { projected: 0, diff: 0 },
    budgetableCategories: () => categories,
    // BUD-2: p2State() mockeado — estos tests de BUD-1 no ejercitan objetivos, así que basta con
    // devolver la lista de fixtures (vacía por defecto) sin reconstruir scenarioSettings/P2Domain.
    p2State: () => ({ goals }),
    money: (v) => `€${v}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      // `var`, no `let`: en un contexto vm, un `let` de nivel superior no queda expuesto como
      // propiedad del objeto de contexto, así que este test no podría leerlo/fijarlo desde fuera.
      'var presupuestoMesCadence = "monthly";',
      "var presupuestoMesActiveWeekKey = null;",
      extractFunction("currentBudgetWeekKey"),
      extractFunction("currentPresupuestoMesWeekKey"),
      extractFunction("handlePresupuestoMesCadenceChange"),
      extractFunction("shiftPresupuestoMesWeek"),
      extractFunction("budgetWeekLabel"),
      extractFunction("escapeHtml"),
      extractFunction("presupuestoMesStatusPill"),
      extractFunction("handleWeekBudgetAmountChange"),
      extractFunction("handleRemoveWeekBudget"),
      extractFunction("handleAddWeekBudget"),
      // BUD-2: presupuestos ligados a objetivos — mismas filas/tabla, ahora también con la fila de
      // alta "Presupuestar objetivo" y la etiqueta legible en vez del `categoryId` en bruto.
      'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
      extractFunction("isGoalBudgetCategoryId"),
      extractFunction("goalIdFromBudgetCategoryId"),
      extractFunction("goalBudgetCategoryId"),
      extractFunction("goalNameById"),
      extractFunction("activeGoalsForBudget"),
      extractFunction("budgetRowDisplayLabel"),
      extractFunction("goalProposedMonthlyContribution"),
      extractFunction("presupuestoMesGoalOptionLabel"),
      extractFunction("presupuestoMesAddGoalRowHtml"),
      extractFunction("handleAddGoalBudget"),
      extractFunction("presupuestoMesWeekRowHtml"),
      extractFunction("presupuestoMesAddWeeklyRowHtml"),
      extractFunction("presupuestoMesWeeklyHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#bud1-view" },
  );
  return { context, saved, rendered };
}

test("BUD-1 · currentPresupuestoMesWeekKey se fija la primera vez y persiste hasta que se navega", () => {
  const { context } = viewSandbox({});
  const first = context.currentPresupuestoMesWeekKey();
  const second = context.currentPresupuestoMesWeekKey();
  assert.equal(first, second);
});

test("BUD-1 · shiftPresupuestoMesWeek avanza y retrocede semanas ISO completas", () => {
  const { context } = viewSandbox({});
  context.presupuestoMesActiveWeekKey = "2026-W35";
  context.shiftPresupuestoMesWeek(1);
  assert.equal(context.presupuestoMesActiveWeekKey, "2026-W36");
  context.shiftPresupuestoMesWeek(-2);
  assert.equal(context.presupuestoMesActiveWeekKey, "2026-W34");
});

test("BUD-1 · handlePresupuestoMesCadenceChange solo acepta monthly/weekly y re-renderiza", () => {
  const { context, rendered } = viewSandbox({});
  context.handlePresupuestoMesCadenceChange("weekly");
  assert.equal(context.presupuestoMesCadence, "weekly");
  context.handlePresupuestoMesCadenceChange("algo-raro");
  assert.equal(context.presupuestoMesCadence, "weekly", "un valor inválido no cambia la cadencia");
  assert.equal(rendered.length, 1, "el valor inválido tampoco dispara un re-render");
});

test("BUD-1 · handleWeekBudgetAmountChange crea/actualiza un presupuesto semanal y guarda", () => {
  const { context, saved } = viewSandbox({ budgetsData: [] });
  context.handleWeekBudgetAmountChange({ dataset: { presupuestoSemanaCategory: "comida", presupuestoSemanaWeek: "2026-W35" }, value: "70" });
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].categoryId, "comida");
  assert.equal(context.budgets[0].period, "weekly");
  assert.equal(context.budgets[0].amountCap, 70);
  assert.equal(saved.length, 1, "saveBudgets() se llama tras el cambio");
});

test("BUD-1 · handleWeekBudgetAmountChange ignora importes inválidos, sin guardar nada", () => {
  const { context, saved } = viewSandbox({ budgetsData: [] });
  context.handleWeekBudgetAmountChange({ dataset: { presupuestoSemanaCategory: "comida", presupuestoSemanaWeek: "2026-W35" }, value: "0" });
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 0);
});

test("BUD-1 · handleRemoveWeekBudget quita solo el presupuesto semanal indicado", () => {
  const existing = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const { context, saved } = viewSandbox({ budgetsData: [existing] });
  context.handleRemoveWeekBudget("comida", "2026-W35");
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 1);
});

test("BUD-1 · handleAddWeekBudget lee categoría e importe de la fila y añade el presupuesto", () => {
  const { context, saved } = viewSandbox({ budgetsData: [] });
  const fakeRow = {
    querySelector: (selector) => {
      if (selector === "[data-presupuesto-semana-new-category]") return { value: "ocio" };
      if (selector === "[data-presupuesto-semana-new-amount]") return { value: "45" };
      return null;
    },
  };
  const button = { dataset: { presupuestoSemanaAddWeek: "2026-W35" }, closest: () => fakeRow };
  context.handleAddWeekBudget(button);
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].categoryId, "ocio");
  assert.equal(context.budgets[0].amountCap, 45);
  assert.equal(saved.length, 1);
});

test("BUD-1 · presupuestoMesWeeklyHtml: sin presupuestos muestra el estado vacío con la etiqueta de la semana", () => {
  const { context } = viewSandbox({ budgetsData: [] });
  context.presupuestoMesActiveWeekKey = "2026-W35";
  const html = context.presupuestoMesWeeklyHtml();
  assert.match(html, /Todavía no hay presupuestos semanales/);
  assert.match(html, /24 ago/);
});

test("BUD-1 · presupuestoMesWeeklyHtml: con presupuestos pinta fila editable, gastado y botón de quitar", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const { context } = viewSandbox({
    budgetsData: [budget],
    alert: { status: "overspend", metrics: { spent: 90, dayOfMonth: 5, daysInMonth: 7 } },
    projection: { projected: 126, diff: 56 },
  });
  context.presupuestoMesActiveWeekKey = "2026-W35";
  const html = context.presupuestoMesWeeklyHtml();
  assert.match(html, /data-presupuesto-semana-category="comida"/);
  assert.match(html, /data-presupuesto-semana-remove="comida"/);
  assert.match(html, /€90/);
  assert.match(html, /Por encima del ritmo/);
});

test("BUD-1 · presupuestoMesWeeklyHtml: la fila de alta solo ofrece categorías sin presupuesto ya asignado", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "comida", period: "weekly", weekKey: "2026-W35", amountCap: 70 });
  const { context } = viewSandbox({
    budgetsData: [budget],
    alert: { status: "on-track", metrics: { spent: 0, dayOfMonth: 1, daysInMonth: 7 } },
    projection: { projected: 0, diff: -70 },
    categories: ["comida", "ocio", "transporte"],
  });
  context.presupuestoMesActiveWeekKey = "2026-W35";
  const html = context.presupuestoMesWeeklyHtml();
  assert.doesNotMatch(html, /<option value="comida">/);
  assert.match(html, /<option value="ocio">/);
  assert.match(html, /<option value="transporte">/);
});

// ============================================================================
// Parte E: selector de cadencia y wiring de eventos, visibles en el shell publicado
// ============================================================================

test("BUD-1 · el selector de cadencia y la navegación semanal se piden desde app.js", () => {
  assert.match(app, /data-presupuesto-mes-cadence="monthly"/);
  assert.match(app, /data-presupuesto-mes-cadence="weekly"/);
  assert.match(app, /if \(cadenceButton\) \{ handlePresupuestoMesCadenceChange\(cadenceButton\.dataset\.presupuestoMesCadence\); return; \}/);
  assert.match(app, /if \(event\.target\.closest\("\[data-presupuesto-semana-prev\]"\)\) \{ shiftPresupuestoMesWeek\(-1\); return; \}/);
  assert.match(app, /if \(event\.target\.closest\("\[data-presupuesto-semana-next\]"\)\) \{ shiftPresupuestoMesWeek\(1\); return; \}/);
});

test("BUD-1 · el chunk de presupuesto-mes viaja versionado tras el cambio", () => {
  const html = read("index.html");
  assert.match(app, /views\/presupuesto-mes\.js\?v=20260828d1/);
  assert.match(html, /app.js\?v=20260830b1/);
});
