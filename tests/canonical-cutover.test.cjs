const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const engine = require("../canonical-engine.js");
const forecast = require("../canonical-forecast.js");
const decisions = require("../canonical-decisions.js");
const workflow = require("../canonical-workflow.js");

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, "fixtures", "anonymized-household.json"),
  "utf8",
));
const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function workflowFrom(items) {
  return items.reduce((snapshot, item) => workflow.importDecision(snapshot, item, {
    at: "2026-07-14T08:00:00.000Z",
  }).snapshot, workflow.createWorkflowSnapshot({ updatedAt: "2026-07-14T08:00:00.000Z" }));
}

function calculate(snapshot) {
  const monthRefs = fixture.months.map((month) => ({ key: month.monthKey, label: month.month }));
  const schedule = decisions.buildSchedule({
    months: monthRefs,
    debtTargets: fixture.debtTargets,
    decisions: snapshot.decisions,
  });
  assert.equal(schedule.invariants.passed, true, JSON.stringify(schedule.invariants.issues));

  const monthlyInput = fixture.months.map((month, index) => ({
    ...month,
    projectOutflow: schedule.months[index].netOutflow,
  }));
  const financial = engine.buildSnapshot({
    openingBalances: fixture.openingBalances,
    policy: fixture.policy,
    months: monthlyInput,
  }, null, {
    generatedAt: "2026-07-14T08:05:00.000Z",
    reason: "phase-6-acceptance",
  });
  assert.equal(financial.invariants.valid, true, JSON.stringify(financial.invariants.issues));
  return { schedule, financial };
}

test("la migración canónica completa respeta estados, deuda suspendida y conservación", () => {
  const initialWorkflow = workflowFrom(fixture.decisions);
  const initial = calculate(initialWorkflow);

  assert.deepEqual(initial.schedule.decisions.map((item) => item.id), ["project-approved", "debt-fixed"]);
  assert.deepEqual(initial.schedule.outflows, [0, 900, 1200, 0]);
  assert.equal(initial.schedule.totals.debtRelief, 0);
  assert.equal(initial.financial.rows.every((row) => Number.isFinite(row.totalLiquidity)), true);

  const approval = workflow.applyDecisionCommand(initialWorkflow, {
    id: "approve-pending-project",
    type: "transition",
    decisionId: "project-pending",
    toStatus: "approved",
    at: "2026-07-14T09:00:00.000Z",
  });
  assert.equal(approval.ok, true);
  assert.equal(approval.event.fromStatus, "pending");
  assert.equal(approval.event.toStatus, "approved");

  const approved = calculate(approval.snapshot);
  assert.deepEqual(approved.schedule.outflows, [600, 900, 1200, 0]);
  assert.equal(
    initial.financial.rows.at(-1).totalLiquidity - approved.financial.rows.at(-1).totalLiquidity,
    600,
  );
});

test("la aplicación no contiene una ruta de ejecución normal hacia el motor histórico", () => {
  assert.equal(appSource.includes("legacy-fallback"), false);
  assert.equal(appSource.includes("simulateLegacy"), false);
  assert.match(appSource, /requiredCanonicalEngine\(\)/);
  assert.match(appSource, /canonicalDiagnosticsEnabled/);
});

test("la app delega cada simulación al escenario canónico", () => {
  assert.match(appSource, /function computeCanonicalScenario\(/);
  assert.match(appSource, /engine\.buildScenario\(/);
  assert.match(appSource, /function simulate\([\s\S]*?return computeCanonicalScenario\(projectOutflows, options\)\.rows;/);
  assert.doesNotMatch(appSource, /engine\.buildRows\(/);
});

test("E12a envuelve cada escenario con el forecast canónico y expone su serie a las vistas", () => {
  assert.equal(forecast.SCHEMA_ID, "finance-canonical-forecast/v1");
  assert.match(appSource, /requiredCanonicalForecast\(\)\.buildForecast\(/);
  assert.match(appSource, /result\?\.forecast\?\.series/);
  assert.match(appSource, /El forecast canónico no mantiene la paridad/);
});
