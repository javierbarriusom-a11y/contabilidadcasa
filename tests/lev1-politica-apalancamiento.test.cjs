const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { evaluateLeveragePolicy } = require("../canonical-leverage-barrier.js");

// LEV1 (Oleada 3, Bloque 2) · política de apalancamiento del hogar: un límite máximo de
// deuda-para-invertir, declarado de antemano como % de patrimonio neto o de ingreso anual, que el
// resto del bloque (AP3/AP6 hoy) consulta antes de dejar que la deuda tomada supere ese techo sin
// que el hogar lo vea. Motor puro, mismo patrón que evaluateLeverageBarrier (AP4).

test("sin límite declarado, no es calculable", () => {
  const result = evaluateLeveragePolicy({ limitPct: 0, basis: "net-worth", referenceValue: 200000 });
  assert.equal(result.calculable, false);
});

test("sin valor de referencia (patrimonio neto o ingreso), no es calculable", () => {
  const result = evaluateLeveragePolicy({ limitPct: 20, basis: "net-worth", referenceValue: 0 });
  assert.equal(result.calculable, false);
});

test("con límite y referencia declarados, calcula el importe máximo permitido", () => {
  const result = evaluateLeveragePolicy({ limitPct: 20, basis: "net-worth", referenceValue: 200000 });
  assert.equal(result.calculable, true);
  assert.equal(result.limitAmount, 40000);
});

test("dentro del límite: deuda ya tomada por debajo del importe máximo", () => {
  const result = evaluateLeveragePolicy({
    limitPct: 20, basis: "net-worth", referenceValue: 200000, currentLeverageDebt: 30000,
  });
  assert.equal(result.withinLimit, true);
  assert.equal(result.excessAmount, 0);
  assert.equal(result.usedPct, 75);
});

test("justo en el límite: todavía dentro (comparación no estricta)", () => {
  const result = evaluateLeveragePolicy({
    limitPct: 20, basis: "net-worth", referenceValue: 200000, currentLeverageDebt: 40000,
  });
  assert.equal(result.withinLimit, true);
  assert.equal(result.usedPct, 100);
});

test("por encima del límite: reporta el exceso exacto", () => {
  const result = evaluateLeveragePolicy({
    limitPct: 20, basis: "net-worth", referenceValue: 200000, currentLeverageDebt: 50000,
  });
  assert.equal(result.withinLimit, false);
  assert.equal(result.excessAmount, 10000);
});

test("suma la deuda ya tomada con la propuesta en exploración (vista previa de AP3)", () => {
  const result = evaluateLeveragePolicy({
    limitPct: 20, basis: "net-worth", referenceValue: 200000, currentLeverageDebt: 30000, proposedAdditionalDebt: 15000,
  });
  assert.equal(result.totalDebt, 45000);
  assert.equal(result.withinLimit, false);
  assert.equal(result.excessAmount, 5000);
});

test("base 'ingreso anual' se acepta igual que 'patrimonio neto' — el motor no impone la base", () => {
  const result = evaluateLeveragePolicy({ limitPct: 150, basis: "income", referenceValue: 48000 });
  assert.equal(result.calculable, true);
  assert.equal(result.basis, "income");
  assert.equal(result.limitAmount, 72000);
});

test("nunca bloquea nada por sí solo: solo informa, incluso muy por encima del límite", () => {
  const result = evaluateLeveragePolicy({
    limitPct: 10, basis: "net-worth", referenceValue: 100000, currentLeverageDebt: 90000,
  });
  assert.equal(result.withinLimit, false);
  assert.equal(typeof result.excessAmount, "number");
});

