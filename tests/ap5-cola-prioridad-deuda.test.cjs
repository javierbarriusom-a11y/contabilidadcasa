const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// AP5 · Bloque 10 (última tarea): deuda nueva y existente en una sola cola de prioridad. Depende de
// AP3 (escenarios marcados como tomados, AP6 — `takenAt`) y A16-5 (criterios avalancha/bola de
// nieve, ya construidos): ap5UnifiedDebtQueue reutiliza esos dos criterios de orden tal cual, sin
// inventar un tercero, y solo incluye la deuda de apalancamiento que el hogar marcó como tomada de
// verdad — un escenario solo explorado nunca entra en la cola.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  return app.slice(start, app.indexOf("\n", start) + 1);
}

function queueSandbox({ existingDebts = [], scenarios = [] }) {
  const context = {
    escenarioMotorDebtOptions: () => existingDebts,
    escenarioMotorDebtLabel: (contract) => contract.entity || contract.id,
    ap3LeverageScenarios: () => scenarios,
  };
  vm.createContext(context);
  vm.runInContext([extractConst("AP5_SOURCE_LABELS"), extractFunction("ap5UnifiedDebtQueue")].join("\n"), context);
  return context;
}

function debt(id, entity, currentPrincipal, apr) {
  return { id, entity, currentPrincipal, apr };
}

function scenario(id, name, takenAt, newDebtAmount, newDebtAnnualRatePercent) {
  return { id, name, takenAt, result: { newDebtAmount, newDebtAnnualRatePercent } };
}

test("sin deuda existente ni escenarios tomados, la cola queda vacía", () => {
  const context = queueSandbox({});
  assert.equal(context.ap5UnifiedDebtQueue("avalancha").length, 0);
});

test("un escenario de AP3 solo explorado (sin takenAt) nunca entra en la cola", () => {
  const context = queueSandbox({ scenarios: [scenario("s1", "Hipoteca para invertir", null, 20000, 5)] });
  assert.equal(context.ap5UnifiedDebtQueue("avalancha").length, 0);
});

test("mezcla deuda existente y deuda de apalancamiento tomada en una sola lista", () => {
  const context = queueSandbox({
    existingDebts: [debt("d1", "Cetelem", 5000, 10)],
    scenarios: [scenario("s1", "Hipoteca para invertir", "2026-09-01T00:00:00.000Z", 20000, 5)],
  });
  const queue = context.ap5UnifiedDebtQueue("avalancha");
  assert.equal(queue.length, 2);
  assert.ok(queue.some((item) => item.source === "existente" && item.id === "d1"));
  assert.ok(queue.some((item) => item.source === "apalancamiento" && item.id === "s1"));
});

test("avalancha ordena por TAE descendente, mezclando ambas fuentes", () => {
  const context = queueSandbox({
    existingDebts: [debt("d1", "Cetelem", 5000, 10), debt("d2", "Cofidis", 2000, 20)],
    scenarios: [scenario("s1", "Hipoteca", "2026-09-01T00:00:00.000Z", 20000, 15)],
  });
  const queue = context.ap5UnifiedDebtQueue("avalancha");
  assert.deepEqual([...queue.map((item) => item.id)], ["d2", "s1", "d1"]);
});

test("bola de nieve ordena por saldo/principal ascendente, mezclando ambas fuentes", () => {
  const context = queueSandbox({
    existingDebts: [debt("d1", "Cetelem", 5000, 10), debt("d2", "Cofidis", 2000, 20)],
    scenarios: [scenario("s1", "Hipoteca", "2026-09-01T00:00:00.000Z", 20000, 15)],
  });
  const queue = context.ap5UnifiedDebtQueue("bola-nieve");
  assert.deepEqual([...queue.map((item) => item.id)], ["d2", "d1", "s1"]);
});

test("ap5UnifiedDebtQueue está definida en app.js", () => {
  assert.match(app, /function ap5UnifiedDebtQueue\(/);
});
