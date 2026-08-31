const test = require("node:test");
const assert = require("node:assert/strict");

const DebtContracts = require("../canonical-debt-contracts.js");

test("DI3: una tarjeta se detecta como revolving por su tipo declarado", () => {
  const contract = DebtContracts.normalizeContract({ entity: "Banco X", type: "Tarjeta de crédito", currentPrincipal: 1000, apr: 20 }, 0);
  assert.equal(contract.revolving, true);
});

test("DI3: un préstamo personal no se marca revolving aunque tenga TAE alto", () => {
  const contract = DebtContracts.normalizeContract({ entity: "Banco Y", type: "Préstamo personal", currentPrincipal: 1000, apr: 18 }, 0);
  assert.equal(contract.revolving, false);
});

test("DI3: prioritizeRevolving ordena las revolving activas por TAE descendente", () => {
  const contracts = [
    { id: "a", type: "Tarjeta", currentPrincipal: 500, currentPayment: 30, apr: 15 },
    { id: "b", type: "Tarjeta revolving", currentPrincipal: 800, currentPayment: 40, apr: 24 },
    { id: "c", type: "Préstamo personal", currentPrincipal: 2000, currentPayment: 100, apr: 30 },
  ].map((raw, index) => DebtContracts.normalizeContract(raw, index));
  const prioritized = DebtContracts.prioritizeRevolving(contracts);
  assert.deepEqual(prioritized.map((c) => c.id), ["b", "a"]);
});

test("DI3: prioritizeRevolving excluye las revolving liquidadas o reunificadas", () => {
  const settled = DebtContracts.normalizeContract({ id: "d", type: "Tarjeta", currentPrincipal: 0, apr: 20 }, 0);
  const reunified = DebtContracts.normalizeContract({ id: "e", type: "Tarjeta", currentPrincipal: 500, apr: 20, reunified: true }, 1);
  assert.deepEqual(DebtContracts.prioritizeRevolving([settled, reunified]), []);
});

test("DI3: sin ninguna deuda revolving, prioritizeRevolving devuelve un array vacío sin romper", () => {
  const contract = DebtContracts.normalizeContract({ type: "Préstamo personal", currentPrincipal: 1000, currentPayment: 50, apr: 8 }, 0);
  assert.deepEqual(DebtContracts.prioritizeRevolving([contract]), []);
});
