const assert = require("node:assert/strict");
const test = require("node:test");
const store = require("../canonical-supabase-store.js");

function payload() {
  return {
    version: 1,
    sourceWorkbook: "Contabilidad.xlsx",
    canonicalSnapshot: {
      fingerprint: "canonical-1",
      entities: {
        accounts: [{ id: "account-caixabank", label: "CaixaBank", amount: 5000, status: "fixed", provenance: "verified" }],
        planningRows: [{ id: "concept-salary", label: "Nómina", amount: 3500, status: "fixed", provenance: "declared" }],
        actuals: [{ id: "actual-1", label: "Nómina julio", amount: 3519, monthKey: "2026-07", flowType: "income" }],
        debtContracts: [{ id: "debt-1", label: "Wizink", amount: 7381.63, status: "pending" }],
        debtDecisions: [],
        projects: [{ id: "project-car", label: "Coche", amount: 25000, status: "simulated" }],
        tombstones: [], seriesOverrides: [], labelOverrides: [], movementMappings: [],
        decisionEvents: [{ id: "event-1", label: "Proyecto aprobado", status: "approved", amount: 25000 }],
      },
    },
    canonicalLedgerSnapshot: {
      fingerprint: "ledger-1",
      entries: [{ id: "mov-1", description: "Nómina", amount: 3519, date: "2026-07-31", monthKey: "2026-07", accountId: "caixabank", kind: "income" }],
      quality: { score: 98, differenceMonths: 1 },
      reconciliation: [{ monthKey: "2026-07", difference: 0 }],
      balanceChecks: [],
    },
    decisionWorkflow: {
      decisions: [{ id: "decision-1", name: "Comprar coche", status: "pending", amount: 25000 }],
      events: [{ id: "workflow-event-1", type: "created", status: "pending" }],
    },
  };
}

test("normaliza el estado en proyecciones y registros append-only", () => {
  const bundle = store.buildNormalizedBundle(payload(), {
    userId: "00000000-0000-4000-a000-000000000001",
    sourceKey: "home",
    syncId: "00000000-0000-4000-a000-000000000002",
    snapshotId: "00000000-0000-4000-a000-000000000003",
    reconciliationId: "00000000-0000-4000-a000-000000000004",
    now: "2026-07-15T10:00:00.000Z",
  });
  assert.equal(bundle.schemaId, store.SCHEMA_ID);
  assert.equal(bundle.projections.finance_accounts.length, 1);
  assert.equal(bundle.projections.finance_concepts.length, 1);
  assert.equal(bundle.projections.finance_ledger_entries.length, 2);
  assert.equal(bundle.projections.finance_debts.length, 1);
  assert.equal(bundle.projections.finance_projects.length, 1);
  assert.equal(bundle.projections.finance_decisions.length, 1);
  assert.equal(bundle.appendOnly.finance_decision_events.length, 2);
  assert.equal(bundle.appendOnly.finance_reconciliation_runs[0].quality_score, 98);
  assert.deepEqual(bundle.snapshotRow.state, payload());
});

test("la huella es estable aunque cambien identificadores de sincronización", () => {
  const first = store.buildNormalizedBundle(payload(), { userId: "u", sourceKey: "home", syncId: "sync-a", now: "2026-07-15T10:00:00.000Z" });
  const second = store.buildNormalizedBundle(payload(), { userId: "u", sourceKey: "home", syncId: "sync-b", now: "2026-07-15T11:00:00.000Z" });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.snapshotRow.checksum, second.snapshotRow.checksum);
  assert.ok(first.fingerprint.length >= 24);
  assert.equal(store.verifySnapshot(first.snapshotRow).valid, true);
});

test("concilia el libro remoto por conteo, ID, importe y huella", () => {
  const expected = [
    { entity_id: "b", amount: 20, active: true },
    { entity_id: "a", amount: 10, active: true },
  ];
  const equal = store.reconcileLedgerRows(expected, [...expected].reverse());
  assert.equal(equal.valid, true);
  assert.equal(equal.expectedCount, 2);
  assert.equal(equal.expectedFingerprint, equal.remoteFingerprint);

  const mismatch = store.reconcileLedgerRows(expected, [
    { entity_id: "a", amount: 11, active: true },
    { entity_id: "c", amount: 20, active: true },
  ]);
  assert.equal(mismatch.valid, false);
  assert.deepEqual(mismatch.missingIds, ["b"]);
  assert.deepEqual(mismatch.unexpectedIds, ["c"]);
  assert.deepEqual(mismatch.amountMismatchIds, ["a"]);
});

test("rechaza una copia cuyo contenido no coincide con su huella", () => {
  const bundle = store.buildNormalizedBundle(payload(), {
    userId: "u",
    sourceKey: "home",
    syncId: "sync-a",
    now: "2026-07-15T10:00:00.000Z",
  });
  bundle.snapshotRow.state.sourceWorkbook = "Alterado.xlsx";
  const verification = store.verifySnapshot(bundle.snapshotRow);
  assert.equal(verification.valid, false);
  assert.equal(verification.reason, "fingerprint-mismatch");
});

