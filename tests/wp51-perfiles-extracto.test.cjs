// WP-51 · perfiles de extracto con autodetección (canonical-statement-profiles.js + extracto-perfiles-ui.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../canonical-statement-profiles.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const bytesOf = (text, encoding = "utf8") => new Uint8Array(Buffer.from(text, encoding));
const cp1252 = (text) => new Uint8Array([...text].map((ch) => {
  const code = ch.charCodeAt(0);
  if (code < 0x100) return code;
  if (ch === "€") return 0x80;
  throw new Error(`no cabe en Windows-1252: ${ch}`);
}));

const BASE = [
  "Fecha;Fecha valor;Concepto;Importe;Saldo",
  "25/09/2026;25/09/2026;COMPRA SUPERMERCADO;-52,30;1.947,70",
  "27/09/2026;27/09/2026;NÓMINA EMPRESA;1.800,00;3.747,70",
  "30/09/2026;30/09/2026;RECIBO LUZ;-60,00;3.687,70",
].join("\r\n");

test("WP-51 · el formato de siempre (punto y coma, coma decimal, DD/MM/AAAA) se lee igual que antes", () => {
  const a = E.analyze(BASE);
  assert.equal(a.ok, true);
  assert.equal(a.delimiter, ";");
  assert.equal(a.decimal, "comma");
  assert.equal(a.dateOrder, "DMY");
  assert.deepEqual(a.transactions.map((t) => [t.date, t.amount, t.balance]), [["2026-09-25", -52.3, 1947.7], ["2026-09-27", 1800, 3747.7], ["2026-09-30", -60, 3687.7]]);
  assert.equal(a.transactions[1].movement, "NÓMINA EMPRESA");
  assert.equal(a.balanceCheck.status, "cuadra");
  assert.equal(a.errors.length, 0);
});

test("WP-51 · filas de título antes de la cabecera: se salta hasta la cabecera real y dice en qué fila está", () => {
  const csv = ["Movimientos de la cuenta ES00 0000 0000 00 0000000000", "Consulta;11/10/2026", "", BASE].join("\n");
  const a = E.analyze(csv);
  assert.equal(a.ok, true);
  assert.equal(a.headerLine, 4);
  assert.equal(a.transactions.length, 3);
});

test("WP-51 · el separador se decide por consistencia entre filas, no fila a fila: un concepto con comas no rompe un fichero de punto y coma", () => {
  const csv = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;PAGO TARJETA, TIENDA A, B, C;-12,50;100,00", "02/10/2026;OTRO;-1,00;99,00", "03/10/2026;MAS;-1,00;98,00"].join("\n");
  assert.equal(E.detectDelimiter(csv), ";");
  const a = E.analyze(csv);
  assert.equal(a.transactions[0].movement, "PAGO TARJETA, TIENDA A, B, C");
  assert.equal(a.transactions[0].amount, -12.5);
});

test("WP-51 · formato inglés: coma como separador, punto decimal, miles con coma, fecha ISO", () => {
  const csv = ["Date,Description,Amount,Balance", '2026-10-01,"RENT, OCTOBER",-1200.00,"3,800.00"', "2026-10-02,SALARY,\"2,500.00\",\"6,300.00\"", "2026-10-03,COFFEE,-3.50,\"6,296.50\""].join("\n");
  const a = E.analyze(csv);
  assert.equal(a.delimiter, ",");
  assert.equal(a.decimal, "dot");
  assert.deepEqual(a.transactions.map((t) => [t.date, t.movement, t.amount, t.balance]), [["2026-10-01", "RENT, OCTOBER", -1200, 3800], ["2026-10-02", "SALARY", 2500, 6300], ["2026-10-03", "COFFEE", -3.5, 6296.5]]);
});

