const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A16-2: la tarjeta de salud financiera tiene el contenedor de tendencia", () => {
  assert.match(indexSource, /id="homeHealthScoreTrendNote"/);
});

test("A16-2: recordHomeHealthScoreSnapshot no guarda nada sin valor calculable", () => {
  const block = appSource.slice(appSource.indexOf("function recordHomeHealthScoreSnapshot"), appSource.indexOf("function recordHomeHealthScoreSnapshot") + 500);
  assert.match(block, /if \(!engine \|\| value === null \|\| value === undefined\) return;/);
});

test("A16-2: renderHomeHealthScoreTrend dice explícitamente que aún no hay tendencia sin histórico", () => {
  const block = appSource.slice(appSource.indexOf("function renderHomeHealthScoreTrend"), appSource.indexOf("function renderHomeHealthScoreTrend") + 600);
  assert.match(block, /se irá acumulando a partir de hoy/);
});

test("A16-2: renderHomeDashboard registra el snapshot del día y pinta la tendencia", () => {
  assert.match(appSource, /recordHomeHealthScoreSnapshot\(compositeResult\?\.value \?\? null, new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\);/);
  assert.match(appSource, /renderHomeHealthScoreTrend\(\);/);
});
