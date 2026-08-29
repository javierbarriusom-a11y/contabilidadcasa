const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Forecast = require("../canonical-forecast.js");

// A15-1 · Bloque 4: registro de supuestos fiscales, en el registro central (A7-2). Hallazgo antes de
// construir: buildAssumptionRegistry() (canonical-forecast.js) ya existía desde antes de esta sesión
// — versionaba ocho supuestos generales del forecast — pero ningún sitio de la app lo llamaba nunca
// (cero referencias fuera de tests/canonical-forecast.test.cjs). A15-1 termina de conectarlo: cinco
// supuestos fiscales nuevos entran en la MISMA lista, con una tarjeta real en Ajustes que por fin la
// muestra.

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

function baseHelpers(extra = {}) {
  return {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    formatIsoDate: (v) => v,
    announceStatus: () => {},
    accountBalancesFromState: () => ({ caixa: 1000, mediolanum: 500, total: 1500 }),
    window: { FinanceCanonicalForecast: Forecast },
    saveScenarioSettings: () => {},
    ASSUMPTION_REGISTRY_UNIT_FORMAT: {
      EUR: (v) => `${Number(v).toFixed(2)} €`, percent: (v) => `${v}%`, ratio: (v) => `×${v}`, boolean: (v) => (v ? "Sí" : "No"),
    },
    ...extra,
  };
}

