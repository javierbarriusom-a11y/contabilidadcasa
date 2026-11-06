const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Contract = require("../canonical-forecast-contract.js");

// FX-01 / FX-02 / FX-04 (BACKLOG_NOVIEMBRE_OLEADA_1.md §5.1; porqué en docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §5):
// el contrato de las cifras de previsión. Primera entrega: el punto más bajo desde hoy con el motor diario, la precisión según el
// horizonte y el vocabulario de la incertidumbre.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const row = (date, total) => ({ date, monthKey: date.slice(0, 7), total });

test("FX-04 · precisión según el horizonte: decena hasta 30 días, centena hasta un año, millar después; nunca céntimos", () => {
  assert.equal(Contract.roundingStep(0), 10);
  assert.equal(Contract.roundingStep(29), 10);
  assert.equal(Contract.roundingStep(30), 100);
  assert.equal(Contract.roundingStep(365), 100);
  assert.equal(Contract.roundingStep(366), 1000);
  assert.equal(Contract.roundForHorizon(9612.69, 3), 9610);
  assert.equal(Contract.roundForHorizon(9650, 120), 9700);
  assert.equal(Contract.roundForHorizon(15088.7, 800), 15000);
  assert.equal(Contract.roundForHorizon(-4, 3), 0, "sin −0");
  assert.equal(Contract.isApproximate(10080, 0), false);
  assert.equal(Contract.isApproximate(10084, 0), true);
});

test("FX-02 · el punto más bajo cuenta desde hoy, con empate el primer día, y por mes solo desde hoy", () => {
  const rows = [row("2026-11-01", 4000), row("2026-11-05", 10080), row("2026-11-06", 10080), row("2026-11-08", 10350), row("2026-12-01", 9000), row("2027-01-02", 13020)];
  assert.deepEqual(Contract.lowPoint(rows, { from: "2026-11-05", to: "2026-11-30" }), { date: "2026-11-05", monthKey: "2026-11", value: 10080 });
  assert.equal(Contract.lowPoint(rows, { from: "2026-11-05" }).date, "2026-12-01");
  assert.equal(Contract.lowPoint([], {}), null);
  const lows = Contract.monthLows(rows, { today: "2026-11-05", monthKeys: ["2026-11", "2026-12"] });
  assert.equal(lows.get("2026-11").value, 10080, "el 1/11 (4.000 €) ya pasó y no cuenta");
  assert.equal(lows.get("2026-12").date, "2026-12-01");
  assert.equal(lows.has("2027-01"), false, "solo los meses pedidos");
});

test("FX-02 · cómo se dice: hoy, con día hasta 90 días y el mes después", () => {
  const today = "2026-11-05";
  assert.equal(Contract.describeLow({ date: "2026-11-05", monthKey: "2026-11", value: 10080 }, { today }).when, "hoy");
  const cerca = Contract.describeLow({ date: "2026-12-05", monthKey: "2026-12", value: 7087.74 }, { today });
  assert.equal(cerca.when, "el 5 dic");
  assert.equal(cerca.value, 7100);
  assert.equal(cerca.approximate, true);
  assert.equal(Contract.describeLow({ date: "2027-01-10", monthKey: "2027-01", value: 1 }, { today }).when, "el 10 ene 2027", "otro año, con el año");
  const lejos = Contract.describeLow({ date: "2027-03-14", monthKey: "2027-03", value: 13560 }, { today, monthLabel: () => "mar 27" });
  assert.equal(lejos.withDay, false);
  assert.equal(lejos.when, "en mar 27");
  assert.equal(Contract.describeLow(null, { today }), null);
});

test("FX-01 · cada cifra de previsión se declara una vez, con etiqueta única, unidad, motor y definición", () => {
  const ids = Contract.METRICS.map((metric) => metric.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(Contract.METRICS.map((metric) => metric.label)).size, ids.length, "una etiqueta, una cifra");
  Contract.METRICS.forEach((metric) => ["label", "unit", "engine", "definition"].forEach((field) => assert.ok(metric[field], `${metric.id}.${field}`)));
  assert.ok(Object.isFrozen(Contract.METRICS) && Object.isFrozen(Contract.TERMS));
});

test("FX-30 · Previsión no enseña percentiles ni «trayectorias» en la banda de caja", () => {
  const ui = read("cash-band-ui.js");
  assert.doesNotMatch(ui, /<li>Mediana \(P50\)<\/li>|Banda P10-P90<\/li>|"P10", "P50", "P90"/);
  assert.match(ui, /Rango probable \(8 de cada 10 casos\)/);
  const band = read("canonical-cash-band.js");
  assert.doesNotMatch(band, /trayectorias simuladas la liquidez/);
});