test("WP-51 · fecha día/mes frente a mes/día: lo decide un valor imposible; si nada decide, se avisa y no se calla", () => {
  const decided = E.analyze(["Fecha;Importe", "25/03/2026;-10,00", "04/03/2026;-5,00"].join("\n"));
  assert.equal(decided.dateOrder, "DMY");
  assert.equal(decided.dateCertainty, "claro");
  const mdy = E.analyze(["Date;Amount", "03/25/2026;-10.00", "03/04/2026;-5.00"].join("\n"));
  assert.equal(mdy.dateOrder, "MDY");
  assert.equal(mdy.transactions[1].date, "2026-03-04");
  const ambiguous = E.analyze(["Fecha;Importe", "03/04/2026;-10,00", "05/06/2026;-5,00"].join("\n"));
  assert.equal(ambiguous.dateCertainty, "ambiguo");
  assert.ok(ambiguous.warnings.some((w) => w.code === "fecha-ambigua"), "el aviso de fecha ambigua existe");
  const fixed = E.analyze(["Fecha;Importe", "03/04/2026;-10,00", "05/06/2026;-5,00"].join("\n"), { overrides: { dateOrder: "MDY" } });
  assert.equal(fixed.transactions[0].date, "2026-03-04");
  assert.equal(fixed.transactions[1].date, "2026-05-06");
  assert.equal(fixed.dateCertainty, "fijado");
  assert.equal(fixed.warnings.some((w) => w.code === "fecha-ambigua"), false);
});

test("WP-51 · «1.234» sin más pistas es ambiguo (mil doscientos o uno con 234 milésimas): se avisa y el hogar lo fija", () => {
  const csv = ["Fecha;Concepto;Importe", "01/10/2026;A;1.234", "02/10/2026;B;-2.500"].join("\n");
  const a = E.analyze(csv);
  assert.equal(a.decimalCertainty, "ambiguo");
  assert.equal(a.transactions[0].amount, 1234);
  assert.ok(a.warnings.some((w) => w.code === "decimal-ambiguo"));
  const dot = E.analyze(csv, { overrides: { decimal: "dot" } });
  assert.equal(dot.transactions[0].amount, 1.23, "con punto decimal, 1.234 son 1,234 € → 1,23 € al céntimo (ya no 1.234 €)");
  assert.equal(dot.transactions[1].amount, -2.5);
});

test("WP-51 · un importe que no es un número claro es un error de ESA fila, nunca «lo que quede al quitar letras»", () => {
  assert.equal(E.parseNumber("abc12"), null);
  assert.equal(E.parseNumber("1.2.3"), null);
  assert.equal(E.parseNumber("12,5x"), null);
  assert.equal(E.parseNumber("1.234,56"), 1234.56);
  assert.equal(E.parseNumber("12,50-"), -12.5);
  assert.equal(E.parseNumber("(12,50)"), -12.5);
  assert.equal(E.parseNumber("−12,50 €"), -12.5);
  assert.equal(E.parseNumber("EUR 1.000"), 1000);
  const csv = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;OK;-10,00;100,00", "02/10/2026;ROTO;12abc;90,00", "32/10/2026;FECHA MALA;-1,00;89,00", "04/10/2026;;-2,00;87,00"].join("\n");
  const a = E.analyze(csv);
  assert.equal(a.transactions.length, 2, "la fila rota no entra ni como 12 ni como 0");
  assert.deepEqual(a.errors.map((e) => [e.line, e.code]), [[3, "importe"], [4, "fecha"]]);
  assert.equal(a.errors[0].reason, "importe no reconocido");
  assert.equal(a.errors[1].reason, "fecha no reconocida");
  assert.equal(a.transactions[1].movement, "(sin concepto)", "una fila con importe real y sin concepto se conserva");
  assert.ok(a.warnings.some((w) => w.code === "sin-concepto"));
  assert.ok(a.warnings.some((w) => w.code === "filas-con-error"));
});

test("WP-51 · debe/haber en dos columnas, y columna de signo D/H; una «C» suelta es un error, no una suposición", () => {
  const dh = ["Fecha;Concepto;Debe;Haber;Saldo", "01/10/2026;ALQUILER;900,00;;1.100,00", "02/10/2026;NÓMINA;;1.800,00;2.900,00", "03/10/2026;DOBLE;5,00;5,00;2.900,00", "04/10/2026;VACIA;;;2.900,00"].join("\n");
  const a = E.analyze(dh);
  assert.equal(a.signMode, "debe-haber");
  assert.deepEqual(a.transactions.map((t) => t.amount), [-900, 1800]);
  assert.deepEqual(a.errors.map((e) => e.code), ["debe-haber", "importe"]);
  const sign = ["Fecha;Concepto;Importe;D/H", "01/10/2026;A;10,00;D", "02/10/2026;B;20,00;H", "03/10/2026;C;30,00;C"].join("\n");
  const s = E.analyze(sign);
  assert.equal(s.signMode, "columna-signo");
  assert.deepEqual(s.transactions.map((t) => t.amount), [-10, 20]);
  assert.equal(s.errors[0].code, "signo");
});

