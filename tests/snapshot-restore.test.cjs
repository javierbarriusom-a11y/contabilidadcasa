const assert = require("node:assert/strict");
const test = require("node:test");
const restore = require("../snapshot-restore.js");

test("la vista previa compara el contenido que se perderá o recuperará", () => {
  const preview = restore.buildSnapshotPreview(
    {
      projects: [{ id: "current" }],
      debtLiquidations: [],
      incomeActuals: { salary: 1000 },
      expenseActuals: {},
      customPlanningRows: [],
      seriesOverrides: { rent: 1 },
      movementMappings: {},
      debtRoadmapState: {},
    },
    {
      projects: [],
      debtLiquidations: [{ id: "restored" }],
      incomeActuals: { salary: 1000 },
      expenseActuals: { rent: 700 },
      customPlanningRows: [{ id: "row" }],
      seriesOverrides: {},
      movementMappings: {},
      debtRoadmapState: { profile: "base", tasks: [] },
    },
  );

  assert.equal(preview.metrics.find((item) => item.key === "projects").delta, -1);
  assert.equal(preview.metrics.find((item) => item.key === "debtRoadmapState").after, 2);
  assert.ok(preview.changed.length >= 5);
});

test("la comparación no altera ninguno de los estados", () => {
  const current = { projects: [{ id: "one" }], debtRoadmapState: {} };
  const target = { projects: [], debtRoadmapState: { profile: "base" } };
  const before = JSON.stringify({ current, target });
  restore.buildSnapshotPreview(current, target);
  assert.equal(JSON.stringify({ current, target }), before);
});
