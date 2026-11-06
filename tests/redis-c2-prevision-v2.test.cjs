const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Rediseño C2 · Plan › Previsión (views/prevision-v2.js), ampliado por FX-10 (BACKLOG_NOVIEMBRE_OLEADA_1.md). La pantalla no
// calcula nada nuevo: lee el motor diario (el mismo de Hoy), el suelo de Hoy y de la banda y el contrato de cifras.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const vista = read("views/prevision-v2.js");
const html = read("index.html");
const css = read("tema-v2.css");

test("C2 · se carga con defer antes de app.js, está en el service worker y en el sitio público", () => {
  const at = html.indexOf('<script defer src="views/prevision-v2.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'));
  assert.match(read("service-worker.js"), /"\.\/views\/prevision-v2\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/prevision-v2\.js",/);
  assert.match(html, /<div class="prev-v2" id="planPrevisionV2" hidden><\/div>/);
  assert.match(read("app.js"), /globalThis\.previsionV2Render\?\.\(\); \/\/ rediseño C2/);
});

test("C2 · lee la misma trayectoria, suelo y redondeo que Hoy (FX-01): motor diario, normalizeFloor y el contrato", () => {
  assert.match(vista, /canonicalDailyEngineRuns\.active\?\.rows/);
  assert.match(vista, /FinanceCanonicalHomeMargin\?\.normalizeFloor\(state\?\.liquidityFloor\)/);
  assert.match(vista, /contract\.lowPoint\(tramo, \{\}\)/);
  assert.match(vista, /contract\.describeLow\(low/);
  assert.match(vista, /kit\.forecastPlotHtml\(/, "el gráfico único de FX-11");
  assert.doesNotMatch(vista, /money\([^)]*, true\)/, "FX-04: sin céntimos");
});

test("C2 · horizontes de la referencia (D-N2): 3 m, 12 m, 24 m y hasta 2036; el día más bajo siempre entra en la serie", () => {
  assert.deepEqual([...vista.matchAll(/id: "(3m|12m|24m|full)", label: "([^"]+)"/g)].map((m) => m[2]), ["3 m", "12 m", "24 m", "Hasta 2036"]);
  assert.match(vista, /row\.date === low\?\.date/);
});

test("C2 · lo de siempre sigue entero tras «Ver todo el detalle» y solo se oculta si la v2 se ha pintado", () => {
  assert.match(vista, /data-prevision-v2-detalle/);
  assert.match(css, /\.e19-plan-prevision\.prevision-v2-on > \.plan-prevision-table-wrap,/, "solo la tabla de meses y sus anexos");
  assert.doesNotMatch(css, /prevision-v2-on > :not\(#planPrevisionV2\)/, "el plan B, el puente y el mapa de pagos no se esconden");
  assert.match(css, /:root\[data-tema="v2"\] #plan:has\(\.prevision-v2-on\) #planHeaderHorizon/);
  assert.match(vista, /panel\.classList\.remove\("prevision-v2-on"\)/);
});

test("C2 · se mide (XGO-02) y está en Funciones en prueba como parte del diseño nuevo", () => {
  assert.ok(require("../medidor-utilidad.js").FUNCIONES.some((f) => f.id === "prevision-v2"));
  const entrada = require("../funciones-en-prueba.js").CATALOGO.find((f) => f.id === "prevision-v2");
  assert.equal(entrada?.parteDe, "tema-v2");
  ["vista", "accion", "descarte"].forEach((evento) => assert.match(vista, new RegExp(`anotar\\("prevision-v2", "${evento}"\\)`)));
});
