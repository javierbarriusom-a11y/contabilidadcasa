const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRemoteSaveQueue } = require("../remote-save-queue.js");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test("persiste la última revisión cuando cambia el estado durante una sincronización", async () => {
  let state = { lines: ["inicial"] };
  const firstWrite = deferred();
  const writes = [];
  const queue = createRemoteSaveQueue({
    capture: () => structuredClone(state),
    write: async (payload, revision) => {
      writes.push({ payload, revision });
      if (revision === 1) await firstWrite.promise;
    },
  });

  queue.request();
  const draining = queue.flush();
  state.lines.push("alta durante sync");
  queue.request();
  firstWrite.resolve();
  await draining;

  assert.deepEqual(writes.map((item) => item.revision), [1, 2]);
  assert.deepEqual(writes[1].payload.lines, ["inicial", "alta durante sync"]);
  assert.equal(queue.snapshot().pending, false);
});

test("un fallo conserva la revisión pendiente y permite reintentar", async () => {
  let attempts = 0;
  const scheduled = [];
  const queue = createRemoteSaveQueue({
    capture: () => ({ value: 7 }),
    write: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("red no disponible");
    },
    retryDelays: [0],
    schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
    cancel: () => {},
  });

  queue.request();
  await queue.flush();
  assert.equal(queue.snapshot().pending, true);
  assert.match(queue.snapshot().lastError.message, /red no disponible/);
  await scheduled.shift()();
  assert.equal(attempts, 2);
  assert.equal(queue.snapshot().pending, false);
  assert.ok(queue.snapshot().lastPersistedAt);
});

test("flush espera una escritura que ya está en curso", async () => {
  const write = deferred();
  const queue = createRemoteSaveQueue({ write: () => write.promise, capture: () => ({ value: 1 }) });
  queue.request({ immediate: true });
  let completed = false;
  const flush = queue.flush().then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  write.resolve();
  await flush;
  assert.equal(completed, true);
});

test("un conflicto remoto queda pendiente sin reintentar automáticamente", async () => {
  const scheduled = [];
  const conflict = Object.assign(new Error("otra sesión publicó una revisión más reciente"), {
    code: "REMOTE_WRITE_CONFLICT",
    retryable: false,
  });
  const queue = createRemoteSaveQueue({
    capture: () => ({ value: 8 }),
    write: async () => { throw conflict; },
    retryDelays: [0],
    schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
    cancel: () => {},
  });

  queue.request();
  await queue.flush();

  assert.equal(queue.snapshot().pending, true);
  assert.equal(queue.snapshot().retryScheduled, false);
  assert.equal(queue.snapshot().lastError.code, "REMOTE_WRITE_CONFLICT");
  assert.equal(scheduled.length, 0);
});

test("recupera una revisión pendiente al abrir una sesión nueva", async () => {
  const writes = [];
  const queue = createRemoteSaveQueue({
    capture: () => ({ local: "conservado" }),
    write: async (payload, revision) => writes.push({ payload, revision }),
  });

  queue.hydrate({ requestedRevision: 4, persistedRevision: 0 });
  assert.equal(queue.snapshot().pending, true);
  await queue.flush();

  assert.deepEqual(writes, [{ payload: { local: "conservado" }, revision: 4 }]);
  assert.equal(queue.snapshot().pending, false);
});

test("recupera un conflicto pendiente sin lanzar una escritura", async () => {
  let writes = 0;
  const conflict = Object.assign(new Error("conflicto"), { code: "REMOTE_WRITE_CONFLICT", retryable: false });
  const queue = createRemoteSaveQueue({ write: async () => { writes += 1; } });

  queue.hydrate({ requestedRevision: 2, persistedRevision: 0, lastError: conflict });

  assert.equal(queue.snapshot().pending, true);
  assert.equal(queue.snapshot().lastError.code, "REMOTE_WRITE_CONFLICT");
  assert.equal(writes, 0);
});

test("una escritura transaccional externa actualiza la revisión sincronizada", () => {
  const states = [];
  const queue = createRemoteSaveQueue({
    write: async () => {},
    onChange: (state) => states.push(state),
  });
  const closedAt = "2026-07-31T20:34:00.000Z";
  const state = queue.acknowledge(closedAt);
  assert.equal(state.requestedRevision, 1);
  assert.equal(state.persistedRevision, 1);
  assert.equal(state.pending, false);
  assert.equal(state.lastPersistedAt, closedAt);
  assert.equal(states.at(-1).lastPersistedAt, closedAt);
});

test("el puntero remoto se mueve solo si conserva la revisión que cargó la sesión", () => {
  assert.match(appSource, /\.eq\("snapshot_id", remoteHeadSnapshotId\)/);
  assert.match(appSource, /if \(!headResult\.error && !headResult\.data\)/);
  assert.match(appSource, /error\.code = "REMOTE_WRITE_CONFLICT"/);
  assert.doesNotMatch(appSource, /\.upsert\(bundle\.sourceHead/);
});

test("una misma sesión no dispara dos cargas remotas simultáneas", () => {
  assert.match(appSource, /if \(remoteLoadedUserId === remoteUser\.id\) return Promise\.resolve\(\)/);
  assert.match(appSource, /if \(remoteLoadPromise\) return remoteLoadPromise/);
  assert.match(appSource, /if \(remoteUser && \(remoteLoadPromise \|\| remoteLoadedUserId === remoteUser\.id\)\) return/);
});

test("el arranque consulta la bandeja durable y exige una decisión antes de reconciliar", () => {
  assert.match(appSource, /await readDurableRemoteSave\(\);\s*await loadRemoteState\(\);/);
  assert.match(appSource, /expectedHead !== remoteHeadSnapshotId/);
  assert.match(appSource, /showStartupRecovery\(durableResumeRecord, authoritative, authoritativeUpdatedAt\)/);
  assert.doesNotMatch(appSource, /Reanudando cambios locales pendientes de la sesión anterior/);
});
