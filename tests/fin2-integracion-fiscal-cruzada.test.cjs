const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Portfolio = require("../canonical-portfolio.js");
const Irpf = require("../canonical-irpf-estimator.js");
const DividendTax = require("../canonical-dividend-tax.js");

// FIN-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.5): test de integración fiscal cruzada. Los motores
// fiscales tienen cada uno su propio test aislado (FC1/FC3 en canonical-portfolio.js, FC4 en
// canonical-dividend-tax.js, A15-2/FC5/FCX1/I5 en canonical-irpf-estimator.js), pero nada
// comprobaba que un mismo ejercicio que pasa por varios a la vez sume bien. Este fichero construye
// UN año fiscal completo (ventas con plusvalía y con minusvalía, pérdidas arrastradas de años
// anteriores, un dividendo extranjero, una venta más que se está valorando y un rescate de pensión)
// y verifica los puntos de cruce entre motores, no cada motor por separado.
//
// Hallazgo que destapó al construirlo: FC5 (optimizePartialSale) no aceptaba una base negativa —
// la recortaba a 0 —, así que la cadena FC3 → FC5 que la propia pantalla sugiere («la base ya
// generada este año puede venir de la compensación de pérdidas y ganancias») cobraba impuesto sobre
// plusvalía que en realidad quedaba absorbida por las pérdidas del año o por las arrastradas
// todavía disponibles. Ver el cierre de sesión de FIN-2 en PROJECT_STATE.md.

const SOURCE = { title: "Agencia Tributaria", authority: "Declarado por el hogar", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-01-01" };
const SAVINGS_SCALE = { source: SOURCE, brackets: [{ limit: 6000, rate: 19 }, { limit: 50000, rate: 21 }, { limit: null, rate: 23 }] };
const STATE_SCALE = { source: SOURCE, brackets: [{ limit: 12450, rate: 9.5 }, { limit: 20200, rate: 12 }, { limit: 35200, rate: 15 }, { limit: null, rate: 18.5 }] };
const REGIONAL_SCALE = { source: SOURCE, brackets: [{ limit: 12450, rate: 9.5 }, { limit: 20200, rate: 12 }, { limit: 35200, rate: 15 }, { limit: null, rate: 22.5 }] };

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const savingsTax = (base) => Irpf.progressiveTax(Math.max(0, base), SAVINGS_SCALE.brackets);

// Un ejercicio 2026 con tres posiciones:
// - A (fondo): dos lotes, venta en 2026 que consume el primero entero y parte del segundo (FIFO).
// - B (acción): venta completa en pérdidas en 2026.
// - C (ETF): venta con plusvalía en 2025 — no debe contaminar la compensación de 2026.
const RAW_POSITIONS = [
  {
    id: "A", type: "fondo", label: "Fondo A", provenance: "manual", asOf: "2026-09-01",
    acquisitionDate: "2020-01-10", quantity: 100, costBasis: 10000, currentValue: 5200,
    contributions: [{ date: "2021-06-01", amount: 6000, quantity: 50 }],
    disposals: [{ date: "2026-03-15", quantitySold: 120, saleProceeds: 18000 }],
  },
  {
    id: "B", type: "accion", label: "Acción B", provenance: "manual", asOf: "2026-09-01",
    acquisitionDate: "2022-02-01", quantity: 40, costBasis: 8000, currentValue: 0,
    disposals: [{ date: "2026-05-20", quantitySold: 40, saleProceeds: 5000 }],
  },
  {
    id: "C", type: "etf", label: "ETF C", provenance: "manual", asOf: "2026-09-01",
    acquisitionDate: "2019-04-01", quantity: 10, costBasis: 1000, currentValue: 1500,
    disposals: [{ date: "2025-11-02", quantitySold: 5, saleProceeds: 1500 }],
  },
];
// 2021 queda fuera de la ventana de 4 ejercicios (art. 49 LIRPF): 2022-2025 sí entran.
const PRIOR_LOSSES = [{ year: 2021, amount: 900 }, { year: 2022, amount: 1500 }, { year: 2025, amount: 2000 }];

function year2026() {
  const { positions, summary } = Portfolio.normalizePositions(RAW_POSITIONS);
  const compensation = Portfolio.yearEndCompensation({ positions, year: 2026, priorLosses: PRIOR_LOSSES });
  return { positions, summary, compensation };
}

test("FC1 → FC3: el FIFO conserva el coste y la compensación del año suma exactamente las ventas de ese año", () => {
  const { positions, summary, compensation } = year2026();
  const [a, b, c] = positions;

  // Coste consumido + coste restante = coste total de los lotes (16.000 €): ni se crea ni se pierde coste.
  assert.equal(a.disposals[0].consumedCost, 12400);
  assert.equal(round2(a.disposals[0].consumedCost + a.costBasis), 16000);
  assert.equal(a.realizedGain, 5600);
  assert.equal(b.realizedGain, -3000);
  assert.equal(c.realizedGain, 1000);

  // La cartera agrega todos los años; la compensación solo el año pedido.
  assert.equal(summary.totalRealizedGain, 3600);
  assert.equal(compensation.calculable, true);
  assert.equal(compensation.yearGains, 5600);
  assert.equal(compensation.yearLosses, -3000);
  assert.equal(compensation.netResult, round2(a.realizedGain + b.realizedGain));
});

test("FC3: las pérdidas arrastradas se aplican de la más antigua a la más nueva, solo dentro de la ventana de 4 años", () => {
  const { compensation } = year2026();
  assert.deepEqual(compensation.priorLossesApplied, [{ year: "2022", amount: 1500 }, { year: "2025", amount: 1100 }]);
  assert.equal(compensation.taxableNet, 0);
  assert.deepEqual(compensation.remainingPriorLosses, [{ year: "2025", amount: 900 }]);
  // Base de partida para una venta más este año: neto del año menos TODAS las pérdidas arrastradas
  // todavía aplicables (las ya aplicadas y las que siguen disponibles). Negativa = margen que una
  // plusvalía nueva puede consumir sin tributar.
  assert.equal(compensation.marginalSaleBase, -900);
});

test("FC3 → FC5: una venta más este año tributa solo por lo que no absorben las pérdidas disponibles", () => {
  const { compensation } = year2026();
  const proposedGain = 5000;
  const result = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain });
  assert.equal(result.calculable, true);
  // 5.000 − 900 de pérdida 2025 aún disponible = 4.100 € sujetos, todos al 19%.
  const expected = round2(savingsTax(compensation.marginalSaleBase + proposedGain) - savingsTax(compensation.marginalSaleBase));
  assert.equal(expected, 779);
  assert.equal(result.marginalTax, expected);
  assert.equal(result.absorbedByLosses, 900);
  // El margen hasta el siguiente tramo cuenta también lo que absorben las pérdidas: 6.000 + 900.
  assert.equal(result.roomInCurrentBracket, 6900);
  assert.equal(result.withinBracket, true);
});

