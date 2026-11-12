const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const store = require("../canonical-supabase-store.js");
const e5 = require("../canonical-e5-operations.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// DISK-IO (12/11/2026): aviso de Supabase «running out of Disk IO Budget». En la base del hogar, 381 MB de los 500 del
// plan gratuito: 229 MB de copias (264, ~830 kB cada una, ninguna se borraba) y 113 MB de auditoría. Cada copia llevaba
// ~6 MB sin comprimir: 2,4 MB de lotes de importación anidados y ~2,3 MB de cálculos que la app rehace al cargar.
// Fase 1: copias sin lo recalculable y lotes sin anidar. Fase 2: menos lecturas de copias enteras y menos guardados.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const payload = (reason = "state-change", amount = 10) => ({
  version: 1,
  workbookData: { transactions: [{ date: "2026-10-01", amount }] },
  movementMappings: { a: 1 },
  canonicalSnapshot: { schemaId: "s", entities: { accounts: [] } },
  canonicalLedgerSnapshot: { schemaId: "l", reason, entries: [{ id: "tx-1", amount }] },
  canonicalEngineRuns: { base: { x: 1 } },
  canonicalDailyEngineRuns: { base: { y: 2 } },
  canonicalDecisionRun: { z: 3 },
  decisionWorkflow: { decisions: [] },
});

test("la copia de la nube no lleva lo que se recalcula, sí sus datos y una huella de lo calculado", () => {
  const state = store.cloudState(payload());
  for (const key of store.DERIVED_STATE_KEYS) assert.equal(key in state, false, `${key} fuera de la copia`);
  assert.deepEqual(state.workbookData, payload().workbookData);
  assert.deepEqual(state.decisionWorkflow, payload().decisionWorkflow, "el flujo de decisiones es dato del hogar: se queda");
  assert.match(state.derivedFingerprint, /\S/);
  assert.equal(store.cloudState(payload("movements-view")).derivedFingerprint, state.derivedFingerprint, "el reason del libro no cuenta");
  assert.notEqual(store.cloudState({ ...payload(), canonicalLedgerSnapshot: { schemaId: "l", entries: [{ id: "tx-1", amount: 11 }] } }).derivedFingerprint, state.derivedFingerprint, "un cambio solo en lo calculado cambia la huella");
  assert.equal("derivedFingerprint" in store.cloudState({ version: 1 }), false, "sin nada calculado, sin huella");
  assert.deepEqual(payload().canonicalLedgerSnapshot.reason, "state-change", "no toca el estado de la app");
});

test("el guardado: proyecciones del estado entero, copia ligera y verificable, mucho más pequeña", () => {
  const bundle = store.buildNormalizedBundle(payload(), { userId: "u", sourceKey: "k", now: "2026-11-12T10:00:00.000Z" });
  assert.equal(bundle.projections.finance_ledger_entries.length, 1, "el libro de la nube se sigue proyectando");
  assert.equal(store.verifySnapshot(bundle.snapshotRow).valid, true);
  assert.equal(bundle.changeKey, bundle.fingerprint, "sin libro en la copia, la clave de comparación es la huella");
  assert.ok(JSON.stringify(bundle.snapshotRow.state).length < JSON.stringify(payload()).length);
});

test("los lotes de importación no anidan los anteriores; deshacer sigue devolviendo el antes", () => {
  const first = e5.createImportBatch({ projects: [{ id: "p0" }], importBatches: [] }, {}, { id: "b1", sourceLabel: "CSV" });
  const second = e5.createImportBatch({ projects: [{ id: "p1" }], importBatches: [first] }, {}, { id: "b2", sourceLabel: "CSV" });
  assert.equal("importBatches" in second.beforeState, false, "la foto «antes» ya no lleva los lotes anteriores");
  const next = e5.undoImportBatch({ projects: [{ id: "p2" }], importBatches: [first, second] }, "b2", { reason: "Equivocado" });
  assert.deepEqual(next.projects, [{ id: "p1" }]);
  assert.deepEqual(next.importBatches.map((b) => [b.id, b.status]), [["b1", "applied"], ["b2", "undone"]], "la lista vigente manda, como antes");
  const legacy = { id: "old", beforeState: { projects: [], importBatches: [{ id: "older", beforeState: { huge: "x".repeat(1000) } }] } };
  const [compacted] = e5.compactImportBatches([legacy]);
  assert.equal("importBatches" in compacted.beforeState, false, "los lotes ya guardados se compactan al leerlos");
  assert.deepEqual(compacted.beforeState.projects, []);
  assert.equal("importBatches" in legacy.beforeState, true, "no muta el original");
  assert.deepEqual(e5.compactImportBatches(null), []);
});

