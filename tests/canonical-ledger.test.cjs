const test = require("node:test");
const assert = require("node:assert/strict");
const ledger = require("../canonical-ledger.js");

const mapped = (rowKey, label = "Nómina") => ({ status: "classified", rowKey, rowId: rowKey.split("|")[1], label, source: "dictionary" });

test("genera identidades estables y detecta duplicados", () => {
  const transaction = { date: "2026-06-01", movement: "NOMINA", amount: 1000, balance: 3000, source: "cuenta", mapping: mapped("income|salary") };
  const first = ledger.buildLedgerSnapshot({ transactions: [transaction, transaction] });
  const second = ledger.buildLedgerSnapshot({ transactions: [transaction, transaction] });
  assert.equal(first.entries[0].id, second.entries[0].id);
  assert.equal(first.quality.duplicateCount, 1);
  assert.equal(first.entries[1].duplicateOf, first.entries[0].id);
});

test("reconcilia importes bancarios y reales por mes", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [
      { date: "2026-06-01", movement: "NOMINA", amount: 1000, balance: 3000, mapping: mapped("income|salary") },
      { date: "2026-06-02", movement: "LUZ", amount: -100, balance: 2900, mapping: mapped("expense|light", "Luz") },
    ],
    actuals: [
      { kind: "income", rowKey: "income|salary", monthKey: "2026-06", amount: 1000 },
      { kind: "expense", rowKey: "expense|light", monthKey: "2026-06", amount: 100 },
    ],
  });
  assert.equal(snapshot.reconciliation.months[0].status, "matched");
  assert.equal(snapshot.reconciliation.months[0].expenseDelta, 0);
  assert.equal(snapshot.quality.coverage, 100);
});

test("detecta diferencias y movimientos sin clasificar", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [{ date: "2026-06-02", movement: "DESCONOCIDO", amount: -120, balance: 2880 }],
    actuals: [{ kind: "expense", rowKey: "expense|light", monthKey: "2026-06", amount: 100 }],
  });
  assert.equal(snapshot.quality.unclassifiedCount, 1);
  assert.equal(snapshot.reconciliation.months[0].expenseDelta, 20);
  assert.equal(snapshot.reconciliation.months[0].status, "pending-classification");
});

test("reconoce continuidad de saldo en extractos antiguos y recientes primero", () => {
  const chronological = [
    { date: "2026-06-01", movement: "A", amount: 100, balance: 1100, sourceRow: 1 },
    { date: "2026-06-02", movement: "B", amount: -50, balance: 1050, sourceRow: 2 },
  ];
  const reversed = [
    { ...chronological[1], sourceRow: 1 },
    { ...chronological[0], sourceRow: 2 },
  ];
  assert.equal(ledger.buildLedgerSnapshot({ transactions: chronological }).balanceChecks[0].gaps.length, 0);
  const reverseCheck = ledger.buildLedgerSnapshot({ transactions: reversed }).balanceChecks[0];
  assert.equal(reverseCheck.orientation, "newest-first");
  assert.equal(reverseCheck.gaps.length, 0);
});

test("solo registra auditoría cuando cambia el contenido contable", () => {
  const transaction = { date: "2026-06-01", movement: "NOMINA", amount: 1000, balance: 3000, mapping: mapped("income|salary") };
  const first = ledger.buildLedgerSnapshot({ transactions: [transaction] }, null, { reason: "import" });
  const unchanged = ledger.buildLedgerSnapshot({ transactions: [transaction] }, first, { reason: "refresh" });
  const changed = ledger.buildLedgerSnapshot({ transactions: [{ ...transaction, amount: 1100, balance: 3100 }] }, unchanged, { reason: "edit" });
  assert.equal(first.auditTrail.length, 1);
  assert.equal(unchanged.auditTrail.length, 1);
  assert.equal(changed.auditTrail.length, 2);
  assert.equal(changed.auditTrail[1].reason, "edit");
});

test("comprueba la continuidad de cada cuenta de forma independiente", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [
      { accountId: "caixabank", date: "2026-06-01", movement: "A", amount: 100, balance: 1100, sourceRow: 1 },
      { accountId: "caixabank", date: "2026-06-02", movement: "B", amount: -50, balance: 1050, sourceRow: 2 },
      { accountId: "mediolanum", date: "2026-06-01", movement: "C", amount: 200, balance: 700, sourceRow: 1 },
      { accountId: "mediolanum", date: "2026-06-02", movement: "D", amount: 25, balance: 725, sourceRow: 2 },
    ],
  });
  assert.deepEqual(snapshot.balanceChecks.map((check) => check.accountId).sort(), ["caixabank", "mediolanum"]);
  assert.equal(snapshot.balanceChecks.every((check) => check.gaps.length === 0), true);
});
