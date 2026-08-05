const test = require("node:test");
const assert = require("node:assert/strict");
const P2 = require("../p2-domain.js");

test("una aportación bancaria no puede financiar dos huchas", () => {
  const initial = P2.normalizeState({
    goals: [
      { id: "car", name: "Coche", target: 10000 },
      { id: "emergency", name: "Emergencia", target: 5000 },
    ],
  });
  const first = P2.addContributionToState(initial, "car", {
    id: "c-1",
    movementId: "bank-2026-07-001",
    amount: 500,
  });
  const duplicate = P2.addContributionToState(first.state, "emergency", {
    id: "c-2",
    movementId: "bank-2026-07-001",
    amount: 500,
  });

  assert.equal(first.added, true);
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.reason, "duplicate-movement");
  assert.equal(P2.goalSnapshot(duplicate.state.goals[0]).saved, 500);
  assert.equal(P2.goalSnapshot(duplicate.state.goals[1]).saved, 0);
});

test("la titularidad se infiere de forma estable para Javi, Tere y Hogar", () => {
  assert.equal(P2.inferOwner("Nómina Javi"), "javi");
  assert.equal(P2.inferOwner("Salario Teresa"), "tere");
  assert.equal(P2.inferOwner("Hipoteca vivienda"), "household");
  assert.equal(P2.normalizeOwner("valor-inválido", "Bonus Javi"), "javi");
});

test("los indicadores de comportamiento solo usan movimientos conciliados", () => {
  const rows = [
    { id: "1", month: "2026-01", amount: -100, category: "Alimentación", reconciled: true },
    { id: "2", month: "2026-02", amount: -200, category: "Alimentación", reconciled: true },
    { id: "3", month: "2026-03", amount: -9999, category: "Sin conciliar", reconciled: false },
    { id: "4", month: "2026-03", amount: 1000, category: "Ingresos", reconciled: true },
  ];
  const result = P2.behaviorAnalytics(rows, (row) => row.reconciled);

  assert.equal(result.totalTransactions, 4);
  assert.equal(result.reconciledTransactions, 3);
  assert.equal(result.reconciledExpenses, 2);
  assert.equal(result.reconciledAmount, 300);
  assert.deepEqual(result.categories, [["Alimentación", 300]]);
});

test("el silencio de alertas respeta la fecha configurada", () => {
  const now = new Date("2026-07-17T12:00:00Z");
  assert.equal(P2.alertMuted({ muteUntil: "2026-07-18" }, now), true);
  assert.equal(P2.alertMuted({ muteUntil: "2026-07-16" }, now), false);
  assert.equal(P2.normalizeAlert({ channel: "sms" }).channel, "app");
});

test("los documentos y exportaciones quedan normalizados y versionados", () => {
  const state = P2.normalizeState({
    documents: [{ debtId: "debt-1", title: "Oferta", fileName: "oferta.pdf", verified: true }],
    exportVersion: 4,
    exportHistory: [{ version: 3, format: "xlsx", createdAt: "2026-07-16T10:00:00Z" }],
  });

  assert.equal(state.documents[0].debtId, "debt-1");
  assert.equal(state.documents[0].deviceOnly, true);
  assert.equal(state.documents[0].verified, true);
  assert.equal(state.exportVersion, 4);
  assert.equal(state.exportHistory[0].format, "xlsx");
});

test("los objetivos E15 conservan prioridad, flexibilidad, financiación y revisión mensual", () => {
  const state = P2.normalizeState({
    goals: [{ id: "car", name: "Coche", target: 10000, priority: "high", flexibility: "fixed", fundingSource: "income" }],
    e15: { reviews: [{ monthKey: "2026-08", completedAt: "2026-08-05T10:00:00Z", notes: "Conciliado" }] },
  });
  assert.equal(state.goals[0].priority, "high");
  assert.equal(state.goals[0].flexibility, "fixed");
  assert.equal(state.goals[0].fundingSource, "income");
  assert.equal(state.e15.reviews[0].monthKey, "2026-08");
});
