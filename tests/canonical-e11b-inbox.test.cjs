const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../canonical-e11b-inbox.js");

test("detecta formatos y prepara una entrada sin guardar el fichero crudo", () => {
  const item = api.buildInboxItem({ fileName: "extracto.csv", rows: [{ id: "a", amount: 10 }], comparison: { valid: true } }, { id: "inbox-1", at: "2026-08-01T10:00:00Z" });
  assert.equal(item.source, "csv");
  assert.equal(item.status, "ready");
  assert.equal(item.rawStored, false);
});

test("bloquea comparaciones inválidas y exige transiciones seguras", () => {
  const item = api.buildInboxItem({ source: "pasted-table", rows: [{}], comparison: { valid: false } }, { id: "inbox-2", at: "2026-08-01T10:00:00Z" });
  assert.equal(item.status, "blocked");
  assert.throws(() => api.transition(item, "applied"));
});

test("crea recibo y conserva una ruta auditable para deshacer", () => {
  const ready = api.buildInboxItem({ source: "csv", sourceLabel: "agosto.csv", rows: [{ id: "a" }], comparison: { valid: true } }, { id: "inbox-3", at: "2026-08-01T10:00:00Z" });
  const applied = api.transition(ready, "applied", { at: "2026-08-01T10:01:00Z", batchId: "batch-1", receiptId: "receipt-1" });
  const receipt = api.buildReceipt(applied, { batchId: "batch-1", changed: { records: 1 }, recalculated: ["forecast"] }, { id: "receipt-1", at: "2026-08-01T10:01:00Z" });
  assert.equal(receipt.undoAvailable, true);
  assert.deepEqual(receipt.recalculated, ["forecast"]);
  assert.equal(api.transition(applied, "undone", { reason: "duplicado" }).status, "undone");
});

test("migra copias anteriores sin pérdida y permite desactivar la bandeja", () => {
  const legacy = { version: 1, projects: [{ id: "p1" }] };
  const migrated = api.migratePayload(legacy);
  assert.deepEqual(migrated.projects, legacy.projects);
  assert.deepEqual(migrated.dataInbox, []);
  assert.equal(migrated.e11b.enabled, true);
  assert.notEqual(migrated, legacy);
});

test("calcula frescura y genera tareas de conciliación seguras", () => {
  const report = api.freshness({ balanceDate: "2026-08-01", movements: [{ date: "2026-08-01" }], actuals: [], forecastDate: "2026-08-01", debtDate: "2026-08-01" }, { asOf: "2026-08-01" });
  assert.equal(report.coveragePercent, 80);
  const tasks = api.reconciliationTasks({ unclassified: [{ id: "m1" }], differences: [{ id: "d1" }], balanceGaps: [{ accountId: "caixa" }] });
  assert.deepEqual(tasks.map((item) => item.action), ["classify", "correct-actual", "adjust-balance"]);
  assert.ok(tasks.every((item) => item.safe));
});
