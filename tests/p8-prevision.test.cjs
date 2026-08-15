const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// P-8 (Previsión mes a mes por bloque, mockup 2c). El catálogo de mockups daba esta pantalla por
// migrada (E19-5) cuando en realidad #prevision seguía siendo la tabla resumen anual heredada — ver
// docs/E19_SISTEMA_DISENO.md §13. Estas pruebas cubren el motor nuevo: horizonte, titular, banda,
// tabla mensual y panel día a día (movimientos reales cuando existen, partidas fechadas si no).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const stubMoney = (value) => `€${Math.round((Number(value) || 0) * 100) / 100}`;
const stubEscapeHtml = (value) => String(value ?? "");
const stubRound2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

// --- previsionHorizonRows -------------------------------------------------------------------

test("P-8 · previsionHorizonRows recorta a 12/24/48 meses abiertos y no recorta en «full»", () => {
  const openMonths = Array.from({ length: 60 }, (_, i) => ({ index: i, key: `m${i}`, label: `mes ${i}` }));
  const context = sandboxWith(["previsionHorizonRows"], {
    PREVISION_HORIZONS: {
      "12m": { label: "12 meses", months: 12 },
      "24m": { label: "24 meses", months: 24 },
      "48m": { label: "48 meses", months: 48 },
      full: { label: "Hasta 2036", months: Infinity },
    },
    openForecastMonths: () => openMonths,
    previsionRowsForMonths: (months) => months,
  });
  assert.equal(context.previsionHorizonRows("12m").length, 12);
  assert.equal(context.previsionHorizonRows("24m").length, 24);
  assert.equal(context.previsionHorizonRows("48m").length, 48);
  assert.equal(context.previsionHorizonRows("full").length, 60);
  // Horizonte desconocido cae a 12m en vez de romper.
  assert.equal(context.previsionHorizonRows("bogus").length, 12);
});

// --- previsionWorstOf / previsionHeadlineHtml -----------------------------------------------

function fakeMetric(monthLabel, key, min, minDateLabel = `1 ${monthLabel}`) {
  return { item: { row: { month: monthLabel, detailMonthKey: key } }, metric: { min, minDateLabel } };
}

test("P-8 · previsionWorstOf elige el mes con el mínimo más bajo", () => {
  const context = sandboxWith(["previsionWorstOf"]);
  const metrics = [fakeMetric("ago 26", "2026-08", 500), fakeMetric("sep 26", "2026-09", 120), fakeMetric("oct 26", "2026-10", 900)];
  const worst = context.previsionWorstOf(metrics);
  assert.equal(worst.item.row.month, "sep 26");
});

test("P-8 · previsionHeadlineHtml dice que el resto aguanta cuando no hay más meses ajustados", () => {
  const context = sandboxWith(["previsionHeadlineHtml", "previsionWorstOf"], {
    mapaCalorTone: (value) => (value < 0 ? "is-negative" : value < 1000 ? "is-tight" : "is-good"),
    money: stubMoney,
  });
  const metrics = [fakeMetric("ago 26", "2026-08", 5000), fakeMetric("sep 26", "2026-09", 300), fakeMetric("oct 26", "2026-10", 6000)];
  const headline = context.previsionHeadlineHtml(metrics, { value: 1000, source: "la reserva operativa" });
  assert.equal(headline.title, "El punto delicado es sep 26");
  assert.match(headline.subtitle, /aguanta por encima de la reserva operativa/);
  assert.equal(headline.worstKey, "2026-09");
});

test("P-8 · previsionHeadlineHtml avisa de otros meses ajustados en vez de fingir que solo hay uno", () => {
  const context = sandboxWith(["previsionHeadlineHtml", "previsionWorstOf"], {
    mapaCalorTone: (value) => (value < 0 ? "is-negative" : value < 1000 ? "is-tight" : "is-good"),
    money: stubMoney,
  });
  const metrics = [fakeMetric("ago 26", "2026-08", 200), fakeMetric("sep 26", "2026-09", 50), fakeMetric("oct 26", "2026-10", 6000)];
  const headline = context.previsionHeadlineHtml(metrics, { value: 1000, source: "la reserva operativa" });
  assert.match(headline.subtitle, /Hay otros 1 mes ajustado/);
});

test("P-8 · previsionHeadlineHtml sin meses en el horizonte no rompe", () => {
  const context = sandboxWith(["previsionHeadlineHtml", "previsionWorstOf"], { mapaCalorTone: () => "is-good", money: stubMoney });
  const headline = context.previsionHeadlineHtml([], { value: 0, source: "" });
  assert.equal(headline.title, "Sin meses abiertos en este horizonte");
  assert.equal(headline.worstKey, "");
});

// --- previsionMonthlyRow ---------------------------------------------------------------------

