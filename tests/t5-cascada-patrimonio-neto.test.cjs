const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const assetsEngine = require("../canonical-assets.js");

// T5 (Horizonte 2): serie histórica y banda de confianza para el patrimonio neto (A14-2), como
// cascada mensual reconstruida hacia atrás desde el único punto exacto (hoy) con el flujo de caja
// real ya conciliado con el banco. No inventa una serie de valoraciones históricas de activos — ese
// hueco de datos real es I2, deliberadamente fuera de esta tarea.

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

// --- Parte A: netWorthWaterfall() (canonical-assets.js) --------------------------------------

test("netWorthWaterfall · sin patrimonio de hoy conocido, no calculable", () => {
  assert.equal(assetsEngine.netWorthWaterfall({}).calculable, false);
  assert.equal(assetsEngine.netWorthWaterfall({ monthlyNetFlowHistory: [{ monthKey: "2026-01", netFlow: 100 }] }).calculable, false);
});

test("netWorthWaterfall · sin ningún mes conciliado, no calculable pero devuelve el patrimonio de hoy", () => {
  const result = assetsEngine.netWorthWaterfall({ todayNetWorth: 50000, monthlyNetFlowHistory: [] });
  assert.equal(result.calculable, false);
  assert.equal(result.todayNetWorth, 50000);
});

test("netWorthWaterfall · ignora registros sin monthKey o sin flujo numérico, sin romper el cálculo", () => {
  const result = assetsEngine.netWorthWaterfall({
    todayNetWorth: 1000,
    monthlyNetFlowHistory: [{ monthKey: "2026-01", netFlow: 100 }, { netFlow: 50 }, { monthKey: "2026-02" }],
  });
  assert.equal(result.calculable, true);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].monthKey, "2026-01");
});

test("netWorthWaterfall · reconstrucción hacia atrás encadenada: cada paso resta su flujo real del nivel siguiente", () => {
  const result = assetsEngine.netWorthWaterfall({
    todayNetWorth: 10300,
    monthlyNetFlowHistory: [
      { monthKey: "2026-02", netFlow: 200 },
      { monthKey: "2026-01", netFlow: 100 },
    ],
  });
  assert.equal(result.calculable, true);
  assert.equal(result.steps.length, 2);
  // Orden cronológico ascendente.
  assert.deepEqual(result.steps.map((step) => step.monthKey), ["2026-01", "2026-02"]);
  // El mes más reciente (2026-02) ancla en el patrimonio de hoy.
  assert.equal(result.steps[1].endNetWorth, 10300);
  assert.equal(result.steps[1].startNetWorth, 10100);
  // Encadenado: el inicio de 2026-02 es el final de 2026-01.
  assert.equal(result.steps[0].endNetWorth, result.steps[1].startNetWorth);
  assert.equal(result.steps[0].startNetWorth, 10000);
});

test("netWorthWaterfall · la banda crece cuanto más atrás en el tiempo, y es 0 solo cuando no hay meses", () => {
  const result = assetsEngine.netWorthWaterfall({
    todayNetWorth: 10000,
    monthlyNetFlowHistory: Array.from({ length: 6 }, (_, i) => ({ monthKey: `2025-0${i + 1}`, netFlow: 50 })),
  });
  assert.equal(result.calculable, true);
  const bands = result.steps.map((step) => step.band);
  // Orden ascendente cronológico → el primero (más antiguo) tiene la banda más ancha.
  for (let i = 1; i < bands.length; i += 1) {
    assert.ok(bands[i - 1] >= bands[i], `banda(${i - 1})=${bands[i - 1]} debería ser >= banda(${i})=${bands[i]}`);
  }
  assert.ok(bands[bands.length - 1] > 0);
});

