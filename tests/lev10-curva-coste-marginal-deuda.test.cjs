const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const IrpfEstimator = require("../canonical-irpf-estimator.js");

// LEV10 (Oleada 4, Bloque 5, AP-2): curva de coste marginal de deuda nueva por tramo — AP3
// (simulateLeverage) solo admite un tipo único aplicado a todo el importe, como si el banco cobrara
// siempre el mismo tipo diera igual cuánto se pida. Muchas ofertas reales de banco son progresivas
// por tramo (p. ej. hasta 20.000€ al 3%, el resto al 4,5%). lev10DebtMarginalCostCurve() reutiliza
// tal cual progressiveTax() (canonical-irpf-estimator.js, A15-2) para la suma por tramos, con tramos
// declarados por el hogar según ofertas reales de su banco — nunca una curva de mercado inventada.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function sandbox() {
  const context = { window: { FinanceCanonicalIrpfEstimator: IrpfEstimator }, round2 };
  vm.createContext(context);
  vm.runInContext(extractFunction("lev10DeclaredTiers"), context);
  vm.runInContext(extractFunction("lev10DebtMarginalCostCurve"), context);
  return context;
}

// Los objetos que devuelve el sandbox pertenecen al realm del vm (Array/Object propios) — se
// normalizan a JSON plano antes de deepEqual, si no assert/strict los compara por prototipo y falla
// aunque la estructura sea idéntica.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("lev10DeclaredTiers · sin nada declarado, no hay tramos", () => {
  const ctx = sandbox();
  assert.deepEqual(plain(ctx.lev10DeclaredTiers({})), []);
});

test("lev10DeclaredTiers · solo el tramo final (resto) declarado sin tramo 1, es un único tramo", () => {
  const ctx = sandbox();
  const tiers = plain(ctx.lev10DeclaredTiers({ lev10Tier3RatePct: 4 }));
  assert.deepEqual(tiers, [{ limit: null, rate: 4 }]);
});

test("lev10DeclaredTiers · tramo 1 + resto, sin tramo 2, da dos tramos", () => {
  const ctx = sandbox();
  const tiers = plain(ctx.lev10DeclaredTiers({ lev10Tier1Limit: 20000, lev10Tier1RatePct: 3, lev10Tier3RatePct: 4.5 }));
  assert.deepEqual(tiers, [{ limit: 20000, rate: 3 }, { limit: null, rate: 4.5 }]);
});

test("lev10DeclaredTiers · los tres tramos declarados en orden", () => {
  const ctx = sandbox();
  const tiers = plain(ctx.lev10DeclaredTiers({
    lev10Tier1Limit: 20000, lev10Tier1RatePct: 3,
    lev10Tier2Limit: 50000, lev10Tier2RatePct: 4,
    lev10Tier3RatePct: 5,
  }));
  assert.deepEqual(tiers, [{ limit: 20000, rate: 3 }, { limit: 50000, rate: 4 }, { limit: null, rate: 5 }]);
});

test("lev10DeclaredTiers · un tramo 2 declarado sin tramo 1 se ignora, nunca deja un hueco", () => {
  const ctx = sandbox();
  const tiers = plain(ctx.lev10DeclaredTiers({ lev10Tier2Limit: 50000, lev10Tier2RatePct: 4, lev10Tier3RatePct: 5 }));
  assert.deepEqual(tiers, [{ limit: null, rate: 5 }]);
});

test("lev10DebtMarginalCostCurve · con un único tramo declarado, no calculable (eso ya es el simulador de tipo único)", () => {
  const ctx = sandbox();
  const result = ctx.lev10DebtMarginalCostCurve({ tiers: [{ limit: null, rate: 4 }], amount: 10000 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "not-enough-tiers");
});

test("lev10DebtMarginalCostCurve · sin importe, no calculable", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: null, rate: 4.5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 0 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("lev10DebtMarginalCostCurve · importe por debajo del primer tramo, todo al tipo del tramo 1", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: null, rate: 4.5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 10000 });
  assert.equal(result.calculable, true);
  assert.equal(result.annualCost, 300); // 10000 * 3%
  assert.equal(result.blendedRatePct, 3);
  assert.equal(result.marginalRatePct, 3);
  assert.equal(result.breakdown.length, 1);
});

