const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");
const E15 = require("../canonical-e15-goals.js");
const P2Domain = require("../p2-domain.js");

// INV12 (Oleada 4, Bloque 4): formaliza `fundingPositions` en el schema del objetivo — antes, la
// única forma de saber qué posiciones financian un objetivo era escanear todas las posiciones
// buscando `position.goalId` (campo de fortuna, nunca validado por normalizePosition() ni por
// canonical-e15-goals.js). Ahora el propio objetivo declara, en su schema, qué posiciones lo
// financian; el escaneo antiguo se mantiene solo como respaldo para datos ya guardados antes de
// esta tarea.

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

test("canonical-portfolio.js: linkedPositionsForGoal prioriza fundingPositions declarado y cae al goalId de fortuna si viene vacío", () => {
  const positions = [
    { id: "p1", goalId: "goal-1" },
    { id: "p2", goalId: "goal-2" },
    { id: "p3", goalId: "" },
  ];
  assert.deepEqual(Portfolio.linkedPositionsForGoal("goal-1", positions, ["p2", "p3"]).map((p) => p.id), ["p2", "p3"]);
  assert.deepEqual(Portfolio.linkedPositionsForGoal("goal-1", positions, []).map((p) => p.id), ["p1"]);
  assert.deepEqual(Portfolio.linkedPositionsForGoal("goal-1", positions, undefined).map((p) => p.id), ["p1"]);
});

test("glidePathForGoal · con fundingPositionIds declarado, ignora el goalId de fortuna de las posiciones", () => {
  const result = Portfolio.glidePathForGoal(
    {
      goalId: "goal-1",
      goalName: "Entrada del piso",
      targetDate: "2027-06-01",
      positions: [
        { id: "p1", label: "Fondo A", currentValue: 6000, goalId: "goal-2" },
        { id: "p2", label: "Fondo B", currentValue: 4000, goalId: "" },
      ],
      fundingPositionIds: ["p1", "p2"],
    },
    new Date("2026-06-01T00:00:00Z"),
  );
  assert.equal(result.calculable, true);
  assert.equal(result.totalValue, 10000);
  assert.equal(result.positions.length, 2);
});

test("assetClassVsGlidePath · también acepta fundingPositionIds declarado", () => {
  const result = Portfolio.assetClassVsGlidePath({
    goalId: "goal-1",
    positions: [{ id: "p1", currentValue: 8000, assetClass: "renta-variable", goalId: "" }],
    fundingPositionIds: ["p1"],
  }, "growth");
  assert.equal(result.calculable, true);
  assert.equal(result.growthPct, 100);
});

test("p2-domain.js normalizeGoal: fundingPositions se declara, deduplica y descarta valores vacíos", () => {
  const goal = P2Domain.normalizeGoal({ id: "g1", name: "Entrada piso", target: 1000, fundingPositions: ["p1", "p2", "p1", "", null, "  "] });
  assert.deepEqual(goal.fundingPositions, ["p1", "p2"]);
});

test("p2-domain.js normalizeGoal: sin fundingPositions declarado, el objetivo queda con array vacío, nunca inventado", () => {
  const goal = P2Domain.normalizeGoal({ id: "g1", name: "Entrada piso", target: 1000 });
  assert.deepEqual(goal.fundingPositions, []);
});

test("canonical-e15-goals.js normalizeGoal: mismo campo fundingPositions, normalizado igual que en p2-domain.js", () => {
  const goal = E15.normalizeGoal({ id: "g1", fundingPositions: ["p1", "p1", " p2 "] });
  assert.deepEqual(goal.fundingPositions, ["p1", "p2"]);
});

function sandbox({ goals = [] } = {}) {
  let state = { goals };
  const context = {
    p2State: () => state,
    saveP2State: (next) => { state = next; return state; },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv12AddPositionToGoalFunding"), context);
  vm.runInContext(extractFunction("inv12RemovePositionFromGoalFunding"), context);
  return context;
}

test("inv12AddPositionToGoalFunding · añade el id de la posición al fundingPositions del objetivo, sin duplicar", () => {
  const ctx = sandbox({ goals: [{ id: "goal-1", fundingPositions: ["p1"] }] });
  ctx.inv12AddPositionToGoalFunding("goal-1", "p2");
  ctx.inv12AddPositionToGoalFunding("goal-1", "p1");
  // Array.from: las estructuras creadas dentro del vm.createContext pertenecen a otro realm, y
  // deepStrictEqual distingue prototipos de Array entre realms aunque el contenido sea idéntico.
  assert.deepEqual(Array.from(ctx.p2State().goals[0].fundingPositions), ["p1", "p2"]);
});

test("inv12AddPositionToGoalFunding · un goalId que no corresponde a ningún objetivo real no crea ni modifica nada", () => {
  const ctx = sandbox({ goals: [{ id: "goal-1", fundingPositions: [] }] });
  ctx.inv12AddPositionToGoalFunding("goal-inexistente", "p1");
  assert.deepEqual(ctx.p2State().goals, [{ id: "goal-1", fundingPositions: [] }]);
});

test("inv12RemovePositionFromGoalFunding · retira la posición eliminada de cualquier objetivo que la declarase", () => {
  const ctx = sandbox({ goals: [
    { id: "goal-1", fundingPositions: ["p1", "p2"] },
    { id: "goal-2", fundingPositions: ["p2"] },
  ] });
  ctx.inv12RemovePositionFromGoalFunding("p2");
  assert.deepEqual(Array.from(ctx.p2State().goals[0].fundingPositions), ["p1"]);
  assert.deepEqual(Array.from(ctx.p2State().goals[1].fundingPositions), []);
});

test("app.js: saveIv1Position declara la posición en el objetivo elegido (fuente formal) cuando hay goalId", () => {
  const block = extractFunction("saveIv1Position");
  assert.match(block, /inv12AddPositionToGoalFunding\(goalId, newPositionId\);/);
});

test("app.js: removeIv1Position retira la posición eliminada de fundingPositions", () => {
  const block = extractFunction("removeIv1Position");
  assert.match(block, /inv12RemovePositionFromGoalFunding\(id\);/);
});

test("app.js: renderIvx6GlidePath combina goal.fundingPositions con el escaneo histórico por goalId, y pasa fundingPositionIds a los dos motores", () => {
  const block = extractFunction("renderIvx6GlidePath");
  assert.match(block, /goal\.fundingPositions/);
  assert.match(block, /fundingPositionIds/);
});