test("WP-51 · codificación: UTF-8 con BOM, UTF-16 y Windows-1252 se leen con sus tildes y el euro", () => {
  const csv = ["Fecha;Concepto;Importe", "01/10/2026;NÓMINA AÑO €;1.000,00", "02/10/2026;CAFÉ;-2,00"].join("\r\n");
  const utf8 = E.analyze(new Uint8Array([0xef, 0xbb, 0xbf, ...bytesOf(csv)]));
  assert.equal(utf8.encoding, "utf-8");
  assert.equal(utf8.transactions[0].movement, "NÓMINA AÑO €");
  const w = E.analyze(cp1252(csv));
  assert.equal(w.encoding, "windows-1252");
  assert.equal(w.transactions[0].movement, "NÓMINA AÑO €");
  assert.ok(w.warnings.some((x) => x.code === "codificacion"));
  const u16 = new Uint8Array(2 + csv.length * 2);
  u16[0] = 0xff; u16[1] = 0xfe;
  [...csv].forEach((ch, i) => { u16[2 + i * 2] = ch.charCodeAt(0) & 0xff; u16[3 + i * 2] = ch.charCodeAt(0) >> 8; });
  const u = E.analyze(u16);
  assert.equal(u.encoding, "utf-16le");
  assert.equal(u.transactions.length, 2);
});

test("WP-51 · comillas: un campo con salto de línea y comillas dobles dentro no parte el registro, y las líneas siguen contando bien", () => {
  const csv = 'Fecha;Concepto;Importe\n01/10/2026;"LINEA 1\nLINEA ""2""";-5,00\n02/10/2026;FIN;-1,00\n03/10/2026;"SIN CERRAR;-1,00';
  const a = E.analyze(csv);
  assert.equal(a.transactions[0].movement, 'LINEA 1\nLINEA "2"');
  assert.equal(a.transactions[1].movement, "FIN");
  assert.deepEqual(a.errors.map((e) => [e.line, e.code]), [[5, "comillas"]], "el número de fila es el de la línea física del fichero");
});

test("WP-51 · fechas con hora, con mes en letra, AAAAMMDD y años de dos cifras", () => {
  assert.equal(E.parseDate("01/10/2026 13:45:22"), "2026-10-01");
  assert.equal(E.parseDate("2026-10-01T13:45:00Z"), "2026-10-01");
  assert.equal(E.parseDate("1 oct 2026"), "2026-10-01");
  assert.equal(E.parseDate("12 de diciembre de 2025"), "2025-12-12");
  assert.equal(E.parseDate("20261001"), "2026-10-01");
  assert.equal(E.parseDate("01-10-26"), "2026-10-01");
  assert.equal(E.parseDate("31/02/2026"), "");
  assert.equal(E.parseDate("13/13/2026"), "");
  assert.equal(E.parseDate("hola"), "");
});

test("WP-51 · el saldo audita el signo: si encaja al revés se avisa SIN corregir; «invertir el signo» lo arregla y cuadra", () => {
  const swapped = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;A;50,00;950,00", "02/10/2026;B;-100,00;1.050,00", "03/10/2026;C;20,00;1.030,00", "04/10/2026;D;30,00;1.000,00"].join("\n");
  const a = E.analyze(swapped);
  assert.equal(a.balanceCheck.status, "signo-invertido");
  assert.equal(a.transactions[0].amount, 50, "no se corrige solo");
  assert.ok(a.warnings.some((w) => w.code === "signo-invertido"));
  const fixed = E.analyze(swapped, { overrides: { invertSign: true } });
  assert.equal(fixed.transactions[0].amount, -50);
  assert.equal(fixed.balanceCheck.status, "cuadra");
  const desc = ["Fecha;Concepto;Importe;Saldo", "04/10/2026;D;-30,00;1.000,00", "03/10/2026;C;-20,00;1.030,00", "02/10/2026;B;100,00;1.050,00", "01/10/2026;A;-50,00;950,00"].join("\n");
  const d = E.analyze(desc);
  assert.equal(d.balanceCheck.status, "cuadra");
  assert.equal(d.balanceCheck.direction, "descendente");
  const broken = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;A;-5,00;100,00", "02/10/2026;B;-5,00;400,00", "03/10/2026;C;-5,00;7,00", "04/10/2026;D;-5,00;999,00"].join("\n");
  assert.equal(E.analyze(broken).balanceCheck.status, "no-cuadra");
});

