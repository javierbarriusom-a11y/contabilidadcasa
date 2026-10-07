const test = require("node:test");
const assert = require("node:assert/strict");
const Band = require("../canonical-cash-band.js");

// WP-16 (NPV-01, docs/WP16_DISENO.md): la banda de caja a 30 días. Se prueba el motor puro: mecánica, bordes, honestidad («sin dato = no
// calculable»; la banda ancha se dice) y, con el hogar sintético de WP-33, calibración (la banda cubre ~80 %; la probabilidad de cruzar el suelo
// coincide con la frecuencia real).

const ev = (id, kind, amount, date, confidence) => ({ id, kind, amount, date, confidence });
const base = { asOf: "2026-11-01", openingTotal: 3000, floor: 1500, horizonDays: 29, trajectories: 500, seed: 3 };

// ---- sin dato = no calculable ----
test("sin fecha de los saldos o sin saldo de partida no hay banda: dice qué falta", () => {
  const noDate = Band.simulate({ openingTotal: 1000, events: [] });
  assert.equal(noDate.status, "missing");
  assert.deepEqual(noDate.missing, ["la fecha de los saldos"]);
  const none = Band.simulate({});
  assert.deepEqual(none.missing, ["la fecha de los saldos", "el saldo de partida"]);
  assert.equal(Band.simulate({ asOf: "2026-11-01", openingTotal: "", events: [] }).status, "missing"); // vacío no es 0
  assert.equal(Band.simulate({ asOf: "2026-11-01", openingTotal: 0, events: [] }).status, "ok"); // 0 sí es un saldo
});

// ---- todo con fecha cierta: la banda es una línea ----
test("con todas las fechas ciertas la banda es una línea (P10 = P50 = P90 = trayectoria central) y la probabilidad es 0 o 1", () => {
  const events = [ev("a", "outflow", 1000, "2026-11-05", "rule"), ev("b", "income", 500, "2026-11-20", "observed")];
  const r = Band.simulate({ ...base, events });
  assert.equal(r.quality, "exact");
  r.days.forEach((day) => { assert.equal(day.p10, day.p50); assert.equal(day.p50, day.p90); assert.equal(day.p50, day.central); });
  assert.equal(r.days[0].p50, 3000);
  assert.equal(r.days[3].p50, 3000); // 4 nov
  assert.equal(r.days[4].p50, 2000); // el 5 sale el pago
  assert.equal(r.days[29].p50, 2500);
  assert.equal(r.crossing.probability, 0); // 2.000 € mínimo > 1.500 € de suelo
  const tight = Band.simulate({ ...base, floor: 2500, events });
  assert.equal(tight.crossing.probability, 1);
  assert.equal(tight.minimum.date, "2026-11-05");
  assert.equal(tight.minimum.probability, 1);
});

// ---- fechas estimadas: probabilidad, no calendario ----
test("probabilidad de cruzar el suelo = porción de la ventana en que el pago cae antes del ingreso", () => {
  // Parte de 1.000 €, suelo 500 €. Sale 800 € (fecha estimada, ventana 1-28) e ingresa 1.000 € el 10. Cruza si el pago cae el 10 o antes (el mismo día,
  // lo que sale va primero): días 1-10, 10 de 28.
  const events = [ev("p", "outflow", 800, "2026-11-08", "estimated"), ev("n", "income", 1000, "2026-11-10", "rule")];
  const r = Band.simulate({ ...base, openingTotal: 1000, floor: 500, events, trajectories: 4000 });
  assert.ok(Math.abs(r.crossing.probability - 10 / 28) < 0.03, `probabilidad ${r.crossing.probability}`);
  assert.equal(r.quality, "ok"); // el 44 % por importe es estimado: por debajo del 70 %
  assert.equal(r.dateCertainty.estimatedShare, 0.44);
});

test("la banda se ensancha con las fechas estimadas, y el 70 % estimado por importe se dice como «banda ancha»", () => {
  const events = [ev("a", "outflow", 700, "2026-11-08", "estimated"), ev("b", "outflow", 500, "2026-11-08", "estimated"), ev("c", "income", 400, "2026-11-25", "rule")];
  const r = Band.simulate({ ...base, events });
  assert.equal(r.quality, "wide");
  assert.ok(r.dateCertainty.estimatedShare >= Band.WIDE_ESTIMATED_SHARE);
  assert.match(r.sentence, /La banda es ancha: el 75 % de lo que se mueve tiene fecha estimada/);
  const mid = r.days[14];
  assert.ok(mid.p90 > mid.p10, "hay dispersión a mitad de mes");
  const last = r.days[29];
  assert.equal(last.p10, last.p90, "a fin de periodo todos los pagos ya cayeron: converge");
});

