const test = require("node:test");
const assert = require("node:assert/strict");
const lines = require("../canonical-statement-lines.js");

// XDA-03: de líneas de un extracto en PDF (texto pegado o filas rehechas por posición) a movimientos. Textos INVENTADOS en
// varias disposiciones; lo que hace fiable la lectura genérica es el cuadre con los saldos.

const read = (text, options) => lines.parse(lines.linesFromText(text), options);
const simple = (r) => r.transactions.map((t) => [t.date, t.movement, t.amount, t.balance]);

test("fechas e importes españoles, con y sin signo; lo que no es importe no se toma por importe", () => {
  assert.equal(lines.parseDate("05/10/2026"), "2026-10-05");
  assert.equal(lines.parseDate("5-10-26"), "2026-10-05");
  assert.equal(lines.parseDate("31/02/2026"), null);
  assert.equal(lines.parseDate("05/10", 2026), "2026-10-05");
  assert.equal(lines.parseDate("05/10"), null, "sin año de contexto no se inventa");
  assert.deepEqual(lines.parseAmount("1.234,56"), { value: 1234.56, signed: false });
  assert.deepEqual(lines.parseAmount("-86,40"), { value: -86.4, signed: true });
  assert.deepEqual(lines.parseAmount("86,40-"), { value: -86.4, signed: true });
  assert.deepEqual(lines.parseAmount("(86,40)"), { value: -86.4, signed: true });
  assert.deepEqual(lines.parseAmount("3.000,00€"), { value: 3000, signed: false });
  for (const bad of ["2026", "1.234", "12,5", "ES12", "1,234.56"]) assert.equal(lines.parseAmount(bad), null, bad);
});

test("importes con signo y saldo: fecha, fecha valor, concepto, importe y saldo; cuadra", () => {
  const r = read([
    "EXTRACTO DE CUENTA · CUENTA FICTICIA",
    "Fecha Fecha valor Concepto Importe Saldo",
    "Saldo anterior 5.080,00",
    "01/10/2026 01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00",
    "02/10/2026 02/10/2026 SUPER FICTICIO -86,40 7.993,60",
    "05/10/2026 06/10/2026 RECIBO LUZ FICTICIA -94,12 7.899,48",
  ].join("\n"));
  assert.deepEqual(simple(r), [["2026-10-01", "NOMINA FICTICIA", 3000, 8080], ["2026-10-02", "SUPER FICTICIO", -86.4, 7993.6], ["2026-10-05", "RECIBO LUZ FICTICIA", -94.12, 7899.48]]);
  assert.equal(r.transactions[2].valueDate, "2026-10-06");
  assert.equal(r.opening, 5080);
  assert.equal(r.balanceCheck.status, "cuadra");
  assert.deepEqual(r.errors, []);
});

test("importes SIN signo: el signo sale del saldo de cada fila (y del saldo anterior para la primera)", () => {
  const r = read([
    "Saldo anterior 5.080,00",
    "01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00",
    "02/10/2026 SUPER FICTICIO 86,40 7.993,60",
    "05/10/2026 LUZ FICTICIA 94,12 7.899,48",
  ].join("\n"));
  assert.deepEqual(r.transactions.map((t) => t.amount), [3000, -86.4, -94.12]);
  assert.equal(r.structure.inferredSigns, 3);
  assert.match(r.warnings.map((w) => w.code).join(), /signos-por-saldo/);
  assert.equal(r.balanceCheck.status, "cuadra");
});

test("sin saldo anterior, la primera fila sin signo queda dudosa y se dice; no se adivina", () => {
  const r = read(["01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00", "02/10/2026 SUPER FICTICIO 86,40 7.993,60"].join("\n"));
  assert.deepEqual(r.transactions.map((t) => t.amount), [-86.4]);
  assert.deepEqual(r.errors, [{ line: 1, reason: "no se sabe si es cargo o abono (sin saldo con que comprobarlo)" }]);
});

