const assert = require("node:assert/strict");
const test = require("node:test");
const canonical = require("../canonical-state.js");

function payload(overrides = {}) {
  return {
    sourceWorkbook: "Contabilidad Casa_2026_Mayo2026.xlsx",
    updatedAt: "2026-07-13T10:00:00.000Z",
    projects: [],
    debtLiquidations: [],
    decisionEvents: [],
    incomeActuals: {},
    expenseActuals: {},
    balanceSettings: {},
    customPlanningRows: [],
    deletedPlanningRows: {},
    seriesOverrides: {},
    rowLabelOverrides: {},
    movementMappings: {},
    ...overrides,
  };
}

function rows(snapshot) {
  return Object.values(snapshot.entities).flat();
}

test("un proyecto conserva identidad al renombrarlo o reordenarlo", () => {
  const first = canonical.buildCanonicalSnapshot(payload({
    projects: [
      { id: "project-car", name: "Coche", amount: 25000 },
      { id: "project-trip", name: "Viaje", amount: 1500 },
    ],
  }), null, { now: "2026-07-13T10:00:00.000Z" });
  const second = canonical.buildCanonicalSnapshot(payload({
    projects: [
      { id: "project-trip", name: "Vacaciones familiares", amount: 1500 },
      { id: "project-car", name: "Coche familiar", amount: 25000 },
    ],
  }), first, { now: "2026-07-13T11:00:00.000Z" });

  const firstIds = Object.fromEntries(first.entities.projects.map((item) => [item.legacyId, item.id]));
  const secondIds = Object.fromEntries(second.entities.projects.map((item) => [item.legacyId, item.id]));
  assert.deepEqual(secondIds, firstIds);
  assert.equal(second.auditTrail[0].changes.added, 0);
  assert.equal(second.auditTrail[0].changes.removed, 0);
  assert.equal(second.auditTrail[0].changes.changed, 2);
});

test("una decisión de deuda conserva identidad aunque cambien nombre y modalidad", () => {
  const first = canonical.buildCanonicalSnapshot(payload({
    debtLiquidations: [{ id: "decision-1", targetId: "debt-wizink", name: "Wizink", mode: "single", amount: 3000 }],
  }));
  const second = canonical.buildCanonicalSnapshot(payload({
    debtLiquidations: [{ id: "decision-1", targetId: "debt-wizink", name: "Acuerdo Wizink", mode: "installments", amount: 3000 }],
  }), first, { now: "2026-07-13T11:00:00.000Z" });

  assert.equal(second.entities.debtDecisions[0].id, first.entities.debtDecisions[0].id);
  assert.equal(second.auditTrail[0].changes.changed, 1);
});

test("los contratos de deuda conservan suspensión, atrasos y reunificación como estados distintos", () => {
  const snapshot = canonical.buildCanonicalSnapshot(payload({
    debtContracts: [
      {
        id: "wizink-suspendida",
        entity: "Wizink",
        type: "Tarjeta",
        number: "5267",
        currentPrincipal: 7381.63,
        currentPayment: 0,
        scheduledPayment: 0,
        paymentStatus: "suspended",
        paymentsSuspended: true,
        arrearsMonths: 6,
        arrearsEstimated: 1150.32,
      },
      {
        id: "cetelem-reunificado",
        entity: "Cetelem",
        type: "Plan reunificado",
        number: "reunificacion-cetelem",
        currentPrincipal: 20614.41,
        currentPayment: 259,
        scheduledPayment: 259,
        paymentStatus: "reunified",
        reunified: true,
      },
    ],
  }));

  const suspended = snapshot.entities.debtContracts.find((item) => item.legacyId === "wizink-suspendida");
  const reunified = snapshot.entities.debtContracts.find((item) => item.legacyId === "cetelem-reunificado");

  assert.equal(suspended.status, "pending");
  assert.equal(suspended.currentPayment, 0);
  assert.equal(suspended.arrearsEstimated, 1150.32);
  assert.equal(reunified.status, "fixed");
  assert.equal(reunified.currentPayment, 259);
});

test("la migración inventaría todas las colecciones persistidas", () => {
  const snapshot = canonical.buildCanonicalSnapshot(payload({
    projects: [{ id: "p1", name: "Lavadora", amount: 900, status: "pendiente" }],
    debtLiquidations: [{ id: "d1", targetId: "loan-1", name: "Acuerdo", amount: 1200, locked: true }],
    decisionEvents: [{ id: "e1", name: "Aprobación", status: "ejecutado", amount: 1200 }],
    incomeActuals: { "2026-07:salary": 3500 },
    expenseActuals: { "2026-07:power": 90 },
    balanceSettings: { mode: "manual", caixaBalance: 5000, mediolanumBalance: 1500 },
    customPlanningRows: [{ id: "row-1", label: "Colegio", kind: "expense", amount: 300 }],
    deletedPlanningRows: ["row-deleted"],
    seriesOverrides: {
      "2026-07:row-1": { planned: 310 },
      "2026-07:row-2": { actual: 44 },
      "2026-07:row-3": { deleted: true },
    },
    rowLabelOverrides: { "row-1": "Colegio actualizado" },
    movementMappings: { NOMINA: { label: "Nómina", kind: "income", rowKey: "salary" } },
  }));

  const expectedCounts = {
    projects: 1,
    debtDecisions: 1,
    planningRows: 1,
    actuals: 2,
    accounts: 2,
    tombstones: 1,
    seriesOverrides: 3,
    labelOverrides: 1,
    movementMappings: 1,
    decisionEvents: 1,
  };
  Object.entries(expectedCounts).forEach(([collection, count]) => {
    assert.equal(snapshot.entities[collection].length, count, collection);
  });
  assert.equal(snapshot.quality.entityCount, 14);
  assert.equal(snapshot.quality.issueCount, 0);
  assert.equal(snapshot.quality.score, 100);
});

