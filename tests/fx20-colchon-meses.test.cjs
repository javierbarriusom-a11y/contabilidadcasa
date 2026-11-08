// FX-20 · el colchón en meses en la tabla de impacto de la Previsión nueva (contrato FX-01 `colchon-meses`). Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../canonical-forecast-contract.js");
const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");

test("FX-20 · colchón en meses: liquidez ÷ gasto corriente medio, con una décima", () => {
  assert.equal(C.cushionMonths(5600, 4250), 1.3);
  assert.equal(C.cushionMonths(2500, 4250), 0.6);
  assert.equal(C.cushionMonths(12750, 4250), 3);
  assert.equal(C.cushionMonths(-850, 4250), -0.2, "en negativo, el colchón es negativo");
  assert.equal(C.cushionMonths(-10, 4250), 0, "sin −0");
  // Sin gasto o sin liquidez no hay nada que medir: no se inventa una cifra.
  assert.equal(C.cushionMonths(5600, 0), null);
  assert.equal(C.cushionMonths(5600, null), null);
  assert.equal(C.cushionMonths(null, 4250), null);
  assert.equal(C.cushionMonths(undefined, 4250), null);
});

test("FX-20 · el contrato dice cómo se calcula, y es la fórmula de «Colchón más justo» y de Escenarios", () => {
  const metric = C.METRICS.find((item) => item.id === "colchon-meses");
  assert.match(metric.definition, /gasto corriente medio de un mes \(el de los 12 primeros meses del plan\)/);
  // El mismo gasto medio que «Colchón más justo» (Análisis y la tira de cabecera) y que Escenarios.
  assert.match(leer("escenarios-ui.js"), /function escenarioMotorAverageCoreSpend\(series\) \{\n\s+const sample = series\.slice\(0, 12\);/);
  assert.match(leer("app.js"), /const avgCoreSpend = escenarioMotorAverageCoreSpend\(simRows\);/);
});

test("FX-20 · cableado: la fila del colchón en el punto más bajo, con el gasto del plan en los dos lados y el objetivo de Ajustes", () => {
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /escenarioMotorAverageCoreSpend\(canonicalEngineRuns\.active\?\.rows \|\| \[\]\)/);
  assert.match(vista, /cushionMonths\?\.\(c\.baseLow\.value, gasto\)/);
  assert.match(vista, /cushionMonths\?\.\(c\.low\.value, gasto\)/);
  assert.match(vista, /"Colchón en el punto más bajo \(meses\)"/);
  // La diferencia es la resta de lo que se ve, en décimas.
  assert.match(vista, /Math\.round\(\(colchonPrueba - colchonPlan\) \* 10\) \/ 10/);
  // El objetivo solo se dice si la prueba lo rompe y el plan no.
  assert.match(vista, /colchonPlan >= objetivo && colchonPrueba < objetivo/);
});
