const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("FC4: la tarjeta de Ajustes tiene los tres campos del cálculo", () => {
  assert.match(indexSource, /id="ajustesDividendGrossAmount"/);
  assert.match(indexSource, /id="ajustesDividendForeignWithholdingPct"/);
  assert.match(indexSource, /id="ajustesDividendSpanishSavingsRatePct"/);
  assert.match(indexSource, /id="ajustesDividendTaxNote"/);
});

test("FC4: renderAjustesDividendTaxNote llama a calculateDividendTax", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustesDividendTaxNote"), appSource.indexOf("function renderAjustesDividendTaxNote") + 900);
  assert.match(block, /FinanceCanonicalDividendTax\?\.calculateDividendTax\(\{/);
});

test("FC4: sin cálculo posible, la nota no fabrica una cifra", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustesDividendTaxNote"), appSource.indexOf("function renderAjustesDividendTaxNote") + 900);
  assert.match(block, /if \(!result\)/);
});

test("FC4: avisa del exceso de retención de origen no deducible cuando lo hay", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustesDividendTaxNote"), appSource.indexOf("function renderAjustesDividendTaxNote") + 900);
  assert.match(block, /excessForeignWithholding > 0/);
});

test("FC4: los tres campos guardan en scenarioSettings al cambiar", () => {
  assert.match(appSource, /qs\("ajustesDividendGrossAmount"\)\?\.addEventListener\("change", handleDividendTaxChange\("dividendGrossAmount"\)\);/);
  assert.match(appSource, /qs\("ajustesDividendForeignWithholdingPct"\)\?\.addEventListener\("change", handleDividendTaxChange\("dividendForeignWithholdingPct", \{ max: 100 \}\)\);/);
  assert.match(appSource, /qs\("ajustesDividendSpanishSavingsRatePct"\)\?\.addEventListener\("change", handleDividendTaxChange\("dividendSpanishSavingsRatePct", \{ max: 100 \}\)\);/);
});

// DI4 (bug encontrado de paso): estos tres campos se editaban en `state` pero saveScenarioSettings()
// no los copiaba a la lista explícita que persiste — sobrevivían a la sesión en curso, no a recargar
// la página. Corregido junto con DI4, que tocaba la misma función.
test("FC4: saveScenarioSettings persiste los tres campos, no solo el evento", () => {
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const body = appSource.slice(start, end);
  assert.match(body, /dividendGrossAmount: round2\(Math\.max\(0, Number\(state\.dividendGrossAmount \|\| 0\)\)\)/);
  assert.match(body, /dividendForeignWithholdingPct: round2\(Math\.max\(0, Math\.min\(100, Number\(state\.dividendForeignWithholdingPct \|\| 0\)\)\)\)/);
  assert.match(body, /dividendSpanishSavingsRatePct: round2\(Math\.max\(0, Math\.min\(100, Number\(state\.dividendSpanishSavingsRatePct \|\| 0\)\)\)\)/);
});