test("ni signos ni saldos: ningún importe se da por cargo o abono", () => {
  const r = read(["01/10/2026 NOMINA FICTICIA 3.000,00", "02/10/2026 SUPER FICTICIO 86,40"].join("\n"));
  assert.equal(r.transactions.length, 0);
  assert.equal(r.errors.length, 2);
});

test("texto pegado con las columnas partidas: los importes en la línea siguiente y el concepto en dos líneas", () => {
  const r = read([
    "Saldo anterior 5.080,00",
    "01/10/2026 NOMINA FICTICIA",
    "3.000,00 8.080,00",
    "02/10/2026 COMPRA TARJETA -86,40 7.993,60",
    "SUPER FICTICIO CENTRO",
  ].join("\n"));
  assert.deepEqual(simple(r), [["2026-10-01", "NOMINA FICTICIA", 3000, 8080], ["2026-10-02", "COMPRA TARJETA", -86.4, 7993.6]]);
  assert.equal(r.transactions[1].details, "SUPER FICTICIO CENTRO");
  assert.equal(r.balanceCheck.status, "cuadra");
});

test("orden descendente (lo más nuevo arriba) y fechas sin año, que toman el de la cabecera", () => {
  const r = read([
    "Movimientos del 01/10/2026 al 31/10/2026",
    "05/10 LUZ FICTICIA -94,12 7.899,48",
    "02/10 SUPER FICTICIO -86,40 7.993,60",
    "01/10 NOMINA FICTICIA 3.000,00 8.080,00",
  ].join("\n"));
  assert.equal(r.year, 2026);
  assert.deepEqual(r.transactions.map((t) => t.date), ["2026-10-05", "2026-10-02", "2026-10-01"]);
  assert.equal(r.balanceCheck.status, "cuadra");
  assert.equal(r.balanceCheck.direction, "descendente");
});

test("una fila que falta o se ha leído mal rompe el cuadre y se dice dónde", () => {
  const r = read(["Saldo anterior 5.080,00", "01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00", "05/10/2026 LUZ FICTICIA -94,12 7.899,48"].join("\n"));
  assert.equal(r.balanceCheck.status, "no-cuadra");
  assert.equal(r.balanceCheck.breakAt, 3);
  assert.match(r.warnings.find((w) => w.code === "saldo-no-cuadra").text, /desde la línea 3/);
});

test("filas rehechas por posición (pdf.js): por página y altura, de izquierda a derecha", () => {
  const items = [
    { str: "8.080,00", x: 500, y: 700, page: 1 }, { str: "01/10/2026", x: 40, y: 700.8, page: 1 }, { str: "NOMINA FICTICIA", x: 120, y: 700, page: 1 }, { str: "3.000,00", x: 420, y: 699.5, page: 1 },
    { str: "02/10/2026", x: 40, y: 680, page: 1 }, { str: "SUPER FICTICIO", x: 120, y: 680, page: 1 }, { str: "-86,40", x: 420, y: 680, page: 1 }, { str: "7.993,60", x: 500, y: 680, page: 1 },
    { str: "05/10/2026", x: 40, y: 760, page: 2 }, { str: "LUZ FICTICIA", x: 120, y: 760, page: 2 }, { str: "-94,12", x: 420, y: 760, page: 2 }, { str: "7.899,48", x: 500, y: 760, page: 2 },
  ];
  const ls = lines.linesFromItems(items);
  assert.deepEqual(ls.map((l) => l.text), ["01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00", "02/10/2026 SUPER FICTICIO -86,40 7.993,60", "05/10/2026 LUZ FICTICIA -94,12 7.899,48"]);
  const r = lines.parse(ls);
  assert.equal(r.transactions.length, 3);
  assert.equal(r.balanceCheck.status, "cuadra");
});

