(function initFinanceStateContract(root, factory) {
  const contract = factory();
  if (typeof module === "object" && module.exports) module.exports = contract;
  if (root) root.FinanceStateContract = contract;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFinanceStateContract() {
  "use strict";

  const BACKUP_FORMAT = "finanzas-casa-backup";
  const BACKUP_VERSION = 1;
  const PAYLOAD_VERSION = 1;
  const ARRAY_FIELDS = ["projects", "debtLiquidations", "decisionEvents", "customPlanningRows"];
  const OPTIONAL_ARRAY_FIELDS = ["monthClosures", "importBatches", "dataInbox", "updateReceipts"];
  const OBJECT_FIELDS = [
    "incomeActuals",
    "expenseActuals",
    "balanceSettings",
    "scenarioSettings",
    "deletedPlanningRows",
    "seriesOverrides",
    "rowLabelOverrides",
    "movementMappings",
  ];
  const OPTIONAL_OBJECT_FIELDS = ["debtRoadmapState", "e11b"];

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (isPlainObject(value)) {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function fnv1a32(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function findInvalidNumber(value, path = "payload") {
    if (typeof value === "number" && !Number.isFinite(value)) return path;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const invalidPath = findInvalidNumber(value[index], `${path}[${index}]`);
        if (invalidPath) return invalidPath;
      }
    } else if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        const invalidPath = findInvalidNumber(child, `${path}.${key}`);
        if (invalidPath) return invalidPath;
      }
    }
    return "";
  }

  function validatePayload(payload) {
    const errors = [];
    if (!isPlainObject(payload)) return { valid: false, errors: ["El estado no es un objeto válido."] };
    if (Number(payload.version) !== PAYLOAD_VERSION) errors.push("La versión interna del estado no es compatible.");
    ARRAY_FIELDS.forEach((field) => {
      if (!Array.isArray(payload[field])) errors.push(`El campo ${field} debe ser una lista.`);
    });
    OPTIONAL_ARRAY_FIELDS.forEach((field) => {
      if (payload[field] !== undefined && !Array.isArray(payload[field])) errors.push(`El campo ${field} debe ser una lista.`);
    });
    OBJECT_FIELDS.forEach((field) => {
      if (!isPlainObject(payload[field])) errors.push(`El campo ${field} debe ser un objeto.`);
    });
    OPTIONAL_OBJECT_FIELDS.forEach((field) => {
      if (payload[field] !== undefined && !isPlainObject(payload[field])) errors.push(`El campo ${field} debe ser un objeto.`);
    });
    if (payload.workbookData !== null && payload.workbookData !== undefined) {
      if (!isPlainObject(payload.workbookData) || !payload.workbookData.metadata || !payload.workbookData.monthlyPlanning) {
        errors.push("Los datos del libro incluidos no tienen la estructura esperada.");
      }
    }
    const invalidNumberPath = findInvalidNumber(payload);
    if (invalidNumberPath) errors.push(`Hay un número no finito en ${invalidNumberPath}.`);
    return { valid: errors.length === 0, errors };
  }

  function migratePayload(payload = {}) {
    if (!isPlainObject(payload)) throw new Error("El estado no es un objeto válido.");
    const migrated = clone(payload);
    ARRAY_FIELDS.forEach((field) => {
      if (!Array.isArray(migrated[field])) migrated[field] = [];
    });
    OPTIONAL_ARRAY_FIELDS.forEach((field) => {
      if (!Array.isArray(migrated[field])) migrated[field] = [];
    });
    OBJECT_FIELDS.forEach((field) => {
      if (!isPlainObject(migrated[field])) migrated[field] = {};
    });
    OPTIONAL_OBJECT_FIELDS.forEach((field) => {
      if (migrated[field] !== undefined && !isPlainObject(migrated[field])) delete migrated[field];
    });
    if (migrated.workbookData === undefined) migrated.workbookData = null;
    if (migrated.updatedAt === undefined) migrated.updatedAt = "";
    if (migrated.sourceWorkbook === undefined) migrated.sourceWorkbook = "";
    migrated.version = PAYLOAD_VERSION;
    const validation = validatePayload(migrated);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return migrated;
  }

  function summarizePayload(payload) {
    const workbook = payload.workbookData;
    return {
      projects: Array.isArray(payload.projects) ? payload.projects.length : 0,
      debtDecisions: Array.isArray(payload.debtLiquidations) ? payload.debtLiquidations.length : 0,
      decisionEvents: Array.isArray(payload.decisionEvents) ? payload.decisionEvents.length : 0,
      customRows: Array.isArray(payload.customPlanningRows) ? payload.customPlanningRows.length : 0,
      incomeActuals: isPlainObject(payload.incomeActuals) ? Object.keys(payload.incomeActuals).length : 0,
      expenseActuals: isPlainObject(payload.expenseActuals) ? Object.keys(payload.expenseActuals).length : 0,
      debtRoadmapFields: isPlainObject(payload.debtRoadmapState) ? Object.keys(payload.debtRoadmapState).length : 0,
      workbookIncluded: Boolean(workbook),
      workbookMonths: workbook?.monthlyPlanning?.months?.length || 0,
      sourceWorkbook: payload.sourceWorkbook || workbook?.metadata?.sourceWorkbook || "",
    };
  }

  function buildBackupEnvelope(payload, metadata = {}) {
    const validation = validatePayload(payload);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    const snapshot = clone(payload);
    const payloadText = stableStringify(snapshot);
    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_VERSION,
      createdAt: metadata.createdAt || new Date().toISOString(),
      appVersion: metadata.appVersion || "local",
      sourceWorkbook: snapshot.sourceWorkbook || "",
      summary: summarizePayload(snapshot),
      checksum: {
        algorithm: "fnv1a32",
        value: fnv1a32(payloadText),
      },
      payload: snapshot,
    };
  }

  function validateBackupEnvelope(envelope) {
    const errors = [];
    if (!isPlainObject(envelope)) return { valid: false, errors: ["El fichero no contiene una copia válida."] };
    if (envelope.format !== BACKUP_FORMAT) errors.push("El formato de la copia no pertenece a Finanzas Casa.");
    if (Number(envelope.formatVersion) !== BACKUP_VERSION) errors.push("La versión de la copia no es compatible.");
    const payloadValidation = validatePayload(envelope.payload);
    errors.push(...payloadValidation.errors);
    if (payloadValidation.valid) {
      const expected = fnv1a32(stableStringify(envelope.payload));
      if (envelope.checksum?.algorithm !== "fnv1a32" || envelope.checksum?.value !== expected) {
        errors.push("La copia está incompleta o ha sido modificada (checksum incorrecto).");
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      summary: payloadValidation.valid ? summarizePayload(envelope.payload) : null,
    };
  }

  function migrateBackupEnvelope(envelope, metadata = {}) {
    if (!isPlainObject(envelope)) throw new Error("El fichero no contiene una copia válida.");
    if (envelope.format !== BACKUP_FORMAT) throw new Error("El formato de la copia no pertenece a Finanzas Casa.");
    if (Number(envelope.formatVersion) !== BACKUP_VERSION) throw new Error("La versión de la copia no es compatible.");
    const expected = fnv1a32(stableStringify(envelope.payload));
    if (envelope.checksum?.algorithm !== "fnv1a32" || envelope.checksum?.value !== expected) {
      throw new Error("La copia está incompleta o ha sido modificada (checksum incorrecto).");
    }
    const payload = migratePayload(envelope.payload);
    return buildBackupEnvelope(payload, {
      createdAt: envelope.createdAt || metadata.createdAt,
      appVersion: metadata.appVersion || envelope.appVersion || "local",
    });
  }

  return {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    PAYLOAD_VERSION,
    buildBackupEnvelope,
    fnv1a32,
    stableStringify,
    summarizePayload,
    migrateBackupEnvelope,
    migratePayload,
    validateBackupEnvelope,
    validatePayload,
  };
});
