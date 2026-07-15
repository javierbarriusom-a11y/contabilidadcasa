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
