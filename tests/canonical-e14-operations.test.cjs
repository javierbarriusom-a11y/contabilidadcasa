const test = require("node:test");
const assert = require("node:assert/strict");
const E14 = require("../canonical-e14-operations.js");

const forecast = {
  series: [
    { monthKey: "2026-08", totals: { closingLiquidity: 5000 } },
    { monthKey: "2026-09", totals: { closingLiquidity: 4700 } },
    { monthKey: "2026-10", totals: { closingLiquidity: 4500 } },
  ],
};
const contract = { id: "debt-a", currentPrincipal: 4000 };

test("normaliza una oferta con contraparte, vigencia y documentación", () => {
  const offer = E14.normalizeOffer({ counterpart: "Gestora", amount: 2500, expiresAt: "2026-09", documents: ["offer"], status: "received" }, contract);
  assert.equal(offer.discount, 1500);
  assert.equal(offer.valid, true);
  assert.equal(offer.contractId, "debt-a");
});

test("simula una estrategia sin mutar el forecast y la traduce a eventos E13", () => {
  const before = JSON.stringify(forecast);
  const strategy = { id: "s1", contractId: "debt-a", type: "refinancing", settlementAmount: 1200, installment: 400, termMonths: 3, startMonth: "2026-08" };
  const simulation = E14.simulateStrategy(strategy, forecast);
  assert.equal(JSON.stringify(forecast), before);
  assert.equal(simulation.totalCost, 1200);
  assert.equal(simulation.minimumLiquidity, 4100);
  assert.deepEqual(E14.toScenarioEvents(strategy, forecast).map((event) => event.amount), [400, 400, 400]);
});

test("prioriza solo alternativas no dominadas que respetan el colchón", () => {
  const result = E14.optimize({ forecast, reserve: 4200, strategies: [
    { id: "unsafe", type: "single-payment", settlementAmount: 1000, startMonth: "2026-08" },
    { id: "safe", type: "single-payment", settlementAmount: 300, startMonth: "2026-08" },
  ] });
  assert.equal(result.recommendedId, "safe");
  assert.deepEqual(result.frontierIds, ["safe"]);
});

test("descarta alternativas que incumplen vencimiento o dejan una deuda suspendida sin resolver", () => {
  const result = E14.optimize({ forecast, reserve: 0, strategies: [
    { id: "late", type: "resume-payments", settlementAmount: 900, installment: 300, termMonths: 3, startMonth: "2026-08", maturityMonth: "2026-09" },
    { id: "hold", type: "hold", settlementAmount: 100, startMonth: "2026-08", arrears: 100, paymentStatus: "suspended" },
  ] });
  assert.equal(result.recommendedId, "");
  assert.ok(result.candidates.find((item) => item.id === "late").constraintIssues.includes("maturity-exceeded"));
  assert.ok(result.candidates.find((item) => item.id === "hold").constraintIssues.includes("arrears-unresolved"));
});

test("bloquea aplicar sin oferta aceptada, documentos y motivo", () => {
  const application = E14.prepareApplication({ offer: { counterpart: "Gestora", amount: 2000, expiresAt: "2026-09" }, contract, strategy: {}, simulation: { reserveSafe: true } });
  assert.equal(application.valid, false);
  assert.ok(application.issues.includes("offer-not-accepted"));
  assert.ok(application.issues.includes("missing-documents"));
  assert.ok(application.issues.includes("missing-reason"));
});
