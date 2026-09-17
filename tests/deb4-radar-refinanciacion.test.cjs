const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const MortgageScenarios = require(path.join(__dirname, "..", "canonical-mortgage-rate-scenarios.js"));

// DEB4 (Oleada 3, Bloque 3): radar de refinanciación activo. APX5 (refinancingBreakEvenMonths) ya
// calcula el punto de equilibrio bajo demanda; DEB4 persiste los campos de la hipoteca (antes
// calculadora puntual, sin persistencia) y un umbral declarado, para avisar en cada arranque sin
// tener que reabrir el simulador — mismo patrón que DEB1 (aviso visible sin pulsar el botón).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  let bodyStart = -1;
  for (let index = start; index < appSource.length; index += 1) {
    if (appSource[index] === "{") {
      if (bodyStart === -1) bodyStart = index;
      depth += 1;
    } else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

test("la tarjeta de hipoteca tiene el hueco del radar, visible antes del botón Comparar", () => {
  const cardStart = indexSource.indexOf("Hipoteca variable → fija bajo escenarios de tipos");
  const alertPos = indexSource.indexOf('id="deb4RadarAlert"');
  const thresholdPos = indexSource.indexOf('id="deb4MaxBreakEvenMonths"');
  const buttonPos = indexSource.indexOf('id="ajustesMortgageScenariosCompare"');
  assert.ok(cardStart >= 0 && alertPos > cardStart && alertPos < buttonPos, "El aviso debe verse antes de pulsar Comparar");
  assert.ok(thresholdPos > cardStart && thresholdPos < buttonPos);
});

test("deb4RadarSettings lee de scenarioSettings.deb4Radar, sin estado propio aparte", () => {
  const block = appSource.slice(appSource.indexOf("function deb4RadarSettings("), appSource.indexOf("function deb4RadarSettings(") + 200);
  assert.match(block, /scenarioSettings\.deb4Radar/);
});

test("renderDeb4RefinancingRadar reutiliza evaluateMortgageRateScenarios/refinancingBreakEvenMonths (APX5), sin motor nuevo", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1200);
  assert.match(block, /window\.FinanceCanonicalMortgageRateScenarios/);
  assert.match(block, /evaluateMortgageRateScenarios\(/);
  assert.match(block, /refinancingBreakEvenMonths\(/);
});

test("el radar no avisa sin umbral declarado ni cuando el punto de equilibrio supera el umbral", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1200);
  assert.match(block, /!\(saved\.principal > 0\) \|\| !\(saved\.maxBreakEvenMonths > 0\)/);
  assert.match(block, /breakEven\.months > saved\.maxBreakEvenMonths/);
});

test("los seis campos de la hipoteca (incluido el umbral) se persisten al cambiar, y disparan un re-render del radar", () => {
  assert.match(
    appSource,
    /\["ajustesMortgagePrincipal", "ajustesMortgageMonths", "ajustesMortgageVariableRate", "ajustesMortgageFixedRate", "ajustesMortgageRefinancingCost", "deb4MaxBreakEvenMonths"\]\.forEach\(\(id\) => \{\s*qs\(id\)\?\.addEventListener\("change", saveDeb4RadarSettings\);/,
  );
  const saveBlock = appSource.slice(appSource.indexOf("function saveDeb4RadarSettings("), appSource.indexOf("function saveDeb4RadarSettings(") + 700);
  assert.match(saveBlock, /renderDeb4RefinancingRadar\(\);/);
});

test("el radar se sincroniza y renderiza al abrir Deuda › Apalancamiento (OPT-24: ya no es un ajuste, es una herramienta)", () => {
  assert.match(deudaSource, /syncDeb4RadarControls\(\);\s*renderDeb4RefinancingRadar\(\);/);
});

// --- D4 · guion de renegociación, texto accionable sobre los mismos números de DEB4 -------------

function moneyStub(value) {
  return `${Math.round((Number(value) || 0) * 100) / 100}€`;
}

test("D4 · deb4RenegotiationScriptText convierte los números ya calculados en un texto legible, sin inventar ninguna cifra", () => {
  const context = { money: moneyStub };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb4RenegotiationScriptText"), context);

  const saved = { principal: 150000, months: 240, variableRate: 3.5, fixedRate: 2.9, maxBreakEvenMonths: 24 };
  const scenarios = MortgageScenarios.evaluateMortgageRateScenarios({
    principal: saved.principal, months: saved.months, currentVariableRate: saved.variableRate, fixedRateOffer: saved.fixedRate,
  });
  const breakEven = MortgageScenarios.refinancingBreakEvenMonths(scenarios.scenarios, 1500);
  assert.ok(breakEven.calculable, "el escenario de prueba debe dar un punto de equilibrio calculable");

  const script = context.deb4RenegotiationScriptText(saved, scenarios, breakEven);
  const base = scenarios.scenarios.find((scenario) => scenario.id === "base");
  assert.match(script, new RegExp(moneyStub(saved.principal).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(script, /3\.5%/);
  assert.match(script, /2\.9%/);
  assert.match(script, new RegExp(moneyStub(base.variableMonthlyPayment).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(script, new RegExp(moneyStub(base.fixedMonthlyPayment).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(script, new RegExp(`${breakEven.months} mes`));
  assert.match(script, /dentro de mi límite de 24/);
});

test("D4 · deb4RenegotiationScriptText no rompe si el escenario base no existe", () => {
  const context = { money: moneyStub };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb4RenegotiationScriptText"), context);
  const script = context.deb4RenegotiationScriptText({}, { scenarios: [] }, { months: 1, cost: 0 });
  assert.equal(script, "");
});

test("D4 · el radar muestra el guion como texto accionable junto al aviso, no solo el número", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1600);
  assert.match(block, /deb4RenegotiationScriptText\(saved, scenarios, breakEven\)/);
  assert.match(block, /Guion para llamar al banco \(D4\)/);
  assert.match(block, /id="deb4RenegotiationScript"/);
});
