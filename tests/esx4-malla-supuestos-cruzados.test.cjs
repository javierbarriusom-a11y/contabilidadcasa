const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));

// ESX4 (Oleada 2 Bloque 3): malla de dos supuestos cruzados. sensitivity() (A8-6) ya varía
// ingresos/gastos/eventos uno a la vez; sensitivityGrid() varía ingresos Y gastos a la vez sobre
// una cuadrícula simétrica alrededor del caso base (A8-1), reutilizando simulate() tal cual — sin
// motor nuevo ni ningún dato de mercado inventado.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function buildForecast(months) {
  return {
    schemaId: "finance-canonical-forecast/v1",
    valid: true,
    fingerprint: "test",
    assumptions: { items: [{ id: "openingChecking", value: 1000 }, { id: "openingSavings", value: 0 }] },
    series: months.map((month, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: month.income, outflowsBeforeSaving: month.outflow, saving: 0 },
    })),
  };
}

test("sensitivityGrid · una fila y columna por cada paso de GRID_STEPS, simétrica alrededor del caso base", () => {
  const forecast = buildForecast([{ income: 2000, outflow: 1500 }, { income: 2000, outflow: 1500 }]);
  const grid = E13.sensitivityGrid(forecast, [], { step: 0.1 });
  assert.equal(grid.rows.length, 5);
  grid.rows.forEach((row) => assert.equal(row.cells.length, 5));
  const centerRow = grid.rows[2];
  assert.equal(centerRow.incomeDeltaPct, 0);
  assert.equal(centerRow.cells[2].expenseDeltaPct, 0);
  assert.equal(centerRow.cells[2].minChecking, grid.baselineMinChecking);
});

test("sensitivityGrid · más ingresos y menos gastos a la vez mejora la caja mínima frente al caso base", () => {
  const forecast = buildForecast([{ income: 2000, outflow: 1900 }, { income: 2000, outflow: 1900 }]);
  const grid = E13.sensitivityGrid(forecast, [], { step: 0.1 });
  const bestCell = grid.rows[4].cells[0];
  assert.equal(grid.rows[4].incomeDeltaPct, 20);
  assert.equal(bestCell.expenseDeltaPct, -20);
  assert.ok(bestCell.minChecking > grid.baselineMinChecking, "más ingresos + menos gastos debería mejorar la caja mínima");
  assert.ok(bestCell.impact > 0);
});

test("sensitivityGrid · más gastos y menos ingresos a la vez empeora la caja mínima frente al caso base", () => {
  const forecast = buildForecast([{ income: 2000, outflow: 1900 }, { income: 2000, outflow: 1900 }]);
  const grid = E13.sensitivityGrid(forecast, [], { step: 0.1 });
  const worstCell = grid.rows[0].cells[4];
  assert.ok(worstCell.minChecking < grid.baselineMinChecking, "menos ingresos + más gastos debería empeorar la caja mínima");
  assert.ok(worstCell.impact < 0);
});

test("esx4SensitivityGridHtml · pinta una tabla con una fila de cabecera de gastos y una columna de ingresos por fila", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx4SensitivityGridHtml"), context);
  const html = context.esx4SensitivityGridHtml({
    baselineMinChecking: 500,
    rows: [
      { incomeDeltaPct: -5, cells: [{ expenseDeltaPct: -5, minChecking: 700, impact: 200 }, { expenseDeltaPct: 5, minChecking: 300, impact: -200 }] },
      { incomeDeltaPct: 5, cells: [{ expenseDeltaPct: -5, minChecking: 900, impact: 400 }, { expenseDeltaPct: 5, minChecking: 500, impact: 0 }] },
    ],
  });
  assert.match(html, /Ingresos -5%/);
  assert.match(html, /Ingresos \+5%/);
  assert.match(html, /Gastos -5%/);
  assert.match(html, /Gastos \+5%/);
  assert.equal((html.match(/<tr>/g) || []).length, 3);
});

test("esx4SensitivityGridHtml · sin filas, cadena vacía en vez de una tabla vacía", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx4SensitivityGridHtml"), context);
  assert.equal(context.esx4SensitivityGridHtml({ rows: [] }), "");
  assert.equal(context.esx4SensitivityGridHtml(null), "");
});

test("app.js: renderE13ScenarioLab calcula la malla con sensitivityGrid (A8-1/A8-6) y la pinta en el análisis avanzado", () => {
  const block = extractFunction("renderE13ScenarioLab");
  assert.match(block, /E13\.sensitivityGrid\(forecast, e13ScenarioEvents\)/);
  assert.match(block, /esx4SensitivityGridHtml\(sensitivityGrid\)/);
});

test("el motor canónico E13 sigue registrado en index.html", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /canonical-e13-scenarios\.js\?v=/);
});
