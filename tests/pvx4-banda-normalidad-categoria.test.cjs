const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

// PVX4 (Oleada 2 Bloque 3): banda de normalidad por categoría en vivo. Reutiliza tal cual
// budgetAnalysisForCategory() (p25/p75 históricos, S-1, ya usado para sugerir presupuesto) comparado
// contra la proyección de fin de mes que ya calcula budgetProjection() (S-2) — nunca contra el gasto
// parcial a día de hoy, que sería una comparación falsa contra meses completos. Sin al menos 3 meses
// de historial (analyzeCategory ya lo exige, S-1), no hay banda que mostrar.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
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

function bandSandbox() {
  const context = { money: (v) => `€${v}` };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvx4NormalityBandLabel"), context);
  return context;
}

test("pvx4NormalityBandLabel · sin análisis (menos de 3 meses de historial), cadena vacía", () => {
  const context = bandSandbox();
  assert.equal(context.pvx4NormalityBandLabel(null, 100), "");
});

test("pvx4NormalityBandLabel · proyección dentro de p25-p75, dentro de lo normal", () => {
  const context = bandSandbox();
  const label = context.pvx4NormalityBandLabel({ p25: 80, p75: 120 }, 100);
  assert.match(label, /dentro de lo normal/);
});

test("pvx4NormalityBandLabel · proyección por encima de p75, por encima de lo normal", () => {
  const context = bandSandbox();
  const label = context.pvx4NormalityBandLabel({ p25: 80, p75: 120 }, 150);
  assert.match(label, /por encima de lo normal/);
});

test("pvx4NormalityBandLabel · proyección por debajo de p25, por debajo de lo normal", () => {
  const context = bandSandbox();
  const label = context.pvx4NormalityBandLabel({ p25: 80, p75: 120 }, 50);
  assert.match(label, /por debajo de lo normal/);
});

function rowSandbox({ alert, projection, analysis }) {
  const context = {
    budgetAlertForRow: () => alert,
    budgetProjection: () => projection,
    budgetAnalysisForCategory: () => analysis,
    budgetRowDisplayLabel: (id) => id,
    money: (v) => `€${v}`,
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("pvx4NormalityBandLabel"), extractFunction("presupuestoMesStatusPill"), extractFunction("presupuestoMesRowHtml")].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#pvx4-row" },
  );
  return context;
}

test("presupuestoMesRowHtml · con análisis disponible, añade la banda de normalidad junto a la proyección", () => {
  const context = rowSandbox({
    alert: { status: "on-track", metrics: { spent: 50, deviationPercent: 0 } },
    projection: { projected: 150, diff: 0 },
    analysis: { p25: 80, p75: 120 },
  });
  const html = context.presupuestoMesRowHtml({ categoryId: "comida", amountCap: 110, source: "manual" }, "2026-08");
  assert.match(html, /por encima de lo normal/);
  assert.match(html, /€80/);
  assert.match(html, /€120/);
});

test("presupuestoMesRowHtml · sin análisis (categoría nueva o poco historial), no añade banda ni rompe la fila", () => {
  const context = rowSandbox({
    alert: { status: "on-track", metrics: { spent: 50, deviationPercent: 0 } },
    projection: { projected: 100, diff: 0 },
    analysis: null,
  });
  const html = context.presupuestoMesRowHtml({ categoryId: "comida", amountCap: 110, source: "manual" }, "2026-08");
  assert.doesNotMatch(html, /dentro de lo normal|por encima de lo normal|por debajo de lo normal/);
  assert.match(html, /<tr/);
});

test("app.js: budgetAnalysisForCategory (S-1) sigue siendo la única fuente del histórico p25/p75, sin motor nuevo", () => {
  const block = extractFunction("pvx4NormalityBandLabel");
  assert.doesNotMatch(block, /analyzeCategory|CanonicalBudgetAnalyzer/, "no debe reimplementar el análisis histórico, solo leer p25/p75 ya calculados");
});
