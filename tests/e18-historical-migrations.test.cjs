const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const contract = require("../state-contract.js");
const inbox = require("../canonical-e11b-inbox.js");
const restore = require("../snapshot-restore.js");

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "e18-historical-states.json"), "utf8"));

function historicalEnvelope(payload, id) {
  return {
    format: contract.BACKUP_FORMAT,
    formatVersion: contract.BACKUP_VERSION,
    createdAt: "2026-08-08T12:00:00.000Z",
    appVersion: `fixture-${id}`,
    checksum: { algorithm: "fnv1a32", value: contract.fnv1a32(contract.stableStringify(payload)) },
    payload,
  };
}

test("E18 abre, migra y prepara para restaurar todas las copias históricas anonimizadas", () => {
  fixtures.forEach((fixture) => {
    const source = JSON.parse(JSON.stringify(fixture.payload));
    const envelope = historicalEnvelope(source, fixture.id);
    const migrated = contract.migrateBackupEnvelope(envelope, { appVersion: "e18-history-test" });
    const hydrated = inbox.migratePayload(migrated.payload);
    const restored = contract.buildBackupEnvelope(hydrated, { appVersion: "e18-history-restored" });
    const validation = contract.validateBackupEnvelope(restored);
    const preview = restore.buildSnapshotPreview({}, restored.payload);

    assert.equal(validation.valid, true, fixture.id);
    assert.equal(restored.payload.version, contract.PAYLOAD_VERSION, fixture.id);
    assert.equal(restored.payload.projects.length, fixture.expect.projects, fixture.id);
    assert.equal(restored.payload.dataInbox.length, fixture.expect.dataInbox, fixture.id);
    assert.equal(Object.keys(restored.payload.debtRoadmapState || {}).length, fixture.expect.debtRoadmapFields, fixture.id);
    assert.equal(restored.payload.e11b.schemaId, inbox.SCHEMA_ID, fixture.id);
    assert.ok(preview.metrics.length > 0, fixture.id);
    assert.deepEqual(source, fixture.payload, `${fixture.id}: la migración no altera la copia de origen`);
  });
});

test("E18 rechaza una fixture histórica alterada antes de iniciar la migración", () => {
  const fixture = fixtures.find((item) => item.id === "e14-debt-roadmap");
  const envelope = historicalEnvelope(fixture.payload, fixture.id);
  envelope.payload.debtRoadmapState.profile = "alterado";
  assert.throws(() => contract.migrateBackupEnvelope(envelope), /checksum/i);
});
