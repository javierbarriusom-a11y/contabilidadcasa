(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalSupabaseStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-normalized-store-v2";

  function text(value) {
    return String(value ?? "").trim();
  }

  function numeric(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hashText(value) {
    let hashA = 2166136261;
    let hashB = 2246822519;
    const source = text(value);
    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      hashA ^= code;
      hashA = Math.imul(hashA, 16777619);
      hashB ^= code + index;
      hashB = Math.imul(hashB, 3266489917);
    }
    const first = (hashA >>> 0).toString(16).padStart(8, "0");
    const second = (hashB >>> 0).toString(16).padStart(8, "0");
    const length = source.length.toString(16).padStart(8, "0");
    return `${first}${second}${length}`;
  }

  function withoutVolatile(value) {
    if (Array.isArray(value)) return value.map(withoutVolatile);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["updatedAt", "generatedAt", "auditTrail"].includes(key))
      .map(([key, item]) => [key, withoutVolatile(item)]));
  }

  function fallbackUuid(seed) {
    const source = `${seed}-${Date.now()}-${Math.random()}`;
    const parts = [0, 1, 2, 3].map((index) => hashText(`${source}-${index}`));
    return `${parts[0]}-${parts[1].slice(0, 4)}-4${parts[1].slice(5, 8)}-a${parts[2].slice(1, 4)}-${parts[2].slice(4)}${parts[3]}`.slice(0, 36);
  }

  function createUuid(seed = "sync") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return fallbackUuid(seed);
  }

  function collections(snapshot) {
    return snapshot?.entities && typeof snapshot.entities === "object" ? snapshot.entities : {};
  }

  function fingerprintPayload(payload) {
    return hashText(stableStringify(withoutVolatile(payload)));
  }

  function verifySnapshot(snapshotRow) {
    if (!snapshotRow?.state || !snapshotRow?.fingerprint) {
      return { valid: false, expected: "", actual: "", reason: "snapshot-incomplete" };
    }
    const actual = fingerprintPayload(snapshotRow.state);
    const expected = text(snapshotRow.fingerprint);
    return {
      valid: actual === expected,
      expected,
      actual,
      reason: actual === expected ? "ok" : "fingerprint-mismatch",
    };
  }

  function entityRow(entity, context = {}, additions = {}) {
    return {
      user_id: context.userId,
      source_key: context.sourceKey,
      entity_id: text(entity?.id || entity?.legacyId || additions.entity_id),
      sync_id: context.syncId,
      label: text(entity?.label || additions.label),
      status: text(entity?.status || additions.status || "fixed"),
      provenance: text(entity?.provenance || additions.provenance || "declared"),
      owner: text(entity?.owner || additions.owner || "household"),
      month_key: text(entity?.monthKey || additions.month_key),
      amount: numeric(entity?.amount ?? additions.amount),
      active: additions.active !== false,
      data: { ...(entity || {}), ...(additions.data || {}) },
      updated_at: context.now,
    };
  }

  function decisionRows(payload, context) {
    const workflow = payload?.decisionWorkflow || {};
    const values = Array.isArray(workflow.decisions)
      ? workflow.decisions
      : workflow.decisions && typeof workflow.decisions === "object"
        ? Object.values(workflow.decisions)
        : [];
    return values.map((decision, index) => entityRow(decision, context, {
      entity_id: decision.id || `decision-${index}`,
      label: decision.label || decision.name || `Decisión ${index + 1}`,
      status: decision.status || "pending",
      provenance: decision.provenance || "declared",
      month_key: decision.monthKey || decision.startMonthKey,
      amount: decision.amount || decision.totalAmount,
      data: { decisionType: decision.type || decision.kind || "decision" },
    }));
  }

  function uniqueRows(rows) {
    const byId = new Map();
    rows.filter((row) => row.entity_id).forEach((row) => byId.set(row.entity_id, row));
    return Array.from(byId.values());
  }

  function ledgerComparableRow(row = {}) {
    return {
      entityId: text(row.entity_id || row.id || row.entryId),
      amount: numeric(row.amount),
      active: row.active !== false,
    };
  }

  function reconcileLedgerRows(expectedRows = [], remoteRows = []) {
    const expected = expectedRows.map(ledgerComparableRow).filter((row) => row.active).sort((a, b) => a.entityId.localeCompare(b.entityId));
    const remote = remoteRows.map(ledgerComparableRow).filter((row) => row.active).sort((a, b) => a.entityId.localeCompare(b.entityId));
    const expectedById = new Map(expected.map((row) => [row.entityId, row]));
    const remoteById = new Map(remote.map((row) => [row.entityId, row]));
    const missingIds = expected.filter((row) => !remoteById.has(row.entityId)).map((row) => row.entityId);
    const unexpectedIds = remote.filter((row) => !expectedById.has(row.entityId)).map((row) => row.entityId);
    const amountMismatchIds = expected.filter((row) => remoteById.has(row.entityId)
      && numeric(remoteById.get(row.entityId).amount) !== numeric(row.amount)).map((row) => row.entityId);
    const expectedFingerprint = hashText(stableStringify(expected));
    const remoteFingerprint = hashText(stableStringify(remote));
    return {
      valid: expected.length === remote.length && !missingIds.length && !unexpectedIds.length && !amountMismatchIds.length
        && expectedFingerprint === remoteFingerprint,
      expectedCount: expected.length,
      remoteCount: remote.length,
      expectedFingerprint,
      remoteFingerprint,
      missingIds,
      unexpectedIds,
      amountMismatchIds,
    };
  }

  function buildNormalizedBundle(payload = {}, options = {}) {
    const now = options.now || new Date().toISOString();
    const syncId = options.syncId || createUuid("finance-sync");
    const snapshotId = options.snapshotId || createUuid("finance-snapshot");
    const context = {
      userId: options.userId,
      sourceKey: options.sourceKey || payload.sourceWorkbook || "finance-dashboard",
      syncId,
      now,
    };
    if (!context.userId) throw new Error("userId es obligatorio para normalizar el estado");

    const snapshot = payload.canonicalSnapshot || {};
    const ledger = payload.canonicalLedgerSnapshot || {};
    const entityCollections = collections(snapshot);
    const conceptKinds = ["planningRows", "tombstones", "seriesOverrides", "labelOverrides", "movementMappings"];
    const concepts = conceptKinds.flatMap((kind) => (entityCollections[kind] || []).map((entity) => entityRow(entity, context, {
      data: { collection: kind },
    })));
    const ledgerEntries = (ledger.entries || []).map((entry, index) => entityRow(entry, context, {
      entity_id: entry.id || entry.entryId || `ledger-${index}`,
      label: entry.description || entry.label || entry.concept || `Movimiento ${index + 1}`,
      status: "executed",
      provenance: entry.provenance || "verified",
      owner: entry.owner || "household",
      month_key: entry.monthKey || text(entry.date).slice(0, 7),
      amount: entry.amount,
      data: { accountId: entry.accountId || "caixabank", kind: entry.kind || "movement" },
    }));
    const actualEntries = (entityCollections.actuals || []).map((entity) => entityRow(entity, context, {
      entity_id: entity.id,
      data: { accountId: "unassigned", kind: entity.flowType || "actual" },
    }));

    const projections = {
      finance_accounts: uniqueRows((entityCollections.accounts || []).map((entity) => entityRow(entity, context))),
      finance_concepts: uniqueRows(concepts),
      finance_ledger_entries: uniqueRows([...ledgerEntries, ...actualEntries]),
      finance_debts: uniqueRows([
        ...(entityCollections.debtContracts || []).map((entity) => entityRow(entity, context, { data: { recordType: "contract" } })),
        ...(entityCollections.debtDecisions || []).map((entity) => entityRow(entity, context, { data: { recordType: "decision" } })),
      ]),
      finance_projects: uniqueRows((entityCollections.projects || []).map((entity) => entityRow(entity, context))),
      finance_decisions: uniqueRows(decisionRows(payload, context)),
    };

    const workflowEvents = Array.isArray(payload?.decisionWorkflow?.events) ? payload.decisionWorkflow.events : [];
    const canonicalEvents = entityCollections.decisionEvents || [];
    const decisionEvents = [...workflowEvents, ...canonicalEvents].map((event, index) => entityRow(event, context, {
      entity_id: event.id || `event-${hashText(stableStringify({ event, index }))}`,
      label: event.label || event.name || event.type || `Evento ${index + 1}`,
      status: event.status || "executed",
      month_key: event.monthKey || text(event.at || event.date).slice(0, 7),
      amount: event.amount,
      data: { occurredAt: event.at || event.date || now, eventType: event.type || event.kind || "decision-event" },
    }));

    const persistedPayload = JSON.parse(JSON.stringify(payload));
    const fingerprint = fingerprintPayload(persistedPayload);
    const entityCount = Object.values(projections).reduce((total, rows) => total + rows.length, 0);

    return {
      schemaId: SCHEMA_ID,
      syncId,
      fingerprint,
      syncRun: {
        id: syncId,
        user_id: context.userId,
        source_key: context.sourceKey,
        status: "running",
        schema_version: SCHEMA_ID,
        fingerprint,
        entity_count: entityCount,
        started_at: now,
        metadata: { payloadVersion: payload.version || 1, sourceWorkbook: payload.sourceWorkbook || "" },
      },
      snapshotRow: {
        id: snapshotId,
        user_id: context.userId,
        source_key: context.sourceKey,
        sync_id: syncId,
        version: Number(payload.version || 1),
        fingerprint,
        checksum: fingerprint,
        state: persistedPayload,
        created_at: now,
      },
      sourceHead: {
        user_id: context.userId,
        source_key: context.sourceKey,
        sync_id: syncId,
        snapshot_id: snapshotId,
        fingerprint,
        schema_version: SCHEMA_ID,
        updated_at: now,
      },
      projections,
      appendOnly: {
        finance_import_batches: (Array.isArray(payload.importBatches) ? payload.importBatches : []).map((batch) => ({
          id: text(batch.id), user_id: context.userId, source_key: context.sourceKey,
          sync_id: context.syncId, status: text(batch.status || "applied"),
          source_label: text(batch.sourceLabel || "Importación"), reason: text(batch.reason),
          record_count: numeric(batch.recordCount), before_state: batch.beforeState || {},
          after_fingerprint: text(batch.afterFingerprint), created_at: batch.createdAt || now,
          undone_at: batch.undoneAt || null, undo_reason: text(batch.undoReason),
        })).filter((batch) => batch.id),
        finance_decision_events: decisionEvents.map((row) => ({
          id: createUuid(row.entity_id),
          user_id: row.user_id,
          source_key: row.source_key,
          sync_id: row.sync_id,
          event_key: hashText(stableStringify({
            entityId: row.entity_id,
            eventType: row.data.eventType || "decision-event",
            occurredAt: row.data.occurredAt || now,
            status: row.status,
            amount: row.amount,
          })),
          entity_id: row.entity_id,
          event_type: row.data.eventType || "decision-event",
          status: row.status,
          amount: row.amount,
          occurred_at: row.data.occurredAt || now,
          data: row.data,
        })),
        finance_reconciliation_runs: [{
          id: options.reconciliationId || createUuid("finance-reconciliation"),
          user_id: context.userId,
          source_key: context.sourceKey,
          sync_id: syncId,
          fingerprint: ledger.fingerprint || fingerprint,
          quality_score: numeric(ledger?.quality?.score),
          difference_months: numeric(ledger?.quality?.differenceMonths),
          data: {
            reconciliation: ledger.reconciliation || [],
            balanceChecks: ledger.balanceChecks || [],
            quality: ledger.quality || null,
          },
          created_at: now,
        }],
      },
    };
  }

  function isMissingSchemaError(error) {
    const code = text(error?.code).toUpperCase();
    const message = text(error?.message).toLowerCase();
    return ["42P01", "PGRST205", "PGRST204"].includes(code)
      || message.includes("could not find the table")
      || message.includes("relation") && message.includes("does not exist");
  }

  function selectAuthoritativeState({ head, snapshots, legacy, allowLegacyMigration = false } = {}) {
    const allSnapshots = (Array.isArray(snapshots) ? snapshots : snapshots ? [snapshots] : [])
      .filter(Boolean)
      .sort((left, right) => text(right.created_at).localeCompare(text(left.created_at)));
    const verifiedSnapshots = allSnapshots.filter((snapshot) => verifySnapshot(snapshot).valid);
    const headSnapshotId = text(head?.snapshot_id);
    const pointedSnapshot = headSnapshotId
      ? allSnapshots.find((snapshot) => text(snapshot.id) === headSnapshotId)
      : null;
    const pointedVerification = verifySnapshot(pointedSnapshot);
    const fingerprintMatches = !text(head?.fingerprint)
      || text(head?.fingerprint) === text(pointedSnapshot?.fingerprint);

    if (pointedSnapshot?.state && pointedVerification.valid && fingerprintMatches) {
      return {
        mode: "normalizado",
        source: "normalized-head",
        state: pointedSnapshot.state,
        snapshot: pointedSnapshot,
        requiresMigration: false,
      };
    }
    if (verifiedSnapshots[0]?.state) {
      return {
        mode: "normalizado",
        source: "normalized-snapshot-recovery",
        state: verifiedSnapshots[0].state,
        snapshot: verifiedSnapshots[0],
        requiresMigration: false,
        integrityIssue: headSnapshotId ? "active-head-invalid" : null,
      };
    }
    if (legacy?.state && allowLegacyMigration) {
      return {
        mode: "compatibilidad",
        source: "legacy-migration",
        state: legacy.state,
        snapshot: null,
        requiresMigration: true,
      };
    }
    if (legacy?.state) {
      return {
        mode: "migración requerida",
        source: "legacy-migration-required",
        state: null,
        legacyState: legacy.state,
        snapshot: null,
        requiresMigration: true,
      };
    }
    return {
      mode: "vacío",
      source: "empty",
      state: null,
      snapshot: null,
      requiresMigration: false,
    };
  }

  return {
    SCHEMA_ID,
    stableStringify,
    hashText,
    fingerprintPayload,
    verifySnapshot,
    reconcileLedgerRows,
    createUuid,
    buildNormalizedBundle,
    isMissingSchemaError,
    selectAuthoritativeState,
  };
});
