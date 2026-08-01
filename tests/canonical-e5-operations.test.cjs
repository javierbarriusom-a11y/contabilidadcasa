const test = require("node:test");
const assert = require("node:assert/strict");
const e5 = require("../canonical-e5-operations.js");

test("reabrir crea una operación nueva y conserva el cierre", () => {
  const payload = { monthClosures: [{ id: "close-1", monthKey: "2026-07", status: "closed", closedAt: "2026-08-01T01:00:00Z", snapshotId: "snap-1" }] };
  const next = e5.reopenMonth(payload, "2026-07", { id: "reopen-1", reason: "Factura corregida", reopenedAt: "2026-08-01T02:00:00Z" });
  assert.equal(payload.monthClosures.length, 1);
  assert.equal(next.monthClosures.length, 2);
  assert.equal(next.monthClosures[1].previousOperationId, "close-1");
  assert.equal(e5.isMonthClosed(next, "2026-07"), false);
});

test("reabrir exige cierre vigente y motivo", () => {
  assert.throws(() => e5.reopenMonth({}, "2026-07", { reason: "x" }), /mes cerrado/);
  assert.throws(() => e5.reopenMonth({ monthClosures: [{ monthKey: "2026-07", status: "closed" }] }, "2026-07"), /motivo/);
});

test("deshacer un lote recupera el antes y mantiene auditoría", () => {
  const before = { projects: [{ id: "old" }] };
  const batch = e5.createImportBatch(before, { projects: [{ id: "new" }] }, { id: "batch-1", sourceLabel: "CSV", recordCount: 1 });
  const next = e5.undoImportBatch({ projects: [{ id: "new" }], importBatches: [batch] }, "batch-1", { reason: "Archivo equivocado", undoneAt: "2026-08-01T03:00:00Z" });
  assert.deepEqual(next.projects, [{ id: "old" }]);
  assert.equal(next.importBatches[0].status, "undone");
  assert.throws(() => e5.undoImportBatch(next, "batch-1", { reason: "otra vez" }), /ya fue deshecho/);
});

test("la retención protege operaciones, recientes y una muestra mensual sin borrar", () => {
  const snapshots = [
    { id: "a", created_at: "2026-08-03", operation: "save" },
    { id: "b", created_at: "2026-08-02", operation: "month-close" },
    { id: "c", created_at: "2026-07-02", operation: "save" },
    { id: "d", created_at: "2026-07-01", operation: "save" },
  ];
  const plan = e5.buildRetentionPlan(snapshots, { keepRecent: 1, keepMonthlyMonths: 1 });
  assert.deepEqual(plan.retained.map((item) => item.id), ["a", "b"]);
  assert.equal(plan.deletionAutomatic, false);
});

test("la verificación enumera copias inválidas", () => {
  const result = e5.verifySnapshotSet([{ id: "ok" }, { id: "bad" }], (row) => ({ valid: row.id === "ok" }));
  assert.equal(result.checked, 2);
  assert.equal(result.valid, 1);
  assert.equal(result.invalid[0].id, "bad");
});
