const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// LEV4 (Oleada 3, Bloque 3): comparador de líneas Lombard entre entidades, justo debajo de la
// tarjeta APX2 en Ajustes › Deuda y apalancamiento. Mismo patrón de lista repetible que la
// pérdida arrastrada de FC3 (Fiscal): guarda en scenarioSettings.lev4LombardOffers, sin estado
// propio aparte.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta del comparador Lombard vive justo debajo de APX2, antes de APX3", () => {
  const apx2Pos = indexSource.indexOf('id="apx2LombardNote"');
  const lev4Pos = indexSource.indexOf('id="lev4OfferSave"');
  const apx3Pos = indexSource.indexOf('id="apx3MarginCallNote"');
  assert.ok(apx2Pos >= 0 && lev4Pos > apx2Pos && lev4Pos < apx3Pos);
  ["lev4OfferEntity", "lev4OfferMaxLtvPct", "lev4OfferRatePct", "lev4OfferOpeningFeePct", "lev4OfferCancellationFeePct", "lev4OfferMaintenanceLtvPct", "lev4OfferList", "lev4ComparisonNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
  });
});

test("lev4LombardOffersList lee de scenarioSettings, sin estado propio aparte", () => {
  const block = appSource.slice(appSource.indexOf("function lev4LombardOffersList("), appSource.indexOf("function lev4LombardOffersList(") + 200);
  assert.match(block, /scenarioSettings\.lev4LombardOffers/);
});

test("renderLev4LombardComparison reutiliza FinanceCanonicalLeverageSimulator.compareLombardOffers sobre la cartera real (IV1), sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function renderLev4LombardComparison("), appSource.indexOf("function renderLev4LombardComparison(") + 1400);
  assert.match(block, /window\.FinanceCanonicalLeverageSimulator/);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /compareLombardOffers\(/);
});

test("guardar y quitar ofertas están conectados a sus botones", () => {
  assert.match(appSource, /qs\("lev4OfferSave"\)\?\.addEventListener\("click", saveLev4LombardOffer\)/);
  assert.match(appSource, /qs\("lev4OfferList"\)\?\.addEventListener\("click"/);
});

test("renderLev4LombardComparison se llama en el arranque de la app", () => {
  assert.match(appSource, /renderFc3PriorLossList\(\);\n\s*renderLev4LombardComparison\(\);/);
});
