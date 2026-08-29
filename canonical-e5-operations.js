(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalE5 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-e5-operations-v1";
  const DEFAULT_RETENTION_POLICY = Object.freeze({
    keepRecent: 30,
    keepMonthlyMonths: 24,
    protectOperations: ["month-close", "month-reopen", "import", "import-undo", "restore"],
    verificationIntervalDays: 30,
  });

  function text(value) { return String(value ?? "").trim(); }
  function clone(value) { return JSON.parse(JSON.stringify(value ?? {})); }
  function validMonthKey(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value)); }
  function id(prefix, at = new Date().toISOString()) {
    return `${prefix}-${at}-${Math.random().toString(16).slice(2)}`;
  }

  function latestMonthOperation(payload = {}, monthKey) {
    return (Array.isArray(payload.monthClosures) ? payload.monthClosures : [])
      .filter((item) => item.monthKey === monthKey)
      .slice()
      .sort((left, right) => text(right.occurredAt || right.reopenedAt || right.closedAt)
        .localeCompare(text(left.occurredAt || left.reopenedAt || left.closedAt)))[0] || null;
  }

  function isMonthClosed(payload = {}, monthKey) {
    return latestMonthOperation(payload, monthKey)?.status === "closed";
  }

  function reopenMonth(payload = {}, monthKey, metadata = {}) {
    if (!validMonthKey(monthKey)) throw new Error("El mes que se quiere reabrir no es válido.");
    const reason = text(metadata.reason);
    if (!reason) throw new Error("La reapertura requiere un motivo.");
    const previous = latestMonthOperation(payload, monthKey);
    if (!previous || previous.status !== "closed") throw new Error("Solo se puede reabrir un mes cerrado.");
    const reopenedAt = metadata.reopenedAt || new Date().toISOString();
    const operation = {
      schemaId: SCHEMA_ID,
      id: metadata.id || id(`reopen-${monthKey}`, reopenedAt),
      monthKey,
      status: "reopened",
      operation: "month-reopen",
      occurredAt: reopenedAt,
      reopenedAt,
      reason,
      author: text(metadata.author),
      previousOperationId: previous.id,
      before: { status: "closed", snapshotId: previous.snapshotId || null },
      after: { status: "open" },
    };
    return { ...clone(payload), monthClosures: [...(payload.monthClosures || []), operation] };
  }

  function createImportBatch(beforeState, afterState, metadata = {}) {
    const reason = text(metadata.reason || metadata.sourceLabel);
    if (!reason) throw new Error("La importación necesita un origen o motivo.");
    const createdAt = metadata.createdAt || new Date().toISOString();
    return {
      schemaId: SCHEMA_ID,
      id: metadata.id || id("import", createdAt),
      status: "applied",
      sourceLabel: text(metadata.sourceLabel || "Importación"),
      reason,
      createdAt,
      recordCount: Math.max(0, Number(metadata.recordCount || 0)),
      beforeState: clone(beforeState),
      afterFingerprint: text(metadata.afterFingerprint),
      snapshotId: metadata.snapshotId || null,
    };
  }

  function undoImportBatch(payload = {}, batchId, metadata = {}) {
    const batches = Array.isArray(payload.importBatches) ? payload.importBatches : [];
    const batch = batches.find((item) => item.id === batchId);
    if (!batch) throw new Error("El lote de importación no existe.");
    if (batch.status !== "applied") throw new Error("Este lote ya fue deshecho.");
    const reason = text(metadata.reason);
    if (!reason) throw new Error("Deshacer una importación requiere un motivo.");
    const restored = clone(batch.beforeState);
    const undoneAt = metadata.undoneAt || new Date().toISOString();
    const updatedBatches = batches.map((item) => item.id === batchId ? {
      ...item,
      status: "undone",
      undoneAt,
      undoReason: reason,
      undoOperationId: metadata.id || id("import-undo", undoneAt),
    } : item);
    return { ...restored, importBatches: updatedBatches };
  }

  // A16-6: hitos y rachas sobre el mismo historial de cierres (monthClosures) que ya usa
  // latestMonthOperation/isMonthClosed — sin tabla ni estado nuevo. Una racha es un tramo de meses
  // consecutivos en el calendario (sin huecos) cuyo último estado es "closed"; reabrir un mes lo saca
  // de la racha aunque se vuelva a cerrar después, porque cuenta el último estado de cada mes, no si
  // alguna vez estuvo cerrado.
  const MILESTONE_STEPS = Object.freeze([5, 10, 25, 50, 100]);

  function nextMonthKey(key) {
    const [year, month] = text(key).split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }

  function auditMilestonesAndStreaks(monthClosures = []) {
    const list = Array.isArray(monthClosures) ? monthClosures : [];
    const byMonth = new Map();
    list.forEach((item) => {
      const key = text(item.monthKey);
      if (!validMonthKey(key)) return;
      const at = text(item.occurredAt || item.reopenedAt || item.closedAt);
      const current = byMonth.get(key);
      const currentAt = current ? text(current.occurredAt || current.reopenedAt || current.closedAt) : "";
      if (!current || at.localeCompare(currentAt) >= 0) byMonth.set(key, item);
    });
    const months = [...byMonth.keys()].sort();
    const totalClosed = months.filter((key) => byMonth.get(key).status === "closed").length;
    let currentStreak = 0;
    for (let index = months.length - 1; index >= 0; index -= 1) {
      if (byMonth.get(months[index]).status !== "closed") break;
      if (index < months.length - 1 && nextMonthKey(months[index]) !== months[index + 1]) break;
      currentStreak += 1;
    }
    let longestStreak = 0;
    let running = 0;
    let previousKey = null;
    months.forEach((key) => {
      const isClosed = byMonth.get(key).status === "closed";
      const consecutive = previousKey ? nextMonthKey(previousKey) === key : true;
      running = isClosed ? (consecutive ? running + 1 : 1) : 0;
      longestStreak = Math.max(longestStreak, running);
      previousKey = key;
    });
    const reachedMilestones = MILESTONE_STEPS.filter((step) => totalClosed >= step);
    const nextMilestone = MILESTONE_STEPS.find((step) => totalClosed < step) ?? null;
    return {
      totalClosed,
      currentStreak,
      longestStreak,
      milestones: MILESTONE_STEPS,
      reachedMilestones,
      nextMilestone,
      monthsUntilNextMilestone: nextMilestone === null ? null : nextMilestone - totalClosed,
    };
  }

  function buildRetentionPlan(snapshots = [], policy = {}) {
    const effective = { ...DEFAULT_RETENTION_POLICY, ...(policy || {}) };
    const ordered = snapshots.slice().sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)));
    const monthly = new Set();
    const retained = [];
    const candidates = [];
    ordered.forEach((snapshot, index) => {
      const operation = text(snapshot.operation || snapshot.metadata?.operation);
      const month = text(snapshot.created_at).slice(0, 7);
      const protectedOperation = effective.protectOperations.includes(operation);
      const recent = index < effective.keepRecent;
      const monthlySample = month && !monthly.has(month) && monthly.size < effective.keepMonthlyMonths;
      if (monthlySample) monthly.add(month);
      const item = { ...snapshot, retentionReason: protectedOperation ? "operation" : recent ? "recent" : monthlySample ? "monthly" : "candidate" };
      (protectedOperation || recent || monthlySample ? retained : candidates).push(item);
    });
    return { policy: effective, retained, candidates, deletionAutomatic: false };
  }

  function verifySnapshotSet(snapshots = [], verify) {
    const results = snapshots.map((snapshot) => ({ id: snapshot.id, ...(verify(snapshot) || {}) }));
    return { checked: results.length, valid: results.filter((item) => item.valid).length,
      invalid: results.filter((item) => !item.valid), results };
  }

  return { SCHEMA_ID, DEFAULT_RETENTION_POLICY, MILESTONE_STEPS, latestMonthOperation, isMonthClosed, reopenMonth,
    createImportBatch, undoImportBatch, buildRetentionPlan, verifySnapshotSet, validMonthKey, auditMilestonesAndStreaks };
});
