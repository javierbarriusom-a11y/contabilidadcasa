const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

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
