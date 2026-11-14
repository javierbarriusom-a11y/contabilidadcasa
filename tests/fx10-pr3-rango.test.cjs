const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// FX-10 PR-3 (12/11/2026): el rango probable en el gráfico de Plan › Previsión con 3 m (views/prevision-v2.js). Sale de la banda de
// caja (canonical-cash-band.js, WP-16) con las mismas entradas que su tarjeta, hasta 91 días, y se ancla a la línea del plan.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const vista = read("views/prevision-v2.js");
const HOY = "2026-11-12";

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Un hogar inventado: 10.000 € hoy, un pago de 3.000 € sin día confirmado (el plan lo pone el 8 dic) y una nómina cierta de
// 2.000 € el 15 dic. La línea del plan: 10.000 hasta el 7 dic, 7.000 del 8 al 14 y 9.000 desde el 15.
function hogar({ opening = 10000 } = {}) {
  const events = [
    { id: "seguro", label: "Seguro", kind: "outflow", amount: 3000, date: "2026-12-08", confidence: "estimated" },
    { id: "nomina", label: "Nómina", kind: "income", amount: 2000, date: "2026-12-15", confidence: "observed" },
  ];
  const rows = Array.from({ length: 95 }, (_, i) => {
    const date = addDays(HOY, i);
    return { date, total: date < "2026-12-08" ? 10000 : date < "2026-12-15" ? 7000 : 9000 };
  });
  return { rows, input: { asOf: HOY, staleDays: 0, today: HOY, events, openingTotal: opening, floor: 1500, horizonDays: 30, declared: true } };
}

function sandbox(input) {
  const band = require("../canonical-cash-band.js");
  let llamadas = 0;
  const ctx = {
    console, Date, Map, WeakMap, Math, Number, JSON, String, Array, Object, Set, Boolean, Intl,
    FinanceCanonicalForecastContract: require("../canonical-forecast-contract.js"),
    FinanceCanonicalCashBand: { ...band, simulate: (args) => { llamadas += 1; return band.simulate(args); } },
    cashBandInput: () => input,
    money: (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (s) => String(s),
    isoLocalDate: (d) => d.toISOString().slice(0, 10),
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(vista, ctx);
  return { ctx, llamadas: () => llamadas };
}

test("el rango llega a 91 días desde hoy, anclado a la línea del plan, y se cierra cuando ya no queda nada que pueda moverse", () => {
  const { rows, input } = hogar();
  const { ctx } = sandbox(input);
  const rango = ctx.previsionV2Rango(rows, HOY);
  assert.equal(rango.hasta, addDays(HOY, 91));
  assert.equal(rango.dias.has(addDays(HOY, -1)), false, "nada antes de hoy");
  // El 10 dic el seguro puede haberse pagado o no (cae del 1 al 28): el rango va de lo pagado (7.000) a lo no pagado (10.000).
  const d10 = ctx.previsionV2RangoDia(rango, "2026-12-10", HOY);
  assert.deepEqual([d10.low, d10.high], [7000, 10000]);
  assert.equal(ctx.previsionV2RangoLado(rows.find((r) => r.date === "2026-12-10"), d10), "", "el plan, dentro del rango");
  // El 30 dic ya se ha pagado seguro: el rango es una línea y no se dice.
  assert.equal(ctx.previsionV2RangoDia(rango, "2026-12-30", HOY), null);
});

test("anclado al plan: si la banda parte de otro saldo (saldos de otro día), el rango no se mueve", () => {
  const a = hogar();
  const b = hogar({ opening: 10500 });
  const ra = sandbox(a.input).ctx.previsionV2Rango(a.rows, HOY);
  const rb = sandbox(b.input).ctx.previsionV2Rango(b.rows, HOY);
  const redondo = (r) => [...r.dias.entries()].map(([date, d]) => [date, Math.round(d.low), Math.round(d.high)]);
  assert.deepEqual(redondo(ra), redondo(rb));
});

test("una simulación por trayectoria del plan: repintar o recorrer el gráfico no la repite; otra trayectoria u otro día, sí", () => {
  const { rows, input } = hogar();
  const s = sandbox(input);
  const primero = s.ctx.previsionV2Rango(rows, HOY);
  assert.equal(s.ctx.previsionV2Rango(rows, HOY), primero);
  assert.equal(s.llamadas(), 1);
  s.ctx.previsionV2Rango(rows.slice(), HOY);
  s.ctx.previsionV2Rango(rows, "2026-11-13");
  assert.equal(s.llamadas(), 3);
  // Sin movimientos fechados no hay rango, y un fallo de la simulación tampoco rompe la pantalla.
  assert.equal(sandbox({ ...input, events: [] }).ctx.previsionV2Rango(rows, HOY), null);
});

test("el plan fuera del rango se dice: por debajo, los pagos sin día el día 8; la nota explica el área, el ancho y lleva a Días de cargo", () => {
  const { rows, input } = hogar();
  const { ctx } = sandbox(input);
  const dia = { low: 7000, high: 9000, raw: { low: 7000, high: 9000 } };
  assert.equal(ctx.previsionV2RangoLado({ total: 6600 }, dia), "debajo");
  assert.equal(ctx.previsionV2RangoLado({ total: 9300 }, dia), "encima");
  assert.equal(ctx.previsionV2RangoLado({ total: 8000 }, dia), "");
  const rango = ctx.previsionV2Rango(rows, HOY);
  const nota = ctx.previsionV2RangoNotaHtml({ ...rango, quality: "wide", estimatedShare: 0.78 }, rows.slice(0, 92), HOY);
  assert.match(nota, /Área azul: el rango probable \(8 de cada 10 casos\), según qué día caigan los pagos; no recoge cambios de importe\./);
  assert.match(nota, /Es ancho porque el 78 % de lo que se mueve no tiene día confirmado: <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas">/);
  assert.doesNotMatch(nota, /por debajo del rango/, "con el plan dentro del rango, no se dice");
  const lectura = ctx.previsionV2Lectura({ date: "2026-12-10", total: 7000 }, 1500, HOY, rango);
  assert.match(lectura, /· rango probable 7\.000 € – 10\.000 €\.$/);
  assert.doesNotMatch(ctx.previsionV2Lectura({ date: "2026-12-10", total: 7000 }, 1500, HOY), /rango/);
});

test("conexión: solo en 3 m, en el gráfico, la tabla, las lecturas y el panel del día; el resto de horizontes, como antes", () => {
  assert.match(vista, /const rango = horizonte\.id === "3m" \? previsionV2Rango\(rows, today\) : null; \/\/ FX-10 PR-3/);
  assert.match(vista, /previsionV2GraficoHtml\(\{ puntos, floor, today, horizonte, prueba, hitos: hitos\.hitos, rango \}\)/);
  assert.match(vista, /columns: \["Día", "Saldo previsto", "Sobre el suelo", "Rango probable"\]/);
  assert.match(vista, /<p class="prev-v2-dia-rango">Rango probable <strong>/);
  assert.match(vista, /horizonDays: Number\(input\.staleDays \|\| 0\) \+ PREVISION_V2_RANGO_DIAS/);
  assert.match(read("index.html"), /views\/prevision-v2\.js\?v=20261116prv01c/); // 13/11: el medidor anota la visita; 14/11: PRV-01
});
