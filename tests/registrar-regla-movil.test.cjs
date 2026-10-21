const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// La tarjeta «Previsto, real y usado» de Registrar (index.html, .e19-registrar-rule) se rompía en el móvil: era una fila
// flexible con el título y una rejilla de tres columnas minmax(0, 1fr) que podía encogerse casi a cero, así que nunca
// bajaba bajo el título y a 390 px quedaban tres columnas de ~100 px con una palabra por línea. La e2e de qa1
// («Registrar · tarjeta de la regla en el móvil») mide el ancho real; esta prueba fija las dos reglas que lo arreglan.

const css = fs.readFileSync(path.join(__dirname, "..", "design-tokens.css"), "utf8");

test("la rejilla tiene base propia: baja bajo el título cuando no cabe al lado", () => {
  assert.match(css, /\.e19-registrar-rule-grid \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);\s*gap: 14px;\s*flex: 1 1 420px;\s*\}/);
});

test("en el móvil, una columna: Previsto, Real y Usado uno debajo de otro", () => {
  assert.match(css, /@media \(max-width: 640px\) \{\s*\.e19-registrar-rule-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
});
