const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Restructuring = require("../canonical-joint-restructuring.js");

// DI5 · Bloque 4: reestructuración conjunta ante una caída de ingresos. Reutiliza los contratos
// reales de Deuda › Contratos (debtContractSourceRows, D-2) en vez de pedir capital/TAE/cuota a
// mano, y el ratio de deuda/ingresos seguro configurado en Ajustes › Alertas (H-9) en vez de un 35%
// fijo aparte.

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

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    parseAmount: (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; },
    window: { FinanceCanonicalJointRestructuring: Restructuring },
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function contractRow(overrides = {}) {
  return { id: "c1", entity: "Banco X", type: "Préstamo", paymentStatus: "active", currentPrincipal: 10000, apr: 10, remainingInstallments: 24, currentPayment: 461.45, ...overrides };
}

test("di5RestructuringContracts · solo contratos activos con cuota, mapeados al formato del motor", () => {
  const ctx = sandboxWith(["di5RestructuringContracts"], {
    debtContractSourceRows: () => [
      contractRow(),
      contractRow({ id: "c2", paymentStatus: "settled", currentPayment: 200 }),
      contractRow({ id: "c3", currentPayment: 0 }),
    ],
  });
  const result = ctx.di5RestructuringContracts();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "c1");
  assert.equal(result[0].balance, 10000);
  assert.equal(result[0].rate, 10);
  assert.equal(result[0].monthsRemaining, 24);
  assert.equal(result[0].monthlyPayment, 461.45);
});

function noteSandbox(extra = {}) {
  const note = { innerHTML: "", textContent: "" };
  const income = { value: extra.incomeValue ?? "" };
  const ctx = sandboxWith(
    ["di5RestructuringContracts", "handleDi5CompareJointRestructuring"],
    {
      qs: (id) => {
        if (id === "ajustesJointRestructuringNote") return note;
        if (id === "ajustesJointRestructuringIncome") return income;
        return null;
      },
      debtContractSourceRows: extra.debtContractSourceRows || (() => [contractRow()]),
      alertThresholdOverride: extra.alertThresholdOverride || (() => 32),
      ...extra.contextOverrides,
    },
  );
  return { ctx, note };
}

test("handleDi5CompareJointRestructuring · sin ingreso, avisa en vez de dividir por cero", () => {
  const { ctx, note } = noteSandbox({ incomeValue: "0" });
  ctx.handleDi5CompareJointRestructuring();
  assert.match(note.textContent, /ingreso mensual tras la caída/);
});

test("handleDi5CompareJointRestructuring · sin contratos activos, lo dice explícitamente", () => {
  const { ctx, note } = noteSandbox({ incomeValue: "2000", debtContractSourceRows: () => [] });
  ctx.handleDi5CompareJointRestructuring();
  assert.match(note.textContent, /No hay contratos de deuda activos/);
});

test("handleDi5CompareJointRestructuring · por debajo del ratio seguro, no hace falta reestructurar", () => {
  const { ctx, note } = noteSandbox({ incomeValue: "4000" });
  ctx.handleDi5CompareJointRestructuring();
  assert.match(note.innerHTML, /Sin necesidad de reestructurar/);
});

test("handleDi5CompareJointRestructuring · por encima del ratio, propone alargar el plazo del contrato más caro", () => {
  const { ctx, note } = noteSandbox({
    incomeValue: "1500",
    debtContractSourceRows: () => [
      contractRow(),
      contractRow({ id: "c2", entity: "Banco Y", apr: 5, currentPrincipal: 5000, remainingInstallments: 12, currentPayment: 428.04 }),
    ],
  });
  ctx.handleDi5CompareJointRestructuring();
  assert.match(note.innerHTML, /Banco X/);
  assert.match(note.innerHTML, /alargar de 24 a 36 meses/);
  assert.match(note.innerHTML, /Alivio conseguido/);
});

test("handleDi5CompareJointRestructuring usa el ratio de Ajustes › Alertas, no un 35% fijo", () => {
  let calledWith = null;
  const { ctx, note } = noteSandbox({
    incomeValue: "1000", // 461.45/1000 = 46%, por encima del 40% configurado
    alertThresholdOverride: (metricId) => { calledWith = metricId; return 40; },
  });
  ctx.handleDi5CompareJointRestructuring();
  assert.equal(calledWith, "debtRatio");
  assert.match(note.innerHTML, /Ratio seguro: 40%/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual", () => {
  const body = extractFunction("handleDi5CompareJointRestructuring");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

test("la tarjeta vive en #ajustes con su campo, botón y nota", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesJointRestructuringIncome"/);
  assert.match(ajustes, /id="ajustesJointRestructuringCompare"/);
  assert.match(ajustes, /id="ajustesJointRestructuringNote"/);
});

test("el botón está cableado y tiene ayuda contextual", () => {
  assert.match(app, /qs\("ajustesJointRestructuringCompare"\)\?\.addEventListener\("click", handleDi5CompareJointRestructuring\)/);
  assert.match(app, /qs\("ajustesJointRestructuringCompare"\)\?\.setAttribute\("data-help"/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-joint-restructuring\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-joint-restructuring\.js"/);
});
