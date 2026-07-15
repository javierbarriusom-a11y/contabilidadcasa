(function attachCanonicalState(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalStateFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-canonical";
  const SCHEMA_VERSION = 2;
  const STATUSES = ["simulated", "pending", "approved", "fixed", "executed", "cancelled"];
  const PROVENANCE = ["verified", "declared", "estimated", "hypothetical"];
  const STATUS_ALIASES = {
    simulado: "simulated",
    simulada: "simulated",
    pending: "pending",
    pendiente: "pending",
    aprobado: "approved",
    aprobada: "approved",
    aplicado: "approved",
    aplicada: "approved",
    "fijo en plan": "fixed",
    fijo: "fixed",
    fijado: "fixed",
    ejecutado: "executed",
    ejecutada: "executed",
    pagado: "executed",
    pagada: "executed",
    cancelado: "cancelled",
    cancelada: "cancelled",
    descartado: "cancelled",
    descartada: "cancelled",
    "devuelto a simulación": "simulated",
  };
  const TRANSITIONS = {
    simulated: ["pending", "cancelled"],
    pending: ["simulated", "approved", "cancelled"],
    approved: ["pending", "fixed", "cancelled"],
    fixed: ["approved", "executed", "cancelled"],
    executed: [],
    cancelled: ["simulated", "pending"],
  };

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
  }

  function stableId(prefix, parts) {
    const normalized = (Array.isArray(parts) ? parts : [parts])
      .map((part) => String(part ?? "").trim().toLocaleLowerCase("es"))
      .join("|");
    return `${prefix}-${hashText(normalized)}`;
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function canonicalStatus(value, fallback = "pending") {
    const normalized = String(value || "").trim().toLocaleLowerCase("es");
    if (STATUSES.includes(normalized)) return normalized;
    return STATUS_ALIASES[normalized] || fallback;
  }

  function canonicalProvenance(value, fallback = "declared") {
    const normalized = String(value || "").trim().toLocaleLowerCase("es");
    return PROVENANCE.includes(normalized) ? normalized : fallback;
  }

  function entityFingerprint(entity) {
    const comparable = { ...entity };
    delete comparable.fingerprint;
    return hashText(stableStringify(comparable));
  }

  function finishEntity(entity) {
    const normalized = {
      ...entity,
      status: canonicalStatus(entity.status),
      provenance: canonicalProvenance(entity.provenance),
    };
    return { ...normalized, fingerprint: entityFingerprint(normalized) };
  }

  function projectEntity(item, index) {
    const label = item.name || item.label || `Proyecto ${index + 1}`;
    const legacyIdentity = item.id || item.targetId || "";
    const identity = legacyIdentity
      ? ["legacy", legacyIdentity]
      : ["semantic", item.projectKind || item.kind || "project", item.source || "project", label || index];
    return finishEntity({
      id: stableId("project", identity),
      kind: "project",
      legacyId: item.id || "",
      label,
      status: canonicalStatus(item.lifecycleState || (item.locked ? "fixed" : item.status), "approved"),
      provenance: item.provenance || "declared",
      source: item.source || "simulator",
      amount: numeric(item.amount ?? item.totalAmount ?? item.initialAmount),
      monthKey: item.monthKey || item.startMonthKey || "",
      owner: item.creditOwner || item.owner || "household",
    });
  }

  function debtEntity(item, index) {
    const label = item.name || item.label || item.entity || `Deuda ${index + 1}`;
    const legacyIdentity = item.id || item.targetId || item.debtId || "";
    const identity = legacyIdentity
      ? ["legacy", legacyIdentity]
      : ["semantic", item.payoffMode || item.mode || "debt", item.source || "debt-control", label];
    return finishEntity({
      id: stableId("debt-decision", identity),
      kind: "debt-decision",
      legacyId: item.id || "",
      referenceId: item.targetId || item.debtId || "",
      label,
      status: canonicalStatus(item.lifecycleState || (item.locked ? "fixed" : item.status), "approved"),
      provenance: item.provenance || "declared",
      source: item.source || "debt-control",
      amount: numeric(item.amount ?? item.payoffAmount ?? item.totalAmount),
      monthKey: item.monthKey || item.startMonthKey || "",
      owner: item.owner || "household",
      mode: item.payoffMode || item.mode || "",
    });
  }

  function debtContractEntity(item, index) {
    const contract = item || {};
    const statusByPaymentStatus = {
      settled: "executed",
      reunified: "fixed",
      active: "approved",
      suspended: "pending",
    };
    const identity = contract.id || [contract.entity, contract.type, contract.number, index];
    return finishEntity({
      id: stableId("debt-contract", identity),
      kind: "debt-contract",
      legacyId: contract.id || "",
      label: [contract.entity, contract.type, contract.number].filter(Boolean).join(" · ") || `Contrato ${index + 1}`,
      status: canonicalStatus(statusByPaymentStatus[contract.paymentStatus] || contract.status, "pending"),
      provenance: contract.provenance || "declared",
      source: contract.source || "debt-portfolio",
      amount: numeric(contract.currentPrincipal),
      monthKey: contract.suspensionStart || contract.maturityMonth || "",
      owner: contract.owner || "household",
      paymentStatus: contract.paymentStatus || "",
      currentPayment: numeric(contract.currentPayment),
      scheduledPayment: numeric(contract.scheduledPayment),
      originalPayment: numeric(contract.originalPayment),
      arrearsMonths: numeric(contract.arrearsMonths),
      arrearsEstimated: numeric(contract.arrearsEstimated),
      remainingInstallments: numeric(contract.remainingInstallments),
      agreement: contract.agreement || null,
      reunified: Boolean(contract.reunified),
    });
  }

  function planningEntity(item, index) {
    const label = item.label || item.name || item.concept || `Partida ${index + 1}`;
    const kind = item.kind || item.type || "expense";
    const section = item.section || item.group || "";
    const legacyIdentity = item.rowId || item.id || "";
    return finishEntity({
      id: stableId("planning-row", legacyIdentity ? ["legacy", legacyIdentity] : ["semantic", kind, section, label]),
      kind: "planning-row",
      legacyId: item.id || item.rowId || "",
      label,
      status: canonicalStatus(item.status, "fixed"),
      provenance: item.provenance || "declared",
      source: item.source || "manual-planning",
      amount: numeric(item.amount ?? item.value ?? item.planned),
      monthKey: item.monthKey || item.startMonthKey || "",
      owner: item.owner || "household",
      section,
      flowType: kind,
    });
  }

  function actualEntities(values, flowType) {
    return Object.entries(values || {}).map(([key, value]) => finishEntity({
      id: stableId("actual", [flowType, key]),
      kind: "actual",
      legacyId: key,
      label: key,
      status: "executed",
      provenance: "verified",
      source: "actual-entry",
      amount: numeric(value),
      monthKey: String(key).slice(0, 7),
      owner: "household",
      flowType,
    }));
  }

  function accountEntities(settings) {
    const mode = settings?.mode || settings?.balanceMode || "manual";
    const provenance = mode === "auto" ? "estimated" : "declared";
    return [
      ["caixabank", settings?.caixaBalance ?? settings?.caixabankBalance ?? settings?.accountBalance],
      ["mediolanum", settings?.mediolanumBalance ?? settings?.savingsBalance],
    ].map(([account, amount]) => finishEntity({
      id: `account-${account}`,
      kind: "account",
      legacyId: account,
      label: account === "caixabank" ? "CaixaBank" : "Mediolanum",
      status: "fixed",
      provenance,
      source: "balance-settings",
      amount: numeric(amount),
      monthKey: settings?.date || settings?.balanceDate || "",
      owner: "household",
    }));
  }

  function tombstoneEntities(values) {
    const entries = Array.isArray(values)
      ? values.map((value) => [String(value || ""), true])
      : Object.entries(values || {});
    return entries.filter(([key, value]) => Boolean(key) && Boolean(value)).map(([key]) => finishEntity({
      id: stableId("tombstone", key),
      kind: "tombstone",
      legacyId: key,
      label: key,
      status: "cancelled",
      provenance: "declared",
      source: "deleted-planning-rows",
      amount: 0,
      monthKey: "",
      owner: "household",
    }));
  }

  function monthFromKey(key) {
    return String(key || "").match(/\d{4}-\d{2}/)?.[0] || "";
  }

  function seriesOverrideEntities(values) {
    return Object.entries(values || {}).map(([key, value = {}]) => {
      const hasActual = value.actual !== undefined && value.actual !== "";
      const hasPlanned = value.planned !== undefined && value.planned !== "";
      return finishEntity({
        id: stableId("series-override", key),
        kind: "series-override",
        legacyId: key,
        label: key,
        status: value.deleted ? "cancelled" : "fixed",
        provenance: hasActual ? "verified" : "declared",
        source: "series-overrides",
        amount: numeric(hasActual ? value.actual : hasPlanned ? value.planned : 0),
        monthKey: monthFromKey(key),
        owner: "household",
        valueType: hasActual ? "actual" : hasPlanned ? "planned" : value.deleted ? "deleted" : "empty",
      });
    });
  }

  function labelOverrideEntities(values) {
    return Object.entries(values || {}).map(([key, label]) => finishEntity({
      id: stableId("label-override", key),
      kind: "label-override",
      legacyId: key,
      label: String(label || key),
      status: "fixed",
      provenance: "declared",
      source: "row-label-overrides",
      amount: 0,
      monthKey: "",
      owner: "household",
    }));
  }

  function movementMappingEntities(values) {
    return Object.entries(values || {}).map(([key, value = {}]) => finishEntity({
      id: stableId("movement-mapping", key),
      kind: "movement-mapping",
      legacyId: key,
      label: value.label || `${key} -> ${value.rowKey || "sin partida"}`,
      status: "fixed",
      provenance: "declared",
      source: "movement-dictionary",
      amount: 0,
      monthKey: "",
      owner: "household",
      flowType: value.kind || "",
      referenceId: value.rowKey || "",
    }));
  }

  function decisionEventEntities(values) {
    return (values || []).map((item, index) => finishEntity({
      id: stableId("decision-event", item.id || [item.date || "", item.itemId || "", item.name || index]),
      kind: "decision-event",
      legacyId: item.id || "",
      referenceId: item.itemId || "",
      label: item.name || `Evento ${index + 1}`,
      status: canonicalStatus(item.status, "pending"),
      provenance: "declared",
      source: item.source || "decision-register",
      amount: numeric(item.amount),
      monthKey: monthFromKey(item.monthKey || item.monthLabel || item.date),
      owner: item.owner || "household",
      note: item.note || "",
    }));
  }

  function dedupe(collection, issues) {
    const byId = new Map();
    collection.forEach((entity) => {
      if (byId.has(entity.id)) {
        issues.push({ code: "duplicate-identity", severity: "warning", entityId: entity.id, label: entity.label });
      }
      byId.set(entity.id, entity);
    });
    return Array.from(byId.values());
  }

  function entityMap(snapshot) {
    const map = new Map();
    Object.values(snapshot?.entities || {}).flat().forEach((entity) => map.set(entity.id, entity.fingerprint));
    return map;
  }

  function changeSummary(previous, next) {
    const before = entityMap(previous);
    const after = entityMap(next);
    let added = 0;
    let changed = 0;
    let removed = 0;
    after.forEach((fingerprint, id) => {
      if (!before.has(id)) added += 1;
      else if (before.get(id) !== fingerprint) changed += 1;
    });
    before.forEach((_, id) => {
      if (!after.has(id)) removed += 1;
    });
    return { added, changed, removed };
  }

  function buildCanonicalSnapshot(payload = {}, previous = null, meta = {}) {
    const issues = [];
    const entities = {
      projects: dedupe((payload.projects || []).map(projectEntity), issues),
      debtDecisions: dedupe((payload.debtLiquidations || []).map(debtEntity), issues),
      debtContracts: dedupe((payload.debtContracts || []).map(debtContractEntity), issues),
      planningRows: dedupe((payload.customPlanningRows || []).map(planningEntity), issues),
      actuals: dedupe([
        ...actualEntities(payload.incomeActuals, "income"),
        ...actualEntities(payload.expenseActuals, "expense"),
      ], issues),
      accounts: dedupe(accountEntities(payload.balanceSettings || {}), issues),
      tombstones: dedupe(tombstoneEntities(payload.deletedPlanningRows || {}), issues),
      seriesOverrides: dedupe(seriesOverrideEntities(payload.seriesOverrides || {}), issues),
      labelOverrides: dedupe(labelOverrideEntities(payload.rowLabelOverrides || {}), issues),
      movementMappings: dedupe(movementMappingEntities(payload.movementMappings || {}), issues),
      decisionEvents: dedupe(decisionEventEntities(payload.decisionEvents || []), issues),
    };
    Object.values(entities).flat().forEach((entity) => {
      if (!entity.label) issues.push({ code: "missing-label", severity: "error", entityId: entity.id });
      if (!Number.isFinite(entity.amount)) issues.push({ code: "invalid-amount", severity: "error", entityId: entity.id });
    });
    const provenance = Object.fromEntries(PROVENANCE.map((key) => [key, 0]));
    const statuses = Object.fromEntries(STATUSES.map((key) => [key, 0]));
    Object.values(entities).flat().forEach((entity) => {
      provenance[entity.provenance] += 1;
      statuses[entity.status] += 1;
    });
    const core = { entities };
    const fingerprint = hashText(stableStringify(core));
    if (previous?.schemaId === SCHEMA_ID && previous.fingerprint === fingerprint && !meta.force) return previous;
    const generatedAt = meta.now || new Date().toISOString();
    const next = {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      fingerprint,
      source: {
        sourceWorkbook: payload.sourceWorkbook || "",
        updatedAt: payload.updatedAt || generatedAt,
      },
      entities,
      quality: {
        score: Math.max(0, 100 - issues.filter((issue) => issue.severity === "error").length * 10 - issues.filter((issue) => issue.severity === "warning").length * 4),
        entityCount: Object.values(entities).flat().length,
        issueCount: issues.length,
        issues,
        provenance,
        statuses,
      },
      auditTrail: [],
    };
    const changes = changeSummary(previous, next);
    next.auditTrail = [{
      id: stableId("audit", [generatedAt, fingerprint, meta.reason || "migration"]),
      at: generatedAt,
      reason: meta.reason || (previous ? "state-change" : "initial-migration"),
      changes,
      fingerprint,
    }, ...(previous?.auditTrail || [])].slice(0, 80);
    return next;
  }

  function validateTransition(from, to) {
    const current = canonicalStatus(from);
    const target = canonicalStatus(to);
    return current === target || Boolean(TRANSITIONS[current]?.includes(target));
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    STATUSES,
    PROVENANCE,
    stableId,
    stableStringify,
    canonicalStatus,
    canonicalProvenance,
    buildCanonicalSnapshot,
    validateTransition,
  };
});
