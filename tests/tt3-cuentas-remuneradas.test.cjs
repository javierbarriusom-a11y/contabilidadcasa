const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// TT3 · Bloque 2: registro comparado de cuentas remuneradas activas. Mismo patrón que
// bigPurchaseGoals — un array simple en scenarioSettings, sin dominio de datos nuevo ni migración.
// remuneratedAccountsCompared ordena por TAE descendente (la mejor primero) y calcula la media
// ponderada por saldo, para que una cuenta casi vacía con TAE alta no distorsione el conjunto.

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
    ["remuneratedAccounts", "addRemuneratedAccount", "removeRemuneratedAccount", "remuneratedAccountsCompared"]
      .map((name) => extractFunction(name))
      .join("\n"),
    context,
  );
  return context;
}

test("remuneratedAccountsCompared · lista vacía, sin dividir por cero", () => {
  const context = sandbox();
  const compared = context.remuneratedAccountsCompared();
  assert.equal(compared.accounts.length, 0);
  assert.equal(compared.totalBalance, 0);
  assert.equal(compared.weightedRate, 0);
  assert.equal(compared.bestId, "");
});

test("addRemuneratedAccount · normaliza y añade; removeRemuneratedAccount · retira por id", () => {
  const context = sandbox();
  context.addRemuneratedAccount({ name: "Cuenta naranja", balance: "1000", rate: "2.5", notes: "" });
  const accounts = context.remuneratedAccounts();
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].name, "Cuenta naranja");
  assert.equal(accounts[0].balance, 1000);
  assert.equal(accounts[0].rate, 2.5);
  assert.ok(accounts[0].id);
  context.removeRemuneratedAccount(accounts[0].id);
  assert.equal(context.remuneratedAccounts().length, 0);
});

test("addRemuneratedAccount · nombre vacío cae a un valor por defecto, saldo/TAE negativos se recortan a 0", () => {
  const context = sandbox();
  context.addRemuneratedAccount({ name: "  ", balance: -50, rate: -1, notes: "  " });
  const account = context.remuneratedAccounts()[0];
  assert.equal(account.name, "Cuenta remunerada");
  assert.equal(account.balance, 0);
  assert.equal(account.rate, 0);
  assert.equal(account.notes, "");
});

test("remuneratedAccountsCompared · ordena por TAE descendente, la mejor primero", () => {
  const context = sandbox();
  context.addRemuneratedAccount({ name: "Baja", balance: 1000, rate: 1 });
  context.addRemuneratedAccount({ name: "Alta", balance: 500, rate: 3 });
  context.addRemuneratedAccount({ name: "Media", balance: 2000, rate: 2 });
  const compared = context.remuneratedAccountsCompared();
  assert.equal(compared.accounts.map((a) => a.name).join(","), "Alta,Media,Baja");
  assert.equal(compared.bestId, compared.accounts[0].id);
});

test("remuneratedAccountsCompared · empate en TAE se desempata por saldo descendente", () => {
  const context = sandbox();
  context.addRemuneratedAccount({ name: "Pequeña", balance: 100, rate: 2 });
  context.addRemuneratedAccount({ name: "Grande", balance: 5000, rate: 2 });
  const compared = context.remuneratedAccountsCompared();
  assert.equal(compared.accounts.map((a) => a.name).join(","), "Grande,Pequeña");
});

test("remuneratedAccountsCompared · la media es ponderada por saldo, no una media simple de tasas", () => {
  const context = sandbox();
  context.addRemuneratedAccount({ name: "Grande", balance: 9000, rate: 1 });
  context.addRemuneratedAccount({ name: "Pequeña", balance: 1000, rate: 5 });
  const compared = context.remuneratedAccountsCompared();
  assert.equal(compared.totalBalance, 10000);
  // (9000*1 + 1000*5) / 10000 = 1.4, muy lejos de la media simple (1+5)/2 = 3
  assert.equal(compared.weightedRate, 1.4);
});

test("el formulario y el registro de cuentas remuneradas viven en #ajustes", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesRemuneratedName"/);
  assert.match(ajustes, /id="ajustesRemuneratedBalance"/);
  assert.match(ajustes, /id="ajustesRemuneratedRate"/);
  assert.match(ajustes, /id="ajustesRemuneratedNotes"/);
  assert.match(ajustes, /id="ajustesRemuneratedAdd"/);
  assert.match(ajustes, /id="ajustesRemuneratedAccounts"/);
  assert.match(ajustes, /id="ajustesRemuneratedAccountsNote"/);
});

test("los listeners del formulario y el botón Quitar están cableados", () => {
  assert.match(app, /qs\("ajustesRemuneratedAdd"\)\?\.addEventListener\("click", addRemuneratedAccountFromControls\)/);
  assert.match(app, /qs\("ajustesRemuneratedAccounts"\)\?\.addEventListener\("click", \(event\) => \{/);
  assert.match(app, /data-remunerated-remove/);
});

test("renderAjustes rellena el registro de cuentas remuneradas", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderRemuneratedAccounts\(\);/);
});
