const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const IrpfEstimator = require("../canonical-irpf-estimator.js");

// INV18 (Oleada 4, Bloque 4, IN-8): "¿de qué posición y cuándo saco X€ más barato?" — hasta ahora
// optimizePartialSale (FC5), marginalTaxOnAdditionalIncome (FCX1) y la fecha de un objetivo (E15)
// vivían sueltos: el hogar tenía que copiar a mano la plusvalía de cada posición en FC5 y el
// importe del rescate en FCX1, sin ninguna ayuda para decidir de qué posición sacar el dinero ni
// cuándo. inv18WithdrawalPlan() los cruza sobre las posiciones reales de la cartera con un relleno
// voraz (greedy) que reevalúa el coste marginal en cada paso — nunca fija de antemano "primero lo
// líquido, luego la pensión": si una posición de pensión es de verdad más barata dado el estado
// fiscal acumulado, se elige antes que un fondo con mucha plusvalía ya declarada.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

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

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function sandbox() {
  const context = {
    window: { FinanceCanonicalIrpfEstimator: IrpfEstimator },
    round2,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv18WithdrawalPlan"), context);
  return context;
}

const SOURCE = { title: "Escala de prueba", authority: "AEAT", url: "https://example.org/escala", checkedAt: "2026-01-01" };
const scale = (brackets) => ({ brackets, source: SOURCE });

test("inv18WithdrawalPlan · sin importe, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 0, positions: [{ id: "p1", type: "fondo", currentValue: 1000, gainLoss: 100 }] });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("inv18WithdrawalPlan · sin posiciones registradas, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 1000, positions: [] });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "no-positions");
});

test("inv18WithdrawalPlan · solo posiciones de tipo «otro», sin motor fiscal aplicable", () => {
  const ctx = sandbox();
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 1000, positions: [{ id: "p1", type: "otro", currentValue: 5000, gainLoss: 0 }] });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "no-priceable-positions");
});

test("inv18WithdrawalPlan · una posición con pérdidas sale gratis y se prioriza siempre primero", () => {
  const ctx = sandbox();
  const positions = [
    { id: "p-loss", type: "fondo", currentValue: 5000, gainLoss: -1000 },
    { id: "p-gain", type: "fondo", currentValue: 10000, gainLoss: 5000 },
  ];
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 3000, positions, alreadyRealizedGain: 0, savingsScale: scale([{ limit: 6000, rate: 19 }, { limit: null, rate: 21 }]) });
  assert.equal(result.calculable, true);
  assert.equal(result.now.steps.length, 1);
  assert.equal(result.now.steps[0].id, "p-loss");
  assert.equal(result.now.steps[0].amount, 3000);
  assert.equal(result.now.steps[0].marginalTax, 0);
  assert.equal(result.now.steps[0].method, "sin-plusvalia");
  assert.equal(result.now.remainingUncovered, 0);
});

test("inv18WithdrawalPlan · agotada la posición en pérdidas, continúa con la de plusvalía y acumula la base ya realizada", () => {
  const ctx = sandbox();
  const positions = [
    { id: "p-loss", type: "fondo", currentValue: 5000, gainLoss: -1000 },
    { id: "p-gain", type: "fondo", currentValue: 10000, gainLoss: 5000 },
  ];
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 8000, positions, alreadyRealizedGain: 0, savingsScale: scale([{ limit: 6000, rate: 19 }, { limit: null, rate: 21 }]) });
  assert.equal(result.now.steps.length, 2);
  assert.equal(result.now.steps[0].id, "p-loss");
  assert.equal(result.now.steps[1].id, "p-gain");
  assert.equal(result.now.steps[1].amount, 3000);
  // plusvalía proporcional: 3000/10000 de 5000 = 1500, entera en el primer tramo (19%).
  assert.equal(result.now.steps[1].marginalTax, 285);
  assert.equal(result.now.totalCovered, 8000);
  assert.equal(result.now.remainingUncovered, 0);
});

test("inv18WithdrawalPlan · el rescate de pensión tributa el importe completo, nunca solo una plusvalía", () => {
  const ctx = sandbox();
  const positions = [{ id: "pension-1", type: "plan-pension", currentValue: 5000, gainLoss: 0 }];
  const result = ctx.inv18WithdrawalPlan({
    amountNeeded: 2000, positions, currentAnnualIncome: 0,
    stateScale: scale([{ limit: 12450, rate: 19 }, { limit: null, rate: 24 }]),
    regionalScale: scale([{ limit: 12450, rate: 9 }, { limit: null, rate: 12 }]),
  });
  assert.equal(result.now.steps.length, 1);
  assert.equal(result.now.steps[0].type, "plan-pension");
  assert.equal(result.now.steps[0].amount, 2000);
  assert.equal(result.now.steps[0].marginalTax, 560); // 2000 * (19% + 9%)
  assert.equal(result.now.steps[0].method, "progressive-brackets");
});

