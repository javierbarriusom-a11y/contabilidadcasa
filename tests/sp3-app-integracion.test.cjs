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

// DI4 (bug encontrado de paso): estos dos campos se editaban en `state` pero saveScenarioSettings()
// no los copiaba a la lista explícita que persiste — sobrevivían a la sesión en curso, no a recargar
// la página. Corregido junto con DI4, que tocaba la misma función.
test("SP3: saveScenarioSettings persiste la cobertura y el valor de reposición, no solo el evento", () => {
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const body = appSource.slice(start, end);
  assert.match(body, /homeInsuranceCoverage: round2\(Math\.max\(0, Number\(state\.homeInsuranceCoverage \|\| 0\)\)\)/);
  assert.match(body, /homeInsuranceReplacementValue: round2\(Math\.max\(0, Number\(state\.homeInsuranceReplacementValue \|\| 0\)\)\)/);
});
