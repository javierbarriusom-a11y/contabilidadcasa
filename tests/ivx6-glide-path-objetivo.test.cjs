const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Portfolio = require(path.join(root, "canonical-portfolio.js"));

// IVX6 (Oleada 2 Bloque 3): glide path de aportaciones por horizonte. Antes de construirlo, el
// usuario decidió construir primero el vínculo posición↔objetivo (RGX1/RGX2-style scope check):
// hasta ahora IV1 (cartera) y A10-1 (objetivos) eran dos registros independientes sin ninguna
// relación entre una posición concreta y el objetivo que financia. Sin rating de riesgo por
// posición, el glide path da una banda de horizonte (crecimiento/transición/conservador), nunca
// una orden de "vende X% de esto" que esta app no tiene datos para respaldar.

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

test("glidePathBand · 5+ años es crecimiento, 2-5 transición, menos de 2 conservador, negativo vencido", () => {
  assert.equal(Portfolio.glidePathBand(70), "growth");
  assert.equal(Portfolio.glidePathBand(60), "growth");
  assert.equal(Portfolio.glidePathBand(59), "transition");
  assert.equal(Portfolio.glidePathBand(24), "transition");
  assert.equal(Portfolio.glidePathBand(23), "conservative");
  assert.equal(Portfolio.glidePathBand(0), "conservative");
  assert.equal(Portfolio.glidePathBand(-1), "overdue");
});

test("glidePathForGoal · agrupa solo las posiciones vinculadas a ese objetivo, con su peso dentro del total vinculado", () => {
  const result = Portfolio.glidePathForGoal(
    {
      goalId: "goal-1",
      goalName: "Entrada del piso",
      targetDate: "2027-06-01",
      positions: [
        { id: "p1", label: "Fondo A", currentValue: 6000, goalId: "goal-1" },
        { id: "p2", label: "Fondo B", currentValue: 4000, goalId: "goal-1" },
        { id: "p3", label: "Cripto sin objetivo", currentValue: 9000, goalId: "" },
      ],
    },
    new Date("2026-06-01T00:00:00Z"),
  );
  assert.equal(result.calculable, true);
  assert.equal(result.monthsRemaining, 12);
  assert.equal(result.band, "conservative");
  assert.equal(result.totalValue, 10000);
  assert.equal(result.positions.length, 2);
  assert.equal(result.positions[0].pct, 60);
});

test("glidePathForGoal · sin fecha objetivo, no calculable", () => {
  const result = Portfolio.glidePathForGoal({ goalId: "goal-1", targetDate: "", positions: [] });
  assert.equal(result.calculable, false);
});

test("index.html: selector de objetivo asociado (opcional) al registrar una posición, y tarjeta de glide path", () => {
  assert.match(html, /id="iv1PositionGoalId"/);
  assert.match(html, /id="ivx6GlidePath"/);
});

test("app.js: saveIv1Position guarda goalId y renderIvx6GlidePath está cableado en el render() central y en las mutaciones de posición", () => {
  const saveBlock = extractFunction("saveIv1Position");
  assert.match(saveBlock, /qs\("iv1PositionGoalId"\)\?\.value/);
  // IVX4 (misma oleada, tarea siguiente) añadió feePct entre goalId y contributions.
  assert.match(saveBlock, /goalId, feePct, contributions: \[\]/);
  assert.match(saveBlock, /renderIvx6GlidePath\(\);/);
  const removeBlock = extractFunction("removeIv1Position");
  assert.match(removeBlock, /renderIvx6GlidePath\(\);/);
  assert.match(app, /renderIv1GoalOptions\(\);/);
});

test("app.js: renderIvx6GlidePath solo usa objetivos con fecha (activeGoalsForBudget) y nunca recomienda una posición concreta a ajustar", () => {
  const block = extractFunction("renderIvx6GlidePath");
  assert.match(block, /activeGoalsForBudget\(\)/);
  assert.match(block, /glidePathForGoal/);
  assert.doesNotMatch(block, /vende|compra|reduce tu posición/i);
});
