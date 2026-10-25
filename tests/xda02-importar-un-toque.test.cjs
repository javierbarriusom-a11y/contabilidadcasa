const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// XDA-02 · PR-1 (25/10/2026): «Importar en un toque». Desde Movimientos y desde el paso «Extracto» del repaso, el botón
// lleva a Registrar › Importar y abre ya el selector de archivos, y el medidor guarda los segundos del toque al extracto
// importado (la línea base del buzón, PR-2).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const importar = read("views/importar-v2.js");

test("abre el selector dentro del mismo toque, sin pisar una revisión a medias", () => {
  const body = importar.slice(importar.indexOf("function importarV2Elegir("), importar.indexOf("globalThis.importarV2Render = importarV2Render;"));
  assert.match(body, /if \(!\(activeViewId === "registrar" && registrarActiveTab === "import"\)\) impV2Navigate\("datos-importar"\);/);
  assert.match(body, /if \(!impV2Active\(\) \|\| datosImportarSession\) return;/);
  assert.match(body, /impV2ToqueEn = performance\.now\(\);\n\s+input\.click\(\);/);
  assert.match(importar, /globalThis\.importarV2Elegir = importarV2Elegir;/);
});

test("los segundos del toque al importado van al medidor una sola vez", () => {
  assert.match(importar, /const segundos = impV2ToqueEn !== null \? \(performance\.now\(\) - impV2ToqueEn\) \/ 1000 : null;\n\s+impV2ToqueEn = null;/);
  assert.match(importar, /anotar\("importar-v2", "accion", \{ clave: .*, segundos \}\);/);
  assert.match(read("medidor-utilidad.js"), /id === "importar-v2" && r\.medianaSegundos !== null\) partes\.push\(`\$\{[^`]+\} s del toque en «Importar» al extracto importado/);
});

test("lo usan Movimientos y el paso «Extracto» del repaso", () => {
  assert.match(read("views/movimientos-v2.js"), /if \(nav\?\.dataset\.movV2Nav === "datos-importar" && typeof globalThis\.importarV2Elegir === "function"\) return globalThis\.importarV2Elegir\(\);/);
  assert.match(read("views/repaso-v2.js"), /repasoV2IrA\("datos-importar"\);\n\s+return globalThis\.importarV2Elegir\?\.\(\);/);
});
