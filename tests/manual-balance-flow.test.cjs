const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("el saldo manual conserva reales pero no los vuelve a proyectar en el mes de partida", () => {
  assert.match(appSource, /function forwardPlanningInfo\(row, month\)/);
  assert.match(appSource, /state\?\.balanceMode === "manual" && month\?\.key === monthKey\(modelStartDate\(\)\)/);
  assert.match(appSource, /info\.status === "realized"/);
  assert.match(appSource, /Realizado · incluido en saldo/);
  assert.match(appSource, /forwardPlanningInfo\(row, month\)\.value/);
  assert.match(appSource, /actualsForKind\(row\.kind\)\[actualKeyForRow\(row, month\)\] = draft\.value/);
});

test("Actualizar explica la función de la fecha cuando el saldo es manual", () => {
  assert.match(html, /id="visualBalanceDateLabel"/);
  assert.match(html, /id="visualBalanceDateHint"/);
  assert.match(appSource, /Fecha del saldo real/);
  assert.match(appSource, /La fecha se registra automáticamente al actualizar el saldo/);
  assert.match(appSource, /input\.disabled = !auto/);
  assert.match(appSource, /state\.balanceDate = isoLocalDate\(new Date\(\)\)/);
  assert.match(appSource, /if \(state\.balanceMode === "auto"\) state\.balanceDate = isoLocalDate\(new Date\(\)\)/);
});
