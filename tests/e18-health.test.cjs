const test = require("node:test");
const assert = require("node:assert/strict");
const health = require("../e18-health.js");

test("la telemetría E18 guarda solo tipo y fecha en local", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  const entries = health.record("view:update-hub", storage);
  assert.equal(entries.length, 1);
  assert.deepEqual(Object.keys(entries[0]).sort(), ["at", "kind"]);
  assert.equal(entries[0].kind, "view:update-hub");
});

test("la salud local agrega duración, fallos y operaciones pendientes sin contenido financiero", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  health.recordDuration("state-refresh", 18.7, storage);
  health.recordFailure("remote-save", storage);
  health.recordPending(2, storage);
  assert.deepEqual(health.summary(storage), { entries: 3, failures: 1, pending: 2, averageDurationMs: 19 });
  const entries = JSON.parse(data.get(health.KEY));
  assert.deepEqual(Object.keys(entries[0]).sort(), ["at", "durationMs", "kind"]);
  assert.deepEqual(Object.keys(entries[2]).sort(), ["at", "kind", "pending"]);
});
