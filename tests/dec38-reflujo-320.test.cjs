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
  // Las tres que el CI vio cortadas a 320 px con sus fuentes (algo más anchas que las de una máquina de desarrollo).
  const panel = styles.indexOf("@media (max-width: 359px) {\n  .visual-save-panel {");
  assert.ok(panel > 0);
  assert.match(styles.slice(panel, panel + 200), /flex-direction: column;\n {4}align-items: stretch;/);
  assert.match(tokens, /@media \(max-width: 359px\) \{\n {2}\.e19-deuda-decidir \.deuda-decidir-strategy-actions \{\n {4}flex-wrap: wrap;/);
  assert.match(read("tools/check-mobile-overflow.mjs"), /const WIDTHS = \[260, 320, 360, 768, 1280\];/);
});

test("DEC-38 · paso 2: a 260 px (zoom al 150 %) todas las pantallas menos cinco de «Versiones anteriores» pendientes de D-N15", () => {
  const tool = read("tools/check-mobile-overflow.mjs");
  assert.match(tool, /const PENDIENTES_A_260 = new Set\(\["executive-advisor", "mapa-calor", "debt-liquidation-plan", "savings-agent", "virtual-advisor"\]\);/);
  assert.match(tool, /if \(width === 260 && PENDIENTES_A_260\.has\(id\)\) continue;/, "solo a 260 px: en los demás anchos se miran como todas");
  // Las columnas que no dejaban estrecharse: con minmax(0, 1fr) el contenido manda menos que el ancho que hay.
  assert.match(read("tema-v2.css"), /:root\[data-tema="v2"\] \.mov-v2 \{\n {2}display: grid;\n {2}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(read("prestamo-deuda.css"), /\.pre-condiciones \{\n {2}display: grid;\n {2}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(read("fiscal-campana.css"), /min-inline-size: 0;/, "un fieldset no baja de su contenido sin esto");
  assert.match(read("design-tokens.css"), /repeat\(auto-fill, minmax\(min\(220px, 100%\), 1fr\)\)/);
  // Las dos que el CI vio a 260 px con sus fuentes (Registrar › Lote y Excel y la tarjeta de «nueva vida»).
  assert.match(read("styles.css"), /@media \(max-width: 359px\) \{\n {2}\.module-heading,\n {2}\.e6-quality-card header \{\n {4}flex-wrap: wrap;/);
  for (const sel of ["\\.panel-uso-lista li", "\\.debt-priority-plan", "\\.decision-right", "\\.data-card"]) {
    assert.match(read("styles.css"), new RegExp(`${sel} \\{\\n {2}display: grid;\\n {2}grid-template-columns: minmax\\(0, 1fr\\);`), sel);
  }
});
