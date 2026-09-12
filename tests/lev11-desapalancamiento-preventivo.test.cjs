const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV11 (Oleada 4, Bloque 5; alcance reducido): deleveragingPriority() (LEV6, Oleada 3) ya resuelve
// QUÉ vender primero al desapalancar; faltaba la regla de CUÁNDO y CUÁNTO activar esa priorización
// de forma preventiva, antes de un margin call real — preventiveDeleveragingAllocation solo reparte
// un importe a cubrir entre filas ya priorizadas por LEV6, de la #1 en adelante, hasta cubrirlo.

test("preventiveDeleveragingAllocation · sin importe a cubrir, no calculable", () => {
  const result = LeverageSimulator.preventiveDeleveragingAllocation({ amountToCover: 0, priorityRows: [{ id: "a", currentValue: 1000 }] });
  assert.equal(result.calculable, false);
});

test("preventiveDeleveragingAllocation · sin filas priorizadas, no calculable", () => {
  const result = LeverageSimulator.preventiveDeleveragingAllocation({ amountToCover: 500, priorityRows: [] });
  assert.equal(result.calculable, false);
});

test("preventiveDeleveragingAllocation · una sola fila cubre el importe entero: no hace falta vender más", () => {
  const rows = [
    { id: "a", label: "Fondo A", priorityRank: 1, currentValue: 5000 },
    { id: "b", label: "Fondo B", priorityRank: 2, currentValue: 5000 },
  ];
  const result = LeverageSimulator.preventiveDeleveragingAllocation({ amountToCover: 3000, priorityRows: rows });
  assert.equal(result.calculable, true);
  assert.equal(result.allocation.length, 1);
  assert.equal(result.allocation[0].id, "a");
  assert.equal(result.allocation[0].amount, 3000);
  assert.equal(result.covered, 3000);
  assert.equal(result.shortfall, 0);
});

test("preventiveDeleveragingAllocation · reparte entre varias filas por orden de prioridad hasta cubrir el importe", () => {
  const rows = [
    { id: "a", label: "Fondo A", priorityRank: 1, currentValue: 2000 },
    { id: "b", label: "Fondo B", priorityRank: 2, currentValue: 2000 },
    { id: "c", label: "Fondo C", priorityRank: 3, currentValue: 2000 },
  ];
  const result = LeverageSimulator.preventiveDeleveragingAllocation({ amountToCover: 3000, priorityRows: rows });
  assert.equal(result.allocation.length, 2);
  assert.deepEqual(result.allocation.map((row) => row.id), ["a", "b"]);
  assert.equal(result.allocation[0].amount, 2000);
  assert.equal(result.allocation[1].amount, 1000);
  assert.equal(result.covered, 3000);
  assert.equal(result.shortfall, 0);
});

test("preventiveDeleveragingAllocation · ni vendiendo toda la cartera priorizable se cubre el importe: dice el hueco, nunca inventa más filas", () => {
  const rows = [{ id: "a", label: "Fondo A", priorityRank: 1, currentValue: 1000 }];
  const result = LeverageSimulator.preventiveDeleveragingAllocation({ amountToCover: 5000, priorityRows: rows });
  assert.equal(result.covered, 1000);
  assert.equal(result.shortfall, 4000);
});

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

test("wiring: renderLev11PreventiveDeleveragingAlert reutiliza weightedPortfolioStressDropPct (LEV5) y deleveragingPriority (LEV6), sin motor propio de venta", () => {
  const start = appSource.indexOf("function renderLev11PreventiveDeleveragingAlert(");
  assert.ok(start >= 0);
  const block = appSource.slice(start, start + 2400);
  assert.match(block, /engine\.weightedPortfolioStressDropPct\(/);
  assert.match(block, /portfolioEngine\.deleveragingPriority\(/);
  assert.match(block, /engine\.preventiveDeleveragingAllocation\(/);
});

test("wiring: la pantalla Deuda › Apalancamiento renderiza la alerta de desapalancamiento preventivo al abrirse", () => {
  const start = deudaSource.indexOf("function renderDeudaApalancamiento(");
  const block = deudaSource.slice(start, deudaSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /renderLev11PreventiveDeleveragingAlert\(\);/);
});
