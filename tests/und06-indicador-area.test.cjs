// UND-06 (undécima auditoría; 22/11/2026, activo desde el 7/12): un indicador en la pestaña del área de Hoy que tiene algo, para que
// esconder no sea olvidar. Mes: partidas por encima de lo previsto (rojo); Caja: un punto rojo con avisos de la previsión a 30 días;
// Seguimiento: decisiones abiertas (sin rojo). Se prueban las funciones de views/hoy-v2.js con dobles de lo que leen.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const js = read("views/hoy-v2.js");

function trozo(nombre) {
  const inicio = js.indexOf(`function ${nombre}(`);
  assert.ok(inicio >= 0, nombre);
  const fin = js.indexOf("\n}\n", inicio);
  return js.slice(inicio, fin + 2);
}

// Las funciones, en un ámbito con los dobles: el plan del mes, los avisos de la previsión y escapeHtml.
function cargar({ expense = [], alerts = [], entrada = {} } = {}) {
  const cuerpo = `
    const HOY_V2_INDICADORES_DESDE = ${JSON.stringify(js.match(/const HOY_V2_INDICADORES_DESDE = "([^"]+)";/)[1])};
    const HOY_V2_AVISO_TITULO = { suelo: "s", cuenta: "c", colchon: "k" };
    const cuadroMandosAllMonths = () => [{ key: "2026-12" }];
    const planMesCollect = () => ({ expense: ${JSON.stringify(expense)} });
    const hoyV2AvisosEntrada = () => (${JSON.stringify(entrada)});
    const globalThis = { FinanceCanonicalForecastAlerts: { evaluate: () => ({ alerts: ${JSON.stringify(alerts)} }) } };
    const isoLocalDate = (d) => d.toISOString().slice(0, 10);
    const escapeHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    ${trozo("hoyV2IndicadoresDe")}
    ${trozo("hoyV2InsigniaHtml")}
    return { hoyV2IndicadoresDe, hoyV2InsigniaHtml };`;
  return new Function(cuerpo)();
}

test("UND-06 · antes del 7/12 no hay indicadores (la revisión de las áreas de UND-23 se mide sin ellos)", () => {
  const f = cargar({ expense: [{ hasActual: true, variance: 50 }] });
  assert.match(js, /const HOY_V2_INDICADORES_DESDE = "2026-11-24";/);
  assert.deepEqual(f.hoyV2IndicadoresDe({ decisions: [{}, {}] }, "2026-11-23"), {});
  assert.ok(f.hoyV2IndicadoresDe({ decisions: [{}, {}] }, "2026-11-24").seguimiento);
});

test("UND-06 · Mes: las partidas de gasto por encima de lo previsto, en rojo; lo que sobra no cuenta", () => {
  const f = cargar({ expense: [{ hasActual: true, variance: 50 }, { hasActual: true, variance: 0.4 }, { hasActual: true, variance: -80 }, { hasActual: false, variance: 30 }, { hasActual: true, variance: 12 }] });
  const r = f.hoyV2IndicadoresDe({}, "2026-12-10");
  assert.deepEqual(r.mes, { n: 2, rojo: true, texto: "2 partidas por encima de lo previsto" });
  assert.equal(cargar().hoyV2IndicadoresDe({}, "2026-12-10").mes, undefined, "sin partidas pasadas, sin indicador");
});

test("UND-06 · Caja: un punto rojo con avisos de la previsión en los próximos 30 días; los de más lejos o sin día, no", () => {
  const f = cargar({ alerts: [{ id: "suelo", date: "2026-12-20" }, { id: "colchon", date: "2027-01-30" }, { id: "fin-de-ano", date: "2026-12-31" }, { id: "cuenta" }] });
  assert.deepEqual(f.hoyV2IndicadoresDe({}, "2026-12-10").caja, { n: 1, punto: true, rojo: true, texto: "un aviso de caja en los próximos 30 días" });
  const sinEntrada = cargar({ alerts: [{ id: "suelo", date: "2026-12-20" }], entrada: null });
  assert.equal(sinEntrada.hoyV2IndicadoresDe({}, "2026-12-10").caja, undefined, "sin previsión, sin indicador");
});

test("UND-06 · Seguimiento: las decisiones abiertas, sin rojo; y la insignia dice su texto al lector de pantalla", () => {
  const f = cargar();
  const r = f.hoyV2IndicadoresDe({ decisions: [{}, {}, {}] }, "2026-12-10");
  assert.deepEqual(r.seguimiento, { n: 3, rojo: false, texto: "3 decisiones abiertas" });
  assert.equal(f.hoyV2InsigniaHtml(r.seguimiento), `<span class="hoy-v2-insignia" aria-hidden="true">3</span><span class="sr-only">, 3 decisiones abiertas</span>`);
  assert.equal(f.hoyV2InsigniaHtml({ n: 1, punto: true, rojo: true, texto: "un aviso" }), `<span class="hoy-v2-insignia is-rojo is-punto" aria-hidden="true"></span><span class="sr-only">, un aviso</span>`);
  assert.equal(f.hoyV2InsigniaHtml(undefined), "");
});

test("UND-06 · en la pestaña, medido al abrir un área con indicador, con su CSS y sus versiones", () => {
  assert.match(js, /data-hoy-v2-area="\$\{area\.id\}">\$\{escapeHtml\(area\.label\)\}\$\{hoyV2InsigniaHtml\(indicadores\[area\.id\]\)\}<\/button>/);
  assert.match(js, /hoyV2Indicadores = hoyV2IndicadoresDe\(model, hoy\);/);
  assert.match(js, /if \(hoyV2Indicadores\[area\] && area !== hoyV2AreaActual\(\)\) globalThis\.FinanceMedidor\?\.anotar\("hoy-indicador", "accion"\);/);
  assert.match(read("medidor-utilidad.js"), /\{ id: "hoy-indicador", nombre: "Hoy · áreas abiertas con indicador"/);
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.hoy-v2-insignia\.is-punto \{\s*min-width: 8px;\s*width: 8px;\s*height: 8px;/);
  assert.match(css, /:root\[data-tema="v2"\] \.hoy-v2-insignia\.is-rojo \{[^}]*color: var\(--e19-surface\);/);
  const html = read("index.html");
  assert.match(html, /views\/hoy-v2\.js\?v=(?:20261122und0[68]|20261123duo04|20261124duod1|20261124dn39)/);
  assert.match(html, /tema-v2\.css\?v=(?:20261122und0[68]|20261125tred1|20261125tred2|20261125tre3c|20261125tred4|20261125tred4b|20261125tred5|20261126tred5b|20261126tred5c|20261126r1a)/);
});
