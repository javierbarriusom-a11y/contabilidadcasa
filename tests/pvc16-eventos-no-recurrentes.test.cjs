const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const forecast = require("../canonical-forecast.js");

// PVC16 (Oleada 4, Bloque 3): complemento simétrico de detectStructuralChange (PVC3, que busca
// persistencia real) — un mes que el hogar declara explícitamente como excepcional
// (`record.nonRecurring === true`, nunca inferido) se excluye de learnFromHistory() y de
// detectStructuralChange() para que no contamine ni el sesgo aprendido ni la detección de cambio
// estructural. Reason obligatorio, marca reversible.

function record(overrides = {}) {
  return { monthKey: "2026-01", conceptId: "monthly-net", label: "Flujo mensual", planned: 1000, actual: 1200, reconciled: true, ...overrides };
}

test("learnFromHistory · un registro marcado nonRecurring queda fuera de deviations y seasonality", () => {
  const learned = forecast.learnFromHistory([
    record({ monthKey: "2026-01", actual: 1050 }),
    record({ monthKey: "2026-02", actual: 1030 }),
    record({ monthKey: "2026-03", actual: 5000, nonRecurring: true }), // avería puntual
  ]);
  assert.equal(learned.includedRecords, 2);
  assert.equal(learned.excludedNonRecurring, 1);
  assert.equal(learned.deviations[0].sampleMonths, 2);
  assert.equal(learned.deviations[0].averageDelta, 40); // (50+30)/2, el pico de 4000 no entra
});

test("learnFromHistory · sin ningún registro marcado, excludedNonRecurring es 0 (compatibilidad hacia atrás)", () => {
  const learned = forecast.learnFromHistory([record({ actual: 1050 })]);
  assert.equal(learned.excludedNonRecurring, 0);
  assert.equal(learned.includedRecords, 1);
});

test("learnFromHistory · un registro nonRecurring no reconciliado no se cuenta dos veces en excludedNonRecurring", () => {
  const learned = forecast.learnFromHistory([
    record({ actual: 1050 }),
    record({ monthKey: "2026-02", reconciled: false, nonRecurring: true }),
  ]);
  assert.equal(learned.excludedNonRecurring, 0, "solo cuenta lo marcado sobre registros ya reconciliados");
  assert.equal(learned.excludedRecords, 1);
});

test("detectStructuralChange · un mes marcado nonRecurring no participa en la ventana de persistencia", () => {
  const result = forecast.detectStructuralChange([
    record({ monthKey: "2026-06", actual: 1150 }),
    record({ monthKey: "2026-07", actual: 1200 }),
    record({ monthKey: "2026-08", actual: 9999, nonRecurring: true }), // no debe contar como tercer mes fuera de banda
  ], { requiredConsecutiveMonths: 3 });
  assert.equal(result.isStructural, false);
  assert.equal(result.reason, "insufficient-sample");
  assert.equal(result.sampleMonths, 2);
});

test("detectStructuralChange · sin registros marcados, comportamiento idéntico al de antes", () => {
  const result = forecast.detectStructuralChange([
    record({ monthKey: "2026-06", actual: 1150 }),
    record({ monthKey: "2026-07", actual: 1200 }),
    record({ monthKey: "2026-08", actual: 1180 }),
  ], { requiredConsecutiveMonths: 3 });
  assert.equal(result.isStructural, true);
});

// -------------------------------------------------------------------------------------------
// Wiring en app.js: persistencia declarada (motivo obligatorio), reconciledMonthlyNetHistory()
// propaga la marca, y la UI de Análisis de previsión (formulario + lista) actúa sobre ella.
// -------------------------------------------------------------------------------------------

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