test("P-8 · previsionMonthlyRow separa Gastos (con coche y proyectos) de Deuda (refi)", () => {
  const context = sandboxWith(["previsionMonthlyRow", "previsionMetric"], { money: stubMoney, escapeHtml: stubEscapeHtml });
  const item = {
    row: {
      month: "ago 26",
      detailMonthKey: "2026-08",
      income: 3000,
      coreSpend: 1200,
      car: 300,
      projectOutflow: 100,
      refi: 450,
      saving: 500,
      startLiquidity: 4000,
      outflowsBeforeSaving: 2050,
      endOfMonthOutflows: 0,
    },
  };
  const row = context.previsionMonthlyRow(item, "2026-09");
  assert.match(row, /€1600/); // gastos = coreSpend(1200) + car(300) + projectOutflow(100)
  assert.match(row, /€450/); // deuda = refi
  assert.match(row, /€500/); // ahorro = saving
  assert.doesNotMatch(row, /is-selected/);
  assert.match(row, /data-prevision-month-key="2026-08"/);
});

test("P-8 · previsionMonthlyRow marca la fila seleccionada y el mínimo negativo", () => {
  const context = sandboxWith(["previsionMonthlyRow", "previsionMetric"], { money: stubMoney, escapeHtml: stubEscapeHtml });
  const item = {
    row: {
      month: "sep 26",
      detailMonthKey: "2026-09",
      income: 3000,
      coreSpend: 2000,
      car: 0,
      projectOutflow: 0,
      refi: 200,
      saving: 0,
      startLiquidity: 500,
      outflowsBeforeSaving: 2200,
      endOfMonthOutflows: 0,
    },
  };
  const row = context.previsionMonthlyRow(item, "2026-09");
  assert.match(row, /class="is-selected"/);
  assert.match(row, /<td class="negative">€-1700<\/td>/); // mínimo antes de ingresos: 500 - 2200
});

// --- previsionBandHtml ------------------------------------------------------------------------

test("P-8 · previsionBandHtml sitúa la línea de reserva y aplica el tono de cada mes", () => {
  const context = sandboxWith(["previsionBandHtml"], {
    mapaCalorTone: (value, floor) => (value < 0 ? "is-negative" : value < floor ? "is-tight" : "is-good"),
    money: stubMoney,
    escapeHtml: stubEscapeHtml,
  });
  const metrics = [
    { item: { row: { month: "ago 26", detailMonthKey: "2026-08" } }, metric: { min: -100, max: 2000 } },
    { item: { row: { month: "sep 26", detailMonthKey: "2026-09" } }, metric: { min: 500, max: 3000 } },
  ];
  const htmlOut = context.previsionBandHtml(metrics, { value: 1000, source: "la reserva" }, "2026-09");
  assert.match(htmlOut, /prevision-band-reserve-line/);
  assert.match(htmlOut, /is-negative/);
  assert.match(htmlOut, /is-tight/);
  assert.match(htmlOut, /is-selected/);
});

test("P-8 · previsionBandHtml con horizonte vacío no rompe", () => {
  const context = sandboxWith(["previsionBandHtml"], { mapaCalorTone: () => "is-good", money: stubMoney, escapeHtml: stubEscapeHtml });
  assert.equal(context.previsionBandHtml([], { value: 0, source: "" }, ""), "");
});

// --- previsionRealTransactionsForMonth ---------------------------------------------------------

test("P-8 · previsionRealTransactionsForMonth filtra por mes y ordena por fecha", () => {
  const context = sandboxWith(["previsionRealTransactionsForMonth"], {
    baseData: {
      transactions: [
        { date: "2026-08-15", month: "2026-08", movement: "B", amount: -10 },
        { date: "2026-08-02", month: "2026-08", movement: "A", amount: 1500 },
        { date: "2026-09-01", month: "2026-09", movement: "C", amount: -20 },
      ],
    },
  });
  const rows = context.previsionRealTransactionsForMonth("2026-08");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].movement, "A");
  assert.equal(rows[1].movement, "B");
});

// --- previsionProjectedEntriesForItem -----------------------------------------------------------

test("P-8 · previsionProjectedEntriesForItem combina cobros y pagos fechados con saldo corriente simulado", () => {
  const context = sandboxWith(["previsionProjectedEntriesForItem"], {
    round2: stubRound2,
    addMonths: () => new Date(2026, 8, 1),
    modelStartDate: () => new Date(2026, 7, 1),
    planningBreakdownForForecastMonth: () => ({
      expenseEvents: [{ concept: "Hipoteca", amount: 800, day: 5, date: "2026-09-05", dateLabel: "5 sep" }],
    }),
  });
  const item = {
    index: 1,
    row: {
      startLiquidity: 1000,
      incomeEvents: [{ concept: "Nómina", amount: 2000, day: 25, date: "2026-09-25", dateLabel: "25 sep" }],
    },
  };
  const entries = context.previsionProjectedEntriesForItem(item);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].concept, "Hipoteca");
  assert.equal(entries[0].amount, -800);
  assert.equal(entries[0].balanceAfter, 200);
  assert.equal(entries[1].concept, "Nómina");
  assert.equal(entries[1].balanceAfter, 2200);
});

// --- previsionDayEntries -------------------------------------------------------------------------