test("ventana: un evento estimado cae solo dentro de los días 1-28 (o la que se indique) y nunca antes del saldo declarado", () => {
  const event = [ev("p", "outflow", 100, "2026-11-08", "estimated")];
  // Saldo del 20: el pago estimado (día 8, ya pasado) sigue pendiente y cae entre el 20 y el 28.
  const late = Band.simulate({ ...base, asOf: "2026-11-20", horizonDays: 10, events: event, trajectories: 2000 });
  const firstDrop = late.days.findIndex((day) => day.p90 < 3000);
  assert.ok(firstDrop >= 0);
  assert.equal(late.days[0].p90, 3000); // el día 0 lo ve la banda alta (pocas trayectorias caen ese día)
  assert.equal(late.days[late.days.length - 1].p50, 2900); // al final cayó en todas
  // Una ventana propia, 10-12: antes del 10 no baja nada.
  const own = Band.simulate({ ...base, events: event, window: { from: 10, to: 12 }, trajectories: 500 });
  assert.equal(own.days[8].p10, 3000); // 9 nov
  assert.equal(own.days[11].p90, 2900); // 12 nov: cayó
  assert.equal(own.days[11].p10, 2900);
});

test("un evento con día cierto anterior al saldo ya pasó (lo recoge el saldo); uno estimado anterior sigue pendiente", () => {
  const r = Band.simulate({ ...base, asOf: "2026-11-20", events: [ev("viejo", "outflow", 400, "2026-11-05", "rule"), ev("pend", "outflow", 400, "2026-11-05", "estimated")], horizonDays: 9, trajectories: 1000 });
  assert.equal(r.dateCertainty.events, 1);
  assert.equal(r.days[r.days.length - 1].p50, 2600); // solo cayó el pendiente
});

test("los traspasos entre cuentas propias y los importes nulos no mueven la liquidez total", () => {
  const r = Band.simulate({ ...base, events: [ev("t", "transfer", 5000, "2026-11-02", "rule"), ev("z", "outflow", 0, "2026-11-03", "rule"), ev("n", "outflow", "no", "2026-11-03", "rule"), ev("f", "outflow", 10, "mañana", "rule")] });
  assert.equal(r.dateCertainty.events, 0);
  assert.equal(r.quality, "no-events");
  assert.match(r.sentence, /No hay movimientos previstos/);
});

test("una confianza desconocida se trata como estimada (la prudente)", () => {
  const r = Band.simulate({ ...base, events: [ev("x", "outflow", 100, "2026-11-08", "quizá")] });
  assert.equal(r.dateCertainty.estimatedAmount, 100);
});

test("dentro de un día, primero sale lo que sale: el mínimo se mide después de los pagos y antes de los cobros", () => {
  const events = [ev("p", "outflow", 2000, "2026-11-10", "rule"), ev("c", "income", 2000, "2026-11-10", "rule")];
  const r = Band.simulate({ ...base, openingTotal: 2500, floor: 1000, events });
  assert.equal(r.crossing.probability, 1); // 500 < 1.000 entre medias, aunque a fin de día vuelva a 2.500
  assert.equal(r.days[9].p50, 2500);
  assert.equal(r.minimum.valueP50, 500);
});

test("sin suelo declarado no se afirma ningún cruce, y el día del mínimo sí se da", () => {
  const r = Band.simulate({ ...base, floor: null, events: [ev("p", "outflow", 500, "2026-11-10", "rule")] });
  assert.equal(r.crossing.probability, null);
  assert.equal(r.minimum.date, "2026-11-10");
  assert.match(r.sentence, /Sin suelo de liquidez declarado/);
  assert.equal(Band.simulate({ ...base, floor: 0, events: [] }).crossing.probability, 0); // 0 es un suelo
});

