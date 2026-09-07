const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// GOB9 (Oleada 3, Bloque 3): panel único de resiliencia — "aguanto X meses" sin vender nada ni
// pedir prestado, justo debajo del runway patrimonial completo (LPX2) en Patrimonio e inversión.
// Combina liquidez real (misma fuente que DLX1/AP1), deuda (p2DebtRows) y el escenario de tensión
// de E13 (PROFILES) — sin motor nuevo aparte de resilienceMonths (canonical-cushion.js).
//
// Corrección Bloque 4 (sesión 159): el global real es window.FinanceCanonicalE13
// (canonical-e13-scenarios.js), no FinanceCanonicalE13Scenarios. Con el nombre equivocado,
// scenariosEngine era siempre undefined y stressExpenseFactor caía siempre a 1 (sin tensión) —
// bug silencioso en producción que ningún test detectaba porque los tests anteriores solo hacían
// assert.match de texto (comprobaban que el código MENCIONA el nombre, no que el global exista de
// verdad). Las pruebas de aquí abajo ejecutan la función en un sandbox real para que esto no
// pueda volver a pasar sin que un test falle.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSource = read("app.js");
const indexSource = read("index.html");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
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

function sandbox({ liquidity = 0, monthlyOutflow = 0, debtService = 0, container = { innerHTML: "" } } = {}) {
  const resilienceCalls = [];
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    qs: (id) => (id === "gob9ResiliencePanel" ? container : null),
    p2DebtRows: () => [{ currentPayment: debtService }],
    lpAverageMonthlyOutflow: () => monthlyOutflow,
    accountBalancesFromState: () => ({ total: liquidity }),
    window: {
      FinanceCanonicalCushion: {
        resilienceMonths: (input) => {
          resilienceCalls.push(input);
          const totalMonthlyOutflow = input.monthlyBurn * input.stressExpenseFactor + input.monthlyDebtService;
          if (!(totalMonthlyOutflow > 0)) return { calculable: false };
          return {
            calculable: true,
            liquidity: input.liquidity,
            stressedBurn: round2(input.monthlyBurn * input.stressExpenseFactor),
            monthlyDebtService: input.monthlyDebtService,
            totalMonthlyOutflow: round2(totalMonthlyOutflow),
            months: Math.floor(input.liquidity / totalMonthlyOutflow),
          };
        },
      },
      // Mismo global real que expone canonical-e13-scenarios.js: FinanceCanonicalE13, con PROFILES.
      FinanceCanonicalE13: {
        PROFILES: [
          { id: "base", label: "Base", incomeFactor: 1, expenseFactor: 1 },
          { id: "favorable", label: "Favorable", incomeFactor: 1.03, expenseFactor: 0.97 },
          { id: "stress", label: "Tensión", incomeFactor: 0.9, expenseFactor: 1.1 },
        ],
      },
    },
  };
  function round2(v) { return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100; }
  vm.createContext(context);
  vm.runInContext(extractFunction("gob9MonthlyDebtService"), context);
  vm.runInContext(extractFunction("renderGob9ResiliencePanel"), context);
  vm.runInContext("renderGob9ResiliencePanel();", context);
  return { context, resilienceCalls, container };
}

test("renderGob9ResiliencePanel lee el global real FinanceCanonicalE13 (no FinanceCanonicalE13Scenarios)", () => {
  const block = extractFunction("renderGob9ResiliencePanel");
  assert.match(block, /window\.FinanceCanonicalE13(?!Scenarios)/);
  assert.doesNotMatch(block, /FinanceCanonicalE13Scenarios/);
});

test("renderGob9ResiliencePanel aplica de verdad el factor de tensión (1.1), no 1 — regresión del bug", () => {
  const { resilienceCalls } = sandbox({ liquidity: 12000, monthlyOutflow: 2000, debtService: 500 });
  assert.equal(resilienceCalls.length, 1);
  assert.equal(resilienceCalls[0].stressExpenseFactor, 1.1);
});

test("renderGob9ResiliencePanel · sin PROFILES/E13 disponible, sigue funcionando con factor 1 en vez de reventar", () => {
  const container = { innerHTML: "" };
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    qs: (id) => (id === "gob9ResiliencePanel" ? container : null),
    p2DebtRows: () => [],
    lpAverageMonthlyOutflow: () => 2000,
    accountBalancesFromState: () => ({ total: 12000 }),
    window: { FinanceCanonicalCushion: { resilienceMonths: (input) => ({ calculable: true, liquidity: input.liquidity, stressedBurn: input.monthlyBurn * input.stressExpenseFactor, monthlyDebtService: input.monthlyDebtService, totalMonthlyOutflow: input.monthlyBurn * input.stressExpenseFactor, months: 6 }) } },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("gob9MonthlyDebtService"), context);
  vm.runInContext(extractFunction("renderGob9ResiliencePanel"), context);
  vm.runInContext("renderGob9ResiliencePanel();", context);
  assert.match(container.innerHTML, /6 mes/);
});

test("renderGob9ResiliencePanel · pinta meses de aguante, liquidez y gasto bajo tensión en el HTML", () => {
  const { container } = sandbox({ liquidity: 12000, monthlyOutflow: 2000, debtService: 500 });
  assert.match(container.innerHTML, /mes\(es\) de aguante/);
  assert.match(container.innerHTML, /€/);
});

test("gob9MonthlyDebtService suma la cuota real de p2DebtRows, sin motor propio", () => {
  const block = extractFunction("gob9MonthlyDebtService");
  assert.match(block, /p2DebtRows\(\)/);
  assert.match(block, /row\.currentPayment/);
});

test("renderGob9ResiliencePanel compone liquidez real, el escenario de tensión de E13 y resilienceMonths, sin motor propio", () => {
  const block = extractFunction("renderGob9ResiliencePanel");
  assert.match(block, /window\.FinanceCanonicalCushion/);
  assert.match(block, /window\.FinanceCanonicalE13\b/);
  assert.match(block, /PROFILES\?\.find\(\(profile\) => profile\.id === "stress"\)/);
  assert.match(block, /accountBalancesFromState\(\)\.total/);
  assert.match(block, /resilienceMonths\(/);
  assert.match(block, /gob9MonthlyDebtService\(\)/);
});

test("la tarjeta de resiliencia vive justo debajo del runway patrimonial completo (LPX2)", () => {
  const lpx2Pos = indexSource.indexOf('id="lpx2NetWorthRunway"');
  const gob9Pos = indexSource.indexOf('id="gob9ResiliencePanel"');
  assert.ok(lpx2Pos >= 0 && gob9Pos > lpx2Pos);
});

test("el panel de resiliencia se renderiza en el arranque de la app, justo después del runway patrimonial", () => {
  assert.match(appSource, /renderLpx2NetWorthRunway\(\);\s*\n\s*renderGob9ResiliencePanel\(\);/);
});
