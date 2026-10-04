const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-08 (ND-03): día de cargo por partida. El hogar indica una vez qué día se cobra cada gasto (o «fin de
// mes») y la previsión lo usa todos los meses. Precedencia: movimiento real casado en ese mes (lo que pasó)
// > día indicado > regla de fin de mes > estimación (día 8). Sin día indicado, el motor es el de WP-07 byte
// a byte (oro de 493 casos). Se guarda en el almacén `charge-days`, que viaja con la copia y la nube.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const chargeDays = require("../canonical-charge-days.js");
const golden = require("./fixtures/ntc1-timing-golden.json");
const { buildTransactions } = require("./fixtures/ntc1-timing-transactions.cjs");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

// Utilidades reales de app.js y el motor de fechas en el mismo contexto (como en ntc1-motor-fechas).
function loadEngine(transactions, declared = {}) {
  const sandbox = { transactionsForTest: transactions, declaredForTest: declared };
  vm.createContext(sandbox);
  vm.runInContext([
    block("function dateFromMonthKey", "function defaultBalanceDate"),
    block("function normalizedText", "function isCarPlanningRow"),
    "function displayLabelForRow(row) { return row.label; }",
    read("canonical-timing.js"),
    "this.engine = FinanceCanonicalTiming.createTimingEngine({ displayLabelForRow, normalizedText, dateFromMonthKey, monthEndDate, lastBusinessDayOfMonth, isoLocalDate, localDateFromIso, shortDate, dateWithMonthLabel, transactions: () => transactionsForTest, chargeDay: (row) => declaredForTest[row.label] || null });",
  ].join("\n"), sandbox);
  return sandbox.engine;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("sin días indicados, el motor reproduce el oro de WP-07 campo a campo (también con chargeDay conectado)", () => {
  const engines = { "sin movimientos": loadEngine([]), "con movimientos": loadEngine(buildTransactions()) };
  for (const item of golden.cases) {
    assert.deepEqual(plain(engines[item.scenario][item.fn](...item.args)), item.out, `${item.fn} · ${item.scenario}`);
  }
});

test("día indicado: gana a la estimación y a la regla de fin de mes; confianza «declared»", () => {
  const engine = loadEngine([], { Gimnasio: { day: 3, source: "declarado" }, Trastero: { day: 12, source: "sugerido" } });
  const gimnasio = plain(engine.expenseTimingForRow({ label: "Gimnasio" }, { key: "2026-11" }, -30));
  assert.deepEqual(gimnasio, { day: 3, date: "2026-11-03", source: "día de cargo indicado", label: gimnasio.label, confidence: "declared", role: "" });
  const trastero = plain(engine.expenseTimingForRow({ label: "Trastero" }, { key: "2026-11" }, -60));
  assert.equal(trastero.day, 12);
  assert.equal(trastero.source, "día de cargo propuesto y aceptado");
  assert.equal(trastero.endOfMonth, undefined, "con día 12, deja de ser gasto de fin de mes");
  const sinIndicar = plain(engine.expenseTimingForRow({ label: "Seguro hogar" }, { key: "2026-11" }, -300));
  assert.deepEqual([sinIndicar.day, sinIndicar.confidence], [8, "estimated"]);
});

test("un movimiento real casado en ese mes manda sobre el día indicado (es lo que pasó)", () => {
  const engine = loadEngine([{ month: "2026-10", date: "2026-10-03", amount: -45.9, movement: "IBERDROLA LUZ", details: "", category: "" }], { "Luz Iberdrola": { day: 20, source: "declarado" } });
  const octubre = plain(engine.expenseTimingForRow({ label: "Luz Iberdrola" }, { key: "2026-10" }, -45.9));
  assert.deepEqual([octubre.day, octubre.confidence], [3, "observed"]);
  const noviembre = plain(engine.expenseTimingForRow({ label: "Luz Iberdrola" }, { key: "2026-11" }, -45.9));
  assert.deepEqual([noviembre.day, noviembre.confidence], [20, "declared"]);
});

test("«fin de mes» y día 31 en meses cortos: último día natural, y cuenta como gasto de fin de mes", () => {
  const engine = loadEngine([], { Alquiler: { day: "eom" }, Colegio: { day: 31 }, Comunidad: { day: 30 } });
  const cases = [
    ["Alquiler", "2026-02", 28, true], ["Alquiler", "2028-02", 29, true], ["Alquiler", "2026-04", 30, true], ["Alquiler", "2026-12", 31, true],
    ["Colegio", "2026-02", 28, true], ["Colegio", "2026-11", 30, true], ["Colegio", "2026-10", 31, true],
    ["Comunidad", "2026-02", 28, true], ["Comunidad", "2026-10", 30, undefined],
  ];
  for (const [label, key, day, endOfMonth] of cases) {
    const timing = plain(engine.expenseTimingForRow({ label }, { key }, -100));
    assert.equal(timing.day, day, `${label} ${key}`);
    assert.equal(timing.date, `${key}-${String(day).padStart(2, "0")}`);
    assert.equal(timing.endOfMonth, endOfMonth, `${label} ${key}`);
  }
});

test("un valor guardado que no es día ni «fin de mes» se ignora: vuelve al comportamiento automático", () => {
  const engine = loadEngine([], { Gimnasio: { day: 0 }, Trastero: { day: "32" }, Seguro: { day: "otro" } });
  assert.equal(engine.expenseTimingForRow({ label: "Gimnasio" }, { key: "2026-11" }, -30).day, 8);
  assert.equal(engine.expenseTimingForRow({ label: "Trastero" }, { key: "2026-11" }, -60).source, "regla gasto fin de mes");
  assert.equal(engine.expenseTimingForRow({ label: "Seguro" }, { key: "2026-11" }, -60).day, 8);
});

test("los ingresos no cambian aunque una partida de gasto tenga día indicado", () => {
  const engine = loadEngine([], { "Nomina Javi": { day: 3 } });
  assert.equal(engine.incomeTimingForRow({ label: "Nomina Javi" }, { key: "2026-11" }, 3000).source, "regla nómina Javi");
});

// --- almacén ---------------------------------------------------------------------------------------

test("almacén: normaliza, indica, cambia y borra; nunca guarda un día inválido", () => {
  assert.deepEqual(chargeDays.normalizeStore(null), { series: {} });
  assert.deepEqual(chargeDays.normalizeStore({ series: { "expense|a": { day: 40 }, "expense|b": { day: "eom", source: "x" }, "": { day: 3 } } }), { series: { "expense|b": { day: "eom", source: "declarado", updatedAt: "" } } });
  let store = chargeDays.setDay(null, "expense|luz", "5", { now: "2026-10-04T10:00:00Z" });
  assert.deepEqual(store, { series: { "expense|luz": { day: 5, source: "declarado", updatedAt: "2026-10-04T10:00:00Z" } } });
  store = chargeDays.setDay(store, "expense|gas", 12, { source: "sugerido", now: "t" });
  store = chargeDays.setDay(store, "expense|luz", "eom", { now: "t2" });
  assert.equal(store.series["expense|luz"].day, "eom");
  assert.equal(store.series["expense|gas"].source, "sugerido");
  store = chargeDays.setDay(store, "expense|luz", "", { now: "t3" });
  assert.deepEqual(Object.keys(store.series), ["expense|gas"], "«sin indicar» borra la entrada");
  assert.deepEqual(chargeDays.setDay(store, "expense|x", 0), store, "un día inválido no se guarda");
  assert.equal(chargeDays.resolveDay(31, 28), 28);
  assert.equal(chargeDays.resolveDay("eom", 30), 30);
  assert.equal(chargeDays.resolveDay(null, 30), null);
});

test("propuestas: el día «fiable» de WP-04 primero; si no, el último día visto en los extractos", () => {
  const result = chargeDays.suggestions(
    [
      { key: "expense|luz", month: "2026-07", day: 4 }, { key: "expense|luz", month: "2026-08", day: 5 },
      { key: "expense|gas", month: "2026-07", day: 10 }, { key: "expense|gas", month: "2026-09", day: 14 }, { key: "expense|gas", month: "2026-08", day: 12 },
      { key: "expense|agua", month: "2026-09", day: null },
    ],
    [{ key: "expense|luz", status: "fiable", day: 5, pct: 100, months: 3 }, { key: "expense|gas", status: "variable", day: 12, pct: 67, months: 3 }],
  );
  assert.deepEqual(result["expense|luz"], { day: 5, kind: "fiable", note: "fiable: el mismo día en el 100 % de 3 meses" });
  assert.deepEqual(result["expense|gas"], { day: 14, kind: "visto", note: "visto el día 14 en el extracto de 09/2026" });
  assert.equal(result["expense|agua"], undefined, "sin cargo encontrado, no se propone nada");
});

test("modelo: de mayor a menor gasto, estado de cada partida y resumen de lo que queda estimado", () => {
  const model = chargeDays.buildModel({
    rows: [
      { key: "expense|luz", label: "Luz", section: "Fijos", amount: 600 },
      { key: "expense|hipoteca", label: "Hipoteca", section: "Financiaciones", amount: 9000 },
      { key: "expense|trastero", label: "Trastero", section: "Fijos", amount: 400, rule: true },
      { key: "expense|nada", label: "Nada", amount: 0 },
    ],
    store: { series: { "expense|hipoteca": { day: 1, source: "declarado" } } },
    suggestions: { "expense|luz": { day: 5, kind: "fiable", note: "n" }, "expense|hipoteca": { day: 2, kind: "fiable", note: "n" } },
  });
  assert.deepEqual(model.items.map((item) => [item.label, item.status, item.spendPct]), [["Hipoteca", "indicado", 90], ["Luz", "estimado", 6], ["Trastero", "regla", 4]]);
  assert.equal(model.items[0].suggestion, null, "una partida ya indicada no muestra propuesta");
  assert.deepEqual(model.summary, { partidas: 3, indicated: 1, rule: 1, estimated: 1, estimatedSpendPct: 6, reliableSuggestions: 1 });
  assert.equal(chargeDays.summaryText(model), "Días de cargo: quedan 1 partida con fecha estimada (6 % del gasto)");
  assert.equal(chargeDays.summaryText(chargeDays.buildModel({ rows: [] })), "Días de cargo: no hay gasto previsto en los próximos 12 meses");
  assert.equal(chargeDays.summaryText(chargeDays.buildModel({ rows: [{ key: "k", label: "L", amount: 1, rule: true }] })), "Días de cargo: todas las partidas tienen fecha");
});

test("HTML: selector etiquetado con «sin indicar», «fin de mes» y 1-31; propuesta con botón; sin importes", () => {
  const html = chargeDays.renderHtml(chargeDays.buildModel({
    rows: [{ key: "expense|luz", label: "Luz <casa>", section: "Fijos", amount: 1234.56 }, { key: "expense|agua", label: "Agua", amount: 200 }],
    store: { series: { "expense|agua": { day: "eom" } } },
    suggestions: { "expense|luz": { day: 5, kind: "fiable", note: "fiable: el mismo día en el 100 % de 3 meses" } },
  }));
  assert.doesNotMatch(html, /1234|1\.234|200 €/);
  assert.match(html, /Luz &lt;casa&gt;/);
  assert.match(html, /<label for="cargoDiaSelect0">Día de cargo<\/label><select id="cargoDiaSelect0" data-cargo-dia="expense\|luz"><option value="" selected>Sin indicar \(automático\)<\/option><option value="eom">Fin de mes<\/option><option value="1">Día 1<\/option>/);
  assert.match(html, /<option value="31">Día 31<\/option><\/select>/);
  assert.match(html, /<select id="cargoDiaSelect1" data-cargo-dia="expense\|agua"><option value="">Sin indicar \(automático\)<\/option><option value="eom" selected>Fin de mes<\/option>/);
  assert.match(html, /data-cargo-dia-usar="expense\|luz" data-cargo-dia-valor="5" data-cargo-dia-fiable>Usar el día 5<\/button>/);
  assert.match(html, /data-cargo-dia-fiables>Aplicar las 1 propuesta fiable<\/button>/);
  assert.match(html, /Indicado: fin de mes\./);
  assert.match(html, /role="status" aria-live="polite"/);
});

test("gasto repartido (súper, gasolina): sin propuesta de día y con la advertencia de que no tiene día de cargo", () => {
  const model = chargeDays.buildModel({ rows: [{ key: "expense|var", label: "Gasto variable", amount: 900, spread: true }], suggestions: { "expense|var": { day: 17, kind: "visto", note: "visto" } } });
  assert.equal(model.items[0].suggestion, null);
  const html = chargeDays.renderHtml(model);
  assert.doesNotMatch(html, /Usar el día/);
  assert.match(html, /Se gasta a lo largo del mes, no en un día: la previsión lo pone entero en un solo día\. El día 1 es lo prudente/);
});

// --- app.js ----------------------------------------------------------------------------------------

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
}

test("app.js: las partidas de los 12 meses siguientes, sumadas por serie y sin las borradas", () => {
  const context = {
    modelStartDate: () => new Date(2026, 9, 1),
    addMonths: (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1),
    planningMonthForDate: (date) => ({ key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` }),
    planningSectionsForMonth: (kind, month) => [{ name: "Fijos", rows: [{ kind: "expense", id: "luz", label: "Luz" }].concat(month.key === "2026-10" ? [{ kind: "expense", id: "trastero", label: "Trastero" }] : []) }],
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    displayLabelForRow: (row) => row.label,
    isEndOfMonthExpenseRow: (row) => row.id === "trastero",
    isVariableOperationalRow: () => false,
    plannedValueForRow: (row) => (row.id === "luz" ? -50 : 60),
  };
  vm.runInNewContext(`${extractFunction("chargeDayRows")}\nresult = chargeDayRows();`, context);
  assert.deepEqual(plain(context.result), [
    { key: "expense|luz", label: "Luz", section: "Fijos", amount: 600, rule: false, spread: false },
    { key: "expense|trastero", label: "Trastero", section: "Fijos", amount: 60, rule: true, spread: false },
  ]);
});

test("app.js: el almacén se relee solo si cambia el texto guardado; dañado o vacío, sin días", () => {
  const storage = { "charge-days:finance": JSON.stringify({ series: { "expense|luz": { day: 5 } } }) };
  const context = { window: { FinanceCanonicalChargeDays: chargeDays }, storageGet: (key, fallback) => storage[key] ?? fallback, storageKey: (name) => `${name}:finance`, seriesKeyForRow: (row) => `${row.kind}|${row.id}`, JSON };
  vm.runInNewContext(`${block("let chargeDaysCache", "function incomeTimingForRow")}\nthis.load = loadChargeDays; this.forRow = chargeDayForRow;`, context);
  assert.equal(context.forRow({ kind: "expense", id: "luz" }).day, 5);
  assert.equal(context.load(), context.load(), "misma referencia mientras no cambia");
  storage["charge-days:finance"] = "{dañado";
  assert.deepEqual(plain(context.load()), { series: {} });
  delete storage["charge-days:finance"];
  assert.equal(context.forRow({ kind: "expense", id: "luz" }), null);
});

test("app.js: el motor recibe el día de cargo, la previsión se recalcula al cambiarlo y viaja con la copia y la nube", () => {
  assert.match(app, /transactions: \(\) => baseData\?\.transactions \|\| \[\], chargeDay: chargeDayForRow \}\)/);
  assert.match(block("function modelComputationSignature", "function recomputeModelIfNeeded"), /chargeDays: loadChargeDays\(\)\.series/);
  assert.match(block("const BACKUP_LOCAL_STORES = [", "];"), /"charge-days", \/\/ WP-08/);
  assert.match(app, /case "planificacion-partidas":\n\s+renderPlanificacionPartidas\(\);\n\s+renderChargeDays\(\);/);
  assert.match(app, /\["change", "click"\]\.forEach\(\(type\) => qs\("cargoDia"\)\?\.addEventListener\(type, handleChargeDayEvent\)\);/);
});

test("registro: tarjeta plegada en Plan › Partidas; motor antes de app.js, en la caché offline y en el sitio publicado", () => {
  const html = read("index.html");
  const partidas = html.slice(html.indexOf('id="planificacion-partidas"'), html.indexOf('id="planificacionPartidasRoot"'));
  assert.match(partidas, /<details class="e19-card prevision-calidad-card cargo-dia-card" id="cargoDiaCard">\s*<summary id="cargoDiaResumen">[^<]+<\/summary>\s*<div id="cargoDia"><\/div>\s*<\/details>/);
  const at = html.indexOf('<script defer src="canonical-charge-days.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-charge-days\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-charge-days\.js",/);
  assert.match(read("canonical-forecast-quality.js"), /href: "#planificacion-partidas"/, "el medidor de WP-10 lleva a la pantalla nueva");
});

test("el módulo es puro: sin DOM ni estado global de la app", () => {
  assert.doesNotMatch(read("canonical-charge-days.js"), /\bwindow\b|\bdocument\b|\bbaseData\b|\blocalStorage\b|\bstate\./);
});