test("WP-51 · sin cabecera reconocible: falla con motivo, sin inventar columnas, y a mano con papeles se lee", () => {
  const csv = ["01/10/2026;SUPER;-12,50;100,00", "02/10/2026;LUZ;-60,00;40,00", "03/10/2026;NOMINA;1.800,00;1.840,00"].join("\n");
  const a = E.analyze(csv);
  assert.equal(a.ok, false);
  assert.equal(a.failure.code, "cabecera");
  assert.ok(a.sample.length >= 1, "enseña las primeras filas para poder indicar las columnas");
  assert.deepEqual(a.columns.map((c) => c.role), ["", "", "", ""], "ofrece las columnas sin papel para asignarlos a mano");
  assert.equal(E.analyze(csv, { overrides: { columns: ["date", "movement", "amount", "balance"] } }).ok, true, "basta indicar los papeles: no hace falta decir también que no hay cabecera");
  const manual = E.analyze(csv, { overrides: { headerLine: 0, columns: ["date", "movement", "amount", "balance"] } });
  assert.equal(manual.ok, true);
  assert.equal(manual.transactions.length, 3);
  assert.equal(manual.signature, "sin-cabecera:4");
  assert.equal(E.profileFromAnalysis("Sin cabecera", manual), null, "sin cabecera no hay firma para reconocer el formato otra vez");
  const noSep = E.analyze("hola\nque tal\nadios");
  assert.equal(noSep.failure.code, "separador");
  assert.equal(E.analyze("   ").failure.code, "vacio");
});

test("WP-51 · cabeceras de otros nombres: «Fecha operación», «Descripción», «Cargos/Abonos», «Importe (EUR)», «Saldo disponible»", () => {
  assert.equal(E.headerRole("Fecha operación"), "date");
  assert.equal(E.headerRole("F. valor"), "valueDate");
  assert.equal(E.headerRole("Descripción"), "movement");
  assert.equal(E.headerRole("Importe (EUR)"), "amount");
  assert.equal(E.headerRole("Saldo disponible"), "balance");
  assert.equal(E.headerRole("Cargos"), "debit");
  assert.equal(E.headerRole("Abonos"), "credit");
  assert.equal(E.headerRole("Más datos"), "details");
  assert.equal(E.headerRole("Fecha valor"), "valueDate", "«fecha valor» no se confunde con «fecha»");
  assert.equal(E.headerRole("Cuenta"), "");
});

test("WP-51 · un perfil guardado se reconoce por la firma de la cabecera y fija lo que el hogar decidió; lo explícito pesa más que el perfil", () => {
  const csv = ["Fecha;Concepto;Importe;Saldo", "03/04/2026;A;-10,00;90,00", "05/06/2026;B;-5,00;85,00"].join("\n");
  const first = E.analyze(csv, { overrides: { dateOrder: "MDY" } });
  const profile = E.profileFromAnalysis("Mi banco", first);
  assert.equal(profile.dateOrder, "MDY");
  const again = E.analyze(csv, { profiles: [profile] });
  assert.equal(again.profile, "Mi banco");
  assert.equal(again.dateCertainty, "fijado");
  assert.equal(again.transactions[0].date, "2026-03-04");
  assert.equal(again.warnings.some((w) => w.code === "fecha-ambigua"), false);
  const over = E.analyze(csv, { profiles: [profile], overrides: { dateOrder: "DMY" } });
  assert.equal(over.transactions[0].date, "2026-04-03", "lo fijado explícitamente gana al perfil");
  const other = E.analyze(["Fecha;Descripción;Importe", "03/04/2026;A;-10,00"].join("\n"), { profiles: [profile] });
  assert.equal(other.profile, null, "otra cabecera, otro formato: el perfil no se aplica");
});

