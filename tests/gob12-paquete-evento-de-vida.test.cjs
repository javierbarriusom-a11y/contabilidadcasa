const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BudgetSchema = require("../canonical-budget-schema.js").CanonicalBudgetSchema;
const P2Domain = require("../p2-domain.js");

// GOB12 (Oleada 4, Bloque 7): paquete reutilizable de "evento de vida" — reutiliza tal cual el
// Laboratorio de escenarios (E13, solo simulación), GOB20 (caída de ingreso real) y los objetivos
// E15 (p2State().goals) en una sola acción guiada, sin motor propio. "Simular" solo toca
// e13ScenarioEvents; "Aplicar a real" sube el tope de una categoría de presupuesto EXISTENTE
// (nunca crea una categoría nueva) y declara de verdad la caída de ingreso; el objetivo, si se
// declara, se crea siempre real. Se prueba aquí con los módulos canónicos reales
// (canonical-budget-schema.js, p2-domain.js), no con dobles — para no repetir su propia cobertura
// (tests/canonical-budget-schema.test.cjs, tests/p2-domain*.test.cjs si existen) solo se ejercitan
// tal cual, igual que ya se hace en tests/deb14-cuanto-hace-que-miraste-mercado.test.cjs con
// canonical-e14-operations.js.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = appSource.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = appSource.indexOf("};", start);
  return appSource.slice(start, end + 1);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function monthKeyFn(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function money(value) {
  return `${Number(value).toFixed(2)} €`;
}

function e13EventLabel(type) {
  return { expense: "Gasto extraordinario", move: "Mudanza", "income-loss": "Pérdida de ingreso" }[type] || type;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function sandbox({
  fields = {},
  scenarioSettings = {},
  budgets = [],
  p2 = { goals: [] },
  e13Events = [],
} = {}) {
  const defaultFields = {
    gob12Template: { value: "child" },
    gob12ExpenseAmount: { value: "" },
    gob12ExpenseMonth: { value: "" },
    gob12ExpenseDuration: { value: "" },
    gob12ExpenseCategory: { value: "Otros gastos" },
    gob12IncludeIncomeLoss: { checked: false },
    gob12IncomeAmount: { value: "" },
    gob12IncomeMonth: { value: "" },
    gob12IncomeDuration: { value: "" },
    gob12IncludeGoal: { checked: false },
    gob12GoalName: { value: "" },
    gob12GoalTarget: { value: "" },
    gob12GoalTargetDate: { value: "" },
    gob12Status: { textContent: "" },
  };
  const fieldEls = { ...defaultFields, ...fields };
  const recomputeCalls = [];
  const renderNewLifeCalls = [];
  const saveScenarioCalls = [];
  const saveBudgetsCalls = [];
  const saveP2Calls = [];
  const context = {
    scenarioSettings,
    budgets,
    e13ScenarioEvents: e13Events,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema: BudgetSchema }, P2Domain },
    qs: (id) => fieldEls[id] || null,
    parseAmount: (value) => (value === "" || value === undefined || value === null ? NaN : Number(value)),
    escapeHtml: (value) => String(value ?? ""),
    money,
    round2,
    addMonths,
    monthKey: monthKeyFn,
    e13EventLabel,
    saveScenarioSettings: () => saveScenarioCalls.push(plain(scenarioSettings)),
    saveBudgets: () => saveBudgetsCalls.push(plain(context.budgets)),
    p2State: () => P2Domain.normalizeState(p2),
    saveP2State: (next) => { p2 = P2Domain.normalizeState(next); saveP2Calls.push(plain(p2)); return p2; },
    recomputeModelIfNeeded: (force) => recomputeCalls.push(force),
    renderNewLifeSimulation: (opts) => renderNewLifeCalls.push(opts),
    renderE13ScenarioLab: () => {},
    fieldEls,
    recomputeCalls,
    renderNewLifeCalls,
    saveScenarioCalls,
    saveBudgetsCalls,
    saveP2Calls,
    getP2: () => p2,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("dateFromMonthKey"), context);
  vm.runInContext(extractFunction("gob20IncomeAdjustments"), context);
  vm.runInContext(extractFunction("saveGob20IncomeAdjustments"), context);
  vm.runInContext(extractFunction("gob12MonthRange"), context);
  vm.runInContext(extractFunction("gob12PackageFormValues"), context);
  vm.runInContext(extractConst("GOB12_TEMPLATE_EXPENSE_TYPE"), context);
  vm.runInContext(extractFunction("gob12PushE13Event"), context);
  vm.runInContext(extractFunction("gob12SimulatePackage"), context);
  vm.runInContext(extractFunction("gob12ApplyExpenseToReal"), context);
  vm.runInContext(extractFunction("gob12ApplyIncomeLossToReal"), context);
  vm.runInContext(extractFunction("gob12ApplyGoalToReal"), context);
  vm.runInContext(extractFunction("gob12ApplyPackageToReal"), context);
  return context;
}

