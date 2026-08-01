const test = require("node:test");
const assert = require("node:assert/strict");
const ReadModel = require("../executive-read-model.js");

test("el contrato ejecutivo entrega una lectura versionada común", () => {
  const model = ReadModel.build({
    generatedAt: "2026-08-01T10:00:00.000Z",
    asOf: "2026-08-01",
    actions: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    alerts: [{ id: "risk" }],
    capacity: { free: 200 },
    context: { family: "household" },
    metrics: {
      liquidity: { value: 5000, unit: "EUR", source: "ledger", method: "sum-accounts", coverage: "2/2 accounts", confidence: "high" },
    },
  });
  assert.equal(model.schema, ReadModel.SCHEMA_ID);
  assert.equal(model.decisions.length, 3);
  assert.equal(model.decisions[2].rank, 3);
  assert.equal(model.metrics.liquidity.asOf, "2026-08-01");
  assert.equal(model.quality.complete, true);
});

test("los KPI sin metadatos quedan marcados y nunca aparentan confianza", () => {
  const model = ReadModel.build({ metrics: { capacity: { value: 100 } } });
  assert.deepEqual(model.quality.missingMetadata, ["capacity"]);
  assert.deepEqual(model.quality.lowConfidence, ["capacity"]);
});
