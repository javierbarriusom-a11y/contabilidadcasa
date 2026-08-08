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
