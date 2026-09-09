const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("GOB10: la tarjeta de Ajustes › Hogar tiene los 5 campos, el botón de guardar y la lista", () => {
  assert.match(indexSource, /id="gob10Description"/);
  assert.match(indexSource, /id="gob10ExpectedGain"/);
  assert.match(indexSource, /id="gob10HorizonMonths"/);
  assert.match(indexSource, /id="gob10Invalidation"/);
  assert.match(indexSource, /id="gob10ReviewMonths"/);
  assert.match(indexSource, /<option value="6">6 meses<\/option>/);
  assert.match(indexSource, /<option value="12">12 meses<\/option>/);
  assert.match(indexSource, /id="gob10SaveDecision"/);
  assert.match(indexSource, /id="gob10DecisionList"/);
  const hogarIdx = indexSource.indexOf('id="ajustes-hogar"');
  const reservaIdx = indexSource.indexOf('id="ajustes-reserva"');
  const cardIdx = indexSource.indexOf('id="gob10Description"');
  assert.ok(cardIdx > hogarIdx && cardIdx < reservaIdx, "la tarjeta GOB10 debe vivir dentro del grupo Hogar");
});

test("GOB10: gob10ReviewDueAt solo acepta 6 o 12 meses, nunca un valor arbitrario", () => {
  const block = appSource.slice(appSource.indexOf("function gob10ReviewDueAt("), appSource.indexOf("function gob10ReviewDueAt(") + 300);
  assert.match(block, /const months = reviewMonths === 12 \? 12 : 6;/);
});

test("GOB10: saveGob10Decision guarda la misma forma de tesis que LEV8 (expectedGain/horizonMonths/invalidation) más la revisión programada", () => {
  const block = appSource.slice(appSource.indexOf("function saveGob10Decision("), appSource.indexOf("function saveGob10Decision(") + 900);
  assert.match(block, /expectedGain: String\(expectedGain \|\| ""\)\.trim\(\),/);
  assert.match(block, /horizonMonths: Number\.isFinite\(horizonMonths\) && horizonMonths > 0 \? horizonMonths : null,/);
  assert.match(block, /invalidation: String\(invalidation \|\| ""\)\.trim\(\),/);
  assert.match(block, /reviewDueAt: gob10ReviewDueAt\(reviewMonths, now\),/);
  assert.match(block, /reviewedAt: null,/);
});

test("GOB10: toggleGob10DecisionReviewed alterna reviewedAt sin recalcular la fecha programada", () => {
  const block = appSource.slice(appSource.indexOf("function toggleGob10DecisionReviewed("), appSource.indexOf("function toggleGob10DecisionReviewed(") + 400);
  assert.match(block, /reviewedAt: row\.reviewedAt \? null : new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(block, /reviewDueAt/);
});

test("GOB10: gob10OverdueReviewsCount solo cuenta las que no están revisadas y cuya fecha ya pasó", () => {
  const block = appSource.slice(appSource.indexOf("function gob10OverdueReviewsCount("), appSource.indexOf("function gob10OverdueReviewsCount(") + 300);
  assert.match(block, /!row\.reviewedAt && new Date\(row\.reviewDueAt\)\.getTime\(\) <= now\.getTime\(\)/);
});

test("GOB10: gob10DecisionItemHtml reutiliza lev8ThesisHtml (misma tesis, generalizada) y marca visualmente lo vencido", () => {
  const block = appSource.slice(appSource.indexOf("function gob10DecisionItemHtml("), appSource.indexOf("function gob10DecisionItemHtml(") + 700);
  assert.match(block, /lev8ThesisHtml\(row\.thesis\)/);
  assert.match(block, /overdue \? " negative" : ""/);
  assert.match(block, /data-gob10-review-toggle=/);
  assert.match(block, /data-gob10-remove=/);
});

test("GOB10: handleGob10SaveDecision exige una descripción no vacía antes de guardar", () => {
  const block = appSource.slice(appSource.indexOf("function handleGob10SaveDecision("), appSource.indexOf("function handleGob10SaveDecision(") + 500);
  assert.match(block, /if \(!description\.trim\(\)\) \{/);
  assert.match(block, /announceStatus\("Describe brevemente la decisión antes de guardarla\."\);/);
});

test("GOB10: el listener delegado distingue el toggle de revisada del botón de quitar", () => {
  const block = appSource.slice(appSource.indexOf('qs("gob10DecisionList")?.addEventListener'), appSource.indexOf('qs("gob10DecisionList")?.addEventListener') + 600);
  assert.match(block, /toggleGob10DecisionReviewed\(toggleButton\.dataset\.gob10ReviewToggle\)/);
  assert.match(block, /removeGob10Decision\(removeButton\.dataset\.gob10Remove\)/);
});

test("GOB10: el botón de guardar está cableado", () => {
  assert.match(appSource, /qs\("gob10SaveDecision"\)\?\.addEventListener\("click", handleGob10SaveDecision\);/);
});

test("GOB10: renderAjustes refresca la lista de decisiones en cada render de la pantalla", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustes("), appSource.indexOf("function renderAjustes(") + 700);
  assert.match(block, /renderGob10DecisionList\(\);/);
});

test("GOB10: se integra en el marco genérico de alertas con las 3 adiciones habituales (métrica, snapshot, regla)", () => {
  assert.match(appSource, /overdueDecisionReviewsCount: \{ label: "Revisiones de decisiones vencidas", format: \(value\) => `\$\{Number\(value \|\| 0\)\} pendiente\(s\)` \},/);
  assert.match(appSource, /overdueDecisionReviewsCount: gob10OverdueReviewsCount\(\),/);
  assert.match(appSource, /id: "alert-decision-review-overdue",/);
  const alertBlock = appSource.slice(appSource.indexOf('id: "alert-decision-review-overdue",'), appSource.indexOf('id: "alert-decision-review-overdue",') + 400);
  assert.match(alertBlock, /metric: "overdueDecisionReviewsCount",/);
  assert.match(alertBlock, /threshold: 0,/);
});

test("GOB10: nunca calcula un coste de esperar (eso es exclusivo de DEB3) — ningún campo con 'waitingCost' o similar en el registro de decisiones", () => {
  const block = appSource.slice(appSource.indexOf("function saveGob10Decision("), appSource.indexOf("function saveGob10Decision(") + 900);
  assert.doesNotMatch(block, /waitingCost/i);
  assert.doesNotMatch(block, /debtAnnualRatePct/i);
});
