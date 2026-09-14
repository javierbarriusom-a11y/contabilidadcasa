const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// LPX6 (sesión 192, BACKLOG_SUCESION_Y_CONTINUIDAD.md): el inventario de pólizas (SP1) no declaraba
// beneficiario. Añade "isLife" y "beneficiary" al registro — ambos declarados por el hogar, nunca
// inferidos del nombre de la póliza — para que LPX3 pueda comprobar de verdad si al menos una
// póliza de vida tiene beneficiario, en vez de una casilla manual global sin dato detrás.

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
    round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100,
    scenarioSettings,
    saveScenarioSettings: () => {},
  };
  vm.createContext(context);
  vm.runInContext(
    ["insurancePolicies", "addInsurancePolicy", "removeInsurancePolicy"].map((name) => extractFunction(name)).join("\n"),
    context,
  );
  return context;
}

test("addInsurancePolicy · sin declarar isLife ni beneficiary, quedan en false/vacío — nunca inferidos", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro de hogar", renewalDate: "2027-01-01" });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.isLife, false);
  assert.equal(policy.beneficiary, "");
});

test("addInsurancePolicy · un nombre que dice 'vida' no activa isLife por su cuenta", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro de vida", renewalDate: "2027-01-01" });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.isLife, false, "isLife se declara aparte, nunca se lee del nombre");
});

test("addInsurancePolicy · isLife y beneficiary declarados se guardan tal cual, el beneficiario recortado", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro de vida", renewalDate: "2027-01-01", isLife: true, beneficiary: "  Cónyuge  " });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.isLife, true);
  assert.equal(policy.beneficiary, "Cónyuge");
});

test("addInsurancePolicy · isLife se normaliza a booleano aunque llegue un valor truthy distinto de true", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro de vida", renewalDate: "2027-01-01", isLife: "on", beneficiary: "Hijos" });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.isLife, true);
});

test("index.html: el formulario de pólizas declara isLife y beneficiary, junto al resto de campos de SP1", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesInsurancePolicyIsLife"/);
  assert.match(ajustes, /id="ajustesInsurancePolicyBeneficiary"/);
});

test("addInsurancePolicyFromControls lee isLife y beneficiary, y limpia ambos tras añadir", () => {
  const start = app.indexOf("function addInsurancePolicyFromControls(");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /isLife: qs\("ajustesInsurancePolicyIsLife"\)\?\.checked/);
  assert.match(body, /beneficiary: qs\("ajustesInsurancePolicyBeneficiary"\)\?\.value/);
  assert.match(body, /ajustesInsurancePolicyIsLife"\)\.checked = false/);
});

test("renderInsurancePolicies muestra la etiqueta de vida y el beneficiario cuando están declarados", () => {
  const start = app.indexOf("function renderInsurancePolicies(");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /policy\.isLife/);
  assert.match(body, /policy\.beneficiary/);
  assert.match(body, /Sin beneficiario declarado/);
});

test("lpx3ContinuityChecklist: el punto de beneficiario lee isLife y beneficiary del inventario real de pólizas", () => {
  const start = app.indexOf("function lpx3ContinuityChecklist(");
  const end = app.indexOf("\n}", app.indexOf("return { checks, ready", start));
  const body = app.slice(start, end);
  assert.match(body, /policy && policy\.isLife/);
  assert.match(body, /policy\.beneficiary \|\| ""/);
});
