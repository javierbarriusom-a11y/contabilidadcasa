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

// --- PR-2 (13/10/2026): el aviso en Cierre y el contraste del verde de A-4 -----------------------------------------------------------------------------------

const euros = (value) => `${Math.round(Math.abs(value))} €`;
const noticeOf = (previous, current) => B.closeNotice(B.bridge(previous, current), { labelOf: (key) => key, euros });

test("WP-43 PR-2 · closeNotice: sin puente, o con un cambio pequeño, no dice nada", () => {
  assert.deepEqual(B.closeNotice(null), { show: false });
  assert.deepEqual(B.closeNotice({}), { show: false });
  assert.deepEqual(B.closeNotice(B.bridge(null, null)), { show: false }, "faltan dos cierres");
  const a = freeze("2026-09", makeSeries({ start: "2026-10" }));
  const b = freeze("2026-10", makeSeries({ start: "2026-11", opening: 10000 + 480 }));
  assert.equal(B.bridge(a, b).calculable, true);
  const pequeno = B.closeNotice({ ...B.bridge(a, b), relevant: false });
  assert.deepEqual(pequeno, { show: false }, "un cambio pequeño sigue estando en la tarjeta de Previsión, no en Cierre");
  const otroAno = freeze("2027-01", makeSeries({ start: "2027-02" }));
  assert.deepEqual(B.closeNotice(B.bridge(a, otroAno)), { show: false }, "dos fines de año distintos no se comparan");
});

test("WP-43 PR-2 · closeNotice: un cambio relevante dice la dirección, la frase del puente y, si «Otros» pesa, que la explicación es floja", () => {
  const previous = freeze("2026-09", makeSeries({ start: "2026-10", opening: 10000 }));
  const worse = freeze("2026-10", makeSeries({ start: "2026-11", opening: 10000, extra: { "2026-12": 2500 } }), { income: 5000, recurring: 4250, debt: 480, partial: false });
  const n = noticeOf(previous, worse);
  assert.equal(n.show, true);
  assert.equal(n.level, "worsens");
  assert.equal(n.icon, "▼");
  assert.match(n.title, /^El fin de 2026 empeora desde el cierre anterior$/);
  assert.match(n.lines[0], /^Desde 2026-09, el fin de 2026 empeora en/);
  const better = freeze("2026-10", makeSeries({ start: "2026-11", opening: 10000, incomeBy: { "2026-11": 8000 } }), { income: 5000, recurring: 4250, debt: 480, partial: false });
  const m = noticeOf(previous, better);
  assert.equal(m.level, "improves");
  assert.equal(m.icon, "▲");
  assert.match(m.title, /mejora desde el cierre anterior/);
  // Sin el real del mes cerrado todo lo ocurrido hasta el cierre va a «Otros»: el aviso lo dice.
  const noReal = noticeOf(previous, freeze("2026-10", makeSeries({ start: "2026-11", opening: 6000 })));
  assert.equal(noReal.show, true);
  assert.ok(noReal.lines.some((line) => /Sin el real del mes cerrado/.test(line)), noReal.lines.join(" | "));
  assert.ok(noReal.lines.some((line) => /cae en «Otros y supuestos»/.test(line)), "si Otros pesa, se dice que la explicación es floja");
  assert.doesNotMatch(JSON.stringify([n, m, noReal]), /todo bien|sin cambios importantes/i);
});

test("WP-43 PR-2 · el aviso de Cierre solo lee y su botón lleva a Plan › Previsión", () => {
  const ui = read("puente-ui.js");
  const fn = ui.slice(ui.indexOf("function renderPuenteAviso"), ui.indexOf("// Una sola vez, por delegación."));
  assert.doesNotMatch(fn, /puenteSave|storageSet|queueRemoteSave|upsert|freezeYearEnd/, "el aviso no escribe ni congela nada");
  assert.match(ui, /event\.target\?\.closest\?\.\("\[data-puente-aviso-ver\]"\)\) \{ setActiveView\("plan", \{ focus: true \}\); setPlanTab\("prevision"\); \}/);
  assert.match(read("views/cierre.js"), /globalThis\.renderPuenteAviso\?\.\(window\.FinanceCanonicalForecastBridge\)/);
  assert.match(read("index.html"), /id="puenteAviso" aria-live="off" hidden/);
});

// El verde de A-4 (`.is-positivo` de la cascada de Análisis) daba 3,49:1 sobre la tarjeta en claro (mínimo AA 4,5:1). Se calcula con los tokens reales, no con un número copiado.
function channel(hex, shift) { return (parseInt(hex.slice(1), 16) >> shift) & 255; }
function luminance(hex) {
  const c = [16, 8, 0].map((shift) => { const v = channel(hex, shift) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// color-mix(in srgb, A 70%, B): interpolación por canal en sRGB codificado.
const mix = (a, b, pctA) => "#" + [16, 8, 0].map((shift) => Math.round(channel(a, shift) * pctA + channel(b, shift) * (1 - pctA)).toString(16).padStart(2, "0")).join("");

test("WP-43 PR-2 · el verde de los valores positivos de la cascada de Análisis cumple AA (4,5:1) en claro y en oscuro", () => {
  const css = read("design-tokens.css");
  const light = (name) => css.match(new RegExp(`^  --e19-${name}: (#[0-9a-fA-F]{6});`, "m"))[1];
  const dark = (name) => css.match(new RegExp(`^ {4}--e19-${name}: (#[0-9a-fA-F]{6});`, "m"))[1];
  // Antes: el verde de relleno puro, en claro, no llegaba.
  assert.ok(contrast(light("success"), light("surface")) < 4.5, "el verde de relleno solo no cumple: por eso se mezcla con la tinta");
  const rule = css.match(/\.e19-analisis \.analisis-cascada-value\.is-positivo,\s*\.e19-plan \.analisis-cascada-value\.is-positivo \{[^}]*color: ([^;]+);/)[1];
  assert.match(rule, /^color-mix\(in srgb, var\(--e19-success\) 70%, var\(--e19-ink\)\)$/);
  const lightText = mix(light("success"), light("ink"), 0.7);
  const darkText = mix(dark("success"), dark("ink"), 0.7);
  assert.ok(contrast(lightText, light("surface")) >= 4.5, `claro: ${contrast(lightText, light("surface")).toFixed(2)}`);
  assert.ok(contrast(darkText, dark("surface")) >= 4.5, `oscuro: ${contrast(darkText, dark("surface")).toFixed(2)}`);
});
