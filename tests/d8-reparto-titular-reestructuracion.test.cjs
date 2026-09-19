const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// D8 (BACKLOG_CONTABILIDADCASA_2_0.md): reparto por titular del plan conjunto que ya calcula DI5
// (canonical-joint-restructuring.js). No repite el plan en dos planes independientes por persona
// (eso es GOB19, para el escenario de separación): solo atribuye cada propuesta ya calculada del
// plan conjunto a quién es dueño de ese contrato, con el mismo mapa de titularidad que ya usa
// gob19DebtsByOwner (p2State().ownership, con P2Domain.inferOwner como respaldo).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    money: (value, precise) => `${Number(value || 0).toFixed(precise ? 2 : 0)} €`,
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    GOB19_OWNER_LABELS: { household: "Hogar", javi: "Javi", tere: "Tere" },
    ...extra,
  };
}

// --- di5ProposalsByOwner ------------------------------------------------------------------------

test("di5ProposalsByOwner · sin ninguna titularidad declarada, todo cae en household", () => {
  const context = sandboxWith(["di5ProposalsByOwner"], baseHelpers({
    debtContractSourceRows: () => [{ id: "c1", entity: "Banco A", number: "001" }],
    p2State: () => ({ ownership: {} }),
    window: {},
  }));
  const grouped = context.di5ProposalsByOwner([{ id: "c1", currentMonthlyPayment: 100 }]);
  assert.equal(grouped.household.length, 1);
  assert.equal(grouped.javi.length, 0);
  assert.equal(grouped.tere.length, 0);
});

test("di5ProposalsByOwner · usa la titularidad declarada en p2State().ownership", () => {
  const context = sandboxWith(["di5ProposalsByOwner"], baseHelpers({
    debtContractSourceRows: () => [
      { id: "c1", entity: "Banco A", number: "001" },
      { id: "c2", entity: "Banco B", number: "002" },
    ],
    p2State: () => ({ ownership: { "debt|c1": "javi", "debt|c2": "tere" } }),
    window: {},
  }));
  const grouped = context.di5ProposalsByOwner([
    { id: "c1", currentMonthlyPayment: 100 },
    { id: "c2", currentMonthlyPayment: 50 },
  ]);
  assert.equal(grouped.javi.length, 1);
  assert.equal(grouped.javi[0].id, "c1");
  assert.equal(grouped.tere.length, 1);
  assert.equal(grouped.tere[0].id, "c2");
});

test("di5ProposalsByOwner · sin dato declarado, recurre a P2Domain.inferOwner como respaldo", () => {
  const context = sandboxWith(["di5ProposalsByOwner"], baseHelpers({
    debtContractSourceRows: () => [{ id: "c1", entity: "Hipoteca Tere", number: "001" }],
    p2State: () => ({ ownership: {} }),
    window: { P2Domain: { inferOwner: () => "tere" } },
  }));
  const grouped = context.di5ProposalsByOwner([{ id: "c1", currentMonthlyPayment: 100 }]);
  assert.equal(grouped.tere.length, 1);
  assert.equal(grouped.household.length, 0);
});

test("di5ProposalsByOwner · una propuesta cuyo contrato ya no está en debtContractSourceRows cae en household", () => {
  const context = sandboxWith(["di5ProposalsByOwner"], baseHelpers({
    debtContractSourceRows: () => [],
    p2State: () => ({ ownership: {} }),
    window: {},
  }));
  const grouped = context.di5ProposalsByOwner([{ id: "fantasma", currentMonthlyPayment: 100 }]);
  assert.equal(grouped.household.length, 1);
});

// --- di5OwnerBreakdownHtml -----------------------------------------------------------------------

test("di5OwnerBreakdownHtml · nada asignado a Javi/Tere y sin deuda de hogar, cadena vacía", () => {
  const context = sandboxWith(["di5OwnerBreakdownHtml"], baseHelpers());
  const html = context.di5OwnerBreakdownHtml({ javi: [], tere: [], household: [] });
  assert.equal(html, "");
});

test("di5OwnerBreakdownHtml · solo deuda de hogar sin asignar, avisa en vez de fingir un reparto", () => {
  const context = sandboxWith(["di5OwnerBreakdownHtml"], baseHelpers());
  const html = context.di5OwnerBreakdownHtml({ javi: [], tere: [], household: [{ id: "c1" }] });
  assert.match(html, /Ningún contrato de deuda está asignado a Javi o Tere/);
  assert.match(html, /Familia/);
});

test("di5OwnerBreakdownHtml · con Javi y Tere asignados, suma cuota actual, nueva y alivio por titular", () => {
  const context = sandboxWith(["di5OwnerBreakdownHtml"], baseHelpers());
  const html = context.di5OwnerBreakdownHtml({
    javi: [
      { id: "c1", currentMonthlyPayment: 200, newMonthlyPayment: 150, relief: 50 },
    ],
    tere: [
      { id: "c2", currentMonthlyPayment: 100, newMonthlyPayment: 100, relief: 0 },
      { id: "c3", currentMonthlyPayment: 80, newMonthlyPayment: 60, relief: 20 },
    ],
    household: [],
  });
  assert.match(html, /Reparto por titular/);
  assert.match(html, /Javi.*1 contrato\(s\), cuota 200\.00 € → 150\.00 €\/mes \(alivio de 50\.00 €\/mes\)/);
  assert.match(html, /Tere.*2 contrato\(s\), cuota 180\.00 € → 160\.00 €\/mes \(alivio de 20\.00 €\/mes\)/);
});

test("di5OwnerBreakdownHtml · sin alivio para un titular, no muestra la coletilla de alivio", () => {
  const context = sandboxWith(["di5OwnerBreakdownHtml"], baseHelpers());
  const html = context.di5OwnerBreakdownHtml({
    javi: [{ id: "c1", currentMonthlyPayment: 200, newMonthlyPayment: 200, relief: 0 }],
    tere: [],
    household: [],
  });
  assert.match(html, /200\.00 € → 200\.00 €\/mes\./);
  assert.doesNotMatch(html, /alivio/);
});

test("di5OwnerBreakdownHtml · Javi/Tere asignados y además deuda de hogar sin asignar, avisa de lo que se queda fuera", () => {
  const context = sandboxWith(["di5OwnerBreakdownHtml"], baseHelpers());
  const html = context.di5OwnerBreakdownHtml({
    javi: [{ id: "c1", currentMonthlyPayment: 200, newMonthlyPayment: 150, relief: 50 }],
    tere: [],
    household: [{ id: "c2" }, { id: "c3" }],
  });
  assert.match(html, /Javi/);
  assert.match(html, /2 contrato\(s\) sin asignar a Javi o Tere quedan fuera de este reparto/);
});

// --- wiring: handleDi5CompareJointRestructuring ---------------------------------------------------

test("wiring: handleDi5CompareJointRestructuring atribuye el plan conjunto por titular antes de pintar la nota", () => {
  const block = extractFunction("handleDi5CompareJointRestructuring");
  assert.match(block, /const ownerBreakdown = di5OwnerBreakdownHtml\(di5ProposalsByOwner\(result\.proposals\)\);/);
  assert.match(block, /note\.innerHTML = `.*\$\{ownerBreakdown\}`;/);
});
