const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ola 2 · omitir guardados remotos idénticos. Con sesión, cada guardado subía la copia completa del estado
// (~2,8 MB con 3.000 movimientos), ~3.700 filas y una conciliación, aunque nada hubiera cambiado: en una base
// real había 878 copias con solo 548 huellas distintas (38 % duplicadas) y la base pasó del límite gratuito.
// Regla (canSkipUnchangedSave): se omite SOLO si el estado tiene la misma huella que la cabecera que esta sesión
// dejó completa tras un guardado normal Y la cabecera remota sigue siendo esa. En cualquier otro caso, como hoy.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const Store = require("../canonical-supabase-store.js");

test("canSkipUnchangedSave: solo con cabecera conocida, misma copia y misma huella", () => {
  const settled = { snapshotId: "s1", fingerprint: "f1" };
  const head = { known: true, snapshotId: "s1" };
  assert.equal(Store.canSkipUnchangedSave(settled, head, "f1"), true);
  assert.equal(Store.canSkipUnchangedSave(settled, head, "f2"), false, "huella distinta");
  assert.equal(Store.canSkipUnchangedSave(settled, { known: true, snapshotId: "s2" }, "f1"), false, "la cabecera avanzó (otra sesión o cierre de mes)");
  assert.equal(Store.canSkipUnchangedSave(settled, { known: false, snapshotId: "s1" }, "f1"), false, "cabecera remota desconocida");
  assert.equal(Store.canSkipUnchangedSave(null, head, "f1"), false, "sin cabecera asentada");
  assert.equal(Store.canSkipUnchangedSave({ snapshotId: "", fingerprint: "" }, { known: true, snapshotId: "" }, ""), false, "huella vacía nunca coincide");
  assert.equal(Store.canSkipUnchangedSave(undefined, undefined, undefined), false);
});

function clientReturning(runRow, { error = null, throws = false } = {}) {
  return {
    from(table) {
      assert.equal(table, "finance_sync_runs");
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (throws) throw new Error("red caída");
          return { data: runRow, error };
        },
      };
      return builder;
    },
  };
}

test("loadSettledHead: solo una ejecución completa de un guardado normal asienta la cabecera; nunca lanza", async () => {
  const head = { snapshot_id: "s1", sync_id: "r1", fingerprint: "f1" };
  const settled = { snapshotId: "s1", fingerprint: "f1", changeKey: "" }; // sin la copia a la que apunta, no hay clave de comparación
  assert.deepEqual(await Store.loadSettledHead(clientReturning({ status: "complete", metadata: { payloadVersion: 1 } }), head), settled);
  assert.equal(await Store.loadSettledHead(clientReturning({ status: "complete", metadata: { operation: "month-close" } }), head), null, "cierre de mes: no actualiza las filas derivadas");
  assert.equal(await Store.loadSettledHead(clientReturning({ status: "complete", metadata: { operation: "import-undo" } }), head), null);
  assert.equal(await Store.loadSettledHead(clientReturning({ status: "failed", metadata: {} }), head), null, "guardado fallido");
  assert.equal(await Store.loadSettledHead(clientReturning({ status: "running", metadata: {} }), head), null, "guardado a medias");
  assert.equal(await Store.loadSettledHead(clientReturning(null), head), null, "ejecución inexistente");
  assert.equal(await Store.loadSettledHead(clientReturning(null, { error: { message: "x" } }), head), null);
  assert.equal(await Store.loadSettledHead(clientReturning(null, { throws: true }), head), null, "una excepción no rompe la carga");
  for (const incomplete of [null, {}, { snapshot_id: "s1" }, { snapshot_id: "s1", sync_id: "r1" }]) {
    assert.equal(await Store.loadSettledHead(clientReturning({ status: "complete", metadata: {} }), incomplete), null);
  }
});

// --- Recorrido completo con la función REAL de app.js contra un cliente falso ---------------------------

