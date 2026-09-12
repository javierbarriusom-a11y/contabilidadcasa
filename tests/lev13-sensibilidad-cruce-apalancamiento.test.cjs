const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV13 (Oleada 4, Bloque 5): aplica la misma bisección exacta de inverseScenario()
// (canonical-e13-scenarios.js, laboratorio de previsión) sobre simulateLeverage() — en vez de decir
// solo "favorable/desfavorable hoy" con la rentabilidad y el tipo tal cual se declararon, dice
// cuánto tendría que caer la rentabilidad esperada, o cuánto tendría que subir el tipo de la deuda
// nueva, antes de que cada escenario declarado cambie de signo. Un escenario ya desfavorable hoy no
// tiene un punto de cruce hacia delante que buscar (mismo criterio que "alreadyBroken" en
// inverseScenario).

function baseSimulation(overrides = {}) {
  return LeverageSimulator.simulateLeverage({
    barrierResult: { valid: true },
    newDebtAmount: 20000,
    newDebtAnnualRatePercent: 4,
    expectedReturnScenarios: { pessimisticPercent: 2, basePercent: 6, optimisticPercent: 10 },
    ...overrides,
  });
}

test("leverageVerdictCrossing · sin simulación calculable, no hay nada que medir", () => {
  const result = LeverageSimulator.leverageVerdictCrossing({ calculable: false });
  assert.equal(result.calculable, false);
});

test("leverageVerdictCrossing · escenario pesimista (2% < 4% de coste) ya desfavorable: sin punto de cruce hacia delante", () => {
  const simulation = baseSimulation();
  const crossing = LeverageSimulator.leverageVerdictCrossing(simulation);
  assert.equal(crossing.calculable, true);
  const pessimistic = crossing.scenarios.find((item) => item.id === "pessimistic");
  assert.equal(pessimistic.alreadyUnfavorable, true);
  assert.equal(pessimistic.returnDropPercent, null);
  assert.equal(pessimistic.rateRisePercent, null);
  assert.match(pessimistic.note, /ya es desfavorable hoy/);
});

test("leverageVerdictCrossing · escenario base (6% > 4%) favorable: el cruce exacto de rentabilidad cae en el 4% (tipo de la deuda)", () => {
  const simulation = baseSimulation();
  const crossing = LeverageSimulator.leverageVerdictCrossing(simulation);
  const base = crossing.scenarios.find((item) => item.id === "base");
  assert.equal(base.alreadyUnfavorable, false);
  // netAnnualResult = debtAmount*(returnPct-debtRatePct)/100, lineal — el cruce exacto está en
  // returnPct === debtRatePct === 4%, sea cual sea el importe de deuda.
  assert.ok(Math.abs(base.returnCrossingPct - 4) < 0.05);
  assert.ok(Math.abs(base.returnDropPercent - (100 * (1 - 4 / 6))) < 0.5);
  // Simétrico: el tipo de la deuda podría subir hasta el 6% (la rentabilidad base) antes de cruzar.
  assert.ok(Math.abs(base.rateCrossingPct - 6) < 0.05);
  assert.ok(Math.abs(base.rateRisePercent - 50) < 1); // de 4% a 6% son 50 puntos porcentuales de subida relativa
});

test("leverageVerdictCrossing · escenario optimista (10% muy por encima del tipo), con techo de tipo insuficiente, no cruza", () => {
  const simulation = baseSimulation();
  const crossing = LeverageSimulator.leverageVerdictCrossing(simulation, { rateCeilingMultiplier: 2 }); // techo 8%, nunca llega al 10%
  const optimistic = crossing.scenarios.find((item) => item.id === "optimistic");
  assert.equal(optimistic.alreadyUnfavorable, false);
  assert.equal(optimistic.rateRisePercent, null);
  assert.match(optimistic.note, /Ni multiplicando el tipo de la deuda por 2/);
});

test("leverageVerdictCrossing · con techo de tipo suficiente, el escenario optimista sí cruza en el 10%", () => {
  const simulation = baseSimulation();
  const crossing = LeverageSimulator.leverageVerdictCrossing(simulation, { rateCeilingMultiplier: 5 }); // techo 20%, sí llega al 10%
  const optimistic = crossing.scenarios.find((item) => item.id === "optimistic");
  assert.ok(Math.abs(optimistic.rateCrossingPct - 10) < 0.05);
});

test("leverageVerdictCrossing · el resultado no depende del importe de deuda (lineal): mismo cruce con 20000€ o con 5000€", () => {
  const big = LeverageSimulator.leverageVerdictCrossing(baseSimulation({ newDebtAmount: 20000 }));
  const small = LeverageSimulator.leverageVerdictCrossing(baseSimulation({ newDebtAmount: 5000 }));
  const bigBase = big.scenarios.find((item) => item.id === "base");
  const smallBase = small.scenarios.find((item) => item.id === "base");
  assert.ok(Math.abs(bigBase.returnCrossingPct - smallBase.returnCrossingPct) < 0.05);
  assert.ok(Math.abs(bigBase.rateCrossingPct - smallBase.rateCrossingPct) < 0.05);
});

// --- Wiring en app.js: lev13VerdictCrossingHtml se compone dentro de ap3ResultHtml ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = {
    window: { FinanceCanonicalLeverageSimulator: LeverageSimulator },
    escapeHtml: (value) => String(value ?? ""),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("lev13VerdictCrossingHtml"), context);
  return context;
}

test("lev13VerdictCrossingHtml · sin resultado calculable, no muestra nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.lev13VerdictCrossingHtml({ calculable: false }), "");
});

test("lev13VerdictCrossingHtml · con resultado calculable, describe el margen de cada escenario sin decidir nada", () => {
  const ctx = sandbox();
  const html = ctx.lev13VerdictCrossingHtml(baseSimulation());
  assert.match(html, /Sensibilidad del veredicto/);
  assert.match(html, /ya es desfavorable hoy/); // pesimista
  assert.match(html, /rentabilidad esperada podría caer/); // base y optimista
  assert.match(html, /tipo de la deuda nueva podría subir/);
});

test("wiring: ap3ResultHtml compone lev13VerdictCrossingHtml junto al resultado del simulador", () => {
  const block = extractFunction("ap3ResultHtml");
  assert.match(block, /lev13VerdictCrossingHtml\(result\)/);
});
