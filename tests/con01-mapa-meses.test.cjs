const test = require("node:test");
const assert = require("node:assert/strict");
const mapa = require("../canonical-month-map.js");
const cobertura = require("../canonical-ledger-coverage.js");

// CON-01 (D-N55, 27/11/2026): el mapa de meses y extractos de Cierre. Con la cobertura de verdad (XDA-04) y rangos inventados.
const HOY = "2026-11-27";
const CUENTAS = [{ id: "caixabank", nombre: "CaixaBank" }, { id: "mediolanum", nombre: "Mediolanum" }];
const RANGOS = [
  { account: "caixabank", from: "2026-08-01", to: "2026-10-31", source: "declarado" },
  { account: "caixabank", from: "2026-11-01", to: "2026-11-14", source: "declarado" },
  { account: "mediolanum", from: "2026-09-01", to: "2026-09-20", source: "declarado" },
];
const cob = (cuenta, mes) => cobertura.month(RANGOS, cuenta, mes, HOY);

test("la ventana: los N meses que acaban en el de hoy, del más antiguo al más reciente", () => {
  assert.deepEqual(mapa.ventana(HOY, 6), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(mapa.ventana("2027-02-03", 3), ["2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(mapa.ventana("", 6), []);
});

test("los cuatro estados por casilla, con su palabra", () => {
  const m = mapa.construir({ cuentas: CUENTAS, meses: mapa.ventana(HOY, 6), hoy: HOY, cobertura: cob, firmados: ["2026-10"] });
  const caixa = Object.fromEntries(m.filas[0].casillas.map((c) => [c.mes, mapa.texto(c)]));
  const medio = Object.fromEntries(m.filas[1].casillas.map((c) => [c.mes, mapa.texto(c)]));
  assert.deepEqual(caixa, {
    "2026-06": "Sin extracto", "2026-07": "Sin extracto", "2026-08": "Completo", "2026-09": "Completo", "2026-10": "Firmado", "2026-11": "Parcial (hasta el 14)",
  });
  assert.deepEqual(medio, {
    "2026-06": "Sin extracto", "2026-07": "Sin extracto", "2026-08": "Sin extracto", "2026-09": "Parcial (hasta el 20)", "2026-10": "Firmado", "2026-11": "Sin extracto",
  });
});

test("cada casilla lleva su acción: importar si falta extracto; nada si está completo o firmado", () => {
  const m = mapa.construir({ cuentas: CUENTAS, meses: ["2026-08", "2026-09"], hoy: HOY, cobertura: cob });
  assert.deepEqual(m.filas.map((f) => f.casillas.map((c) => c.accion)), [[null, null], ["importar", "importar"]]);
});

test("cada mes pasado sin firmar ofrece «firmar», con cuántas cuentas no lo tienen completo; el mes en curso, no", () => {
  const m = mapa.construir({ cuentas: CUENTAS, meses: mapa.ventana(HOY, 6), hoy: HOY, cobertura: cob, firmados: ["2026-10"] });
  const col = Object.fromEntries(m.columnas.map((c) => [c.mes, [c.accion, c.faltan]]));
  assert.deepEqual(col["2026-08"], ["firmar", 1]);
  assert.deepEqual(col["2026-09"], ["firmar", 1]);
  assert.deepEqual(col["2026-10"], [null, 0]);
  assert.deepEqual(col["2026-11"], [null, 2], "el mes en curso no se firma todavía");
  assert.deepEqual(m.sinFirmar, ["2026-06", "2026-07", "2026-08", "2026-09"]);
});

test("el siguiente paso: el mes sin firmar más antiguo y, si le falta un extracto, importarlo primero", () => {
  const m = mapa.construir({ cuentas: CUENTAS, meses: ["2026-08", "2026-09", "2026-10", "2026-11"], hoy: HOY, cobertura: cob, firmados: ["2026-10"] });
  assert.deepEqual(m.siguiente, { accion: "importar", mes: "2026-08", cuenta: "mediolanum" });
  const solo = mapa.construir({ cuentas: [CUENTAS[0]], meses: ["2026-08", "2026-09", "2026-10", "2026-11"], hoy: HOY, cobertura: cob, firmados: ["2026-10"] });
  assert.deepEqual(solo.siguiente, { accion: "firmar", mes: "2026-08" });
});

test("los meses futuros no tienen extracto ni acción de importar", () => {
  const m = mapa.construir({ cuentas: CUENTAS, meses: ["2026-11", "2026-12"], hoy: HOY, cobertura: cob });
  assert.equal(m.filas[0].casillas[1].estado, "sin-extracto");
  assert.equal(m.columnas[1].accion, null);
});

test("sin cuentas o sin ningún extracto en toda la ventana: vacío (la pantalla lo pliega a una línea)", () => {
  assert.equal(mapa.construir({ cuentas: [], meses: ["2026-10"], hoy: HOY }).vacio, true);
  assert.equal(mapa.construir({ cuentas: CUENTAS, meses: ["2026-05", "2026-06"], hoy: HOY, cobertura: cob }).vacio, true);
  assert.equal(mapa.construir({ cuentas: CUENTAS, meses: ["2026-08"], hoy: HOY, cobertura: cob }).vacio, false);
});

test("una cobertura cuyo hueco empieza el día 1 es «Parcial» sin «hasta»", () => {
  const rangos = [{ account: "caixabank", from: "2026-09-10", to: "2026-09-30", source: "declarado" }];
  const m = mapa.construir({ cuentas: [CUENTAS[0]], meses: ["2026-09"], hoy: HOY, cobertura: (a, mes) => cobertura.month(rangos, a, mes, HOY) });
  assert.equal(mapa.texto(m.filas[0].casillas[0]), "Parcial");
});