test("lev10DebtMarginalCostCurve · importe que cruza al segundo tramo, cada porción a su propio tipo", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: null, rate: 4.5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 30000 });
  // 20000 * 3% + 10000 * 4.5% = 600 + 450 = 1050
  assert.equal(result.annualCost, 1050);
  assert.equal(result.marginalRatePct, 4.5);
  assert.equal(result.breakdown.length, 2);
  assert.equal(result.breakdown[0].cost, 600);
  assert.equal(result.breakdown[1].cost, 450);
});

test("lev10DebtMarginalCostCurve · con tres tramos, el importe cruza los tres", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: 50000, rate: 4 }, { limit: null, rate: 5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 70000 });
  // 20000*3% + 30000*4% + 20000*5% = 600 + 1200 + 1000 = 2800
  assert.equal(result.annualCost, 2800);
  assert.equal(result.marginalRatePct, 5);
  assert.equal(result.breakdown.length, 3);
  assert.equal(result.blendedRatePct, round2((2800 / 70000) * 100));
});

test("lev10DebtMarginalCostCurve · el tipo medio (blended) es siempre menor o igual que el tipo marginal cuando los tramos son crecientes", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: null, rate: 4.5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 25000 });
  assert.ok(result.blendedRatePct <= result.marginalRatePct);
});

test("lev10DebtMarginalCostCurve · el último tramo debe quedar abierto (sin límite), si no, no calculable", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: 3 }, { limit: 50000, rate: 4 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 30000 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "last-tier-not-open");
});

test("lev10DebtMarginalCostCurve · límites no crecientes, no calculable", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 50000, rate: 3 }, { limit: 20000, rate: 4 }, { limit: null, rate: 5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 30000 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "limits-not-increasing");
});

test("lev10DebtMarginalCostCurve · un tipo fuera de 0-100%, no calculable", () => {
  const ctx = sandbox();
  const tiers = [{ limit: 20000, rate: -1 }, { limit: null, rate: 4.5 }];
  const result = ctx.lev10DebtMarginalCostCurve({ tiers, amount: 30000 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "invalid-rate");
});

test("index.html: la tarjeta LEV10 declara los tres tramos y la nota de resultado, sin duplicar el importe de AP3", () => {
  assert.match(indexSource, /id="lev10Tier1Limit"/);
  assert.match(indexSource, /id="lev10Tier1RatePct"/);
  assert.match(indexSource, /id="lev10Tier2Limit"/);
  assert.match(indexSource, /id="lev10Tier2RatePct"/);
  assert.match(indexSource, /id="lev10Tier3RatePct"/);
  assert.match(indexSource, /id="lev10CostCurveNote"/);
  assert.doesNotMatch(indexSource, /id="lev10DebtAmount"/);
});

test("app.js: los tramos de LEV10 se guardan uno a uno y el importe se lee en vivo de ap3DebtAmount, sin duplicarlo", () => {
  const block = extractFunction("renderLev10DebtCostCurve");
  assert.match(block, /qs\("ap3DebtAmount"\)/);
  const handlerBlock = extractFunction("handleLev10FieldChange");
  assert.match(handlerBlock, /LEV10_FIELD_IDS\.forEach/);
  assert.match(handlerBlock, /saveScenarioSettings\(\);/);
});

test("app.js: el importe de AP3 dispara el repintado de LEV10 en vivo, sin necesitar un botón propio", () => {
  assert.match(appSource, /qs\("ap3DebtAmount"\)\?\.addEventListener\("input", renderLev10DebtCostCurve\);/);
});

test("views/deuda.js: renderDeudaApalancamiento() repinta LEV10 al entrar en la vista — deuda-apalancamiento es una vista cargada de forma perezosa (views/deuda.js), no parte del lote de renderAjustes()", () => {
  const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");
  const start = deudaSource.indexOf("function renderDeudaApalancamiento(");
  assert.ok(start >= 0, "No existe renderDeudaApalancamiento en views/deuda.js");
  const end = deudaSource.indexOf("\n}", start);
  const block = deudaSource.slice(start, end);
  assert.match(block, /renderLev10DebtCostCurve\(\);/);
});

test("app.js: LEV10 reutiliza progressiveTax del motor fiscal (A15-2), sin escala nueva que inventar", () => {
  const block = extractFunction("lev10DebtMarginalCostCurve");
  assert.match(block, /irpf\.progressiveTax\(/);
});
