const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const ui = read("p2-ui.js");
const app = read("app.js");
const html = read("index.html");
const E9Assistant = require("../canonical-e9-assistant.js");
const RecommendationCitation = require("../canonical-recommendation-citation.js");
const Portfolio = require("../canonical-portfolio.js");

// CP2 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 11, ampliación "copiloto proactivo" — depende de AP1):
// "detección de dinero parado". El líquido por encima del suelo del colchón que no está invertido
// ni amortizando deuda es caja parada — reutiliza exactamente las mismas fuentes ya construidas por
// AP1/IV5 (colchón, XIRR real de la cartera, opportunityCost), citada contra el catálogo de
// canonical-e9-assistant.js y verificada por CP3, mismo patrón que CP1.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox(idleCash) {
  const context = {
    root: {
      FinanceCanonicalE9Assistant: E9Assistant,
      FinanceCanonicalRecommendationCitation: RecommendationCitation,
      FinanceP2Bridge: { idleCash: () => idleCash },
    },
    esc: (value) => String(value ?? ""),
    euro: (value) => `${Number(value || 0).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext("const bridge = () => root.FinanceP2Bridge;", context);
  vm.runInContext(extractFunction(ui, "cp2IdleCashSignal"), context);
  vm.runInContext(extractFunction(ui, "cp2IdleCashHtml"), context);
  return context;
}

test("cp2IdleCashSignal · sin caja por encima del suelo, no hay señal que inventar", () => {
  const ctx = sandbox({ idleAmount: 0, floor: 3000, total: 3000, opportunityCost: null });
  assert.equal(ctx.cp2IdleCashSignal(), null);
});

test("cp2IdleCashSignal · con caja por encima del suelo, construye la señal con su cita", () => {
  const opportunityCost = Portfolio.opportunityCost({ amount: 2000, months: 12, annualReturnPct: 5 });
  const ctx = sandbox({ idleAmount: 2000, floor: 3000, total: 5000, opportunityCost });
  const signal = ctx.cp2IdleCashSignal();
  assert.ok(signal);
  assert.equal(signal.idleAmount, 2000);
  assert.equal(signal.floor, 3000);
  assert.deepEqual([...signal.citations], ["metric:idle-cash"]);
});

test("cp2IdleCashSignal · la cita siempre existe en el catálogo de canonical-e9-assistant.js (nunca citation-unknown)", () => {
  const ctx = sandbox({ idleAmount: 1500, floor: 2000, total: 3500, opportunityCost: null });
  const signal = ctx.cp2IdleCashSignal();
  const sources = E9Assistant.sourceCatalog({ metrics: { idleCash: { id: "idle-cash", label: "Líquido por encima del suelo del colchón", value: 1500 } } });
  const availableSources = new Set(sources.map((item) => item.id));
  const validation = RecommendationCitation.validateRecommendation(signal, { availableSources });
  assert.equal(validation.valid, true);
});

test("cp2IdleCashHtml · sin señal, dice explícitamente que no hay nada, no deja la tarjeta en blanco", () => {
  const ctx = sandbox({ idleAmount: 0, floor: 0, total: 0, opportunityCost: null });
  assert.match(ctx.cp2IdleCashHtml(null), /Sin caja por encima del suelo del colchón/);
});

test("cp2IdleCashHtml · sin opportunityCost calculable, no inventa la ganancia que se habría generado", () => {
  const ctx = sandbox({});
  const output = ctx.cp2IdleCashHtml({ label: "Dinero parado", idleAmount: 1000, floor: 2000, opportunityCost: null, citations: ["metric:idle-cash"] });
  assert.doesNotMatch(output, /habría generado/);
});

test("cp2IdleCashHtml · con opportunityCost calculable, muestra lo que se le habría escapado en 12 meses", () => {
  const ctx = sandbox({});
  const opportunityCost = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: 10 });
  const output = ctx.cp2IdleCashHtml({ label: "Dinero parado", idleAmount: 1000, floor: 2000, opportunityCost, citations: ["metric:idle-cash"] });
  assert.match(output, /habría generado/);
  assert.match(output, /100\.00/);
});

test("app.js: cp2IdleCashSummary reutiliza el colchón y la XIRR real de AP1/IV5, sin motor nuevo", () => {
  const block = app.slice(app.indexOf("function cp2IdleCashSummary("), app.indexOf("function cp2IdleCashSummary(") + 900);
  assert.match(block, /accountBalancesFromState\(\)/);
  assert.match(block, /FinanceCanonicalCushion\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)/);
  assert.match(block, /iv5PortfolioAnnualReturnPct\(\)/);
  assert.match(block, /portfolioEngine\.opportunityCost\(/);
});

test("app.js: el puente expone idleCash para que p2-ui.js lo consuma", () => {
  assert.match(app, /idleCash: cp2IdleCashSummary,/);
});

test("p2-ui.js: renderE16Monitoring pinta el dinero parado (CP2) en su propia sección, junto a CP1", () => {
  assert.match(ui, /Dinero parado \(CP2\)/);
  assert.match(ui, /cp2IdleCashSignal\(\)/);
  assert.match(ui, /cp2IdleCashHtml\(idleCashSignal\)/);
});

test("p2-ui.js está versionado en index.html", () => {
  assert.match(html, /p2-ui\.js\?v=/);
});
