(function initCanonicalWorkflow(root, factory) {
  const stateApi =
    typeof module === "object" && module.exports
      ? require("./canonical-state.js")
      : root.FinanceCanonicalState;
  const api = factory(stateApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceDecisionWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalWorkflowFactory(stateApi) {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-decision-workflow";
  const VERSION = 1;
  const MAX_EVENTS = 500;
  const MAX_COMMANDS = 500;
  const ACTIVE_PLAN_STATUSES = new Set(["approved", "fixed"]);

  function nowIso(value) {
    return value || new Date().toISOString();
  }

  function stableId(parts) {
    if (stateApi?.stableId) return stateApi.stableId("workflow", parts);
    return parts.map((part) => String(part ?? "").trim().toLowerCase()).filter(Boolean).join(":");
  }

  function canonicalStatus(value, fallback = "approved") {
    return stateApi?.canonicalStatus ? stateApi.canonicalStatus(value, fallback) : String(value || fallback);
  }

  function createWorkflowSnapshot(seed = {}) {
    return {
      schemaId: SCHEMA_ID,
      version: VERSION,
      updatedAt: seed.updatedAt || nowIso(),
      decisions: Array.isArray(seed.decisions) ? seed.decisions.map((item) => ({ ...item })) : [],
      events: Array.isArray(seed.events) ? seed.events.map((item) => ({ ...item })) : [],
      processedCommands: Array.isArray(seed.processedCommands) ? [...seed.processedCommands] : [],
    };
  }

  function normalizeSnapshot(snapshot) {
    if (snapshot?.schemaId !== SCHEMA_ID) return createWorkflowSnapshot();
    return createWorkflowSnapshot(snapshot);
  }

  function decisionId(input = {}) {
    return String(
      input.workflowId ||
        input.id ||
        stableId([input.source || "decision", input.legacyId || input.targetId || input.name || "unknown"]),
    );
  }

  function normalizeDecision(input = {}, timestamp) {
    const at = nowIso(timestamp);
    return {
      id: decisionId(input),
      source: input.source === "debt" ? "debt" : "project",
      legacyId: String(input.legacyId || input.id || ""),
      targetId: String(input.targetId || ""),
      kind: String(input.kind || input.projectKind || (input.source === "debt" ? "debt" : "project")),
      name: String(input.name || input.label || "Decisión"),
      owner: String(input.owner || input.creditOwner || "Hogar"),
      amount: Number(input.amount || 0),
      monthKey: String(input.monthKey || ""),
      monthLabel: String(input.monthLabel || ""),
      status: canonicalStatus(input.lifecycleState || input.status, "approved"),
      payload: input.payload && typeof input.payload === "object" ? { ...input.payload } : {},
      createdAt: input.createdAt || at,
      updatedAt: input.updatedAt || at,
      revision: Math.max(1, Number(input.revision || 1)),
    };
  }

  function importDecision(snapshot, input, options = {}) {
    const next = normalizeSnapshot(snapshot);
    const incoming = normalizeDecision(input, options.at);
    const index = next.decisions.findIndex(
      (item) =>
        item.id === incoming.id ||
        (incoming.legacyId && item.source === incoming.source && item.legacyId === incoming.legacyId),
    );
    if (index === -1) {
      next.decisions.push(incoming);
      next.updatedAt = nowIso(options.at);
      return { snapshot: next, decision: incoming, created: true };
    }
    const existing = next.decisions[index];
    const merged = {
      ...existing,
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      status: options.preserveStatus === false ? incoming.status : existing.status,
      revision: Math.max(1, Number(existing.revision || 1)),
      payload: { ...(existing.payload || {}), ...(incoming.payload || {}) },
    };
    next.decisions[index] = merged;
    next.updatedAt = nowIso(options.at);
    return { snapshot: next, decision: merged, created: false };
  }

  function appendCommand(next, commandId) {
    next.processedCommands = [...next.processedCommands, commandId].slice(-MAX_COMMANDS);
  }

  function applyDecisionCommand(snapshot, command = {}) {
    const next = normalizeSnapshot(snapshot);
    const commandId = String(command.id || stableId([command.type, command.decisionId, command.toStatus, command.at]));
    if (next.processedCommands.includes(commandId)) {
      return {
        ok: true,
        idempotent: true,
        snapshot: next,
        decision: next.decisions.find((item) => item.id === command.decisionId) || null,
        event: null,
      };
    }
    const index = next.decisions.findIndex((item) => item.id === command.decisionId);
    if (index === -1) return { ok: false, snapshot: next, error: "decision-not-found" };
    const current = next.decisions[index];
    const at = nowIso(command.at);

    if (command.type === "amend") {
      const changes = command.changes && typeof command.changes === "object" ? command.changes : {};
      const amended = {
        ...current,
        ...changes,
        id: current.id,
        status: current.status,
        createdAt: current.createdAt,
        payload: { ...(current.payload || {}), ...(changes.payload || {}) },
        updatedAt: at,
        revision: Number(current.revision || 1) + 1,
      };
      next.decisions[index] = amended;
      const event = {
        id: stableId(["event", commandId]),
        commandId,
        decisionId: current.id,
        type: "amend",
        fromStatus: current.status,
        toStatus: current.status,
        at,
        note: String(command.note || "Decisión actualizada."),
      };
      next.events = [...next.events, event].slice(-MAX_EVENTS);
      appendCommand(next, commandId);
      next.updatedAt = at;
      return { ok: true, idempotent: false, snapshot: next, decision: amended, event };
    }

    if (command.type !== "transition") return { ok: false, snapshot: next, error: "unsupported-command" };
    const toStatus = canonicalStatus(command.toStatus, current.status);
    if (toStatus === current.status) {
      appendCommand(next, commandId);
      next.updatedAt = at;
      return { ok: true, idempotent: true, snapshot: next, decision: current, event: null };
    }
    const transitionResult = stateApi?.validateTransition
      ? stateApi.validateTransition(current.status, toStatus)
      : true;
    const transitionValid = typeof transitionResult === "boolean" ? transitionResult : Boolean(transitionResult?.valid);
    if (!transitionValid) {
      return { ok: false, snapshot: next, decision: current, error: "invalid-transition", transition: transitionResult };
    }
    const updated = {
      ...current,
      status: toStatus,
      updatedAt: at,
      revision: Number(current.revision || 1) + 1,
    };
    next.decisions[index] = updated;
    const event = {
      id: stableId(["event", commandId]),
      commandId,
      decisionId: current.id,
      type: "transition",
      fromStatus: current.status,
      toStatus,
      at,
      note: String(command.note || ""),
    };
    next.events = [...next.events, event].slice(-MAX_EVENTS);
    appendCommand(next, commandId);
    next.updatedAt = at;
    return { ok: true, idempotent: false, snapshot: next, decision: updated, event };
  }

  function decisionAffectsPlan(status) {
    return ACTIVE_PLAN_STATUSES.has(canonicalStatus(status, "cancelled"));
  }

  return {
    SCHEMA_ID,
    VERSION,
    createWorkflowSnapshot,
    normalizeSnapshot,
    normalizeDecision,
    importDecision,
    applyDecisionCommand,
    decisionAffectsPlan,
  };
});
