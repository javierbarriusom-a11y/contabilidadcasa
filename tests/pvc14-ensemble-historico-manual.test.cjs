const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// PVC14 (Oleada 4, apuesta grande): el backlog pedía un "ensemble ponderado y visible entre
// histórico, manual y Monte Carlo". Revisando el código real: (1) el "manual" no existía — las
// llamadas a prudentSimulation()/monteCarloSimulation() pasaban un `{min:-500, base:0, max:500}`
// hardcodeado, nunca declarado por el hogar; (2) Monte Carlo no es un tercer origen de datos
// comparable — ya se construye ENCIMA del triángulo que decide prudentSimulation(), así que pedirle
// un peso propio mezclaría una entrada con su propia salida. Esta tarea: (a) un manual de verdad,
// declarado o ausente, nunca inventado; (b) ensembleForecastRange() mezcla histórico y manual con
// un peso ajustable por el hogar (sesión 171: "pesos ajustables, no fijos"), mostrando siempre los
// dos triángulos de origen por separado (§11 del backlog); (c) Monte Carlo sigue sin tocarse,
// simplemente hereda el triángulo ya mezclado.

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

function buildForecast(monthCount = 6) {
  return {
    schemaId: "finance-canonical-forecast/v1",
    valid: true,
    fingerprint: "test",
    assumptions: { items: [{ id: "openingChecking", value: 1000 }, { id: "openingSavings", value: 0 }] },
    series: Array.from({ length: monthCount }, (_, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: 3000, outflowsBeforeSaving: 2000, saving: 0 },
    })),
  };
}

function historyEntry(amount) {
  return { amount, reconciled: true };
}

// --- ensembleForecastRange ---------------------------------------------------------------------

test("ensembleForecastRange · sin histórico ni manual, no calculable (nunca un triángulo inventado)", () => {
  const result = E13.ensembleForecastRange({});
  assert.equal(result.calculable, false);
});

test("ensembleForecastRange · solo histórico, se usa al 100% tal cual", () => {
  const historical = { p10: -100, p50: 0, p90: 100 };
  const result = E13.ensembleForecastRange({ historical });
  assert.equal(result.source, "reconciled-history");
  assert.equal(result.historicalWeightPct, 100);
  assert.deepEqual(result.percentiles, historical);
  assert.equal(result.manual, null);
});

test("ensembleForecastRange · solo manual, se usa al 100% tal cual (peso histórico 0)", () => {
  const manual = { p10: -500, p50: 0, p90: 500 };
  const result = E13.ensembleForecastRange({ manual });
  assert.equal(result.source, "manual-range");
  assert.equal(result.historicalWeightPct, 0);
  assert.deepEqual(result.percentiles, manual);
});

test("ensembleForecastRange · con los dos triángulos y un peso declarado, mezcla ponderada y muestra ambos orígenes", () => {
  const historical = { p10: -100, p50: 0, p90: 100 };
  const manual = { p10: -500, p50: 0, p90: 500 };
  const result = E13.ensembleForecastRange({ historical, manual, historicalWeightPct: 70 });
  assert.equal(result.source, "ensemble");
  assert.equal(result.historicalWeightPct, 70);
  assert.equal(result.percentiles.p10, -220); // -100*0.7 + -500*0.3
  assert.equal(result.percentiles.p90, 220);
  assert.deepEqual(result.historical, historical);
  assert.deepEqual(result.manual, manual);
});

test("ensembleForecastRange · sin peso declarado, por defecto pesa 100% histórico (nunca un peso fijo distinto decidido por el motor)", () => {
  const historical = { p10: -100, p50: 0, p90: 100 };
  const manual = { p10: -500, p50: 0, p90: 500 };
  const result = E13.ensembleForecastRange({ historical, manual });
  assert.equal(result.historicalWeightPct, 100);
  assert.deepEqual(result.percentiles, historical);
});

test("ensembleForecastRange · un peso fuera de 0-100 se acota, nunca produce una mezcla absurda", () => {
  const historical = { p10: -100, p50: 0, p90: 100 };
  const manual = { p10: -500, p50: 0, p90: 500 };
  assert.equal(E13.ensembleForecastRange({ historical, manual, historicalWeightPct: 150 }).historicalWeightPct, 100);
  assert.equal(E13.ensembleForecastRange({ historical, manual, historicalWeightPct: -20 }).historicalWeightPct, 0);
});

// --- prudentSimulation ---------------------------------------------------------------------------

test("prudentSimulation · sin histórico suficiente y sin manual declarado (campos ausentes), no calculable — nunca un triángulo de ceros silencioso", () => {
  const forecast = buildForecast();
  const result = E13.prudentSimulation(forecast, [], { history: [] });
  assert.equal(result.calculable, false);
  assert.equal(result.percentiles, null);
  assert.match(result.warning, /no hay percentiles/);
});

test("prudentSimulation · manual declarado a medias (falta un campo) cuenta como no declarado", () => {
  const forecast = buildForecast();
  const result = E13.prudentSimulation(forecast, [], { history: [], manualRange: { min: -500, base: 0 } });
  assert.equal(result.calculable, false);
});

