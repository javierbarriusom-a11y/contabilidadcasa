const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("GOB8: la tarjeta del borrador tiene los botones de generar/descargar y la vista previa, tras las 3 calculadoras fiscales", () => {
  assert.match(indexSource, /id="gob8GenerateDraft"/);
  assert.match(indexSource, /id="gob8DownloadDraft"/);
  assert.match(indexSource, /id="gob8DraftPreview"/);
  const irpfIdx = indexSource.indexOf('id="irpfEstimatorNote"');
  const dividendIdx = indexSource.indexOf('id="ajustesDividendTaxNote"');
  const fcx1Idx = indexSource.indexOf('id="fcx1WithdrawalNote"');
  const draftIdx = indexSource.indexOf('id="gob8GenerateDraft"');
  assert.ok(draftIdx > irpfIdx && draftIdx > dividendIdx && draftIdx > fcx1Idx, "el borrador debe estar después de las tres calculadoras que compone");
});

test("GOB8: gob8IrpfLine reutiliza el mismo motor y los mismos campos que handleAjustesEstimateIrpf, nunca inventa una cifra propia", () => {
  const block = appSource.slice(appSource.indexOf("function gob8IrpfLine("), appSource.indexOf("function gob8IrpfLine(") + 700);
  assert.match(block, /window\.FinanceCanonicalIrpfEstimator/);
  assert.match(block, /qs\("irpfBaseLow"\)\?\.value/);
  assert.match(block, /qs\("irpfWithholdingsPaid"\)\?\.value/);
  assert.match(block, /engine\.estimateIrpfResult\(/);
  assert.match(block, /return irpfResultLabel\(result\);/);
});

test("GOB8: gob8DividendLine dice explícitamente cuándo la sección no tiene datos, en vez de omitirse en silencio", () => {
  const block = appSource.slice(appSource.indexOf("function gob8DividendLine("), appSource.indexOf("function gob8DividendLine(") + 700);
  assert.match(block, /window\.FinanceCanonicalDividendTax/);
  assert.match(block, /sección sin datos/);
  assert.match(block, /calculateDividendTax\(/);
});

test("GOB8: gob8Fcx1Line reutiliza el mismo motor y el mismo fallback de tipo marginal declarado que FCX1", () => {
  const block = appSource.slice(appSource.indexOf("function gob8Fcx1Line("), appSource.indexOf("function gob8Fcx1Line(") + 1100);
  assert.match(block, /marginalTaxOnAdditionalIncome\(/);
  assert.match(block, /flat-marginal-rate/);
  assert.match(block, /fiscalWithholdingRate\(\)/);
  assert.match(block, /sección sin datos/);
});

test("GOB8: gob8DraftText incluye el aviso de que nunca sustituye a la gestoría y las 3 secciones numeradas", () => {
  const block = appSource.slice(appSource.indexOf("function gob8DraftText("), appSource.indexOf("function gob8DraftText(") + 1200);
  assert.match(block, /nunca un sustituto de la gestoría/);
  assert.match(block, /gob8IrpfLine\(\)/);
  assert.match(block, /gob8DividendLine\(\)/);
  assert.match(block, /gob8Fcx1Line\(\)/);
  assert.match(block, /1\) Estimación de resultado de IRPF/);
  assert.match(block, /2\) Retención de dividendos extranjeros/);
  assert.match(block, /3\) Rescate de pensiones/);
});

test("GOB8: renderGob8DraftPreview escribe el borrador como texto plano (no HTML) en la vista previa", () => {
  const block = appSource.slice(appSource.indexOf("function renderGob8DraftPreview("), appSource.indexOf("function renderGob8DraftPreview(") + 250);
  assert.match(block, /box\.textContent = gob8DraftText\(\);/);
});

test("GOB8: handleGob8DownloadDraft genera un .txt descargable con el mismo mecanismo Blob/URL que el resto de exportaciones de la app", () => {
  const block = appSource.slice(appSource.indexOf("function handleGob8DownloadDraft("), appSource.indexOf("function handleGob8DownloadDraft(") + 700);
  assert.match(block, /new Blob\(\[content\], \{ type: "text\/plain;charset=utf-8" \}\);/);
  assert.match(block, /URL\.createObjectURL\(blob\);/);
  assert.match(block, /link\.download = `borrador-renta-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.txt`;/);
  assert.match(block, /URL\.revokeObjectURL\(url\);/);
});

test("GOB8: los dos botones están cableados a sus manejadores", () => {
  assert.match(appSource, /qs\("gob8GenerateDraft"\)\?\.addEventListener\("click", renderGob8DraftPreview\);/);
  assert.match(appSource, /qs\("gob8DownloadDraft"\)\?\.addEventListener\("click", handleGob8DownloadDraft\);/);
});
