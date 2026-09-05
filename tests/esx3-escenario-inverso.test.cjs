const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));

// ESX3 (Oleada 2 Bloque 5): escenario inverso «¿qué tendría que cambiar?». Depende de A8-6
// (sensitivity(), que ya identificaba el factor dominante pero con una extrapolación lineal de un
// solo paso) y de PV6 (verdictSensitivity(), que ya resolvía el punto de cruce EXACTO pero solo para
// el mínimo ajustado de un mes concreto). inverseScenario() busca el punto de cruce exacto — por
// bisección sobre el propio simulate() (A8-1), nunca una extrapolación — para el horizonte completo.

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

function buildForecast(months, openingChecking = 1200) {
  return {
    schemaId: "finance-canonical-forecast/v1",
    valid: true,
    fingerprint: "test",
    assumptions: { items: [{ id: "openingChecking", value: openingChecking }, { id: "openingSavings", value: 0 }] },
    series: months.map((month, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: month.income, outflowsBeforeSaving: month.outflow, saving: 0 },
    })),
  };
}

test("simulate() · un incomeFactor o expenseFactor de 0 se aplica de verdad, no se confunde con «sin dato» (regresión del `|| 1`)", () => {
  const forecast = buildForecast([{ income: 2000, outflow: 1500 }]);
  const withoutIncome = E13.simulate(forecast, { ...E13.PROFILES[0], incomeFactor: 0 }, []);
  assert.equal(withoutIncome.rows[0].income, 0);
  const withoutExpense = E13.simulate(forecast, { ...E13.PROFILES[0], expenseFactor: 0 }, []);
  assert.equal(withoutExpense.rows[0].outflows, 0);
});

test("inverseScenario · un caso base ya roto no busca un punto de cruce hacia delante", () => {
  const forecast = buildForecast([{ income: 1000, outflow: 1500 }], 0);
  const result = E13.inverseScenario(forecast, []);
  assert.equal(result.verdict, "danger");
  assert.equal(result.alreadyBroken, true);
  assert.deepEqual(result.factors, []);
});

test("inverseScenario · encuentra el punto de cruce exacto de ingresos por bisección, verificado contra simulate()", () => {
  const forecast = buildForecast(Array.from({ length: 6 }, () => ({ income: 3000, outflow: 2000 })), 1200);
  const result = E13.inverseScenario(forecast, []);
  assert.equal(result.verdict, "safe");
  const income = result.factors.find((factor) => factor.id === "income");
  assert.equal(income.calculable, true);
  const crossingFactor = 1 - income.dropPercent / 100;
  const atCrossing = E13.simulate(forecast, { ...E13.PROFILES[0], incomeFactor: crossingFactor }, []).metrics.minChecking;
  assert.ok(Math.abs(atCrossing) < 1, `minChecking en el punto de cruce debería rondar 0, dio ${atCrossing}`);
});

test("inverseScenario · encuentra el punto de cruce exacto de gastos por bisección, verificado contra simulate()", () => {
  const forecast = buildForecast(Array.from({ length: 6 }, () => ({ income: 3000, outflow: 2000 })), 1200);
  const result = E13.inverseScenario(forecast, []);
  const expenses = result.factors.find((factor) => factor.id === "expenses");
  assert.equal(expenses.calculable, true);
  const crossingFactor = 1 + expenses.risePercent / 100;
  const atCrossing = E13.simulate(forecast, { ...E13.PROFILES[0], expenseFactor: crossingFactor }, []).metrics.minChecking;
  assert.ok(Math.abs(atCrossing) < 1, `minChecking en el punto de cruce debería rondar 0, dio ${atCrossing}`);
});

test("inverseScenario · un eje sin cruce dentro del rango explorado lo dice explícitamente en vez de fabricar un porcentaje", () => {
  const forecast = buildForecast(Array.from({ length: 3 }, () => ({ income: 3000, outflow: 100 })), 5000);
  const result = E13.inverseScenario(forecast, []);
  const income = result.factors.find((factor) => factor.id === "income");
  assert.equal(income.calculable, false);
  assert.equal(income.dropPercent, null);
  assert.match(income.note, /Ni perdiendo todo el ingreso/);
});

test("inverseScenario · sin eventos declarados no aparece el eje de eventos (nunca un 0% inventado)", () => {
  const forecast = buildForecast(Array.from({ length: 3 }, () => ({ income: 3000, outflow: 2000 })), 1200);
  const result = E13.inverseScenario(forecast, []);
  assert.equal(result.factors.some((factor) => factor.id === "events"), false);
});

test("inverseScenario · con eventos declarados sí evalúa el eje de eventos, escalando el importe ya declarado", () => {
  const forecast = buildForecast(Array.from({ length: 3 }, () => ({ income: 3000, outflow: 2000 })), 1200);
  const events = [{ id: "e1", type: "expense", label: "Reforma", monthKey: "2026-02", amount: 200, duration: 1 }];
  const result = E13.inverseScenario(forecast, events);
  const eventsFactor = result.factors.find((factor) => factor.id === "events");
  assert.ok(eventsFactor, "debería aparecer el eje de eventos");
  assert.equal(typeof eventsFactor.calculable, "boolean");
});

test("inverseScenario: nunca inventa un umbral fijo de caída/subida — todo sale de la bisección sobre simulate()", () => {
  const source = fs.readFileSync(path.join(root, "canonical-e13-scenarios.js"), "utf8");
  const fnStart = source.indexOf("function inverseScenario(");
  const fnEnd = source.indexOf("\n  }", fnStart);
  const fnBody = source.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /dropPercent\s*=\s*[1-9]|risePercent\s*=\s*[1-9]/, "no debe fijar un porcentaje de cruce hardcodeado");
});

test("esx3InverseScenarioHtml · caso base ya roto: dice que no hay punto de cruce", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx3InverseScenarioHtml"), context);
  const html = context.esx3InverseScenarioHtml({ alreadyBroken: true, baselineMinChecking: -500 });
  assert.match(html, /ya está roto hoy/);
  assert.match(html, /-500 €/);
});

test("esx3InverseScenarioHtml · pinta cada factor calculable con su porcentaje y los no calculables con su nota", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx3InverseScenarioHtml"), context);
  const html = context.esx3InverseScenarioHtml({
    alreadyBroken: false,
    baselineMinChecking: 2100,
    factors: [
      { id: "income", label: "Ingresos", calculable: true, dropPercent: 40 },
      { id: "expenses", label: "Gastos", calculable: false, note: "Ni multiplicando el gasto por 3 se rompe el plan en el rango explorado." },
    ],
  });
  assert.match(html, /Ingresos/);
  assert.match(html, /caer un <strong>40%<\/strong>/);
  assert.match(html, /Ni multiplicando el gasto por 3/);
});

test("app.js: renderE13ScenarioLab calcula inverseScenario (A8-6/PV6) y lo pinta en el análisis avanzado", () => {
  const block = extractFunction("renderE13ScenarioLab");
  assert.match(block, /E13\.inverseScenario\(forecast, e13ScenarioEvents\)/);
  assert.match(block, /esx3InverseScenarioHtml\(inverseScenario\)/);
});

test("canonical-e13-scenarios.js: inverseScenario está exportado", () => {
  assert.equal(typeof E13.inverseScenario, "function");
});

test("el motor canónico E13 sigue registrado en index.html", () => {
  assert.match(indexSource, /canonical-e13-scenarios\.js\?v=/);
});