function sandboxWith(names, extra = {}) {
  const context = baseHelpers(extra);
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- Parte A: canonical-forecast.js — las cinco definiciones fiscales -----------------------

test("buildAssumptionRegistry · las cinco definiciones fiscales entran en el mismo registro que las ocho generales", () => {
  const registry = Forecast.buildAssumptionRegistry({
    fiscal: { jointTaxation: true, withholdingRate: 15, deductibleContributions: 1500, deductibleRent: 900, largeFamily: true },
  }, {}, { generatedAt: "2026-08-29T10:00:00.000Z" });
  assert.equal(registry.items.length, 13);
  const byId = Object.fromEntries(registry.items.map((item) => [item.id, item]));
  assert.equal(byId.fiscalJointTaxation.value, true);
  assert.equal(byId.fiscalJointTaxation.unit, "boolean");
  assert.equal(byId.fiscalWithholdingRate.value, 15);
  assert.equal(byId.fiscalDeductibleContributions.value, 1500);
  assert.equal(byId.fiscalDeductibleRent.value, 900);
  assert.equal(byId.fiscalLargeFamily.value, true);
});

test("buildAssumptionRegistry · sin ningún supuesto fiscal configurado, tributación individual y familia no numerosa por defecto", () => {
  const registry = Forecast.buildAssumptionRegistry({}, {}, { generatedAt: "2026-08-29T10:00:00.000Z" });
  const byId = Object.fromEntries(registry.items.map((item) => [item.id, item]));
  assert.equal(byId.fiscalJointTaxation.value, false);
  assert.equal(byId.fiscalLargeFamily.value, false);
  assert.equal(byId.fiscalWithholdingRate.value, 0);
});

// --- Parte B: getters y assumptionRegistryInput() (app.js) ----------------------------------

test("fiscalWithholdingRate/fiscalDeductibleContributions/fiscalDeductibleRent · sin configurar, 0", () => {
  const ctx = sandboxWith(["fiscalWithholdingRate", "fiscalDeductibleContributions", "fiscalDeductibleRent"], { state: {} });
  assert.equal(ctx.fiscalWithholdingRate(), 0);
  assert.equal(ctx.fiscalDeductibleContributions(), 0);
  assert.equal(ctx.fiscalDeductibleRent(), 0);
});

test("assumptionRegistryInput · combina saldos, política del forecast y los cinco fiscales, todos de state", () => {
  const ctx = sandboxWith(
    ["fiscalWithholdingRate", "fiscalDeductibleContributions", "fiscalDeductibleRent", "assumptionRegistryInput"],
    { state: { incomeFactor: 1.1, annualIncomeGrowth: 2, fiscalJointTaxation: true, fiscalWithholdingRate: 19, fiscalLargeFamily: false } },
  );
  const input = ctx.assumptionRegistryInput();
  assert.equal(input.openingBalances.checking, 1000);
  assert.equal(input.openingBalances.savings, 500);
  assert.equal(input.policy.incomeFactor, 1.1);
  assert.equal(input.fiscal.jointTaxation, true);
  assert.equal(input.fiscal.withholdingRate, 19);
  assert.equal(input.fiscal.largeFamily, false);
});

// --- Parte C: renderAjustesAssumptionRegistry() (app.js) ------------------------------------

test("renderAjustesAssumptionRegistry · pinta las 13 filas con etiqueta, valor formateado por unidad y fecha", () => {
  const list = { innerHTML: "" };
  const ctx = sandboxWith(
    ["fiscalWithholdingRate", "fiscalDeductibleContributions", "fiscalDeductibleRent", "assumptionRegistryInput", "renderAjustesAssumptionRegistry"],
    {
      state: { fiscalWithholdingRate: 15 },
      scenarioSettings: {},
      qs: (id) => (id === "ajustesAssumptionRegistry" ? list : null),
    },
  );
  ctx.renderAjustesAssumptionRegistry();
  assert.match(list.innerHTML, /Retenciones aplicadas/);
  assert.match(list.innerHTML, /15%/);
  assert.equal((list.innerHTML.match(/commit-barrier-item/g) || []).length, 13);
});

// --- Parte D: handlers — guardan solo si cambia, y actualizan el registro persistido --------

test("handleFiscalWithholdingRateChange · no guarda si el valor no cambia", () => {
  let saved = 0;
  const ctx = sandboxWith(
    ["fiscalWithholdingRate", "fiscalDeductibleContributions", "fiscalDeductibleRent", "assumptionRegistryInput",
      "renderAjustesAssumptionRegistry", "persistAssumptionRegistry", "fiscalNumericFieldFromValue", "handleFiscalWithholdingRateChange"],
    {
      state: { fiscalWithholdingRate: 19 },
      scenarioSettings: {},
      qs: () => ({ innerHTML: "" }),
      saveScenarioSettings: () => { saved += 1; },
    },
  );
  ctx.handleFiscalWithholdingRateChange({ target: { value: "19" } });
  assert.equal(saved, 0);
});

test("handleFiscalWithholdingRateChange · al cambiar, guarda y deja la nueva foto en scenarioSettings.assumptionRegistry", () => {
  let saved = 0;
  const settings = {};
  const ctx = sandboxWith(
    ["fiscalWithholdingRate", "fiscalDeductibleContributions", "fiscalDeductibleRent", "assumptionRegistryInput",
      "renderAjustesAssumptionRegistry", "persistAssumptionRegistry", "fiscalNumericFieldFromValue", "handleFiscalWithholdingRateChange"],
    {
      state: { fiscalWithholdingRate: 0 },
      scenarioSettings: settings,
      qs: () => ({ innerHTML: "" }),
      saveScenarioSettings: () => { saved += 1; },
    },
  );
  ctx.handleFiscalWithholdingRateChange({ target: { value: "21" } });
  assert.equal(saved, 1);
  assert.equal(ctx.state.fiscalWithholdingRate, 21);
  assert.ok(settings.assumptionRegistry);
  const item = settings.assumptionRegistry.items.find((i) => i.id === "fiscalWithholdingRate");
  assert.equal(item.value, 21);
});

// --- Parte E: cableado en renderAjustes(), saveScenarioSettings() y el documento ------------

test("renderAjustes sincroniza los controles fiscales y pinta el registro", () => {
  const source = extractFunction("renderAjustes");
  assert.match(source, /syncFiscalAssumptionControls\(\)/);
  assert.match(source, /renderAjustesAssumptionRegistry\(\)/);
});

test("saveScenarioSettings persiste los cinco fiscales y la foto del registro", () => {
  const source = extractFunction("saveScenarioSettings");
  assert.match(source, /fiscalJointTaxation: !!state\.fiscalJointTaxation/);
  assert.match(source, /fiscalWithholdingRate: round2/);
  assert.match(source, /fiscalDeductibleContributions: round2/);
  assert.match(source, /fiscalDeductibleRent: round2/);
  assert.match(source, /fiscalLargeFamily: !!state\.fiscalLargeFamily/);
  assert.match(source, /assumptionRegistry: scenarioSettings\.assumptionRegistry \|\| null/);
});

test("los cinco campos fiscales están cableados a sus handlers", () => {
  assert.match(app, /qs\("ajustesFiscalJointTaxation"\)\?\.addEventListener\("change", handleFiscalJointTaxationChange\)/);
  assert.match(app, /qs\("ajustesFiscalWithholdingRate"\)\?\.addEventListener\("change", handleFiscalWithholdingRateChange\)/);
  assert.match(app, /qs\("ajustesFiscalDeductibleContributions"\)\?\.addEventListener\("change", handleFiscalDeductibleContributionsChange\)/);
  assert.match(app, /qs\("ajustesFiscalDeductibleRent"\)\?\.addEventListener\("change", handleFiscalDeductibleRentChange\)/);
  assert.match(app, /qs\("ajustesFiscalLargeFamily"\)\?\.addEventListener\("change", handleFiscalLargeFamilyChange\)/);
});

test("la tarjeta «Registro de supuestos» vive en #ajustes con sus cinco campos y la lista", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesFiscalJointTaxation"/);
  assert.match(ajustes, /id="ajustesFiscalWithholdingRate"/);
  assert.match(ajustes, /id="ajustesFiscalDeductibleContributions"/);
  assert.match(ajustes, /id="ajustesFiscalDeductibleRent"/);
  assert.match(ajustes, /id="ajustesFiscalLargeFamily"/);
  assert.match(ajustes, /id="ajustesAssumptionRegistry"/);
});