test("el diagnóstico lleva estructura, nunca conceptos, importes ni fechas", () => {
  const r = read(["Saldo anterior 5.080,00", "01/10/2026 NOMINA FICTICIA 3.000,00 8.080,00", "02/10/2026 SUPER FICTICIO"].join("\n"));
  const d = JSON.stringify(lines.diagnostic(r));
  assert.doesNotMatch(d, /NOMINA|SUPER|3\.000|8\.080|2026-10|01\/10/);
  assert.match(d, /movimiento sin importe/);
});

// 31/10/2026: una cuenta (Banco Mediolanum) no da CSV, Excel ni PDF; lo que queda es copiar la lista de movimientos de su web.
// Al pegarla llegan formatos de web que el lector no entendía: el «€» separado del importe, la fecha con el mes en letra
// (con o sin año) y cada dato en su línea. Textos INVENTADOS.
test("copiado de la web: tabla con tabuladores y «€» suelto, que no corta los importes", () => {
  const r = read("Fecha\tConcepto\tImporte\tSaldo\n31/10/2026\tCOMPRA SUPER FICTICIO\t-86,40 €\t1.913,60 €\n30/10/2026\tNOMINA FICTICIA\t+2.000,00 €\t2.000,00 €");
  assert.deepEqual(simple(r), [["2026-10-31", "COMPRA SUPER FICTICIO", -86.4, 1913.6], ["2026-10-30", "NOMINA FICTICIA", 2000, 2000]]);
  assert.equal(r.balanceCheck.status, "cuadra");
  assert.deepEqual(r.errors, []);
  assert.deepEqual(simple(read("15/10/2026 RECIBO EUR FICTICIO -38,00 EUR 1.000,00 EUR")), [["2026-10-15", "RECIBO FICTICIO", -38, 1000]]);
});

test("copiado de la web: fecha con el mes en letra, con año o con el del contexto", () => {
  const r = read("31 oct. 2026\tCOMPRA SUPER FICTICIO\t-86,40 €\t1.913,60 €\n30 de octubre de 2026\tNOMINA FICTICIA\t2.000,00 €\t2.000,00 €");
  assert.deepEqual(simple(r).map((t) => t[0]), ["2026-10-31", "2026-10-30"]);
  assert.equal(r.balanceCheck.status, "cuadra");
  // «12 MESES» en el concepto no es una fecha: el número va detrás de la fecha, no delante de un mes.
  assert.deepEqual(simple(read("15/10/2026 RECIBO 12 MESES SEGURO FICTICIO -38,00 1.000,00")), [["2026-10-15", "RECIBO 12 MESES SEGURO FICTICIO", -38, 1000]]);
  // Sin ningún año en el texto: el de hoy, y lo que caería en el futuro es del año anterior («31 dic» pegado en enero).
  assert.deepEqual(simple(read("31 oct\tCOMPRA SUPER FICTICIO\t-86,40 €", { today: "2026-10-31" })), [["2026-10-31", "COMPRA SUPER FICTICIO", -86.4, null]]);
  assert.deepEqual(simple(read("31 dic\tCOMPRA SUPER FICTICIO\t-86,40 €", { today: "2027-01-02" })), [["2026-12-31", "COMPRA SUPER FICTICIO", -86.4, null]]);
  assert.equal(read("31 oct\tCOMPRA SUPER FICTICIO\t-86,40 €").transactions.length, 0, "sin año ni hoy no se inventa");
});

test("copiado de la web: cada dato en su línea (fecha, concepto, importe y saldo), con el signo sacado del saldo", () => {
  const r = read("31/10/2026\nCOMPRA SUPER FICTICIO\n86,40 €\n1.913,60 €\n30/10/2026\nNOMINA FICTICIA\n2.000,00 €\n2.000,00 €\nSaldo anterior 0,00 €");
  assert.deepEqual(simple(r), [["2026-10-31", "COMPRA SUPER FICTICIO", -86.4, 1913.6], ["2026-10-30", "NOMINA FICTICIA", 2000, 2000]]);
  assert.equal(r.balanceCheck.status, "cuadra");
});
