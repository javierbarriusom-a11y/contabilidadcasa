const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const B = require("../canonical-forecast-bridge.js");

// WP-43 (PRV-01): el puente de previsión. Lo que el hogar debe poder fiar: que la cascada cuadre SIEMPRE con la diferencia total, que lo que no se sabe atribuir se vea en
// «Otros» en vez de repartirse a ojo, que dos fines de año distintos no se comparen y que el motor no invente una barra de «mercado».

// Serie de previsión mensual: parte de una liquidez, y cada mes suma ingresos y resta gasto recurrente, extraordinarios y deuda (el ahorro es interno a la liquidez).
function makeSeries({ start = "2026-10", months = 15, opening = 10000, income = 5000, recurring = 4250, debt = 480, extra = {}, incomeBy = {} } = {}) {
  const rows = [];
  let liquidity = opening;
  for (let i = 0; i < months; i += 1) {
    const monthKey = B.addMonths(start, i);
    const inc = incomeBy[monthKey] ?? income;
    const ext = extra[monthKey] || 0;
    const outflows = recurring + debt + ext;
    liquidity += inc - outflows;
    rows.push({ monthKey, totals: { income: inc, outflowsBeforeSaving: outflows, saving: 800, closingLiquidity: liquidity },
      components: { income: { recurrence: inc }, outflow: { recurrence: recurring, event: 0, debt, project: ext, manualAdjustment: 0 } } });
  }
  return rows;
}
const freeze = (monthKey, series, actuals = null) => {
  const result = B.freezeYearEnd({ monthKey, closedAt: `${B.addMonths(monthKey, 1)}-02T10:00:00Z`, series, actuals });
  assert.equal(result.calculable, true, result.reason);
  return result.snapshot;
};
const sum = (rows) => Math.round(rows.reduce((s, r) => s + r.value, 0) * 100) / 100;
const byId = (b, id) => b.rows.find((r) => r.id === id).value;

test("WP-43 · congelar guarda los meses que quedan hasta diciembre y la liquidez de 31/12", () => {
  const series = makeSeries({ start: "2026-10", opening: 10000 });
  const snap = freeze("2026-09", series);
  assert.equal(snap.targetYear, 2026);
  assert.deepEqual(snap.months.map((m) => m.monthKey), ["2026-10", "2026-11", "2026-12"]);
  assert.equal(snap.yearEndLiquidity, series.find((r) => r.monthKey === "2026-12").totals.closingLiquidity);
  assert.equal(snap.impliedOpening, 10000, "la liquidez de la que parte la previsión al cerrar el mes");
});

test("WP-43 · cerrar diciembre apunta al diciembre del año siguiente, y sin previsión hasta diciembre no se congela", () => {
  const snap = freeze("2026-12", makeSeries({ start: "2027-01", months: 12 }));
  assert.equal(snap.targetYear, 2027);
  assert.equal(snap.months.length, 12);
  assert.equal(B.freezeYearEnd({ monthKey: "2026-09", series: makeSeries({ start: "2026-10", months: 2 }) }).calculable, false, "la serie acaba en noviembre");
  assert.equal(B.freezeYearEnd({ monthKey: "nope", series: [] }).calculable, false);
});

test("WP-43 · la cascada cuadra con la diferencia total aunque cambie de todo a la vez", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10", opening: 10000 }));
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening: 9500, income: 4800, recurring: 4400, debt: 480, extra: { "2026-12": 1200 } }));
  const r = B.bridge(a, b);
  assert.equal(r.calculable, true);
  assert.equal(sum(r.rows), r.delta, "las barras suman exactamente lo que cambia el fin de año");
  assert.equal(r.delta, Math.round((b.yearEndLiquidity - a.yearEndLiquidity) * 100) / 100);
  assert.equal(r.direction, "worsens");
});

