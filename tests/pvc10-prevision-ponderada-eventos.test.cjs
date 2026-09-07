const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// PVC10 (Oleada 3, Bloque 4): previsión ponderada por eventos inciertos. Extiende el constructor de
// eventos A8-2 con una probabilidad declarada (probabilityPct) sin tocar simulate() (Base/Favorable/
// Tensión siguen aplicando cada evento a valor completo). Decisión del hogar (sesión 159): visible en
// las dos ubicaciones — comparación principal del Laboratorio Y su propio detalle.

function buildForecast() {
  return {
    schemaId: "finance-canonical-forecast/v1",
    valid: true,
    fingerprint: "test",
    assumptions: { items: [{ id: "openingChecking", value: 1000 }, { id: "openingSavings", value: 0 }] },
    series: Array.from({ length: 3 }, (_, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: 3000, outflowsBeforeSaving: 2000, saving: 0 },
    })),
  };
}

test("normalizeEvent · probabilityPct sin declarar es null, nunca 100 fabricado ni 0", () => {
  const event = E13.normalizeEvent({ type: "expense", monthKey: "2026-01", amount: 500 });
  assert.equal(event.probabilityPct, null);
});

test("normalizeEvent · probabilityPct declarado se recorta a 0-100", () => {
  assert.equal(E13.normalizeEvent({ type: "expense", probabilityPct: 150 }).probabilityPct, 100);
  assert.equal(E13.normalizeEvent({ type: "expense", probabilityPct: -10 }).probabilityPct, 0);
  assert.equal(E13.normalizeEvent({ type: "expense", probabilityPct: 30 }).probabilityPct, 30);
});

test("weightedForecastWithUncertainEvents · sin eventos, coincide con el forecast base (sin impacto)", () => {
  const forecast = buildForecast();
  const result = E13.weightedForecastWithUncertainEvents(forecast, []);
  assert.equal(result.rows[0].eventOutflow, 0);
  assert.equal(result.rows[0].closingChecking, 1000 + 3000 - 2000);
});

test("weightedForecastWithUncertainEvents · un evento sin probabilidad declarada se aplica a valor completo (100%), igual que simulate()", () => {
  const forecast = buildForecast();
  const events = [{ id: "e1", type: "expense", monthKey: "2026-01", amount: 500, duration: 1 }];
  const weighted = E13.weightedForecastWithUncertainEvents(forecast, events);
  const base = E13.simulate(forecast, E13.PROFILES.find((p) => p.id === "base"), events);
  assert.equal(weighted.rows[0].closingChecking, base.rows[0].closingChecking);
});

test("weightedForecastWithUncertainEvents · un evento con 50% de probabilidad reduce su impacto a la mitad", () => {
  const forecast = buildForecast();
  const events = [{ id: "e1", type: "expense", monthKey: "2026-01", amount: 1000, duration: 1, probabilityPct: 50 }];
  const result = E13.weightedForecastWithUncertainEvents(forecast, events);
  assert.equal(result.rows[0].eventOutflow, 500);
});

test("weightedForecastWithUncertainEvents · un evento con 0% de probabilidad no impacta nada", () => {
  const forecast = buildForecast();
  const events = [{ id: "e1", type: "expense", monthKey: "2026-01", amount: 1000, duration: 1, probabilityPct: 0 }];
  const result = E13.weightedForecastWithUncertainEvents(forecast, events);
  assert.equal(result.rows[0].eventOutflow, 0);
});

test("weightedForecastWithUncertainEvents · un income-loss con probabilidad se pondera igual que un gasto", () => {
  const forecast = buildForecast();
  const events = [{ id: "e1", type: "income-loss", monthKey: "2026-01", amount: 1000, duration: 1, probabilityPct: 25 }];
  const result = E13.weightedForecastWithUncertainEvents(forecast, events);
  assert.equal(result.rows[0].eventIncome, -250);
});

test("weightedForecastWithUncertainEvents · un evento de patrimonio (market-crash) no afecta la caja, con o sin probabilidad", () => {
  const forecast = buildForecast();
  const events = [{ id: "e1", type: "market-crash", monthKey: "2026-01", amount: 20, duration: 1, probabilityPct: 40 }];
  const result = E13.weightedForecastWithUncertainEvents(forecast, events);
  assert.equal(result.rows[0].eventOutflow, 0);
  assert.equal(result.rows[0].eventIncome, 0);
});

test("weightedForecastWithUncertainEvents · uncertainEvents solo lista los eventos de caja con probabilidad declarada", () => {
  const forecast = buildForecast();
  const events = [
    { id: "e1", type: "expense", monthKey: "2026-01", amount: 500, probabilityPct: 30 },
    { id: "e2", type: "expense", monthKey: "2026-02", amount: 200 }, // sin probabilidad declarada
    { id: "e3", type: "market-crash", monthKey: "2026-01", amount: 10, probabilityPct: 50 }, // de patrimonio
  ];
  const result = E13.weightedForecastWithUncertainEvents(forecast, events);
  assert.equal(result.uncertainEvents.length, 1);
  assert.equal(result.uncertainEvents[0].id, "e1");
  assert.equal(result.uncertainEvents[0].probabilityPct, 30);
});

test("weightedForecastWithUncertainEvents está exportado", () => {
  assert.equal(typeof E13.weightedForecastWithUncertainEvents, "function");
});

// --- Wiring ---

test("wiring: el formulario de eventos del Laboratorio tiene el campo de probabilidad", () => {
  assert.match(indexSource, /id="e13EventProbabilityPct"/);
});

test("wiring: addE13ScenarioEvent guarda la probabilidad declarada en el evento", () => {
  const start = appSource.indexOf("function addE13ScenarioEvent(");
  assert.ok(start >= 0, "No existe addE13ScenarioEvent");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /e13EventProbabilityPct/);
  assert.match(block, /probabilityPct/);
});

test("wiring: renderE13ScenarioLab pinta la fila ponderada en la comparación principal (permanente, no solo en avanzado)", () => {
  const start = appSource.indexOf("function renderE13ScenarioLab(");
  const block = appSource.slice(start, start + 4500);
  assert.match(block, /weightedForecastWithUncertainEvents\(/);
  assert.match(block, /e13ScenarioComparison|comparison\.innerHTML/);
});

test("wiring: el detalle de PVC10 (desglose por evento) vive en su propio contenedor dentro del Laboratorio", () => {
  assert.match(indexSource, /id="pvc10WeightedDetail"/);
  const start = appSource.indexOf("function renderE13ScenarioLab(");
  const block = appSource.slice(start, start + 4500);
  assert.match(block, /pvc10WeightedDetail/);
});
