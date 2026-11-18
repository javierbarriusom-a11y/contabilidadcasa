// DEC-13 (18/11/2026): la huella anónima del extracto. Lo que importa es lo que NO sale: ni importes, ni fechas, ni nombres,
// ni comercios, ni referencias, ni cuentas. Y que lo que sí sale sirva para diseñar señales de Clasificar (cómo se pagó,
// cuántos conceptos distintos, cuántos emisores se repiten con importe y día fijos). Movimientos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Huella = require("../canonical-extract-fingerprint.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const rows = [
  { movement: "BIZUM ENVIADO LUCIA FICTICIA CENA VIERNES", details: "", amount: -25, date: "2026-10-03", account: "Banco FICTICIO" },
  { movement: "BIZUM ENVIADO LUCIA FICTICIA REGALO", details: "", amount: -40, date: "2026-11-03", account: "Banco FICTICIO" },
  { movement: "RECIBO LUZ FICTICIA SA 1234567890", details: "", amount: -61.2, date: "2026-09-05", account: "Banco FICTICIO" },
  { movement: "RECIBO LUZ FICTICIA SA 9876543210", details: "", amount: -63, date: "2026-10-06", account: "Banco FICTICIO" },
  { movement: "RECIBO LUZ FICTICIA SA 5555500000", details: "", amount: -60.45, date: "2026-11-04", account: "Caja FICTICIA" },
  { movement: "COMPRA TARJ. 5402XXXX1234 SUPER FICTICIO VALDEPEÑAS", details: "Ref. ES9121000418450200051332", amount: -33.4, date: "2026-11-10", account: "Banco FICTICIO" },
  { movement: "FINANCIE-OCTUBRE", details: "", amount: -90, date: "2026-10-01", account: "Banco FICTICIO" },
  { movement: "TRANSFERENCIA DE PEDRO FICTICIO", details: "", amount: 300, date: "2026-11-12", account: "Caja FICTICIA" },
];

const build = (extra = {}) => Huella.build({ rows, totals: { movimientos: 50, traspasos: 2 }, mes: "noviembre de 2026", cobertura: "Gasto importado con partida (últimos 90 días): 71 % · objetivo 95 %", ...extra });

test("DEC-13 · la forma: solo las palabras de cómo se pagó; lo demás, por su forma", () => {
  assert.equal(Huella.shapeOf("BIZUM ENVIADO LUCIA FICTICIA CENA"), "BIZUM · ENVIADO · palabras");
  assert.equal(Huella.shapeOf("RECIBO LUZ FICTICIA SA 1234567890"), "RECIBO · palabras · número de 10 cifras");
  assert.equal(Huella.shapeOf("COMPRA TARJ. 5402XXXX1234 SUPER FICTICIO"), "COMPRA · TARJ · código · palabras");
  assert.equal(Huella.shapeOf("FINANCIE-OCTUBRE"), "palabras · mes");
  assert.equal(Huella.shapeOf("Pago en Valdepeñas 12/11"), "PAGO · palabras · número de 2 cifras · número de 2 cifras");
  assert.equal(Huella.shapeOf(""), "(vacío)");
  // Las palabras seguidas no dicen cuántas eran: un nombre de tres palabras y uno de una dan la misma forma.
  assert.equal(Huella.shapeOf("BIZUM ANA"), Huella.shapeOf("BIZUM MARIA DEL MAR GARCIA"));
});

test("DEC-13 · lo que NO sale: importes, fechas, nombres, comercios, referencias ni cuentas", () => {
  // Sin la frase del % de Clasificar (la añade la pantalla y dice «últimos 90 días»), para buscar cifras sin falsos positivos.
  const { text } = build({ cobertura: "" });
  const prohibidas = ["LUCIA", "FICTICIA", "FICTICIO", "CENA", "REGALO", "LUZ", "SUPER", "VALDEPE", "PEDRO", "FINANCIE", "OCTUBRE", "Banco", "Caja", "XXXX", "ES91"];
  prohibidas.forEach((palabra) => assert.doesNotMatch(text, new RegExp(palabra, "i"), palabra));
  ["25", "40", "61,2", "61.2", "63", "60,45", "33,4", "90", "300", "1234567890", "5402", "2026-", "/11", "€"].forEach((cifra) => assert.ok(!text.includes(cifra), cifra));
  // Ningún número de tarjeta o cuenta (el patrón de tools/check-public-privacy.mjs) y ningún número de 3 cifras o más salvo el año del mes.
  assert.doesNotMatch(text, /\b(?:\d[ -]?){13,19}\b/);
  assert.deepEqual(text.match(/\d{3,}/g), ["2026"]);
  assert.match(text.split("\n")[1], /Sin importes, fechas, nombres, comercios, referencias, cuentas ni el detalle/);
});

