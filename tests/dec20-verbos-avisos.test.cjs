// DEC-20 (18/11/2026): «Decidir esta semana» con verbos concretos. Cada aviso de Ajustes › Alertas lleva su verbo y su destino
// (nunca «Revisar alerta» al Centro de alertas, una pantalla de «Versiones anteriores») y no se presenta con fecha límite: la de
// la regla es cuándo revisarla, no un plazo para decidir.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const app = codigoApp();
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const hoy = fs.readFileSync(path.join(__dirname, "..", "views", "hoy-v2.js"), "utf8");

function bloque(source, inicio) {
  const start = source.indexOf(inicio);
  assert.ok(start >= 0, inicio);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(source.indexOf("{", start), i + 1);
  }
  throw new Error(inicio);
}

const destinos = Function(`return (${bloque(app, "const UX_ALERT_DESTINOS = {")});`)();
const metricas = [...bloque(app, "const UX_ALERT_METRICS = {").matchAll(/^\s{2}(\w+): \{ label:/gm)].map((m) => m[1]);

test("DEC-20 · cada indicador de las alertas tiene su verbo y su destino; ninguno es el Centro de alertas", () => {
  assert.ok(metricas.length >= 8);
  assert.deepEqual(Object.keys(destinos).sort(), [...metricas].sort());
  Object.entries(destinos).forEach(([metrica, d]) => {
    assert.notEqual(d.target, "alerts-center", metrica);
    assert.match(d.cta, /^(Ver|Rebalancear|Revisar las) /, metrica);
    assert.notEqual(d.cta, "Revisar alerta");
    assert.match(html, new RegExp(`class="[^"]*view-section[^"]*" id="${d.target}"|id="${d.target}"[^>]*view-section`), `${metrica}: «${d.target}» es una pantalla`);
  });
  assert.deepEqual(Object.entries(destinos).filter(([, d]) => d.verPrevision).map(([m]) => m).sort(), ["caixaBalance", "freeCapacity", "minimumCash12m", "minimumCashMonths"]);
});

test("DEC-20 · los avisos van sin fecha límite y, si el indicador no se conoce, a su regla con un verbo", () => {
  assert.doesNotMatch(app, /cta: "Revisar alerta"/);
  assert.match(app, /const destino = UX_ALERT_DESTINOS\[alert\.metric\] \|\| \{ target: "alerts-center", cta: "Ver la regla del aviso" \};/);
  assert.match(app, /undated\.push\(\{ title: alert\.name, text: alert\.action, status: alert\.overdue \? "danger" : "warn", \.\.\.destino, expiresAt: "" \}\);/);
});

test("DEC-20 · en Hoy (tema nuevo) los de caja abren Plan › Previsión con el mismo botón que los avisos de previsión", () => {
  assert.match(hoy, /: item\.verPrevision\s+\? `<button type="button" class="e19-btn e19-btn-secondary" data-hoy-v2-a-prevision>/);
  assert.match(hoy, /event\.target\.closest\("\[data-hoy-v2-prevision\], \[data-hoy-v2-a-prevision\]"\)/);
});
