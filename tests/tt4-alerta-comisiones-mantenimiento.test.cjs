const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// TT4 · Bloque 2: alerta de comisiones de mantenimiento y vinculación. La app no puede saber por sí
// sola si la nómina, la domiciliación o el gasto con tarjeta del mes cumplen la vinculación exigida
// por el banco — se marca a mano, mes a mes (por defecto "cumplida" al dar de alta la cuenta, para
// no alertar en falso el primer día). Lo que sí calcula la app es la alerta: qué cuentas quedarían
// sin vinculación cumplida y qué comisión total se aplicaría por ello.

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
    [
      "maintenanceFeeAccounts",
      "addMaintenanceFeeAccount",
      "removeMaintenanceFeeAccount",
      "setMaintenanceFeeAccountMet",
      "maintenanceFeeAlerts",
    ]
      .map((name) => extractFunction(name))
      .join("\n"),
    context,
  );
  return context;
}

test("maintenanceFeeAlerts · sin cuentas registradas, nada en riesgo", () => {
  const context = sandbox();
  const alerts = context.maintenanceFeeAlerts();
  assert.equal(alerts.accounts.length, 0);
  assert.equal(alerts.atRisk.length, 0);
  assert.equal(alerts.totalFee, 0);
});

test("addMaintenanceFeeAccount · nace con vinculación cumplida (no alerta el primer día)", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "Cuenta nómina", fee: "8.5", requirement: "Nómina domiciliada" });
  const account = context.maintenanceFeeAccounts()[0];
  assert.equal(account.name, "Cuenta nómina");
  assert.equal(account.fee, 8.5);
  assert.equal(account.requirement, "Nómina domiciliada");
  assert.equal(account.met, true);
  assert.equal(context.maintenanceFeeAlerts().atRisk.length, 0);
});

test("addMaintenanceFeeAccount · nombre vacío cae a un valor por defecto, comisión negativa se recorta a 0", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "  ", fee: -5, requirement: "" });
  const account = context.maintenanceFeeAccounts()[0];
  assert.equal(account.name, "Cuenta corriente");
  assert.equal(account.fee, 0);
});

test("setMaintenanceFeeAccountMet(false) · la cuenta pasa a estar en riesgo, con su comisión sumada", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "Cuenta A", fee: 10, requirement: "Gasto con tarjeta" });
  const id = context.maintenanceFeeAccounts()[0].id;
  context.setMaintenanceFeeAccountMet(id, false);
  const alerts = context.maintenanceFeeAlerts();
  assert.equal(alerts.atRisk.length, 1);
  assert.equal(alerts.atRisk[0].id, id);
  assert.equal(alerts.totalFee, 10);
});

test("maintenanceFeeAlerts · una cuenta sin comisión (fee 0) nunca alerta aunque no cumpla la vinculación", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "Cuenta sin coste", fee: 0, requirement: "" });
  context.setMaintenanceFeeAccountMet(context.maintenanceFeeAccounts()[0].id, false);
  assert.equal(context.maintenanceFeeAlerts().atRisk.length, 0);
});

test("maintenanceFeeAlerts · totalFee suma solo las cuentas en riesgo, no todas las registradas", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "Cumple", fee: 5, requirement: "" });
  context.addMaintenanceFeeAccount({ name: "No cumple", fee: 12, requirement: "" });
  const accounts = context.maintenanceFeeAccounts();
  context.setMaintenanceFeeAccountMet(accounts[1].id, false);
  const alerts = context.maintenanceFeeAlerts();
  assert.equal(alerts.atRisk.length, 1);
  assert.equal(alerts.totalFee, 12);
});

test("removeMaintenanceFeeAccount · retira la cuenta por id", () => {
  const context = sandbox();
  context.addMaintenanceFeeAccount({ name: "Cuenta A", fee: 5, requirement: "" });
  const id = context.maintenanceFeeAccounts()[0].id;
  context.removeMaintenanceFeeAccount(id);
  assert.equal(context.maintenanceFeeAccounts().length, 0);
});

test("el formulario y el registro de comisiones de mantenimiento viven en #ajustes", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesMaintenanceFeeName"/);
  assert.match(ajustes, /id="ajustesMaintenanceFeeAmount"/);
  assert.match(ajustes, /id="ajustesMaintenanceFeeRequirement"/);
  assert.match(ajustes, /id="ajustesMaintenanceFeeAdd"/);
  assert.match(ajustes, /id="ajustesMaintenanceFeeAccounts"/);
  assert.match(ajustes, /id="ajustesMaintenanceFeeAccountsNote"/);
});

test("los listeners de añadir, quitar y marcar vinculación cumplida están cableados", () => {
  assert.match(app, /qs\("ajustesMaintenanceFeeAdd"\)\?\.addEventListener\("click", addMaintenanceFeeAccountFromControls\)/);
  assert.match(app, /data-maintenance-remove/);
  assert.match(app, /data-maintenance-met/);
});

test("renderAjustes rellena el registro de comisiones de mantenimiento", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderMaintenanceFeeAccounts\(\);/);
});
