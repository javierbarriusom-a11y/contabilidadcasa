const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const E15 = require("../canonical-e15-goals.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// SP1 · Bloque 2: inventario de pólizas con vencimientos en el calendario. Mismo patrón de registro
// que TT3/TT4 (array simple en scenarioSettings) y mismo patrón de evento que la Renta (A15-3): la
// prima es opcional, y si no se declara el evento aparece igualmente con la incertidumbre marcada
// (amount: null, uncertain: true) en vez de fingir una prima de 0.

const forecast = { series: [
  { monthKey: "2026-08", label: "ago 26", totals: { closingLiquidity: 1000 } },
  { monthKey: "2026-09", label: "sep 26", totals: { closingLiquidity: 1100 } },
] };

test("financialCalendar · una póliza con prima conocida aparece en su mes de vencimiento", () => {
  const calendar = E15.financialCalendar({ forecast, policies: [{ name: "Seguro de hogar", renewalDate: "2026-09-15", premium: 240 }] });
  const septiembre = calendar.rows.find((row) => row.monthKey === "2026-09");
  const agosto = calendar.rows.find((row) => row.monthKey === "2026-08");
  const policyEvent = septiembre.events.find((event) => event.type === "policy");
  assert.ok(policyEvent, "septiembre debe llevar el evento de la póliza");
  assert.equal(policyEvent.amount, 240);
  assert.equal(policyEvent.uncertain, false);
  assert.match(policyEvent.label, /Seguro de hogar/);
  assert.equal(agosto.events.some((event) => event.type === "policy"), false);
});

test("financialCalendar · una póliza sin prima declarada aparece con la incertidumbre marcada, no con 0", () => {
  const calendar = E15.financialCalendar({ forecast, policies: [{ name: "Seguro de coche", renewalDate: "2026-08-01" }] });
  const agosto = calendar.rows.find((row) => row.monthKey === "2026-08");
  const policyEvent = agosto.events.find((event) => event.type === "policy");
  assert.ok(policyEvent);
  assert.equal(policyEvent.amount, null, "sin prima declarada, el importe no es cero, es desconocido");
  assert.equal(policyEvent.uncertain, true);
});

test("financialCalendar · sin pólizas, no aparece ningún evento de tipo policy", () => {
  const calendar = E15.financialCalendar({ forecast });
  calendar.rows.forEach((row) => assert.equal(row.events.some((event) => event.type === "policy"), false));
});

test("financialCalendar · varias pólizas el mismo mes generan un evento cada una", () => {
  const calendar = E15.financialCalendar({ forecast, policies: [
    { name: "Hogar", renewalDate: "2026-08-05", premium: 200 },
    { name: "Coche", renewalDate: "2026-08-20", premium: 350 },
  ] });
  const agosto = calendar.rows.find((row) => row.monthKey === "2026-08");
  assert.equal(agosto.events.filter((event) => event.type === "policy").length, 2);
});

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

test("addInsurancePolicy · normaliza nombre y prima; una fecha con formato inválido se descarta", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "  ", renewalDate: "no-es-una-fecha", premium: -5 });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.name, "Póliza");
  assert.equal(policy.renewalDate, "");
  assert.equal(policy.premium, 0);
});

test("addInsurancePolicy · una fecha bien formada se conserva tal cual", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro de vida", renewalDate: "2027-03-10", premium: 120 });
  const policy = context.insurancePolicies()[0];
  assert.equal(policy.renewalDate, "2027-03-10");
  assert.equal(policy.premium, 120);
});

test("removeInsurancePolicy · retira la póliza por id", () => {
  const context = sandbox();
  context.addInsurancePolicy({ name: "Seguro", renewalDate: "2027-01-01", premium: 0 });
  const id = context.insurancePolicies()[0].id;
  context.removeInsurancePolicy(id);
  assert.equal(context.insurancePolicies().length, 0);
});

test("el formulario y el registro de pólizas viven en #ajustes", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesInsurancePolicyName"/);
  assert.match(ajustes, /id="ajustesInsurancePolicyDate"/);
  assert.match(ajustes, /id="ajustesInsurancePolicyPremium"/);
  assert.match(ajustes, /id="ajustesInsurancePolicyNotes"/);
  assert.match(ajustes, /id="ajustesInsurancePolicyAdd"/);
  assert.match(ajustes, /id="ajustesInsurancePolicies"/);
});

test("los listeners de añadir y quitar pólizas están cableados", () => {
  assert.match(app, /qs\("ajustesInsurancePolicyAdd"\)\?\.addEventListener\("click", addInsurancePolicyFromControls\)/);
  assert.match(app, /data-policy-remove/);
});

test("renderAjustes rellena el inventario de pólizas", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderInsurancePolicies\(\);/);
});

test("handleAjustesExportIcs pasa el inventario de pólizas al calendario financiero", () => {
  const start = app.indexOf("function handleAjustesExportIcs(");
  assert.ok(start >= 0, "No existe handleAjustesExportIcs en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /policies: insurancePolicies\(\)/);
});
