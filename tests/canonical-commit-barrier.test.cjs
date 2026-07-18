const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { evaluateCommitBarrier } = require("../canonical-commit-barrier.js");

function monthlyRun(overrides = {}) {
  return { invariants: { valid: true, checks: { finite: true, accountConservation: true, liquidityConservation: true, continuity: true, ...overrides } } };
}

function dailyRun(overrides = {}) {
  return { invariants: { valid: true, checks: { finite: true, accountConservation: true, dailyConservation: true, continuity: true, monthlyParity: true, transferConservation: true, ...overrides } } };
}

function decisionRun(overrides = {}) {
  return { invariants: { passed: true, checks: { monthlyConservation: true, uniqueDebtTargets: true, ...overrides } } };
}

function validInput() {
  return {
    snapshot: { quality: { issues: [] } },
    ledgerSnapshot: { quality: { unclassifiedCount: 0, balanceGapCount: 0 } },
    engineRuns: { base: monthlyRun(), active: monthlyRun(), planned: monthlyRun() },
    dailyEngineRuns: { active: dailyRun() },
    decisionRun: decisionRun(),
  };
}

test("permite sincronizar un cálculo canónico completo", () => {
  const result = evaluateCommitBarrier(validInput());
  assert.equal(result.valid, true);
  assert.equal(result.status, "ready");
  assert.equal(result.summary.blockerCount, 0);
});

test("mantiene la sincronización abierta ante avisos de conciliación", () => {
  const input = validInput();
  input.ledgerSnapshot.quality.unclassifiedCount = 2;
  const result = evaluateCommitBarrier(input);
  assert.equal(result.valid, true);
  assert.equal(result.status, "warning");
  assert.equal(result.summary.warningCount, 1);
});

test("bloquea si falta un escenario mensual requerido", () => {
  const input = validInput();
  input.engineRuns.planned = null;
  const result = evaluateCommitBarrier(input);
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /monthly-planned-missing/);
});

test("bloquea una diferencia entre calendario diario y flujo mensual", () => {
  const input = validInput();
  input.dailyEngineRuns.active = dailyRun({ monthlyParity: false });
  const result = evaluateCommitBarrier(input);
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /daily-active-monthlyParity/);
});

test("bloquea duplicar una deuda en decisiones", () => {
  const input = validInput();
  input.decisionRun = decisionRun({ uniqueDebtTargets: false });
  const result = evaluateCommitBarrier(input);
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /decision-active-uniqueDebtTargets/);
});

test("bloquea un error crítico declarado en el estado canónico", () => {
  const input = validInput();
  input.snapshot.quality.issues = [{ severity: "critical", message: "Saldo no reconciliado" }];
  const result = evaluateCommitBarrier(input);
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /state-quality-0/);
});

test("la puerta de integridad está montada antes de iniciar la app", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const barrierScript = html.indexOf("canonical-commit-barrier.js");
  const appScript = html.indexOf("app.js?v=");

  assert.ok(barrierScript >= 0, "El módulo de barrera debe cargarse en el HTML.");
  assert.ok(appScript >= 0, "La app debe cargarse en el HTML.");
  assert.ok(barrierScript < appScript, "La barrera debe estar disponible antes de app.js.");
  assert.match(html, /id="canonicalCommitBarrierSummary"/);
});
