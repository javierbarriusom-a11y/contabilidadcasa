const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// RGX2 (Oleada 2 Bloque 2/3): alerta de concentración de conocimiento — misma lógica que A14-4
// (concentración de patrimonio por tipo) aplicada al hogar compartido en vez de al dinero. Solo
// avisa con 2+ miembros activos: con un hogar de una sola persona toda la concentración es
// inevitable, avisar sería ruido, no información nueva.

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

const SHARED_AREAS = ["planning", "movements", "debts", "goals", "documents", "scenarios"];

function sandbox() {
  const context = { E9Household: { SHARED_AREAS } };
  vm.createContext(context);
  vm.runInContext(extractFunction("rgxKnowledgeConcentration"), context);
  return context;
}

function memberAllAreas(userId, role, status = "active") {
  return { userId, role, status, areas: [...SHARED_AREAS] };
}

test("rgxKnowledgeConcentration · sin estado, no hay nada que calcular", () => {
  const ctx = sandbox();
  assert.equal(ctx.rgxKnowledgeConcentration(null), null);
});

test("rgxKnowledgeConcentration · con un solo miembro activo, nunca avisa (sería ruido)", () => {
  const ctx = sandbox();
  const state = { members: [memberAllAreas("u1", "owner")] };
  assert.equal(ctx.rgxKnowledgeConcentration(state), null);
});

test("rgxKnowledgeConcentration · dos miembros activos cubriendo todas las áreas, no avisa", () => {
  const ctx = sandbox();
  const state = { members: [memberAllAreas("u1", "owner"), memberAllAreas("u2", "member")] };
  assert.equal(ctx.rgxKnowledgeConcentration(state), null);
});

test("rgxKnowledgeConcentration · un área cubierta solo por una persona, avisa con esa área", () => {
  const ctx = sandbox();
  const state = {
    members: [
      memberAllAreas("u1", "owner"),
      { userId: "u2", role: "member", status: "active", areas: ["planning", "movements"] },
    ],
  };
  const result = ctx.rgxKnowledgeConcentration(state);
  assert.deepEqual(result.areas, ["debts", "goals", "documents", "scenarios"]);
  assert.equal(result.totalMembers, 2);
});

test("rgxKnowledgeConcentration · un miembro revocado no cuenta como cobertura", () => {
  const ctx = sandbox();
  const state = {
    members: [
      memberAllAreas("u1", "owner"),
      memberAllAreas("u2", "member", "revoked"),
    ],
  };
  // Solo queda una persona activa de verdad — no avisa (ver caso de un solo miembro).
  assert.equal(ctx.rgxKnowledgeConcentration(state), null);
});

test("rgxKnowledgeConcentration · con tres miembros, un área cubierta por dos ya no avisa de esa área", () => {
  const ctx = sandbox();
  const state = {
    members: [
      memberAllAreas("u1", "owner"),
      memberAllAreas("u2", "member"),
      { userId: "u3", role: "viewer", status: "active", areas: ["debts"] },
    ],
  };
  assert.equal(ctx.rgxKnowledgeConcentration(state), null);
});
