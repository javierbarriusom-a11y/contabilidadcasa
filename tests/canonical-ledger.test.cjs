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

test("C-3b · conserva movement y details sueltos, no solo la description concatenada", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [{ date: "2026-06-02", movement: "Amazon", details: "Cargo tarjeta · pedido 4021", amount: -62.3, balance: 2900 }],
  });
  const entry = snapshot.entries[0];
  assert.equal(entry.movement, "Amazon");
  assert.equal(entry.details, "Cargo tarjeta · pedido 4021");
  assert.equal(entry.description, "Amazon · Cargo tarjeta · pedido 4021");
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

// Ensayo del cierre del 29/10/2026: la fila (`sourceRow`) es la de cada fichero. Con un extracto por mes, o el mes entero
// importado otra vez, ordenar solo por ella mezclaba meses y daba huecos falsos que bloqueaban el cierre.
test("la continuidad va por fecha: varios ficheros con las mismas filas no dan huecos falsos", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [
      { date: "2026-03-01", movement: "A", amount: 100, balance: 1100, sourceRow: 0 },
      { date: "2026-03-05", movement: "B", amount: -50, balance: 1050, sourceRow: 1 },
      { date: "2026-10-01", movement: "C", amount: 200, balance: 1250, sourceRow: 0 },
      { date: "2026-10-03", movement: "D", amount: -25, balance: 1225, sourceRow: 1 },
    ],
  });
  assert.equal(snapshot.balanceChecks[0].gaps.length, 0);
  assert.equal(snapshot.balanceChecks[0].checkedPairs, 3);
});

test("dentro de un día vale cualquier orden que encadene los saldos (el CSV no trae el orden del día)", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [
      { date: "2026-10-01", movement: "NOMINA", amount: 1000, balance: 2000, sourceRow: 0 },
      // Mismo día y misma fila: el orden alfabético (LUZ antes que SUPER) no es el del banco (SUPER y luego LUZ).
      { date: "2026-10-02", movement: "LUZ", amount: -80, balance: 1860, sourceRow: 0 },
      { date: "2026-10-02", movement: "SUPER", amount: -60, balance: 1940, sourceRow: 0 },
    ],
  });
  assert.equal(snapshot.balanceChecks[0].gaps.length, 0);
});

test("un salto de saldo de verdad (falta un movimiento) se sigue viendo, en el mes donde aparece", () => {
  const snapshot = ledger.buildLedgerSnapshot({
    transactions: [
      { date: "2026-09-29", movement: "A", amount: 100, balance: 1100, sourceRow: 0 },
      { date: "2026-10-02", movement: "B", amount: -50, balance: 1000, sourceRow: 0 },
    ],
  });
  const [gap] = snapshot.balanceChecks[0].gaps;
  assert.equal(snapshot.balanceChecks[0].gaps.length, 1);
  assert.equal(gap.expected, 1050);
  assert.equal(gap.actual, 1000);
  assert.equal(snapshot.entries.find((entry) => entry.id === gap.currentId).monthKey, "2026-10");
});
