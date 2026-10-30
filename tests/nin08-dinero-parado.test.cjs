const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../canonical-next-euro.js");

// NIN-08 (docs/WP42_DISENO.md §7): el dinero parado. Cuánto hay por encima del suelo del colchón que la previsión mes a mes no toca en N meses, y cuánto rendiría neto
// en los productos que el hogar compara con sus tipos. Cifras INVENTADAS.
const MINS = [
  { monthKey: "2026-10", minTotal: 4000 }, // mes pasado: no cuenta
  { monthKey: "2026-11", minTotal: 9000, minTotalDate: "2026-11-28" },
  { monthKey: "2026-12", minTotal: 7000, minTotalDate: "2026-12-20", minTotalEvent: "Seguro del coche" },
  { monthKey: "2027-01", minTotal: 8000 },
  { monthKey: "2027-02", minTotal: 9500 },
  { monthKey: "2027-03", minTotal: 9900 },
  { monthKey: "2027-04", minTotal: 6500, minTotalDate: "2027-04-02" },
];
const base = { floor: 5000, monthlyMins: MINS, fromMonthKey: "2026-11", savingsTaxPct: 19 };

test("lo parado es el mínimo previsto de cada plazo menos el suelo, desde el mes en curso, con su fecha y su motivo", () => {
  const result = engine.idleCash(base);
  assert.equal(result.status, "ok");
  const [three, six, twelve] = result.windows;
  assert.deepEqual({ ...three }, { months: 3, calculable: true, minimum: 7000, date: "2026-12-20", event: "Seguro del coche", idle: 2000 });
  assert.equal(six.idle, 1500, "en 6 meses el mínimo es el de abril: 6.500 €");
  assert.deepEqual({ ...twelve }, { months: 12, calculable: false }, "con 6 meses de previsión no se dice nada de 12");
});

test("si la previsión baja del suelo, no hay dinero parado (nunca negativo)", () => {
  const result = engine.idleCash({ ...base, floor: 8000 });
  assert.equal(result.windows[0].idle, 0);
  assert.equal(result.windows[0].minimum, 7000);
});

test("sin suelo o sin previsión no hay cifra: dato ausente no es cero", () => {
  assert.equal(engine.idleCash({ ...base, floor: null }).status, "no-data");
  assert.equal(engine.idleCash({ ...base, monthlyMins: [] }).status, "no-data");
  assert.equal(engine.idleCash({ ...base, fromMonthKey: "" }).status, "no-data");
});

test("cada producto rinde sobre lo que la previsión no toca durante SU plazo, con el impuesto del ahorro y el neto al año", () => {
  const result = engine.idleCash({ ...base, options: [
    { id: "cuenta", label: "Cuenta remunerada", ratePct: 2, months: 3 },
    { id: "deposito", label: "Depósito", ratePct: 2.5, months: 6 },
    { id: "letras", label: "Letras del Tesoro", ratePct: 2.4, months: 12 },
    { id: "vacia", label: "Sin tipo", ratePct: null, months: 6 },
  ] });
  const [cuenta, deposito, letras, vacia] = result.options;
  assert.deepEqual({ amount: cuenta.amount, gross: cuenta.gross, tax: cuenta.tax, net: cuenta.net, netAnnualPct: cuenta.netAnnualPct }, { amount: 2000, gross: 10, tax: 1.9, net: 8.1, netAnnualPct: 1.62 });
  assert.equal(deposito.amount, 1500, "seis meses: lo parado en seis meses, no en tres");
  assert.equal(deposito.net, 15.19);
  assert.equal(letras.calculable, false);
  assert.match(letras.reason, /no llega a 12 meses/);
  assert.equal(vacia.calculable, false);
  assert.equal(result.best, undefined, "no elige «el mejor»: la liquidez de cada producto pesa distinto para cada hogar");
});

test("sin el tipo del ahorro, solo bruto, y se dice (neto nulo, no un neto igual al bruto)", () => {
  const result = engine.idleCash({ ...base, savingsTaxPct: null, options: [{ id: "cuenta", label: "Cuenta", ratePct: 2, months: 3 }] });
  assert.equal(result.options[0].gross, 10);
  assert.equal(result.options[0].net, null);
  assert.equal(result.options[0].netAnnualPct, null);
});

test("la tarjeta: en prueba con interruptor propio, nace encendida al publicarse, y la interfaz no mueve dinero", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.match(read("funciones-en-prueba.js"), /id: "dinero-parado"[^\n]*interruptor: "propio", encendidaDesde: "2026-11-04"/);
  assert.match(read("medidor-utilidad.js"), /id: "dinero-parado"/);
  const ui = read("escalera-ui.js");
  assert.match(ui, /FinanceFuncionesEnPrueba\?\.encendida\?\.\("dinero-parado"\) === true/);
  assert.match(ui, /canonicalDailyEngineRuns\.active\?\.monthly/);
  assert.doesNotMatch(ui.slice(ui.indexOf("function proxEuroIdleModel"), ui.indexOf("function proxEuroIdleDate")), /storageSet|proxEuroSave/, "calcular no guarda nada");
  assert.match(read("index.html"), /<div class="peu-parado" id="proxEuroParado" aria-live="polite" hidden><\/div>/);
});
