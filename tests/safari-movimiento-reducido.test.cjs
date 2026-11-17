// 17/11/2026: el proyecto «safari» de Playwright corre con movimiento reducido. Con el desplazamiento suave de la app
// (`html { scroll-behavior: smooth }`), WebKit anima el acercamiento previo a cada clic y el clic cae fuera de su sitio
// (XDA-10 en #625, «CLA-01 y CLA-02» en #628, «Importar v2» y «Hoy, cambio 2» en el despliegue 1447).
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../playwright.config.cjs");
const fs = require("node:fs");
const path = require("node:path");

test("el proyecto safari emula movimiento reducido", () => {
  const safari = config.projects.find((project) => project.name === "safari");
  assert.ok(safari, "existe el proyecto safari");
  assert.equal(safari.use.browserName, "webkit");
  assert.equal(safari.use.reducedMotion, "reduce");
});

test("la app quita el desplazamiento suave con prefers-reduced-motion (lo que hace válida la emulación)", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.match(css, /html \{\s*scroll-behavior: smooth;\s*\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?scroll-behavior: auto !important;/);
});
