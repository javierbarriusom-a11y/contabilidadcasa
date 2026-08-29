const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const E = require("../canonical-emergency-credit-line.js");

// DI2 · Bloque 2: línea de crédito de emergencia frente a colchón líquido. Compara el colchón
// operativo de referencia (mismo suelo que ya usan Plan y el mapa de calor) con el límite de una
// línea de crédito de emergencia — si la cubre, estima el coste en intereses de disponer de ella de
// verdad, frente a mantener ese dinero inmovilizado sin rendimiento.

test("evaluateEmergencyCreditLine · sin colchón de referencia configurado, nada que comparar (null, no false)", () => {
  const result = E.evaluateEmergencyCreditLine(0, 5000, 8);
  assert.equal(result.covered, null);
  assert.equal(result.gap, null);
  assert.equal(result.estimatedDrawCost, null);
  assert.equal(result.coverageRatio, null);
});

test("evaluateEmergencyCreditLine · la línea cubre el colchón por completo", () => {
  const result = E.evaluateEmergencyCreditLine(3000, 5000, 8);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, 1.67);
});

test("evaluateEmergencyCreditLine · la línea cubre solo parte del colchón, queda una brecha", () => {
  const result = E.evaluateEmergencyCreditLine(3000, 1000, 8);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 2000);
});

test("evaluateEmergencyCreditLine · sin línea configurada (límite 0), la brecha es el colchón entero y el coste es 0", () => {
  const result = E.evaluateEmergencyCreditLine(3000, 0, 8);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 3000);
  assert.equal(result.estimatedDrawCost, 0);
});

test("evaluateEmergencyCreditLine · estimatedDrawCost usa DEFAULT_DRAW_MONTHS por defecto", () => {
  const result = E.evaluateEmergencyCreditLine(2000, 5000, 12);
  // 2000 disponible como máximo (colchón, no el límite entero) * 12% * (3/12) = 60
  assert.equal(result.drawMonths, E.DEFAULT_DRAW_MONTHS);
  assert.equal(result.estimatedDrawCost, 60);
});

test("evaluateEmergencyCreditLine · solo se estima el coste sobre lo realmente necesario (min entre colchón y límite)", () => {
  // Límite muy por debajo del colchón: el coste se calcula sobre el límite disponible, no sobre el
  // colchón completo que la línea no podría cubrir.
  const result = E.evaluateEmergencyCreditLine(10000, 1000, 12, 3);
  assert.equal(result.estimatedDrawCost, round2(1000 * 0.12 * 0.25));
});

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

test("evaluateEmergencyCreditLine · TIN o límite negativos se recortan a 0", () => {
  const result = E.evaluateEmergencyCreditLine(1000, -500, -3);
  assert.equal(result.creditLimit, 0);
  assert.equal(result.creditRate, 0);
});

test("los campos de límite y TIN de la línea de crédito viven en #ajustes", () => {
  const openTag = /<section[^>]*id="ajustes"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #ajustes");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const ajustes = html.slice(start, end);
  assert.match(ajustes, /id="ajustesEmergencyCreditLimit"/);
  assert.match(ajustes, /id="ajustesEmergencyCreditRate"/);
  assert.match(ajustes, /id="ajustesEmergencyCreditLineNote"/);
});

test("el script del motor canónico está registrado en index.html", () => {
  assert.match(html, /canonical-emergency-credit-line\.js\?v=/);
});

test("los listeners de cambio de límite y TIN están cableados", () => {
  assert.match(app, /qs\("ajustesEmergencyCreditLimit"\)\?\.addEventListener\("change", handleEmergencyCreditLimitChange\)/);
  assert.match(app, /qs\("ajustesEmergencyCreditRate"\)\?\.addEventListener\("change", handleEmergencyCreditRateChange\)/);
});

test("renderAjustes sincroniza y rellena la nota de la línea de crédito de emergencia", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /syncEmergencyCreditLineControls\(\);/);
  assert.match(body, /renderAjustesEmergencyCreditLineNote\(\);/);
});

test("saveScenarioSettings persiste el límite y el TIN de la línea de crédito", () => {
  const start = app.indexOf("function saveScenarioSettings(");
  assert.ok(start >= 0, "No existe saveScenarioSettings en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /emergencyCreditLimit: round2\(Math\.max\(0, Number\(state\.emergencyCreditLimit \|\| 0\)\)\)/);
  assert.match(body, /emergencyCreditRate: round2\(Math\.max\(0, Number\(state\.emergencyCreditRate \|\| 0\)\)\)/);
});