test("la dispersión del importe solo existe si el evento la trae (la app aún no la aporta)", () => {
  const without = Band.simulate({ ...base, events: [ev("p", "outflow", 500, "2026-11-10", "rule")] });
  assert.equal(without.days[15].p10, without.days[15].p90);
  const withSd = Band.simulate({ ...base, events: [{ ...ev("p", "outflow", 500, "2026-11-10", "rule"), amountSd: 100 }] });
  assert.ok(withSd.days[15].p90 > withSd.days[15].p10);
});

// ---- gasto repartido en el mes ----
test("un gasto «repartido» (súper, gasolina) baja por igual cada día que queda del mes, sin azar ni varianza inventada", () => {
  const r = Band.simulate({ ...base, openingTotal: 3000, events: [{ ...ev("v", "outflow", 900, "2026-11-08", "estimated"), spread: true }] });
  assert.equal(r.days[0].p10, r.days[0].p90);
  r.days.forEach((day) => assert.equal(day.p10, day.p90, "ninguna dispersión: no hay fecha incierta"));
  assert.equal(r.days[0].p50, 2970); // 900 / 30 días de noviembre
  assert.equal(r.days[29].p50, 2100); // 30 días × 30 € = 900 €
  assert.equal(r.days[29].central, r.days[29].p50);
  assert.equal(r.dateCertainty.spreadAmount, 900);
  assert.equal(r.dateCertainty.estimatedShare, null); // no hay nada con fecha que medir
});

test("el gasto repartido empieza el día del saldo, no el 1 del mes, y no cuenta como «fecha estimada» para decir que la banda es ancha", () => {
  const events = [{ ...ev("v", "outflow", 400, "2026-11-08", "estimated"), spread: true }, ev("n", "income", 100, "2026-11-25", "rule")];
  const r = Band.simulate({ ...base, asOf: "2026-11-21", horizonDays: 9, events }); // quedan 10 días (21-30)
  assert.equal(r.days[0].p50, 2960);
  assert.equal(r.days[9].p50, 2700); // 3000 − 400 + 100
  assert.notEqual(r.quality, "wide");
});

test("un gasto repartido del mes siguiente solo cuenta los días que caen dentro del horizonte", () => {
  const r = Band.simulate({ ...base, asOf: "2026-11-20", horizonDays: 15, events: [{ ...ev("v", "outflow", 3100, "2026-12-08", "estimated"), spread: true }] });
  // Diciembre tiene 31 días → 100 €/día; del 1 al 5 de diciembre caen en el horizonte (hasta el 5/12): 5 días.
  assert.equal(r.days[r.days.length - 1].p50, 2500);
});

// ---- determinismo y límites ----
test("determinista: mismas entradas y misma semilla, mismo resultado; otra semilla, otro muestreo", () => {
  const events = [ev("a", "outflow", 700, "2026-11-08", "estimated"), ev("b", "outflow", 500, "2026-11-08", "estimated")];
  assert.deepEqual(Band.simulate({ ...base, events }), Band.simulate({ ...base, events }));
  assert.notDeepEqual(Band.simulate({ ...base, events, seed: 1 }).days, Band.simulate({ ...base, events, seed: 2 }).days);
});

test("el horizonte y las trayectorias se acotan; el día 0 es el del saldo", () => {
  const r = Band.simulate({ ...base, horizonDays: 9999, trajectories: 99999, events: [] });
  assert.equal(r.horizonDays, 120);
  assert.equal(r.trajectories, 5000);
  assert.equal(r.days.length, 121);
  assert.equal(r.days[0].date, "2026-11-01");
  assert.equal(Band.simulate({ ...base, trajectories: 1, events: [] }).trajectories, 50);
});