test("WP-43 · cada causa va a su barra con su signo: menos ingresos futuros, más gasto, un extraordinario nuevo", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  // Mismo punto de partida real; solo cambian las dos mensualidades que quedan (nov y dic).
  const base = makeSeries({ start: "2026-10" });
  const opening = base.find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening, income: 4800, recurring: 4400, extra: { "2026-12": 1200 } }));
  const r = B.bridge(a, b);
  assert.equal(byId(r, "income"), -400, "200 menos al mes durante 2 meses");
  assert.equal(byId(r, "recurring"), -300, "150 más al mes durante 2 meses");
  assert.equal(byId(r, "extraordinary"), -1200);
  assert.equal(byId(r, "debt"), 0);
  assert.equal(byId(r, "other"), 0, "nada sin explicar");
  assert.equal(r.drivers[0].id, "extraordinary");
  assert.equal(r.drivers.reduce((s, d) => s + d.sharePct, 0) >= 99, true);
});

test("WP-43 · lo ocurrido en el mes cerrado se reparte con el real; sin el real va entero a «Otros» y se dice", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" })); // octubre previsto: ingresos 5000, recurrente 4250, deuda 480
  const base = makeSeries({ start: "2026-10" });
  const planClose = base.find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  // Real de octubre: 300 más de ingresos, 500 más de gasto, deuda como se esperaba → la liquidez real queda 200 por debajo de lo previsto.
  const realSeries = makeSeries({ start: "2026-11", opening: planClose - 200 });
  const conReal = B.bridge(a, freeze("2026-10", realSeries, { income: 5300, recurring: 4750, debt: 480 }));
  assert.equal(conReal.closedMonthBreakdown, true);
  assert.equal(byId(conReal, "income"), 300);
  assert.equal(byId(conReal, "recurring"), -500);
  assert.equal(byId(conReal, "other"), 0);
  assert.equal(sum(conReal.rows), conReal.delta);
  const sinReal = B.bridge(a, freeze("2026-10", realSeries));
  assert.equal(sinReal.closedMonthBreakdown, false);
  assert.equal(byId(sinReal, "other"), -200, "los 200 de diferencia, sin repartir");
  assert.match(sinReal.notes.join(" "), /Sin el real del mes cerrado/);
  assert.equal(sum(sinReal.rows), sinReal.delta);
});

test("WP-43 · lo que el real no explica queda en «Otros», visible", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const planClose = makeSeries({ start: "2026-10" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  // El real explica -500 de gasto, pero la liquidez cayó 900: faltan 400 que no sabemos atribuir (p. ej. un traspaso o un saldo mal tecleado).
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening: planClose - 900 }), { income: 5000, recurring: 4750, debt: 480 });
  const r = B.bridge(a, b);
  assert.equal(byId(r, "recurring"), -500);
  assert.equal(byId(r, "other"), -400);
  assert.equal(sum(r.rows), r.delta);
});

test("WP-43 · dos cierres de fin de año distinto no se comparan, ni uno posterior contra uno anterior", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const d = freeze("2026-12", makeSeries({ start: "2027-01", months: 12 }));
  assert.equal(B.bridge(a, d).calculable, false);
  assert.match(B.bridge(a, d).reason, /años distintos/);
  const b = freeze("2026-10", makeSeries({ start: "2026-11" }));
  assert.equal(B.bridge(b, a).calculable, false);
  assert.equal(B.bridge(a, null).calculable, false);
});

test("WP-43 · entre dos cierres no consecutivos avisa de que lo intermedio va a «Otros»", () => {
  const a = freeze("2026-08", makeSeries({ start: "2026-09" }));
  const planClose = makeSeries({ start: "2026-09" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening: planClose - 300 }));
  const r = B.bridge(a, b);
  assert.match(r.notes.join(" "), /hay cierres sin foto/);
  assert.equal(sum(r.rows), r.delta);
});

