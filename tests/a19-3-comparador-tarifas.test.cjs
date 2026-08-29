const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// A19-3 · Bloque 2: comparador educativo de tarifas fijas frente a variables. Calculadora puntual,
// sin persistir nada en scenarioSettings — lee los campos y muestra el resultado, mismo criterio que
// handleAjustesExportIcs (una acción, no un dato del hogar que se sincroniza).

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

function fieldSandbox(values) {
  const notes = {};
  const fields = { ...values };
  const context = {
    qs: (id) => (id === "ajustesTariffComparatorNote"
      ? { set textContent(value) { notes.result = value; }, get textContent() { return notes.result; } }
      : (id in fields ? { value: fields[id] } : null)),
    parseAmount: (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; },
    money: (value) => `${Number(value).toFixed(2)} €`,
    window: { FinanceCanonicalTariffComparator: require("../canonical-tariff-comparator.js") },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handleAjustesCompareTariffs"), context);
  context.handleAjustesCompareTariffs();
  return notes.result;
}

test("handleAjustesCompareTariffs · sin consumo, avisa en vez de dividir por cero", () => {
  const result = fieldSandbox({ ajustesTariffConsumption: "0" });
  assert.match(result, /consumo mensual mayor que 0/);
});

test("handleAjustesCompareTariffs · con datos válidos, muestra ambos costes y el veredicto", () => {
  const result = fieldSandbox({
    ajustesTariffConsumption: "300",
    ajustesTariffFixedPrice: "0.15",
    ajustesTariffVariablePrice: "0.20",
  });
  assert.match(result, /45\.00 €/);
  assert.match(result, /60\.00 €/);
  assert.match(result, /fija sale más barata/);
});

test("la calculadora vive en #ajustes con su botón y nota de resultado", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesTariffConsumption"/);
  assert.match(ajustes, /id="ajustesTariffFixedPrice"/);
  assert.match(ajustes, /id="ajustesTariffVariablePrice"/);
  assert.match(ajustes, /id="ajustesTariffFixedFee"/);
  assert.match(ajustes, /id="ajustesTariffVariableFee"/);
  assert.match(ajustes, /id="ajustesTariffCompare"/);
  assert.match(ajustes, /id="ajustesTariffComparatorNote"/);
});

test("el script del motor canónico está registrado en index.html", () => {
  assert.match(html, /canonical-tariff-comparator\.js\?v=/);
});

test("el botón Comparar está cableado y tiene ayuda contextual", () => {
  assert.match(app, /qs\("ajustesTariffCompare"\)\?\.addEventListener\("click", handleAjustesCompareTariffs\)/);
  assert.match(app, /qs\("ajustesTariffCompare"\)\?\.setAttribute\("data-help"/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual", () => {
  const body = extractFunction("handleAjustesCompareTariffs");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});
