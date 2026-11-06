const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Kit = require("../chart-kit.js");

// FX-11 (BACKLOG_NOVIEMBRE_OLEADA_1.md §5.1; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §6): el gráfico de previsión único del
// kit de gráficos (WP-28). Lo usarán Previsión (C2), Escenarios y Hoy. Real hasta hoy, plan desde hoy, rango, suelo, costura,
// hitos y hasta dos escenarios superpuestos; etiquetas en HTML superpuesto, nunca dentro del SVG estirado.

const root = path.resolve(__dirname, "..");
const pts = Array.from({ length: 10 }, (_, i) => ({
  label: `d${i}`,
  plan: 1000 + i * 100,
  real: i <= 3 ? 1000 + i * 90 : null,
  low: i >= 3 ? 800 + i * 100 : null,
  high: i >= 3 ? 1200 + i * 100 : null,
}));
const fmt = (n) => `${Math.round(n)} €`;

test("FX-11 · sin puntos no pinta nada y no rompe", () => {
  assert.deepEqual(Kit.forecastPlotHtml({ points: [], ariaLabel: "x" }), { svg: "", overlayHtml: "", xs: [], ticks: [] });
});

test("FX-11 · lo real llega hasta hoy y el plan sale de hoy; la marca de hoy y la costura van en su sitio", () => {
  const r = Kit.forecastPlotHtml({ points: pts, ariaLabel: "Previsión", todayIndex: 3, seamIndex: 7, format: fmt });
  const real = r.svg.match(/<polyline class="ck-real" points="([^"]+)"/)[1].split(" ");
  const plan = r.svg.match(/<polyline class="ck-centro ck-plan" points="([^"]+)"/)[1].split(" ");
  assert.equal(real.length, 4, "días 0 a 3");
  assert.equal(plan.length, 7, "días 3 a 9");
  assert.equal(real.at(-1).split(",")[0], plan[0].split(",")[0], "se tocan en hoy");
  assert.match(r.svg, /class="ck-hoy" x1="33\.33"/);
  assert.match(r.svg, /class="ck-costura" x1="77\.78"/);
  assert.match(r.overlayHtml, /class="ck-hoy-etiqueta"[^>]*>hoy</);
  assert.equal(r.xs.length, 10);
  assert.doesNotMatch(r.svg, /<text/, "ninguna etiqueta dentro del SVG: se deformaría");
});

test("FX-11 · el rango solo donde hay bajo y alto, y el suelo entra en la escala con su etiqueta", () => {
  const r = Kit.forecastPlotHtml({ points: pts, ariaLabel: "x", threshold: { value: 0, label: "suelo" }, format: fmt });
  const band = r.svg.match(/<polygon class="ck-banda" points="([^"]+)"/)[1].split(" ");
  assert.equal(band.length, 14, "7 días con rango, ida y vuelta");
  const y = Number(r.svg.match(/class="ck-umbral" x1="0" x2="100" y1="([\d.]+)"/)[1]);
  assert.ok(y > 0 && y < 100, "el suelo se ve aunque esté lejos de la línea");
  assert.match(r.overlayHtml, /class="ck-umbral-etiqueta"[^>]*>suelo 0 €</);
});

test("FX-11 · hasta dos escenarios, discontinuos y con su nombre al final de la línea; el tercero no se pinta", () => {
  const sc = (name, d) => ({ name, values: pts.map((p, i) => (i < 3 ? null : p.plan - d)) });
  const r = Kit.forecastPlotHtml({ points: pts, ariaLabel: "x", scenarios: [sc("Euribor +1", 100), sc("Un sueldo menos", 300), sc("Tercero", 500)] });
  assert.equal((r.svg.match(/class="ck-escenario ck-escenario-/g) || []).length, 2);
  assert.match(r.overlayHtml, /ck-escenario-etiqueta ck-escenario-1" style="left:100%[^"]*">Euribor \+1</);
  assert.match(r.overlayHtml, />Un sueldo menos</);
  assert.doesNotMatch(r.overlayHtml + r.svg, /Tercero/);
});

test("FX-11 · el eje Y lleva marcas redondas dentro del dibujo, y los hitos fuera de rango no se pintan", () => {
  const r = Kit.forecastPlotHtml({ points: pts, ariaLabel: "x", markers: [{ index: 4, label: "Cobro 8 dic" }, { index: 40, label: "fuera" }], format: fmt });
  assert.ok(r.ticks.length >= 2);
  r.ticks.forEach((tick) => {
    assert.ok(tick.y >= 0 && tick.y <= 100);
    assert.equal(tick.value % 100, 0, `${tick.value} es una cifra limpia`);
  });
  assert.equal((r.overlayHtml.match(/class="ck-hito"/g) || []).length, 1);
  assert.match(r.overlayHtml, /<span class="sr-only">Cobro 8 dic<\/span>/);
});

test("FX-11 · los estilos distinguen plan, real y escenario por la forma, y tienen versión para colores forzados", () => {
  const css = fs.readFileSync(path.join(root, "chart-kit.css"), "utf8");
  assert.match(css, /\.ck-escenario \{[^}]*stroke-dasharray/);
  assert.match(css, /\.ck-real \{[^}]*stroke: var\(--e19-ink\)/);
  assert.match(css, /\.ck-prevision \.ck-plan \{[^}]*stroke: var\(--e19-forecast\)/);
  assert.match(fs.readFileSync(path.join(root, "tema-v2.css"), "utf8"), /--e19-forecast: var\(--blue\)/, "azul = previsto en el tema v2");
  assert.match(css, /forced-colors: active[\s\S]*\.ck-escenario/);
});
