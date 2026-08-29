const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { evaluateLeverageBarrier, DEBT_SERVICE_RATIO_LIMIT } = require("../canonical-leverage-barrier.js");

// AP4 · Bloque 1: guardarraíl de seguridad que se construye antes que el simulador de
// apalancamiento (AP3, bloque 9) que lo consumirá. Motor puro: sin colchón por encima de su suelo,
// sin deuda existente al día y sin cuota actual contenida, no hay "explorar pedir deuda para
// invertir" que valga.

test("expone FinanceCanonicalLeverageBarrier al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-leverage-barrier.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-leverage-barrier.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalLeverageBarrier?.evaluateLeverageBarrier, "function");
});

function validInput(overrides = {}) {
  return {
    cushion: { value: 6000, floor: 4000 },
    debtQualityIssues: [],
    monthlyIncome: 4000,
    monthlyDebtService: 800,
    ...overrides,
  };
}

test("con colchón holgado, deuda sin incidencias y cuota contenida, la barrera queda lista", () => {
  const result = evaluateLeverageBarrier(validInput());
  assert.equal(result.valid, true);
  assert.equal(result.status, "ready");
  assert.equal(result.summary.blockerCount, 0);
});

test("bloquea si el colchón no llega al suelo", () => {
  const result = evaluateLeverageBarrier(validInput({ cushion: { value: 2000, floor: 4000 } }));
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /cushion-below-floor/);
});

test("bloquea si el colchón no se ha calculado", () => {
  const result = evaluateLeverageBarrier(validInput({ cushion: null }));
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /cushion-missing/);
});

test("el límite del suelo es estricto: justo en el suelo ya pasa", () => {
  const result = evaluateLeverageBarrier(validInput({ cushion: { value: 4000, floor: 4000 } }));
  const cushionCheck = result.checks.find((item) => item.id === "cushion-floor");
  assert.equal(cushionCheck.passed, true);
});

test("bloquea una incidencia crítica en la deuda existente", () => {
  const result = evaluateLeverageBarrier(validInput({
    debtQualityIssues: [{ severity: "critical", message: "Cuota impagada del préstamo del coche" }],
  }));
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /debt-quality-0/);
  assert.match(result.blockers.find((item) => item.id === "debt-quality-0").detail, /Cuota impagada/);
});

test("no bloquea por incidencias de deuda que no son críticas", () => {
  const result = evaluateLeverageBarrier(validInput({
    debtQualityIssues: [{ severity: "warning", message: "Revisar próximo vencimiento" }],
  }));
  assert.equal(result.valid, true);
});

test("bloquea si el ingreso mensual no está calculado", () => {
  const result = evaluateLeverageBarrier(validInput({ monthlyIncome: null }));
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /income-missing/);
});

test("bloquea si la cuota de deuda actual ya supera el umbral prudente", () => {
  const result = evaluateLeverageBarrier(validInput({ monthlyIncome: 2000, monthlyDebtService: 900 }));
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /debt-service-ratio-too-high/);
  const check = result.checks.find((item) => item.id === "debt-service-ratio");
  assert.ok(check.value > DEBT_SERVICE_RATIO_LIMIT);
});

test("el límite de la cuota de deuda es estricto: justo en el umbral ya bloquea", () => {
  const result = evaluateLeverageBarrier(validInput({ monthlyIncome: 1000, monthlyDebtService: 350 }));
  const check = result.checks.find((item) => item.id === "debt-service-ratio");
  assert.equal(check.passed, false);
});

test("acumula varios bloqueos a la vez sin detenerse en el primero", () => {
  const result = evaluateLeverageBarrier({
    cushion: { value: 100, floor: 4000 },
    debtQualityIssues: [{ severity: "error", message: "Impago" }],
    monthlyIncome: 1000,
    monthlyDebtService: 900,
  });
  assert.equal(result.summary.blockerCount, 3);
  assert.equal(result.status, "blocked");
});

test("está cargado en index.html antes que app.js, disponible para el futuro simulador AP3", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const barrierScript = html.indexOf("canonical-leverage-barrier.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(barrierScript >= 0, "El módulo de la barrera debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(barrierScript < appScript, "La barrera debe estar disponible antes de app.js.");
});
