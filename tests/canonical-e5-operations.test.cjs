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

// A16-6 · Bloque 2: hitos y rachas sobre el mismo historial de cierres (monthClosures) que ya usa
// latestMonthOperation/isMonthClosed — sin tabla ni estado nuevo. Una racha exige meses consecutivos
// en el calendario, sin huecos; reabrir un mes lo saca de la racha porque cuenta el último estado.

function closure(monthKey, status, at) {
  return status === "closed"
    ? { monthKey, status: "closed", closedAt: at }
    : { monthKey, status: "reopened", occurredAt: at };
}

test("auditMilestonesAndStreaks · sin cierres, todo en cero y el primer hito por delante", () => {
  const result = e5.auditMilestonesAndStreaks([]);
  assert.equal(result.totalClosed, 0);
  assert.equal(result.currentStreak, 0);
  assert.equal(result.longestStreak, 0);
  assert.deepEqual(result.reachedMilestones, []);
  assert.equal(result.nextMilestone, 5);
  assert.equal(result.monthsUntilNextMilestone, 5);
});

test("auditMilestonesAndStreaks · meses consecutivos cerrados forman una racha", () => {
  const result = e5.auditMilestonesAndStreaks([
    closure("2026-01", "closed", "2026-02-01"),
    closure("2026-02", "closed", "2026-03-01"),
    closure("2026-03", "closed", "2026-04-01"),
  ]);
  assert.equal(result.totalClosed, 3);
  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
});

test("auditMilestonesAndStreaks · un hueco de calendario corta la racha aunque ambos lados estén cerrados", () => {
  const result = e5.auditMilestonesAndStreaks([
    closure("2026-01", "closed", "2026-02-01"),
    closure("2026-03", "closed", "2026-04-01"), // febrero no tiene cierre registrado
  ]);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 1);
});

test("auditMilestonesAndStreaks · un mes reabierto cuenta por su último estado, no por su historial completo", () => {
  const result = e5.auditMilestonesAndStreaks([
    closure("2026-01", "closed", "2026-02-01"),
    closure("2026-02", "closed", "2026-03-01"),
    closure("2026-02", "reopened", "2026-03-05"), // febrero se reabre después de cerrarse
  ]);
  assert.equal(result.currentStreak, 0, "el último estado de febrero es reabierto");
  assert.equal(result.longestStreak, 1, "febrero cuenta como reabierto (su último estado), así que solo enero forma racha");
});

test("auditMilestonesAndStreaks · reconoce solo el último estado de cada mes, no cualquier operación histórica", () => {
  const result = e5.auditMilestonesAndStreaks([
    closure("2026-01", "closed", "2026-02-01"),
    closure("2026-01", "reopened", "2026-02-02"),
    closure("2026-01", "closed", "2026-02-03"), // se vuelve a cerrar después
  ]);
  assert.equal(result.currentStreak, 1, "el último estado de enero es cerrado otra vez");
});

test("auditMilestonesAndStreaks · los hitos se marcan al alcanzar el número exacto de meses cerrados", () => {
  const fiveClosed = Array.from({ length: 5 }, (_, index) => closure(`2026-0${index + 1}`, "closed", `2026-${String(index + 2).padStart(2, "0")}-01`));
  const result = e5.auditMilestonesAndStreaks(fiveClosed);
  assert.deepEqual(result.reachedMilestones, [5]);
  assert.equal(result.nextMilestone, 10);
  assert.equal(result.monthsUntilNextMilestone, 5);
});

test("auditMilestonesAndStreaks · con todos los hitos alcanzados, nextMilestone es null, no un número inventado", () => {
  const hundredClosed = Array.from({ length: 100 }, (_, index) => {
    const year = 2018 + Math.floor(index / 12);
    const month = String((index % 12) + 1).padStart(2, "0");
    return closure(`${year}-${month}`, "closed", `${year}-${month}-28`);
  });
  const result = e5.auditMilestonesAndStreaks(hundredClosed);
  assert.equal(result.totalClosed, 100);
  assert.deepEqual(result.reachedMilestones, e5.MILESTONE_STEPS.slice());
  assert.equal(result.nextMilestone, null);
  assert.equal(result.monthsUntilNextMilestone, null);
});
