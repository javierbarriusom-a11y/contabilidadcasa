const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ola 2 · P6-lite: el libro canónico se persistía completo en localStorage (1,96 M de caracteres con 3.000
// movimientos; con ~6.300 el total llega al techo de ~5,2 M y con más cae en silencio a memoria). El 98 % son
// datos derivados que refreshCanonicalLedger() regenera en cada arranque; lo único que no se puede
// reconstruir es la huella y el historial (auditTrail). Se persiste solo eso. El snapshot en memoria y el
// payload remoto/copia (canonical-supabase-store lee `entries`) siguen completos.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const Ledger = require("../canonical-ledger.js");

function compactFn() {
  const start = app.indexOf("function compactCanonicalLedgerForStorage");
  const end = app.indexOf("function compactCanonicalDailyRuns", start);
  assert.ok(start >= 0 && end > start, "no se encontró compactCanonicalLedgerForStorage");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(start, end)}\nthis.fn = compactCanonicalLedgerForStorage;`, sandbox);
  return sandbox.fn;
}

function transactions(count) {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
    month: `2026-0${(i % 9) + 1}`,
    movement: `COMPRA COMERCIO ${i % 13} REF ${i}`,
    amount: i % 7 === 0 ? 1800 : -(10 + i),
    balance: 1000 + i,
    mapping: i % 3 === 0 ? { status: "classified", rowKey: `expense|e${i % 5}`, rowId: `e${i % 5}`, label: `Partida ${i % 5}`, sectionName: "GASTOS", source: "exact" } : { status: "unclassified" },
  }));
}

const actuals = [{ key: "expense|e1|2026-01", kind: "expense", rowId: "e1", monthKey: "2026-01", amount: 120, id: "a1", label: "Partida 1", rowKey: "expense|e1", source: "detalle" }];

test("compacta lo derivado, conserva huella, historial y resumen, no muta el snapshot en memoria y admite null", () => {
  const compact = compactFn();
  const full = Ledger.buildLedgerSnapshot({ transactions: transactions(300), actuals }, null, { reason: "initial-migration" });
  const before = JSON.stringify(full);
  const stored = compact(full);
  assert.deepEqual(JSON.parse(JSON.stringify([stored.entries, stored.actuals, stored.balanceChecks])), [[], [], []]);
  for (const key of ["schemaId", "generatedAt", "reason", "fingerprint", "quality", "reconciliation", "auditTrail"]) {
    assert.deepEqual(JSON.parse(JSON.stringify(stored[key])), JSON.parse(JSON.stringify(full[key])), `debe conservar ${key}`);
  }
  assert.equal(JSON.stringify(full), before, "el snapshot en memoria no se toca (el payload remoto lo necesita completo)");
  assert.equal(full.entries.length, 300);
  assert.equal(compact(null), null);
  assert.ok(JSON.stringify(stored).length < JSON.stringify(full).length * 0.1, "lo persistido pesa menos del 10 % del libro completo");
});

test("reconstruir desde el snapshot compactado da la misma huella y el mismo historial que desde el completo", () => {
  const compact = compactFn();
  const input = { transactions: transactions(300), actuals };
  const first = Ledger.buildLedgerSnapshot(input, null, { reason: "initial-migration" });
  const persisted = JSON.parse(JSON.stringify(compact(first)));

  // Arranque sin cambios de datos: sin entrada de historial nueva, con los movimientos regenerados.
  const restarted = Ledger.buildLedgerSnapshot(input, persisted, { reason: "startup-validation" });
  const restartedFromFull = Ledger.buildLedgerSnapshot(input, JSON.parse(JSON.stringify(first)), { reason: "startup-validation" });
  assert.equal(restarted.fingerprint, first.fingerprint);
  assert.equal(restarted.entries.length, 300);
  assert.equal(restarted.auditTrail.length, first.auditTrail.length, "no se añade una entrada de historial espuria");
  assert.deepEqual(restarted.auditTrail, restartedFromFull.auditTrail, "mismo historial que partiendo del snapshot completo");
  assert.deepEqual(restarted.quality, restartedFromFull.quality);

  // Un cambio real de datos sí queda registrado, encadenado a la huella anterior.
  const changed = Ledger.buildLedgerSnapshot({ transactions: transactions(301), actuals }, restarted, { reason: "state-change" });
  const changedFromFull = Ledger.buildLedgerSnapshot({ transactions: transactions(301), actuals }, restartedFromFull, { reason: "state-change" });
  assert.notEqual(changed.fingerprint, first.fingerprint);
  assert.equal(changed.auditTrail.length, first.auditTrail.length + 1);
  const shape = (snapshot) => snapshot.auditTrail.map((item) => [item.reason, item.fingerprint, item.previousFingerprint]);
  assert.deepEqual(shape(changed), shape(changedFromFull));
  assert.equal(changed.auditTrail.at(-1).previousFingerprint, first.fingerprint);
});

test("los dos puntos que escriben el libro en localStorage usan la versión compacta; el payload de copia/remoto sigue completo", () => {
  const writes = app.match(/storageSet\(storageKey\(CANONICAL_LEDGER_KEY\), [^\n]*\);/g) || [];
  assert.equal(writes.length, 2, "deben existir exactamente dos escrituras del libro");
  for (const write of writes) assert.match(write, /JSON\.stringify\(compactCanonicalLedgerForStorage\(canonicalLedgerSnapshot\)\)/);
  assert.match(app, /payload\.canonicalLedgerSnapshot = canonicalLedgerSnapshot;/, "appStatePayload conserva el libro completo");
});