test("gob12MonthRange · genera los meses consecutivos declarados desde el inicio", () => {
  const ctx = sandbox();
  assert.deepEqual(plain(ctx.gob12MonthRange("2026-09", 3)), ["2026-09", "2026-10", "2026-11"]);
});

test("gob12MonthRange · mes de inicio inválido, sin meses (nunca inventa un rango)", () => {
  const ctx = sandbox();
  assert.deepEqual(plain(ctx.gob12MonthRange("", 3)), []);
});

test("gob12SimulatePackage · sin importe o mes del gasto, no añade nada y avisa", () => {
  const ctx = sandbox();
  ctx.gob12SimulatePackage();
  assert.equal(ctx.e13ScenarioEvents.length, 0);
  assert.match(ctx.fieldEls.gob12Status.textContent, /Indica el importe/);
});

test("gob12SimulatePackage · con el gasto declarado, añade un único evento E13 con el tipo de la plantilla", () => {
  const ctx = sandbox({ fields: {
    gob12Template: { value: "move" },
    gob12ExpenseAmount: { value: "800" },
    gob12ExpenseMonth: { value: "2026-10" },
    gob12ExpenseDuration: { value: "1" },
  } });
  ctx.gob12SimulatePackage();
  assert.equal(ctx.e13ScenarioEvents.length, 1);
  assert.equal(ctx.e13ScenarioEvents[0].type, "move");
  assert.equal(ctx.e13ScenarioEvents[0].amount, 800);
  assert.match(ctx.fieldEls.gob12Status.textContent, /Laboratorio de escenarios/);
});

test("gob12SimulatePackage · con la caída de ingreso incluida, añade también ese segundo evento", () => {
  const ctx = sandbox({ fields: {
    gob12ExpenseAmount: { value: "400" },
    gob12ExpenseMonth: { value: "2026-09" },
    gob12ExpenseDuration: { value: "6" },
    gob12IncludeIncomeLoss: { checked: true },
    gob12IncomeAmount: { value: "500" },
    gob12IncomeMonth: { value: "2026-09" },
    gob12IncomeDuration: { value: "3" },
  } });
  ctx.gob12SimulatePackage();
  assert.equal(ctx.e13ScenarioEvents.length, 2);
  assert.equal(ctx.e13ScenarioEvents[1].type, "income-loss");
  assert.equal(ctx.e13ScenarioEvents[1].amount, 500);
});

test("gob12SimulatePackage · caída de ingreso marcada pero sin importe/mes, no la añade (declarado, nunca inventado)", () => {
  const ctx = sandbox({ fields: {
    gob12ExpenseAmount: { value: "400" },
    gob12ExpenseMonth: { value: "2026-09" },
    gob12IncludeIncomeLoss: { checked: true },
  } });
  ctx.gob12SimulatePackage();
  assert.equal(ctx.e13ScenarioEvents.length, 1);
});

test("gob12ApplyExpenseToReal · sin presupuesto previo, crea el tope para cada mes del rango con el importe declarado", () => {
  const ctx = sandbox();
  const applied = ctx.gob12ApplyExpenseToReal({ expenseMonth: "2026-09", expenseDuration: 2, expenseCategoryId: "Otros gastos", expenseAmount: 150 });
  assert.equal(applied, true);
  const sept = BudgetSchema.findForCategoryMonth(ctx.budgets, "Otros gastos", "2026-09");
  const oct = BudgetSchema.findForCategoryMonth(ctx.budgets, "Otros gastos", "2026-10");
  assert.equal(sept.amountCap, 150);
  assert.equal(oct.amountCap, 150);
  assert.equal(ctx.saveBudgetsCalls.length, 1);
});

test("gob12ApplyExpenseToReal · con presupuesto ya declarado para esa categoría/mes, SUMA en vez de pisarlo", () => {
  const existingBudgets = BudgetSchema.upsert([], { categoryId: "Alimentacion", monthYear: "2026-09", amountCap: 300, source: "manual" });
  const ctx = sandbox({ budgets: existingBudgets });
  ctx.gob12ApplyExpenseToReal({ expenseMonth: "2026-09", expenseDuration: 1, expenseCategoryId: "Alimentacion", expenseAmount: 100 });
  const result = BudgetSchema.findForCategoryMonth(ctx.budgets, "Alimentacion", "2026-09");
  assert.equal(result.amountCap, 400);
});

test("gob12ApplyIncomeLossToReal · sin incluir la caída, no declara nada", () => {
  const ctx = sandbox();
  const applied = ctx.gob12ApplyIncomeLossToReal({ includeIncomeLoss: false, incomeAmount: 500, incomeMonth: "2026-09", incomeDuration: 3 });
  assert.equal(applied, false);
  assert.equal((ctx.scenarioSettings.incomeAdjustments || []).length, 0);
});

test("gob12ApplyIncomeLossToReal · con la caída incluida, la declara de verdad en scenarioSettings.incomeAdjustments (GOB20)", () => {
  const ctx = sandbox();
  const applied = ctx.gob12ApplyIncomeLossToReal({ includeIncomeLoss: true, incomeAmount: 500, incomeMonth: "2026-09", incomeDuration: 3 });
  assert.equal(applied, true);
  assert.equal(ctx.scenarioSettings.incomeAdjustments.length, 1);
  assert.equal(ctx.scenarioSettings.incomeAdjustments[0].monthlyAmount, 500);
  assert.equal(ctx.saveScenarioCalls.length, 1);
});

