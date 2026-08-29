const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// A15-5 · Bloque 2: registro de tablas fiscales, mismo patrón que TT3/TT4/SP1 — un array simple en
// scenarioSettings, sin cálculo fiscal propio.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const scenarioSettings = {};
  const context = {
    scenarioSettings,
    saveScenarioSettings: () => {},
  };
  vm.createContext(context);
  vm.runInContext(["taxTables", "addTaxTable", "removeTaxTable"].map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

test("addTaxTable · normaliza etiqueta y año; un año fuera de rango se descarta", () => {
  const context = sandbox();
  context.addTaxTable({ year: 1500, label: "  ", source: "", notes: "" });
  const table = context.taxTables()[0];
  assert.equal(table.label, "Tabla fiscal");
  assert.equal(table.year, null);
});

test("addTaxTable · un año válido se conserva como número", () => {
  const context = sandbox();
  context.addTaxTable({ year: "2026", label: "IRPF 2026", source: "AEAT" });
  const table = context.taxTables()[0];
  assert.equal(table.year, 2026);
  assert.equal(table.source, "AEAT");
});

test("removeTaxTable · retira la tabla por id", () => {
  const context = sandbox();
  context.addTaxTable({ year: 2026, label: "IRPF 2026" });
  const id = context.taxTables()[0].id;
  context.removeTaxTable(id);
  assert.equal(context.taxTables().length, 0);
});

test("el formulario y el registro de tablas fiscales viven en #ajustes", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesTaxTableYear"/);
  assert.match(ajustes, /id="ajustesTaxTableLabel"/);
  assert.match(ajustes, /id="ajustesTaxTableSource"/);
  assert.match(ajustes, /id="ajustesTaxTableNotes"/);
  assert.match(ajustes, /id="ajustesTaxTableAdd"/);
  assert.match(ajustes, /id="ajustesTaxTables"/);
  assert.match(ajustes, /id="ajustesTaxTablesNote"/);
});

test("el script del motor canónico está registrado en index.html", () => {
  assert.match(html, /canonical-tax-tables\.js\?v=/);
});

test("los listeners de añadir y quitar tablas fiscales están cableados", () => {
  assert.match(app, /qs\("ajustesTaxTableAdd"\)\?\.addEventListener\("click", addTaxTableFromControls\)/);
  assert.match(app, /data-tax-table-remove/);
});

test("renderAjustes rellena el registro de tablas fiscales", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderTaxTables\(\);/);
});

test("renderTaxTables usa taxTableStatus para avisar de la actualización anual pendiente", () => {
  const start = app.indexOf("function renderTaxTables(");
  assert.ok(start >= 0, "No existe renderTaxTables en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /FinanceCanonicalTaxTables\?\.taxTableStatus\(tables, new Date\(\)\.getFullYear\(\)\)/);
});
