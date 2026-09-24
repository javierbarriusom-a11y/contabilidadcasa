const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// T9 (BACKLOG_CONTABILIDADCASA_2_0.md §4, redefinida el 24 de septiembre de 2026): la comprobación de
// contenido cortado necesita un navegador, así que vive en tools/check-mobile-overflow.mjs y corre en
// el CI (igual que el presupuesto de Lighthouse), no en `npm test`. Esta prueba, que sí corre en cada
// `npm test`, impide que alguien la desenganche sin darse cuenta: 13 de 59 pantallas estuvieron
// cortadas en móvil, y 5-6 también en escritorio, sin que ninguna prueba lo notase.

test("la comprobación de contenido cortado existe y cubre móvil, tableta y portátil", () => {
  const tool = read("tools/check-mobile-overflow.mjs");
  assert.match(tool, /const WIDTHS = \[360, 768, 1280\];/);
  assert.match(tool, /section\.view-section\[id\]/, "debería recorrer todas las pantallas, no una lista fija");
});

test("la comprobación está enganchada a package.json y al CI, detrás de la instalación de Chromium", () => {
  const scripts = JSON.parse(read("package.json")).scripts;
  assert.equal(scripts["test:mobile-overflow"], "node tools/check-mobile-overflow.mjs");
  const workflow = read(".github/workflows/pages.yml");
  const install = workflow.indexOf("npx playwright install --with-deps chromium");
  const run = workflow.indexOf("npm run test:mobile-overflow");
  assert.ok(install >= 0 && run > install, "pages.yml debería ejecutar test:mobile-overflow después de instalar Chromium");
});

test("fieldset no hereda el ancho mínimo de su contenido (causa del recorte de Deuda › Comparar)", () => {
  assert.match(read("styles.css"), /fieldset \{[^}]*min-width: 0;/);
});

test("el formulario de nueva línea no vuelve a ocho columnas fijas (el botón «Añadir» quedaba fuera a 1280px)", () => {
  const rule = read("styles.css").match(/\.visual-add-grid \{[^}]*\}/);
  assert.ok(rule, "styles.css debería declarar .visual-add-grid");
  assert.match(rule[0], /grid-template-columns: repeat\(auto-fill, minmax\(150px, 1fr\)\);/);
});
