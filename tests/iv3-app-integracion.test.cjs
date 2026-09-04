const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("IV3: la tarjeta de cartera tiene el formulario de aportación programada", () => {
  assert.match(indexSource, /id="iv1ScheduledContributionTarget"/);
  assert.match(indexSource, /id="iv1ScheduledContributionAmount"/);
  assert.match(indexSource, /id="iv1ScheduledContributionDate"/);
  assert.match(indexSource, /id="iv1ScheduledContributionNote"/);
  assert.match(indexSource, /id="iv1ScheduledContributionAdd"/);
});

test("IV3: saveIv1ScheduledContribution valida posición, importe y fecha antes de guardar", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1ScheduledContribution("), appSource.indexOf("function saveIv1ScheduledContribution(") + 1600);
  assert.match(block, /Selecciona a qué posición programas la aportación/);
  assert.match(block, /Indica un importe programado mayor que cero/);
  assert.match(block, /Indica la fecha prevista de la aportación/);
  assert.match(block, /nextScheduled/);
});

test("IV3: el botón de aportación programada está cableado a saveIv1ScheduledContribution", () => {
  assert.match(appSource, /qs\("iv1ScheduledContributionAdd"\)\?\.addEventListener\("click", saveIv1ScheduledContribution\);/);
});

test("IV3: renderIv1ScheduledContributionOptions existe y se llama junto al resto de renders de cartera", () => {
  assert.match(appSource, /function renderIv1ScheduledContributionOptions/);
  // IVX6 (Oleada 2 Bloque 3) añadió el campo goalId y su comentario antes de esta llamada — la
  // ventana crece de 1400 a 1700, la comprobación sigue siendo la misma.
  const saveBlock = appSource.slice(appSource.indexOf("function saveIv1Position("), appSource.indexOf("function saveIv1Position(") + 1700);
  assert.match(saveBlock, /renderIv1ScheduledContributionOptions\(\);/);
  const transferBlock = appSource.slice(appSource.indexOf("function saveIv1Transfer("), appSource.indexOf("function saveIv1Transfer(") + 1400);
  assert.match(transferBlock, /renderIv1ScheduledContributionOptions\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf("function removeIv1Position("), appSource.indexOf("function removeIv1Position(") + 400);
  assert.match(removeBlock, /renderIv1ScheduledContributionOptions\(\);/);
});

test("IV3: iv1ScheduledContributionsForCalendar aplana las aportaciones programadas de todas las posiciones", () => {
  const block = appSource.slice(appSource.indexOf("function iv1ScheduledContributionsForCalendar("), appSource.indexOf("function iv1ScheduledContributionsForCalendar(") + 700);
  assert.match(block, /normalizePositions\(rows\)\.positions\.flatMap/);
  assert.match(block, /scheduledContributions/);
});

test("IV3: goalPlanning() del puente P2 incluye investmentContributions para el calendario financiero", () => {
  const block = appSource.slice(appSource.indexOf("goalPlanning: () =>"), appSource.indexOf("goalPlanning: () =>") + 800);
  assert.match(block, /investmentContributions: iv1ScheduledContributionsForCalendar\(\)/);
});

test("IV3: la lista inicial de renders de cartera al cargar la app incluye renderIv1ScheduledContributionOptions", () => {
  const index = appSource.indexOf("renderIv1PositionList();\n  renderIv1TransferOptions();\n  renderIv1ContributionOptions();\n  renderIv1DisposalOptions();\n  renderIv1ScheduledContributionOptions();");
  assert.ok(index >= 0, "no se encontró el bloque de renders iniciales de cartera con renderIv1ScheduledContributionOptions");
});

test("canonical-e15-goals.js y canonical-portfolio.js están versionados en index.html", () => {
  assert.match(indexSource, /canonical-e15-goals\.js\?v=/);
  assert.match(indexSource, /canonical-portfolio\.js\?v=/);
});