// --- Integración estática: engine cargado en index.html, tarjeta de Ajustes y wiring en app.js ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de política de apalancamiento vive en Deuda › Apalancamiento (OPT-24: ya no es una sub-pestaña de Ajustes)", () => {
  ["lev1Basis", "lev1LimitPct", "lev1PolicyStatus"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de LEV1`);
  });
  const groupStart = indexSource.indexOf('id="deuda-apalancamiento"');
  const cardStart = indexSource.indexOf("Política de apalancamiento del hogar");
  const ap3Start = indexSource.indexOf("Simulador de apalancamiento (explorar, no ejecutar)");
  assert.ok(groupStart >= 0 && cardStart > groupStart, "La tarjeta LEV1 debe vivir dentro de la pantalla Deuda · Apalancamiento");
  assert.ok(cardStart < ap3Start, "LEV1 debe declararse antes del simulador AP3 que la consulta");
});

test("handleLev1PolicyChange persiste límite y base, y refresca el estado", () => {
  const block = appSource.slice(appSource.indexOf("function handleLev1PolicyChange("), appSource.indexOf("function handleLev1PolicyChange(") + 500);
  assert.match(block, /state\.leveragePolicyLimitPct = /);
  assert.match(block, /state\.leveragePolicyBasis = /);
  assert.match(block, /saveScenarioSettings\(\)/);
  assert.match(block, /renderLev1PolicyStatus\(\)/);
});

test("saveScenarioSettings persiste leveragePolicyLimitPct y leveragePolicyBasis", () => {
  const block = appSource.slice(appSource.indexOf("function saveScenarioSettings("), appSource.indexOf("function saveScenarioSettings(") + 3000);
  assert.match(block, /leveragePolicyLimitPct: round2\(Math\.max\(0, Number\(state\.leveragePolicyLimitPct \|\| 0\)\)\)/);
  assert.match(block, /leveragePolicyBasis: state\.leveragePolicyBasis === "income" \? "income" : "net-worth"/);
});

test("lev1CurrentLeverageDebt reutiliza takenScenariosOf de AP6, sin recontar por su cuenta", () => {
  const block = appSource.slice(appSource.indexOf("function lev1CurrentLeverageDebt("), appSource.indexOf("function lev1CurrentLeverageDebt(") + 400);
  assert.match(block, /FinanceCanonicalLeverageSustainability/);
  assert.match(block, /takenScenariosOf\(ap3LeverageScenarios\(\)\)/);
});

test("lev1ReferenceValue reutiliza lpNetWorthSnapshot (LPX1/LPX2) para la base de patrimonio neto", () => {
  const block = appSource.slice(appSource.indexOf("function lev1ReferenceValue("), appSource.indexOf("function lev1ReferenceValue(") + 500);
  assert.match(block, /lpNetWorthSnapshot\(\)/);
});

test("ap3ResultHtml incluye la vista previa del impacto sobre la política LEV1", () => {
  const block = appSource.slice(appSource.indexOf("function ap3ResultHtml("), appSource.indexOf("function ap3ResultHtml(") + 1400);
  assert.match(block, /lev1PolicyPreviewHtml\(result\.newDebtAmount\)/);
});

test("guardar, quitar o marcar/desmarcar un escenario de AP3 refresca el estado de LEV1", () => {
  // LEV8 (Oleada 3, Bloque 5) alargó la función con la captura de la tesis de apalancamiento
  // antes de las llamadas a render — la ventana crece a 1100.
  const toggle = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 1100);
  const save = appSource.slice(appSource.indexOf("function saveAp3Scenario("), appSource.indexOf("function saveAp3Scenario(") + 700);
  const remove = appSource.slice(appSource.indexOf("function removeAp3Scenario("), appSource.indexOf("function removeAp3Scenario(") + 400);
  [toggle, save, remove].forEach((block) => assert.match(block, /renderLev1PolicyStatus\(\)/));
});

test("LEV1 nunca bloquea la exploración de AP3 — solo informa (mismo criterio que el resto de guardarraíles)", () => {
  const block = appSource.slice(appSource.indexOf("function lev1ResultHtml("), appSource.indexOf("function lev1ResultHtml(") + 1200);
  assert.match(block, /no bloquea nada por sí solo/);
});
