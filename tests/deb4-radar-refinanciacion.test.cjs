const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// DEB4 (Oleada 3, Bloque 3): radar de refinanciación activo. APX5 (refinancingBreakEvenMonths) ya
// calcula el punto de equilibrio bajo demanda; DEB4 persiste los campos de la hipoteca (antes
// calculadora puntual, sin persistencia) y un umbral declarado, para avisar en cada arranque sin
// tener que reabrir el simulador — mismo patrón que DEB1 (aviso visible sin pulsar el botón).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de hipoteca tiene el hueco del radar, visible antes del botón Comparar", () => {
  const cardStart = indexSource.indexOf("Hipoteca variable → fija bajo escenarios de tipos");
  const alertPos = indexSource.indexOf('id="deb4RadarAlert"');
  const thresholdPos = indexSource.indexOf('id="deb4MaxBreakEvenMonths"');
  const buttonPos = indexSource.indexOf('id="ajustesMortgageScenariosCompare"');
  assert.ok(cardStart >= 0 && alertPos > cardStart && alertPos < buttonPos, "El aviso debe verse antes de pulsar Comparar");
  assert.ok(thresholdPos > cardStart && thresholdPos < buttonPos);
});

test("deb4RadarSettings lee de scenarioSettings.deb4Radar, sin estado propio aparte", () => {
  const block = appSource.slice(appSource.indexOf("function deb4RadarSettings("), appSource.indexOf("function deb4RadarSettings(") + 200);
  assert.match(block, /scenarioSettings\.deb4Radar/);
});

test("renderDeb4RefinancingRadar reutiliza evaluateMortgageRateScenarios/refinancingBreakEvenMonths (APX5), sin motor nuevo", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1200);
  assert.match(block, /window\.FinanceCanonicalMortgageRateScenarios/);
  assert.match(block, /evaluateMortgageRateScenarios\(/);
  assert.match(block, /refinancingBreakEvenMonths\(/);
});

test("el radar no avisa sin umbral declarado ni cuando el punto de equilibrio supera el umbral", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1200);
  assert.match(block, /!\(saved\.principal > 0\) \|\| !\(saved\.maxBreakEvenMonths > 0\)/);
  assert.match(block, /breakEven\.months > saved\.maxBreakEvenMonths/);
});

test("los seis campos de la hipoteca (incluido el umbral) se persisten al cambiar, y disparan un re-render del radar", () => {
  assert.match(
    appSource,
    /\["ajustesMortgagePrincipal", "ajustesMortgageMonths", "ajustesMortgageVariableRate", "ajustesMortgageFixedRate", "ajustesMortgageRefinancingCost", "deb4MaxBreakEvenMonths"\]\.forEach\(\(id\) => \{\s*qs\(id\)\?\.addEventListener\("change", saveDeb4RadarSettings\);/,
  );
  const saveBlock = appSource.slice(appSource.indexOf("function saveDeb4RadarSettings("), appSource.indexOf("function saveDeb4RadarSettings(") + 700);
  assert.match(saveBlock, /renderDeb4RefinancingRadar\(\);/);
});

test("el radar se sincroniza y renderiza en el arranque de la app", () => {
  assert.match(appSource, /syncDeb4RadarControls\(\);\s*renderDeb4RefinancingRadar\(\);/);
});
