// WP-21 · PR-3 (FIS-03): el local alquilado en la Renta. Local FICTICIO (repositorio público): 900 € al mes sin IVA, de los dos
// (50 % cada uno), el inquilino es una empresa que retiene el 19 %, comprado por 150.000 € (60 % construcción) con un valor
// catastral de la construcción de 70.000 €. Cada cifra, hecha a mano en el comentario de al lado.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../canonical-rental-tax.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const local = (extra = {}) => ({ titular: "household", rentaMensual: 900, inquilinoRetiene: true, costeAdquisicion: 150000, pctConstruccion: 60, valorCatastralConstruccion: 70000, amortizacionAcumulada: 27000, ...extra });

test("WP-21 PR-3 · un año entero: intereses y reparación hasta los ingresos, el resto al año siguiente; sin reducción del 60 %", () => {
  const r = T.propertyYear({ year: 2026, property: local(), yearData: { mesesAlquilado: 12, ibi: 600, comunidad: 480, seguro: 220, intereses: 1500, reparacion: 10000 } });
  assert.equal(r.ingresos, 10800); // 900 × 12
  assert.equal(r.gastos.delAno, 11500); // 1.500 + 10.000
  assert.equal(r.gastos.limitados, 10800, "como mucho los ingresos íntegros");
  assert.deepEqual(r.arrastre, [{ year: 2026, amount: 700 }], "los 700 € que no caben, a los 4 años siguientes");
  assert.equal(r.gastos.otros, 1300); // 600 + 480 + 220, sin límite
  assert.equal(r.gastos.baseAmortizacion, 90000, "el mayor entre 150.000 × 60 % y 70.000");
  assert.equal(r.gastos.amortizacion, 2700); // 3 % de 90.000
  assert.equal(r.neto, -4000); // 10.800 − 10.800 − 1.300 − 2.700: puede ser negativo
  assert.equal(r.reduccion, 0, "local: la reducción es solo para vivienda");
  assert.equal(r.retencion, 2052); // 19 % de 10.800
  assert.equal(r.retencionCalculada, true);
  // Cada declarante, la mitad.
  const javi = T.rentalReport({ year: 2026, holder: "javi", property: local(), yearData: { mesesAlquilado: 12, ibi: 600, comunidad: 480, seguro: 220, intereses: 1500, reparacion: 10000 } });
  assert.deepEqual([javi.share, javi.ingresos, javi.neto, javi.baseGeneral, javi.retencion, javi.blocking], [0.5, 5400, -2000, -2000, 1026, false]);
  assert.equal(T.rentalReport({ year: 2026, holder: "tere", property: local({ titular: "javi" }), yearData: { mesesAlquilado: 12 } }).share, 0);
});

test("WP-21 PR-3 · lo pendiente: primero lo más antiguo, lo de hace más de 4 años caduca y lo de hace 4 que no cabe se pierde", () => {
  const r = T.propertyYear({ year: 2026, property: local(), yearData: { mesesAlquilado: 12, intereses: 1000, pendientes: [{ year: 2024, amount: 400 }, { year: 2021, amount: 300 }, { year: 2022, amount: 500 }] } });
  assert.deepEqual(r.gastos.aplicadosPendientes, [{ year: 2022, amount: 500 }, { year: 2024, amount: 400 }]);
  assert.equal(r.gastos.limitados, 1900); // 500 + 400 + 1.000
  assert.ok(r.falta.some((item) => item.code === "carry-expired" && item.count === 1), "lo de 2021 ya no vale en 2026");
  // Dos meses alquilados: 1.800 € de ingresos. 2022 (2.000) usa 1.800 y le sobran 200, que se pierden; 2024 y lo del año, al siguiente.
  const corto = T.propertyYear({ year: 2026, property: local({ amortizacionAcumulada: 89800 }), yearData: { mesesAlquilado: 2, reparacion: 200, pendientes: [{ year: 2022, amount: 2000 }, { year: 2024, amount: 1500 }] } });
  assert.equal(corto.ingresos, 1800);
  assert.deepEqual(corto.gastos.aplicadosPendientes, [{ year: 2022, amount: 1800 }]);
  assert.deepEqual(corto.pierde, [{ year: 2022, amount: 200 }]);
  assert.deepEqual(corto.arrastre, [{ year: 2024, amount: 1500 }, { year: 2026, amount: 200 }]);
  // Amortización por 2 meses (2.700 × 2/12 = 450), pero solo quedan 200 hasta el tope (90.000 − 89.800).
  assert.equal(corto.gastos.amortizacion, 200);
  assert.equal(corto.gastos.topeAlcanzado, true);
});

