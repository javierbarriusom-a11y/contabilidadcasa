const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Rediseño · A1b (petición del hogar, 18/10/2026): en el tema v2 el verde sólido es solo para
// acciones; las tarjetas de conclusión («Qué se recalcula al guardar», «Hasta el siguiente
// ingreso»…) pasan a una tarjeta clara teñida de marca, con texto legible en claro y en oscuro.

const css = fs.readFileSync(path.resolve(__dirname, "..", "tema-v2.css"), "utf8");
const lum = (hex) => {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (block, name) => {
  const start = css.indexOf(`${block} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return body.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))[1];
};

test("las tarjetas de conclusión ya no usan el fondo de los botones", () => {
  for (const sel of [".e19-registrar-recalc", ".e19-home .home-panel.e6-coverage-card", ".e19-card-strong"]) {
    assert.ok(css.includes(sel), `falta ${sel}`);
  }
  assert.match(css, /background: var\(--e19-accent-soft\);/);
});

test("texto de las conclusiones legible (≥ 4,5:1) en claro y en oscuro", () => {
  for (const block of [':root[data-tema="v2"]', ':root[data-tema="v2"][data-theme="dark"]']) {
    const bg = token(block, "--e19-accent-soft");
    for (const fg of ["--e19-ink", "--e19-muted"]) {
      const c = contrast(token(block, fg), bg);
      assert.ok(c >= 4.5, `${block} ${fg} sobre --e19-accent-soft: ${c.toFixed(2)}:1`);
    }
  }
});
