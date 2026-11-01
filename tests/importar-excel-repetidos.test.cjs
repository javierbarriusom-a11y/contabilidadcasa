const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// 1/11/2026, con el extracto real de CaixaBank del hogar (1.080 movimientos, 15 meses): al leer un Excel, la app juntaba
// los movimientos iguales del mismo día (dos Bizum de 75 €, dos retiradas de 20 €, dos recibos de 93,75 €) porque quitaba
// repetidos por fecha, concepto, detalle e importe, sin el saldo. Se perdían 18 filas, el cuadre no salía y la importación
// quedaba bloqueada. La limpieza era para varias hojas que se solapan; dentro de una hoja son cargos distintos.
// Movimientos INVENTADOS.
const app = codigoApp();
const body = app.slice(app.indexOf("function loadTransactionsFromWorkbook(workbook) {"), app.indexOf("function buildRollupsFromTransactions("));

function leer(hojas) {
  const context = {
    normalizedText: (v) => String(v || "").toLowerCase(),
    sheetLooksLikeMovementSheet: () => true,
    rowsFromMovementSheet: (workbook, sheetName, sourceRank) => hojas[sheetName].map((row, i) => ({ ...row, sourceRank, statementOrder: i + 1, month: row.date.slice(0, 7) })),
  };
  vm.createContext(context);
  vm.runInContext(`${body}; globalThis.__leer = loadTransactionsFromWorkbook;`, context);
  return JSON.parse(JSON.stringify(context.__leer({ SheetNames: Object.keys(hojas), Sheets: {} })));
}
const mov = (date, movement, amount, balance, details = "") => ({ date, movement, details, amount, balance });

test("dos movimientos iguales el mismo día en una hoja son dos cargos: no se juntan", () => {
  const filas = leer({ Movimientos: [mov("2026-09-30", "BIZUM ENVIADO", -75, 5129.56), mov("2026-09-30", "BIZUM ENVIADO", -65, 5204.56), mov("2026-09-30", "BIZUM ENVIADO", -75, 5269.56)] });
  assert.equal(filas.length, 3);
  assert.deepEqual(filas.filter((f) => f.amount === -75).map((f) => f.balance).sort(), [5129.56, 5269.56]);
});

test("sin saldo, los iguales de una misma hoja tampoco se juntan (el orden los distingue)", () => {
  const filas = leer({ Movimientos: [mov("2025-10-17", "REINT.CAJERO", -20, null), mov("2025-10-17", "REINT.CAJERO", -20, null)] });
  assert.equal(filas.length, 2);
});

test("varias hojas que se solapan: la misma fila cuenta una vez, y los repetidos legítimos se conservan", () => {
  const comunes = [mov("2025-08-06", "RECIBO EMITIDO PO", -93.75, 6587.7), mov("2025-08-06", "RECIBO EMITIDO PO", -93.75, 6681.45)];
  const filas = leer({ Enero: [...comunes, mov("2025-08-05", "NOMINA FICTICIA", 1500, 6775.2)], Febrero: [...comunes, mov("2025-08-07", "LUZ FICTICIA", -80, 6507.7)] });
  assert.equal(filas.length, 4, "los dos recibos (una vez cada uno), la nómina y la luz");
  assert.equal(filas.filter((f) => f.movement === "RECIBO EMITIDO PO").length, 2);
});
