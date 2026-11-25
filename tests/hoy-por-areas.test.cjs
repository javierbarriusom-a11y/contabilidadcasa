// Hoy por áreas (21/11/2026, petición del hogar): «tiene muchos datos interesantes, pero están todos en una sola página; agrúpalo por
// áreas temáticas, como Deuda». Cinco pestañas en la misma pantalla (Hoy, Mes, Caja, Patrimonio y deuda, Seguimiento) que reparten lo
// que hasta ahora solo salía con «Ver todo el detalle». No se retira nada: ese botón sigue enseñándolo todo a la vez.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("cinco áreas, «Hoy» la de entrada, como pestañas accesibles (tablist, tab, tabpanel y flechas)", () => {
  const js = read("views/hoy-v2.js");
  assert.match(js, /const HOY_V2_AREAS = Object\.freeze\(\[\n {2}\{ id: "hoy", label: "Hoy" \},\n {2}\{ id: "mes", label: "Mes" \},\n {2}\{ id: "caja", label: "Caja" \},\n {2}\{ id: "patrimonio", label: "Patrimonio y deuda" \},\n {2}\{ id: "seguimiento", label: "Seguimiento" \},\n\]\);/);
  assert.match(js, /role="tablist" aria-label="Áreas de Hoy"/);
  assert.match(js, /role="tab" class="e19-registrar-tab\$\{sel \? " is-active" : ""\}" id="hoyV2Tab-\$\{area\.id\}" aria-selected="\$\{sel\}" aria-controls="hoyV2Panel" tabindex="\$\{sel \? "0" : "-1"\}"/);
  assert.match(js, /id="hoyV2Panel" role="tabpanel" aria-labelledby="hoyV2Tab-\$\{area\}"/);
  assert.match(js, /\["ArrowRight", "ArrowLeft", "Home", "End"\]/, "flechas, Inicio y Fin");
  // El área dura lo que la pestaña del navegador y se lee con try/catch: sin almacenamiento, se entra por «Hoy».
  assert.match(js, /sessionStorage\.getItem\(HOY_V2_AREA_CLAVE\) \|\| "hoy"/);
  assert.match(js, /\} catch \{\n {4}area = "hoy";/);
  // Cambiar de área no cuenta como la primera acción de la visita (XGO-02).
  const clic = js.indexOf('const areaBoton = event.target.closest("[data-hoy-v2-area]");');
  assert.ok(clic > 0 && clic < js.indexOf('const detalle = event.target.closest("[data-hoy-v2-detail]");'));
});

test("«Hoy» sigue con su cifra, su gráfico y su columna, y lleva al detalle del mes y a Patrimonio y deuda", () => {
  const js = read("views/hoy-v2.js");
  const hoy = js.slice(js.indexOf("function hoyV2AreaPanel("), js.indexOf("function hoyV2AplicarArea("));
  assert.match(hoy, /hoyV2Hero\(\{ \.\.\.model, asOf, hoy, coverage \}\)/);
  assert.match(hoy, /hoyV2Month\(hoy, model\.plannedSaving, true\)/);
  assert.match(hoy, /hoyV2Patrimonio\(model\.debtOutlook, true\)/);
  assert.match(js, /data-hoy-v2-area="mes">Detalle del mes ›<\/button>/);
  assert.match(js, /data-hoy-v2-area="patrimonio">Patrimonio y deuda ›<\/button>/);
  // Mes: la barra del mes y las tres partidas que más se desvían (las de Cierre), sin cálculo nuevo.
  assert.match(js, /cierreV2Desvios\(monthKey\)/);
  assert.match(js, /data-hoy-v2-plan-mes>Abrir Plan › Mes<\/button>/);
});

test("cada área enseña sus bloques de la Hoy de siempre, y «Ver todo el detalle» sigue enseñándolo todo", () => {
  const css = read("tema-v2.css");
  // La regla de siempre deja de aplicarse en un área; las de área, con la misma condición :has (si la v2 no carga, se ve todo).
  assert.match(css, /#home:has\(> #hoyV2:not\(\[hidden\]\)\):not\(\.hoy-v2-detalle\):not\(\.hoy-v2-area-clasica\) > :not\(#hoyV2\)/);
  for (const [area, bloque] of [["mes", "#homeMonthGlance"], ["caja", "#e6CoveragePanel"], ["patrimonio", "#homeKpis"], ["seguimiento", ".home-main-panel"]]) {
    assert.ok(css.includes(`#home.hoy-v2-area-${area}:has(> #hoyV2:not([hidden])):not(.hoy-v2-detalle)`), area);
    assert.ok(css.includes(`:not(${bloque})`), `${area}: ${bloque}`);
  }
  // .home-context-layout también es .home-layout: las reglas de Mes y Caja nombran la de .home-primary-section.
  assert.match(css, /> \.home-primary-section > \.home-layout > :not\(#e6CoveragePanel\)/);
  const js = read("views/hoy-v2.js");
  assert.match(js, /home\.classList\.toggle\("hoy-v2-area-clasica", area !== "hoy"\);/);
});

test("«Decisiones abiertas» en el móvil: una columna (la de 34 px era para el número, que estas filas no llevan)", () => {
  const styles = read("styles.css");
  assert.match(styles, /\.unified-action\.home-decision-open \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
});

test("versiones y Novedades", () => {
  const html = read("index.html");
  assert.match(html, /views\/hoy-v2\.js\?v=(?:20261121areas|20261122und|20261123duo04|20261124duod1|20261124dn39)/, "views/hoy-v2.js");
  for (const file of ["tema-v2.css", "styles.css"]) assert.match(html, new RegExp(`${file.replace(".", "\\.")}\\?v=2026112(?:1(?:areas|d658)|2und)`), file); // a «d658» con lo que traía #658
  assert.match(html, /novedades\.js\?v=2026112(?:1(?:areas|dn27|dn28)|2und|5dn40)/, "novedades.js siguió a 20261121dn27 con D-N23 y D-N27");
  assert.match(read("novedades.js"), /id: "2026-11-21-hoy-por-areas"/);
});

test("a 195 px, la etiqueta de cada cifra de Patrimonio y deuda baja bajo su título (el CI recorre cada área)", () => {
  const styles = read("styles.css");
  const bloque = styles.slice(styles.indexOf("/* DEC-38 · paso 3, tandas 3 a 5"));
  assert.match(bloque, /main \.e19-kpi-head \{\n {4}flex-wrap: wrap;/);
  assert.match(bloque, /main \.e19-kpi-head > \.e19-kpi-badge \{\n {4}max-width: 100%;\n {4}white-space: normal;/);
  assert.match(bloque, /main \.home-health-score-item \{\n {4}flex-wrap: wrap;/, "y cada fila de la salud financiera");
  assert.match(bloque, /main \.p2-item,\n {2}main \.p2-item :is\(h4, p\) \{\n {4}min-width: 0;\n {4}overflow-wrap: anywhere;/, "y el seguimiento predictivo de Caja");
});
