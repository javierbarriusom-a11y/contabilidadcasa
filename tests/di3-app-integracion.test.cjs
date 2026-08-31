const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const deudaSource = fs.readFileSync(require.resolve("../views/deuda.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("DI3: la tarjeta «Antes de aplicar» de Deuda · Ruta tiene el contenedor de revolving", () => {
  assert.match(indexSource, /id="deudaRutaRevolvingNote"/);
});

test("DI3: renderDeudaRuta llama a prioritizeRevolving y pinta deudaRutaRevolvingText", () => {
  assert.match(deudaSource, /DebtContracts\?\.prioritizeRevolving\(contracts\)/);
  assert.match(deudaSource, /deudaRutaRevolvingText/);
});

test("DI3: deudaRutaRevolvingText no dice nada si no hay revolving detectada", () => {
  const block = appSource.slice(appSource.indexOf("function deudaRutaRevolvingText"), appSource.indexOf("function deudaRutaRevolvingText") + 400);
  assert.match(block, /if \(!prioritized\.length\) return "";/);
});
