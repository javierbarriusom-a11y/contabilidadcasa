const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// GOB9 (Oleada 3, Bloque 3): panel único de resiliencia — "aguanto X meses" sin vender nada ni
// pedir prestado, justo debajo del runway patrimonial completo (LPX2) en Patrimonio e inversión.
// Combina liquidez real (misma fuente que DLX1/AP1), deuda (p2DebtRows) y el escenario de tensión
// de E13 (PROFILES) — sin motor nuevo aparte de resilienceMonths (canonical-cushion.js).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de resiliencia vive justo debajo del runway patrimonial completo (LPX2)", () => {
  const lpx2Pos = indexSource.indexOf('id="lpx2NetWorthRunway"');
  const gob9Pos = indexSource.indexOf('id="gob9ResiliencePanel"');
  assert.ok(lpx2Pos >= 0 && gob9Pos > lpx2Pos);
});

test("gob9MonthlyDebtService suma la cuota real de p2DebtRows, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function gob9MonthlyDebtService("), appSource.indexOf("function gob9MonthlyDebtService(") + 250);
  assert.match(block, /p2DebtRows\(\)/);
  assert.match(block, /row\.currentPayment/);
});

test("renderGob9ResiliencePanel compone liquidez real, el escenario de tensión de E13 y resilienceMonths, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function renderGob9ResiliencePanel("), appSource.indexOf("function renderGob9ResiliencePanel(") + 1200);
  assert.match(block, /window\.FinanceCanonicalCushion/);
  assert.match(block, /window\.FinanceCanonicalE13Scenarios/);
  assert.match(block, /PROFILES\?\.find\(\(profile\) => profile\.id === "stress"\)/);
  assert.match(block, /accountBalancesFromState\(\)\.total/);
  assert.match(block, /resilienceMonths\(/);
  assert.match(block, /gob9MonthlyDebtService\(\)/);
});

test("el panel de resiliencia se renderiza en el arranque de la app, justo después del runway patrimonial", () => {
  assert.match(appSource, /renderLpx2NetWorthRunway\(\);\s*\n\s*renderGob9ResiliencePanel\(\);/);
});
