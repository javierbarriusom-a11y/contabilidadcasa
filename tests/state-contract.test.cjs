const assert = require("node:assert/strict");
const test = require("node:test");
const contract = require("../state-contract.js");

function validPayload() {
  return {
    version: 1,
    updatedAt: "2026-07-13T10:00:00.000Z",
    sourceWorkbook: "finance-dashboard-main",
    workbookData: null,
    projects: [{ id: "project-1", amount: 1500 }],
    debtLiquidations: [],
    decisionEvents: [],
    savingsPlan: {},
    incomeActuals: {},
    expenseActuals: {},
    balanceSettings: { operationalReserve: 2200 },
    scenarioSettings: { currentScenario: "Base" },
    customPlanningRows: [],
    deletedPlanningRows: {},
    seriesOverrides: {},
    rowLabelOverrides: {},
    movementMappings: {},
    debtRoadmapState: { profile: "base", tasks: [{ title: "Solicitar CIRBE", status: "Pendiente" }] },
  };
}

test("la copia completa supera una ida y vuelta verificable", () => {
  const payload = validPayload();
  const backup = contract.buildBackupEnvelope(payload, {
    createdAt: "2026-07-13T10:00:00.000Z",
    appVersion: "phase-0-test",
  });
  const parsed = JSON.parse(JSON.stringify(backup));
  const result = contract.validateBackupEnvelope(parsed);
  assert.equal(result.valid, true);
  assert.deepEqual(parsed.payload, payload);
  assert.equal(result.summary.projects, 1);
  assert.equal(result.summary.debtRoadmapFields, 2);
});

test("una copia alterada se rechaza por checksum", () => {
  const backup = contract.buildBackupEnvelope(validPayload());
  backup.payload.projects[0].amount = 999999;
  const result = contract.validateBackupEnvelope(backup);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /checksum/i);
});

test("el contrato rechaza tipos incorrectos y números no finitos", () => {
  const malformed = validPayload();
  malformed.projects = {};
  malformed.balanceSettings.operationalReserve = Infinity;
  const result = contract.validatePayload(malformed);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /projects/);
  assert.match(result.errors.join(" "), /no finito/);
});

test("las copias anteriores sin plan de deuda siguen siendo restaurables", () => {
  const payload = validPayload();
  delete payload.debtRoadmapState;
  const backup = contract.buildBackupEnvelope(payload);
  assert.equal(contract.validateBackupEnvelope(backup).valid, true);
});

test("los ajustes E6 sobreviven a exportar, cerrar y recuperar una copia", () => {
  const payload = validPayload();
  payload.scenarioSettings.e6Coverage = {
    nextIncomeDate: "2026-08-25",
    dailyOutflow: 42.5,
    updatedAt: "2026-08-01T12:00:00.000Z",
  };
  const backup = contract.buildBackupEnvelope(payload, { createdAt: "2026-08-01T12:01:00.000Z" });
  const reopened = JSON.parse(JSON.stringify(backup));
  const result = contract.validateBackupEnvelope(reopened);
  assert.equal(result.valid, true);
  assert.deepEqual(reopened.payload.scenarioSettings.e6Coverage, payload.scenarioSettings.e6Coverage);
});
