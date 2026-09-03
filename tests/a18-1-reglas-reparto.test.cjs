const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Split = require("../canonical-household-split.js");

// A18-1 · Bloque 5: reglas de reparto configurables por categoría, en Ajustes. Sin ninguna regla
// guardada, todo cae a "partes iguales" — el mismo 50/50 que ya asumía familyContextMeta(); esta
// pantalla solo lo hace explícito y configurable.

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
    window: { FinanceCanonicalHouseholdSplit: Split },
    document: { activeElement: null },
    saveScenarioSettings: () => {},
    announceStatus: () => {},
    e13BudgetCategoryOptions: () => ["Alimentación", "Ocio"],
    scenarioSettings: {},
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("householdSplitSettings · sin nada guardado, la regla por defecto es partes iguales", () => {
  const ctx = sandboxWith(["householdSplitSettings"]);
  const settings = ctx.householdSplitSettings();
  assert.equal(settings.defaultRule.mode, "equal");
  assert.equal(Object.keys(settings.categoryRules).length, 0);
  assert.equal(settings.incomes.javi, 0);
});

test("saveA18Rule · sin categoría seleccionada, guarda la regla por defecto", () => {
  const scenarioSettings = {};
  const fields = { a18RuleCategory: "", a18RuleMode: "income-proportional", a18RulePayer: "javi", a18RuleAmount: "" };
  const ctx = sandboxWith(["householdSplitSettings", "saveHouseholdSplitSettings", "saveA18Rule", "renderA18RuleList", "a18RuleLabel", "renderA18BalanceCard", "renderA18SettlementCard", "a18CurrentProposal", "householdSettlements", "a18SettledEntryIds", "householdSplitEntriesList"], {
    scenarioSettings,
    qs: (id) => (id in fields ? { value: fields[id] } : (id === "a18RuleList" ? { innerHTML: "" } : null)),
  });
  ctx.saveA18Rule();
  assert.equal(scenarioSettings.householdSplit.defaultRule.mode, "income-proportional");
  assert.equal(Object.keys(scenarioSettings.householdSplit.categoryRules).length, 0);
});

test("saveA18Rule · con categoría seleccionada, guarda la regla solo para esa categoría", () => {
  const scenarioSettings = {};
  const fields = { a18RuleCategory: "Alimentación", a18RuleMode: "fixed", a18RulePayer: "tere", a18RuleAmount: "50" };
  const ctx = sandboxWith(["householdSplitSettings", "saveHouseholdSplitSettings", "saveA18Rule", "renderA18RuleList", "a18RuleLabel", "renderA18BalanceCard", "renderA18SettlementCard", "a18CurrentProposal", "householdSettlements", "a18SettledEntryIds", "householdSplitEntriesList"], {
    scenarioSettings,
    qs: (id) => (id in fields ? { value: fields[id] } : (id === "a18RuleList" ? { innerHTML: "" } : null)),
  });
  ctx.saveA18Rule();
  assert.equal(scenarioSettings.householdSplit.categoryRules.Alimentación.mode, "fixed");
  assert.equal(scenarioSettings.householdSplit.categoryRules.Alimentación.payer, "tere");
  assert.equal(scenarioSettings.householdSplit.categoryRules.Alimentación.amount, 50);
  assert.equal(scenarioSettings.householdSplit.defaultRule.mode, "equal"); // el defecto no se toca
});

test("removeA18Rule · quita solo la categoría indicada", () => {
  const scenarioSettings = { householdSplit: { categoryRules: { Alimentación: { mode: "equal" }, Ocio: { mode: "fixed", payer: "javi", amount: 20 } } } };
  const ctx = sandboxWith(["householdSplitSettings", "saveHouseholdSplitSettings", "removeA18Rule", "renderA18RuleList", "a18RuleLabel", "renderA18BalanceCard", "renderA18SettlementCard", "a18CurrentProposal", "householdSettlements", "a18SettledEntryIds", "householdSplitEntriesList"], {
    scenarioSettings,
    qs: () => ({ innerHTML: "" }),
  });
  ctx.removeA18Rule("Alimentación");
  assert.deepEqual(Object.keys(scenarioSettings.householdSplit.categoryRules), ["Ocio"]);
});

test("renderA18RuleCategoryOptions · lista las categorías reales de e13BudgetCategoryOptions", () => {
  const select = { innerHTML: "", value: "" };
  const ctx = sandboxWith(["renderA18RuleCategoryOptions"], {
    qs: (id) => (id === "a18RuleCategory" ? select : null),
  });
  ctx.renderA18RuleCategoryOptions();
  assert.match(select.innerHTML, /Alimentación/);
  assert.match(select.innerHTML, /Ocio/);
  assert.match(select.innerHTML, /Regla por defecto/);
});

test("la tarjeta vive en #ajustes con sus campos, botón y lista", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  ["a18IncomeJavi", "a18IncomeTere", "a18RuleCategory", "a18RuleMode", "a18RulePayer", "a18RuleAmount", "a18RuleSave", "a18RuleList"].forEach((id) => {
    assert.match(ajustes, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de reparto`);
  });
});

test("los controles están cableados", () => {
  assert.match(app, /qs\("a18RuleSave"\)\?\.addEventListener\("click", saveA18Rule\)/);
  assert.match(app, /qs\("a18IncomeJavi"\)\?\.addEventListener\("change", saveA18Incomes\)/);
  assert.match(app, /qs\("a18RuleList"\)\?\.addEventListener\("click"/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-household-split\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-household-split\.js"/);
});