test("DEC-13 · lo que sí sale: por forma, cuántos, en cuántas cuentas, conceptos distintos y emisores que se repiten", () => {
  const { forms, text } = build();
  const recibo = forms.find((form) => form.shape === "RECIBO · palabras · número de 10 cifras");
  assert.deepEqual(
    { count: recibo.count, accounts: recibo.accounts, concepts: recibo.concepts, issuers: recibo.issuers, recurring: recibo.recurring, steadyAndSameDay: recibo.steadyAndSameDay },
    { count: 3, accounts: 2, concepts: 3, issuers: 1, recurring: 1, steadyAndSameDay: 1 },
  );
  // El Bizum a la misma persona se repite, pero con otro importe: ni «importe fijo» ni «día fijo».
  const bizum = forms.find((form) => form.shape === "BIZUM · ENVIADO · palabras");
  assert.equal(bizum.recurring, 1);
  assert.equal(bizum.steadyAndSameDay + bizum.steadyOnly, 0);
  // La primera, la que más movimientos tiene; el ingreso se dice ingreso; el detalle va aparte.
  assert.match(text, /\n1\. RECIBO · palabras · número de 10 cifras — gasto · 3 movimientos · 2 cuentas · 3 conceptos distintos · 1 emisor · 1 en varios meses \(1 con importe y día fijos\)/);
  assert.match(text, /TRANSFERENCIA · palabras — ingreso · 1 movimiento/);
  assert.match(text, /COMPRA · TARJ · código · palabras \/ detalle: REF · código — gasto/);
  assert.match(text, /50 movimientos con importe · 8 sin partida en 5 formas · 2 traspasos entre cuentas propias/);
  assert.match(text, /71 % · objetivo 95 %/);
});

test("DEC-13 · el día fijo admite ± 3 días; el importe, ± 10 %", () => {
  const recibo = (date, amount) => ({ movement: "RECIBO AGUA FICTICIA", amount, date, account: "Banco FICTICIO" });
  const dia = Huella.build({ rows: [recibo("2026-09-02", -40), recibo("2026-10-05", -40), recibo("2026-11-09", -40)] }).forms[0];
  assert.equal(dia.steadyAndSameDay, 0, "el 9 cae a cuatro días del 5");
  assert.equal(dia.steadyOnly, 1);
  const importe = Huella.build({ rows: [recibo("2026-09-05", -40), recibo("2026-10-05", -40), recibo("2026-11-05", -46)] }).forms[0];
  assert.equal(importe.steadyAndSameDay + importe.steadyOnly, 0, "un 15 % más no es el mismo importe");
});

test("DEC-13 · sin movimientos sin partida lo dice; con muchas formas, corta en 40 y dice cuántas quedan", () => {
  assert.match(Huella.build({ rows: [] }).text, /No queda ningún movimiento sin partida/);
  const muchas = Array.from({ length: 45 }, (_, index) => ({ movement: `RECIBO ${"9".repeat(index + 1)}`, amount: -10, date: "2026-11-01" }));
  const { text, forms } = Huella.build({ rows: muchas });
  assert.equal(forms.length, 45);
  assert.equal((text.match(/^\d+\. /gm) || []).length, Huella.MAX_FORMS);
  assert.match(text, /… y 5 formas más con menos movimientos\./);
});

test("DEC-13 · la pantalla: plegada en Ajustes › Uso de la app, sin titular, enseña lo que copia y lo mide", () => {
  const html = read("index.html");
  const at = html.indexOf('id="huellaExtractoCard"');
  assert.ok(at > html.indexOf('id="ajustes-uso-app"') && at < html.indexOf('id="usoAppCard"'));
  assert.match(html, /<details class="e19-card prevision-calidad-card huella-extracto-card" id="huellaExtractoCard">\s*<summary>Huella anónima del extracto \(para mejorar Clasificar\)<\/summary>/);
  const tarjeta = html.slice(at, html.indexOf("</details>", at));
  assert.doesNotMatch(tarjeta, /<h[1-6]/, "XGO-01: sin titulares nuevos");
  assert.ok(html.indexOf('src="canonical-extract-fingerprint.js?v=') > 0 && html.indexOf('src="views/huella-extracto.js?v=') > html.indexOf('src="views/clasificar-v2.js?v='));
  const ui = read("views/huella-extracto.js");
  assert.doesNotMatch(ui, /^(let|const|var) /m, "solo funciones a nivel superior");
  assert.match(ui, /movementIsInternalTransfer\(row\)/);
  assert.match(ui, /!mappingForMovement\(row\)/);
  assert.match(ui, /\.value = huella\.text/, "lo que se ve es lo que se copia");
  assert.match(ui, /FinanceMedidor\?\.anotar\("huella-extracto", "vista"\)/);
  assert.match(ui, /FinanceMedidor\?\.anotar\("huella-extracto", "accion"\)/);
  assert.ok(require("../medidor-utilidad.js").FUNCIONES.some((item) => item.id === "huella-extracto"));
  assert.match(read("service-worker.js"), /"\.\/canonical-extract-fingerprint\.js",/);
  assert.match(read("service-worker.js"), /"\.\/views\/huella-extracto\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-extract-fingerprint\.js",/);
});