test("FX-04 · la banda de caja no pinta céntimos (money sin precisión)", () => {
  const ui = read("cash-band-ui.js");
  assert.doesNotMatch(ui, /money\([^)]*, true\)/);
});

test("el contrato está registrado en index.html (antes de app.js), el service worker y el sitio público", () => {
  const html = read("index.html");
  const at = html.indexOf("canonical-forecast-contract.js?v=");
  assert.ok(at > 0 && at < html.indexOf('src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-forecast-contract\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-forecast-contract\.js",/);
});

test("FX-62 · Previsión y Escenarios se miden en el medidor de utilidad (vista al pintar, acción al elegir o simular)", () => {
  const medidor = require("../medidor-utilidad.js");
  const ids = medidor.FUNCIONES.map((f) => f.id);
  assert.ok(ids.includes("prevision") && ids.includes("escenarios"));
  const store = medidor.registrar(medidor.registrar({}, "prevision", "vista", { hoy: "2026-11-06" }), "prevision", "accion", { hoy: "2026-11-06" });
  assert.equal(medidor.frase("prevision", medidor.resumen(store, "prevision", "2026-11")), "vista 1 día · 1 horizonte, mes o periodo elegido (actuasteis el 100 % de los días)");
  const app = read("app.js");
  assert.match(app, /FinanceMedidor\?\.anotar\("prevision", "vista"\)/);
  assert.match(app, /FinanceMedidor\?\.anotar\("prevision", "accion"\)/);
  const escenarios = read("views/escenarios.js");
  assert.match(escenarios, /FinanceMedidor\?\.anotar\("escenarios", "vista"\)/);
  assert.equal((escenarios.match(/FinanceMedidor\?\.anotar\("escenarios", "accion"\)/g) || []).length, 3, "decisión añadida, aviso guardado y escenario guardado");
});

test("FX-51 · lo que mueve cada supuesto: se recalcula con el mismo motor en su sentido desfavorable y se ordena por efecto", () => {
  const calls = [];
  const run = (input) => {
    calls.push(input.policy);
    const p = input.policy;
    const end = 5000 - 1000 * p.annualInflation + 800 * p.annualIncomeGrowth - 4000 * (p.expenseFactor - 1) + 6000 * (p.incomeFactor - 1);
    return { rows: [{ detailMonthKey: "2027-12", totalLiquidity: 1000 - 100 * p.annualInflation }, { detailMonthKey: "2036-12", totalLiquidity: end }] };
  };
  const input = { policy: { annualInflation: 2, annualIncomeGrowth: 1, expenseFactor: 1, incomeFactor: 1, plannedMonthlySaving: 800 } };
  const impacts = Contract.assumptionImpacts(run, input, { targets: ["2027-12", "2036-12"] });
  assert.equal(calls.length, 5, "el plan y uno por supuesto");
  assert.deepEqual(input.policy, { annualInflation: 2, annualIncomeGrowth: 1, expenseFactor: 1, incomeFactor: 1, plannedMonthlySaving: 800 }, "no toca la entrada");
  assert.deepEqual(impacts.map((i) => i.id), ["annualInflation", "annualIncomeGrowth", "incomeFactor", "expenseFactor"]);
  const inflation = impacts[0];
  assert.equal(calls[1].annualInflation, 3, "un punto más sobre el valor de hoy");
  assert.deepEqual(inflation.effects.map((e) => Math.round(e.diff)), [-100, -1000]);
  assert.equal(Contract.assumptionImpacts(null, input).length, 0);
  assert.equal(Contract.assumptionImpacts(run, {}).length, 0);
});

test("FX-04 para diferencias: dos cifras significativas, nunca menos de la decena", () => {
  assert.deepEqual([322, 26907, 4012, -31234, 7, 0, 95].map(Contract.roundDifference), [320, 27000, 4000, -31000, 10, 0, 100]);
});

test("FX-51 · el registro de supuestos lee los factores sin tocar como ×1 (antes «×0») y Ajustes dice lo que mueve cada uno", () => {
  const app = read("app.js");
  assert.match(app, /incomeFactor: state\?\.incomeFactor \?\? 1/);
  assert.match(app, /expenseFactor: state\?\.expenseFactor \?\? 1/);
  assert.match(app, /const impacts = assumptionImpactNotes\(\);/);
  assert.match(app, /contract\.assumptionImpacts\(\(input\) => engine\.buildScenario\(input, null, \{ reason: "fx51-supuestos" \}\), canonicalEngineInput\(\[\], \{\}\), \{ targets \}\)/);
});
