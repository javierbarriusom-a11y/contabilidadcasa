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
