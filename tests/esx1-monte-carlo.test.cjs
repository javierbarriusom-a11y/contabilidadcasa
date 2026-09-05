const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));

// ESX1 (Oleada 2 Bloque 5): Monte Carlo de trayectorias. El usuario acotó el alcance explícitamente
// — cientos de trayectorias (no miles), en el hilo principal, sin Web Worker — para no arriesgar el
// presupuesto de rendimiento de OPT-5. Extiende prudentSimulation() (A8-3): la incertidumbre viene
// del mismo triángulo P10/P50/P90 ya calibrado ahí (historial real conciliado o rango manual), nunca
// una distribución inventada aparte.

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

function buildForecast(months, openingChecking = 1000) {
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

test("monteCarloSimulation · nunca supera el tope de trayectorias, aunque se pidan miles", () => {
  const forecast = buildForecast(Array.from({ length: 6 }, () => ({ income: 3000, outflow: 2000 })));
  const result = E13.monteCarloSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 }, trajectories: 5000 });
  assert.equal(result.calculable, true);
  assert.ok(result.trajectories <= E13.MONTE_CARLO_MAX_TRAJECTORIES, `${result.trajectories} debería estar acotado a ${E13.MONTE_CARLO_MAX_TRAJECTORIES}`);
  assert.equal(result.trajectories, E13.MONTE_CARLO_MAX_TRAJECTORIES);
});

test("monteCarloSimulation · por defecto usa cientos de trayectorias, no miles", () => {
  const forecast = buildForecast(Array.from({ length: 6 }, () => ({ income: 3000, outflow: 2000 })));
  const result = E13.monteCarloSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 } });
  assert.equal(result.trajectories, E13.MONTE_CARLO_DEFAULT_TRAJECTORIES);
  assert.ok(result.trajectories < 1000, "el valor por defecto debe quedarse en cientos, no en miles");
});

test("monteCarloSimulation · un rango manual invertido (mínimo por encima del máximo) no es calculable", () => {
  const forecast = buildForecast(Array.from({ length: 3 }, () => ({ income: 3000, outflow: 2000 })));
  const result = E13.monteCarloSimulation(forecast, [], { manualRange: { min: 500, base: 0, max: -500 } });
  assert.equal(result.calculable, false);
});

test("monteCarloSimulation · sin incertidumbre (rango degenerado en 0) reproduce el mínimo del propio escenario base", () => {
  const forecast = buildForecast(Array.from({ length: 6 }, () => ({ income: 3000, outflow: 2000 })));
  const result = E13.monteCarloSimulation(forecast, [], { manualRange: { min: 0, base: 0, max: 0 }, trajectories: 20 });
  const baseline = E13.simulate(forecast, E13.PROFILES[0], []);
  assert.equal(result.minCheckingPercentiles.p10, baseline.metrics.minChecking);
  assert.equal(result.minCheckingPercentiles.p50, baseline.metrics.minChecking);
  assert.equal(result.minCheckingPercentiles.p90, baseline.metrics.minChecking);
  assert.equal(result.breachProbabilityPct, baseline.metrics.minChecking < 0 ? 100 : 0);
});

test("monteCarloSimulation · con randomFn determinista, el resultado es reproducible", () => {
  const forecast = buildForecast(Array.from({ length: 12 }, () => ({ income: 3000, outflow: 2000 })));
  const makeRandomFn = () => { let seed = 7; return () => (seed = (seed * 9301 + 49297) % 233280) / 233280; };
  const first = E13.monteCarloSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 }, trajectories: 100, randomFn: makeRandomFn() });
  const second = E13.monteCarloSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 }, trajectories: 100, randomFn: makeRandomFn() });
  assert.deepEqual(first.minCheckingPercentiles, second.minCheckingPercentiles);
  assert.equal(first.breachProbabilityPct, second.breachProbabilityPct);
});

test("monteCarloSimulation · hereda la fuente y la advertencia de prudentSimulation (A8-3), sin duplicar la calibración", () => {
  const forecast = buildForecast(Array.from({ length: 3 }, () => ({ income: 3000, outflow: 2000 })));
  const prudent = E13.prudentSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 } });
  const monteCarlo = E13.monteCarloSimulation(forecast, [], { manualRange: { min: -800, base: -100, max: 200 } });
  assert.equal(monteCarlo.source, prudent.source);
  assert.equal(monteCarlo.calibrated, prudent.calibrated);
  assert.equal(monteCarlo.warning, prudent.warning);
});

test("monteCarloSimulation: nunca fija una probabilidad de ruptura hardcodeada — todo sale de la simulación", () => {
  const source = fs.readFileSync(path.join(root, "canonical-e13-scenarios.js"), "utf8");
  const fnStart = source.indexOf("function monteCarloSimulation(");
  const fnEnd = source.indexOf("\n  }", fnStart);
  const fnBody = source.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /breachProbabilityPct:\s*[1-9]/, "no debe fijar una probabilidad de ruptura hardcodeada");
});

test("canonical-e13-scenarios.js: monteCarloSimulation y sus constantes están exportadas", () => {
  assert.equal(typeof E13.monteCarloSimulation, "function");
  assert.equal(typeof E13.MONTE_CARLO_DEFAULT_TRAJECTORIES, "number");
  assert.equal(typeof E13.MONTE_CARLO_MAX_TRAJECTORIES, "number");
});

test("esx1MonteCarloHtml · sin datos calculables, mensaje explícito en vez de una tabla vacía", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx1MonteCarloHtml"), context);
  assert.match(context.esx1MonteCarloHtml({ calculable: false }), /Sin horizonte o sin rango de incertidumbre/);
  assert.equal(context.esx1MonteCarloHtml(null), context.esx1MonteCarloHtml({ calculable: false }));
});

test("esx1MonteCarloHtml · pinta la probabilidad de ruptura y la banda P10/P50/P90", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("esx1MonteCarloHtml"), context);
  const html = context.esx1MonteCarloHtml({
    calculable: true, trajectories: 300, maxTrajectories: 500, breachProbabilityPct: 12,
    minCheckingPercentiles: { p10: -100, p50: 500, p90: 900 }, warning: "",
  });
  assert.match(html, /12%/);
  assert.match(html, /300 trayectorias/);
  assert.match(html, /-100 €/);
  assert.match(html, /500 €/);
  assert.match(html, /900 €/);
});

test("app.js: renderE13ScenarioLab calcula monteCarloSimulation (A8-3) y lo pinta en el análisis avanzado", () => {
  const block = extractFunction("renderE13ScenarioLab");
  assert.match(block, /E13\.monteCarloSimulation\(forecast, e13ScenarioEvents/);
  assert.match(block, /esx1MonteCarloHtml\(monteCarlo\)/);
});

test("el motor canónico E13 sigue registrado en index.html", () => {
  assert.match(indexSource, /canonical-e13-scenarios\.js\?v=/);
});