function fakeClient(calls, { failTable = null } = {}) {
  const upserts = {}; // tabla -> Map(entity_id -> fila): un upsert real reemplaza por identificador
  return {
    from(table) {
      const state = { op: null };
      const settle = () => {
        calls.push(`${table}.${state.op}`);
        if (state.op === "select" && table === "finance_ledger_entries") {
          return { data: [...(upserts[table] || new Map()).values()].map((row) => ({ entity_id: row.entity_id, amount: row.amount, active: true })), error: null };
        }
        if (state.op === "upsert" && table === failTable) return { data: null, error: { message: "fallo simulado" } };
        return { data: null, error: null };
      };
      const builder = {
        insert() { state.op = "insert"; return builder; },
        upsert(rows) {
          state.op = "upsert";
          upserts[table] = upserts[table] || new Map();
          rows.forEach((row) => upserts[table].set(row.entity_id, row));
          return builder;
        },
        update() { state.op = "update"; return builder; },
        select() { if (!state.op) state.op = "select"; return builder; },
        eq: () => builder, neq: () => builder, order: () => builder, range: () => builder,
        maybeSingle: async () => { calls.push(`${table}.${state.op}`); return { data: { snapshot_id: "cabecera" }, error: null }; },
        then: (resolve, reject) => Promise.resolve(settle()).then(resolve, reject),
      };
      return builder;
    },
  };
}

