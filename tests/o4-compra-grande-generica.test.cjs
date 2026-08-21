const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// O-4 (BACKLOG_OPERACION.md): generalizar "¿cuándo puedo permitirme X?" más allá del coche.
// bigPurchaseAffordability es el motor genérico que ahora usan tanto el coche (executiveAdvisorContext,
// sin cambiar ni un número) como los objetivos nuevos que el usuario da de alta (bigPurchaseGoals).

// Balancea primero los paréntesis de la firma antes de buscar la llave de apertura del cuerpo,
// igual que en los tests de O-2/O-3: algunas funciones de app.js desestructuran sus parámetros.
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function spyFirstMonth() {
  const calls = [];
  const fn = (plan, amount) => {
    calls.push(amount);
    return { month: `mock-${amount}` };
  };
  return { fn, calls };
}

// --- bigPurchaseAffordability: el motor genérico -----------------------------------------------

test("O-4 · cashNeedCredit es coste menos capital financiado, sin bajar de 0", () => {
  const { fn } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  const a = context.bigPurchaseAffordability({}, { costeObjetivo: 12000, capitalFinanciacion: 6000, avgIncome: 0, avgDebt: 0 });
  assert.equal(a.cashNeedCredit, 6000);
  const b = context.bigPurchaseAffordability({}, { costeObjetivo: 5000, capitalFinanciacion: 9000, avgIncome: 0, avgDebt: 0 });
  assert.equal(b.cashNeedCredit, 0);
});

test("O-4 · monthCashOnly consulta el colchón cuando existe, y el coste cuando no hay colchón", () => {
  const { fn, calls } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  context.bigPurchaseAffordability({}, { costeObjetivo: 12000, colchonObjetivo: 3000 });
  assert.ok(calls.includes(3000), "debería consultar el colchón, no el coste completo");
  calls.length = 0;
  context.bigPurchaseAffordability({}, { costeObjetivo: 12000, colchonObjetivo: 0 });
  assert.ok(calls.includes(12000), "sin colchón, cae al coste completo");
});

test("O-4 · monthWithCredit consulta exactamente cashNeedCredit", () => {
  const { fn, calls } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  context.bigPurchaseAffordability({}, { costeObjetivo: 12000, capitalFinanciacion: 6000 });
  assert.ok(calls.includes(6000));
});

test("O-4 · debtRatio, debtRatioWithCredit y maxSafePayment replican la fórmula prudente original", () => {
  const { fn } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  const a = context.bigPurchaseAffordability({}, { costeObjetivo: 1, avgIncome: 3000, avgDebt: 700, cuotaFinanciacion: 320 });
  assert.equal(a.debtRatio, (700 / 3000) * 100);
  assert.equal(a.debtRatioWithCredit, ((700 + 320) / 3000) * 100);
  assert.equal(a.maxSafePayment, Math.round((3000 * 0.32 - 700 + Number.EPSILON) * 100) / 100);
});

test("O-4 · safeCredit exige ratio <= 32% y cuota por debajo de la cuota máxima prudente", () => {
  const { fn } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  const seguro = context.bigPurchaseAffordability({}, { costeObjetivo: 1, avgIncome: 3000, avgDebt: 700, cuotaFinanciacion: 200 });
  assert.equal(seguro.safeCredit, true);
  const arriesgado = context.bigPurchaseAffordability({}, { costeObjetivo: 1, avgIncome: 3000, avgDebt: 700, cuotaFinanciacion: 900 });
  assert.equal(arriesgado.safeCredit, false);
});

// --- Caso coche: cero regresión frente a la fórmula que había antes en executiveAdvisorContext --

test("O-4 · el caso coche reproduce exactamente los números que calculaba antes executiveAdvisorContext", () => {
  const { fn } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  const settings = { carCost: 25000, carReserve: 8000, tereCreditCapital: 15000, tereCreditPayment: 320 };
  const avgIncome = 3200;
  const avgDebt = 650;
  const result = context.bigPurchaseAffordability({}, {
    costeObjetivo: settings.carCost,
    colchonObjetivo: settings.carReserve,
    capitalFinanciacion: settings.tereCreditCapital,
    cuotaFinanciacion: settings.tereCreditPayment,
    avgIncome,
    avgDebt,
  });
  // Fórmulas originales, tal y como vivían en app.js antes de O-4:
  const expectedCashNeed = Math.max(0, Math.round((settings.carCost - settings.tereCreditCapital + Number.EPSILON) * 100) / 100);
  const expectedDebtRatio = (avgDebt / avgIncome) * 100;
  const expectedDebtRatioWithTere = ((avgDebt + settings.tereCreditPayment) / avgIncome) * 100;
  const expectedMaxSafe = Math.max(0, Math.round((avgIncome * 0.32 - avgDebt + Number.EPSILON) * 100) / 100);
  const expectedSafeCredit = expectedDebtRatioWithTere <= 32 && settings.tereCreditPayment <= Math.max(1, expectedMaxSafe);
  assert.equal(result.cashNeedCredit, expectedCashNeed);
  assert.equal(result.debtRatio, expectedDebtRatio);
  assert.equal(result.debtRatioWithCredit, expectedDebtRatioWithTere);
  assert.equal(result.maxSafePayment, expectedMaxSafe);
  assert.equal(result.safeCredit, expectedSafeCredit);
});

