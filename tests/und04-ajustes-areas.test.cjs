// UND-04 (undécima auditoría; D-N29, 22/11/2026, decisión del hogar: «Áreas solo en el móvil»): Ajustes por áreas en el móvil, todo a
// la vista en el escritorio. Las áreas agrupan los diez grupos que ya existían, sin mover ninguna tarjeta.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../ajustes-areas.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("UND-04 · seis áreas y «Ver todo»; cada uno de los diez grupos, en una", () => {
  assert.deepEqual([...A.AREAS], ["cuentas", "plan", "patrimonio", "datos", "laboratorio", "uso", "navegacion", "todo"]);
  const html = read("index.html");
  const grupos = [...html.matchAll(/<div class="e19-ajustes-group" id="([a-z-]+)" aria-labelledby="[a-z-]+" data-ajustes-area="([a-z]+)"/g)].map((m) => [m[1], m[2]]);
  assert.equal(grupos.length, 10, "los diez grupos llevan su área");
  for (const [, area] of grupos) assert.ok(A.AREAS.includes(area) && area !== "todo");
  for (const area of A.AREAS) assert.match(html, new RegExp(`role="tab" id="ajustesArea-${area}" data-ajustes-area-tab="${area}"`));
  assert.equal(A.valida("otra"), "cuentas");
});

test("UND-04 · solo en el móvil (≤ 860 px): en el escritorio, ni pestañas ni grupos escondidos", () => {
  const css = read("styles.css");
  const bloque = css.slice(css.indexOf("/* UND-04 (D-N29"));
  assert.match(bloque, /^\.ajustes-areas \{\s*display: none;/m);
  const movil = bloque.slice(bloque.indexOf("@media (max-width: 860px)"));
  assert.match(movil, /#ajustes\[data-ajustes-area="laboratorio"\] \.e19-ajustes-group:not\(\[data-ajustes-area="laboratorio"\]\)/);
  assert.match(movil, /\.ajustes-areas \[role="tab"\] \{[^}]*min-height: 44px;/);
  assert.doesNotMatch(bloque.slice(0, bloque.indexOf("@media")), /e19-ajustes-group/, "fuera del móvil no se esconde nada");
  assert.doesNotMatch(bloque, /data-tema/, "en los dos temas");
});

test("UND-04 · el área dura la sesión, se elige con teclado, y quien lleva a una tarjeta cambia antes a su área", () => {
  const js = read("ajustes-areas.js");
  assert.match(js, /root\.sessionStorage\?\.getItem\(CLAVE\)/);
  assert.match(js, /\["ArrowRight", "ArrowLeft", "Home", "End"\]/);
  assert.match(js, /const ancla = event\.target\?\.closest\?\.\("\[data-ajustes-anchor\]"\);\n {6}if \(ancla\) mostrar\(ancla\.dataset\.ajustesAnchor, doc\);\n {4}\}, true\);/, "en la fase de captura");
  assert.match(read("funciones-en-prueba.js"), /globalThis\.FinanceAjustesAreas\?\.mostrar\?\.\("funcionesEnPruebaCard"\)/);
  const html = read("index.html");
  assert.match(html, /<script defer src="ajustes-areas\.js\?v=20261122und04b"><\/script>/);
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"ajustes-areas\.js",$/m);
  assert.match(read("service-worker.js"), /^ {2}"\.\/ajustes-areas\.js",$/m);
});
