const test = require("node:test");
const assert = require("node:assert/strict");

const Split = require("../canonical-household-split.js");

// A18-3 (BACKLOG_PATRIMONIO_Y_FINANZAS.md, depende de A18-2): "cada liquidación periódica sugerida
// requiere confirmación de ambas partes antes de registrarse como transferencia interna, mismo
// patrón que el ciclo de aprobación de E5". proposeSettlement() lee el saldo continuo de A18-2 sobre
// los gastos que ninguna liquidación anterior ya cubrió; confirmSettlement() nunca registra nada con
// una sola confirmación.

function settingsWith(overrides = {}) {
  return { incomes: { javi: 0, tere: 0 }, defaultRule: { mode: "equal", payer: "javi", amount: null }, categoryRules: {}, ...overrides };
}

test("sin gastos compartidos, no hay saldo pendiente que proponer", () => {
  const proposal = Split.proposeSettlement([], settingsWith());
  assert.equal(proposal.hasPendingBalance, false);
  assert.deepEqual(proposal.entryIds, []);
});

test("con saldo pendiente, la propuesta trae importe, dirección y los gastos exactos que cubre", () => {
  const entries = [{ id: "1", category: "Ocio", amount: 100, paidBy: "javi" }];
  const proposal = Split.proposeSettlement(entries, settingsWith());
  assert.equal(proposal.hasPendingBalance, true);
  assert.equal(proposal.amount, 50);
  assert.equal(proposal.from, "tere");
  assert.equal(proposal.to, "javi");
  assert.deepEqual(proposal.entryIds, ["1"]);
});

test("pendingSplitEntries excluye los gastos que una liquidación anterior ya cubrió", () => {
  const entries = [
    { id: "1", category: "Ocio", amount: 100, paidBy: "javi" },
    { id: "2", category: "Ocio", amount: 40, paidBy: "javi" },
  ];
  const pending = Split.pendingSplitEntries(entries, ["1"]);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, "2");
});

test("un gasto ya liquidado no vuelve a aparecer en la propuesta: el saldo pendiente solo mira lo nuevo", () => {
  const entries = [
    { id: "1", category: "Ocio", amount: 100, paidBy: "javi" },
    { id: "2", category: "Ocio", amount: 40, paidBy: "tere" },
  ];
  const proposal = Split.proposeSettlement(entries, settingsWith(), ["1"]);
  assert.equal(proposal.hasPendingBalance, true);
  assert.deepEqual(proposal.entryIds, ["2"]);
  assert.equal(proposal.from, "javi");
  assert.equal(proposal.amount, 20);
});

test("con todos los gastos ya liquidados, no queda saldo pendiente", () => {
  const entries = [{ id: "1", category: "Ocio", amount: 100, paidBy: "javi" }];
  const proposal = Split.proposeSettlement(entries, settingsWith(), ["1"]);
  assert.equal(proposal.hasPendingBalance, false);
});

test("confirmSettlement sin propuesta pendiente nunca registra nada", () => {
  const result = Split.confirmSettlement({ hasPendingBalance: false }, { javi: true, tere: true });
  assert.equal(result.status, "no-pending-balance");
});

test("con una sola confirmación, queda en pending y dice explícitamente quién falta", () => {
  const proposal = Split.proposeSettlement([{ id: "1", category: "Ocio", amount: 100, paidBy: "javi" }], settingsWith());
  const result = Split.confirmSettlement(proposal, { javi: true, tere: false });
  assert.equal(result.status, "pending");
  assert.deepEqual(result.missing, ["tere"]);
});

test("sin ninguna confirmación, faltan ambas partes", () => {
  const proposal = Split.proposeSettlement([{ id: "1", category: "Ocio", amount: 100, paidBy: "javi" }], settingsWith());
  const result = Split.confirmSettlement(proposal, {});
  assert.equal(result.status, "pending");
  assert.deepEqual(result.missing, ["javi", "tere"]);
});

test("con ambas confirmaciones, la liquidación queda confirmada y registrada con los mismos gastos de la propuesta", () => {
  const entries = [{ id: "1", category: "Ocio", amount: 100, paidBy: "javi" }];
  const proposal = Split.proposeSettlement(entries, settingsWith());
  const result = Split.confirmSettlement(proposal, { javi: true, tere: true });
  assert.equal(result.status, "confirmed");
  assert.equal(result.amount, 50);
  assert.equal(result.from, "tere");
  assert.equal(result.to, "javi");
  assert.deepEqual(result.entryIds, ["1"]);
  assert.ok(result.id);
  assert.ok(result.confirmedAt);
  assert.ok(result.javiConfirmedAt);
  assert.ok(result.tereConfirmedAt);
});

test("proposeSettlement, confirmSettlement y pendingSplitEntries están expuestas en el motor canónico", () => {
  assert.equal(typeof Split.proposeSettlement, "function");
  assert.equal(typeof Split.confirmSettlement, "function");
  assert.equal(typeof Split.pendingSplitEntries, "function");
});
