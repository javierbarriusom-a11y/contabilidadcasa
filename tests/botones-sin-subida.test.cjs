// 12/11/2026 (decisión del hogar): ningún botón ni tarjeta-botón se mueve al pasar el ratón. Con `transform: translateY(-1px)` en
// `:hover`, el ratón quieto en el último píxel dejaba el botón subiendo y bajando sin parar (temblaba), y era la causa del fallo
// intermitente de la e2e de WP-40 (tests/helpers/pulsar-o-explicar.cjs). La señal de hover es el borde o la sombra, que no mueven
// la caja. Se exceptúa la ayuda emergente `[data-help]::before`, que no es un objetivo de clic.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("ningún :hover mueve un botón con transform (translate o scale)", () => {
  const culpables = [];
  for (const file of ["styles.css", "design-tokens.css", "tema-v2.css"]) {
    const css = fs.readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)) {
      const selector = match[1].trim();
      if (/^\[data-help\]/.test(selector)) continue;
      if (/transform\s*:\s*(translate|scale)/.test(match[2])) culpables.push(`${file}: ${selector.replace(/\s+/g, " ")}`);
    }
  }
  assert.deepEqual(culpables, []);
});

test("los botones ya no animan transform y la novedad lo cuenta", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /button:hover \{\n  border-color: var\(--blue\);\n\}/);
  const novedades = fs.readFileSync(path.join(root, "novedades.js"), "utf8");
  assert.match(novedades, /id: "2026-11-16-botones-quietos"/);
});
