const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Portfolio = require(path.join(root, "canonical-portfolio.js"));

// IVX2 (Oleada 2 Bloque 3): comparación contra un índice de referencia. Aproximada por
// construcción: la XIRR de la cartera es ponderada por dinero (IV2), el índice se compara con la
// rentabilidad anualizada que el hogar declara para el mismo periodo — sin traer ningún precio de
// mercado real.

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

test("compareAgainstBenchmark · con XIRR e índice declarado, calcula la diferencia en puntos", () => {
  const result = Portfolio.compareAgainstBenchmark({ ratePct: 9.5 }, 7);
  assert.equal(result.calculable, true);
  assert.equal(result.deltaPct, 2.5);
  assert.equal(result.beatsBenchmark, true);
});

test("compareAgainstBenchmark · cartera por debajo del índice", () => {
  const result = Portfolio.compareAgainstBenchmark({ ratePct: 3 }, 7);
  assert.equal(result.beatsBenchmark, false);
  assert.equal(result.deltaPct, -4);
});

test("compareAgainstBenchmark · sin XIRR calculable (ratePct null), no calculable — no se inventa una cifra", () => {
  const result = Portfolio.compareAgainstBenchmark({ ratePct: null, reason: "insufficient-flows" }, 7);
  assert.equal(result.calculable, false);
});

test("compareAgainstBenchmark · sin índice declarado, no calculable", () => {
  const result = Portfolio.compareAgainstBenchmark({ ratePct: 9.5 }, null);
  assert.equal(result.calculable, false);
});

test("index.html: campo del índice de referencia vive junto a la cartera", () => {
  assert.match(html, /id="iv1BenchmarkAnnualReturnPct"/);
});

test("app.js: ivx2BenchmarkComparisonHtml se añade a renderIv1PositionSummary y el campo dispara un recálculo en vivo", () => {
  const block = extractFunction("renderIv1PositionSummary");
  assert.match(block, /ivx2BenchmarkComparisonHtml\(engine, xirr\)/);
  assert.match(app, /qs\("iv1BenchmarkAnnualReturnPct"\)\?\.addEventListener\("input", renderIv1PositionSummary\);/);
});