test("netWorthWaterfall · la banda nunca supera el tope declarado, incluso con histórico muy largo", () => {
  const result = assetsEngine.netWorthWaterfall({
    todayNetWorth: 10000,
    monthlyNetFlowHistory: Array.from({ length: 60 }, (_, i) => ({ monthKey: `2020-${String((i % 12) + 1).padStart(2, "0")}-${i}`, netFlow: 10 })),
  });
  const maxBandPct = assetsEngine.NET_WORTH_WATERFALL_BAND_PCT_MAX;
  result.steps.forEach((step) => {
    assert.ok(step.band <= Math.abs(step.startNetWorth) * maxBandPct + 0.01, `banda ${step.band} supera el tope en ${step.monthKey}`);
  });
});

test("netWorthWaterfall · reordena un histórico desordenado antes de reconstruir", () => {
  const ordered = assetsEngine.netWorthWaterfall({
    todayNetWorth: 300,
    monthlyNetFlowHistory: [{ monthKey: "2026-01", netFlow: 100 }, { monthKey: "2026-02", netFlow: 50 }],
  });
  const shuffled = assetsEngine.netWorthWaterfall({
    todayNetWorth: 300,
    monthlyNetFlowHistory: [{ monthKey: "2026-02", netFlow: 50 }, { monthKey: "2026-01", netFlow: 100 }],
  });
  assert.deepEqual(shuffled.steps, ordered.steps);
});

test("netWorthWaterfall está exportado junto a las constantes de la banda", () => {
  assert.equal(typeof assetsEngine.netWorthWaterfall, "function");
  assert.equal(typeof assetsEngine.NET_WORTH_WATERFALL_BAND_PCT_PER_MONTH, "number");
  assert.equal(typeof assetsEngine.NET_WORTH_WATERFALL_BAND_PCT_MAX, "number");
});

// --- Parte B: cableado en app.js ---------------------------------------------------------------

test("a14NetWorthToday() centraliza normalizeAssets/totalDebtOutstanding, sin duplicarlo en el render de la cascada", () => {
  const helper = extractFunction("a14NetWorthToday");
  assert.match(helper, /engine\.normalizeAssets\(rows\)/);
  assert.match(helper, /totalDebtOutstanding\(\)/);

  const waterfall = extractFunction("renderA14NetWorthWaterfall");
  assert.doesNotMatch(waterfall, /normalizeAssets\(/);
  assert.doesNotMatch(waterfall, /totalDebtOutstanding\(/);
  assert.match(waterfall, /today\.netWorthAfterDebt/);
});

test("renderA14AssetBreakdown llama a renderA14NetWorthWaterfall en ambas ramas (con y sin activos)", () => {
  const source = extractFunction("renderA14AssetBreakdown");
  const calls = source.match(/renderA14NetWorthWaterfall\(today\)/g) || [];
  assert.equal(calls.length, 2, "debe llamarse una vez sin activos y otra vez con el desglose ya pintado");
});

test("renderA14NetWorthWaterfall reutiliza reconciledMonthlyNetHistory() y el motor canónico, sin recalcular el histórico aparte", () => {
  const source = extractFunction("renderA14NetWorthWaterfall");
  assert.match(source, /reconciledMonthlyNetHistory\(\)\.map/);
  assert.match(source, /engine\.netWorthWaterfall\(\{\s*todayNetWorth: today\.netWorthAfterDebt/);
});

test("renderA14NetWorthWaterfall oculta el gráfico (nunca lo deja vacío) sin activos, sin motor o sin meses conciliados", () => {
  const source = extractFunction("renderA14NetWorthWaterfall");
  const hiddenAssignments = source.match(/svg\.hidden = true/g) || [];
  assert.ok(hiddenAssignments.length >= 2, "debe ocultar el svg tanto sin patrimonio calculable como sin meses conciliados");
  assert.match(source, /svg\.hidden = false/);
});

test("index.html declara el svg de la cascada oculto por defecto, accesible con aria-label", () => {
  const html = read("index.html");
  assert.match(html, /<svg id="a14NetWorthWaterfallChart" role="img" aria-label="[^"]+" hidden><\/svg>/);
  assert.match(html, /<p class="e19-kpi-note" id="a14NetWorthWaterfallLegend"><\/p>/);
});