test("app.js: cierre y reapertura guardan la copia ligera; el estado compacta los lotes", () => {
  const app = codigoApp();
  assert.match(app, /importBatches: window\.FinanceCanonicalE5\?\.compactImportBatches\?\.\(importBatches\) \|\| importBatches,/);
  assert.match(app, /const cloudPayload = store\.cloudState\(nextPayload\);[^\n]*\n\s+const fingerprint = store\.fingerprintPayload\(cloudPayload\);/);
  assert.match(app, /p_state: cloudPayload,/);
  assert.match(app, /p_fingerprint: fingerprint, p_state: cloudPayload, p_reason: reason\.trim\(\),/);
});

test("fase 2: al cargar, las 20 copias enteras solo si la vigente no vale; la línea de tiempo sin contenido", () => {
  const app = codigoApp();
  const load = app.slice(app.indexOf("async function loadRemoteStateOnce"), app.indexOf("function loadRemoteState()"));
  assert.doesNotMatch(load.slice(0, load.indexOf("const activeSnapshotId")), /limit\(20\)/, "ya no va en el Promise.all de arranque");
  assert.match(load, /const snapshotsResult = normalizedStore && !activeOk\n\s+\? await supabaseClient\.from\("finance_state_snapshots"\)\.select\("id, state, created_at, fingerprint"\)/);
  assert.match(load, /const activeOk = Boolean\(activeSnapshotResult\.data && normalizedStore\.verifySnapshot\(activeSnapshotResult\.data\)\.valid/);
  assert.match(read("datos-ui.js"), /from\("finance_state_snapshots"\)\.select\("id,created_at,fingerprint"\)\.eq/);
});

test("fase 2: una ráfaga de cambios, un guardado; al ocultar o cerrar la página se guarda ya", () => {
  const app = codigoApp();
  assert.match(app, /remoteSaveTimer = window\.setTimeout\(flushQueuedRemoteSave, 4000\);/);
  assert.match(app, /function flushQueuedRemoteSave\(\) \{\n\s+if \(!remoteSaveTimer\) return;\n\s+window\.clearTimeout\(remoteSaveTimer\);\n\s+remoteSaveTimer = null;\n\s+ensureRemoteSaveQueue\(\)\.flush\(\);/);
  assert.match(app, /document\.addEventListener\("visibilitychange", \(\) => \{ if \(document\.visibilityState === "hidden"\) flushQueuedRemoteSave\(\); \}\);/);
  assert.match(app, /window\.addEventListener\("pagehide", flushQueuedRemoteSave\);/);
});

test("fase 3: la retención aprobada protege lo que no se puede perder y se ejecuta en pasos", () => {
  const sql = read("migrations/20261112_disk_io_retencion_copias.sql");
  const keeps = sql.match(/keep as \(([\s\S]*?)\n\s*\)/g) || [];
  assert.equal(keeps.length, 3, "la misma regla en la lectura previa, el borrado y la función semanal");
  for (const keep of keeps) {
    assert.match(keep, /where rn <= 30/, "las 30 más recientes");
    assert.match(keep, /rn_dia = 1 and created_at >= now\(\) - interval '90 days'/, "una por día de los últimos 90");
    for (const table of ["finance_source_heads", "finance_month_closures", "finance_month_reopenings", "finance_backup_checks"]) assert.ok(keep.includes(`public.${table}`), table);
    assert.match(keep, /where r\.metadata \? 'operation'/, "restaurar, deshacer… se conservan");
  }
  assert.match(sql, /PASO 1 · solo lectura/);
  assert.match(sql, /^begin;\n[\s\S]*?\ncommit;$/m, "el borrado va en una transacción");
  assert.match(sql, /revoke execute on function public\.finance_prune_state_snapshots\(\) from public, anon, authenticated;/);
  const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /finance_audit_log|finance_ledger_entries/, "no toca la auditoría ni el libro");
  assert.equal((code.match(/delete from/g) || []).length, 2, "solo borra copias: el paso 2 y la función semanal");
  assert.match(code, /delete from public\.finance_state_snapshots s\nwhere not exists/);
  assert.match(read("index.html"), /canonical-supabase-store\.js\?v=20261112diskio/);
  assert.match(read("index.html"), /canonical-e5-operations\.js\?v=20261112diskio/);
});
