const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// P3 (D-N58, 28/11/2026): el error de un formulario, en su campo y no en el globo del navegador (errores-campo.js).
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const fuente = read("errores-campo.js");

function cargar() {
  const oyentes = {};
  const context = { document: { addEventListener: (tipo, fn, captura) => { oyentes[tipo] = { fn, captura }; } }, setTimeout: (fn) => fn(), CSS: { escape: (v) => v } };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fuente, context);
  return { api: context.FinanceErroresCampo, oyentes };
}

const campo = (validity, extra = {}) => ({ validity, tagName: "INPUT", type: "text", closest: () => ({ querySelector: () => ({ textContent: "Concepto" }) }), getAttribute: () => null, ...extra });

test("P3 · el texto del error, en lenguaje del hogar y con el nombre del campo", () => {
  const { api } = cargar();
  assert.equal(api.textoDe(campo({ valueMissing: true })), "Falta «Concepto».");
  assert.equal(api.textoDe(campo({ valueMissing: true }, { tagName: "SELECT" })), "Elige «Concepto».");
  assert.equal(api.textoDe(campo({ rangeUnderflow: true }, { min: "0" })), "Concepto tiene que ser 0 o más.");
  assert.equal(api.textoDe(campo({ badInput: true })), "«Concepto» no se entiende: revisa lo escrito.");
});

test("P3 · un solo oyente para toda la app: `invalid` en captura (no burbujea), y se corrige al escribir; al cerrar o vaciar, se limpia", () => {
  const { oyentes } = cargar();
  assert.equal(oyentes.invalid?.captura, true);
  assert.ok(oyentes.input && oyentes.change, "al corregir el campo, el error se va");
  assert.ok(oyentes.close && oyentes.reset, "los errores de la vez anterior no se quedan");
  assert.match(fuente, /event\.preventDefault\(\); \/\/ sin globo/);
  assert.match(fuente, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(fuente, /aria-describedby/);
});

test("P3 · se carga antes que app.js; «Registrar gasto» dice el importe que no se entiende junto a su campo", () => {
  assert.ok(html.indexOf('src="errores-campo.js?v=') > 0 && html.indexOf('src="errores-campo.js?v=') < html.indexOf('src="app.js?v='));
  assert.ok(read("service-worker.js").includes('"./errores-campo.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"errores-campo.js"'));
  const { codigoApp } = require("./helpers/codigo-app.cjs");
  assert.match(codigoApp(), /FinanceErroresCampo\?\.mostrarError\(qs\("homeQuickExpenseAmount"\), "Escribe un importe mayor que 0, p\. ej\. 12,50\."\)/);
});
