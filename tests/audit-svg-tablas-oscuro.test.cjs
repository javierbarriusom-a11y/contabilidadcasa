const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Auditoría del 7/10/2026 (consecuencia de WP-28 y WP-16): dos reglas globales de styles.css rompían cosas en silencio.
//   1) `svg { min-height: 350px }` ganaba a `height: 100%`: en «Valor por posición» (Inversión › Cartera) cada barra medía 350 px dentro
//      de una pista de 14 px y las barras se solapaban unas con otras.
//   2) `tbody tr:nth-child(even) { background: #fafbfc }` (y el hover, y la fila de año de «Flujo de caja») eran colores fijos sin tema:
//      en modo oscuro dejaban texto claro sobre casi blanco (≈ 1,1:1) en 24 vistas y 34 tablas.
// Las pruebas de navegador (tests/opt4-axe-accessibility.spec.cjs) miden el resultado; estas fijan la causa para que no reaparezca.

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const ruleBody = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no existe la regla ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("la cebra y el hover de las tablas salen de tokens del tema, no de colores fijos", () => {
  const zebra = ruleBody("tbody tr:nth-child(even)");
  assert.match(zebra, /background:\s*var\(--surface-soft\)/);
  assert.doesNotMatch(zebra, /#[0-9a-fA-F]{3,8}\b/);
  const hover = ruleBody("tbody tr:hover");
  assert.match(hover, /background:\s*color-mix\(in srgb, var\(--teal\)/);
  assert.doesNotMatch(hover, /#[0-9a-fA-F]{3,8}\b/);
});

test("la fila de año de «Flujo de caja» y su fila seleccionada no llevan colores claros fijos", () => {
  ["#e4f2ef", "#e9f1f3", "#eef7f5", "#cfdde2"].forEach((color) => assert.equal(css.includes(color), false, `${color} vuelve a estar fijo en styles.css`));
});

test("las barras de «Valor por posición» anulan el min-height global de los SVG", () => {
  assert.match(ruleBody(".iv1-chart-row-track svg"), /min-height:\s*0/);
  assert.match(css, /\nsvg \{\s*display: block;\s*width: 100%;\s*min-height: 350px;/, "la regla global sigue ahí (otros gráficos dependen de ella); lo que cambia es que sus víctimas la anulan");
});

test("la versión de styles.css cambió con la regla (si no, el navegador y el service worker servirían la antigua)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /styles\.css\?v=20261007audit1/);
  assert.doesNotMatch(html, /styles\.css\?v=20261004wp26a1/);
});
