const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// GOB11 (Oleada 4, apuesta grande, O-1): proyección de jubilación unificada — cruza la cartera real
// (INV11: el plan de pensiones ya es una posición más), el gasto medio de la previsión viva y un
// objetivo de independencia financiera propio con fecha declarada de jubilación. Ningún supuesto se
// inventa: tasas de crecimiento (cartera y pensión, pueden ser distintas), aportación mensual futura,
// pensión pública (dato manual) y tasa de retirada son todos declarados por el hogar — sin alguno de
// los necesarios, `calculable` es `false` y `missing` dice exactamente qué falta.

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
  const context = { round2 };
  vm.createContext(context);
  vm.runInContext(extractFunction("gob11MonthsToRetirement"), context);
  vm.runInContext(extractFunction("gob11FutureValue"), context);
  vm.runInContext(extractFunction("gob11RetirementProjection"), context);
  return context;
}

test("gob11MonthsToRetirement · formato inválido no es calculable", () => {
  const ctx = sandbox();
  assert.equal(ctx.gob11MonthsToRetirement(""), null);
  assert.equal(ctx.gob11MonthsToRetirement("2030"), null);
  assert.equal(ctx.gob11MonthsToRetirement("no-fecha"), null);
});

test("gob11MonthsToRetirement · cuenta meses exactos entre hoy declarado y la fecha objetivo", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1); // septiembre 2026
  assert.equal(ctx.gob11MonthsToRetirement("2027-09", now), 12);
  assert.equal(ctx.gob11MonthsToRetirement("2026-09", now), 0);
});

test("gob11MonthsToRetirement · fecha ya pasada da un número negativo, nunca null", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  assert.equal(ctx.gob11MonthsToRetirement("2025-09", now), -12);
});

test("gob11RetirementProjection · sin fecha de jubilación declarada, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({ withdrawalRatePct: 4, annualExpensesToday: 24000 });
  assert.equal(result.calculable, false);
  assert.ok(result.missing.includes("retirementMonth"));
});

test("gob11RetirementProjection · sin tasa de retirada declarada, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({ retirementMonth: "2040-01", annualExpensesToday: 24000 });
  assert.equal(result.calculable, false);
  assert.ok(result.missing.includes("withdrawalRatePct"));
});

test("gob11RetirementProjection · sin gasto medio de la previsión viva, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({ retirementMonth: "2040-01", withdrawalRatePct: 4 });
  assert.equal(result.calculable, false);
  assert.ok(result.missing.includes("annualExpensesToday"));
});

test("gob11RetirementProjection · con valor de cartera pero sin su tasa de crecimiento declarada, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({
    retirementMonth: "2040-01", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 10000,
  });
  assert.equal(result.calculable, false);
  assert.ok(result.missing.includes("portfolioGrowthPct"));
});

test("gob11RetirementProjection · con valor de pensión pero sin su tasa de crecimiento declarada, no calculable", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({
    retirementMonth: "2040-01", withdrawalRatePct: 4, annualExpensesToday: 24000,
    pensionValue: 5000,
  });
  assert.equal(result.calculable, false);
  assert.ok(result.missing.includes("pensionGrowthPct"));
});

test("gob11RetirementProjection · sin cartera ni pensión declaradas, no exige tasas de crecimiento", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({ retirementMonth: "2040-01", withdrawalRatePct: 4, annualExpensesToday: 24000 });
  assert.equal(result.calculable, true);
});

test("gob11RetirementProjection · crecimiento 0% sin aportación deja el capital intacto", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const result = ctx.gob11RetirementProjection({
    now, retirementMonth: "2028-09", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 10000, portfolioGrowthPct: 0,
    pensionValue: 5000, pensionGrowthPct: 0,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.monthsToRetirement, 24);
  assert.equal(result.portfolioAtRetirement, 10000);
  assert.equal(result.pensionAtRetirement, 5000);
  assert.equal(result.totalCorpusAtRetirement, 15000);
});

test("gob11RetirementProjection · crecimiento anual del 12% durante exactamente 12 meses multiplica por 1.12", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const result = ctx.gob11RetirementProjection({
    now, retirementMonth: "2027-09", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 1000, portfolioGrowthPct: 12,
  });
  assert.equal(result.portfolioAtRetirement, 1120);
});

test("gob11RetirementProjection · sin crecimiento, la aportación mensual futura se suma en línea recta", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const result = ctx.gob11RetirementProjection({
    now, retirementMonth: "2027-07", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 0, portfolioGrowthPct: 0, monthlyContributionPortfolio: 100,
  });
  assert.equal(result.monthsToRetirement, 10);
  assert.equal(result.portfolioAtRetirement, 1000);
});

test("gob11RetirementProjection · un crecimiento declarado mayor produce siempre un capital proyectado mayor", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const base = { now, retirementMonth: "2046-09", withdrawalRatePct: 4, annualExpensesToday: 24000, portfolioValue: 10000, monthlyContributionPortfolio: 200 };
  const low = ctx.gob11RetirementProjection({ ...base, portfolioGrowthPct: 2 });
  const high = ctx.gob11RetirementProjection({ ...base, portfolioGrowthPct: 8 });
  assert.ok(high.portfolioAtRetirement > low.portfolioAtRetirement);
});

