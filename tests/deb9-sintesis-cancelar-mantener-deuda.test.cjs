const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// DEB9 (Oleada 4, Bloque 2 — bandera del diagnóstico "El Libro Vivo", F-10, sin precedente en la
// Oleada 3): síntesis única "cancelar vs. mantener deuda", con las cuatro piezas que la sustentan
// (APX1/netDebtCostAfterTax, DEB3/waitingOptionValue, DEB2/dimensionOptimalPrepayment,
// INV7/liquidityLadder) siempre visibles — nunca combinadas en una única cifra sin mostrar de dónde
// sale cada parte. El colchón (DLX1) manda primero: sin margen tras cancelar, ninguna otra pieza
// puede recomendar cancelar.

const Synthesis = require("../canonical-debt-cancel-or-hold-synthesis.js");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("cancelOrHoldDebtSynthesis · sin AP1 calculable, no hay síntesis", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({});
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-ap1");
});

test("cancelOrHoldDebtSynthesis · el colchón manda: insostenible bloquea 'cancelar' aunque AP1 diga amortizar", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
    cushionGuardrail: { status: "insostenible", remaining: 1000, shortfall: 400 },
  });
  assert.equal(result.verdict, "no-cancelar-ahora");
  assert.match(result.headline, /400/);
  assert.equal(result.pieces.cushionGuardrail.status, "insostenible");
});

test("cancelOrHoldDebtSynthesis · colchón sostenible o ajustado no anula el veredicto de AP1", () => {
  const sostenible = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
    cushionGuardrail: { status: "sostenible", remaining: 5000, shortfall: 0 },
  });
  assert.equal(sostenible.verdict, "cancelar");
  const ajustado = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "invertir", amortizeSavings: 200, investGain: 500 },
    cushionGuardrail: { status: "ajustado", remaining: 2100, shortfall: 0 },
  });
  assert.equal(ajustado.verdict, "mantener");
});

test("cancelOrHoldDebtSynthesis · assessment neutral produce verdicto 'revisar', nunca inventa un ganador", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "neutral", amortizeSavings: 300, investGain: 300 },
  });
  assert.equal(result.verdict, "revisar");
});

test("cancelOrHoldDebtSynthesis · aviso de liquidez (INV7) cuando el suelo no está cubierto por tramos rápidos", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
    liquidity: { floorValue: 5000, floorCovered: false, floorCoveredBy: null },
  });
  assert.equal(result.liquidityCaution, true);
  assert.match(result.headline, /Aviso de liquidez/);
});

test("cancelOrHoldDebtSynthesis · sin aviso de liquidez cuando el suelo sí está cubierto", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
    liquidity: { floorValue: 5000, floorCovered: true, floorCoveredBy: "inmediata" },
  });
  assert.equal(result.liquidityCaution, false);
});

test("cancelOrHoldDebtSynthesis · con las cuatro piezas presentes, las cuatro quedan citadas en la lectura", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
    netDebtCost: { calculable: true, breakEvenAnnualReturnPct: 4, requiredPretaxReturnPct: 6.5, savingsTaxRatePct: 19 },
    waitingOption: { calculable: true, waitMonths: 3, waitingCost: 45, liquidityRunwayMonths: 2.5 },
    prepaymentDimension: { calculable: true, amount: 1000, penaltyCost: 10, totalCash: 1010, fullPayoff: false },
    liquidity: { floorValue: 5000, floorCovered: true, floorCoveredBy: "inmediata" },
  });
  assert.equal(result.verdict, "cancelar");
  assert.match(result.headline, /AP1:/);
  assert.match(result.headline, /APX1|fiscalidad/);
  assert.match(result.headline, /6\.5%/);
  assert.match(result.headline, /DEB3|Esperar/);
  assert.match(result.headline, /45/);
  assert.match(result.headline, /DEB2|dimensionado/);
  assert.equal(result.pieces.ap1.calculable, true);
  assert.equal(result.pieces.netDebtCost.calculable, true);
  assert.equal(result.pieces.waitingOption.calculable, true);
  assert.equal(result.pieces.prepaymentDimension.calculable, true);
  assert.equal(result.pieces.liquidity.calculable, true);
});

test("cancelOrHoldDebtSynthesis · piezas ausentes se declaran no calculables, nunca se inventan", () => {
  const result = Synthesis.cancelOrHoldDebtSynthesis({
    ap1: { calculable: true, assessment: "amortizar", amortizeSavings: 500, investGain: 300 },
  });
  assert.equal(result.pieces.netDebtCost.calculable, false);
  assert.equal(result.pieces.waitingOption.calculable, false);
  assert.equal(result.pieces.prepaymentDimension.calculable, false);
  assert.equal(result.pieces.liquidity.calculable, false);
});

test("cancelOrHoldDebtSynthesis está exportada", () => {
  assert.equal(typeof Synthesis.cancelOrHoldDebtSynthesis, "function");
});

test("wiring: la tarjeta DEB9 vive en index.html justo después del comparador AP1, cargando el módulo nuevo", () => {
  const ap1Pos = indexSource.indexOf('id="deb3OptionValueNote"');
  const deb9Pos = indexSource.indexOf('id="deb9SynthesisNote"');
  const deb8Pos = indexSource.indexOf('id="deb8PrepaymentWindowNote"');
  assert.ok(ap1Pos >= 0 && deb9Pos > ap1Pos && deb9Pos < deb8Pos);
  assert.match(indexSource, /canonical-debt-cancel-or-hold-synthesis\.js/);
});

test("wiring: handleAp1Compare llama a renderDeb9Synthesis con los resultados ya calculados (AP1, DLX1, DLX2)", () => {
  // DEB15 (Oleada 4, Bloque 6) añadió el guardarraíl a varios meses antes del pintado del
  // resultado — la ventana crece de 3000 a 3900.
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 3900);
  assert.match(block, /renderDeb9Synthesis\(\{/);
  assert.match(block, /ap1: result/);
  assert.match(block, /surplusAllocation, guardrail/);
});

test("wiring: deb9Synthesize reutiliza netDebtCostAfterTax, dimensionOptimalPrepayment y liquidityLadder ya existentes, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function deb9Synthesize("), appSource.indexOf("function deb9Synthesize(") + 1500);
  assert.match(block, /netDebtCostAfterTax\(/);
  assert.match(block, /dimensionOptimalPrepayment\(/);
  assert.match(block, /liquidityLadder\(/);
  assert.match(block, /window\.FinanceCanonicalDebtCancelOrHoldSynthesis/);
});
