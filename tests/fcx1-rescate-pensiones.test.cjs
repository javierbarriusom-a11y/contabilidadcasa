const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const IrpfEstimator = require(path.join(root, "canonical-irpf-estimator.js"));

// FCX1 (Oleada 2 Bloque 3) + I5 (BACKLOG_CONTABILIDADCASA_2_0.md §2): rescate de pensiones,
// comparando capital único vs. modalidad en forma de renta. Con las dos escalas de tramos ya
// registradas (A15-2) usa el coste marginal real por tramos; sin ellas cae al tipo marginal
// declarado (A15-1/A15-4). I5 añade la reducción del 40% sobre el importe declarado como aportado
// antes de 2007 (solo al capital, nunca a la renta) y el reparto en varios años de la modalidad en
// forma de renta — sigue sin comprobar el plazo legal de la reducción ni proyectar cómo cambiará
// la renta futura, ambos supuestos explícitos en el resultado (pensionWithdrawalComparison).

const STATE_SCALE = {
  brackets: [{ limit: 20000, rate: 20 }, { limit: null, rate: 40 }],
  source: { title: "IRPF estatal", authority: "AEAT", url: "https://example.org", checkedAt: "2026-01-01" },
};
const REGIONAL_SCALE = {
  brackets: [{ limit: 20000, rate: 10 }, { limit: null, rate: 20 }],
  source: { title: "IRPF autonómico", authority: "CCAA", url: "https://example.org", checkedAt: "2026-01-01" },
};

test("marginalTaxOnAdditionalIncome · con las dos escalas registradas, calcula el coste marginal por tramos (nunca el tipo medio)", () => {
  // Base 15000 (dentro del primer tramo, 20+10=30%) + rescate 10000 cruza a 25000: los primeros
  // 5000 tributan al 30%, los siguientes 5000 al 40+20=60%.
  const result = IrpfEstimator.marginalTaxOnAdditionalIncome({
    amount: 10000,
    currentAnnualIncome: 15000,
    stateScale: STATE_SCALE,
    regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.calculable, true);
  const expected = Math.round((5000 * 0.30 + 5000 * 0.60) * 100) / 100;
  assert.equal(result.marginalTax, expected);
  assert.equal(result.netAmount, Math.round((10000 - expected) * 100) / 100);
});

test("marginalTaxOnAdditionalIncome · sin las dos escalas válidas, no calculable con el motivo", () => {
  const result = IrpfEstimator.marginalTaxOnAdditionalIncome({ amount: 10000, currentAnnualIncome: 15000, stateScale: {}, regionalScale: {} });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-brackets");
});

test("marginalTaxOnAdditionalIncome · sin importe a rescatar, no calculable", () => {
  const result = IrpfEstimator.marginalTaxOnAdditionalIncome({ amount: 0, currentAnnualIncome: 15000, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("pensionWithdrawalComparison · sin importe, no calculable", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({ amount: 0, currentAnnualIncome: 15000, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("pensionWithdrawalComparison · sin tramos válidos ni tipo plano, no calculable con el motivo", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({ amount: 10000, currentAnnualIncome: 15000, stateScale: {}, regionalScale: {} });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-brackets");
});

test("pensionWithdrawalComparison · sin tramos, cae al tipo plano declarado (flatRatePct) para ambas modalidades", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 10000, currentAnnualIncome: 15000, annuityYears: 2, stateScale: {}, regionalScale: {}, flatRatePct: 30,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.method, "flat-marginal-rate");
  assert.equal(result.lumpSum.marginalTax, 3000);
  assert.equal(result.annuity.annualPayment, 5000);
  assert.equal(result.annuity.marginalTax, 3000); // 1500/año * 2 años, mismo tipo plano
});

test("pensionWithdrawalComparison · sin importe declarado de pre-2007, no aplica reducción", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 10000, currentAnnualIncome: 15000, annuityYears: 1, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.lumpSum.reductionApplied, 0);
  assert.equal(result.lumpSum.taxableAmount, 10000);
});

test("pensionWithdrawalComparison · con importe pre-2007 declarado, reduce el 40% de esa parte de la base del capital único, nunca de la renta", () => {
  // 4000 con derecho a reducción → 4000*0.4 = 1600 menos de base. Base imponible del capital:
  // 10000 - 1600 = 8400. La renta reparte los 10000 completos, sin reducción.
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 10000, preTwoThousandSevenAmount: 4000, currentAnnualIncome: 0, annuityYears: 1,
    stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.lumpSum.reductionApplied, 1600);
  assert.equal(result.lumpSum.taxableAmount, 8400);
  assert.equal(result.annuity.annualPayment, 10000);
});

test("pensionWithdrawalComparison · el importe con derecho a reducción nunca supera el total rescatado", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 5000, preTwoThousandSevenAmount: 999999, currentAnnualIncome: 0, annuityYears: 1,
    stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.lumpSum.reductionApplied, 2000); // 5000 * 0.4, tope en el total
  assert.equal(result.lumpSum.taxableAmount, 3000);
});