test("prudentSimulation · con histórico calibrado y sin manual, sigue funcionando exactamente igual que antes de esta tarea", () => {
  const forecast = buildForecast();
  const history = Array.from({ length: 6 }, (_, index) => historyEntry(100 + index * 10));
  const result = E13.prudentSimulation(forecast, [], { history });
  assert.equal(result.calculable, true);
  assert.equal(result.source, "reconciled-history");
  assert.equal(result.calibrated, true);
  assert.equal(result.manual, null);
});

test("prudentSimulation · con histórico corto y manual declarado, usa el manual al 100% (mismo comportamiento de fallback de siempre, pero con un manual real)", () => {
  const forecast = buildForecast();
  const result = E13.prudentSimulation(forecast, [], { history: [historyEntry(100)], manualRange: { min: -500, base: 0, max: 400 } });
  assert.equal(result.calculable, true);
  assert.equal(result.source, "manual-range");
  assert.equal(result.calibrated, false);
  assert.deepEqual(result.percentiles, { p10: -500, p50: 0, p90: 400 });
});

test("prudentSimulation · con histórico calibrado Y manual declarado, produce un ensemble visible con los dos orígenes y el peso del hogar", () => {
  const forecast = buildForecast();
  const history = Array.from({ length: 6 }, () => historyEntry(0)); // p10=p50=p90=0
  const result = E13.prudentSimulation(forecast, [], { history, manualRange: { min: -1000, base: 0, max: 1000 }, historicalWeightPct: 25 });
  assert.equal(result.calculable, true);
  assert.equal(result.source, "ensemble");
  assert.equal(result.historicalWeightPct, 25);
  assert.deepEqual(result.historical, { p10: 0, p50: 0, p90: 0 });
  assert.deepEqual(result.manual, { p10: -1000, p50: 0, p90: 1000 });
  // 0*0.25 + -1000*0.75 = -750
  assert.equal(result.percentiles.p10, -750);
  assert.match(result.warning, /Mezcla histórico y manual/);
});

// --- monteCarloSimulation sigue sin romperse cuando prudentSimulation no es calculable ------------

test("monteCarloSimulation · si prudentSimulation no es calculable (sin histórico ni manual), no revienta y declara no calculable", () => {
  const forecast = buildForecast();
  const result = E13.monteCarloSimulation(forecast, [], { history: [] });
  assert.equal(result.calculable, false);
  assert.equal(result.prudent.calculable, false);
});

test("monteCarloSimulation · con un ensemble calculable, simula sobre el triángulo ya mezclado (nunca un peso propio de Monte Carlo)", () => {
  const forecast = buildForecast();
  const history = Array.from({ length: 6 }, () => historyEntry(0));
  const result = E13.monteCarloSimulation(forecast, [], { history, manualRange: { min: -1000, base: 0, max: 1000 }, historicalWeightPct: 25, trajectories: 20 });
  assert.equal(result.calculable, true);
  assert.equal(result.source, "ensemble");
});

// --- quarterlyRecalibrationProposal sigue funcionando sin romperse con triángulos null ------------

test("quarterlyRecalibrationProposal · ni el actual ni el propuesto son calculables, la comparación no revienta", () => {
  const forecast = buildForecast();
  const result = E13.quarterlyRecalibrationProposal(forecast, [], { history: [], asOfMonthKey: "2026-06", quarters: 8 });
  assert.equal(result.currentCalculable, false);
  assert.equal(result.proposedCalculable, false);
  assert.equal(result.changed, false);
});

// --- app.js: lectura real declarada, nunca hardcodeada -------------------------------------------