test("inv18WithdrawalPlan · entre un fondo y una pensión, elige la que sea de verdad más barata dado el estado fiscal — no un orden fijo por tipo", () => {
  const ctx = sandbox();
  const positions = [
    { id: "fondo-caro", type: "fondo", currentValue: 1000, gainLoss: 1000 }, // 100% plusvalía
    { id: "pension-barata", type: "plan-pension", currentValue: 1000, gainLoss: 0 },
  ];
  const result = ctx.inv18WithdrawalPlan({
    amountNeeded: 1000, positions, alreadyRealizedGain: 0, currentAnnualIncome: 0,
    savingsScale: scale([{ limit: null, rate: 23 }]),
    stateScale: scale([{ limit: null, rate: 10 }]),
    regionalScale: scale([{ limit: null, rate: 9 }]),
  });
  // fondo: 1000 * 23% = 230. pensión: 1000 * (10%+9%) = 190. La pensión gana pese a "ser pensión".
  assert.equal(result.now.steps.length, 1);
  assert.equal(result.now.steps[0].id, "pension-barata");
  assert.equal(result.now.steps[0].marginalTax, 190);
});

test("inv18WithdrawalPlan · con plusvalía ya realizada este año, ofrece la comparación de esperar al ejercicio siguiente", () => {
  const ctx = sandbox();
  const positions = [{ id: "p1", type: "fondo", currentValue: 5000, gainLoss: 5000 }];
  const savingsScale = scale([{ limit: 6000, rate: 19 }, { limit: null, rate: 30 }]);
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 5000, positions, alreadyRealizedGain: 5900, savingsScale });
  assert.equal(result.calculable, true);
  assert.ok(result.nextYear, "esperaba una comparación con el ejercicio siguiente");
  assert.ok(result.nextYear.totalMarginalTax < result.now.totalMarginalTax);
});

test("inv18WithdrawalPlan · sin plusvalía ya realizada este año, no hay nada que ganar esperando: sin comparación", () => {
  const ctx = sandbox();
  const positions = [{ id: "p1", type: "fondo", currentValue: 5000, gainLoss: 5000 }];
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 1000, positions, alreadyRealizedGain: 0, savingsScale: scale([{ limit: null, rate: 19 }]) });
  assert.equal(result.nextYear, null);
});

test("inv18WithdrawalPlan · el rescate de pensión no se compara con el año que viene, aunque haya plusvalía ya realizada del lado del ahorro", () => {
  const ctx = sandbox();
  const positions = [{ id: "pension-1", type: "plan-pension", currentValue: 5000, gainLoss: 0 }];
  const result = ctx.inv18WithdrawalPlan({
    amountNeeded: 1000, positions, alreadyRealizedGain: 9000, currentAnnualIncome: 0,
    stateScale: scale([{ limit: null, rate: 19 }]), regionalScale: scale([{ limit: null, rate: 9 }]),
  });
  assert.equal(result.nextYear, null, "sin pasos de ahorro en el plan, esperar al año que viene no cambia nada");
});

test("inv18WithdrawalPlan · posiciones sin tipo con motor fiscal se cuentan como excluidas, no rompen el plan", () => {
  const ctx = sandbox();
  const positions = [
    { id: "p1", type: "fondo", currentValue: 5000, gainLoss: -500 },
    { id: "p2", type: "otro", currentValue: 3000, gainLoss: 0 },
  ];
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 1000, positions, savingsScale: scale([{ limit: null, rate: 19 }]) });
  assert.equal(result.calculable, true);
  assert.equal(result.excludedCount, 1);
});

test("inv18WithdrawalPlan · si el importe pedido supera lo disponible con motor fiscal, declara lo que falta en vez de inventar cobertura", () => {
  const ctx = sandbox();
  const positions = [{ id: "p1", type: "fondo", currentValue: 2000, gainLoss: -200 }];
  const result = ctx.inv18WithdrawalPlan({ amountNeeded: 5000, positions, savingsScale: scale([{ limit: null, rate: 19 }]) });
  assert.equal(result.now.totalCovered, 2000);
  assert.equal(result.now.remainingUncovered, 3000);
});

test("index.html: la tarjeta IN-8 declara importe, objetivo, botón y nota de resultado", () => {
  assert.match(indexSource, /id="inv18AmountNeeded"/);
  assert.match(indexSource, /id="inv18GoalSelect"/);
  assert.match(indexSource, /id="inv18CalculateRun"/);
  assert.match(indexSource, /id="inv18PlanNote"/);
});

test("app.js: el botón de INV18 llama a handleInv18CalculatePlan, y el selector de objetivo se refresca en el lote de renderizado", () => {
  assert.match(appSource, /qs\("inv18CalculateRun"\)\?\.addEventListener\("click", handleInv18CalculatePlan\);/);
  assert.match(appSource, /renderInv18GoalOptions\(\);/);
});

test("app.js: handleInv18CalculatePlan reutiliza fc5AlreadyRealized y fcx1CurrentAnnualIncome, sin campos duplicados", () => {
  const block = extractFunction("handleInv18CalculatePlan");
  assert.match(block, /qs\("fc5AlreadyRealized"\)/);
  assert.match(block, /qs\("fcx1CurrentAnnualIncome"\)/);
});