test("WP-21 PR-3 · los meses sin alquilar imputan renta si hay datos; lo que falta se dice y la retención del certificado manda", () => {
  const r = T.propertyYear({ year: 2026, property: local({ valorCatastralTotal: 100000, pctImputacion: 1.1 }), yearData: { mesesAlquilado: 2 } });
  assert.equal(r.imputacion, 916.67); // 100.000 × 1,1 % × 10/12
  const sin = T.propertyYear({ year: 2026, property: local(), yearData: { mesesAlquilado: 2 } });
  assert.ok(sin.falta.some((item) => item.code === "imputation-data-missing" && item.months === 10));
  assert.equal(T.propertyYear({ year: 2026, property: local(), yearData: { mesesAlquilado: 12, retencion: 1900 } }).retencion, 1900, "la del certificado");
  assert.equal(T.propertyYear({ year: 2026, property: local({ inquilinoRetiene: false }), yearData: { mesesAlquilado: 12 } }).retencion, 0);
  // Vacío no es 0: sin renta, sin meses o sin titular, la cifra no se puede dar.
  const vacio = T.rentalReport({ year: 2026, holder: "javi", property: {}, yearData: {} });
  assert.equal(vacio.blocking, true);
  assert.deepEqual(vacio.falta.filter((item) => item.blocking).map((item) => item.code), ["rent-missing", "months-missing", "holder-missing"]);
  assert.ok(vacio.falta.some((item) => item.code === "amortization-base-missing"));
  assert.ok(vacio.falta.some((item) => item.code === "withholding-unknown"));
});

test("WP-21 PR-3 · la actualización de la renta: la fecha de la cláusula, este año o el que viene, y la renta nueva con un porcentaje fijo", () => {
  const fijo = T.nextRentUpdate({ rentaMensual: 900, actualizacion: { tipo: "fijo", mes: 3, porcentaje: 3 } }, "2026-11-12");
  assert.deepEqual([fijo.status, fijo.date, fijo.days, fijo.nueva, fijo.soon], ["ok", "2027-03-01", 109, 927, false]);
  const ipc = T.nextRentUpdate({ rentaMensual: 900, actualizacion: { tipo: "ipc", mes: 12 } }, "2026-11-12");
  assert.deepEqual([ipc.date, ipc.days, ipc.soon, ipc.nueva], ["2026-12-01", 19, true, null], "con el IPC no se inventa la renta nueva");
  assert.equal(T.nextRentUpdate({ actualizacion: { tipo: "ipc", mes: 11 } }, "2026-11-01").date, "2026-11-01", "el mismo día cuenta");
  assert.equal(T.nextRentUpdate({}, "2026-11-12").status, "sin-clausula");
  assert.equal(T.nextRentUpdate({ actualizacion: { tipo: "ninguna" } }, "2026-11-12").status, "ninguna");
  assert.equal(T.nextRentUpdate({ actualizacion: { tipo: "ipc" } }, "2026-11-12").status, "sin-mes");
});

test("WP-21 PR-3 · motor puro, registrado y con consumidor real", () => {
  assert.doesNotMatch(read("canonical-rental-tax.js"), /document\.|window\.|localStorage|fetch\(/);
  for (const file of ["index.html", "service-worker.js", "tools/build-public-site.mjs"]) assert.ok(read(file).includes("canonical-rental-tax.js"), file);
  assert.match(read("local-renta-ui.js"), /FinanceCanonicalRentalTax/);
});