test("pensionWithdrawalComparison · repartir en varios años reduce el coste marginal frente al capital único (progresividad), y netDifference lo refleja", () => {
  // Base 0: capital único de 30000 sube de golpe cruzando ambos tramos; repartido en 3 años de
  // 10000 cada uno se queda por debajo del corte de 20000 cada año, tipo más bajo en todo el tramo.
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 30000, currentAnnualIncome: 0, annuityYears: 3, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.calculable, true);
  assert.ok(result.annuity.marginalTax < result.lumpSum.marginalTax, "la renta repartida debe tributar menos que el capital único con este perfil progresivo");
  assert.ok(result.netDifference < 0, "netDifference negativo: la renta sale mejor en neto");
});

test("pensionWithdrawalComparison · declara siempre los supuestos de la reducción y de la modalidad en forma de renta", () => {
  const result = IrpfEstimator.pensionWithdrawalComparison({
    amount: 10000, currentAnnualIncome: 15000, annuityYears: 1, stateScale: STATE_SCALE, regionalScale: REGIONAL_SCALE,
  });
  assert.equal(result.assumptions.length, 2);
  assert.match(result.assumptions[0], /reducción del 40%/);
  assert.match(result.assumptions[1], /modalidad en forma de renta asume/);
});

test("index.html: la tarjeta de rescate de pensiones tiene sus campos, incluidos los de I5", () => {
  ["fcx1WithdrawalAmount", "fcx1CurrentAnnualIncome", "fcx1PreTwoThousandSevenAmount", "fcx1AnnuityYears", "fcx1WithdrawalRun", "fcx1WithdrawalNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de FCX1`);
  });
});

test("app.js: handleFcx1SimulateWithdrawal lee los campos de I5 y llama a pensionWithdrawalComparison con fallback de tipo plano", () => {
  const block = appSource.slice(appSource.indexOf("function handleFcx1SimulateWithdrawal("), appSource.indexOf("function handleFcx1SimulateWithdrawal(") + 1200);
  assert.match(block, /latestIrpfScale\("state"\)/);
  assert.match(block, /latestIrpfScale\("regional"\)/);
  assert.match(block, /qs\("fcx1PreTwoThousandSevenAmount"\)\?\.value/);
  assert.match(block, /qs\("fcx1AnnuityYears"\)\?\.value/);
  assert.match(block, /engine\.pensionWithdrawalComparison\(/);
  assert.match(block, /flatRatePct/);
  assert.match(block, /fiscalWithholdingRate\(\)/);
});

test("app.js: fcx1ResultHtml compara capital único vs. renta y nunca esconde los supuestos de la reducción ni de la modalidad en forma de renta", () => {
  const block = appSource.slice(appSource.indexOf("function fcx1ResultHtml("), appSource.indexOf("function fcx1ResultHtml(") + 2100);
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /result\.lumpSum/);
  assert.match(block, /result\.annuity/);
  assert.match(block, /result\.netDifference/);
  assert.match(block, /result\.assumptions\.join/);
});

test("app.js: el botón está cableado", () => {
  assert.match(appSource, /qs\("fcx1WithdrawalRun"\)\?\.addEventListener\("click", handleFcx1SimulateWithdrawal\);/);
});
