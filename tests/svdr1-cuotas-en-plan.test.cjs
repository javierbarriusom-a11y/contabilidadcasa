// SVD-R1 (17/11/2026, «ponerlos realistas»): ¿la previsión paga las cuotas de los contratos? Se cruzan con las partidas de
// financiación del plan (lo que la previsión cuenta como deuda) por el nombre de la entidad y el importe. Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { matchPlanInstallments } = require("../canonical-debt-contracts.js");
const Adapter = require("../canonical-e14-debt-adapter.js");

function contract(overrides = {}) {
  return { id: "c1", entity: "Banco FICTICIO", type: "Tarjeta", number: "", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, ...overrides };
}

function byId(result, id) {
  return result.items.find((item) => item.id === id);
}

test("SVD-R1 · por el nombre de la entidad y el importe: en el plan, con otro importe, o fuera", () => {
  const result = matchPlanInstallments(
    [contract(), contract({ id: "c2", entity: "Caja FICTICIA", type: "Préstamo", currentPrincipal: 5100, currentPayment: 160 }), contract({ id: "c3", entity: "Otra Financiera", currentPayment: 45 })],
    [{ label: "Tarjeta Ficticio", amount: 91 }, { label: "Préstamo caja ficticia", amount: 175 }],
  );
  assert.equal(byId(result, "c1").status, "en-plan");
  assert.equal(byId(result, "c1").diff, 1);
  assert.equal(byId(result, "c2").status, "importe-distinto");
  assert.equal(byId(result, "c2").diff, 15);
  assert.equal(byId(result, "c3").status, "fuera-del-plan");
  assert.equal(result.totals.missingPayment, 45);
  assert.equal(result.totals.contractsPayment, 295);
  assert.equal(result.totals.planFinancing, 266);
  assert.equal(result.coverage, "algunas");
  assert.deepEqual(result.orphanRows, []);
});

test("SVD-R1 · las palabras genéricas («Banco», «Préstamo»…) no bastan para enlazar, y los acentos no estorban", () => {
  const result = matchPlanInstallments([contract({ entity: "Banco Ñandú" })], [{ label: "Préstamo banco", amount: 300 }, { label: "Tarjeta ÑANDU", amount: 90 }]);
  assert.equal(byId(result, "c1").status, "en-plan");
  assert.equal(byId(result, "c1").row.label, "Tarjeta ÑANDU");
  assert.deepEqual(result.orphanRows, [{ label: "Préstamo banco", amount: 300 }]);
});

test("SVD-R1 · los 4 últimos dígitos del número de contrato también enlazan", () => {
  const result = matchPlanInstallments([contract({ entity: "Banco", number: "ES-0000-1234" })], [{ label: "Recibo 1234", amount: 90 }]);
  assert.equal(byId(result, "c1").status, "en-plan");
});

test("SVD-R1 · solo por importe, si hay una única partida libre con ese importe, y lo dice como duda", () => {
  const unica = matchPlanInstallments([contract()], [{ label: "Financiación sin nombre", amount: 90 }]);
  assert.equal(byId(unica, "c1").status, "por-importe");
  assert.equal(unica.coverage, "ninguna");
  const dos = matchPlanInstallments([contract()], [{ label: "Una", amount: 90 }, { label: "Otra", amount: 90 }]);
  assert.equal(byId(dos, "c1").status, "fuera-del-plan");
  assert.equal(dos.orphanRows.length, 2);
});

test("SVD-R1 · cada partida sirve a un solo contrato: el que coincide en nombre e importe gana", () => {
  const result = matchPlanInstallments(
    [contract({ id: "a", entity: "Banco FICTICIO", currentPayment: 50 }), contract({ id: "b", entity: "Banco FICTICIO", type: "Préstamo", currentPayment: 120 })],
    [{ label: "Ficticio préstamo", amount: 120 }],
  );
  assert.equal(byId(result, "b").status, "en-plan");
  assert.equal(byId(result, "a").status, "fuera-del-plan");
});

test("SVD-R1 · un contrato suspendido con una partida a su nombre: el plan paga lo que hoy no se paga", () => {
  const result = matchPlanInstallments([contract({ paymentStatus: "suspended", currentPayment: 0 })], [{ label: "Tarjeta ficticio", amount: 90 }]);
  assert.equal(byId(result, "c1").status, "suspendido-en-plan");
  assert.equal(byId(result, "c1").diff, null);
  assert.equal(result.totals.suspendedInPlan, 90);
  assert.equal(result.coverage, "sin-cuotas");
});

test("SVD-R1 · liquidados, reunificados y sin capital no cuentan; todas en el plan da cobertura «todas»", () => {
  const result = matchPlanInstallments(
    [contract(), contract({ id: "x", paymentStatus: "settled", currentPrincipal: 0 }), contract({ id: "y", paymentStatus: "reunified" })],
    [{ label: "ficticio", amount: 90 }],
  );
  assert.deepEqual(result.items.map((item) => item.id), ["c1"]);
  assert.equal(result.coverage, "todas");
});

test("SVD-R1 · la decisión de un acuerdo resta la partida del plan que lleva la cuota, no la casilla", () => {
  const agreement = { status: "accepted", type: "settlement", settlementAmount: 1000, startMonth: "2027-01", principalAtAcceptance: 2400 };
  assert.equal(Adapter.agreementPlanDecision({ agreement, contract: contract(), monthIndex: 1, cuotasEnPlan: false, relief: 91 }).monthlyRelief, 91);
  assert.equal(Adapter.agreementPlanDecision({ agreement, contract: contract(), monthIndex: 1, cuotasEnPlan: true, relief: 0 }).monthlyRelief, 0);
  // Sin dato del plan, como en SVD-3: la casilla.
  assert.equal(Adapter.agreementPlanDecision({ agreement, contract: contract(), monthIndex: 1, cuotasEnPlan: true }).monthlyRelief, 90);
});

test("SVD-R1 · el modelo de lectura del simulador resume la cobertura del plan", () => {
  const plan = { monthKey: "2026-12", monthLabel: "Dic 26", ...matchPlanInstallments([contract(), contract({ id: "c2", entity: "Otra", currentPayment: 40 })], [{ label: "ficticio", amount: 90 }]) };
  const model = Adapter.buildReadModel({ contracts: [], planInstallments: plan });
  assert.deepEqual(model.cuotasPlan, { monthKey: "2026-12", monthLabel: "Dic 26", coverage: "algunas", enPlan: 1, conCuota: 2, fuera: 40 });
  assert.equal(Adapter.buildReadModel({ contracts: [] }).cuotasPlan, null);
});

test("SVD-R1 · el puente lee las mismas partidas que la previsión cuenta como deuda (field «refi»)", () => {
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  assert.match(puente, /function svdCuotasPlanModelo\(\)/);
  assert.match(puente, /expenseEvents \|\| \[\]\)\.filter\(\(event\) => event\.field === "refi"\)/);
  assert.match(puente, /planningBreakdownMemoized\(month\.index/);
});
