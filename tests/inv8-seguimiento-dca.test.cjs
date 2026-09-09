const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-portfolio.js");

// INV8 (Oleada 3, Bloque 5): IVX7 ya muestra el coste medio de adquisición hacia atrás; esta tarea
// mira hacia delante — registra el plan de aportación periódica (DCA) y avisa de retraso
// acumulado, comparando lo aportado de verdad (contributions ya registradas por IV2/FC1) contra lo
// que el plan declarado esperaría a estas alturas.

function rawPosition(overrides = {}) {
  return {
    id: "1", label: "Fondo DCA", type: "fondo", currentValue: 1000, costBasis: 1000,
    acquisitionDate: "2026-01-01", contributions: [],
    ...overrides,
  };
}

test("normalizePosition · sin dcaMonthlyAmount/dcaStartDate, dcaPlan es null", () => {
  const [position] = P.normalizePositions([rawPosition()]).positions;
  assert.equal(position.dcaPlan, null);
});

test("normalizePosition · con los dos campos declarados, agrupa dcaPlan", () => {
  const [position] = P.normalizePositions([rawPosition({ dcaMonthlyAmount: 200, dcaStartDate: "2026-01-01" })]).positions;
  assert.deepEqual(position.dcaPlan, { monthlyAmount: 200, startDate: "2026-01-01" });
});

test("normalizePosition · con solo uno de los dos campos, dcaPlan sigue siendo null (no inventa el que falta)", () => {
  const [position] = P.normalizePositions([rawPosition({ dcaMonthlyAmount: 200 })]).positions;
  assert.equal(position.dcaPlan, null);
});

test("dcaPlanStatus · sin plan declarado, no es calculable", () => {
  const [position] = P.normalizePositions([rawPosition()]).positions;
  const status = P.dcaPlanStatus(position, "2026-06-01");
  assert.equal(status.calculable, false);
});

test("dcaPlanStatus · sin aportaciones desde el inicio del plan (más allá del coste inicial), detecta retraso", () => {
  const [position] = P.normalizePositions([rawPosition({
    costBasis: 200, acquisitionDate: "2026-01-01",
    dcaMonthlyAmount: 200, dcaStartDate: "2026-01-01",
  })]).positions;
  // 4 meses transcurridos (enero-abril) a 200€/mes = 800 previsto; solo 200 aportado (el coste inicial).
  const status = P.dcaPlanStatus(position, "2026-04-15");
  assert.equal(status.monthsElapsed, 4);
  assert.equal(status.plannedCumulative, 800);
  assert.equal(status.actualCumulative, 200);
  assert.equal(status.delay, 600);
  assert.equal(status.behindSchedule, true);
  assert.equal(status.delayMonths, 3);
});

test("dcaPlanStatus · con aportaciones que siguen el ritmo, no hay retraso", () => {
  const [position] = P.normalizePositions([rawPosition({
    costBasis: 200, acquisitionDate: "2026-01-01",
    contributions: [{ date: "2026-02-01", amount: 200 }, { date: "2026-03-01", amount: 200 }],
    dcaMonthlyAmount: 200, dcaStartDate: "2026-01-01",
  })]).positions;
  const status = P.dcaPlanStatus(position, "2026-03-15");
  assert.equal(status.plannedCumulative, 600);
  assert.equal(status.actualCumulative, 600);
  assert.equal(status.behindSchedule, false);
  assert.equal(status.delayMonths, 0);
});

test("dcaPlanStatus · una aportación inicial mayor deja el plan por delante (delay negativo, nunca falso 'retraso')", () => {
  const [position] = P.normalizePositions([rawPosition({
    costBasis: 5000, acquisitionDate: "2026-01-01",
    dcaMonthlyAmount: 200, dcaStartDate: "2026-01-01",
  })]).positions;
  const status = P.dcaPlanStatus(position, "2026-02-01");
  assert.ok(status.delay < 0);
  assert.equal(status.behindSchedule, false);
});

test("dcaPlanStatus está exportada", () => {
  assert.equal(typeof P.dcaPlanStatus, "function");
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: el registro de posición tiene los dos campos del plan DCA, antes del botón Añadir", () => {
  const monthlyPos = indexSource.indexOf('id="iv1PositionDcaMonthlyAmount"');
  const startPos = indexSource.indexOf('id="iv1PositionDcaStartDate"');
  const buttonPos = indexSource.indexOf('id="iv1PositionAdd"');
  assert.ok(monthlyPos >= 0 && startPos > monthlyPos && startPos < buttonPos);
});

test("wiring: saveIv1Position lee y guarda dcaMonthlyAmount/dcaStartDate en el registro", () => {
  const start = appSource.indexOf("function saveIv1Position(");
  const block = appSource.slice(start, start + 2500);
  assert.match(block, /qs\("iv1PositionDcaMonthlyAmount"\)\?\.value/);
  assert.match(block, /qs\("iv1PositionDcaStartDate"\)\?\.value/);
  assert.match(block, /dcaMonthlyAmount, dcaStartDate/);
});

test("wiring: renderInv8DcaTracking reutiliza normalizePositions/dcaPlanStatus, sin motor propio", () => {
  const start = appSource.indexOf("function renderInv8DcaTracking(");
  assert.ok(start >= 0, "No existe renderInv8DcaTracking");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /engine\.dcaPlanStatus\(position, today\)/);
  assert.match(block, /\.filter\(\(position\) => position\.dcaPlan\)/);
});

test("wiring: renderInv8DcaTracking se llama en renderAjustes junto a renderInv7LiquidityLadder", () => {
  assert.match(appSource, /renderInv7LiquidityLadder\(\);\s*\n\s*renderInv8DcaTracking\(\);/);
});