test("gob12ApplyGoalToReal · sin incluir el objetivo, no crea nada", () => {
  const ctx = sandbox();
  const applied = ctx.gob12ApplyGoalToReal({ includeGoal: false, goalName: "Fondo mudanza", goalTarget: 2000, goalTargetDate: "2026-12" });
  assert.equal(applied, false);
  assert.equal(ctx.getP2().goals.length, 0);
});

test("gob12ApplyGoalToReal · con el objetivo incluido, lo crea real en p2State().goals con fecha objetivo", () => {
  const ctx = sandbox();
  const applied = ctx.gob12ApplyGoalToReal({ includeGoal: true, goalName: "Fondo mudanza", goalTarget: 2000, goalTargetDate: "2026-12" });
  assert.equal(applied, true);
  const goal = ctx.getP2().goals[0];
  assert.equal(goal.name, "Fondo mudanza");
  assert.equal(goal.target, 2000);
  assert.equal(goal.targetDate, "2026-12");
  assert.equal(goal.status, "active");
});

test("gob12ApplyPackageToReal · sin gasto declarado, no aplica nada y avisa", () => {
  const ctx = sandbox();
  ctx.gob12ApplyPackageToReal();
  assert.match(ctx.fieldEls.gob12Status.textContent, /Indica el importe/);
  assert.equal(ctx.recomputeCalls.length, 0);
});

test("gob12ApplyPackageToReal · con las tres piezas declaradas, aplica las tres a real y lo confirma en el estado", () => {
  const ctx = sandbox({ fields: {
    gob12ExpenseAmount: { value: "400" },
    gob12ExpenseMonth: { value: "2026-09" },
    gob12ExpenseDuration: { value: "6" },
    gob12ExpenseCategory: { value: "Otros gastos" },
    gob12IncludeIncomeLoss: { checked: true },
    gob12IncomeAmount: { value: "500" },
    gob12IncomeMonth: { value: "2026-09" },
    gob12IncomeDuration: { value: "3" },
    gob12IncludeGoal: { checked: true },
    gob12GoalName: { value: "Fondo hijo" },
    gob12GoalTarget: { value: "3000" },
    gob12GoalTargetDate: { value: "2027-01" },
  } });
  ctx.gob12ApplyPackageToReal();
  assert.equal(BudgetSchema.findForCategoryMonth(ctx.budgets, "Otros gastos", "2026-09").amountCap, 400);
  assert.equal(ctx.scenarioSettings.incomeAdjustments.length, 1);
  assert.equal(ctx.getP2().goals.length, 1);
  // Dos llamadas: una la dispara saveGob20IncomeAdjustments() (GOB20) al declarar la caída de
  // ingreso, otra el propio cierre de gob12ApplyPackageToReal() — redundante pero inofensivo
  // (recomputeModelIfNeeded(true) es idempotente), nunca deja de recalcular por accidente.
  assert.deepEqual(ctx.recomputeCalls, [true, true]);
  assert.deepEqual(plain(ctx.renderNewLifeCalls), [{ forceHeavy: true }]);
  assert.match(ctx.fieldEls.gob12Status.textContent, /partida de presupuesto/);
  assert.match(ctx.fieldEls.gob12Status.textContent, /caída de ingreso declarada/);
  assert.match(ctx.fieldEls.gob12Status.textContent, /objetivo nuevo/);
});

test("wiring: index.html declara todos los campos del paquete, después de la tarjeta de GOB20", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  [
    "gob12Template", "gob12ExpenseAmount", "gob12ExpenseMonth", "gob12ExpenseDuration", "gob12ExpenseCategory",
    "gob12IncludeIncomeLoss", "gob12IncomeAmount", "gob12IncomeMonth", "gob12IncomeDuration",
    "gob12IncludeGoal", "gob12GoalName", "gob12GoalTarget", "gob12GoalTargetDate",
    "gob12SimulateBtn", "gob12ApplyRealBtn", "gob12Status",
  ].forEach((id) => assert.match(indexSource, new RegExp(`id="${id}"`)));
  const gob20Idx = indexSource.indexOf('id="gob20IncomeAdjustmentsList"');
  const gob12Idx = indexSource.indexOf('id="gob12Template"');
  assert.ok(gob20Idx > 0 && gob12Idx > gob20Idx, "GOB12 debe estar después de la tarjeta de GOB20");
});

test("wiring: app.js conecta los dos botones a sus manejadores", () => {
  assert.match(appSource, /qs\("gob12SimulateBtn"\)\?\.addEventListener\("click", gob12SimulatePackage\)/);
  assert.match(appSource, /qs\("gob12ApplyRealBtn"\)\?\.addEventListener\("click", gob12ApplyPackageToReal\)/);
});
