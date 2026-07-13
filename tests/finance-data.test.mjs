import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { financeDataSummary, findNonFinite, loadPackagedFinanceData } from "../tools/finance-data.mjs";

const data = loadPackagedFinanceData();
const baseline = JSON.parse(fs.readFileSync(new URL("./fixtures/finance-data-baseline.json", import.meta.url), "utf8"));

test("los datos empaquetados coinciden con la línea base aprobada", () => {
  assert.deepEqual(financeDataSummary(data), baseline);
});

test("los saldos de origen cuadran y no contienen valores no finitos", () => {
  assert.equal(findNonFinite(data).length, 0);
  assert.ok(
    Math.abs(data.sourceBalances.caixaBalance + data.sourceBalances.mediolanumBalance - data.sourceBalances.totalBalance) < 0.01,
  );
});

test("el calendario financiero está ordenado, no se duplica y alinea todas las series", () => {
  const months = data.monthlyPlanning.months;
  const keys = months.map((month) => month.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), keys);
  data.monthlyPlanning.sections.forEach((section) => {
    section.rows.forEach((row) => {
      assert.equal(row.planned.length, months.length, `${section.name} / ${row.label}`);
      row.planned.forEach((value) => assert.ok(Number.isFinite(Number(value || 0))));
    });
  });
});

test("cada movimiento bancario tiene importes finitos y un mes válido", () => {
  data.transactions.forEach((transaction, index) => {
    assert.ok(/^\d{4}-\d{2}$/.test(transaction.month), `mes inválido en movimiento ${index}`);
    assert.ok(Number.isFinite(transaction.amount), `importe inválido en movimiento ${index}`);
    assert.ok(Number.isFinite(transaction.balance), `saldo inválido en movimiento ${index}`);
  });
});