test("app.js: ya no queda ningún -500/0/500 hardcodeado pasado a prudentSimulation/monteCarloSimulation — todo pasa por pvc14ManualRange()", () => {
  assert.doesNotMatch(appSource, /manualRange:\s*\{\s*min:\s*-500/);
  const occurrences = (appSource.match(/manualRange:\s*pvc14ManualRange\(\)/g) || []).length;
  assert.equal(occurrences, 4, "esperaba las 4 llamadas (LEV7, PVC5, Simulación prudente, Monte Carlo) usando el manual real");
});

function sandbox() {
  const context = {
    scenarioSettings: {},
    qs: () => null,
    parseAmount: (value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvc14ManualRange"), context);
  vm.runInContext(extractFunction("pvc14HistoricalWeightPct"), context);
  return context;
}

// Sandbox de formulario: simula rellenar los campos DEL DOM uno a uno, con un `qs` que refleja el
// estado real de cada input, para reproducir exactamente el bug que detectó la validación manual en
// navegador de esta tarea (rellenar P10 y tabular a Base borraba P10, porque en ese instante Base y
// P90 seguían vacíos y el guardado agrupaba los tres campos en un único objeto {min,base,max}).
function formSandbox() {
  const fields = { pvc14ManualP10: "", pvc14ManualBase: "", pvc14ManualP90: "", pvc14HistoricalWeightPct: "" };
  const context = {
    scenarioSettings: {},
    qs: (id) => (id in fields ? { value: fields[id] } : null),
    parseAmount: (value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
    saveScenarioSettings: () => {},
    renderE13ScenarioLab: () => {},
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvc14ManualRange"), context);
  vm.runInContext(extractFunction("handlePvc14ManualFieldChange"), context);
  return {
    ctx: context,
    // Simula escribir en un campo y que pierda el foco (blur → "change"), como al tabular.
    fillAndBlur(id, value) {
      fields[id] = value;
      context.handlePvc14ManualFieldChange();
    },
  };
}

test("handlePvc14ManualFieldChange · rellenar los tres campos uno a uno (tabulando) nunca borra los ya rellenados, aunque los otros sigan vacíos", () => {
  const { ctx, fillAndBlur } = formSandbox();
  fillAndBlur("pvc14ManualP10", "-500");
  assert.equal(ctx.scenarioSettings.pvc14ManualP10, -500, "P10 no debería perderse al tabular con Base y P90 aún vacíos");
  fillAndBlur("pvc14ManualBase", "0");
  assert.equal(ctx.scenarioSettings.pvc14ManualP10, -500, "P10 sigue sin declarar completo el grupo, pero no debe borrarse");
  assert.equal(ctx.scenarioSettings.pvc14ManualBase, 0);
  fillAndBlur("pvc14ManualP90", "500");
  assert.deepEqual({ ...ctx.pvc14ManualRange() }, { min: -500, base: 0, max: 500 });
});

test("app.js: pvc14ManualRange lee de scenarioSettings, y solo cuenta como declarado con los tres campos numéricos", () => {
  const ctx = sandbox();
  // { ...valor } normaliza al realm de este archivo — el objeto que devuelve la función vive en el
  // realm del vm.createContext, con un prototipo distinto aunque el contenido sea idéntico (mismo
  // matiz ya documentado en tests/inv12-fundingpositions-objetivo.test.cjs).
  ctx.scenarioSettings.pvc14ManualP10 = -500;
  ctx.scenarioSettings.pvc14ManualBase = 0;
  ctx.scenarioSettings.pvc14ManualP90 = 500;
  assert.deepEqual({ ...ctx.pvc14ManualRange() }, { min: -500, base: 0, max: 500 });

  // Cada campo se guarda por separado (nunca un objeto {min,base,max} agrupado): declarar solo dos
  // de los tres campos no debe borrar los que sí están, aunque pvc14ManualRange() siga sin
  // considerarlo "declarado" para el cálculo mientras falte alguno.
  delete ctx.scenarioSettings.pvc14ManualP90;
  assert.deepEqual({ ...ctx.pvc14ManualRange() }, {});
  assert.equal(ctx.scenarioSettings.pvc14ManualP10, -500, "P10 no debería borrarse solo porque P90 falte");

  delete ctx.scenarioSettings.pvc14ManualP10;
  delete ctx.scenarioSettings.pvc14ManualBase;
  assert.deepEqual({ ...ctx.pvc14ManualRange() }, {});
});

test("app.js: pvc14HistoricalWeightPct devuelve undefined sin declarar, y se acota a 0-100 si se declara fuera de rango", () => {
  const ctx = sandbox();
  assert.equal(ctx.pvc14HistoricalWeightPct(), undefined);
  ctx.scenarioSettings.pvc14HistoricalWeightPct = 40;
  assert.equal(ctx.pvc14HistoricalWeightPct(), 40);
  ctx.scenarioSettings.pvc14HistoricalWeightPct = 150;
  assert.equal(ctx.pvc14HistoricalWeightPct(), 100);
});

// --- UI ---------------------------------------------------------------------------------------

test("index.html: la tarjeta de estimación manual declara P10/P50/P90 y el peso del histórico", () => {
  assert.match(indexSource, /id="pvc14ManualP10"/);
  assert.match(indexSource, /id="pvc14ManualBase"/);
  assert.match(indexSource, /id="pvc14ManualP90"/);
  assert.match(indexSource, /id="pvc14HistoricalWeightPct"/);
  assert.match(indexSource, /id="pvc14ManualNote"/);
});

test("app.js: los cuatro campos de PVC14 guardan al cambiar y vuelven a renderizar el Laboratorio de escenarios", () => {
  assert.match(appSource, /"pvc14ManualP10", "pvc14ManualBase", "pvc14ManualP90", "pvc14HistoricalWeightPct"\]\.forEach/);
  assert.match(appSource, /qs\(id\)\?\.addEventListener\("change", handlePvc14ManualFieldChange\)/);
  const block = extractFunction("handlePvc14ManualFieldChange");
  assert.match(block, /saveScenarioSettings\(\)/);
  assert.match(block, /renderE13ScenarioLab\(\)/);
});

test("app.js: la tarjeta de Simulación prudente muestra siempre los dos triángulos de origen cuando el resultado es un ensemble, nunca solo la cifra mezclada", () => {
  const block = extractFunction("pvc14PrudentSimulationHtml");
  assert.match(block, /prudent\.historical/);
  assert.match(block, /prudent\.manual/);
  assert.match(block, /historicalWeightPct/);
});
