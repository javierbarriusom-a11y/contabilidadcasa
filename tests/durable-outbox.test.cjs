const test = require("node:test");
const assert = require("node:assert/strict");
const { createDurableOutbox } = require("../durable-outbox.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("conserva un marcador recuperable aunque IndexedDB no esté disponible", async () => {
  const storage = memoryStorage();
  const firstSession = createDurableOutbox({ storage });
  await firstSession.put({
    id: "user:finance",
    userId: "user",
    sourceKey: "finance",
    revision: 3,
    baseHeadSnapshotId: "head-1",
    payload: { amount: 25 },
  });

  const nextSession = createDurableOutbox({ storage });
  const restored = await nextSession.get("user:finance");
  assert.equal(restored.pending, true);
  assert.equal(restored.revision, 3);
  assert.equal(restored.baseHeadSnapshotId, "head-1");
});

test("solo elimina el marcador si la revisión completada alcanza la pendiente", async () => {
  const storage = memoryStorage();
  const outbox = createDurableOutbox({ storage });
  await outbox.put({ id: "user:finance", revision: 5 });

  await outbox.remove("user:finance", 4);
  assert.equal((await outbox.get("user:finance")).revision, 5);

  await outbox.remove("user:finance", 5);
  assert.equal(await outbox.get("user:finance"), null);
});
