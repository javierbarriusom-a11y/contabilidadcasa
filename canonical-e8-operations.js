(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE8 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SCHEMA_ID = "finance-e8-operations/v1";
  const GROUPS = ["accounts", "movements", "debts", "projects", "adjustments"];
  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  const object = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const stableValue = (value) => Array.isArray(value)
    ? value.map(stableValue)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
      : value;
  const stable = (value) => JSON.stringify(stableValue(value));
  const identity = (row, index) => text(row?.id || row?.key || row?.movementId || row?.name || row?.label) || `row-${index}`;

  function collectionDiff(beforeRows, afterRows) {
    const before = new Map(list(beforeRows).map((row, index) => [identity(row, index), row]));
    const after = new Map(list(afterRows).map((row, index) => [identity(row, index), row]));
    const added = [], removed = [], changed = [];
    after.forEach((row, id) => {
      if (!before.has(id)) added.push({ id, after: row });
      else if (stable(before.get(id)) !== stable(row)) changed.push({ id, before: before.get(id), after: row });
    });
    before.forEach((row, id) => { if (!after.has(id)) removed.push({ id, before: row }); });
    return { added, changed, removed, count: added.length + changed.length + removed.length };
  }

  function comparableGroups(payload = {}) {
    const canonical = object(payload.canonicalSnapshot);
    const entities = object(canonical.entities);
    const settings = object(payload.scenarioSettings);
    const p2 = object(settings.p2);
    return {
      accounts: Object.entries(object(payload.balanceSettings)).map(([id, value]) => ({ id, value })),
      movements: list(payload.workbookData?.transactions || entities.movements),
      debts: list(payload.debtContracts || entities.debts),
      projects: list(payload.projects || entities.projects),
      adjustments: [
        ...Object.entries(object(payload.incomeActuals)).map(([id, value]) => ({ id: `income:${id}`, value })),
        ...Object.entries(object(payload.expenseActuals)).map(([id, value]) => ({ id: `expense:${id}`, value })),
        ...list(p2.goals).map((row) => ({ ...row, id: `goal:${identity(row, 0)}` })),
      ],
    };
  }

  function compareVersions(beforePayload = {}, afterPayload = {}) {
    const before = comparableGroups(beforePayload);
    const after = comparableGroups(afterPayload);
    const groups = Object.fromEntries(GROUPS.map((group) => [group, collectionDiff(before[group], after[group])]));
    return { schemaId: SCHEMA_ID, groups, totalChanges: GROUPS.reduce((sum, group) => sum + groups[group].count, 0) };
  }

  function operationalTimeline({ snapshots = [], syncEvents = [], closures = [], auditTrail = [] } = {}) {
    const rows = [
      ...list(snapshots).map((row) => ({ id: text(row.id), at: row.created_at || row.createdAt, type: row.state?.operation?.type || "snapshot", label: "Versión guardada", status: "stored", fingerprint: row.fingerprint })),
      ...list(syncEvents).map((row) => ({ id: text(row.id), at: row.created_at || row.createdAt, type: row.status === "conflict" ? "conflict" : "sync", label: row.status === "conflict" ? "Conflicto protegido" : "Sincronización", status: row.status || "synced" })),
      ...list(closures).map((row) => ({ id: text(row.id), at: row.closedAt || row.reopenedAt || row.createdAt, type: row.status === "reopened" ? "reopen" : "close", label: row.status === "reopened" ? "Mes reabierto" : "Mes cerrado", status: row.status || "closed" })),
      ...list(auditTrail).map((row, index) => ({ id: text(row.id) || `audit-${index}`, at: row.at, type: row.reason || "change", label: text(row.reason).replaceAll("-", " ") || "Cambio local", status: "local", fingerprint: row.fingerprint })),
    ];
    return rows.filter((row) => row.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  function qualityCenter({ canonicalIssues = [], debtQuality = [], kpis = [], movements = [] } = {}) {
    const issues = list(canonicalIssues).map((row, index) => ({ id: row.id || `canonical-${index}`, kind: "structure", severity: row.severity || "warning", label: row.label || row.code || "Dato incompleto", target: "data-audit" }));
    list(debtQuality).forEach((row) => list(row.unknownFields || row.unknown || row.missing).forEach((field) => issues.push({ id: `debt-${row.id}-${field}`, kind: "debt", severity: "warning", label: `${row.label || row.entity || "Deuda"}: falta ${field}`, target: "debt-control" })));
    list(kpis).filter((row) => row.confidence === "low" || row.confidence === "baja").forEach((row) => issues.push({ id: `kpi-${row.id || row.label}`, kind: "kpi", severity: "warning", label: `${row.label || "KPI"}: confianza baja`, target: "home" }));
    list(movements).filter((row) => !row.reconciled).forEach((row) => issues.push({ id: `movement-${row.id}`, kind: "movement", severity: "warning", label: row.label || row.bankLabel || "Movimiento sin clasificar", target: "movements" }));
    const counts = issues.reduce((acc, row) => ({ ...acc, [row.kind]: (acc[row.kind] || 0) + 1 }), {});
    return { schemaId: SCHEMA_ID, issues, counts, total: issues.length };
  }

  const ALERT_TARGETS = { caixaBalance: "balances", totalLiquidity: "balances", minimumCash12m: "update-data", debtRatio: "debt-control", freeCapacity: "executive-advisor" };
  function alertQuickAction(alert = {}) {
    return { alertId: text(alert.id), target: ALERT_TARGETS[alert.metric] || "data-audit", label: "Revisar y preparar acción", requiresPreview: true, writesImmediately: false };
  }

  function performanceBudget({ rowCount = 0, renderMs = 0, payloadBytes = 0 } = {}) {
    const limits = { rowCount: 10000, renderMs: 200, payloadBytes: 5 * 1024 * 1024 };
    const checks = { rowCount: rowCount <= limits.rowCount, renderMs: renderMs <= limits.renderMs, payloadBytes: payloadBytes <= limits.payloadBytes };
    return { schemaId: SCHEMA_ID, limits, measured: { rowCount, renderMs, payloadBytes }, checks, passed: Object.values(checks).every(Boolean) };
  }

  function normalizeAttachmentMetadata(input = {}) {
    const size = Math.max(0, Number(input.size || 0));
    if (size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite privado de 10 MB");
    return { storage: input.storage === "cloud" ? "cloud" : "device", encrypted: input.storage === "cloud", remotePath: text(input.remotePath), deletedAt: text(input.deletedAt), recoverUntil: text(input.recoverUntil), size };
  }

  return { SCHEMA_ID, GROUPS, alertQuickAction, collectionDiff, compareVersions, normalizeAttachmentMetadata, operationalTimeline, performanceBudget, qualityCenter };
});