test("P-8 · previsionDayEntries usa movimientos reales cuando el mes ya los tiene", () => {
  const context = sandboxWith(["previsionDayEntries", "previsionRealTransactionsForMonth", "previsionProjectedEntriesForItem"], {
    shortDate: (value) => `corto:${value}`,
    baseData: { transactions: [{ date: "2026-08-03", month: "2026-08", movement: "Mercadona", amount: -45, balance: 955 }] },
  });
  const result = context.previsionDayEntries({ row: { detailMonthKey: "2026-08" } });
  assert.equal(result.kind, "real");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].balanceAfter, 955);
});

test("P-8 · previsionDayEntries cae a partidas proyectadas cuando el mes no tiene movimientos reales", () => {
  const context = sandboxWith(["previsionDayEntries", "previsionRealTransactionsForMonth", "previsionProjectedEntriesForItem"], {
    shortDate: (value) => `corto:${value}`,
    baseData: { transactions: [] },
    round2: stubRound2,
    addMonths: () => new Date(2026, 10, 1),
    modelStartDate: () => new Date(2026, 7, 1),
    planningBreakdownForForecastMonth: () => ({ expenseEvents: [] }),
  });
  const result = context.previsionDayEntries({ index: 3, row: { detailMonthKey: "2026-11", startLiquidity: 100, incomeEvents: [] } });
  assert.equal(result.kind, "projected");
  assert.equal(result.entries.length, 0);
});

// --- previsionSuggestion ---------------------------------------------------------------------

test("P-8 · previsionSuggestion propone mover el gasto más grande antes del mínimo si mejora el mes", () => {
  const context = sandboxWith(["previsionSuggestion"], { round2: stubRound2 });
  const item = { row: { startLiquidity: 1000 } };
  // día 1: -900 (matrícula) -> 100; día 15: -50 -> 50 (mínimo); día 25: +2000 (nómina) -> 2050
  const dayResult = {
    kind: "projected",
    entries: [
      { day: 1, date: "2026-09-01", dateLabel: "1 sep", concept: "Matrícula", amount: -900, kind: "expense", balanceAfter: 100 },
      { day: 15, date: "2026-09-15", dateLabel: "15 sep", concept: "Suscripciones", amount: -50, kind: "expense", balanceAfter: 50 },
      { day: 25, date: "2026-09-25", dateLabel: "25 sep", concept: "Nómina", amount: 2000, kind: "income", balanceAfter: 2050 },
    ],
  };
  const suggestion = context.previsionSuggestion(item, dayResult);
  assert.ok(suggestion);
  assert.equal(suggestion.concept, "Matrícula");
  assert.equal(suggestion.toDateLabel, "25 sep");
  // Sin la matrícula antes del mínimo, el mínimo pasa a ser -50 (día 15): 1000-50=950
  assert.equal(suggestion.newMin, 950);
});

test("P-8 · previsionSuggestion no propone nada si no hay un cobro posterior en el mes", () => {
  const context = sandboxWith(["previsionSuggestion"], { round2: stubRound2 });
  const item = { row: { startLiquidity: 1000 } };
  const dayResult = {
    kind: "projected",
    entries: [
      { day: 1, date: "2026-09-01", dateLabel: "1 sep", concept: "Nómina", amount: 2000, kind: "income", balanceAfter: 3000 },
      { day: 20, date: "2026-09-20", dateLabel: "20 sep", concept: "Matrícula", amount: -900, kind: "expense", balanceAfter: 2100 },
    ],
  };
  assert.equal(context.previsionSuggestion(item, dayResult), null);
});

test("P-8 · previsionSuggestion no se ofrece sobre movimientos reales (mes ya cerrado)", () => {
  const context = sandboxWith(["previsionSuggestion"], { round2: stubRound2 });
  const dayResult = { kind: "real", entries: [{ day: 1, amount: -10, kind: "expense", balanceAfter: 990 }] };
  assert.equal(context.previsionSuggestion({ row: { startLiquidity: 1000 } }, dayResult), null);
});

// --- HTML: la pantalla nueva reemplaza a la tabla anual heredada -----------------------------

test("P-8 · index.html declara el titular, el selector de horizonte, la banda, la tabla mensual y el panel día a día", () => {
  assert.match(html, /id="previsionHeadline"/);
  assert.match(html, /id="previsionSubheadline"/);
  assert.match(html, /data-prevision-horizon="12m"/);
  assert.match(html, /data-prevision-horizon="24m"/);
  assert.match(html, /data-prevision-horizon="48m"/);
  assert.match(html, /data-prevision-horizon="full"/);
  assert.match(html, /id="previsionBand"/);
  assert.match(html, /id="previsionMonthlyTable"/);
  assert.match(html, /id="previsionDayPanel"/);
});

test("P-8 · index.html ya no declara la tabla anual heredada (previsionYear/previsionSummary/previsionTable)", () => {
  assert.doesNotMatch(html, /id="previsionYear"/);
  assert.doesNotMatch(html, /id="previsionSummary"/);
  assert.doesNotMatch(html, /id="previsionTable"/);
});

test("P-8 · el saldo de cuentas (previsionBalanceSummary) se conserva, sin tocar su función de refresco", () => {
  assert.match(html, /id="previsionBalanceSummary"/);
  assert.match(app, /qs\("previsionBalanceSummary"\)/);
});
