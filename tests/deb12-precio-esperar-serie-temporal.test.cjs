const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const comparator = require("../canonical-debt-comparator.js");

// DEB12 (Oleada 4, Bloque 6, DE-4): waitingOptionValue (DEB3) es una cifra fija calculada el día que
// se declara "voy a esperar N meses" — sin volver a pulsar «Comparar», la nota se queda congelada
// para siempre aunque pasen meses reales. Aplica el mismo patrón "trackeado" que DEB1 ya usa para el
// veredicto de AP1 (guardar la comparación tal y como se miró, con su fecha, y recalcularla en cada
// render contra la realidad viva): aquí la realidad viva es el calendario. Se prueba con resultados
// simulados, igual que deb1-aviso-cambio-veredicto ya prueba deb1VerdictChangeHtml con snapshots
// hechos a mano — sin repetir la cobertura de waitingOptionValue, ya cubierta en
// tests/deb3-opcionalidad-esperar.test.cjs.

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
  return `${Number(value).toFixed(2)} €`;
}

function sandbox() {
  const context = { money, window: { FinanceDebtComparator: comparator } };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb12MonthsElapsedSince"), context);
  vm.runInContext(extractFunction("deb12WaitingCostSoFarHtml"), context);
  return context;
}

test("deb12MonthsElapsedSince · cuenta meses de calendario (año/mes, sin días) desde una fecha pasada", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb12MonthsElapsedSince("2026-01-15", new Date(2026, 6, 20)), 6);
  assert.equal(ctx.deb12MonthsElapsedSince("2026-01-15", new Date(2026, 0, 20)), 0);
});

test("deb12MonthsElapsedSince · nunca negativo aunque la fecha sea futura", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb12MonthsElapsedSince("2027-01-01", new Date(2026, 0, 1)), 0);
});

test("deb12MonthsElapsedSince · fecha inválida devuelve null, nunca inventa un número", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb12MonthsElapsedSince("no-es-una-fecha", new Date()), null);
});

test("deb12WaitingCostSoFarHtml · sin comparación trackeada, no muestra nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb12WaitingCostSoFarHtml(null), "");
});

test("deb12WaitingCostSoFarHtml · trackeada hoy mismo (0 meses transcurridos), no muestra nada todavía", () => {
  const ctx = sandbox();
  const html = ctx.deb12WaitingCostSoFarHtml(
    { amount: 10000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: null, evaluatedAt: new Date(2026, 5, 1).toISOString() },
    new Date(2026, 5, 1)
  );
  assert.equal(html, "");
});

test("deb12WaitingCostSoFarHtml · a mitad de camino, muestra el coste acumulado hasta hoy (no el total declarado)", () => {
  const ctx = sandbox();
  const html = ctx.deb12WaitingCostSoFarHtml(
    { amount: 10000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: null, evaluatedAt: new Date(2026, 0, 1).toISOString() },
    new Date(2026, 2, 1)
  );
  // 10000 * 0.06 * (2/12) = 100 — coste de 2 meses transcurridos, no de los 6 declarados (300)
  assert.match(html, /100\.00/);
  assert.match(html, /han pasado 2 de los 6/);
  assert.doesNotMatch(html, /Ya se cumplieron/);
});

test("deb12WaitingCostSoFarHtml · pasado el plazo declarado, tope en los meses declarados y avisa que ya se cumplió", () => {
  const ctx = sandbox();
  const html = ctx.deb12WaitingCostSoFarHtml(
    { amount: 10000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: null, evaluatedAt: new Date(2026, 0, 1).toISOString() },
    new Date(2026, 11, 1)
  );
  // tope en 6 meses declarados: 10000 * 0.06 * (6/12) = 300, nunca más aunque hayan pasado 11 meses
  assert.match(html, /300\.00/);
  assert.match(html, /Ya se cumplieron los 6 mes\(es\)/);
});

test("deb12WaitingCostSoFarHtml · sin FinanceDebtComparator disponible, no rompe ni inventa nada", () => {
  const context = { money, window: {} };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb12MonthsElapsedSince"), context);
  vm.runInContext(extractFunction("deb12WaitingCostSoFarHtml"), context);
  const html = context.deb12WaitingCostSoFarHtml(
    { amount: 10000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: null, evaluatedAt: new Date(2026, 0, 1).toISOString() },
    new Date(2026, 2, 1)
  );
  assert.equal(html, "");
});

test("app.js: renderDeb3OptionValue trackea la comparación (amount, TIN, meses, fecha) solo cuando es calculable, mismo criterio que DEB1", () => {
  const block = extractFunction("renderDeb3OptionValue");
  assert.match(block, /if \(result\.calculable\) \{/);
  assert.match(block, /saveDeb3TrackedWait\(\{ amount, debtAnnualRatePct, waitMonths, monthlyOutflow: outflowValue, evaluatedAt: new Date\(\)\.toISOString\(\) \}\);/);
  assert.match(block, /renderDeb12WaitingCostSoFar\(\);/);
});

test("index.html: la tarjeta declara la nota de coste acumulado, sin campos nuevos que rellenar", () => {
  assert.match(indexSource, /id="deb12WaitingCostSoFarNote"/);
  const fieldIdx = indexSource.indexOf('id="deb3OptionValueNote"');
  const noteIdx = indexSource.indexOf('id="deb12WaitingCostSoFarNote"');
  assert.ok(fieldIdx > 0 && noteIdx > fieldIdx, "la nota de DEB12 debe estar después de la de DEB3");
});

test("views/deuda.js: renderDeudaApalancamiento() repinta DEB12 al entrar en la vista — misma lección de LEV10 (vista cargada de forma perezosa, no pasa por renderAjustes()) — se coloca al final para no romper la adyacencia que otros tests ya fijan entre llamadas anteriores", () => {
  const start = deudaSource.indexOf("function renderDeudaApalancamiento(");
  assert.ok(start >= 0, "No existe renderDeudaApalancamiento en views/deuda.js");
  const end = deudaSource.indexOf("\n}", start);
  const block = deudaSource.slice(start, end);
  assert.match(block, /renderLev16IdleLiquidityCost\(\);\s*\n\s*renderDeb12WaitingCostSoFar\(\);/);
});
