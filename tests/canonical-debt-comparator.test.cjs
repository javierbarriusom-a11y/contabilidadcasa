const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Comparator = require("../canonical-debt-comparator.js");

test("expone FinanceDebtComparator al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "canonical-debt-comparator.js"),
    "utf8",
  );
  const context = { globalThis: {} };

  vm.runInNewContext(source, context, { filename: "canonical-debt-comparator.js" });

  assert.equal(
    typeof context.globalThis.FinanceDebtComparator?.compareAgreements,
    "function",
  );
});

function option(overrides = {}) {
  return {
    id: overrides.id || "candidate",
    strategy: overrides.strategy || Comparator.STRATEGIES.SINGLE,
    label: overrides.label || "Alternativa",
    totalCost: 1_000,
    remainingDebt: 0,
    minChecking: 3_000,
    minLiquidity: 3_500,
    closeIndex: 4,
    closeLabel: "oct 26",
    finalLiquidityImpact: -1_000,
    ...overrides,
  };
}

function reference(overrides = {}) {
  return option({
    id: "no-action",
    strategy: Comparator.STRATEGIES.NO_ACTION,
    label: "No actuar",
    totalCost: 0,
    remainingDebt: 7_500,
    closeIndex: null,
    closeLabel: "Sin cierre",
    finalLiquidityImpact: 0,
    ...overrides,
  });
}

test("distributeCents reparte importes sin perder ni crear céntimos", () => {
  const amounts = Comparator.distributeCents(10, 3);
  assert.deepEqual(amounts, [3.34, 3.33, 3.33]);
  assert.equal(Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100), 1_000);
});

test("normaliza las cinco estrategias de la fase 9", () => {
  const strategies = Object.values(Comparator.STRATEGIES);
  const comparison = Comparator.compareAgreements({
    reserve: 2_500,
    alternatives: strategies.map((strategy, index) => option({
      id: strategy,
      strategy,
      remainingDebt: strategy === Comparator.STRATEGIES.NO_ACTION ? 7_500 : 0,
      totalCost: index * 100,
    })),
  });

  assert.deepEqual(
    new Set(comparison.alternatives.map((item) => item.strategy)),
    new Set(strategies),
  );
});

test("recomienda la alternativa viable que liquida con menor coste", () => {
  const comparison = Comparator.compareAgreements({
    principal: 7_500,
    reserve: 2_500,
    alternatives: [
      reference(),
      option({ id: "unsafe-cheap", totalCost: 500, minChecking: 2_000 }),
      option({ id: "safe-expensive", totalCost: 900, minChecking: 2_900 }),
      option({ id: "safe-cheap", totalCost: 700, minChecking: 2_600 }),
    ],
  });

  assert.equal(comparison.recommendedId, "safe-cheap");
  assert.equal(comparison.recommended.reserveSafe, true);
  assert.equal(comparison.recommended.reserveMargin, 100);
});

test("recomienda no actuar cuando toda acción rompe la reserva", () => {
  const comparison = Comparator.compareAgreements({
    principal: 7_500,
    reserve: 2_500,
    alternatives: [
      reference({ minChecking: 4_000 }),
      option({ id: "single", minChecking: 2_499.99 }),
      option({ id: "refinance", strategy: Comparator.STRATEGIES.REFINANCE, minChecking: 1_500 }),
    ],
  });

  assert.equal(comparison.recommendedId, "no-action");
  assert.match(comparison.reason, /ninguna alternativa respeta la reserva/i);
});

test("a igual seguridad, deuda y coste prioriza el cierre más temprano", () => {
  const comparison = Comparator.compareAgreements({
    reserve: 2_500,
    alternatives: [
      reference(),
      option({ id: "late", closeIndex: 12, closeLabel: "jun 27" }),
      option({ id: "early", closeIndex: 5, closeLabel: "nov 26" }),
    ],
  });

  assert.equal(comparison.recommendedId, "early");
});

test("crea una referencia no actuar si el consumidor no la aporta", () => {
  const comparison = Comparator.compareAgreements({
    principal: 2_000,
    reserve: 1_500,
    alternatives: [option({ id: "single" })],
  });

  assert.equal(comparison.reference.strategy, Comparator.STRATEGIES.NO_ACTION);
  assert.equal(comparison.reference.remainingDebt, 2_000);
  assert.equal(comparison.alternatives[0].isReference, true);
});
