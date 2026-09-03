const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("FC3: la tarjeta de compensación de pérdidas y ganancias tiene todos sus campos", () => {
  ["fc3Year", "fc3CompareRun", "fc3CompareNote", "fc3PriorLossAmount", "fc3PriorLossYear", "fc3PriorLossSave", "fc3PriorLossList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de FC3`);
  });
  const cardStart = indexSource.indexOf("Compensación de pérdidas y ganancias a cierre de año");
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta FC3");
});

test("FC3: handleFc3Compare delega en FinanceCanonicalPortfolio.yearEndCompensation, con las posiciones normalizadas de IV1", () => {
  const block = appSource.slice(appSource.indexOf("function handleFc3Compare("), appSource.indexOf("function handleFc3Compare(") + 500);
  assert.match(block, /engine\.normalizePositions\(iv1PositionsList\(\)\)\.positions/);
  assert.match(block, /engine\.yearEndCompensation\(\{ positions, year, priorLosses: fc3PriorLossesList\(\) \}\)/);
});

test("FC3: saveFc3PriorLoss exige importe mayor que cero y un año de 4 dígitos", () => {
  const block = appSource.slice(appSource.indexOf("function saveFc3PriorLoss("), appSource.indexOf("function saveFc3PriorLoss(") + 700);
  assert.match(block, /!\(amount > 0\) \|\| !\/\^\\d\{4\}\$\/\.test\(year\)/);
});

test("FC3: fc3ResultHtml nunca inventa un resultado cuando falta el año o hay una venta incompleta", () => {
  const block = appSource.slice(appSource.indexOf("function fc3ResultHtml("), appSource.indexOf("function fc3ResultHtml(") + 500);
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /incomplete-disposal/);
});

test("FC3: fc3ResultHtml deja claro que solo neta transmisiones, no sustituye asesoría", () => {
  const block = appSource.slice(appSource.indexOf("function fc3ResultHtml("), appSource.indexOf("function fc3ResultHtml(") + 2000);
  assert.match(block, /no incluye el cruce con rendimientos del capital mobiliario/);
  assert.match(block, /Verifica con un profesional/);
});

test("FC3: los controles y el listado están cableados", () => {
  assert.match(appSource, /qs\("fc3CompareRun"\)\?\.addEventListener\("click", handleFc3Compare\);/);
  assert.match(appSource, /qs\("fc3PriorLossSave"\)\?\.addEventListener\("click", saveFc3PriorLoss\);/);
  assert.match(appSource, /qs\("fc3PriorLossList"\)\?\.addEventListener\("click"/);
  assert.match(appSource, /removeFc3PriorLoss\(removeButton\.dataset\.fc3LossRemove\)/);
});

test("FC3: la lista de pérdidas arrastradas se renderiza en el arranque de la app", () => {
  assert.match(appSource, /renderIv1PositionSummary\(\);\s*\n\s*renderFc3PriorLossList\(\);/);
});
