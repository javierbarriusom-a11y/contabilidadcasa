const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// ESX2 (Oleada 2 Bloque 3): plantillas de eventos de vida. Extiende el constructor de eventos
// (A8-2, los 7 tipos ya existentes en canonical-e13-scenarios.js) con nombres reales que un hogar
// reconoce ("nace un hijo", "boda") en vez de tener que adivinar a qué tipo abstracto corresponde
// su situación. Nunca fija un importe ni una duración por el hogar — solo el tipo, y limpia el
// importe genérico de partida (500) para forzar que se declare el real.

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

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function templateSandbox() {
  const fields = { e13EventType: { value: "expense" }, e13EventAmount: { value: "500" } };
  const context = { qs: (id) => fields[id] || null };
  vm.createContext(context);
  vm.runInContext([extractConst("ESX2_EVENT_TEMPLATES"), extractFunction("applyE13EventTemplate")].join("\n"), context);
  // Un `const` de nivel superior en vm.runInContext no queda como propiedad enumerable del
  // sandbox — se recupera con una segunda evaluación en el mismo contexto (misma ligadura léxica).
  context.ESX2_EVENT_TEMPLATES = vm.runInContext("ESX2_EVENT_TEMPLATES", context);
  return { context, fields };
}

test("ESX2_EVENT_TEMPLATES · cubre los 7 tipos de evento ya existentes, ninguno inventado", () => {
  const { context } = templateSandbox();
  const knownTypes = ["income-loss", "expense", "car", "move", "debt", "market-crash", "property-revaluation"];
  const templateTypes = new Set(context.ESX2_EVENT_TEMPLATES.map((item) => item.type));
  templateTypes.forEach((type) => assert.ok(knownTypes.includes(type), `${type} no es uno de los 7 tipos de A8-2`));
  assert.equal(new Set(knownTypes.filter((type) => templateTypes.has(type))).size, knownTypes.length, "las plantillas deben cubrir los 7 tipos");
});

test("applyE13EventTemplate · fija el tipo de la plantilla y limpia el importe genérico", () => {
  const { context, fields } = templateSandbox();
  context.applyE13EventTemplate("child");
  assert.equal(fields.e13EventType.value, "expense");
  assert.equal(fields.e13EventAmount.value, "");
});

test("applyE13EventTemplate · cada plantilla mapea al tipo correcto", () => {
  const { context, fields } = templateSandbox();
  context.applyE13EventTemplate("car");
  assert.equal(fields.e13EventType.value, "car");
  context.applyE13EventTemplate("market-crash");
  assert.equal(fields.e13EventType.value, "market-crash");
});

test("applyE13EventTemplate · plantilla desconocida o vacía (\"-- Elige una plantilla --\"), no toca nada", () => {
  const { context, fields } = templateSandbox();
  context.applyE13EventTemplate("");
  assert.equal(fields.e13EventType.value, "expense");
  assert.equal(fields.e13EventAmount.value, "500");
});

test("applyE13EventTemplate · nunca fija una duración por el hogar", () => {
  const block = extractFunction("applyE13EventTemplate");
  assert.doesNotMatch(block, /Duration|duration/);
});

test("index.html: el selector de plantillas vive dentro del constructor de eventos, con las mismas 9 opciones", () => {
  const formStart = html.indexOf('id="e13EventBuilder"');
  const formEnd = html.indexOf("</form>", formStart);
  const form = html.slice(formStart, formEnd);
  assert.match(form, /id="esx2EventTemplate"/);
  ["Nace un hijo", "Boda", "Compra de coche", "Mudanza", "Reducción de jornada", "Jubilación anticipada", "Pago extra de una deuda", "Caída de mercado", "Revalorización del inmueble"].forEach((label) => {
    assert.match(form, new RegExp(label), `Falta la plantilla "${label}"`);
  });
});

test("app.js: el selector de plantillas está cableado", () => {
  assert.match(app, /qs\("esx2EventTemplate"\)\?\.addEventListener\("change", \(event\) => applyE13EventTemplate\(event\.target\.value\)\);/);
});