test("FC3 → FC5: en un año con pérdida neta, una plusvalía menor que esa pérdida no tributa nada", () => {
  const { positions } = Portfolio.normalizePositions([RAW_POSITIONS[1]]);
  const compensation = Portfolio.yearEndCompensation({ positions, year: 2026, priorLosses: [] });
  assert.equal(compensation.netResult, -3000);
  assert.equal(compensation.taxableNet, -3000);
  assert.equal(compensation.marginalSaleBase, -3000);

  const small = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain: 2000 });
  assert.equal(small.marginalTax, 0);
  assert.equal(small.absorbedByLosses, 2000);

  const large = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain: 5000 });
  assert.equal(large.marginalTax, 380); // 2.000 € sujetos al 19%.
  assert.equal(large.absorbedByLosses, 3000);
});

test("FC5 encadenado: partir una venta en dos no cambia el impuesto total, en cualquier orden y con base negativa", () => {
  [-2500, 0, 4000, 49000].forEach((startBase) => {
    const whole = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: startBase, proposedGain: 9000 }).marginalTax;
    const firstA = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: startBase, proposedGain: 3000 }).marginalTax;
    const thenB = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: startBase + 3000, proposedGain: 6000 }).marginalTax;
    const firstB = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: startBase, proposedGain: 6000 }).marginalTax;
    const thenA = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: startBase + 6000, proposedGain: 3000 }).marginalTax;
    assert.equal(round2(firstA + thenB), whole, `base ${startBase}, A→B`);
    assert.equal(round2(firstB + thenA), whole, `base ${startBase}, B→A`);
    assert.equal(whole, round2(savingsTax(startBase + 9000) - savingsTax(startBase)), `base ${startBase}, contra la escala`);
  });
});

test("FC5: con base positiva el comportamiento no cambia (retrocompatible) y no informa pérdidas absorbidas", () => {
  const result = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 5000, proposedGain: 4000 });
  assert.equal(result.roomInCurrentBracket, 1000);
  assert.equal(result.suggestedAmountWithinBracket, 1000);
  assert.equal(result.excessOverBracket, 3000);
  assert.equal(result.absorbedByLosses, 0);
  assert.equal(result.marginalTax, round2(1000 * 0.19 + 3000 * 0.21));
});

test("FC4 ↔ escala del ahorro: el dividendo cuadra al céntimo con la escala cuando cabe en un solo tramo", () => {
  const dividend = DividendTax.calculateDividendTax({ grossAmount: 1200, foreignWithholdingPct: 15, spanishSavingsRatePct: 19 });
  // Conservación: bruto = neto + retenido fuera + cuota española adicional.
  assert.equal(round2(dividend.netAmount + dividend.foreignWithheld + dividend.additionalSpanishTax), dividend.grossAmount);
  // La deducción por doble imposición nunca supera lo que la renta tributaría en España.
  assert.ok(dividend.creditableForeignTax <= Math.min(dividend.foreignWithheld, dividend.spanishTaxDue));
  // Con el tipo declarado igual al del tramo en el que cae, FC4 y la escala del ahorro coinciden.
  const baseAfterSales = 0; // base del ahorro tras la compensación de year2026() (taxableNet)
  assert.equal(dividend.spanishTaxDue, round2(savingsTax(baseAfterSales + 1200) - savingsTax(baseAfterSales)));

  // Retención de origen mayor que la cuota española: el exceso nunca se deduce, queda como peaje.
  const highWithholding = DividendTax.calculateDividendTax({ grossAmount: 1000, foreignWithholdingPct: 30, spanishSavingsRatePct: 19 });
  assert.equal(highWithholding.creditableForeignTax, 190);
  assert.equal(highWithholding.additionalSpanishTax, 0);
  assert.equal(highWithholding.excessForeignWithholding, 110);
  assert.equal(round2(highWithholding.netAmount + highWithholding.foreignWithheld + highWithholding.additionalSpanishTax), 1000);
});

