const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// DI1 · Bloque 4: hipoteca variable → fija bajo escenarios de tipos. Calculadora puntual, sin
// persistir nada en scenarioSettings — mismo criterio que A19-3 (comparador de tarifas).

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
    qs: (id) => (id === "ajustesMortgageScenariosNote"
      ? {
        set innerHTML(value) { notes.result = value; }, get innerHTML() { return notes.result; },
        set textContent(value) { notes.result = value; }, get textContent() { return notes.result; },
      }
      : (id in fields ? { value: fields[id] } : null)),
    parseAmount: (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; },
    money: (value) => `${Number(value).toFixed(2)} €`,
    escapeHtml: (v) => String(v ?? ""),
    window: { FinanceCanonicalMortgageRateScenarios: require("../canonical-mortgage-rate-scenarios.js") },
  };
  vm.createContext(context);
  // APX5 (Oleada 2 Bloque 2) extendió esta misma función con el punto de equilibrio de refinanciar
  // — necesita apx5RefinancingBreakEvenHtml cargada en el mismo sandbox.
  vm.runInContext(extractFunction("apx5RefinancingBreakEvenHtml"), context);
  vm.runInContext(extractFunction("handleDi1CompareMortgageScenarios"), context);
  context.handleDi1CompareMortgageScenarios();
  return notes.result;
}

test("handleDi1CompareMortgageScenarios · sin capital, avisa en vez de comparar", () => {
  const result = fieldSandbox({ ajustesMortgagePrincipal: "0" });
  assert.match(result, /capital pendiente/);
});

test("handleDi1CompareMortgageScenarios · con datos válidos, muestra los tres escenarios con veredicto", () => {
  const result = fieldSandbox({
    ajustesMortgagePrincipal: "120000",
    ajustesMortgageMonths: "240",
    ajustesMortgageVariableRate: "3",
    ajustesMortgageFixedRate: "3.5",
  });
  assert.match(result, /Base/);
  assert.match(result, /Favorable/);
  assert.match(result, /Tensión/);
  assert.match(result, /más barata/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual", () => {
  const body = extractFunction("handleDi1CompareMortgageScenarios");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

test("la calculadora vive en #ajustes con sus campos (los cuatro originales más el de APX5), botón y nota", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesMortgagePrincipal"/);
  assert.match(ajustes, /id="ajustesMortgageMonths"/);
  assert.match(ajustes, /id="ajustesMortgageVariableRate"/);
  assert.match(ajustes, /id="ajustesMortgageFixedRate"/);
  // APX5: coste total de refinanciar, no solo el tipo.
  assert.match(ajustes, /id="ajustesMortgageRefinancingCost"/);
  assert.match(ajustes, /id="ajustesMortgageScenariosCompare"/);
  assert.match(ajustes, /id="ajustesMortgageScenariosNote"/);
});

test("el botón está cableado y tiene ayuda contextual", () => {
  assert.match(app, /qs\("ajustesMortgageScenariosCompare"\)\?\.addEventListener\("click", handleDi1CompareMortgageScenarios\)/);
  assert.match(app, /qs\("ajustesMortgageScenariosCompare"\)\?\.setAttribute\("data-help"/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-mortgage-rate-scenarios\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-mortgage-rate-scenarios\.js"/);
});
