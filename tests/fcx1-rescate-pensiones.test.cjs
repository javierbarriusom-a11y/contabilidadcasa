const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const IrpfEstimator = require(path.join(root, "canonical-irpf-estimator.js"));

// FCX1 (Oleada 2 Bloque 3): rescate de pensiones modelado, como capital único sumado a la renta
// general del año. Con las dos escalas de tramos ya registradas (A15-2) usa el coste marginal real
// por tramos; sin ellas cae al tipo marginal declarado (A15-1/A15-4). Nunca modela reducciones por
// antigüedad de las aportaciones (40% pre-2007) ni la modalidad en forma de renta — la app no
// registra cuándo se hizo cada aportación al plan.

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

test("index.html: la tarjeta de rescate de pensiones tiene sus campos", () => {
  ["fcx1WithdrawalAmount", "fcx1CurrentAnnualIncome", "fcx1WithdrawalRun", "fcx1WithdrawalNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de FCX1`);
  });
});

test("app.js: handleFcx1SimulateWithdrawal prueba primero los tramos (A15-2) y cae al tipo marginal declarado (A15-4) si faltan", () => {
  const block = appSource.slice(appSource.indexOf("function handleFcx1SimulateWithdrawal("), appSource.indexOf("function handleFcx1SimulateWithdrawal(") + 1200);
  assert.match(block, /latestIrpfScale\("state"\)/);
  assert.match(block, /latestIrpfScale\("regional"\)/);
  assert.match(block, /engine\.marginalTaxOnAdditionalIncome\(/);
  assert.match(block, /missing-brackets/);
  assert.match(block, /fiscalWithholdingRate\(\)/);
});

test("app.js: fcx1ResultHtml nunca esconde que faltan reducciones por antigüedad ni la modalidad en forma de renta", () => {
  const block = appSource.slice(appSource.indexOf("function fcx1ResultHtml("), appSource.indexOf("function fcx1ResultHtml(") + 1400);
  assert.match(block, /No incluye reducciones por antigüedad de las aportaciones ni la modalidad en forma de renta/);
  assert.match(block, /if \(!result\.calculable\)/);
});

test("app.js: el botón está cableado", () => {
  assert.match(appSource, /qs\("fcx1WithdrawalRun"\)\?\.addEventListener\("click", handleFcx1SimulateWithdrawal\);/);
});
