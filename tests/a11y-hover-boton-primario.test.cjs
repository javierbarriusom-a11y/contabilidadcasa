const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "design-tokens.css"), "utf8");

// El botón primario con el puntero encima, en claro y en oscuro: el texto (--e19-accent-ink) tiene que cumplir 4,5:1 sobre el fondo de hover. En oscuro,
// --e19-accent-hover (#748296) es más CLARO que --e19-accent y con texto blanco da 3,91:1; el fondo de hover propio (--e19-accent-hover-bg) lo evita.

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Los tres sitios donde se definen los tokens: el claro (:root), el oscuro por preferencia del sistema y el oscuro forzado.
const blocks = {
  claro: css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)")),
  "oscuro por sistema": css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf(':root[data-theme="dark"]')),
  "oscuro forzado": css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf(':root[data-theme="dark"]') + 2500),
};
const token = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

for (const [theme, block] of Object.entries(blocks)) {
  test(`hover del botón primario · ${theme}: el texto cumple 4,5:1 sobre el fondo de hover`, () => {
    const ink = token(block, "--e19-accent-ink");
    const hoverBg = token(block, "--e19-accent-hover-bg");
    assert.ok(ink && hoverBg, `${theme}: faltan --e19-accent-ink o --e19-accent-hover-bg`);
    assert.ok(contrast(ink, hoverBg) >= 4.5, `${theme}: ${ink} sobre ${hoverBg} da ${contrast(ink, hoverBg).toFixed(2)}:1`);
  });
}

test("hover del botón primario · en oscuro el hover oscurece (como en claro) y se distingue del reposo", () => {
  const dark = blocks["oscuro por sistema"];
  const rest = token(dark, "--e19-accent");
  const hover = token(dark, "--e19-accent-hover-bg");
  assert.ok(luminance(hover) < luminance(rest), "el fondo de hover es más oscuro que el de reposo, como en claro");
  assert.ok(contrast(hover, rest) >= 1.2, `se nota el cambio: ${contrast(hover, rest).toFixed(2)}:1 entre reposo y hover`);
});

test("hover del botón primario · la regla usa el token propio, y --e19-accent-hover (más claro) queda solo para texto", () => {
  assert.match(css, /\.e19-btn-primary:hover\s*\{\s*background:\s*var\(--e19-accent-hover-bg,\s*var\(--e19-accent-hover\)\);/);
  assert.equal(token(blocks["oscuro por sistema"], "--e19-accent-hover"), "#748296", "el token de texto no se toca");
  assert.equal(token(blocks.claro, "--e19-accent-hover"), "#1b2c48", "el claro tampoco (lo fija t2-acento-navy)");
});

test("hover del botón primario · el antes: --e19-accent-hover como fondo en oscuro NO cumplía (documenta el fallo que se corrigió)", () => {
  assert.ok(contrast("#ffffff", "#748296") < 4.5, "3,91:1");
});
