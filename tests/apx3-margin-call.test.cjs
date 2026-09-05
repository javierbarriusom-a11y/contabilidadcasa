const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Leverage = require(path.join(root, "canonical-leverage-simulator.js"));

// APX3 (Oleada 2 Bloque 4): simulador de ejecución de garantía (margin call) sobre el crédito
// Lombard de APX2. El hogar declara cuánto pidió prestado de verdad, el LTV de mantenimiento del
// banco y una caída hipotética de la cartera — nunca un umbral "típico" inventado por este motor.
// Extiende el guardarraíl AP4 al nuevo instrumento: reutiliza amortizeCushionGuardrail (DLX1) para
// comparar la garantía adicional exigida contra el colchón real, en vez de reimplementar un
// guardarraíl propio.

test("lombardMarginCallSimulation · sin caída suficiente, el LTV se mantiene por debajo del de mantenimiento", () => {
  const result = Leverage.lombardMarginCallSimulation({ portfolioValue: 100000, loanAmount: 40000, maintenanceLtvPct: 70, stressDropPct: 10 });
  assert.equal(result.calculable, true);
  assert.equal(result.currentLtvPct, 40);
  assert.equal(result.stressedPortfolioValue, 90000);
  assert.equal(result.stressedLtvPct, 44.44);
  assert.equal(result.marginCallTriggered, false);
  assert.equal(result.additionalCollateralNeeded, 0);
  assert.equal(result.forcedLiquidationAmount, 0);
});

test("lombardMarginCallSimulation · una caída suficiente dispara la llamada de garantía, con las dos salidas calculadas", () => {
  const result = Leverage.lombardMarginCallSimulation({ portfolioValue: 100000, loanAmount: 60000, maintenanceLtvPct: 70, stressDropPct: 30 });
  assert.equal(result.calculable, true);
  assert.equal(result.stressedPortfolioValue, 70000);
  assert.equal(result.stressedLtvPct, 85.71);
  assert.equal(result.marginCallTriggered, true);
  assert.equal(result.additionalCollateralNeeded, 15714.29);
  assert.equal(result.forcedLiquidationAmount, 36666.67);
});

test("lombardMarginCallSimulation · las dos salidas restauran el mismo LTV de mantenimiento (consistencia interna)", () => {
  const result = Leverage.lombardMarginCallSimulation({ portfolioValue: 100000, loanAmount: 60000, maintenanceLtvPct: 70, stressDropPct: 30 });
  const afterCollateral = result.loanAmount / (result.stressedPortfolioValue + result.additionalCollateralNeeded);
  const afterLiquidation = (result.loanAmount - result.forcedLiquidationAmount) / (result.stressedPortfolioValue - result.forcedLiquidationAmount);
  assert.ok(Math.abs(afterCollateral * 100 - result.maintenanceLtvPct) < 0.01);
  assert.ok(Math.abs(afterLiquidation * 100 - result.maintenanceLtvPct) < 0.01);
});

test("lombardMarginCallSimulation · sin cartera, sin préstamo, sin LTV de mantenimiento válido (0-99) o sin caída válida (0-99), no calculable", () => {
  const base = { portfolioValue: 100000, loanAmount: 40000, maintenanceLtvPct: 70, stressDropPct: 10 };
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, portfolioValue: 0 }).calculable, false);
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, loanAmount: 0 }).calculable, false);
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, maintenanceLtvPct: 0 }).calculable, false);
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, maintenanceLtvPct: 100 }).calculable, false);
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, stressDropPct: -5 }).calculable, false);
  assert.equal(Leverage.lombardMarginCallSimulation({ ...base, stressDropPct: 100 }).calculable, false);
});

test("lombardMarginCallSimulation · nunca inventa un LTV de mantenimiento ni una caída por defecto", () => {
  const source = fs.readFileSync(path.join(root, "canonical-leverage-simulator.js"), "utf8");
  const fnStart = source.indexOf("function lombardMarginCallSimulation(");
  const fnEnd = source.indexOf("\n  }", fnStart);
  const fnBody = source.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /= 70|\|\| 70|= 20|\|\| 20/, "no debe inventar un LTV de mantenimiento ni una caída típicos");
});

test("index.html: la tarjeta de simulación de margin call tiene sus campos", () => {
  ["apx3LoanAmount", "apx3MaintenanceLtvPct", "apx3StressDropPct", "apx3MarginCallRun", "apx3MarginCallNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de APX3`);
  });
});

test("app.js: handleApx3MarginCallSimulate usa el valor real de la cartera (IV1) y compone el guardarraíl de colchón solo si se dispara la llamada", () => {
  const block = appSource.slice(appSource.indexOf("function handleApx3MarginCallSimulate("), appSource.indexOf("function handleApx3MarginCallSimulate(") + 1200);
  assert.match(block, /portfolio\.normalizePositions\(iv1PositionsList\(\)\)\.summary\.totalValue/);
  assert.match(block, /engine\.lombardMarginCallSimulation\(/);
  assert.match(block, /result\.calculable && result\.marginCallTriggered/);
  assert.match(block, /cushionEngine\.amortizeCushionGuardrail\(/);
  assert.match(block, /amount: result\.additionalCollateralNeeded/);
});

test("app.js: apx3MarginCallResultHtml nunca decide entre aportar garantía o liquidar — solo informa las dos cifras", () => {
  const block = appSource.slice(appSource.indexOf("function apx3MarginCallResultHtml("), appSource.indexOf("function apx3MarginCallResultHtml(") + 1300);
  assert.match(block, /if \(!result \|\| !result\.calculable\)/);
  assert.match(block, /no decide cuál de las dos opciones tomar/i);
  assert.match(block, /result\.additionalCollateralNeeded/);
  assert.match(block, /result\.forcedLiquidationAmount/);
});

test("app.js: sin llamada de garantía disparada, el resultado lo dice explícitamente en vez de omitir el veredicto", () => {
  const block = appSource.slice(appSource.indexOf("function apx3MarginCallResultHtml("), appSource.indexOf("function apx3MarginCallResultHtml(") + 1300);
  assert.match(block, /if \(!result\.marginCallTriggered\)/);
  assert.match(block, /no se dispararía una llamada de garantía/);
});

test("app.js: el botón está cableado", () => {
  assert.match(appSource, /qs\("apx3MarginCallRun"\)\?\.addEventListener\("click", handleApx3MarginCallSimulate\);/);
});
