const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-04 (ND-03 paso 0, docs/ND03_VIABILIDAD.md): ¿se puede aprender el día de cargo de cada partida a
// partir de los movimientos importados? Solo lectura, solo recuentos y porcentajes. Criterios del plan:
// 3 meses o más con movimientos; «fiable» = mismo día ± 1 en el 80 % de esos meses; un mes sin cargo
// encontrado cuenta como fallo.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const engine = require("../canonical-charge-day-viability.js");

const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
const series = (key, days, { amount = 100, rule = false, label = key } = {}) =>
  days.map((day, index) => ({ key, label, month: months[index], amount, day, rule }));

test("día dominante a ± 1: reúne vecinos y, en empate, el más temprano", () => {
  assert.deepEqual(engine.dominantDay([5, 5, 6, 5, 20]), { day: 5, hits: 4 });
  assert.deepEqual(engine.dominantDay([1, 2, 3]), { day: 2, hits: 3 }, "1, 2 y 3 caben todos a ± 1 de 2");
  assert.deepEqual(engine.dominantDay([10, 20]), { day: 10, hits: 1 });
  assert.deepEqual(engine.dominantDay([]), { day: null, hits: 0 });
});

test("clasifica cada partida: fiable, variable, insuficiente o con regla propia", () => {
  const result = engine.analyze([
    ...series("luz", [5, 5, 6, 5, 5], { amount: 80 }),
    ...series("gimnasio", [2, 12, 22, 2, 15], { amount: 40 }),
    ...series("seguro", [10, 10], { amount: 60 }),
    ...series("parking", [30, 31, 30, 31, 30], { amount: 120, rule: true }),
  ]);
  const byKey = Object.fromEntries(result.partidas.map((partida) => [partida.key, partida]));
  assert.equal(byKey.luz.status, "fiable");
  assert.equal(byKey.luz.day, 5);
  assert.equal(byKey.luz.pct, 100);
  assert.equal(byKey.gimnasio.status, "variable");
  assert.equal(byKey.gimnasio.pct, 40);
  assert.equal(byKey.seguro.status, "insuficiente", "2 meses no bastan");
  assert.equal(byKey.parking.status, "regla", "las partidas con regla de fin de mes no se aprenden");
  assert.deepEqual(result.summary, {
    partidas: 4, withHistory: 2, reliable: 1, variable: 1, insufficient: 1, rule: 1,
    reliableSpendPct: 27, knownSpendPct: 67, verdict: "sugerir",
  });
});

test("un mes sin cargo encontrado cuenta como fallo, no se ignora", () => {
  const [partida] = engine.analyze(series("agua", [7, null, 7, null, 7])).partidas;
  assert.equal(partida.found, 3);
  assert.equal(partida.months, 5);
  assert.equal(partida.pct, 60);
  assert.equal(partida.status, "variable");
});

test("4 de 5 meses en el mismo día es fiable (80 %), 3 de 5 no", () => {
  assert.equal(engine.analyze(series("a", [9, 9, 9, 9, 25])).partidas[0].status, "fiable");
  assert.equal(engine.analyze(series("b", [9, 9, 9, 25, 25])).partidas[0].status, "variable");
});

test("sin meses importados suficientes, el veredicto es «insuficiente» (solo se declarará)", () => {
  const result = engine.analyze(series("luz", [5, 5]));
  assert.equal(result.summary.verdict, "insuficiente");
  assert.match(engine.verdictText(result.summary), /ninguna partida tiene 3 meses o más/);
  assert.equal(engine.analyze([]).summary.verdict, "insuficiente");
  assert.doesNotMatch(engine.renderHtml(engine.analyze([])), /0 partidas|0 %/, "sin datos no se pinta una línea de ceros");
  assert.equal(engine.analyze(series("g", [2, 12, 22, 2, 15])).summary.verdict, "solo-declarado");
});

test("dos filas de la misma partida en un mes cuentan como un mes; filas sin importe no cuentan", () => {
  const result = engine.analyze([
    { key: "x", month: "2026-04", amount: 50, day: 3 },
    { key: "x", month: "2026-04", amount: 50, day: null },
    { key: "x", month: "2026-05", amount: 100, day: 3 },
    { key: "x", month: "2026-06", amount: 100, day: 4 },
    { key: "y", month: "2026-06", amount: 0, day: 9 },
  ]);
  assert.equal(result.partidas.length, 1);
  assert.equal(result.partidas[0].months, 3);
  assert.equal(result.partidas[0].status, "fiable");
});

test("el resultado y la tarjeta no llevan importes: solo porcentajes y recuentos", () => {
  const result = engine.analyze([...series("luz", [5, 5, 6, 5, 5], { amount: 8123.45 }), ...series("<b>gim</b>", [2, 12, 22, 2, 15], { amount: 4321 })]);
  const html = engine.renderHtml(result);
  assert.doesNotMatch(JSON.stringify(result) + html, /8123|4321/);
  assert.match(html, /&lt;b&gt;gim&lt;\/b&gt;/, "las etiquetas se escapan");
  assert.match(html, /<td>luz<\/td><td>65,3 %<\/td><td>5 de 5<\/td><td>Fiable · día 5 en el 100 %<\/td>/);
});

test("app.js: reúne una observación por partida y mes importado con el emparejamiento de la previsión", () => {
  const app = read("app.js");
  const start = app.indexOf("function chargeDayObservations()");
  const source = app.slice(start, app.indexOf("\n}\n", start) + 2);
  assert.match(source, /expenseTimingFromMovements\(row, month, amount\)/, "mismo emparejamiento que la previsión");
  assert.match(source, /rule: isEndOfMonthExpenseRow\(row\)/);
  const transactions = [
    { month: "2026-07", date: "2026-07-05", amount: -80 },
    { month: "2026-08", date: "2026-08-05", amount: -80 },
  ];
  const context = {
    baseData: { transactions, monthlyPlanning: { months: [{ key: "2026-06" }, { key: "2026-07" }, { key: "2026-08" }] } },
    planningSectionsForMonth: () => [{ rows: [{ id: "luz" }] }],
    plannedValueForRow: () => -80,
    seriesKeyForRow: (row) => row.id,
    displayLabelForRow: () => "Luz",
    isEndOfMonthExpenseRow: () => false,
    expenseTimingFromMovements: (row, month) => ({ day: Number(month.key === "2026-07" ? 5 : 6) }),
  };
  vm.runInNewContext(`${source}\nresult = chargeDayObservations();`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), [
    { key: "luz", label: "Luz", month: "2026-07", amount: -80, rule: false, day: 5 },
    { key: "luz", label: "Luz", month: "2026-08", amount: -80, rule: false, day: 6 },
  ], "junio no tiene movimientos importados: no cuenta");
});

test("registro: tarjeta en Ajustes › Presupuesto y operación, motor antes de la app y en la caché offline", () => {
  const html = read("index.html");
  const group = html.slice(html.indexOf('id="ajustes-operacion"'), html.indexOf('id="ajustes-operacion"') + 3000);
  assert.match(group, /id="cargoViabilidadCard"/);
  assert.match(group, /<div id="cargoViabilidad"><\/div>/);
  const at = html.indexOf('src="canonical-charge-day-viability.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-charge-day-viability\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-charge-day-viability\.js",/);
  assert.match(read("app.js"), /renderAjustesUsoApp\(\);\n\s+renderAjustesChargeDayViability\(\);/);
});
