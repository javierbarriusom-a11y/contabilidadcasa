const assert = require("node:assert/strict");
const test = require("node:test");
const monthClose = require("../canonical-month-close.js");

test("cierra un mes congelando sus reales sin alterar los meses siguientes", () => {
  const payload = {
    incomeActuals: { "salary|2026-07": 3500, "salary|2026-08": 3600 },
    expenseActuals: { "rent|2026-07": 900, "rent|2026-08": 900 },
  };
  const closed = monthClose.closeMonth(payload, "2026-07", {
    id: "close-1", closedAt: "2026-08-01T08:00:00.000Z", reason: "Conciliado",
  });
  assert.equal(closed.monthClosures.length, 1);
  assert.deepEqual(closed.monthClosures[0].actuals.income, { "salary|2026-07": 3500 });
  assert.deepEqual(closed.monthClosures[0].actuals.expense, { "rent|2026-07": 900 });
  assert.equal(monthClose.isMonthClosed(closed, "2026-07"), true);
  assert.equal(monthClose.isMonthClosed(closed, "2026-08"), false);
});

test("rechaza duplicados y claves mensuales no válidas", () => {
  assert.throws(() => monthClose.closeMonth({}, "julio"), /no es válido/);
  const closed = monthClose.closeMonth({}, "2026-07", { closedAt: "2026-08-01T08:00:00.000Z" });
  assert.throws(() => monthClose.closeMonth(closed, "2026-07"), /ya está cerrado/);
});