test("WP-51 · los perfiles se normalizan y acotan: máximo 12, sin duplicados por nombre ni firma, basura fuera", () => {
  assert.deepEqual(E.normalizeProfiles("x"), []);
  assert.deepEqual(E.normalizeProfiles([null, { name: "", delimiter: ";", signature: "a" }, { name: "n", delimiter: "?", signature: "a" }, { name: "n", delimiter: ";", signature: "sin-cabecera:3" }]), []);
  let list = [];
  for (let i = 0; i < 15; i += 1) list = E.upsertProfile(list, { name: `P${i}`, delimiter: ";", signature: `fecha|importe|${i}`, columns: ["date", "amount"] });
  assert.equal(list.length, 12);
  assert.equal(list[0].name, "P3", "salen los más antiguos");
  list = E.upsertProfile(list, { name: "p14", delimiter: ",", signature: "otra", columns: [] });
  assert.equal(list.filter((p) => p.name.toLowerCase() === "p14").length, 1, "mismo nombre (sin mayúsculas) sustituye");
  assert.equal(E.removeProfile(list, "P5").length, list.length - 1);
  assert.equal(E.normalizeProfiles([{ name: "n", delimiter: ";", signature: "s", columns: ["date", "nope"], decimal: "dot", dateOrder: "XYZ" }])[0].dateOrder, "DMY");
});

test("WP-51 · el diagnóstico para copiar lleva estructura y motivos, NUNCA el contenido de las celdas", () => {
  const csv = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;SECRETO-CONCEPTO-777;-91234,56;100,00", "xx/yy;OTRO-SECRETO;ZZZ-IMPORTE;5,00"].join("\n");
  const a = E.analyze(csv);
  const diag = E.diagnosticText(a);
  assert.match(diag, /fila 3: fecha no reconocida/);
  assert.match(diag, /separador: punto y coma/);
  for (const secret of ["SECRETO-CONCEPTO-777", "OTRO-SECRETO", "91234", "ZZZ-IMPORTE", "xx/yy", "2026-10-01"]) assert.equal(diag.includes(secret), false, `el diagnóstico no debe contener «${secret}»`);
});

// ---- Verdad conocida (WP-33): el mismo hogar sintético, escrito en seis formatos de banco distintos, debe leerse idéntico. ----
function ledgerFromHousehold(household) {
  const rows = household.observations.filter((o) => o.day).map((o) => ({ date: `${o.month}-${String(o.day).padStart(2, "0")}`, movement: o.label, amount: -o.amount }));
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.movement.localeCompare(b.movement));
  let balance = 5000;
  return rows.map((row) => { balance = Math.round((balance + row.amount) * 100) / 100; return { ...row, balance }; });
}
const es = (n) => n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const en = (n) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const dmy = (iso) => iso.split("-").reverse().join("/");
const mdy = (iso) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const quote = (s) => `"${s}"`;

const FORMATS = {
  "es · ; · coma · dd/mm/aaaa": (rows) => ["Fecha;Concepto;Importe;Saldo", ...rows.map((r) => `${dmy(r.date)};${r.movement};${es(r.amount)};${es(r.balance)}`)].join("\r\n"),
  "es · tabulador · con título": (rows) => ["EXTRACTO DE CUENTA", "Titular: ***", ["Fecha", "Descripción", "Importe", "Saldo"].join("\t"), ...rows.map((r) => [dmy(r.date), r.movement, es(r.amount), es(r.balance)].join("\t"))].join("\n"),
  "en · , · punto · iso · comillas": (rows) => ["Date,Description,Amount,Balance", ...rows.map((r) => [r.date, quote(r.movement), quote(en(r.amount)), quote(en(r.balance))].join(","))].join("\n"),
  "en · , · mm/dd/aaaa": (rows) => ["Date,Description,Amount,Balance", ...rows.map((r) => [mdy(r.date), quote(r.movement), quote(en(r.amount)), quote(en(r.balance))].join(","))].join("\n"),
  "es · debe/haber": (rows) => ["Fecha;Concepto;Debe;Haber;Saldo", ...rows.map((r) => `${dmy(r.date)};${r.movement};${r.amount < 0 ? es(-r.amount) : ""};${r.amount > 0 ? es(r.amount) : ""};${es(r.balance)}`)].join("\n"),
  "es · importe sin signo + D/H": (rows) => ["Fecha;Concepto;Importe;D/H;Saldo", ...rows.map((r) => `${dmy(r.date)};${r.movement};${es(Math.abs(r.amount))};${r.amount < 0 ? "D" : "H"};${es(r.balance)}`)].join("\n"),
};

