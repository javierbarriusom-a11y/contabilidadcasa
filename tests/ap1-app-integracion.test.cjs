const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("AP1: la tarjeta del comparador amortizar vs. invertir tiene todos sus campos", () => {
  ["ap1DebtSelect", "ap1Amount", "ap1DebtRate", "ap1Months", "ap1CompareRun", "ap1CompareNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de AP1`);
  });
  const cardStart = indexSource.indexOf("Comparador: amortizar vs. invertir");
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta AP1");
  const card = indexSource.slice(cardStart, cardStart + 1200);
  assert.match(card, /Ninguna cifra de mercado se inventa aquí/);
});

test("AP1: handleAp1Compare compone el lado de invertir con FinanceCanonicalPortfolio.opportunityCost, sin reimplementarlo", () => {
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 1000);
  assert.match(block, /window\.FinanceCanonicalPortfolio/);
  assert.match(block, /iv5PortfolioAnnualReturnPct\(\)/);
  assert.match(block, /portfolioEngine\.opportunityCost\(/);
  assert.match(block, /debtComparator\.compareAmortizeVsInvest\(/);
});

test("AP1: el importe pendiente de la deuda seleccionada limita remainingPrincipal", () => {
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 1000);
  assert.match(block, /remainingPrincipal: debt \? debt\.currentPrincipal : null/);
});

test("AP1: ap1ResultHtml nunca presenta la lectura amortizar/invertir como una orden", () => {
  const block = appSource.slice(appSource.indexOf("function ap1ResultHtml("), appSource.indexOf("function ap1ResultHtml(") + 1000);
  assert.match(block, /no una orden/);
});

test("AP1: sin datos calculables, ap1ResultHtml pide los tres campos en vez de inventar un resultado", () => {
  const block = appSource.slice(appSource.indexOf("function ap1ResultHtml("), appSource.indexOf("function ap1ResultHtml(") + 400);
  assert.match(block, /if \(!result\.calculable\)/);
});

test("AP1: el botón y la lista de deudas están cableados", () => {
  assert.match(appSource, /qs\("ap1CompareRun"\)\?\.addEventListener\("click", handleAp1Compare\);/);
});

test("AP1: la lista de deudas se renderiza en el arranque de la app, justo después de la alerta de AP6", () => {
  assert.match(appSource, /renderAp6Alert\(\);\s*\n\s*renderAp1DebtOptions\(\);/);
});

test("AP1: ap1DebtOptionsHtml solo lista deudas con principal pendiente", () => {
  const block = appSource.slice(appSource.indexOf("function ap1DebtOptionsHtml("), appSource.indexOf("function ap1DebtOptionsHtml(") + 400);
  assert.match(block, /debt\.currentPrincipal > 0/);
});

// ---------------------------------------------------------------------------------------------
// DLX1 (Oleada 2, Bloque 2) · guardarraíl de colchón antes de amortizar — se ve siempre que el
// importe de AP1 sea válido, calculado con el mismo suelo/reserva que ya usa AP6.
// ---------------------------------------------------------------------------------------------

test("DLX1: handleAp1Compare calcula el guardarraíl con el mismo suelo y reserva que AP6, solo con importe válido", () => {
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 1600);
  assert.match(block, /window\.FinanceCanonicalCushion/);
  assert.match(block, /Number\.isFinite\(amount\) && amount > 0/);
  assert.match(block, /cushionEngine\.amortizeCushionGuardrail\(/);
  assert.match(block, /liquidity: accountBalancesFromState\(\)\.total/);
  assert.match(block, /cushionEngine\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)\.value/);
});

test("DLX1: el guardarraíl se antepone a la lectura amortizar/invertir, no la sustituye", () => {
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 1600);
  assert.match(block, /note\.innerHTML = \(guardrail \? dlx1GuardrailHtml\(guardrail\) : ""\) \+ ap1ResultHtml\(/);
});

test("DLX1: dlx1GuardrailHtml nunca dice que bloquea nada — solo informa del estado", () => {
  const block = appSource.slice(appSource.indexOf("function dlx1GuardrailHtml("), appSource.indexOf("function dlx1GuardrailHtml(") + 900);
  assert.match(block, /sostenible/);
  assert.match(block, /ajustado/);
  assert.match(block, /insostenible/);
  assert.doesNotMatch(block, /bloque|deshabilita|impide/i);
});
