const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Cushion = require("../canonical-cushion.js");

// DEB15 (Oleada 4, Bloque 6): guardarraíl de liquidez a varios meses tras una cancelación TOTAL de
// deuda — amortizeCushionGuardrail (DLX1) ya protege el colchón el día de la operación, pero no dice
// nada de los meses siguientes. cancellationLiquidityGuardrail() proyecta la liquidez que el propio
// forecast ya prevé para cada mes del horizonte, reducida por el importe pagado hoy (hipótesis
// conservadora: no asume que la cuota cancelada desaparece del forecast).

function seriesFixture(values) {
  return values.map((value, index) => ({ monthKey: `2026-${String(index + 1).padStart(2, "0")}`, label: `Mes ${index + 1}`, totals: { closingLiquidity: value } }));
}

test("cancellationLiquidityGuardrail · sin forecast disponible, no calculable", () => {
  const result = Cushion.cancellationLiquidityGuardrail({ amount: 5000, liquidity: 10000, floor: 3000, forecastSeries: [] });
  assert.equal(result.calculable, false);
  assert.ok(result.instant); // el guardarraíl instantáneo (DLX1) sigue calculándose aparte
});

test("cancellationLiquidityGuardrail · el colchón se sostiene todo el horizonte cuando el forecast se mantiene holgado", () => {
  const series = seriesFixture([10000, 10200, 10400, 10600, 10800, 11000]);
  const result = Cushion.cancellationLiquidityGuardrail({ amount: 5000, liquidity: 10000, floor: 3000, forecastSeries: series });
  assert.equal(result.calculable, true);
  assert.equal(result.holds, true);
  assert.equal(result.horizonMonths, 6);
  // mes 1: 10000 - 5000 = 5000, por encima del suelo (3000)
  assert.equal(result.projected[0].projectedLiquidity, 5000);
  assert.equal(result.projected[0].status, "sostenible");
});

test("cancellationLiquidityGuardrail · un mes futuro por debajo del suelo rompe el guardarraíl aunque el día de la cancelación aguante", () => {
  // Día de la cancelación: 10000 - 5000 = 5000, por encima del suelo (3000) -> instant sostenible.
  // Pero el forecast ya prevé un gasto grande en el mes 3 (liquidez cae a 6000 antes de la
  // cancelación) -> 6000 - 5000 = 1000, por debajo del suelo.
  const series = seriesFixture([10000, 9500, 6000, 9000, 9500, 10000]);
  const result = Cushion.cancellationLiquidityGuardrail({ amount: 5000, liquidity: 10000, floor: 3000, forecastSeries: series });
  assert.equal(result.instant.status, "sostenible");
  assert.equal(result.calculable, true);
  assert.equal(result.holds, false);
  assert.equal(result.worst.horizon, 3);
  assert.equal(result.worst.projectedLiquidity, 1000);
  assert.equal(result.worst.status, "insostenible");
});

test("cancellationLiquidityGuardrail · el horizonte se recorta al tamaño real del forecast disponible, sin inventar meses", () => {
  const series = seriesFixture([10000, 10200, 10400]); // solo 3 meses de forecast disponibles
  const result = Cushion.cancellationLiquidityGuardrail({ amount: 1000, liquidity: 10000, floor: 3000, forecastSeries: series, horizonMonths: 6 });
  assert.equal(result.calculable, true);
  assert.equal(result.horizonMonths, 3);
  assert.equal(result.requestedHorizonMonths, 6);
  assert.equal(result.projected.length, 3);
});

test("cancellationLiquidityGuardrail · admite un horizonte más corto explícito (3 meses)", () => {
  const series = seriesFixture([10000, 10200, 10400, 500, 10800, 11000]); // mes 4 caería, pero fuera de un horizonte de 3
  const result = Cushion.cancellationLiquidityGuardrail({ amount: 1000, liquidity: 10000, floor: 3000, forecastSeries: series, horizonMonths: 3 });
  assert.equal(result.horizonMonths, 3);
  assert.equal(result.holds, true); // los 3 primeros meses se sostienen; el mes 4 no se evaluó
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
  vm.runInContext(extractFunction("deb15CancellationGuardrailHtml"), context);
  return context;
}

test("deb15CancellationGuardrailHtml · sin resultado calculable, no muestra nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb15CancellationGuardrailHtml(null), "");
  assert.equal(ctx.deb15CancellationGuardrailHtml({ calculable: false }), "");
});

test("deb15CancellationGuardrailHtml · cuando se sostiene, lo dice en positivo con el peor mes", () => {
  const ctx = sandbox();
  const html = ctx.deb15CancellationGuardrailHtml({ calculable: true, holds: true, horizonMonths: 6, worst: { label: "Mes 3", projectedLiquidity: 5000 } });
  assert.match(html, /DEB15/);
  assert.match(html, /Mes 3/);
  assert.match(html, /class="positive"/);
});

test("deb15CancellationGuardrailHtml · cuando se rompe, avisa cuántos meses fallan y no oculta que no descuenta la cuota", () => {
  const ctx = sandbox();
  const html = ctx.deb15CancellationGuardrailHtml({
    calculable: true, holds: false, horizonMonths: 6,
    projected: [{ status: "sostenible" }, { status: "insostenible" }, { status: "insostenible" }],
    worst: { label: "Mes 3", projectedLiquidity: 1000 },
  });
  assert.match(html, /class="negative"/);
  assert.match(html, /2 de los 6 meses/);
  assert.match(html, /subestima la liquidez futura real/);
});

test("wiring: handleAp1Compare solo activa DEB15 cuando el importe cancela el principal entero de la deuda seleccionada", () => {
  const block = extractFunction("handleAp1Compare");
  assert.match(block, /amount >= debt\.currentPrincipal/);
  assert.match(block, /cancellationLiquidityGuardrail\(/);
  assert.match(block, /deb15CancellationGuardrailHtml\(cancellationGuardrail\)/);
});