test("WP-51 · hogar sintético (WP-33, verdad conocida) en seis formatos: todos se leen idénticos al libro original, con los saldos cuadrando", async () => {
  const { generateHousehold } = await import("../tools/build-synthetic-household.mjs");
  const household = generateHousehold({ seed: 51, months: 12 });
  const ledger = ledgerFromHousehold(household);
  assert.ok(ledger.length > 60, `el hogar sintético da movimientos suficientes (${ledger.length})`);
  // Con un mes que tenga día > 12 en alguna fila (siempre ocurre: hay cargos el día 25) el orden día/mes sale «claro».
  for (const [name, render] of Object.entries(FORMATS)) {
    const a = E.analyze(bytesOf(render(ledger)));
    assert.equal(a.errors.length, 0, `${name}: sin filas con error`);
    assert.equal(a.transactions.length, ledger.length, `${name}: mismo número de movimientos`);
    assert.deepEqual(a.transactions.map((t) => [t.date, t.amount, t.balance, t.movement]), ledger.map((r) => [r.date, r.amount, r.balance, r.movement]), `${name}: idéntico al libro`);
    assert.equal(a.balanceCheck.status, "cuadra", `${name}: los saldos cuadran`);
    assert.equal(a.warnings.filter((w) => w.code !== "filas-con-error").length, 0, `${name}: sin avisos`);
  }
});

test("WP-51 · pureza del motor: sin DOM, red, almacenamiento, reloj ni azar; y no trae ningún perfil «de banco» inventado", () => {
  const src = read("canonical-statement-profiles.js");
  assert.doesNotMatch(src, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest)\b/);
  assert.doesNotMatch(src, /Date\.now|new Date\(\)|Math\.random/);
  assert.doesNotMatch(src, /caixabank|santander|bbva|sabadell|bankinter|openbank|\bING\b/i, "no se inventa el formato de ningún banco concreto");
});

test("WP-51 · el motor no escribe nada: analizar no cambia la entrada ni devuelve referencias compartidas", () => {
  const input = bytesOf(BASE);
  const copy = Uint8Array.from(input);
  const profiles = [{ name: "x", delimiter: ";", signature: "y", columns: [] }];
  const snapshot = JSON.stringify(profiles);
  E.analyze(input, { profiles, overrides: { decimal: "comma" } });
  assert.deepEqual(input, copy);
  assert.equal(JSON.stringify(profiles), snapshot);
});

test("WP-51 · cableado: app.js lee el CSV con el motor y no con el parser antiguo; el panel y su almacén están en la copia", () => {
  const app = read("app.js");
  assert.match(app, /extractoPerfilesLeer\(file, new Uint8Array\(await file\.arrayBuffer\(\)\), globalThis\.FinanceCanonicalStatementProfiles\)/);
  assert.doesNotMatch(app, /parseMovementsFromCsvText|movementCsvHeaderKey/);
  assert.match(app, /"statement-profiles-data"/);
  assert.match(app, /id="extractoPerfilesPanel">\$\{extractoPerfilesHtml\(\)\}/);
  const html = read("index.html");
  assert.match(html, /canonical-statement-profiles\.js\?v=/);
  assert.match(html, /extracto-perfiles-ui\.js\?v=/);
  assert.match(html, /extracto-perfiles\.css\?v=/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    const src = read(file);
    for (const name of ["canonical-statement-profiles.js", "extracto-perfiles-ui.js", "extracto-perfiles.css"]) assert.ok(src.includes(name), `${file} lista ${name}`);
  }
  const ui = read("extracto-perfiles-ui.js");
  assert.doesNotMatch(ui, /storageSet\([^)]*(bytes|text|transactions)/, "el contenido del extracto no se guarda en ningún almacén");
});
