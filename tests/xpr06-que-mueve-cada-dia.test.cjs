const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Band = require("../canonical-cash-band.js");
const fep = require("../funciones-en-prueba.js");
const medidor = require("../medidor-utilidad.js");

// XPR-06 · «Toca un día y mira qué lo mueve» (ficha XPR-06 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md). El desglose de un día es la
// columna «Según el plan» de la banda de caja (WP-16), abierta: tiene que cuadrar con ella al céntimo. Nace apagada en Funciones en prueba
// (XGO-03), con interruptor propio y la revisión contada desde que se enciende. La e2e de qa1 recorre la hoja.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const ev = (id, kind, amount, date, confidence, extra = {}) => ({ id, label: `Concepto ${id}`, kind, amount, date, confidence, ...extra });
const base = { asOf: "2026-11-03", openingTotal: 3000, floor: 1500, horizonDays: 29, trajectories: 200, seed: 7 };
const events = [
  ev("nomina", "income", 2500, "2026-11-25", "rule"),
  ev("seguro", "outflow", 400, "2026-11-10", "observed"),
  ev("luz", "outflow", 90, "2026-11-08", "estimated"),
  ev("atrasado", "outflow", 60, "2026-10-28", "estimated"),
  ev("gimnasio", "outflow", 35, "2026-11-10", "declared"),
  ev("super", "outflow", 840, "2026-11-08", "estimated", { spread: true, label: "Gastos variables" }),
  ev("traspaso", "transfer", 500, "2026-11-25", "rule"),
  ev("pasado", "outflow", 999, "2026-11-01", "rule"),
];

test("cada día cuadra con «Según el plan»: empieza donde acabó el anterior y acaba en el central de la banda", () => {
  const band = Band.simulate({ ...base, events });
  let previous = base.openingTotal;
  band.days.forEach((row) => {
    const day = Band.dayBreakdown({ ...base, events }, row.date);
    assert.equal(day.opening, previous, `${row.date}: empieza donde acabó el anterior`);
    assert.equal(day.closing, row.central, `${row.date}: acaba en el central`);
    const moved = day.items.reduce((sum, item) => sum + item.signed, 0) - day.spread.amount;
    assert.ok(Math.abs(day.opening + moved - day.closing) < 0.011, `${row.date}: lo que mueve explica la diferencia`);
    previous = day.closing;
  });
});

test("el día dice cada cosa con su certeza; lo estimado, el tramo en que lo mueve la banda; lo de antes del saldo, que sigue pendiente", () => {
  const first = Band.dayBreakdown({ ...base, events }, "2026-11-03");
  assert.deepEqual(first.items.map((item) => [item.id, item.confidence, item.planned, item.overdue]), [["atrasado", "estimated", "2026-10-28", true]], "el estimado de octubre, hoy; el cierto ya pasado no sale (el saldo lo recoge)");
  const tenth = Band.dayBreakdown({ ...base, events }, "2026-11-10");
  assert.deepEqual(tenth.items.map((item) => [item.id, item.signed, item.confidence, item.window]), [["seguro", -400, "observed", null], ["gimnasio", -35, "declared", null]], "primero lo que más sale");
  const eighth = Band.dayBreakdown({ ...base, events }, "2026-11-08");
  const luz = eighth.items.find((item) => item.id === "luz");
  assert.deepEqual(luz.window, { from: "2026-11-03", to: "2026-11-28" }, "días 1-28, sin lo anterior al saldo");
  assert.equal(eighth.spread.amount, 30, "840 € del mes entre los 28 días que quedan desde el 3");
  assert.deepEqual(eighth.spread.labels, ["Gastos variables"]);
  const payday = Band.dayBreakdown({ ...base, events }, "2026-11-25");
  assert.deepEqual(payday.items.map((item) => [item.id, item.signed, item.kind]), [["nomina", 2500, "income"]], "el traspaso entre cuentas propias no mueve la liquidez");
  const quiet = Band.dayBreakdown({ ...base, events: [ev("x", "outflow", 10, "2026-11-20", "rule")] }, "2026-11-12");
  assert.deepEqual([quiet.items, quiet.spread.amount, quiet.opening, quiet.closing], [[], 0, 3000, 3000]);
});

