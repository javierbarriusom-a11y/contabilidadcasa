const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Cushion = require("../canonical-cushion.js");
const E13 = require("../canonical-e13-scenarios.js");

// DEB17 (Oleada 4, Bloque 6): DEB15 ya proyecta la liquidez de los próximos meses tras una
// cancelación total, pero solo contra el escenario BASE del forecast. DEB17 reutiliza tal cual el
// mismo guardarraíl (cancellationLiquidityGuardrail) y el perfil de tensión ya calibrado en el
// laboratorio de escenarios (E13, PROFILES "stress": -10% ingresos, +10% gastos) para simular la
// misma cancelación bajo un mes de tensión inmediatamente después, sin motor de estrés nuevo.

function forecastFixture(monthlyIncome, monthlyOutflow, months = 6) {
  return {
    series: Array.from({ length: months }, (_, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: monthlyIncome, outflowsBeforeSaving: monthlyOutflow, saving: 0, closingLiquidity: 0 },
    })),
    assumptions: {},
  };
}

const STRESS_PROFILE = E13.PROFILES.find((profile) => profile.id === "stress");

test("PROFILES expone el perfil de tensión que DEB17 reutiliza (-10% ingresos, +10% gastos)", () => {
  assert.ok(STRESS_PROFILE);
  assert.equal(STRESS_PROFILE.incomeFactor, 0.9);
  assert.equal(STRESS_PROFILE.expenseFactor, 1.1);
});

test("simulate() con el perfil de tensión produce filas compatibles con cancellationLiquidityGuardrail (closingLiquidity plano)", () => {
  // Ingreso 3000, gasto 2000 -> ahorro/caja neta 1000/mes en el escenario base; en tensión
  // (ingreso*0.9=2700, gasto*1.1=2200) la caja neta baja a 500/mes.
  const forecast = forecastFixture(3000, 2000, 3);
  const stressed = E13.simulate(forecast, STRESS_PROFILE, []);
  assert.equal(stressed.rows.length, 3);
  assert.equal(stressed.rows[0].income, 2700);
  assert.equal(stressed.rows[0].outflows, 2200);
  assert.ok(Number.isFinite(stressed.rows[0].closingLiquidity));
  assert.equal(stressed.rows[0].totals, undefined); // filas planas, no anidadas — el fallback de Cushion las cubre

  const result = Cushion.cancellationLiquidityGuardrail({
    amount: 100, liquidity: 5000, floor: 3000, forecastSeries: stressed.rows,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.projected[0].forecastLiquidity, stressed.rows[0].closingLiquidity);
});

test("un mes que aguanta en el escenario base puede romperse bajo el perfil de tensión (caso real que DEB17 cubre)", () => {
  // Base: ingreso 3000, gasto 2900 -> caja neta 100/mes, se acumula despacio pero sin romper el suelo
  // con una cancelación moderada. En tensión (2700 - 3190) la caja neta es NEGATIVA cada mes.
  const forecast = forecastFixture(3000, 2900, 3);
  const baseSeries = forecast.series;
  const stressedRows = E13.simulate(forecast, STRESS_PROFILE, []).rows;

  const baseResult = Cushion.cancellationLiquidityGuardrail({ amount: 1000, liquidity: 4000, floor: 2000, forecastSeries: baseSeries.map((row, index) => ({ ...row, totals: { closingLiquidity: 3000 + index * 100 } })) });
  const stressResult = Cushion.cancellationLiquidityGuardrail({ amount: 1000, liquidity: 4000, floor: 2000, forecastSeries: stressedRows });

  assert.equal(baseResult.holds, true);
  assert.equal(stressResult.holds, false); // la caja neta negativa bajo tensión rompe el suelo antes
});

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

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

function sandbox() {
  const context = { escapeHtml: (value) => String(value ?? ""), money: (value) => `${Math.round(value)}€` };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb17CancellationStressHtml"), context);
  return context;
}

test("deb17CancellationStressHtml · sin resultado calculable, no muestra nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb17CancellationStressHtml(null), "");
  assert.equal(ctx.deb17CancellationStressHtml({ calculable: false }), "");
});

test("deb17CancellationStressHtml · cuando el colchón aguanta incluso en tensión, lo dice en positivo", () => {
  const ctx = sandbox();
  const html = ctx.deb17CancellationStressHtml({ calculable: true, holds: true, horizonMonths: 6, worst: { label: "Mes 4", projectedLiquidity: 2200 } });
  assert.match(html, /DEB17/);
  assert.match(html, /-10% ingresos, \+10% gastos/);
  assert.match(html, /Mes 4/);
  assert.match(html, /class="positive"/);
});

test("deb17CancellationStressHtml · cuando se rompe bajo tensión, avisa cuántos meses fallan y que el escenario base sí aguanta", () => {
  const ctx = sandbox();
  const html = ctx.deb17CancellationStressHtml({
    calculable: true, holds: false, horizonMonths: 6,
    projected: [{ status: "sostenible" }, { status: "insostenible" }, { status: "insostenible" }, { status: "insostenible" }],
    worst: { label: "Mes 2", projectedLiquidity: -400 },
  });
  assert.match(html, /class="negative"/);
  assert.match(html, /3 de los 6 meses/);
  assert.match(html, /aunque el escenario base \(DEB15\) aguante/);
  assert.match(html, /subestima la liquidez futura real/);
});

test("wiring: handleAp1Compare activa DEB17 con la misma condición de cancelación total que DEB15, y usa el perfil \"stress\" real de E13", () => {
  const block = extractFunction("handleAp1Compare");
  assert.match(block, /isFullCancellation && e13Engine && stressProfile/);
  assert.match(block, /PROFILES\?\.find\(\(profile\) => profile\.id === "stress"\)/);
  assert.match(block, /e13Engine\.simulate\(canonicalScenarioResults\.base\?\.forecast \|\| \{\}, stressProfile, \[\]\)\.rows/);
  assert.match(block, /deb17CancellationStressHtml\(cancellationStressGuardrail\)/);
});

test("DEB17 nunca reimplementa el guardarraíl: reutiliza cancellationLiquidityGuardrail (DEB15) tal cual", () => {
  const block = extractFunction("handleAp1Compare");
  const deb17Section = block.slice(block.indexOf("DEB17"), block.indexOf("note.innerHTML"));
  assert.match(deb17Section, /cushionEngine\.cancellationLiquidityGuardrail\(/);
});
