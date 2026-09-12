const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV12 (Oleada 4, Bloque 5): lombardMarginCallSimulation (APX3) solo se calcula bajo demanda, al
// pulsar «Simular caída» — el LTV real de la cartera puede acercarse al de mantenimiento sin que
// nadie lo note hasta la próxima vez que se abra esa pantalla. proactiveLtvAlert reutiliza tal cual
// ese mismo motor (con stressDropPct: 0, el LTV de HOY) y solo añade una banda de severidad de 3
// niveles sobre cuánto camino queda hasta el LTV de mantenimiento.

test("proactiveLtvAlert · sin declaración (importe pedido o LTV de mantenimiento a 0), no calculable", () => {
  const result = LeverageSimulator.proactiveLtvAlert({ portfolioValue: 100000, loanAmount: 0, maintenanceLtvPct: 70 });
  assert.equal(result.calculable, false);
});

test("proactiveLtvAlert · LTV muy por debajo del de mantenimiento: sin severidad, margen holgado", () => {
  // LTV actual = 20000/100000 = 20%, mantenimiento 70% → 28.6% del camino recorrido.
  const result = LeverageSimulator.proactiveLtvAlert({ portfolioValue: 100000, loanAmount: 20000, maintenanceLtvPct: 70 });
  assert.equal(result.calculable, true);
  assert.equal(result.currentLtvPct, 20);
  assert.equal(result.severity, null);
});

test("proactiveLtvAlert · al 70% del camino hacia el LTV de mantenimiento: severidad media", () => {
  // LTV actual = 49/100 = 49%, mantenimiento 70% → 49/70 = 70% exacto del camino.
  const result = LeverageSimulator.proactiveLtvAlert({ portfolioValue: 100000, loanAmount: 49000, maintenanceLtvPct: 70 });
  assert.equal(result.ratioToMaintenancePct, 70);
  assert.equal(result.severity, "medium");
});

test("proactiveLtvAlert · al 85% del camino: severidad alta", () => {
  // LTV actual = 59.5/100 = 59.5%, mantenimiento 70% → 85% exacto del camino.
  const result = LeverageSimulator.proactiveLtvAlert({ portfolioValue: 100000, loanAmount: 59500, maintenanceLtvPct: 70 });
  assert.equal(result.ratioToMaintenancePct, 85);
  assert.equal(result.severity, "high");
});

test("proactiveLtvAlert · LTV ya en o por encima del de mantenimiento: severidad crítica", () => {
  const result = LeverageSimulator.proactiveLtvAlert({ portfolioValue: 100000, loanAmount: 75000, maintenanceLtvPct: 70 });
  assert.equal(result.severity, "critical");
  assert.ok(result.ratioToMaintenancePct >= 100);
});

test("proactiveLtvAlert reutiliza tal cual lombardMarginCallSimulation, sin ningún cálculo de LTV propio", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-leverage-simulator.js"), "utf8");
  const block = source.slice(source.indexOf("function proactiveLtvAlert("), source.indexOf("function proactiveLtvAlert(") + 700);
  assert.match(block, /lombardMarginCallSimulation\(\{ portfolioValue, loanAmount, maintenanceLtvPct, stressDropPct: 0 \}\)/);
});

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

test("wiring: renderLev12ProactiveMarginCallAlert existe en app.js y usa la declaración persistida del crédito Lombard", () => {
  const start = appSource.indexOf("function renderLev12ProactiveMarginCallAlert(");
  assert.ok(start >= 0);
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /engine\.proactiveLtvAlert\(/);
  assert.match(block, /apx3LombardDeclaration\(\)/);
});

test("wiring: guardar apx3LoanAmount/apx3MaintenanceLtvPct persiste la declaración Lombard (LEV12/LEV11)", () => {
  assert.match(appSource, /qs\("apx3LoanAmount"\)\?\.addEventListener\("change", saveApx3LombardDeclaration\)/);
  assert.match(appSource, /qs\("apx3MaintenanceLtvPct"\)\?\.addEventListener\("change", saveApx3LombardDeclaration\)/);
});

test("wiring: la pantalla Deuda › Apalancamiento sincroniza y renderiza la alerta proactiva de LTV al abrirse", () => {
  const start = deudaSource.indexOf("function renderDeudaApalancamiento(");
  const block = deudaSource.slice(start, deudaSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /syncApx3LombardDeclarationControls\(\);/);
  assert.match(block, /renderLev12ProactiveMarginCallAlert\(\);/);
});