test("fuera del horizonte, sin saldos o sin fecha válida no hay desglose (no se inventa)", () => {
  assert.equal(Band.dayBreakdown({ ...base, events }, "2026-11-02"), null, "antes del saldo");
  assert.equal(Band.dayBreakdown({ ...base, events }, "2026-12-03"), null, "más allá de los 30 días");
  assert.equal(Band.dayBreakdown({ ...base, openingTotal: "", events }, "2026-11-05"), null);
  assert.equal(Band.dayBreakdown({ ...base, events }, "no-es-fecha"), null);
  assert.ok(Band.dayBreakdown({ ...base, events }, "2026-12-02"), "el último día del horizonte sí");
});

test("Funciones en prueba: interruptor propio que nace encendido desde el 29/10/2026 (decisión del hogar); apagarlo manda, y al volver a encenderlo la revisión cuenta desde ese día", () => {
  const item = fep.CATALOGO.find((entry) => entry.id === "banda-dia");
  assert.equal(item.interruptor, "propio");
  assert.match(item.metrica, /días de cargo indicados desde aquí/);
  assert.match(item.metrica, /dos meses/, "con su criterio de retirada escrito");
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(item.encendidaDesde, "2026-10-29");
  assert.equal(fep.encendida("banda-dia", storage), true, "encendida de entrada");
  assert.equal(fep.encendida("banda-dia", null), true, "sin almacenamiento, la de serie: encendida");
  const deSerie = fep.estadoDe(item, {}, "2026-11-11", { "banda-dia": true }, {});
  assert.deepEqual([deSerie.desde, deSerie.revision, deSerie.tocaRevisar], ["2026-10-29", "2026-11-12", false], "la revisión cuenta desde que se enciende de serie");
  mem.set(fep.BANDERAS_KEY, JSON.stringify(fep.cambiarBandera({}, "banda-dia", false, "2026-11-01")));
  assert.equal(fep.encendida("banda-dia", storage), false, "apagarla manda sobre la de serie");
  const off = fep.estadoDe(item, {}, "2026-12-31", { "banda-dia": false }, {});
  assert.equal(off.activa, false);
  assert.equal(off.tocaRevisar, false, "apagada no se está probando");
  const banderas = fep.cambiarBandera({}, "banda-dia", true, "2026-11-05");
  mem.set(fep.BANDERAS_KEY, JSON.stringify(banderas));
  assert.equal(fep.encendida("banda-dia", storage), true);
  const on = fep.estadoDe(item, {}, "2026-11-18", { "banda-dia": true }, banderas);
  assert.deepEqual([on.desde, on.revision, on.tocaRevisar], ["2026-11-05", "2026-11-19", false]);
  assert.equal(fep.estadoDe(item, {}, "2026-11-19", { "banda-dia": true }, banderas).tocaRevisar, true);
  assert.deepEqual(fep.cambiarBandera(banderas, "banda-dia", false, "2026-11-20"), { "banda-dia": { on: false } });
  mem.set(fep.BANDERAS_KEY, "{roto");
  assert.equal(fep.encendida("banda-dia", storage), true, "un almacén roto deja la de serie");
  assert.ok(!fep.porRevisar({}, "2027-01-01", { "tema-v2": true, "banda-dia": false }).some((entry) => entry.id === "banda-dia"), "apagada no pide revisión");
});

test("el medidor la cuenta, y la pantalla solo la enseña encendida, con la hoja en un <dialog> y el kit avisando del día elegido", () => {
  const medida = medidor.FUNCIONES.find((f) => f.id === "banda-dia");
  assert.deepEqual(medida.accion, ["día de cargo buscado desde aquí", "días de cargo buscados desde aquí"]);
  assert.match(medidor.frase("banda-dia", medidor.resumen(medidor.registrar({}, "banda-dia", "accion", { hoy: "2026-11-05" }), "banda-dia", "2026-11")), /1 día de cargo buscado desde aquí/);
  const ui = read("cash-band-ui.js");
  assert.match(ui, /FinanceFuncionesEnPrueba\?\.encendida\?\.\("banda-dia"\)/);
  assert.match(ui, /engine\.dayBreakdown\(cashBandLastInput, date\)/, "el desglose usa las mismas entradas que la banda pintada");
  assert.match(ui, /anotar\("banda-dia", "vista"\)/);
  assert.match(ui, /anotar\("banda-dia", "accion"\)/);
  assert.match(ui, /cashBandDayOn\(\), input\.events/, "encenderla o apagarla repinta la banda");
  assert.match(read("index.html"), /<dialog class="action-review-dialog banda-dia-dialog" id="bandaDiaDialog" aria-labelledby="bandaDiaTitulo">/);
  assert.match(read("chart-kit.js"), /slider\.dispatchEvent\(new CustomEvent\("ck-select", \{ bubbles: true, detail: \{ index: at \} \}\)\)/);
});
