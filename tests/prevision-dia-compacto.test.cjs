// 11/11/2026 · el panel del día de Plan › Previsión, más compacto (decisión del hogar: a 1440 px el panel y el gráfico estaban a unos
// píxeles del límite de 900). Como la referencia (PrevisionDesktop.png): una línea por movimiento y, debajo, solo en el pago de día
// estimado, «día estimado · ¿sabes el día?». Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function vista() {
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: () => null, setItem() {} },
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    state: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("views/prevision-v2.js"), sandbox);
  return sandbox;
}

test("Panel del día · una línea por movimiento; solo el pago de día estimado lleva «día estimado · ¿sabes el día?»", () => {
  const v = vista();
  const item = (event) => v.previsionV2DiaItemHtml({ kind: "outflow", field: "fixedCoreSpend", label: "Seguro INVENTADO", amount: 310, ...event });
  assert.equal(item({ confidence: "observed" }), '<li class="prev-v2-dia-item"><span class="prev-v2-dia-que">Seguro INVENTADO</span><strong class="prev-v2-dia-importe">−310 €</strong></li>');
  assert.doesNotMatch(item({ confidence: "rule" }), /<small>/, "el día por regla, sin línea pequeña");
  assert.doesNotMatch(item({ confidence: "declared" }), /<small>/, "el día indicado, sin línea pequeña");
  assert.match(item({ confidence: "estimated" }), /<small>día estimado · <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas" aria-label="¿Sabes el día de Seguro INVENTADO\?">¿sabes el día\?<\/button><\/small>/);
  assert.doesNotMatch(item({ field: "variableOperationalSpend", label: "Gasto variable estimado", confidence: "estimated" }), /<small>|<button/, "el gasto variable no tiene día de cargo ni pregunta");
  assert.match(v.previsionV2DiaItemHtml({ kind: "income", label: "Nómina INVENTADA", amount: 2000, confidence: "rule" }), /<strong class="prev-v2-dia-importe is-pos">\+2\.000 €<\/strong>/);
  assert.match(v.previsionV2DiaItemHtml({ kind: "transfer", label: "Traspaso INVENTADO", amount: 300 }), /entre vuestras cuentas: no cambia el total/);
});

test("Panel del día · «¿sabes el día?» a 24 px, el mínimo AA, y no a los 32 px del enlace de siempre", () => {
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.prev-v2-dia-que small \.hoy-v2-link \{\s*min-height: 24px;\s*\}/);
});
