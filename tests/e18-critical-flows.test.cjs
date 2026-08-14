const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const worker = read("service-worker.js");

const criticalFlows = [
  ["Actualizar", "update-hub", "renderE11bStatus"],
  ["Importar", "data-entry", "applyStagedMovementImport"],
  ["Proyectar", "forecast", "computeCanonicalScenario"],
  ["Simular", "new-life-simulation", "renderE13ScenarioLab"],
  ["Aplicar deuda", "debt-control", "applyDebtDecision"],
  ["Recuperar", "reconciliation", "prepareCloudSnapshotRestore"],
];

test("E18 mantiene accesibles los seis flujos críticos desde el shell", () => {
  criticalFlows.forEach(([label, sectionId, handler]) => {
    assert.match(html, new RegExp(`id="${sectionId}"`), `${label}: falta la vista`);
    assert.match(app, new RegExp(`function ${handler}`), `${label}: falta la acción protegida`);
  });
});

test("E18 conserva recuperación, confirmación y shell offline en los flujos críticos", () => {
  assert.match(html, /id="operationConfirmDialog"/);
  assert.match(html, /id="stateBackupFile"/);
  assert.match(app, /migrateBackupEnvelope\(sourceEnvelope\)/);
  assert.match(app, /migratePayload\(payload\)/);
  assert.match(worker, /finanzas-casa-shell-20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
