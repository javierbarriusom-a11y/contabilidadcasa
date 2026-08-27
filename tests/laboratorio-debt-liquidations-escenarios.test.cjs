const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/cierre.js"), "utf8");

// Laboratorio · debtLiquidations (20 de agosto de 2026) — la última de las tres decisiones de
// producto de §7 del backlog. Deuda · Ruta y Deuda · Comparar aplican decisiones de deuda a través
// de Escenarios (`escenario-motor-saved`), un almacén local distinto de `debtLiquidations` que Hoy
// y Deuda sí leen para deduplicar ofertas ya decididas (hallazgo L-5, docs/BACKLOG_NUEVE_PANTALLAS.md
// §7). Estas pruebas cubren el puente: cuando un plan de Escenarios pasa a «vigente» (Cierre lo
// confirma), sus decisiones de deuda se reflejan en `debtLiquidations`; cuando deja de ser vigente
// (lo sustituye otro, o se elimina), el reflejo se retira.

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

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
  const context = { round2, ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function typeFor(tipo) {
  const grupos = {
    amortizacion: "Deuda", amortizacion_fraccionada: "Deuda", refinanciacion: "Deuda",
    reunificacion: "Deuda", retomar_pagos: "Deuda", acuerdo_quita: "Deuda", deuda_nueva: "Deuda",
    gasto: "Gastos", ingreso: "Ingresos",
  };
  return { grupo: grupos[tipo] || "Otro" };
}

function debtGroupContext(names) {
  return sandboxWith(names, { escenarioMotorResolveType: (decision) => typeFor(decision?.tipo), money: (v) => `${v} €` });
}

// --- escenarioDecisionIsDebt / escenarioDecisionTargetIds -------------------------------------

test("Laboratorio · una decisión que no es de deuda no aporta ningún target", () => {
  const context = debtGroupContext(["escenarioDecisionIsDebt", "escenarioDecisionTargetIds"]);
  assert.equal(context.escenarioDecisionIsDebt({ tipo: "gasto" }), false);
  assert.equal(JSON.stringify(context.escenarioDecisionTargetIds({ tipo: "gasto", params: { deudaId: "cetelem" } })), "[]");
});

test("Laboratorio · amortizacion/refinanciacion/retomar_pagos/acuerdo_quita target su deudaId único", () => {
  const context = debtGroupContext(["escenarioDecisionIsDebt", "escenarioDecisionTargetIds"]);
  ["amortizacion", "refinanciacion", "retomar_pagos", "acuerdo_quita"].forEach((tipo) => {
    assert.equal(context.escenarioDecisionIsDebt({ tipo }), true);
    assert.equal(JSON.stringify(context.escenarioDecisionTargetIds({ tipo, params: { deudaId: "cetelem" } })), '["cetelem"]');
  });
});

test("Laboratorio · reunificacion target todas las deudas de deudaIds, no solo la primera", () => {
  const context = debtGroupContext(["escenarioDecisionIsDebt", "escenarioDecisionTargetIds"]);
  const decision = { tipo: "reunificacion", params: { deudaIds: ["cetelem", "santander", ""] } };
  assert.equal(JSON.stringify(context.escenarioDecisionTargetIds(decision)), '["cetelem","santander"]');
});

test("Laboratorio · deuda_nueva es del grupo Deuda pero no tiene contrato existente que marcar", () => {
  const context = debtGroupContext(["escenarioDecisionIsDebt", "escenarioDecisionTargetIds"]);
  const decision = { tipo: "deuda_nueva", params: { principal: 5000, cuota: 200 } };
  assert.equal(context.escenarioDecisionIsDebt(decision), true);
  assert.equal(JSON.stringify(context.escenarioDecisionTargetIds(decision)), "[]");
});

// --- escenarioDecisionAmount --------------------------------------------------------------------

test("Laboratorio · escenarioDecisionAmount lee el importe correcto según el tipo", () => {
  const context = sandboxWith(["escenarioDecisionAmount"]);
  assert.equal(context.escenarioDecisionAmount({ tipo: "amortizacion", params: { importe: 1500 } }), 1500);
  assert.equal(context.escenarioDecisionAmount({ tipo: "amortizacion_fraccionada", params: { importeMensual: 100, meses: 6 } }), 600);
  assert.equal(context.escenarioDecisionAmount({ tipo: "refinanciacion", params: { nuevoPrincipal: 8000 } }), 8000);
  assert.equal(context.escenarioDecisionAmount({ tipo: "acuerdo_quita", params: { importePactado: 3000 } }), 3000);
});

test("Laboratorio · reunificacion y retomar_pagos se dejan en 0 antes que inventar un reparto", () => {
  const context = sandboxWith(["escenarioDecisionAmount"]);
  assert.equal(context.escenarioDecisionAmount({ tipo: "reunificacion", params: { nuevoPrincipal: 20000 } }), 0);
  assert.equal(context.escenarioDecisionAmount({ tipo: "retomar_pagos", params: { cuota: 150 } }), 0);
});

// --- syncDebtLiquidationsFromEscenario -----------------------------------------------------------

function syncContext(debtLiquidations) {
  const context = debtGroupContext([
    "escenarioDecisionIsDebt",
    "escenarioDecisionTargetIds",
    "escenarioDecisionAmount",
    "escenarioDebtLiquidationName",
    "syncDebtLiquidationsFromEscenario",
  ]);
  context.debtLiquidations = debtLiquidations;
  return context;
}

test("Laboratorio · un plan vigente con una amortización refleja esa deuda en debtLiquidations", () => {
  const context = syncContext([]);
  const entry = { id: "esc-1", decisiones: [{ id: "d1", tipo: "amortizacion", titulo: "Amortizar Cetelem", params: { deudaId: "cetelem", importe: 1200 } }] };
  const changed = context.syncDebtLiquidationsFromEscenario(entry);
  assert.equal(changed, true);
  assert.equal(context.debtLiquidations.length, 1);
  const reflected = context.debtLiquidations[0];
  assert.equal(reflected.targetId, "cetelem");
  assert.equal(reflected.amount, 1200);
  assert.equal(reflected.source, "escenario");
  assert.equal(reflected.escenarioSavedId, "esc-1");
  assert.equal(reflected.escenarioDecisionId, "d1");
  assert.equal(reflected.lifecycleState, "approved");
});

test("Laboratorio · una reunificación crea un reflejo por cada deuda reunificada", () => {
  const context = syncContext([]);
  const entry = { id: "esc-2", decisiones: [{ id: "d1", tipo: "reunificacion", titulo: "Reunificar dos deudas", params: { deudaIds: ["cetelem", "santander"], nuevoPrincipal: 15000 } }] };
  context.syncDebtLiquidationsFromEscenario(entry);
  const targets = context.debtLiquidations.map((item) => item.targetId).sort();
  assert.equal(JSON.stringify(targets), '["cetelem","santander"]');
});

test("Laboratorio · una deuda ya decidida por cualquier otra vía no se refleja dos veces", () => {
  const context = syncContext([{ id: "debt-legacy-1", targetId: "cetelem", name: "Ya decidida en Control de deuda" }]);
  const entry = { id: "esc-3", decisiones: [{ id: "d1", tipo: "amortizacion", titulo: "Amortizar Cetelem", params: { deudaId: "cetelem", importe: 900 } }] };
  const changed = context.syncDebtLiquidationsFromEscenario(entry);
  assert.equal(changed, false);
  assert.equal(context.debtLiquidations.length, 1);
  assert.equal(context.debtLiquidations[0].id, "debt-legacy-1");
});

test("Laboratorio · las decisiones que no son de deuda o sin deudaId no dejan ningún reflejo", () => {
  const context = syncContext([]);
  const entry = {
    id: "esc-4",
    decisiones: [
      { id: "d1", tipo: "gasto", titulo: "Gasto extra", params: {} },
      { id: "d2", tipo: "deuda_nueva", titulo: "Pedir deuda nueva", params: { principal: 3000 } },
    ],
  };
  const changed = context.syncDebtLiquidationsFromEscenario(entry);
  assert.equal(changed, false);
  assert.equal(context.debtLiquidations.length, 0);
});

test("Laboratorio · syncDebtLiquidationsFromEscenario sin entrada no hace nada, sin lanzar", () => {
  const context = syncContext([]);
  assert.equal(context.syncDebtLiquidationsFromEscenario(null), false);
});

// --- retractDebtLiquidationsFromEscenario --------------------------------------------------------

test("Laboratorio · retirar un plan retracta solo sus propios reflejos, no los de otro plan ni los manuales", () => {
  const context = sandboxWith(["retractDebtLiquidationsFromEscenario"]);
  context.debtLiquidations = [
    { id: "escenario:esc-1:d1:cetelem", targetId: "cetelem", source: "escenario", escenarioSavedId: "esc-1" },
    { id: "escenario:esc-2:d1:santander", targetId: "santander", source: "escenario", escenarioSavedId: "esc-2" },
    { id: "debt-manual-1", targetId: "ing-direct", name: "Aplicada a mano en Control de deuda" },
  ];
  const changed = context.retractDebtLiquidationsFromEscenario("esc-1");
  assert.equal(changed, true);
  assert.equal(JSON.stringify(context.debtLiquidations.map((item) => item.id)), '["escenario:esc-2:d1:santander","debt-manual-1"]');
});

test("Laboratorio · retirar un plan sin reflejos devuelve false y no toca nada", () => {
  const context = sandboxWith(["retractDebtLiquidationsFromEscenario"]);
  context.debtLiquidations = [{ id: "debt-manual-1", targetId: "ing-direct" }];
  const changed = context.retractDebtLiquidationsFromEscenario("esc-nunca-existio");
  assert.equal(changed, false);
  assert.equal(context.debtLiquidations.length, 1);
});

// --- Cableado: handleCierrePropuestoConfirm / handleEscenarioGuardadosDelete -------------------

test("Laboratorio · confirmar un propuesto sincroniza sus decisiones de deuda y retracta las del vigente anterior", () => {
  const source = extractFunction("handleCierrePropuestoConfirm");
  assert.match(source, /retractDebtLiquidationsFromEscenario\(entry\.id\)/);
  assert.match(source, /syncDebtLiquidationsFromEscenario\(promoted\)/);
  assert.match(source, /if \(liquidationsChanged\) saveDebtLiquidations\(\);/);
});

test("Laboratorio · eliminar un plan vigente/aplicado retracta su reflejo en debtLiquidations", () => {
  const source = extractFunction("handleEscenarioGuardadosDelete");
  assert.match(source, /entry\.estado === "aplicado" \|\| entry\.estado === "vigente"/);
  assert.match(source, /retractDebtLiquidationsFromEscenario\(id\)/);
  assert.match(source, /saveDebtLiquidations\(\);/);
});

test("Laboratorio · descartar un propuesto (nunca llegó a vigente) no toca debtLiquidations", () => {
  const source = extractFunction("handleCierrePropuestoDiscard");
  assert.doesNotMatch(source, /debtLiquidations/);
});
