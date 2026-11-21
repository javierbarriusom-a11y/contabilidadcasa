// D-N23 (21/11/2026, decisión del hogar: «ok» al criterio realista). Un acuerdo aceptado con la entidad (SVD-3, `svdAcuerdo`)
// sustituye a la cuota de hoy desde su propio mes en el plan, como en Ruta y en el simulador. Las demás decisiones de deuda del plan
// siguen igual: la cuota deja de restarse al acabar su pago (`duration`). Se evalúa la función tal cual está en app.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const app = codigoApp();

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `falta ${name}`);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") { depth -= 1; if (depth === 0) return source.slice(start, index + 1); }
  }
  throw new Error(`sin cierre: ${name}`);
}

const sandbox = {};
vm.runInNewContext(`${extract(app, "debtReliefStartIndex")}; this.debtReliefStartIndex = debtReliefStartIndex;`, sandbox);
const { debtReliefStartIndex } = sandbox;

test("D-N23 · un acuerdo aceptado deja de restar la cuota de hoy el mes del acuerdo", () => {
  assert.equal(debtReliefStartIndex({ svdAcuerdo: true, duration: 1 }, 3), 3);
  assert.equal(debtReliefStartIndex({ svdAcuerdo: true, duration: 4 }, 0), 0);
});

test("D-N23 · las demás decisiones de deuda, como siempre: al acabar su pago", () => {
  assert.equal(debtReliefStartIndex({ duration: 1 }, 3), 4);
  assert.equal(debtReliefStartIndex({ duration: 3 }, 2), 5);
  assert.equal(debtReliefStartIndex({}, 2), 3);
  assert.equal(debtReliefStartIndex({ svdAcuerdo: "sí", duration: 1 }, 2), 3);
});

test("D-N23 · el plan, su detalle, la hoja «Qué ocurrirá» y Deuda usan el mismo inicio", () => {
  assert.match(extract(app, "addDebtRelief"), /debtReliefStartIndex\(item, startIndex\)/);
  assert.match(extract(app, "scheduledDecisionMonthlyImpact"), /debtReliefStartIndex\(project, project\.startIndex\)/);
  const puente = fs.readFileSync(path.join(root, "deuda-simulador-puente.js"), "utf8");
  assert.match(puente, /debtReliefStartIndex\(decision, pending\.monthIndex\)/);
  assert.match(puente, /deja de restarse desde el mes del acuerdo/);
  assert.doesNotMatch(puente, /mes siguiente al del acuerdo/);
  const control = fs.readFileSync(path.join(root, "views", "debt-control.js"), "utf8");
  assert.match(control, /debtReliefStartIndex\(item, placement\?\.startIndex/);
});

test("D-N23 · el motor canónico de decisiones dice lo mismo que el plan", () => {
  const Decisions = require("../canonical-decisions.js");
  const months = Array.from({ length: 6 }, (_, index) => ({ key: `2027-0${index + 1}`, label: `m${index}` }));
  const decision = { id: "d1", source: "debt", amount: 1500, duration: 1, monthlyRelief: 90, reliefMonths: 3, monthIndex: 1, lifecycleState: "approved" };
  const relief = (decisions) => Decisions.buildSchedule({ months, decisions }).months.map((row) => row.debtRelief);
  assert.deepEqual(relief([{ ...decision, svdAcuerdo: true }]), [0, 90, 90, 90, 0, 0]);
  assert.deepEqual(relief([decision]), [0, 0, 90, 90, 90, 0]);
});