test("WP-43 · la frase se apoya en las causas que más pesan, dice si es relevante y no incluye «mercado»", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const opening = makeSeries({ start: "2026-10" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening, extra: { "2026-12": 1000 }, income: 4900 }));
  const r = B.bridge(a, b);
  assert.deepEqual(r.drivers.map((d) => d.id), ["extraordinary", "income"]);
  assert.ok(r.drivers[0].sharePct > r.drivers[1].sharePct);
  assert.ok(r.relevant, "más del 5 % del fin de año anterior");
  assert.equal(r.rows.some((row) => /mercado/i.test(row.label)), false);
  assert.match(r.notes.join(" "), /cartera/);
  const igual = B.bridge(a, freeze("2026-10", makeSeries({ start: "2026-11", opening })));
  assert.equal(igual.direction, "flat");
  assert.equal(igual.relevant, false);
});

test("WP-43 · mejora: las causas a favor se reparten y las que van en contra se nombran aparte", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const opening = makeSeries({ start: "2026-10" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening, income: 5600, recurring: 4350 }));
  const r = B.bridge(a, b);
  assert.equal(r.direction, "improves");
  assert.deepEqual(r.drivers.map((d) => d.id), ["income"]);
  assert.deepEqual(r.against.map((x) => x.id), ["recurring"]);
});

test("WP-43 · el almacén guarda una foto por mes, la más reciente primero, y descarta lo mal formado", () => {
  const s1 = freeze("2026-08", makeSeries({ start: "2026-09" }));
  const s2 = freeze("2026-09", makeSeries({ start: "2026-10" }));
  let store = B.upsert([], s1);
  store = B.upsert(store, s2);
  store = B.upsert(store, { ...s1, yearEndLiquidity: 1 });
  assert.deepEqual(store.map((s) => s.monthKey), ["2026-09", "2026-08"]);
  assert.equal(store[1].yearEndLiquidity, 1, "regrabar un mes sustituye");
  assert.deepEqual(B.normalizeStore([null, { foo: 1 }, "x"]), []);
  assert.deepEqual(B.normalizeStore("nada"), []);
});

test("WP-43 · el motor es puro: ni DOM, ni red, ni almacenamiento, ni reloj", () => {
  const source = read("canonical-forecast-bridge.js");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /new Date\(\)|Date\.now/);
});

test("WP-43 · la frase dice cuánto, en qué sentido y por qué, y menciona lo que compensa", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const opening = makeSeries({ start: "2026-10" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const meses = { "2026-09": "septiembre" };
  const labelOf = (key) => meses[key] || key;
  const r = B.bridge(a, freeze("2026-10", makeSeries({ start: "2026-11", opening, extra: { "2026-12": 1000 }, income: 5100 })));
  const frase = B.describe(r, { labelOf });
  assert.match(frase, /^Desde septiembre, el fin de 2026 empeora en 800 € \(/);
  assert.match(frase, /: 100 % por extraordinarios/);
  assert.match(frase, /compensado en parte por \+200 € de ingresos/);
  assert.equal(B.describe(B.bridge(a, freeze("2026-10", makeSeries({ start: "2026-11", opening })))), "Desde 2026-09, el fin de 2026 no cambia.");
  assert.match(B.describe({ calculable: false, reason: "Falta algo." }), /Falta algo/);
});

test("WP-43 · el color de cada barra sigue su efecto (a favor, en contra, sin efecto) y la frase no repite el signo", () => {
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const opening = makeSeries({ start: "2026-10" }).find((r) => r.monthKey === "2026-10").totals.closingLiquidity;
  const r = B.bridge(a, freeze("2026-10", makeSeries({ start: "2026-11", opening, income: 4800, recurring: 4300, extra: { "2026-12": 1000 } })));
  const tone = Object.fromEntries(r.rows.map((row) => [row.id, row.tone]));
  assert.equal(tone.income, "is-gasto", "ingresos que bajan: en contra");
  assert.equal(tone.debt, "is-ahorro", "sin efecto");
  const conSigno = (value) => `${value < 0 ? "-" : ""}${Math.abs(value)} €`;
  assert.doesNotMatch(B.describe(r, { euros: conSigno }), /en -/, "«empeora en -1300 €» sería un doble negativo");
  // Lo que pesa menos que el umbral se agrupa en «el resto», para que los porcentajes lleguen a 100.
  assert.match(B.describe(r), /% entre /);
});