function loadSave(calls, options) {
  const start = app.indexOf("async function saveNormalizedRemoteState");
  const end = app.indexOf("\n}\n", start) + 3;
  assert.ok(start >= 0 && end > start, "no se encontró saveNormalizedRemoteState");
  const sandbox = {
    window: { FinanceCanonicalSupabaseStore: Store },
    supabaseClient: fakeClient(calls, options),
    remoteUser: { id: "u1" },
    sourceStateKey: () => "k",
    remoteHeadKnown: true,
    remoteHeadSnapshotId: "cabecera",
    remoteHeadSettled: null,
    Error, Object, Array, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(start, end)}\nthis.save = saveNormalizedRemoteState;`, sandbox);
  return sandbox;
}

const payloadWith = (count) => ({
  canonicalSnapshot: { entities: {} },
  canonicalLedgerSnapshot: {
    entries: Array.from({ length: count }, (_, i) => ({ id: `tx-${i}`, amount: 10 + i, monthKey: "2026-01", date: "2026-01-01", description: `Mov ${i}`, kind: "expense" })),
  },
});

test("guardado real: el primero sube todo, el idéntico no toca la nube, un cambio real sí se guarda", async () => {
  const calls = [];
  const sb = loadSave(calls);
  const first = await sb.save(payloadWith(3));
  assert.equal(first.mode, "normalized");
  assert.ok(!first.unchanged);
  assert.ok(calls.includes("finance_sync_runs.insert") && calls.includes("finance_state_snapshots.insert"), "el primer guardado crea ejecución y copia");
  assert.equal(sb.remoteHeadSettled.snapshotId, sb.remoteHeadSnapshotId, "queda asentado en la copia que acaba de crear");

  calls.length = 0;
  const repeated = await sb.save(payloadWith(3));
  assert.equal(repeated.unchanged, true);
  assert.equal(repeated.mode, "normalized", "sigue contando como guardado correcto para la cola y la interfaz");
  assert.deepEqual(calls, [], "un estado idéntico no hace NINGUNA petición: ni ejecución, ni copia, ni filas, ni conciliación");

  const changed = await sb.save(payloadWith(4));
  assert.ok(!changed.unchanged);
  assert.ok(calls.includes("finance_state_snapshots.insert"), "un cambio real crea copia nueva");
  assert.notEqual(sb.remoteHeadSettled.fingerprint, first.fingerprint);
});

test("si la cabecera remota avanzó (cierre de mes u otra sesión) el mismo estado se guarda igualmente", async () => {
  const calls = [];
  const sb = loadSave(calls);
  await sb.save(payloadWith(3));
  sb.remoteHeadSnapshotId = "creada-por-un-cierre-de-mes";
  calls.length = 0;
  const result = await sb.save(payloadWith(3));
  assert.ok(!result.unchanged);
  assert.ok(calls.includes("finance_state_snapshots.insert"));
});

test("un guardado que falla a medias no asienta nada: el reintento idéntico NO se omite", async () => {
  const calls = [];
  const sb = loadSave(calls, { failTable: "finance_concepts" });
  sb.remoteHeadSettled = { snapshotId: "cabecera", fingerprint: "de-un-estado-anterior" };
  // Estado con conceptos para que el upsert de esa tabla se ejecute y falle.
  const withConcepts = { ...payloadWith(2), canonicalSnapshot: { entities: { planningRows: [{ id: "p1", label: "Alquiler", amount: 500 }] } } };
  await assert.rejects(() => sb.save(withConcepts), (error) => error.message === "fallo simulado");
  assert.equal(sb.remoteHeadSettled.fingerprint, "de-un-estado-anterior", "el fallo no asienta la huella nueva");
  calls.length = 0;
  await assert.rejects(() => sb.save(withConcepts), (error) => error.message === "fallo simulado");
  assert.ok(calls.includes("finance_sync_runs.insert"), "el reintento vuelve a intentar el guardado completo");
});

test("cableado en app.js: omite antes de crear la ejecución, asienta solo al completar y la carga lee sync_id", () => {
  const save = app.slice(app.indexOf("async function saveNormalizedRemoteState"));
  assert.ok(save.indexOf("canSkipUnchangedSave") > save.indexOf("buildNormalizedBundle("));
  assert.ok(save.indexOf("canSkipUnchangedSave") < save.indexOf('from("finance_sync_runs").insert('), "la omisión va antes de crear nada");
  assert.ok(save.indexOf("remoteHeadSettled = {") > save.indexOf('.update({ status: "complete"'), "solo se asienta tras completar la ejecución");
  assert.match(app, /\.select\("snapshot_id, sync_id, fingerprint, schema_version, updated_at"\)/);
  assert.match(app, /remoteHeadSettled = remoteHeadKnown \? await normalizedStore\.loadSettledHead\(supabaseClient, headResult\.data, activeSnapshotResult\.data\) : null;/);
  assert.match(app, /const detail = normalizedResult\.mode === "normalized" && !normalizedResult\.unchanged/);
});

test("sin cabecera remota conocida el guardado se corta ANTES de crear nada (antes dejaba una copia huérfana por intento)", async () => {
  const calls = [];
  const sb = loadSave(calls);
  sb.remoteHeadKnown = false;
  sb.remoteHeadSnapshotId = null;
  await assert.rejects(
    () => sb.save(payloadWith(3)),
    (error) => error.code === "REMOTE_WRITE_CONFLICT" && error.retryable === false && /No se conoce la revisión remota/.test(error.message),
  );
  assert.deepEqual(calls, [], "ni ejecución de sincronización ni copia del estado");
  const save = app.slice(app.indexOf("async function saveNormalizedRemoteState"));
  assert.ok(save.indexOf("if (!remoteHeadKnown) throw") < save.indexOf('from("finance_sync_runs").insert('));
});

// --- Clave de comparación: `canonicalLedgerSnapshot.reason` no debe crear una copia por carga -------------

const ledgerPayload = (reason, amount = 10) => ({
  version: 1,
  canonicalLedgerSnapshot: { reason, generatedAt: "2026-01-01T00:00:00Z", entries: [{ id: "a", amount }] },
  monthClosures: [{ id: "m1", reason: "Cierre de enero" }],
});

test("la huella guardada NO cambia (verifica las copias ya almacenadas) y la clave de comparación ignora solo canonicalLedgerSnapshot.reason", () => {
  const base = { ...ledgerPayload("state-change"), updatedAt: "x" };
  // Valor medido con el código anterior a este cambio: si varía, las ~100 copias existentes dejarían de verificarse.
  assert.equal(Store.fingerprintPayload(base), "c63dcd356680ab090000009d");
  assert.notEqual(Store.fingerprintPayload(ledgerPayload("state-change")), Store.fingerprintPayload(ledgerPayload("movements-view")), "la huella sigue viendo el reason");
  assert.equal(Store.changeKey(ledgerPayload("state-change")), Store.changeKey(ledgerPayload("movements-view")));
  assert.notEqual(Store.changeKey(ledgerPayload("state-change", 10)), Store.changeKey(ledgerPayload("state-change", 11)), "un importe distinto sí cambia la clave");
  const closureReason = ledgerPayload("state-change");
  closureReason.monthClosures[0].reason = "Otro motivo";
  assert.notEqual(Store.changeKey(ledgerPayload("state-change")), Store.changeKey(closureReason), "el motivo de un cierre de mes NO se ignora");
  assert.equal(Store.changeKey({ sinLibro: true }), Store.fingerprintPayload({ sinLibro: true }), "sin libro coincide con la huella");
});

test("canSkipUnchangedSave: también omite por clave de comparación, pero solo con la misma copia y cabecera conocida", () => {
  const settled = { snapshotId: "s1", fingerprint: "f1", changeKey: "k1" };
  const known = { known: true, snapshotId: "s1" };
  assert.equal(Store.canSkipUnchangedSave(settled, known, "otra", "k1"), true);
  assert.equal(Store.canSkipUnchangedSave(settled, known, "otra", "k2"), false);
  assert.equal(Store.canSkipUnchangedSave(settled, known, "otra", ""), false);
  assert.equal(Store.canSkipUnchangedSave({ ...settled, changeKey: "" }, known, "otra", ""), false, "una clave vacía nunca coincide");
  assert.equal(Store.canSkipUnchangedSave(settled, { known: true, snapshotId: "s2" }, "otra", "k1"), false);
  assert.equal(Store.canSkipUnchangedSave(settled, { known: false, snapshotId: "s1" }, "otra", "k1"), false);
  assert.equal(Store.canSkipUnchangedSave(settled, known, "f1", undefined), true, "la vía por huella sigue igual");
});

test("loadSettledHead: calcula la clave de la copia a la que apunta la cabecera solo si es esa copia y su huella", async () => {
  const head = { snapshot_id: "s1", sync_id: "r1", fingerprint: "f1" };
  const client = clientReturning({ status: "complete", metadata: {} });
  const state = ledgerPayload("movements-view");
  const withSnapshot = await Store.loadSettledHead(client, head, { id: "s1", fingerprint: "f1", state });
  assert.equal(withSnapshot.changeKey, Store.changeKey(ledgerPayload("state-change")));
  assert.equal((await Store.loadSettledHead(client, head, { id: "otra", fingerprint: "f1", state })).changeKey, "");
  assert.equal((await Store.loadSettledHead(client, head, { id: "s1", fingerprint: "distinta", state })).changeKey, "");
  assert.equal((await Store.loadSettledHead(client, head)).changeKey, "");
});

test("guardado real: cambiar SOLO el reason del libro (otra pantalla) no toca la nube; un cambio real de importe sí", async () => {
  const calls = [];
  const sb = loadSave(calls);
  const withReason = (reason, count) => {
    const payload = payloadWith(count);
    payload.canonicalLedgerSnapshot.reason = reason;
    return payload;
  };
  await sb.save(withReason("state-change", 3));
  assert.ok(sb.remoteHeadSettled.changeKey, "queda asentada la clave de comparación");
  calls.length = 0;
  const other = await sb.save(withReason("movements-view", 3));
  assert.equal(other.unchanged, true);
  assert.deepEqual(calls, [], "otro reason no hace NINGUNA petición");
  const changed = await sb.save(withReason("movements-view", 4));
  assert.ok(!changed.unchanged);
  assert.ok(calls.includes("finance_state_snapshots.insert"), "un movimiento nuevo sí crea copia");
});

test("cableado en app.js: el guardado usa y asienta la clave de comparación", () => {
  assert.match(app, /canSkipUnchangedSave\(remoteHeadSettled, \{ known: remoteHeadKnown, snapshotId: remoteHeadSnapshotId \}, bundle\.fingerprint, bundle\.changeKey\)/);
  assert.match(app, /remoteHeadSettled = \{ snapshotId: bundle\.sourceHead\.snapshot_id, fingerprint: bundle\.fingerprint, changeKey: bundle\.changeKey \};/);
});