test("Base general: FCX1, I5 y A15-2 dan el mismo coste marginal sobre las mismas escalas", () => {
  const income = 30000;
  const amount = 12000;
  const fcx1 = Irpf.marginalTaxOnAdditionalIncome({ amount, currentAnnualIncome: income, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  const before = Irpf.estimateIrpfResult({ taxableBaseRange: { low: income, high: income }, withholdingsPaid: 0, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  const after = Irpf.estimateIrpfResult({ taxableBaseRange: { low: income + amount, high: income + amount }, withholdingsPaid: 0, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  assert.equal(fcx1.marginalTax, round2(after.quotaRange.low - before.quotaRange.low));

  // I5 con un solo año de renta y sin aportaciones anteriores a 2007 = el mismo rescate de FCX1.
  const i5 = Irpf.pensionWithdrawalComparison({ amount, currentAnnualIncome: income, annuityYears: 1, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  assert.equal(i5.lumpSum.marginalTax, fcx1.marginalTax);
  assert.equal(i5.annuity.marginalTax, fcx1.marginalTax);
  assert.equal(i5.netDifference, 0);
});

test("Bases separadas: un rescate de pensión (base general) no altera el coste de una plusvalía (base del ahorro)", () => {
  const { compensation } = year2026();
  const saleAlone = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain: 5000 });
  // El rescate se calcula sobre la escala general y nunca entra en la base del ahorro: el mismo
  // año con o sin rescate deja idéntico el coste de la venta.
  Irpf.marginalTaxOnAdditionalIncome({ amount: 20000, currentAnnualIncome: 30000, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  const saleAfterWithdrawal = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain: 5000 });
  assert.deepEqual(saleAfterWithdrawal, saleAlone);
});

test("Ejercicio completo: impuesto del ahorro de 2026 = escala aplicada a la base conjunta tras compensar", () => {
  const { compensation } = year2026();
  const dividendGross = 1200;
  const proposedGain = 5000;
  // Recorrido que haría el hogar en la app: compensación (FC3) → venta que valora (FC5) → dividendo
  // (FC4, al tipo del tramo en el que cae tras la venta).
  const sale = Irpf.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: compensation.marginalSaleBase, proposedGain });
  const baseAfterSale = compensation.marginalSaleBase + proposedGain;
  const dividend = DividendTax.calculateDividendTax({ grossAmount: dividendGross, foreignWithholdingPct: 15, spanishSavingsRatePct: 19 });
  const piecewise = round2(sale.marginalTax + dividend.spanishTaxDue);
  // Base conjunta del ahorro: 2.600 neto del año − 3.500 arrastradas + 5.000 venta + 1.200 dividendo
  // = 5.300 €, dentro del primer tramo (19%). El 25% de compensación cruzada entre rendimientos y
  // ganancias (art. 49.1 LIRPF) no aplica aquí porque ambos saldos son positivos.
  assert.equal(round2(baseAfterSale + dividendGross), 5300);
  assert.equal(piecewise, round2(savingsTax(baseAfterSale + dividendGross)));
});

test("Cableado en la app: FC3 enseña la base de partida para FC5 y FC5 admite una base negativa", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const fc3Block = app.slice(app.indexOf("function fc3ResultHtml("), app.indexOf("function handleFc3Compare("));
  assert.match(fc3Block, /fc3MarginalSaleBaseLine\(result\)/);
  const helperBlock = app.slice(app.indexOf("function fc3MarginalSaleBaseLine("), app.indexOf("function fc3ResultHtml("));
  assert.match(helperBlock, /result\.marginalSaleBase/);
  const fc5Block = app.slice(app.indexOf("function fc5ResultHtml("), app.indexOf("function fcx1ResultHtml("));
  assert.match(fc5Block, /result\.absorbedByLosses/);
  const input = html.match(/<input id="fc5AlreadyRealized"[^>]*>/)[0];
  assert.doesNotMatch(input, /min="0"/);
  // INV18 comparte el mismo campo: tampoco puede recortar la base negativa a cero.
  const inv18Block = app.slice(app.indexOf("function inv18WithdrawalPlan("), app.indexOf("function handleInv18CalculatePlan("));
  assert.doesNotMatch(inv18Block, /let savingsBase = Math\.max\(0,/);
});