test("la copia E6 usa la misma representación JSON para huella y recuperación", () => {
  const e6Payload = payload();
  e6Payload.scenarioSettings = {
    e6Coverage: { nextIncomeDate: "2026-08-25", dailyOutflow: 42.5 },
    optionalValue: undefined,
  };
  const bundle = store.buildNormalizedBundle(e6Payload, {
    userId: "00000000-0000-4000-8000-000000000001",
    sourceKey: "test-source",
    now: "2026-08-01T12:00:00.000Z",
  });
  const transported = JSON.parse(JSON.stringify(bundle.snapshotRow));
  assert.equal(store.verifySnapshot(transported).valid, true);
  assert.deepEqual(transported.state.scenarioSettings.e6Coverage, e6Payload.scenarioSettings.e6Coverage);
  assert.equal("optionalValue" in transported.state.scenarioSettings, false);
});

test("detecta tablas normalizadas todavía no instaladas", () => {
  assert.equal(store.isMissingSchemaError({ code: "42P01", message: "relation does not exist" }), true);
  assert.equal(store.isMissingSchemaError({ code: "PGRST205", message: "Could not find the table" }), true);
  assert.equal(store.isMissingSchemaError({ code: "42501", message: "permission denied" }), false);
});

test("conserva todos los eventos de una misma decisión en el registro inmutable", () => {
  const sample = payload();
  sample.decisionWorkflow.events = [
    { id: "decision-1", type: "proposed", at: "2026-07-15T09:00:00.000Z", status: "proposed" },
    { id: "decision-1", type: "approved", at: "2026-07-15T10:00:00.000Z", status: "approved" },
  ];
  sample.canonicalSnapshot.entities.decisionEvents = [];
  const bundle = store.buildNormalizedBundle(sample, {
    userId: "00000000-0000-4000-a000-000000000001",
    sourceKey: "home",
    syncId: "00000000-0000-4000-a000-000000000002",
    now: "2026-07-15T11:00:00.000Z",
  });
  const events = bundle.appendOnly.finance_decision_events;
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map((event) => event.event_key)).size, 2);
  assert.deepEqual(events.map((event) => event.event_type), ["proposed", "approved"]);
});

test("el puntero activo manda sobre una instantánea más reciente", () => {
  const active = store.buildNormalizedBundle(payload(), {
    userId: "u", sourceKey: "home", syncId: "sync-active", snapshotId: "active", now: "2026-07-15T10:00:00.000Z",
  }).snapshotRow;
  const newerPayload = payload();
  newerPayload.sourceWorkbook = "Copia antigua más reciente.xlsx";
  const newer = store.buildNormalizedBundle(newerPayload, {
    userId: "u", sourceKey: "home", syncId: "sync-newer", snapshotId: "newer", now: "2026-07-16T10:00:00.000Z",
  }).snapshotRow;

  const selected = store.selectAuthoritativeState({
    head: { snapshot_id: "active", fingerprint: active.fingerprint },
    snapshots: [newer, active],
    legacy: { state: newerPayload },
  });

  assert.equal(selected.source, "normalized-head");
  assert.equal(selected.snapshot.id, "active");
  assert.equal(selected.state.sourceWorkbook, "Contabilidad.xlsx");
});

test("un puntero activo corrupto recupera una copia verificada sin usar el legado", () => {
  const valid = store.buildNormalizedBundle(payload(), {
    userId: "u", sourceKey: "home", syncId: "sync-valid", snapshotId: "valid", now: "2026-07-15T10:00:00.000Z",
  }).snapshotRow;
  const corrupt = { ...valid, id: "corrupt", fingerprint: "not-the-right-fingerprint", created_at: "2026-07-16T10:00:00.000Z" };
  const selected = store.selectAuthoritativeState({
    head: { snapshot_id: "corrupt", fingerprint: "not-the-right-fingerprint" },
    snapshots: [corrupt, valid],
    legacy: { state: { sourceWorkbook: "No debe ganar.xlsx" } },
  });

  assert.equal(selected.source, "normalized-snapshot-recovery");
  assert.equal(selected.snapshot.id, "valid");
  assert.equal(selected.integrityIssue, "active-head-invalid");
});

test("el legado exige una migración explícita cuando no hay copia normalizada", () => {
  const legacy = { state: { sourceWorkbook: "Antiguo.xlsx" } };
  const blocked = store.selectAuthoritativeState({ legacy });
  assert.equal(blocked.source, "legacy-migration-required");
  assert.equal(blocked.state, null);
  assert.equal(blocked.requiresMigration, true);
  const approved = store.selectAuthoritativeState({ legacy, allowLegacyMigration: true });
  assert.equal(approved.source, "legacy-migration");
  assert.equal(approved.state.sourceWorkbook, "Antiguo.xlsx");
});
