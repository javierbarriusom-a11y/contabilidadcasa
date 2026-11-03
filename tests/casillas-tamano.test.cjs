// 3/11/2026 · casillas de toda la app. `styles.css` da a todo `input` 100 % de ancho y 40 px de alto; sin una regla propia, las
// casillas y opciones salían de hasta 360 × 40 px, centradas y encima de su texto (30 de las 33 visibles). La regla va detrás de la de
// `input`, con `:where()` para no pasar por encima de ningún componente que ya diera su tamaño o su maquetación con una clase.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const bloque = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `falta la regla ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("las casillas y opciones vuelven a 18 px, sin el 100 % de ancho ni los 40 px de alto de todo input", () => {
  const regla = bloque('input:where([type="checkbox"], [type="radio"])');
  assert.match(regla, /width: 18px;/);
  assert.match(regla, /height: 18px;/);
  assert.match(regla, /min-height: 0;/);
  assert.ok(css.indexOf('input:where([type="checkbox"], [type="radio"]) {') > css.indexOf("input,\nselect {\n  width: 100%;"), "va detrás de la regla de input, con su misma prioridad");
});

test("en su etiqueta, la casilla va en la primera columna y el texto a su lado, también si el HTML la pone detrás", () => {
  assert.match(bloque('label:where(:has(> input[type="checkbox"], > input[type="radio"]))'), /display: grid;\n\s+grid-template-columns: 18px minmax\(0, 1fr\);/);
  assert.match(bloque('label:where(:has(> input[type="checkbox"], > input[type="radio"])) > input:where([type="checkbox"], [type="radio"])'), /grid-column: 1;\n\s+grid-row: 1;/);
});

test("ninguna de estas reglas sube la prioridad: todo va dentro de :where()", () => {
  const reglas = css.split("\n").filter((line) => /^(input|label)[:\[]/.test(line) && /checkbox/.test(line));
  assert.ok(reglas.length >= 3);
  reglas.forEach((line) => assert.match(line, /^(input|label):where\(/, line));
});
