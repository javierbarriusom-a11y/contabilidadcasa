const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("LEV8: la tarjeta AP3 tiene los 3 campos de la tesis de apalancamiento", () => {
  assert.match(indexSource, /id="lev8ThesisExpectedGain"/);
  assert.match(indexSource, /id="lev8ThesisHorizonMonths"/);
  assert.match(indexSource, /id="lev8ThesisInvalidation"/);
  const scenarioSaveIdx = indexSource.indexOf('id="ap3ScenarioSave"');
  const listIdx = indexSource.indexOf('id="ap3ScenarioList"');
  const thesisIdx = indexSource.indexOf('id="lev8ThesisExpectedGain"');
  assert.ok(scenarioSaveIdx >= 0 && listIdx >= 0 && thesisIdx >= 0);
  assert.ok(
    thesisIdx > scenarioSaveIdx && thesisIdx < listIdx,
    "los campos de la tesis deben estar entre el botón de guardar escenario y la lista de escenarios"
  );
});

test("LEV8: lev8ThesisHtml no renderiza nada sin tesis y compone la nota con los 3 datos cuando existen", () => {
  const block = appSource.slice(appSource.indexOf("function lev8ThesisHtml("), appSource.indexOf("function lev8ThesisHtml(") + 700);
  assert.match(block, /if \(!thesis\) return "";/);
  assert.match(block, /espera: \$\{escapeHtml\(thesis\.expectedGain\)\}/);
  assert.match(block, /horizonte: \$\{thesis\.horizonMonths\} meses/);
  assert.match(block, /se invalida si: \$\{escapeHtml\(thesis\.invalidation\)\}/);
});

test("LEV8: renderAp3ScenarioList imprime la tesis de cada fila con lev8ThesisHtml", () => {
  const block = appSource.slice(appSource.indexOf("function renderAp3ScenarioList("), appSource.indexOf("function renderAp3ScenarioList(") + 900);
  assert.match(block, /lev8ThesisHtml\(row\.thesis\)/);
});

test("LEV8: toggleAp3ScenarioTaken solo captura la tesis al marcar como tomada, nunca al desmarcar", () => {
  const block = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 1100);
  assert.match(block, /const marking = !ap3LeverageScenarios\(\)\.find/);
  assert.match(block, /const thesis = marking\s*\n?\s*\?/);
  assert.match(block, /thesis: marking \? thesis : row\.thesis/);
});

test("LEV8: al marcar como tomada se limpian los 3 campos del formulario de la tesis", () => {
  const block = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 1100);
  assert.match(block, /qs\("lev8ThesisExpectedGain"\)\.value = "";/);
  assert.match(block, /qs\("lev8ThesisHorizonMonths"\)\.value = "";/);
  assert.match(block, /qs\("lev8ThesisInvalidation"\)\.value = "";/);
});

test("LEV8: una tesis ya registrada sobrevive a un futuro desmarcado (row.thesis se preserva)", () => {
  // Simula el mismo mapeo que hace toggleAp3ScenarioTaken sobre una fila con una tesis ya guardada.
  const row = { id: "s1", takenAt: "2026-01-01T00:00:00.000Z", thesis: { expectedGain: "8%", horizonMonths: 12, invalidation: "cae el sector" } };
  const marking = !row.takenAt; // false: ya estaba tomada, esta llamada la desmarca
  const updated = { ...row, takenAt: row.takenAt ? null : new Date().toISOString(), thesis: marking ? null : row.thesis };
  assert.equal(updated.takenAt, null);
  assert.deepEqual(updated.thesis, row.thesis, "la tesis no debe perderse al desmarcar como tomada");
});

test("LEV8: toggleAp3ScenarioTaken sigue refrescando el resto de la cascada de renders", () => {
  const block = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 1100);
  assert.match(block, /renderAp3ScenarioList\(\);/);
  assert.match(block, /renderAp6Alert\(\);/);
  assert.match(block, /renderLev1PolicyStatus\(\);/);
  assert.match(block, /renderAp5Queue\(\);/);
});
