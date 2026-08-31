const test = require("node:test");
const assert = require("node:assert/strict");

const HealthScore = require("../canonical-health-score.js");

test("A16-2: recordSnapshot añade un registro nuevo por fecha", () => {
  const history = HealthScore.recordSnapshot([], "2026-08-01", 70);
  assert.deepEqual(history, [{ date: "2026-08-01", value: 70 }]);
});

test("A16-2: recordSnapshot en la misma fecha actualiza el valor en vez de duplicar", () => {
  let history = HealthScore.recordSnapshot([], "2026-08-01", 70);
  history = HealthScore.recordSnapshot(history, "2026-08-01", 75);
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 75);
});

test("A16-2: recordSnapshot con value null/undefined no añade nada — nunca fabrica un cero", () => {
  const history = HealthScore.recordSnapshot([{ date: "2026-08-01", value: 70 }], "2026-08-02", null);
  assert.equal(history.length, 1);
});

test("A16-2: recordSnapshot ordena por fecha aunque se registre fuera de orden", () => {
  let history = HealthScore.recordSnapshot([], "2026-08-05", 80);
  history = HealthScore.recordSnapshot(history, "2026-08-01", 70);
  assert.deepEqual(history.map((entry) => entry.date), ["2026-08-01", "2026-08-05"]);
});

test("A16-2: trendSummary devuelve null con menos de dos registros", () => {
  assert.equal(HealthScore.trendSummary([]), null);
  assert.equal(HealthScore.trendSummary([{ date: "2026-08-01", value: 70 }]), null);
});

test("A16-2: trendSummary calcula la diferencia entre el primer y el último registro", () => {
  const history = [{ date: "2026-08-01", value: 70 }, { date: "2026-08-15", value: 82 }];
  const trend = HealthScore.trendSummary(history);
  assert.equal(trend.delta, 12);
  assert.equal(trend.count, 2);
  assert.equal(trend.first.value, 70);
  assert.equal(trend.last.value, 82);
});
