const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("IV2: la tarjeta de cartera tiene la fecha de adquisición y el formulario de aportación", () => {
  assert.match(indexSource, /id="iv1PositionAcquisitionDate"/);
  assert.match(indexSource, /id="iv1ContributionTarget"/);
  assert.match(indexSource, /id="iv1ContributionAmount"/);
  assert.match(indexSource, /id="iv1ContributionDate"/);
  assert.match(indexSource, /id="iv1ContributionAdd"/);
});

test("IV2: saveIv1Position lee la fecha de adquisición y registra la posición con contributions vacío", () => {
  // IVX6 (Oleada 2 Bloque 3) añadió el campo goalId y su comentario antes del literal — la
  // ventana crece de 1200 a 1500, la comprobación sigue siendo la misma.
  const block = appSource.slice(appSource.indexOf("function saveIv1Position("), appSource.indexOf("function saveIv1Position(") + 1500);
  assert.match(block, /qs\("iv1PositionAcquisitionDate"\)\?\.value/);
  // IVX6 (Oleada 2 Bloque 3) añadió goalId entre provenance y contributions — el objeto sigue
  // guardando contributions vacío, solo cambia lo que hay justo antes.
  assert.match(block, /acquisitionDate, provenance, goalId, contributions: \[\]/);
});

test("IV2: saveIv1Contribution valida posición, importe positivo y fecha antes de guardar", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1Contribution"), appSource.indexOf("function saveIv1Contribution") + 1400);
  assert.match(block, /Selecciona a qué posición añades la aportación/);
  assert.match(block, /Indica un importe aportado mayor que cero/);
  assert.match(block, /Indica la fecha de la aportación/);
  assert.match(block, /nextContributions/);
});

test("IV2: el botón de aportación está cableado a saveIv1Contribution", () => {
  assert.match(appSource, /qs\("iv1ContributionAdd"\)\?\.addEventListener\("click", saveIv1Contribution\);/);
});

test("IV2: renderIv1ContributionOptions existe y se llama junto al resto de renders de cartera al registrar/traspasar/quitar", () => {
  assert.match(appSource, /function renderIv1ContributionOptions/);
  // IVX6 (Oleada 2 Bloque 3) añadió el campo goalId y su comentario antes de esta llamada — la
  // ventana crece de 1400 a 1700, la comprobación sigue siendo la misma.
  const saveBlock = appSource.slice(appSource.indexOf("function saveIv1Position("), appSource.indexOf("function saveIv1Position(") + 1700);
  assert.match(saveBlock, /renderIv1ContributionOptions\(\);/);
  const transferBlock = appSource.slice(appSource.indexOf("function saveIv1Transfer"), appSource.indexOf("function saveIv1Transfer") + 1400);
  assert.match(transferBlock, /renderIv1ContributionOptions\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf("function removeIv1Position"), appSource.indexOf("function removeIv1Position") + 400);
  assert.match(removeBlock, /renderIv1ContributionOptions\(\);/);
});

test("IV2: renderIv1PositionList muestra la XIRR de cada posición junto al resto de cifras", () => {
  // IVX7 añadió la nota de coste medio de adquisición justo antes de esta línea — la ventana crece
  // de 1200 a 1600, la comprobación sigue siendo la misma.
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionList"), appSource.indexOf("function renderIv1PositionList") + 1600);
  assert.match(block, /iv2XirrLabel\(position\.xirr\)/);
});

test("IV2: renderIv1PositionSummary muestra la XIRR de la cartera y explica por qué TWR coincide con ella hoy", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionSummary"), appSource.indexOf("function renderIv1PositionSummary") + 2200);
  assert.match(block, /iv2XirrLabel\(xirr\)/);
  assert.match(block, /valoraciones intermedias que esta app no registra/);
});

test("IV2: iv2XirrLabel nunca inventa una tasa cuando no es calculable — dice el motivo", () => {
  const block = appSource.slice(appSource.indexOf("function iv2XirrLabel"), appSource.indexOf("function iv2XirrLabel") + 400);
  assert.match(block, /XIRR no calculable/);
  assert.match(block, /IV2_XIRR_REASON_LABELS/);
});

test("el motor canónico de cartera (con xirr) está versionado en index.html", () => {
  assert.match(indexSource, /canonical-portfolio\.js\?v=/);
});
