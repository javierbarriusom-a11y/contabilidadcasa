const assert = require("node:assert/strict");
const test = require("node:test");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const appSource = codigoApp();

test("la conciliación remota pagina el libro completo antes de comparar", () => {
  assert.match(appSource, /const ledgerPageSize = 1000/);
  assert.match(appSource, /\.order\("entity_id", \{ ascending: true \}\)/);
  assert.match(appSource, /\.range\(from, from \+ ledgerPageSize - 1\)/);
  assert.match(appSource, /remoteLedgerRows\.push\(\.\.\.pageRows\)/);
  assert.match(appSource, /if \(pageRows\.length < ledgerPageSize\) break/);
  assert.match(
    appSource,
    /store\.reconcileLedgerRows\([\s\S]*bundle\.projections\.finance_ledger_entries,[\s\S]*remoteLedgerRows/,
  );
});
