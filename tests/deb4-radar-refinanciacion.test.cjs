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
const inversionSource = fs.readFileSync(path.join(__dirname, "..", "views", "inversion.js"), "utf8");

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

test("los campos de la hipoteca (incluidos el umbral y el benchmark de D6) se persisten al cambiar, y disparan un re-render del radar", () => {
  assert.match(
    appSource,
    /\["ajustesMortgagePrincipal", "ajustesMortgageMonths", "ajustesMortgageVariableRate", "ajustesMortgageFixedRate", "ajustesMortgageRefinancingCost", "deb4MaxBreakEvenMonths", "deb4BenchmarkMode", "deb4BenchmarkEuribor", "deb4BenchmarkSpread"\]\.forEach\(\(id\) => \{\s*qs\(id\)\?\.addEventListener\("change", saveDeb4RadarSettings\);/,
  );
  const saveBlock = appSource.slice(appSource.indexOf("function saveDeb4RadarSettings("), appSource.indexOf("function saveDeb4RadarSettings(") + 1400);
  assert.match(saveBlock, /renderDeb4RefinancingRadar\(\);/);
});

// --- D6 · benchmark de mercado real (Euribor+diferencial o manual), con fecha y aviso de caducidad

test("D6 · deb4BenchmarkRate calcula Euribor+diferencial en modo euribor, y respeta el manual en modo manual", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("round2"), context);
  vm.runInContext(extractFunction("deb4BenchmarkRate"), context);
  assert.equal(context.deb4BenchmarkRate("euribor", 3.5, 1.2, 9.99), 4.7);
  assert.equal(context.deb4BenchmarkRate("manual", 3.5, 1.2, 2.9), 2.9);
});

test("D6 · saveDeb4RadarSettings guarda el modo elegido y solo actualiza benchmarkUpdatedAt cuando el tipo resultante cambia de verdad", () => {
  const block = appSource.slice(appSource.indexOf("function saveDeb4RadarSettings("), appSource.indexOf("function saveDeb4RadarSettings(") + 1200);
  assert.match(block, /benchmarkMode: mode/);
  assert.match(block, /benchmarkEuribor: euribor/);
  assert.match(block, /benchmarkSpread: spread/);
  assert.match(block, /const benchmarkChanged = mode !== previous\.benchmarkMode \|\| fixedRate !== previous\.fixedRate;/);
  assert.match(block, /benchmarkUpdatedAt: benchmarkChanged \? monthKey\(new Date\(\)\) : \(previous\.benchmarkUpdatedAt \|\| ""\)/);
});

test("D6 · syncDeb4RadarControls oculta los campos de Euribor/diferencial salvo en modo euribor, y bloquea el tipo fijo manual cuando es calculado", () => {
  const block = appSource.slice(appSource.indexOf("function syncDeb4RadarControls("), appSource.indexOf("function syncDeb4RadarControls(") + 1200);
  assert.match(block, /qs\("ajustesMortgageFixedRate"\)\?\.toggleAttribute\("readonly", mode === "euribor"\)/);
  assert.match(block, /qs\("deb4BenchmarkFields"\)\?\.classList\.toggle\("is-hidden", mode !== "euribor"\)/);
});

test("D6 · deb4BenchmarkFreshnessText avisa según hace cuántos meses se actualizó el benchmark", () => {
  const context = { money: moneyStub, escapeHtml: (value) => String(value ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("monthDistance"), context);
  vm.runInContext(extractFunction("dateFromMonthKey"), context);
  vm.runInContext(extractFunction("deb4BenchmarkFreshnessText"), context);

  assert.equal(context.deb4BenchmarkFreshnessText({ benchmarkUpdatedAt: "" }), "");

  const now = new Date();
  const recentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fresh = context.deb4BenchmarkFreshnessText({ benchmarkUpdatedAt: recentKey, benchmarkMode: "euribor" });
  assert.match(fresh, /Euribor \+ diferencial/);
  assert.match(fresh, /hace 0 mes\(es\)\./);
  assert.doesNotMatch(fresh, /warning/);

  const staleDate = new Date(now.getFullYear(), now.getMonth() - 4, 1);
  const staleKey = `${staleDate.getFullYear()}-${String(staleDate.getMonth() + 1).padStart(2, "0")}`;
  const stale = context.deb4BenchmarkFreshnessText({ benchmarkUpdatedAt: staleKey, benchmarkMode: "manual" });
  assert.match(stale, /oferta manual/);
  assert.match(stale, /warning/);
  assert.match(stale, /revísalo antes de fiarte del radar/);
});

test("D6 · el radar incluye el aviso de caducidad del benchmark junto al mensaje principal", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb4RefinancingRadar("), appSource.indexOf("function renderDeb4RefinancingRadar(") + 1400);
  assert.match(block, /const freshness = deb4BenchmarkFreshnessText\(saved\);/);
  assert.match(block, /\$\{freshness\}/);
});

test("D6 · index.html tiene el selector de fuente y los campos de Euribor/diferencial, ocultos por defecto", () => {
  const selectPos = indexSource.indexOf('id="deb4BenchmarkMode"');
  const fieldsPos = indexSource.indexOf('id="deb4BenchmarkFields"');
  const euriborPos = indexSource.indexOf('id="deb4BenchmarkEuribor"');
  const spreadPos = indexSource.indexOf('id="deb4BenchmarkSpread"');
  const fixedRatePos = indexSource.indexOf('id="ajustesMortgageFixedRate"');
  assert.ok(selectPos >= 0 && selectPos < fixedRatePos, "el selector de modo debe ir antes del tipo fijo manual");
  assert.ok(fieldsPos > fixedRatePos && euriborPos > fieldsPos && spreadPos > euriborPos);
  assert.match(indexSource.slice(fieldsPos - 40, fieldsPos + 10), /is-hidden/);
});

test("el radar se sincroniza y renderiza al abrir Deuda › Apalancamiento (OPT-24: ya no es un ajuste, es una herramienta)", () => {
  assert.match(inversionSource, /syncDeb4RadarControls\(\);\s*renderDeb4RefinancingRadar\(\);/);
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
