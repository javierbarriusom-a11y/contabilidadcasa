const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// LEV3 (Oleada 3, Bloque 3): estrés combinado tipos + mercado, en Ajustes › Deuda y
// apalancamiento, justo debajo del margin call de APX3. Reutiliza la hipoteca ya declarada
// (Patrimonio e inversión) y el margin call ya calculado — sin motor nuevo aparte de la
// composición (evaluateCombinedStress, canonical-mortgage-rate-scenarios.js).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de estrés combinado vive justo debajo del margin call de APX3", () => {
  const marginCallPos = indexSource.indexOf('id="apx3MarginCallNote"');
  const lev3Pos = indexSource.indexOf('id="lev3CombinedStressRun"');
  assert.ok(marginCallPos >= 0 && lev3Pos > marginCallPos);
  assert.match(indexSource, /id="lev3RateDeltaPoints"/);
  assert.match(indexSource, /id="lev3CombinedStressNote"/);
});

test("handleLev3CombinedStress reutiliza lombardMarginCallSimulation y evaluateCombinedStress, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function handleLev3CombinedStress("), appSource.indexOf("function handleLev3CombinedStress(") + 1200);
  assert.match(block, /window\.FinanceCanonicalMortgageRateScenarios/);
  assert.match(block, /window\.FinanceCanonicalLeverageSimulator/);
  assert.match(block, /lombardMarginCallSimulation\(/);
  assert.match(block, /evaluateCombinedStress\(/);
});

test("handleLev3CombinedStress lee la hipoteca ya declarada en Patrimonio e inversión, no un campo propio", () => {
  const block = appSource.slice(appSource.indexOf("function handleLev3CombinedStress("), appSource.indexOf("function handleLev3CombinedStress(") + 1200);
  assert.match(block, /qs\("ajustesMortgagePrincipal"\)/);
  assert.match(block, /qs\("ajustesMortgageMonths"\)/);
  assert.match(block, /qs\("ajustesMortgageVariableRate"\)/);
});

test("el botón de estrés combinado está conectado a handleLev3CombinedStress", () => {
  assert.match(appSource, /qs\("lev3CombinedStressRun"\)\?\.addEventListener\("click", handleLev3CombinedStress\)/);
});
