const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("AP5: la tarjeta de cola única de prioridad tiene su selector y su lista", () => {
  ["ap5StrategySelect", "ap5QueueList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de AP5`);
  });
  assert.match(indexSource, /Deuda: cola única de prioridad \(nueva y existente\)/);
});

test("AP5: solo entra en la cola la deuda de apalancamiento marcada como tomada (takenAt)", () => {
  const block = appSource.slice(appSource.indexOf("function ap5UnifiedDebtQueue("), appSource.indexOf("function ap5UnifiedDebtQueue(") + 900);
  assert.match(block, /ap3LeverageScenarios\(\)\s*\n\s*\.filter\(\(scenario\) => scenario\.takenAt\)/);
});

test("AP5: reutiliza escenarioMotorDebtOptions (misma fuente que la Ruta de deuda, A16-5), sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function ap5UnifiedDebtQueue("), appSource.indexOf("function ap5UnifiedDebtQueue(") + 900);
  assert.match(block, /escenarioMotorDebtOptions\(\)/);
});

test("AP5: avalancha y bola de nieve son los únicos dos criterios, mismos que A16-5", () => {
  const block = appSource.slice(appSource.indexOf("function ap5UnifiedDebtQueue("), appSource.indexOf("function ap5UnifiedDebtQueue(") + 900);
  assert.match(block, /if \(strategyId === "bola-nieve"\) return combined\.sort\(\(a, b\) => a\.principal - b\.principal\);/);
  assert.match(block, /return combined\.sort\(\(a, b\) => b\.apr - a\.apr\);/);
});

test("AP5: renderAp5Queue nunca inventa una cola cuando no hay nada que priorizar", () => {
  const block = appSource.slice(appSource.indexOf("function renderAp5Queue("), appSource.indexOf("function renderAp5Queue(") + 700);
  assert.match(block, /Sin deuda existente ni deuda de apalancamiento tomada que priorizar/);
});

test("AP5: el selector está cableado y la cola se refresca al marcar o desmarcar una deuda tomada", () => {
  assert.match(appSource, /qs\("ap5StrategySelect"\)\?\.addEventListener\("change", renderAp5Queue\);/);
  const toggleBlock = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 400);
  assert.match(toggleBlock, /renderAp5Queue\(\);/);
});

test("AP5: la cola se renderiza en el arranque de la app, justo después de la lista de deudas de AP1", () => {
  assert.match(appSource, /renderAp1DebtOptions\(\);\s*\n\s*renderAp5Queue\(\);/);
});
