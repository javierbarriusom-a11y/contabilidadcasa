const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ExecutiveReadModel = require("../executive-read-model.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// F1 · Cimientos: deuda pendiente y fecha libre de deuda se calculaban en Hoy de forma ad hoc
// (homeDebtOutlook, ya reutilizado por el mapa de calor y el comparador). Este remate las expone
// como dos métricas más del contrato finance-executive-read-model/v1, con su propia procedencia,
// para que cualquier pantalla nueva (Análisis, la Hoy rediseñada) las lea de un único sitio en vez
// de recalcularlas.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox(debtOutlook, coverage) {
  const context = {
    executiveActions: () => [],
    unifiedActionKey: (item) => item.action,
    unifiedActionId: (key) => `id-${key}`,
    UNIFIED_ACTION_COMMANDS: new Set(),
    unifiedActionRegistry: new Map(),
    state: { balanceDate: "2026-08-14", balanceMode: "manual" },
    defaultBalanceDate: () => "2026-08-14",
    accountBalancesFromState: () => ({ total: 0, caixa: 0 }),
    currentFamilyContext: () => ({}),
    executiveCoverageSnapshot: () => coverage,
    homeDebtOutlook: () => debtOutlook,
    ExecutiveReadModel,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("unifiedActionCenterModel"), context);
  return context;
}

const baseContext = { balances: { total: 5000, caixa: 3000 }, today: {}, capacity: {}, rows: [] };
const baseCoverage = { margin: 500, source: "canonical-daily-engine", days: 10, confidence: "observed" };

test("F1 · deuda pendiente y fecha libre de deuda llegan al contrato con su procedencia", () => {
  const debtOutlook = {
    pendingPrincipal: 12345.67,
    contracts: 3,
    libreDeDeuda: "2031-04",
    libreDeDeudaLabel: "abril de 2031",
    estimable: true,
    settled: false,
  };
  const { unifiedActionCenterModel } = sandbox(debtOutlook, baseCoverage);
  const metrics = unifiedActionCenterModel({ context: baseContext }).readModel.metrics;

  assert.equal(metrics.debtPending.value, 12345.67);
  assert.equal(metrics.debtPending.unit, "EUR");
  assert.equal(metrics.debtPending.source, "canonical-debt-contracts");
  assert.equal(metrics.debtPending.coverage, "3 contratos");
  assert.equal(metrics.debtPending.confidence, "high");

  assert.equal(metrics.debtFreeDate.value, "2031-04");
  assert.equal(metrics.debtFreeDate.source, "canonical-debt-comparator");
  assert.equal(metrics.debtFreeDate.coverage, "estimable");
  assert.equal(metrics.debtFreeDate.confidence, "high");
});

test("F1 · sin deuda pendiente, la fecha libre de deuda se marca como tal, no como \"estimable\"", () => {
  const debtOutlook = {
    pendingPrincipal: 0,
    contracts: 0,
    libreDeDeuda: "sin deuda pendiente",
    libreDeDeudaLabel: "sin deuda pendiente",
    estimable: false,
    settled: true,
  };
  const { unifiedActionCenterModel } = sandbox(debtOutlook, baseCoverage);
  const metrics = unifiedActionCenterModel({ context: baseContext }).readModel.metrics;

  assert.equal(metrics.debtPending.value, 0);
  assert.equal(metrics.debtPending.confidence, "high", "cero deuda es un hecho, no una estimación de baja confianza");
  assert.equal(metrics.debtFreeDate.coverage, "sin deuda pendiente");
  assert.equal(metrics.debtFreeDate.confidence, "high");
});

test("F1 · fuera de horizonte, la confianza baja y lo dice en vez de fingir una fecha", () => {
  const debtOutlook = {
    pendingPrincipal: 48000,
    contracts: 2,
    libreDeDeuda: "fuera de horizonte",
    libreDeDeudaLabel: "fuera de horizonte",
    estimable: false,
    settled: false,
  };
  const { unifiedActionCenterModel } = sandbox(debtOutlook, baseCoverage);
  const metrics = unifiedActionCenterModel({ context: baseContext }).readModel.metrics;

  assert.equal(metrics.debtFreeDate.value, "fuera de horizonte");
  assert.equal(metrics.debtFreeDate.coverage, "no estimable");
  assert.equal(metrics.debtFreeDate.confidence, "low");
});

test("F1 · el read-model sigue completo: las dos métricas nuevas no faltan metadatos", () => {
  const debtOutlook = {
    pendingPrincipal: 1000,
    contracts: 1,
    libreDeDeuda: "2028-01",
    libreDeDeudaLabel: "enero de 2028",
    estimable: true,
    settled: false,
  };
  const { unifiedActionCenterModel } = sandbox(debtOutlook, baseCoverage);
  const model = unifiedActionCenterModel({ context: baseContext }).readModel;
  assert.equal(model.quality.complete, true);
  assert.deepEqual(model.quality.missingMetadata, []);
});
