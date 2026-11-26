const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// «Dar de alta varios contratos a la vez» (15/11/2026). Contratos INVENTADOS.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const C = require("../canonical-debt-contracts.js");

test("los importes se leen como se escriben en España o con punto decimal", () => {
  assert.equal(C.parseSpanishNumber("2.754,03"), 2754.03);
  assert.equal(C.parseSpanishNumber("2754.03"), 2754.03);
  assert.equal(C.parseSpanishNumber("1.250"), 1250, "un punto con tres cifras detrás es de millares");
  assert.equal(C.parseSpanishNumber("12.5"), 12.5);
  assert.equal(C.parseSpanishNumber(" 3 400,5 € "), 3400.5);
  assert.equal(C.parseSpanishNumber("8,5 %"), 8.5);
  assert.equal(C.parseSpanishNumber("0"), 0);
  assert.equal(C.parseSpanishNumber(""), null);
  assert.equal(C.parseSpanishNumber("tarjeta"), null);
  assert.equal(C.parseSpanishNumber("-5"), null, "un capital negativo no es un importe");
});

test("una línea por contrato: entidad y capital obligatorios; tipo, TAE y cuota, si se saben", () => {
  const { rows, errors } = C.parseBulkContracts([
    "Banco Ejemplo; tarjeta; 1.250,00; 21; 60",
    "",
    "  Financiera Ejemplo ; Préstamo ; 3400  ",
    "Entidad sin tipo; 980,5",
    "Con tabuladores\tCRÉDITO\t500\t\t25",
    "Con hueco en el tipo;; 700",
  ].join("\n"));
  assert.deepEqual(errors, []);
  assert.deepEqual(rows, [
    { line: 1, entity: "Banco Ejemplo", type: "Tarjeta", principal: 1250, apr: 21, payment: 60 },
    { line: 3, entity: "Financiera Ejemplo", type: "Préstamo", principal: 3400, apr: null, payment: null },
    { line: 4, entity: "Entidad sin tipo", type: "Crédito", principal: 980.5, apr: null, payment: null },
    { line: 5, entity: "Con tabuladores", type: "Crédito", principal: 500, apr: null, payment: 25 },
    { line: 6, entity: "Con hueco en el tipo", type: "Crédito", principal: 700, apr: null, payment: null },
  ]);
});

test("lo que no se entiende se dice con su línea y su porqué, sin inventar nada", () => {
  const { rows, errors } = C.parseBulkContracts(["; tarjeta; 100", "Banco A", "Banco B; leasing; 100", "Banco C; tarjeta; mucho", "Banco D; tarjeta; 100; alta", "Banco E; tarjeta; 100; 20; 30; 40", "Banco F; tarjeta; 100"].join("\n"));
  assert.deepEqual(rows.map((row) => row.entity), ["Banco F"]);
  assert.deepEqual(errors.map((item) => [item.line, item.error]), [
    [1, "falta el nombre de la entidad"],
    [2, "falta el capital pendiente"],
    [3, "no reconozco el tipo «leasing» (crédito, tarjeta, préstamo, hipoteca u otro)"],
    [4, "no entiendo el capital «mucho»"],
    [5, "no entiendo la TAE «alta»"],
    [6, "sobran campos: entidad; tipo; capital; TAE; cuota"],
  ]);
  assert.deepEqual(C.parseBulkContracts(""), { rows: [], errors: [] });
  assert.deepEqual(C.parseBulkContracts(null), { rows: [], errors: [] });
});

test("integración · la tarjeta está en Contratos, valida con las reglas del alta de siempre, entra todo o nada y no duplica", () => {
  const deuda = read("views/deuda.js");
  assert.match(deuda, /deudaContratosDetectadosHtml\(deudaContratosRecibos\(\)\)\}\$\{typeof deudaContratosVariosHtml === "function" \? deudaContratosVariosHtml\(\) : ""\}`;/);
  const alta = deuda.slice(deuda.indexOf("function deudaContratosVariosAlta()"), deuda.indexOf("function handleDeudaContratosDetectadosClick("));
  assert.match(alta, /deudaContratosAddFormParse\(\{ entity: row\.entity/);
  assert.match(alta, /if \(fallos\.length\) return decir\(`No he dado de alta nada\./);
  assert.match(alta, /if \(yaEstan\.has\(clave\(entry\)\)\) return;/);
  assert.match(alta, /showUndoToast\(hecho/);
  assert.match(deuda, /if \(event\.target\.closest\("\[data-deuda-varios-alta\]"\)\) return deudaContratosVariosAlta\(\);/);
  const html = read("index.html");
  // SVD-3, SVD-R1, SVD-4 y SVD-5 (17/11/2026) volvieron a subir la versión de los dos ficheros: lo que se vigila es que ambos se pidan de nuevo.
  assert.match(html, /canonical-debt-contracts\.js\?v=20261117svd4/);
  assert.match(read("app.js"), /"deuda-contratos": \{ src: "views\/deuda\.js\?v=(?:20261119refi1|20261121plan|20261121dn28|20261122dec29|20261122und13|20261125dn40|20261125tred4|20261125tred5)"/);
});
