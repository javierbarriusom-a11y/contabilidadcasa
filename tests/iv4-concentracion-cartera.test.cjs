const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("IV4: la tarjeta de cartera tiene el contenedor de concentración", () => {
  assert.match(indexSource, /id="iv1PositionConcentration"/);
});

test("IV4: renderIv1PositionConcentration calcula el reparto por tipo con aviso de concentración alta", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionConcentration"), appSource.indexOf("function renderIv1PositionConcentration") + 1200);
  assert.match(block, /totalsByType/);
  assert.match(block, /pct > 50/);
  assert.match(block, /concentración alta/);
});

test("IV4: avisa de sobreexposición cuando una sola posición supera el 50% de la cartera", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionConcentration"), appSource.indexOf("function renderIv1PositionConcentration") + 1600);
  assert.match(block, /topPosition/);
  assert.match(block, /sobreexposición a una sola posición/);
});

test("IV4: sin posiciones registradas, la tarjeta de concentración queda neutra", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionConcentration"), appSource.indexOf("function renderIv1PositionConcentration") + 500);
  assert.match(block, /if \(!engine \|\| !rows\.length\) \{\s*note\.innerHTML = "";/);
});
