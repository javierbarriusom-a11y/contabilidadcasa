/**
 * tests/bud2-presupuestos-objetivos.test.cjs
 *
 * BUD-2 (FASE 7): presupuestos ligados a objetivos (E15/P2).
 * Un objetivo se presupuesta como un tercer "tipo" de fila sobre el mismo budgets[]/
 * CanonicalBudgetAlerts, sin motor nuevo: una convención de nombre (`categoryId = "goal:<id>"`)
 * que budgetAlertForRow()/budgetWeekAlertForRow() detectan, y "gastado" pasa a ser "aportado"
 * (las contribuciones reales del objetivo en vez de movimientos bancarios).
 *
 * - Parte A: convención de nombre y etiqueta legible (funciones puras, sin p2State real).
 * - Parte B: cadena real de cálculo — budgetGoalContributionMovements/budgetAlertForRow/
 *   budgetWeekAlertForRow sobre contribuciones sintéticas, con p2State() mockeado.
 * - Parte C: exclusión de las tarjetas pensadas solo para gasto (categoryBudgetsForMonth).
 * - Parte D: wiring de la vista — fila de alta "Presupuestar objetivo", en mensual y semanal.
 * - Parte E: exportación (budgetsExportRows) con presupuestos de objetivo y semanales mezclados.
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

const GOAL_HELPERS = [
  'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
  "isGoalBudgetCategoryId",
  "goalIdFromBudgetCategoryId",
  "goalBudgetCategoryId",
  "goalNameById",
  "activeGoalsForBudget",
  "budgetGoalContributionMovements",
  "goalProposedMonthlyContribution",
  "budgetRowDisplayLabel",
].map((item) => (item.startsWith("const") ? item : extractFunction(item)));

// ============================================================================
// Parte A: convención de nombre y etiqueta legible
// ============================================================================

function coreSandbox({ goals = [], p2Domain = null, e15 = null, p2Bridge = null } = {}) {
  const context = {
    p2State: () => ({ goals }),
    window: {
      P2Domain: p2Domain,
      FinanceCanonicalE15: e15,
      FinanceP2Bridge: p2Bridge,
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `€${v}`,
  };
  vm.createContext(context);
  vm.runInContext(GOAL_HELPERS.join("\n"), context, { filename: "app.js#bud2-core" });
  return context;
}

test("BUD-2 · goalBudgetCategoryId/isGoalBudgetCategoryId/goalIdFromBudgetCategoryId son inversas entre sí", () => {
  const context = coreSandbox({});
  const categoryId = context.goalBudgetCategoryId("abc123");
  assert.equal(categoryId, "goal:abc123");
  assert.equal(context.isGoalBudgetCategoryId(categoryId), true);
  assert.equal(context.goalIdFromBudgetCategoryId(categoryId), "abc123");
});

test("BUD-2 · isGoalBudgetCategoryId es false para una categoría bancaria real", () => {
  const context = coreSandbox({});
  assert.equal(context.isGoalBudgetCategoryId("comida"), false);
  assert.equal(context.isGoalBudgetCategoryId(""), false);
  assert.equal(context.isGoalBudgetCategoryId(undefined), false);
});

test("BUD-2 · budgetRowDisplayLabel resuelve el nombre del objetivo, o deja la categoría intacta", () => {
  const context = coreSandbox({ goals: [{ id: "g1", name: "Vacaciones" }] });
  assert.equal(context.budgetRowDisplayLabel(context.goalBudgetCategoryId("g1")), "🎯 Vacaciones");
  assert.equal(context.budgetRowDisplayLabel("comida"), "comida");
});

test("BUD-2 · goalNameById dice \"Objetivo eliminado\" si el objetivo ya no existe", () => {
  const context = coreSandbox({ goals: [] });
  assert.equal(context.goalNameById("fantasma"), "Objetivo eliminado");
});

// ============================================================================
// Parte B: cadena real de cálculo — contribuciones reales de un objetivo
// ============================================================================

test("BUD-2 · budgetGoalContributionMovements convierte cada aportación en un movimiento sintético", () => {
  const context = coreSandbox({
    goals: [
      {
        id: "g1",
        name: "Vacaciones",
        contributions: [
          { amount: 50, date: "2026-08-05" },
          { amount: 30, month: "2026-08" }, // sin fecha diaria: cae al día 1 del mes
        ],
      },
    ],
  });
  const movements = context.budgetGoalContributionMovements("g1");
  assert.deepEqual(
    Array.from(movements, (m) => ({ date: m.date, amount: m.amount })),
    [{ date: "2026-08-05", amount: -50 }, { date: "2026-08-01", amount: -30 }],
  );
});

test("BUD-2 · budgetGoalContributionMovements con un objetivo inexistente no lanza, da array vacío", () => {
  const context = coreSandbox({ goals: [] });
  // Array.from: el array que devuelve pertenece al realm del vm, con su propio Array.prototype —
  // assert.deepEqual lo rechazaría contra un [] de este realm aunque el contenido sea idéntico.
  assert.equal(Array.from(context.budgetGoalContributionMovements("fantasma")).length, 0);
});

test("BUD-2 · activeGoalsForBudget excluye pausados/cancelados y objetivos ya cumplidos", () => {
  const p2Domain = { goalSnapshot: (goal) => ({ ...goal, remaining: Math.max(0, (goal.target || 0) - (goal.saved || 0)) }) };
  const context = coreSandbox({
    p2Domain,
    goals: [
      { id: "g1", name: "Activo con saldo", status: "active", target: 100, saved: 20 },
      { id: "g2", name: "Pausado", status: "paused", target: 100, saved: 0 },
      { id: "g3", name: "Ya cumplido", status: "active", target: 100, saved: 100 },
    ],
  });
  assert.deepEqual(context.activeGoalsForBudget().map((g) => g.id), ["g1"]);
});

test("BUD-2 · goalProposedMonthlyContribution reutiliza CanonicalE15.contributionPlan sin reimplementarlo", () => {
  const contributionPlanCalls = [];
  const e15 = {
    contributionPlan: (input) => {
      contributionPlanCalls.push(input);
      return { plans: [{ id: "g1", proposedMonthly: 45.5 }] };
    },
  };
  const p2Bridge = { goalPlanning: () => ({ monthlyCapacity: 300, reserve: 500 }) };
  const context = coreSandbox({ goals: [{ id: "g1", name: "Vacaciones" }], e15, p2Bridge });
  assert.equal(context.goalProposedMonthlyContribution("g1"), 45.5);
  assert.equal(contributionPlanCalls.length, 1, "delega en el plan E15 en vez de recalcular capacidad/prioridad");
  assert.equal(contributionPlanCalls[0].monthlyCapacity, 300, "usa el mismo input de planificación que ya construye FinanceP2Bridge");
});

test("BUD-2 · goalProposedMonthlyContribution sin motor E15 disponible devuelve null, sin lanzar", () => {
  const context = coreSandbox({ goals: [{ id: "g1" }] });
  assert.equal(context.goalProposedMonthlyContribution("g1"), null);
});

// ============================================================================
// Parte B (continuación): budgetAlertForRow/budgetWeekAlertForRow para una fila de objetivo
// ============================================================================

function alertSandbox({ goals = [], transactions = [] } = {}) {
  const context = {
    baseData: { transactions },
    p2State: () => ({ goals }),
    window: {
      FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema },
      FinanceCanonicalBudgetAlerts: { CanonicalBudgetAlerts },
      P2Domain: null,
      FinanceCanonicalE15: null,
      FinanceP2Bridge: null,
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
      "var budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
      extractFunction("isGoalBudgetCategoryId"),
      extractFunction("goalIdFromBudgetCategoryId"),
      extractFunction("budgetGoalContributionMovements"),
      extractFunction("budgetNegativeTransactionsByCategory"),
      extractFunction("budgetExpenseTransactions"),
      extractFunction("budgetHistoricalExpenseTransactions"),
      extractFunction("manualPartidaEntriesForMonth"),
      extractFunction("recentBudgetMonthKeys"),
      extractFunction("syntheticManualMovements"),
      extractFunction("budgetAnalysisForCategory"),
      extractFunction("currentBudgetMonthKey"),
      extractFunction("budgetDateContextFor"),
      extractFunction("budgetAlertForRow"),
      extractFunction("currentBudgetWeekKey"),
      extractFunction("budgetExpenseTransactionsForWeek"),
      extractFunction("budgetWeekDateContext"),
      extractFunction("budgetWeekAlertForRow"),
    ].join("\n"),
    context,
    { filename: "app.js#bud2-alerts" },
  );
  return context;
}

test("BUD-2 · budgetAlertForRow de una fila de objetivo mide lo aportado, no el gasto bancario", () => {
  const context = alertSandbox({
    goals: [{ id: "g1", name: "Vacaciones", contributions: [{ amount: 40, date: "2026-08-05" }] }],
    // Movimiento bancario de la MISMA categoría que la fila de objetivo (nombre "goal:g1" nunca lo
    // produciría classifyTransaction, pero confirma que budgetAlertForRow ni lo mira).
    transactions: [{ date: "2026-08-05", amount: -999, category: "goal:g1" }],
  });
  const monthKey = "2026-08";
  const budget = { categoryId: "goal:g1", amountCap: 100, period: "monthly", monthYear: monthKey };
  const alert = context.budgetAlertForRow(budget, monthKey);
  assert.equal(alert.metrics.spent, 40, "usa la aportación real (40), no el movimiento bancario (999)");
});

test("BUD-2 · budgetWeekAlertForRow de una fila de objetivo filtra las aportaciones por semana ISO", () => {
  const context = alertSandbox({
    goals: [
      {
        id: "g1",
        name: "Vacaciones",
        contributions: [
          { amount: 20, date: "2026-08-24" }, // dentro de 2026-W35
          { amount: 999, date: "2026-09-01" }, // fuera
        ],
      },
    ],
  });
  const budget = { categoryId: "goal:g1", amountCap: 70, period: "weekly", weekKey: "2026-W35" };
  const alert = context.budgetWeekAlertForRow(budget, "2026-W35");
  assert.equal(alert.metrics.spent, 20);
});

// ============================================================================
// Parte C: exclusión de objetivos en las tarjetas pensadas solo para gasto
// ============================================================================

test("BUD-2 · categoryBudgetsForMonth excluye los presupuestos de objetivo, aunque compartan mes", () => {
  const goalBudget = CanonicalBudgetSchema.create({ categoryId: "goal:g1", monthYear: "2026-08", amountCap: 50, source: "goal" });
  const categoryBudget = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 300 });
  const context = {
    budgets: [goalBudget, categoryBudget],
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
  };
  vm.createContext(context);
  vm.runInContext(
    ['const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";', extractFunction("isGoalBudgetCategoryId"), extractFunction("categoryBudgetsForMonth")].join("\n"),
    context,
    { filename: "app.js#bud2-category-filter" },
  );
  assert.deepEqual(context.categoryBudgetsForMonth("2026-08").map((b) => b.categoryId), ["comida"]);
});

// ============================================================================
// Parte D: wiring de la vista — fila de alta "Presupuestar objetivo"
// ============================================================================

function viewSandbox({ budgetsData = [], goals = [], e15 = null, p2Bridge = null, p2Domain = null } = {}) {
  const saved = [];
  const rendered = [];
  const context = {
    budgets: budgetsData,
    window: {
      FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema },
      P2Domain: p2Domain,
      FinanceCanonicalE15: e15,
      FinanceP2Bridge: p2Bridge,
    },
    p2State: () => ({ goals }),
    saveBudgets: () => saved.push([...context.budgets]),
    renderPresupuestoMes: () => rendered.push(true),
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (v) => `€${v}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      'const GOAL_BUDGET_CATEGORY_PREFIX = "goal:";',
      extractFunction("isGoalBudgetCategoryId"),
      extractFunction("goalIdFromBudgetCategoryId"),
      extractFunction("goalBudgetCategoryId"),
      extractFunction("goalNameById"),
      extractFunction("activeGoalsForBudget"),
      extractFunction("goalProposedMonthlyContribution"),
      extractFunction("presupuestoMesGoalOptionLabel"),
      extractFunction("presupuestoMesAddGoalRowHtml"),
      extractFunction("handleAddGoalBudget"),
    ].join("\n"),
    context,
    { filename: "app.js#bud2-view" },
  );
  return { context, saved, rendered };
}

test("BUD-2 · presupuestoMesAddGoalRowHtml no aparece si no hay objetivos presupuestables", () => {
  const { context } = viewSandbox({ goals: [] });
  assert.equal(context.presupuestoMesAddGoalRowHtml("2026-08", "monthly"), "");
});

test("BUD-2 · presupuestoMesAddGoalRowHtml ofrece los objetivos activos todavía no presupuestados ese mes", () => {
  const p2Domain = { goalSnapshot: (goal) => ({ ...goal, remaining: 100 }) };
  const already = CanonicalBudgetSchema.create({ categoryId: "goal:g1", monthYear: "2026-08", amountCap: 50, source: "goal" });
  const { context } = viewSandbox({
    budgetsData: [already],
    p2Domain,
    goals: [
      { id: "g1", name: "Ya presupuestado", status: "active" },
      { id: "g2", name: "Sin presupuestar", status: "active" },
    ],
  });
  const html = context.presupuestoMesAddGoalRowHtml("2026-08", "monthly");
  assert.doesNotMatch(html, /Ya presupuestado/);
  assert.match(html, /Sin presupuestar/);
  assert.match(html, /data-presupuesto-mes-goal-add-period="monthly"/);
  assert.match(html, /data-presupuesto-mes-goal-add-key="2026-08"/);
});

test("BUD-2 · presupuestoMesAddGoalRowHtml muestra la aportación mensual que ya propone E15, como referencia", () => {
  const p2Domain = { goalSnapshot: (goal) => ({ ...goal, remaining: 100 }) };
  const e15 = { contributionPlan: () => ({ plans: [{ id: "g1", proposedMonthly: 65 }] }) };
  const p2Bridge = { goalPlanning: () => ({}) };
  const { context } = viewSandbox({ p2Domain, e15, p2Bridge, goals: [{ id: "g1", name: "Vacaciones", status: "active" }] });
  const html = context.presupuestoMesAddGoalRowHtml("2026-08", "monthly");
  assert.match(html, /Vacaciones \(E15 sugiere €65\/mes\)/);
});

test("BUD-2 · handleAddGoalBudget crea un presupuesto mensual ligado al objetivo elegido", () => {
  const { context, saved } = viewSandbox({ budgetsData: [] });
  const fakeRow = {
    querySelector: (selector) => {
      if (selector === "[data-presupuesto-mes-goal-new-id]") return { value: "g1" };
      if (selector === "[data-presupuesto-mes-goal-new-amount]") return { value: "60" };
      return null;
    },
  };
  const button = { dataset: { presupuestoMesGoalAddPeriod: "monthly", presupuestoMesGoalAddKey: "2026-08" }, closest: () => fakeRow };
  context.handleAddGoalBudget(button);
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].categoryId, "goal:g1");
  assert.equal(context.budgets[0].period, "monthly");
  assert.equal(context.budgets[0].monthYear, "2026-08");
  assert.equal(context.budgets[0].amountCap, 60);
  assert.equal(context.budgets[0].source, "goal");
  assert.equal(saved.length, 1);
});

test("BUD-2 · handleAddGoalBudget crea un presupuesto semanal cuando la cadencia activa es semanal", () => {
  const { context } = viewSandbox({ budgetsData: [] });
  const fakeRow = {
    querySelector: (selector) => {
      if (selector === "[data-presupuesto-mes-goal-new-id]") return { value: "g1" };
      if (selector === "[data-presupuesto-mes-goal-new-amount]") return { value: "15" };
      return null;
    },
  };
  const button = { dataset: { presupuestoMesGoalAddPeriod: "weekly", presupuestoMesGoalAddKey: "2026-W35" }, closest: () => fakeRow };
  context.handleAddGoalBudget(button);
  assert.equal(context.budgets[0].period, "weekly");
  assert.equal(context.budgets[0].weekKey, "2026-W35");
});

test("BUD-2 · handleAddGoalBudget ignora un importe inválido sin tocar budgets[]", () => {
  const { context, saved } = viewSandbox({ budgetsData: [] });
  const fakeRow = {
    querySelector: (selector) => {
      if (selector === "[data-presupuesto-mes-goal-new-id]") return { value: "g1" };
      if (selector === "[data-presupuesto-mes-goal-new-amount]") return { value: "0" };
      return null;
    },
  };
  const button = { dataset: { presupuestoMesGoalAddPeriod: "monthly", presupuestoMesGoalAddKey: "2026-08" }, closest: () => fakeRow };
  context.handleAddGoalBudget(button);
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 0);
});

// ============================================================================
// Parte E: edición/baja reutilizan tal cual el wiring genérico ya existente
// ============================================================================

test("BUD-2 · un presupuesto de objetivo se edita y se quita con los mismos manejadores que una categoría", () => {
  // No es un test de comportamiento nuevo: documenta la propiedad que hace posible BUD-2 sin tocar
  // handleBudgetAmountChange/handleRemoveBudget — operan sobre `categoryId` como cadena opaca.
  assert.match(app, /function handleBudgetAmountChange\(input\) \{\n  const category = input\.dataset\.presupuestoMesCategory;/);
  assert.match(app, /function handleRemoveBudget\(category, monthKey\) \{\n  budgets = window\.FinanceCanonicalBudgetSchema\?\.CanonicalBudgetSchema\.delete\(budgets, category, monthKey\);/);
});

// ============================================================================
// Parte F: exportación — presupuestos de objetivo y semanales miden su periodo real
// ============================================================================

function exportSandbox({ budgetsData = [], alertsByKey = {} } = {}) {
  const context = {
    budgets: budgetsData,
    budgetAlertForRow: (budget, monthKey) => alertsByKey[`monthly|${budget.categoryId}|${monthKey}`],
    budgetWeekAlertForRow: (budget, weekKey) => alertsByKey[`weekly|${budget.categoryId}|${weekKey}`],
    budgetRowDisplayLabel: (categoryId) => (categoryId.startsWith("goal:") ? `🎯 ${categoryId.slice(5)}` : categoryId),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("budgetExportPeriodKey"), extractFunction("budgetsExportRows")].join("\n"),
    context,
    { filename: "app.js#bud2-export" },
  );
  return context;
}

test("BUD-2 · budgetsExportRows mide un presupuesto semanal sobre su propia semana, no sobre el mes agrupado", () => {
  const weekly = { categoryId: "comida", period: "weekly", weekKey: "2026-W35", monthYear: "2026-08", amountCap: 70, source: "manual", currency: "EUR" };
  const context = exportSandbox({
    budgetsData: [weekly],
    alertsByKey: {
      "weekly|comida|2026-W35": { metrics: { spent: 42, deviationPercent: 5 }, status: "on-track" },
      "monthly|comida|2026-08": { metrics: { spent: 999, deviationPercent: 999 }, status: "overspend" },
    },
  });
  const [row] = context.budgetsExportRows();
  assert.equal(row.mes, "2026-W35", "muestra la semana real, no el mes de agrupación");
  assert.equal(row.gastado, 42, "usa el alert semanal, no el mensual (que daría 999 y sería incorrecto)");
});

test("BUD-2 · budgetsExportRows resuelve el nombre del objetivo en la columna categoría", () => {
  const goalBudget = { categoryId: "goal:g1", period: "monthly", monthYear: "2026-08", amountCap: 60, source: "goal", currency: "EUR" };
  const context = exportSandbox({
    budgetsData: [goalBudget],
    alertsByKey: { "monthly|goal:g1|2026-08": { metrics: { spent: 60, deviationPercent: 0 }, status: "on-track" } },
  });
  const [row] = context.budgetsExportRows();
  assert.equal(row.categoria, "🎯 g1");
});

// ============================================================================
// Parte G: wiring de eventos y esquema, visibles en el shell publicado
// ============================================================================

test("BUD-2 · el botón «Presupuestar objetivo» se pide desde app.js", () => {
  assert.match(app, /data-presupuesto-mes-goal-add\b/);
  assert.match(app, /const goalAddButton = event\.target\.closest\("\[data-presupuesto-mes-goal-add\]"\);/);
  assert.match(app, /if \(goalAddButton\) \{ handleAddGoalBudget\(goalAddButton\); return; \}/);
});

test("BUD-2 · \"goal\" es una fuente válida en el esquema de presupuestos", () => {
  const valid = CanonicalBudgetSchema.validate({ categoryId: "goal:g1", monthYear: "2026-08", amountCap: 50, source: "goal" });
  assert.ok(valid);
  assert.equal(valid.source, "goal");
});

test("BUD-2 · el chunk de presupuesto-mes viaja versionado tras el cambio", () => {
  const html = read("index.html");
  assert.match(app, /views\/presupuesto-mes\.js\?v=20260828d1/);
  assert.match(html, /app.js\?v=20260829p1/);
});