function sandbox({ storage = {}, elements = {}, canonicalLedgerSnapshot = null, forecastSeries = [] } = {}) {
  const store = { ...storage };
  const announced = [];
  const context = {
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
    storageKey: (key) => key,
    canonicalLedgerSnapshot,
    canonicalScenarioResults: { base: { forecast: { series: forecastSeries } } },
    announceStatus: (message) => announced.push(message),
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${value}€`,
    qs: (id) => elements[id] || null,
    window: {},
    __store: store,
    __announced: announced,
  };
  vm.createContext(context);
  [
    "loadPvc16NonRecurringMonths",
    "savePvc16NonRecurringMonths",
    "markPvc16NonRecurringMonth",
    "unmarkPvc16NonRecurringMonth",
    "reconciledMonthlyNetHistory",
    "pvc16NonRecurringMarkup",
    "renderPvc16NonRecurringMonths",
    "handlePvc16MarkMonth",
    "handlePvc16UnmarkMonth",
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("markPvc16NonRecurringMonth · exige mes válido y motivo no vacío", () => {
  const ctx = sandbox();
  ctx.markPvc16NonRecurringMonth("no-es-un-mes", "motivo");
  assert.equal(Object.keys(ctx.loadPvc16NonRecurringMonths()).length, 0);
  ctx.markPvc16NonRecurringMonth("2026-03", "   ");
  assert.equal(Object.keys(ctx.loadPvc16NonRecurringMonths()).length, 0);
  ctx.markPvc16NonRecurringMonth("2026-03", "  avería del coche  ");
  const saved = ctx.loadPvc16NonRecurringMonths();
  assert.equal(saved["2026-03"].reason, "avería del coche");
  assert.ok(saved["2026-03"].markedAt);
});

test("unmarkPvc16NonRecurringMonth · quita solo el mes indicado", () => {
  const ctx = sandbox();
  ctx.markPvc16NonRecurringMonth("2026-03", "avería");
  ctx.markPvc16NonRecurringMonth("2026-04", "ingreso extra");
  ctx.unmarkPvc16NonRecurringMonth("2026-03");
  const saved = ctx.loadPvc16NonRecurringMonths();
  assert.equal(saved["2026-03"], undefined);
  assert.equal(saved["2026-04"].reason, "ingreso extra");
});

test("reconciledMonthlyNetHistory · propaga nonRecurring/nonRecurringReason solo para el mes marcado", () => {
  const canonicalLedgerSnapshot = {
    reconciliation: {
      months: [
        { monthKey: "2026-01", status: "matched", bankIncome: 3000, bankExpense: 2000 },
        { monthKey: "2026-02", status: "matched", bankIncome: 3000, bankExpense: 2500 },
      ],
    },
  };
  const ctx = sandbox({
    storage: { "pvc16-non-recurring-months": JSON.stringify({ "2026-02": { reason: "gasto puntual", markedAt: "2026-09-12T00:00:00.000Z" } }) },
    canonicalLedgerSnapshot,
    forecastSeries: [
      { monthKey: "2026-01", totals: { income: 3000, outflowsBeforeSaving: 2000 } },
      { monthKey: "2026-02", totals: { income: 3000, outflowsBeforeSaving: 2000 } },
    ],
  });
  const history = ctx.reconciledMonthlyNetHistory();
  const jan = history.find((r) => r.monthKey === "2026-01");
  const feb = history.find((r) => r.monthKey === "2026-02");
  assert.equal(jan.nonRecurring, false);
  assert.equal(jan.nonRecurringReason, "");
  assert.equal(feb.nonRecurring, true);
  assert.equal(feb.nonRecurringReason, "gasto puntual");
});

test("handlePvc16MarkMonth · sin mes o sin motivo, avisa y no guarda nada", () => {
  const select = { value: "" };
  const reason = { value: "" };
  const ctx = sandbox({ elements: { pvc16MonthSelect: select, pvc16Reason: reason } });
  ctx.handlePvc16MarkMonth();
  assert.equal(Object.keys(ctx.loadPvc16NonRecurringMonths()).length, 0);
  assert.equal(ctx.__announced.length, 1);
});

test("wiring: renderPvc16NonRecurringMonths se llama junto a renderPvx1Backtest en el ciclo de render", () => {
  assert.match(appSource, /renderPvx1Backtest\(\);\s*\n\s*renderPvc16NonRecurringMonths\(\);/);
});

test("wiring: los botones de marcar/desmarcar están conectados a sus handlers", () => {
  assert.match(appSource, /qs\("pvc16MarkMonth"\)\?\.addEventListener\("click", handlePvc16MarkMonth\)/);
  assert.match(appSource, /data-pvc16-unmark/);
});
