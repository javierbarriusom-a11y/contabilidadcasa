const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Leverage = require(path.join(root, "canonical-leverage-simulator.js"));

// APX2 (Oleada 2 Bloque 3): crédito con garantía de cartera (Lombard). Primer paso de APX3 (Bloque
// 4, simulador de ejecución de garantía, todavía sin construir). Capacidad de préstamo contra la
// cartera real (IV1) a un LTV que declara el hogar — nunca un LTV "típico" inventado. Fuera del
// guardarraíl AP4 a propósito: un préstamo con garantía real tiene un perfil de riesgo distinto.

test("lombardCreditCapacity · con cartera, LTV y tipo, calcula capacidad y coste anual", () => {
  const result = Leverage.lombardCreditCapacity({ portfolioValue: 100000, ltvPct: 50, annualRatePct: 4 });
  assert.equal(result.calculable, true);
  assert.equal(result.capacity, 50000);
  assert.equal(result.annualCost, 2000);
  assert.match(result.warning, /ejecución de garantía/);
});

test("lombardCreditCapacity · sin cartera, sin LTV o LTV fuera de 0-100, no calculable", () => {
  assert.equal(Leverage.lombardCreditCapacity({ portfolioValue: 0, ltvPct: 50, annualRatePct: 4 }).calculable, false);
  assert.equal(Leverage.lombardCreditCapacity({ portfolioValue: 100000, ltvPct: 0, annualRatePct: 4 }).calculable, false);
  assert.equal(Leverage.lombardCreditCapacity({ portfolioValue: 100000, ltvPct: 150, annualRatePct: 4 }).calculable, false);
});

test("lombardCreditCapacity · un tipo de interés no declarado (undefined) no impide calcular la capacidad, coste 0", () => {
  const result = Leverage.lombardCreditCapacity({ portfolioValue: 100000, ltvPct: 50 });
  assert.equal(result.calculable, true);
  assert.equal(result.capacity, 50000);
  assert.equal(result.annualCost, 0);
});

test("lombardCreditCapacity · nunca asume un LTV por defecto — el propio motor no trae ningún valor de fábrica", () => {
  const block = fs.readFileSync(path.join(root, "canonical-leverage-simulator.js"), "utf8");
  const fnStart = block.indexOf("function lombardCreditCapacity(");
  const fnEnd = block.indexOf("\n  }", fnStart);
  const fnBody = block.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /= 50|\|\| 50|ltvPct \?\? /, "no debe inventar un LTV típico");
});

test("index.html: la tarjeta de crédito Lombard tiene sus campos", () => {
  ["apx2LtvPct", "apx2RatePct", "apx2LombardRun", "apx2LombardNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de APX2`);
  });
});

test("app.js: handleApx2LombardSimulate usa el valor real de la cartera (IV1), no un importe declarado a mano", () => {
  const block = appSource.slice(appSource.indexOf("function handleApx2LombardSimulate("), appSource.indexOf("function handleApx2LombardSimulate(") + 700);
  assert.match(block, /portfolio\.normalizePositions\(iv1PositionsList\(\)\)\.summary\.totalValue/);
  assert.match(block, /engine\.lombardCreditCapacity\(/);
});

test("app.js: apx2LombardResultHtml nunca esconde que el riesgo de ejecución de garantía no está modelado", () => {
  const block = appSource.slice(appSource.indexOf("function apx2LombardResultHtml("), appSource.indexOf("function apx2LombardResultHtml(") + 700);
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /result\.warning/);
});

test("app.js: el botón está cableado", () => {
  assert.match(appSource, /qs\("apx2LombardRun"\)\?\.addEventListener\("click", handleApx2LombardSimulate\);/);
});