test("gob11RetirementProjection · fecha de jubilación ya pasada no rompe el cálculo, usa el valor de hoy", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const result = ctx.gob11RetirementProjection({
    now, retirementMonth: "2020-01", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 10000, portfolioGrowthPct: 6,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.pastDate, true);
  assert.equal(result.monthsToRetirement, 0);
  assert.equal(result.portfolioAtRetirement, 10000);
});

test("gob11RetirementProjection · pensión pública declarada reduce el capital objetivo, nunca se asume sin declararla", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const withoutState = ctx.gob11RetirementProjection({
    now, retirementMonth: "2030-09", withdrawalRatePct: 4, annualExpensesToday: 24000,
  });
  const withState = ctx.gob11RetirementProjection({
    now, retirementMonth: "2030-09", withdrawalRatePct: 4, annualExpensesToday: 24000, statePensionMonthly: 1000,
  });
  assert.equal(withoutState.includesStatePension, false);
  assert.equal(withoutState.statePensionAnnual, 0);
  assert.equal(withState.includesStatePension, true);
  assert.equal(withState.statePensionAnnual, 12000);
  assert.ok(withState.targetCorpus < withoutState.targetCorpus);
});

test("gob11RetirementProjection · el gasto a cubrir con capital nunca baja de 0 aunque la pensión pública supere el gasto", () => {
  const ctx = sandbox();
  const result = ctx.gob11RetirementProjection({
    retirementMonth: "2030-01", withdrawalRatePct: 4, annualExpensesToday: 6000, statePensionMonthly: 5000,
  });
  assert.equal(result.netAnnualExpensesToFund, 0);
  assert.equal(result.targetCorpus, 0);
});

test("gob11RetirementProjection · la inflación declarada encarece el gasto proyectado a la fecha de jubilación", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const flat = ctx.gob11RetirementProjection({ now, retirementMonth: "2036-09", withdrawalRatePct: 4, annualExpensesToday: 24000, annualInflationPct: 0 });
  const inflated = ctx.gob11RetirementProjection({ now, retirementMonth: "2036-09", withdrawalRatePct: 4, annualExpensesToday: 24000, annualInflationPct: 3 });
  assert.ok(inflated.annualExpensesAtRetirement > flat.annualExpensesAtRetirement);
  assert.ok(inflated.targetCorpus > flat.targetCorpus);
});

test("gob11RetirementProjection · superávit y déficit se distinguen por el signo del hueco (gap)", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const shortfall = ctx.gob11RetirementProjection({
    now, retirementMonth: "2027-09", withdrawalRatePct: 4, annualExpensesToday: 240000,
    portfolioValue: 1000, portfolioGrowthPct: 1,
  });
  const surplus = ctx.gob11RetirementProjection({
    now, retirementMonth: "2027-09", withdrawalRatePct: 4, annualExpensesToday: 100,
    portfolioValue: 1000000, portfolioGrowthPct: 1,
  });
  assert.equal(shortfall.reached, false);
  assert.ok(shortfall.gap > 0);
  assert.equal(surplus.reached, true);
  assert.ok(surplus.gap < 0);
});

test("gob11RetirementProjection · la trayectoria anual tiene un año por cada año completo hasta la jubilación", () => {
  const ctx = sandbox();
  const now = new Date(2026, 8, 1);
  const result = ctx.gob11RetirementProjection({
    now, retirementMonth: "2029-09", withdrawalRatePct: 4, annualExpensesToday: 24000,
    portfolioValue: 1000, portfolioGrowthPct: 5, monthlyContributionPortfolio: 50,
  });
  assert.equal(result.yearlyTrajectory.length, 3);
  assert.equal(result.yearlyTrajectory[2].totalValue, result.portfolioAtRetirement);
  assert.equal(result.yearlyTrajectory[0].calendarYear, 2027);
});

test("index.html: la tarjeta GOB11 declara fecha de jubilación, tasas de crecimiento, aportaciones, pensión pública, tasa de retirada y nota de resultado", () => {
  assert.match(indexSource, /id="gob11RetirementMonth"/);
  assert.match(indexSource, /id="gob11PortfolioGrowthPct"/);
  assert.match(indexSource, /id="gob11PensionGrowthPct"/);
  assert.match(indexSource, /id="gob11MonthlyContributionPortfolio"/);
  assert.match(indexSource, /id="gob11MonthlyContributionPension"/);
  assert.match(indexSource, /id="gob11StatePensionMonthly"/);
  assert.match(indexSource, /id="gob11WithdrawalRatePct"/);
  assert.match(indexSource, /id="gob11ProjectionNote"/);
  assert.match(indexSource, /id="gob11Trajectory"/);
});

test("app.js: los campos declarados de GOB11 se guardan uno a uno y repintan el panel al cambiar", () => {
  const block = extractFunction("handleGob11FieldChange");
  assert.match(block, /GOB11_FIELD_IDS\.forEach/);
  assert.match(block, /saveScenarioSettings\(\);/);
  assert.match(block, /renderGob11Panel\(\);/);
});

test("app.js: el panel de GOB11 se repinta en el lote de renderizado, justo después del panel de resiliencia (GOB9)", () => {
  assert.match(appSource, /renderGob9ResiliencePanel\(\);\s*\n\s*renderGob11Panel\(\);/);
});

test("app.js: la pensión que cuenta en GOB11 es la posición de cartera plan-pension (INV11), no el saldo estático de A14", () => {
  const block = extractFunction("gob11PortfolioAndPensionValues");
  assert.match(block, /totalsByType\["plan-pension"\]/);
});
