const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("SP3: la tarjeta de Ajustes tiene los campos de cobertura y valor de reposición", () => {
  assert.match(indexSource, /id="ajustesHomeInsuranceCoverage"/);
  assert.match(indexSource, /id="ajustesHomeInsuranceReplacementValue"/);
  assert.match(indexSource, /id="ajustesHomeInsuranceNote"/);
});

test("SP3: renderAjustesHomeInsuranceNote llama a evaluateHomeInsuranceGap", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustesHomeInsuranceNote"), appSource.indexOf("function renderAjustesHomeInsuranceNote") + 800);
  assert.match(block, /FinanceCanonicalHomeInsurance\?\.evaluateHomeInsuranceGap\(coverage, replacementValue\)/);
});

test("SP3: sin valor de reposición, la nota no fabrica una comparación", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustesHomeInsuranceNote"), appSource.indexOf("function renderAjustesHomeInsuranceNote") + 800);
  assert.match(block, /if \(!replacementValue\)/);
});

test("SP3: los dos campos guardan en scenarioSettings al cambiar", () => {
  assert.match(appSource, /qs\("ajustesHomeInsuranceCoverage"\)\?\.addEventListener\("change", handleHomeInsuranceChange\("homeInsuranceCoverage"\)\);/);
  assert.match(appSource, /qs\("ajustesHomeInsuranceReplacementValue"\)\?\.addEventListener\("change", handleHomeInsuranceChange\("homeInsuranceReplacementValue"\)\);/);
});
