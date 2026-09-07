const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// DEB2/DEB8 (Oleada 3, Bloque 3): dimensionador de amortización parcial óptima y alerta de
// ventana de comisión decreciente. Ambas extienden la misma tarjeta de AP1/DLX2 en Ajustes ›
// Deuda y apalancamiento, sin motor de reparto nuevo — DEB2 reutiliza surplusAllocation.toDebt
// (DLX2) y DEB8 reutiliza FinanceDebtContracts.nextCheaperPrepaymentWindow.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de AP1 tiene el campo de comisión de amortización anticipada (DEB2)", () => {
  assert.match(indexSource, /id="ap1PrepaymentPenaltyPct"/);
});

test("la tarjeta de DEB8 vive en Ajustes › Deuda, con sus tres campos", () => {
  assert.match(indexSource, /id="deb8CurrentPenaltyPct"/);
  assert.match(indexSource, /id="deb8TierUntilMonth"/);
  assert.match(indexSource, /id="deb8NextPenaltyPct"/);
  assert.match(indexSource, /id="deb8PrepaymentWindowNote"/);
});

test("deb2DimensionHtml reutiliza FinanceCanonicalCushion.dimensionOptimalPrepayment con el toDebt de DLX2, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function deb2DimensionHtml("), appSource.indexOf("function deb2DimensionHtml(") + 900);
  assert.match(block, /window\.FinanceCanonicalCushion/);
  assert.match(block, /allocatedSurplus: allocation\.toDebt/);
  assert.match(block, /dimensionOptimalPrepayment\(/);
});

test("handleAp1Compare llama a deb2DimensionHtml con el reparto de DLX2", () => {
  const start = appSource.indexOf("function handleAp1Compare(");
  const block = appSource.slice(start, appSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /deb2DimensionHtml\(surplusAllocation\)/);
});

test("renderDeb8PrepaymentWindow reutiliza FinanceDebtContracts.nextCheaperPrepaymentWindow, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb8PrepaymentWindow("), appSource.indexOf("function renderDeb8PrepaymentWindow(") + 900);
  assert.match(block, /window\.FinanceDebtContracts/);
  assert.match(block, /nextCheaperPrepaymentWindow\(/);
});

test("los tres campos de DEB8 están conectados a renderDeb8PrepaymentWindow", () => {
  assert.match(appSource, /qs\("deb8CurrentPenaltyPct"\)\?\.addEventListener\("change", renderDeb8PrepaymentWindow\)/);
  assert.match(appSource, /qs\("deb8TierUntilMonth"\)\?\.addEventListener\("change", renderDeb8PrepaymentWindow\)/);
  assert.match(appSource, /qs\("deb8NextPenaltyPct"\)\?\.addEventListener\("change", renderDeb8PrepaymentWindow\)/);
});