test("reales, borrados y estados heredados reciben semántica consistente", () => {
  const snapshot = canonical.buildCanonicalSnapshot(payload({
    projects: [{ id: "p1", name: "Proyecto", status: "devuelto a simulación" }],
    incomeActuals: { "2026-07:salary": 3500 },
    deletedPlanningRows: { "row-1": true },
    seriesOverrides: { "2026-07:row-2": { actual: 44 } },
  }));

  assert.equal(snapshot.entities.projects[0].status, "simulated");
  assert.equal(snapshot.entities.actuals[0].status, "executed");
  assert.equal(snapshot.entities.actuals[0].provenance, "verified");
  assert.equal(snapshot.entities.tombstones[0].status, "cancelled");
  assert.equal(snapshot.entities.seriesOverrides[0].provenance, "verified");
});

test("un borrado heredado en formato lista no permite que la partida reaparezca", () => {
  const cleaned = canonical.canonicalizePayload(payload({
    deletedPlanningRows: ["row-luz"],
    customPlanningRows: [
      { id: "row-luz", label: "Luz", kind: "expense", amount: 90 },
      { id: "row-agua", label: "Agua", kind: "expense", amount: 35 },
    ],
  }));

  assert.deepEqual(cleaned.deletedPlanningRows, { "row-luz": true });
  assert.deepEqual(cleaned.customPlanningRows.map((row) => row.id), ["row-agua"]);
});

test("la normalización conserva solo una versión de cada partida personalizada", () => {
  const cleaned = canonical.canonicalizePayload(payload({
    customPlanningRows: [
      { id: "row-luz", label: "Luz", kind: "expense", amount: 90, updatedAt: "2026-07-01T10:00:00.000Z" },
      { id: "row-luz", label: "Luz", kind: "expense", amount: 95, updatedAt: "2026-07-02T10:00:00.000Z" },
    ],
  }));

  assert.equal(cleaned.customPlanningRows.length, 1);
  assert.equal(cleaned.customPlanningRows[0].amount, 95);
});

test("el historial distingue altas, cambios y bajas sin duplicar huellas idénticas", () => {
  const first = canonical.buildCanonicalSnapshot(payload({ projects: [{ id: "p1", name: "Proyecto", amount: 100 }] }), null, {
    now: "2026-07-13T10:00:00.000Z",
  });
  const unchanged = canonical.buildCanonicalSnapshot(payload({ projects: [{ id: "p1", name: "Proyecto", amount: 100 }] }), first, {
    now: "2026-07-13T11:00:00.000Z",
  });
  const changed = canonical.buildCanonicalSnapshot(payload({ projects: [{ id: "p1", name: "Proyecto", amount: 150 }] }), first, {
    now: "2026-07-13T12:00:00.000Z",
  });
  const removed = canonical.buildCanonicalSnapshot(payload(), changed, {
    now: "2026-07-13T13:00:00.000Z",
  });

  assert.strictEqual(unchanged, first);
  assert.deepEqual(first.auditTrail[0].changes, { added: 3, changed: 0, removed: 0 });
  assert.deepEqual(changed.auditTrail[0].changes, { added: 0, changed: 1, removed: 0 });
  assert.deepEqual(removed.auditTrail[0].changes, { added: 0, changed: 0, removed: 1 });
  assert.equal(new Set(rows(changed).map((item) => item.id)).size, rows(changed).length);
});

test("la reconstrucción forzada conserva el historial de auditoría", () => {
  const first = canonical.buildCanonicalSnapshot(payload(), null, {
    now: "2026-07-13T10:00:00.000Z",
  });
  const rebuilt = canonical.buildCanonicalSnapshot(payload(), first, {
    now: "2026-07-13T10:05:00.000Z",
    reason: "manual-rebuild",
    force: true,
  });

  assert.equal(rebuilt.auditTrail.length, first.auditTrail.length + 1);
  assert.equal(rebuilt.auditTrail[0].reason, "manual-rebuild");
  assert.deepEqual(rebuilt.auditTrail[0].changes, { added: 0, changed: 0, removed: 0 });
});

test("solo se permiten transiciones de estado explícitas", () => {
  assert.equal(canonical.validateTransition("simulated", "pending"), true);
  assert.equal(canonical.validateTransition("approved", "fixed"), true);
  assert.equal(canonical.validateTransition("fixed", "executed"), true);
  assert.equal(canonical.validateTransition("executed", "pending"), false);
});
