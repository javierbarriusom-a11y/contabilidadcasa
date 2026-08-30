const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const SelfInsurance = require("../canonical-self-insurance.js");

// SP4 · Bloque 5: autoseguro vs. comprar seguro para riesgos pequeños, en Ajustes junto al
// deducible óptimo (SP5) — mismo cushionFloor() como referencia.

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
    window: { FinanceCanonicalSelfInsurance: SelfInsurance },
    FinanceCanonicalCushion: { cushionFloor: () => ({ value: 1000 }) },
    lastSimulation: [],
    cuadroMandosReserve: () => 1000,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function noteSandbox(fields, extra = {}) {
  const note = { innerHTML: "", textContent: "" };
  const ctx = sandboxWith(["handleSp4CompareInsurance"], {
    qs: (id) => (id === "sp4Note" ? note : id in fields ? { value: fields[id] } : null),
    ...extra,
  });
  return { ctx, note };
}

test("handleSp4CompareInsurance · sin golpe potencial, avisa en vez de comparar con 0", () => {
  const { ctx, note } = noteSandbox({ sp4PotentialLoss: "0", sp4AnnualPremium: "", sp4Probability: "" });
  ctx.handleSp4CompareInsurance();
  assert.match(note.textContent, /Indica el golpe potencial/);
});

test("handleSp4CompareInsurance · golpe mayor que el suelo protegido, recomienda asegurar sin mirar la prima", () => {
  const { ctx, note } = noteSandbox({ sp4PotentialLoss: "5000", sp4AnnualPremium: "20", sp4Probability: "1" });
  ctx.handleSp4CompareInsurance();
  assert.match(note.innerHTML, /lo rompería/);
  assert.match(note.innerHTML, /asegúralo/);
});

test("handleSp4CompareInsurance · golpe absorbible con probabilidad, compara el coste esperado", () => {
  const { ctx, note } = noteSandbox({ sp4PotentialLoss: "300", sp4AnnualPremium: "60", sp4Probability: "5" });
  ctx.handleSp4CompareInsurance();
  assert.match(note.innerHTML, /más barato autoasegurarse/);
});

test("handleSp4CompareInsurance · golpe absorbible sin probabilidad, no fabrica una recomendación", () => {
  const { ctx, note } = noteSandbox({ sp4PotentialLoss: "300", sp4AnnualPremium: "40", sp4Probability: "" });
  ctx.handleSp4CompareInsurance();
  assert.match(note.innerHTML, /Sin probabilidad estimada/);
  assert.match(note.innerHTML, /7.5 año/);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual", () => {
  const body = extractFunction("handleSp4CompareInsurance");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

test("la tarjeta vive en #ajustes con sus campos, botón y nota, junto al deducible óptimo (SP5)", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  ["sp4PotentialLoss", "sp4AnnualPremium", "sp4Probability", "sp4Run", "sp4Note"].forEach((id) => {
    assert.match(ajustes, new RegExp(`id="${id}"`), `Falta #${id}`);
  });
  const deductibleIndex = ajustes.indexOf("ajustesOptimalDeductibleNote");
  const sp4Index = ajustes.indexOf("sp4PotentialLoss");
  assert.ok(deductibleIndex >= 0 && sp4Index > deductibleIndex, "SP4 debería vivir justo después de SP5 en Ajustes");
});

test("el botón está cableado", () => {
  assert.match(app, /qs\("sp4Run"\)\?\.addEventListener\("click", handleSp4CompareInsurance\)/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-self-insurance\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-self-insurance\.js"/);
});
