// DEC-38 · Texto grande sin romper (décima auditoría §4.8; 20/11/2026, «sigue con todo lo que puedas que no depende de
// nosotros»). La app usa tamaños fijos en px: el texto grande del sistema no les afecta y lo que cuenta es el zoom de la
// página, que estrecha el ancho útil. Medido el 20/11: a 320 px (WCAG 1.4.10) se salían dos pantallas; a 260 px (390 px al
// 150 %), doce; a 195 px (al 200 %), 43. Primer paso: 320 px, vigilado en el CI por tools/check-mobile-overflow.mjs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DEC-38 · por debajo de 360 px las etiquetas del cono se recortan y el segmentado pasa a dos líneas; por encima, nada cambia", () => {
  const styles = read("styles.css");
  const cono = styles.indexOf("@media (max-width: 359px) {\n  .pv4-cone-labels > span {");
  assert.ok(cono > 0);
  assert.match(styles.slice(cono, cono + 220), /min-width: 0;\n {4}overflow: hidden;\n {4}text-overflow: ellipsis;\n {4}white-space: nowrap;/);
  const tokens = read("design-tokens.css");
  const seg = tokens.indexOf("@media (max-width: 359px) {\n  .e19-registrar-mes .registrar-mes-filters,");
  assert.ok(seg > 0);
  assert.match(tokens.slice(seg, seg + 500), /\.e19-analisis \.registrar-mes-filters,[\s\S]*flex-wrap: wrap;\n {4}max-width: 100%;/);
  assert.match(read("tools/check-mobile-overflow.mjs"), /const WIDTHS = \[320, 360, 768, 1280\];/);
});
