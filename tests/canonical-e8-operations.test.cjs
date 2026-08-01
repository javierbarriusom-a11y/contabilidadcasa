const test = require("node:test");
const assert = require("node:assert/strict");
const E8 = require("../canonical-e8-operations.js");

test("el comparador agrupa cambios antes de restaurar", () => {
  const before = { projects: [{ id: "p1", amount: 100 }], debtContracts: [{ id: "d1", currentPrincipal: 500 }] };
  const after = { projects: [{ id: "p1", amount: 120 }, { id: "p2", amount: 50 }], debtContracts: [] };
  const result = E8.compareVersions(before, after);
  assert.equal(result.groups.projects.changed.length, 1);
  assert.equal(result.groups.projects.added.length, 1);
  assert.equal(result.groups.debts.removed.length, 1);
  assert.equal(result.totalChanges, 3);
});

test("la línea temporal combina cierres, versiones, conflictos y auditoría", () => {
  const rows = E8.operationalTimeline({ snapshots: [{ id: "s1", created_at: "2026-08-01T10:00:00Z" }], syncEvents: [{ id: "x1", created_at: "2026-08-01T11:00:00Z", status: "conflict" }], closures: [{ id: "c1", closedAt: "2026-08-01T09:00:00Z" }] });
  assert.deepEqual(rows.map((row) => row.type), ["conflict", "snapshot", "close"]);
});

test("calidad reúne movimientos, deuda y KPI sin inventar valores", () => {
  const result = E8.qualityCenter({ movements: [{ id: "m1", label: "Cargo", reconciled: false }], debtQuality: [{ id: "d1", label: "Préstamo", unknownFields: ["TAE"] }], kpis: [{ id: "k1", label: "Cobertura", confidence: "low" }] });
  assert.equal(result.total, 3);
  assert.deepEqual(result.counts, { debt: 1, kpi: 1, movement: 1 });
});

test("las acciones de alerta nunca escriben directamente", () => {
  assert.deepEqual(E8.alertQuickAction({ id: "a1", metric: "debtRatio" }), { alertId: "a1", target: "debt-control", label: "Revisar y preparar acción", requiresPreview: true, writesImmediately: false });
});

test("el presupuesto de rendimiento es medible y los adjuntos tienen límite", () => {
  assert.equal(E8.performanceBudget({ rowCount: 5000, renderMs: 100, payloadBytes: 1000 }).passed, true);
  assert.equal(E8.performanceBudget({ rowCount: 11000 }).passed, false);
  assert.throws(() => E8.normalizeAttachmentMetadata({ size: 11 * 1024 * 1024, storage: "cloud" }), /10 MB/);
});

test("el comparador conserva exactitud con diez mil movimientos", () => {
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: `m-${index}`, amount: index }));
  const changed = rows.map((row, index) => index === 5000 ? { ...row, amount: -1 } : row);
  assert.equal(E8.collectionDiff(rows, changed).count, 1);
});