test("percentile: interpolación y bordes", () => {
  assert.equal(Band.percentile([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(Band.percentile([10, 20], 0.25), 12.5);
  assert.equal(Band.percentile([7], 0.9), 7);
  assert.equal(Band.percentile([], 0.5), null);
  assert.equal(Band.percentile([1, 2, 3], 5), 3); // fuera de rango, se acota
});

// ---- frase ----
test("la frase habla de «X de cada 10 trayectorias», con tramo de días y día más probable del mínimo", () => {
  const events = [ev("p", "outflow", 800, "2026-11-08", "estimated"), ev("n", "income", 1000, "2026-11-10", "rule")];
  const r = Band.simulate({ ...base, openingTotal: 1000, floor: 500, events, trajectories: 2000 });
  assert.match(r.sentence, /^En 4 de cada 10 trayectorias la liquidez baja del suelo \(500 €\) entre el \d+ y el \d+ de noviembre\./);
  assert.match(r.sentence, /En 6 de cada 10 el punto más bajo es el saldo de hoy\./); // si el pago cae después del cobro, nunca baja del saldo de partida
  assert.equal(r.minimum.date === null || r.minimum.atStart > 0.5, true);
  const safe = Band.simulate({ ...base, events: [ev("p", "outflow", 100, "2026-11-10", "rule")] });
  assert.match(safe.sentence, /En ninguna de las 500 trayectorias simuladas la liquidez baja del suelo \(1\.?500 €\)/);
  assert.equal(Band.whenLabel("2026-10-28", "2026-11-02"), "entre el 28 de octubre y el 2 de noviembre");
  assert.equal(Band.whenLabel("2026-11-09", "2026-11-09"), "el 9 de noviembre");
});

// ---- calibración con el hogar sintético (WP-33) ----
const PARTIDAS = [
  { key: "alq", label: "Alquiler ficticio", kind: "fijo", day: 1, mean: 900, sd: 0 },
  { key: "hip", label: "Cuota ficticia", kind: "fijo", day: 5, mean: 700, sd: 0 },
  { key: "e1", label: "Partida errática 1", kind: "erratico", day: null, mean: 600, sd: 0 },
  { key: "e2", label: "Partida errática 2", kind: "erratico", day: null, mean: 450, sd: 0 },
  { key: "e3", label: "Partida errática 3", kind: "erratico", day: null, mean: 300, sd: 0 },
  { key: "e4", label: "Partida errática 4", kind: "erratico", day: null, mean: 250, sd: 0 },
];
const OPENING = 3600;
const FLOOR = 800;
const INCOME = { day: 15, amount: 2400 };
const pad = (day) => `2026-11-${String(day).padStart(2, "0")}`;

// Un mes de un hogar ficticio: la verdad (día real de cada pago) y lo que sabe la app. `assume`:
//   "estimated" → lo que dice el motor nuevo: los errátcos con fecha estimada (ventana 1-28);
//   "day8"      → lo que hace la previsión actual de la app: todo lo que no sabe, el día 8, como si fuera cierto.
function scenario(generate, seed, assume) {
  const household = generate({ seed, months: 1, start: "2026-11", partidas: PARTIDAS });
  const known = (o) => o.key === "alq" || o.key === "hip";
  const events = [{ id: "nomina", kind: "income", amount: INCOME.amount, date: pad(INCOME.day), confidence: "rule" }];
  household.observations.forEach((o) => {
    if (known(o)) events.push({ id: o.key, kind: "outflow", amount: o.amount, date: pad(o.day), confidence: "rule" });
    else if (assume === "estimated") events.push({ id: o.key, kind: "outflow", amount: o.amount, date: pad(8), confidence: "estimated" });
    else events.push({ id: o.key, kind: "outflow", amount: o.amount, date: pad(8), confidence: "rule" });
  });
  const byDay = {};
  household.observations.forEach((o) => { (byDay[o.day] ||= { out: 0, inc: 0 }).out += o.amount; });
  (byDay[INCOME.day] ||= { out: 0, inc: 0 }).inc += INCOME.amount;
  const truth = new Array(31).fill(0);
  let balance = OPENING;
  let crossed = false;
  for (let day = 1; day <= 30; day += 1) {
    const x = byDay[day] || { out: 0, inc: 0 };
    balance -= x.out;
    if (balance < FLOOR) crossed = true;
    balance += x.inc;
    truth[day] = balance;
  }
  const result = Band.simulate({ asOf: pad(1), openingTotal: OPENING, floor: FLOOR, events, horizonDays: 29, trajectories: 400, seed: seed * 7919 });
  return { result, truth, crossed };
}

async function calibrate(assume, households) {
  const { generateHousehold } = await import("../tools/build-synthetic-household.mjs");
  const checkDays = [7, 14, 21];
  const hits = checkDays.map(() => 0);
  let predicted = 0;
  let observed = 0;
  for (let seed = 1; seed <= households; seed += 1) {
    const { result, truth, crossed } = scenario(generateHousehold, seed, assume);
    checkDays.forEach((day, index) => { const row = result.days[day - 1]; if (truth[day] >= row.p10 && truth[day] <= row.p90) hits[index] += 1; });
    predicted += result.crossing.probability;
    observed += crossed ? 1 : 0;
  }
  return { coverage: hits.map((n) => n / households), predicted: predicted / households, observed: observed / households };
}

test("calibración (hogar sintético, 250 meses): la banda P10-P90 cubre lo que pasó de verdad, sin pasarse de ancha", async () => {
  const { coverage } = await calibrate("estimated", 250);
  coverage.forEach((value, index) => {
    assert.ok(value >= 0.78, `la banda cubre solo el ${(value * 100).toFixed(0)} % el día ${[7, 14, 21][index]} (esperado ≈ 80 % o más)`);
    assert.ok(value <= 0.97, `la banda cubre el ${(value * 100).toFixed(0)} %: demasiado ancha para informar`);
  });
});

test("calibración: la probabilidad media de cruzar el suelo coincide con la frecuencia real de cruzarlo", async () => {
  const { predicted, observed } = await calibrate("estimated", 250);
  assert.ok(observed > 0.1 && observed < 0.6, `el escenario debe ser moderado para que la prueba valga (frecuencia real ${observed})`);
  assert.ok(Math.abs(predicted - observed) < 0.07, `probabilidad media ${predicted.toFixed(3)} frente a frecuencia real ${observed.toFixed(3)}`);
});

test("contraste: tratar como cierto el día 8 de lo desconocido (la previsión actual) da una alarma falsa casi segura y una banda que no cubre", async () => {
  const { coverage, predicted, observed } = await calibrate("day8", 120);
  assert.ok(predicted > 0.9, `con todo el día 8 afirma que cruza el suelo (${predicted.toFixed(2)})`);
  assert.ok(observed < 0.5, `cuando en la realidad cruza el ${(observed * 100).toFixed(0)} % de los meses`);
  assert.ok(Math.min(...coverage) < 0.5, `y su «banda» (una línea) cubre solo ${coverage.map((c) => `${(c * 100).toFixed(0)} %`).join(", ")}`);
});

// ---- cableado de la tarjeta (cash-band-ui.js) ----
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("cableado: la tarjeta está en Previsión, el motor y la pantalla se cargan antes que app.js, y app.js la pinta al pintar Previsión", () => {
  const html = read("index.html");
  assert.match(html, /<details class="e19-card prevision-calidad-card" id="previsionBandaCard">\s*<summary id="previsionBandaResumen">/);
  assert.match(html, /<div id="previsionBanda"><\/div>/);
  ["chart-kit.js", "canonical-cash-band.js", "cash-band-ui.js"].forEach((file) => {
    assert.match(html, new RegExp(`<script defer src="${file.replace(".", "\\.")}\\?v=[^"]+"></script>`));
    assert.ok(html.indexOf(file) < html.indexOf('src="app.js'), `${file} debe cargarse antes que app.js`);
  });
  assert.ok(html.indexOf('src="chart-kit.js') < html.indexOf('src="cash-band-ui.js'), "el kit antes que la pantalla que lo usa");
  assert.match(read("service-worker.js"), /"\.\/canonical-cash-band\.js"[\s\S]*"\.\/cash-band-ui\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-cash-band\.js"[\s\S]*"cash-band-ui\.js"/);
  const app = read("app.js");
  assert.equal((app.match(/renderCashBand\?\.\(globalThis\.FinanceCanonicalCashBand\)/g) || []).length, 1);
});

test("la pantalla no toca el DOM al cargarse y sale del paso con cuidado: sin movimientos o sin kit, no pinta ni falla", () => {
  const source = read("cash-band-ui.js");
  const topLevel = source.split("function cashBandInput")[0];
  assert.doesNotMatch(topLevel, /document\.|addEventListener|qs\(/);
  assert.match(source, /if \(!box \|\| !engine \|\| !globalThis\.ChartKit\) return;/);
  assert.match(source, /catch \(error\) \{\s*console\.error\(`renderCashBand/);
  // Repintar con las mismas entradas no debe borrar la lectura del gráfico que se está recorriendo.
  assert.match(source, /if \(key === cashBandRenderedKey && box\.firstElementChild\) return;/);
});

test("el gasto variable estimado se reparte; el resto de lo estimado, no", () => {
  const source = read("cash-band-ui.js");
  assert.match(source, /spread: event\.confidence === "estimated" && event\.field === "variableOperationalSpend"/);
});
