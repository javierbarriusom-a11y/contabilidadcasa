const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CushionEngine = require("../canonical-cushion.js");

// I8 (Contabilidadcasa 2.0, sesión 217): "simulador de evento de liquidez (venta de participaciones,
// ejercicio de opciones)... integrado con cartera y colchón". INV18 (sesión previa) ya resolvía la
// mitad de cartera — qué vender y con qué coste fiscal (inv18WithdrawalPlan, probado en
// tests/inv18-plan-retirada-mas-barato.test.cjs). Esto añade la mitad de colchón que faltaba: qué le
// pasa a la liquidez si se ejecuta el plan, con el mismo cushionFloor que ya usa el resto de la app.

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

function sandboxCushionImpact({ lastSimulation = [], reserve = 0 } = {}) {
  const context = {
    window: { FinanceCanonicalCushion: CushionEngine },
    lastSimulation,
    cuadroMandosReserve: () => reserve,
    round2,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv18CushionImpact"), context);
  return context;
}

function sandboxPlanHtml() {
  const context = {
    window: { FinanceCanonicalCushion: CushionEngine },
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    IV1_POSITION_TYPE_LABELS: { fondo: "Fondo" },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv18PlanHtml"), context);
  return context;
}

function withdrawalResult(overrides = {}) {
  return {
    calculable: true,
    amountNeeded: 500,
    excludedCount: 0,
    now: { steps: [{ id: "p1", label: "Fondo X", type: "fondo", amount: 500, marginalTax: 50, netAmount: 450, effectiveRatePct: 10, method: "progressive-brackets" }], totalCovered: 500, remainingUncovered: 0, totalMarginalTax: 50, totalNet: 450, blendedRatePct: 10 },
    nextYear: null,
    ...overrides,
  };
}

// --- inv18CushionImpact (parte pura) -------------------------------------------------------------

test("inv18CushionImpact · sin plan calculable, no hay nada que mostrar", () => {
  const ctx = sandboxCushionImpact({ lastSimulation: [{ totalLiquidity: 1000 }] });
  assert.equal(ctx.inv18CushionImpact({ calculable: false }), null);
});

test("inv18CushionImpact · plan sin pasos (nada que vender todavía), no hay nada que mostrar", () => {
  const ctx = sandboxCushionImpact({ lastSimulation: [{ totalLiquidity: 1000 }] });
  const result = withdrawalResult({ now: { ...withdrawalResult().now, steps: [] } });
  assert.equal(ctx.inv18CushionImpact(result), null);
});

test("inv18CushionImpact · sin simulación de liquidez disponible, no fabrica un antes/después", () => {
  const ctx = sandboxCushionImpact({ lastSimulation: [] });
  assert.equal(ctx.inv18CushionImpact(withdrawalResult()), null);
});

test("inv18CushionImpact · el después usa el neto real del plan (totalNet), no el importe bruto pedido", () => {
  const ctx = sandboxCushionImpact({ lastSimulation: [{ totalLiquidity: 1000 }], reserve: 300 });
  const impact = ctx.inv18CushionImpact(withdrawalResult());
  assert.equal(impact.before, 1000);
  assert.equal(impact.after, 1000 + 450); // totalNet, no amountNeeded (500)
  assert.equal(impact.floor, 300);
});

test("inv18CushionImpact · sin reserva configurada, usa el mismo suelo de un mes de salidas que el resto de la app", () => {
  const ctx = sandboxCushionImpact({ lastSimulation: [{ totalLiquidity: 1000, coreSpend: 200, car: 50, refi: 0 }] });
  const impact = ctx.inv18CushionImpact(withdrawalResult());
  assert.equal(impact.floor, 250); // coreSpend + car + refi, mismo cushionFloor que usa el resto de la app
});

// --- inv18PlanHtml · el párrafo de impacto en el colchón ------------------------------------------

test("inv18PlanHtml · sin cushionImpact, no añade ningún párrafo de colchón", () => {
  const ctx = sandboxPlanHtml();
  const output = ctx.inv18PlanHtml(withdrawalResult(), null, null);
  assert.doesNotMatch(output, /colchón/i);
});

test("inv18PlanHtml · con cushionImpact, muestra el antes/después con su nivel (negativo/ajustado/holgado)", () => {
  const ctx = sandboxPlanHtml();
  const output = ctx.inv18PlanHtml(withdrawalResult(), null, { before: 100, after: 550, floor: 300 });
  assert.match(output, /Impacto en el colchón/);
  assert.match(output, /100\.00 €/);
  assert.match(output, /550\.00 €/);
  assert.match(output, /300\.00 €/);
  assert.match(output, /por debajo del mínimo operativo/); // 100 < 300 (ajustado)
  assert.match(output, /por encima del mínimo operativo/); // 550 > 300 (holgado)
});

test("inv18PlanHtml · un colchón que queda en negativo lo dice explícitamente, nunca lo suaviza", () => {
  const ctx = sandboxPlanHtml();
  const output = ctx.inv18PlanHtml(withdrawalResult(), null, { before: -50, after: 400, floor: 300 });
  assert.match(output, /en negativo/);
});

// --- wiring ---------------------------------------------------------------------------------------

test("wiring: handleInv18CalculatePlan calcula inv18CushionImpact y lo pasa a inv18PlanHtml", () => {
  const block = appSource.slice(appSource.indexOf("function handleInv18CalculatePlan("), appSource.indexOf("function handleInv18CalculatePlan(") + 1300);
  assert.match(block, /inv18PlanHtml\(result, goalContext, inv18CushionImpact\(result\)\)/);
});

test("index.html: la tarjeta de INV18 declara explícitamente que ahora también cubre el colchón (I8)", () => {
  const cardStart = indexSource.indexOf('¿De qué posición y cuándo saco X€ más barato?');
  assert.ok(cardStart >= 0);
  const card = indexSource.slice(Math.max(0, cardStart - 100), cardStart + 600);
  assert.match(card, /colchón/);
});