test("O-4 · executiveAdvisorContext calcula el coche a través de bigPurchaseAffordability (no duplica la fórmula)", () => {
  const source = extractFunction("executiveAdvisorContext");
  assert.match(source, /bigPurchaseAffordability\(plan, \{/);
  assert.match(source, /costeObjetivo: settings\.carCost/);
  assert.match(source, /colchonObjetivo: settings\.carReserve/);
  assert.match(source, /capitalFinanciacion: settings\.tereCreditCapital/);
  assert.match(source, /cuotaFinanciacion: settings\.tereCreditPayment/);
});

// --- Caso nuevo: un objetivo distinto del coche, con su propia fecha -----------------------------

test("O-4 · un objetivo distinto (reforma) calcula su propia fecha y ratio, independiente del coche", () => {
  const { fn, calls } = spyFirstMonth();
  const context = sandboxWith(["bigPurchaseAffordability", "round2"], { firstMonthReachingMediolanum: fn });
  const result = context.bigPurchaseAffordability({}, {
    costeObjetivo: 12000,
    colchonObjetivo: 3000,
    capitalFinanciacion: 6000,
    cuotaFinanciacion: 150,
    avgIncome: 3200,
    avgDebt: 650,
  });
  assert.equal(result.cashNeedCredit, 6000);
  assert.deepEqual(calls, [3000, 6000]);
  assert.equal(result.monthCashOnly.month, "mock-3000");
  assert.equal(result.monthWithCredit.month, "mock-6000");
  const expectedRatioWithCredit = ((650 + 150) / 3200) * 100;
  assert.equal(result.debtRatioWithCredit, expectedRatioWithCredit);
});

// --- Objetivos guardados por el usuario: bigPurchaseGoals / add / remove ------------------------

function sandboxGoals(initial) {
  const scenarioSettings = initial ? { bigPurchaseGoals: initial } : {};
  const context = sandboxWith(["bigPurchaseGoals", "addBigPurchaseGoal", "removeBigPurchaseGoal"], {
    scenarioSettings,
    saveScenarioSettings: () => {},
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  });
  return context;
}

test("O-4 · bigPurchaseGoals inicializa la lista vacía si no existía todavía", () => {
  const context = sandboxGoals();
  assert.equal(context.bigPurchaseGoals().length, 0);
});

test("O-4 · addBigPurchaseGoal añade el objetivo normalizado con un id propio", () => {
  const context = sandboxGoals();
  context.addBigPurchaseGoal({ label: "Reforma cocina", costeObjetivo: "12000", colchonObjetivo: "3000", capitalFinanciacion: "6000", cuotaFinanciacion: "150" });
  const goals = context.bigPurchaseGoals();
  assert.equal(goals.length, 1);
  assert.equal(goals[0].label, "Reforma cocina");
  assert.equal(goals[0].costeObjetivo, 12000);
  assert.equal(goals[0].capitalFinanciacion, 6000);
  assert.ok(goals[0].id);
});

test("O-4 · addBigPurchaseGoal usa un nombre por defecto si no se escribe ninguno", () => {
  const context = sandboxGoals();
  context.addBigPurchaseGoal({ label: "   ", costeObjetivo: 5000 });
  assert.equal(context.bigPurchaseGoals()[0].label, "Compra grande");
});

test("O-4 · removeBigPurchaseGoal quita solo el objetivo con ese id", () => {
  const context = sandboxGoals([{ id: "a", label: "A" }, { id: "b", label: "B" }]);
  context.removeBigPurchaseGoal("a");
  const goals = context.bigPurchaseGoals();
  assert.equal(goals.length, 1);
  assert.equal(goals[0].id, "b");
});

// --- Cableado de render: renderExecutiveAdvisor pinta también los objetivos nuevos --------------

test("O-4 · renderExecutiveAdvisor pinta los objetivos grandes junto al del coche", () => {
  const source = extractFunction("renderExecutiveAdvisor");
  assert.match(source, /renderBigPurchaseGoals\(ctx\)/);
});
