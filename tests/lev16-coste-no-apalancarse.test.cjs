const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// LEV16 (Oleada 4, Bloque 5, AP-9): coste de oportunidad de NO apalancarse, simétrico al riesgo de
// apalancarse que domina el resto del módulo (AP4/LEV1/AP3/LEV5/LEV11/LEV12/LEV13 solo hablan del
// riesgo de tomar deuda para invertir). Reutiliza tal cual cp2IdleCashSummary() (CP2, ya probada en
// tests/cp2-dinero-parado.test.cjs) — sin motor nuevo, solo hace visible ese dato ya calculado justo
// donde se explora la decisión de apalancarse. lev16IdleLiquidityCostHtml() es una función pura que
// recibe el resultado ya calculado de cp2IdleCashSummary(), igual que ap3ResultHtml() recibe el
// resultado ya calculado de simulateLeverage() — por eso aquí se prueba con resultados simulados,
// sin tocar accountBalancesFromState/cushionFloor/iv5PortfolioAnnualReturnPct (ya cubiertos por CP2).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

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

function money(value) {
  return `${Number(value).toFixed(2)} €`;
}

function sandbox() {
  const context = { money };
  vm.createContext(context);
  vm.runInContext(extractFunction("lev16IdleLiquidityCostHtml"), context);
  return context;
}

test("lev16IdleLiquidityCostHtml · sin resultado, mensaje de sin liquidez ociosa", () => {
  const ctx = sandbox();
  const html = ctx.lev16IdleLiquidityCostHtml(null);
  assert.match(html, /Sin liquidez ociosa/);
});

test("lev16IdleLiquidityCostHtml · idleAmount en 0, mensaje de sin liquidez ociosa, nunca un coste inventado", () => {
  const ctx = sandbox();
  const html = ctx.lev16IdleLiquidityCostHtml({ idleAmount: 0, opportunityCost: null });
  assert.match(html, /Sin liquidez ociosa/);
});

test("lev16IdleLiquidityCostHtml · con liquidez ociosa pero sin XIRR real de cartera, lo dice explícitamente", () => {
  const ctx = sandbox();
  const html = ctx.lev16IdleLiquidityCostHtml({ idleAmount: 5000, opportunityCost: { calculable: false } });
  assert.match(html, /todavía no hay XIRR real de cartera/);
  assert.match(html, /5000\.00/);
});

test("lev16IdleLiquidityCostHtml · con liquidez ociosa y coste de oportunidad calculable, muestra el importe y la rentabilidad", () => {
  const ctx = sandbox();
  const html = ctx.lev16IdleLiquidityCostHtml({
    idleAmount: 8000,
    opportunityCost: { calculable: true, annualReturnPct: 6.5, gain: 520 },
  });
  assert.match(html, /8000\.00/);
  assert.match(html, /6\.5/);
  assert.match(html, /520\.00/);
});

test("lev16IdleLiquidityCostHtml · nunca recomienda invertir ni pedir deuda, solo informa el coste", () => {
  const ctx = sandbox();
  const html = ctx.lev16IdleLiquidityCostHtml({
    idleAmount: 8000,
    opportunityCost: { calculable: true, annualReturnPct: 6.5, gain: 520 },
  });
  assert.match(html, /no una recomendación de invertir esa liquidez ni de pedir deuda nueva/);
});

test("app.js: renderLev16IdleLiquidityCost reutiliza tal cual cp2IdleCashSummary(), sin recalcular la liquidez ociosa", () => {
  const block = extractFunction("renderLev16IdleLiquidityCost");
  assert.match(block, /cp2IdleCashSummary\(\)/);
});

test("index.html: la tarjeta LEV16 declara su nota de resultado, sin campos nuevos que rellenar", () => {
  assert.match(indexSource, /id="lev16IdleLiquidityNote"/);
});

test("views/deuda.js: renderDeudaApalancamiento() repinta LEV16 al entrar en la vista — misma lección de LEV10 (vista cargada de forma perezosa, no pasa por renderAjustes())", () => {
  const start = deudaSource.indexOf("function renderDeudaApalancamiento(");
  assert.ok(start >= 0, "No existe renderDeudaApalancamiento en views/deuda.js");
  const end = deudaSource.indexOf("\n}", start);
  const block = deudaSource.slice(start, end);
  assert.match(block, /renderLev16IdleLiquidityCost\(\);/);
});
