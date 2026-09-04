const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// RGX1 (Oleada 2 Bloque 2/3): simulacro guiado de pérdida de acceso. Combina la copia de emergencia
// (A0-9, ya real) y el hogar compartido (A5-3, RGX1/RGX2): si la persona que usa la app hoy pierde
// el acceso, ¿hay una copia reciente y hay alguien más que pueda seguir gestionando lo crítico? No
// ejecuta ninguna acción — solo hace visible el estado real de cada punto.

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
  vm.runInContext(`const RGX1_BACKUP_STALE_DAYS = ${JSON.stringify(30)};`, context);
  vm.runInContext(extractFunction("rgxKnowledgeConcentration"), context);
  vm.runInContext(extractFunction("rgx1AccessLossReadiness"), context);
  return context;
}

const NOW = new Date("2026-09-04T10:00:00.000Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function stewardHousehold() {
  return {
    members: [
      { userId: "u1", role: "owner", status: "active", areas: [...SHARED_AREAS] },
      { userId: "u2", role: "admin", status: "active", areas: [...SHARED_AREAS] },
    ],
  };
}

test("rgx1AccessLossReadiness · sin copia nunca descargada, el punto de copia falla y dice explícitamente que nunca se descargó", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), null, NOW);
  const backup = result.checks.find((check) => check.id === "backup");
  assert.equal(backup.ok, false);
  assert.match(backup.detail, /Nunca se ha descargado/);
});

test("rgx1AccessLossReadiness · copia reciente (dentro del umbral), el punto de copia pasa", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), daysAgo(5), NOW);
  const backup = result.checks.find((check) => check.id === "backup");
  assert.equal(backup.ok, true);
  assert.match(backup.detail, /hace 5 día\(s\)/);
});

test("rgx1AccessLossReadiness · copia más antigua que el umbral, falla y da la antigüedad real", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), daysAgo(40), NOW);
  const backup = result.checks.find((check) => check.id === "backup");
  assert.equal(backup.ok, false);
  assert.match(backup.detail, /hace 40 día\(s\)/);
});

test("rgx1AccessLossReadiness · sin hogar (sin miembros), el punto de redundancia falla explícitamente", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness({ members: [] }, daysAgo(1), NOW);
  const household = result.checks.find((check) => check.id === "household");
  assert.equal(household.ok, false);
  assert.match(household.detail, /Nadie más tiene acceso/);
});

test("rgx1AccessLossReadiness · un solo miembro con rol de administrador, sin redundancia todavía", () => {
  const ctx = sandbox();
  const state = { members: [{ userId: "u1", role: "owner", status: "active", areas: [...SHARED_AREAS] }, { userId: "u2", role: "member", status: "active", areas: [...SHARED_AREAS] }] };
  const result = ctx.rgx1AccessLossReadiness(state, daysAgo(1), NOW);
  const household = result.checks.find((check) => check.id === "household");
  assert.equal(household.ok, false);
  assert.match(household.detail, /Solo una persona/);
});

test("rgx1AccessLossReadiness · dos personas con rol de propietario o administrador, redundancia cubierta", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), daysAgo(1), NOW);
  const household = result.checks.find((check) => check.id === "household");
  assert.equal(household.ok, true);
  assert.match(household.detail, /2 personas/);
});

test("rgx1AccessLossReadiness · un miembro revocado no cuenta para la redundancia", () => {
  const ctx = sandbox();
  const state = { members: [{ userId: "u1", role: "owner", status: "active", areas: [...SHARED_AREAS] }, { userId: "u2", role: "admin", status: "revoked", areas: [...SHARED_AREAS] }] };
  const result = ctx.rgx1AccessLossReadiness(state, daysAgo(1), NOW);
  const household = result.checks.find((check) => check.id === "household");
  assert.equal(household.ok, false);
});

test("rgx1AccessLossReadiness · reutiliza rgxKnowledgeConcentration para el punto de cobertura por área", () => {
  const ctx = sandbox();
  const state = {
    members: [
      { userId: "u1", role: "owner", status: "active", areas: [...SHARED_AREAS] },
      { userId: "u2", role: "admin", status: "active", areas: ["planning"] },
    ],
  };
  const result = ctx.rgx1AccessLossReadiness(state, daysAgo(1), NOW);
  const coverage = result.checks.find((check) => check.id === "coverage");
  assert.equal(coverage.ok, false);
  assert.match(coverage.detail, /área\(s\) con un solo punto de acceso/);
});

test("rgx1AccessLossReadiness · los tres puntos en verde marcan ready: true", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), daysAgo(1), NOW);
  assert.equal(result.ready, true);
  assert.equal(result.checks.every((check) => check.ok), true);
});

test("rgx1AccessLossReadiness · un solo punto en rojo basta para que ready sea false", () => {
  const ctx = sandbox();
  const result = ctx.rgx1AccessLossReadiness(stewardHousehold(), null, NOW);
  assert.equal(result.ready, false);
});
