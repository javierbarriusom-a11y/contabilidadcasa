const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Simulator = require("../canonical-pension-simulator.js");

// A15-4 · Bloque 5: simulador de aportación a plan de pensiones en Ajustes, junto al registro de
// supuestos fiscales (A15-1) del que lee la retención como tipo marginal estimado.

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
    window: { FinanceCanonicalPensionSimulator: Simulator },
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function noteSandbox(extra = {}) {
  const note = { innerHTML: "", textContent: "" };
  const contribution = { value: extra.contributionValue ?? "" };
  const ctx = sandboxWith(["handleA154SimulatePension"], {
    qs: (id) => {
      if (id === "pensionSimNote") return note;
      if (id === "pensionSimContribution") return contribution;
      return null;
    },
    accountBalancesFromState: extra.accountBalancesFromState || (() => ({ caixa: 5000, mediolanum: 0 })),
    fiscalWithholdingRate: extra.fiscalWithholdingRate || (() => 30),
    agentCaixaFloor: extra.agentCaixaFloor || (() => 1000),
    ...extra.contextOverrides,
  });
  return { ctx, note };
}

test("handleA154SimulatePension · sin aportación, avisa en vez de simular con 0", () => {
  const { ctx, note } = noteSandbox({ contributionValue: "0" });
  ctx.handleA154SimulatePension();
  assert.match(note.textContent, /Indica el importe a aportar/);
});

test("handleA154SimulatePension · dentro del límite, muestra cupo restante y ahorro fiscal", () => {
  const { ctx, note } = noteSandbox({ contributionValue: "1000" });
  ctx.handleA154SimulatePension();
  assert.match(note.innerHTML, /Dentro del límite deducible/);
  assert.match(note.innerHTML, /Ahorro fiscal estimado/);
  assert.match(note.innerHTML, /30% de retención declarada/);
});

test("handleA154SimulatePension · por encima del límite, lo dice explícitamente", () => {
  const { ctx, note } = noteSandbox({ contributionValue: "3000" });
  ctx.handleA154SimulatePension();
  assert.match(note.innerHTML, /Supera el límite deducible/);
});

test("handleA154SimulatePension · sin retención declarada, el hueco es explícito, no un ahorro fabricado", () => {
  const { ctx, note } = noteSandbox({ contributionValue: "1000", fiscalWithholdingRate: () => 0 });
  ctx.handleA154SimulatePension();
  assert.match(note.innerHTML, /no se puede estimar el ahorro fiscal/);
});

test("handleA154SimulatePension · si la aportación completa rompe la reserva protegida, avisa", () => {
  const { ctx, note } = noteSandbox({
    contributionValue: "1000",
    accountBalancesFromState: () => ({ caixa: 1500, mediolanum: 0 }),
    agentCaixaFloor: () => 1000,
  });
  ctx.handleA154SimulatePension();
  assert.match(note.innerHTML, /dejaría la reserva protegida por debajo de su suelo/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual", () => {
  const body = extractFunction("handleA154SimulatePension");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

test("la tarjeta vive en #ajustes con su campo, botón y nota", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="pensionSimContribution"/);
  assert.match(ajustes, /id="pensionSimRun"/);
  assert.match(ajustes, /id="pensionSimNote"/);
});

test("el botón está cableado", () => {
  assert.match(app, /qs\("pensionSimRun"\)\?\.addEventListener\("click", handleA154SimulatePension\)/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-pension-simulator\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-pension-simulator\.js"/);
});
