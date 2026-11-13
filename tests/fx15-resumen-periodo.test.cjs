// FX-15 · el resumen por periodo de Previsión como cascada de la liquidez (periodo-ui.js). Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function cargar(extra = {}) {
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (value) => `${Math.round(Number(value || 0)).toLocaleString("es-ES", { useGrouping: "always" })} €`,
    analisisCascadaHtml: ({ rows, resultado }) => `${rows.map((row) => `<div data-paso="${row.label}">${row.value}</div>`).join("")}<div data-resultado>${resultado}</div>`,
    isoLocalDate: () => "2026-11-12",
    FinanceCanonicalForecastContract: require("../canonical-forecast-contract.js"),
    ...extra,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("periodo-ui.js"), context);
  return context;
}

const resumen = (cambios = {}) => ({
  start: 10080, end: 13020, income: 12400, gastos: 8500, deuda: 960, ahorro: 1420, savingsEnd: 6420,
  firstLabel: "nov 26", lastLabel: "dic 26", endDate: "2026-12-31", min: 6600, minMonthLabel: "dic 26", ...cambios,
});

test("FX-15 · la cascada cuadra: al acabar = al empezar + ingresos − gastos − deuda, también redondeada", () => {
  const ctx = cargar();
  for (const paso of [10, 100, 1000]) {
    const { inicio, fin, pasos } = ctx.periodoPasos(resumen(), paso);
    assert.equal(fin - inicio, pasos.reduce((sum, item) => sum + item.value, 0), `paso ${paso}`);
    assert.ok(pasos.every((item) => item.value % paso === 0), "sin céntimos y al paso");
  }
  // A 49 días (31/12 desde el 12/11), a la centena (FX-04).
  assert.equal(ctx.periodoPaso(resumen()), 100);
  assert.equal(ctx.periodoPaso(resumen({ endDate: "2027-12-31" })), 1000);
});

test("FX-15 · lo que no encaja sale como «Otros movimientos», y el ahorro no es un paso", () => {
  const ctx = cargar();
  const { pasos } = ctx.periodoPasos(resumen({ end: 12520 }), 10);
  assert.equal(JSON.stringify(pasos.map((item) => item.label)), JSON.stringify(["Ingresos", "Gastos", "Deuda", "Otros movimientos"]));
  assert.equal(pasos.at(-1).value, -500);
  assert.ok(!ctx.periodoPasos(resumen(), 10).pasos.some((item) => /Ahorro/.test(item.label)));
});

test("FX-15 · la frase, los dos saldos, el ahorro aparte y lo más bajo del periodo", () => {
  const html = cargar().periodoResumenHtml(resumen(), "unos 6.600 €");
  assert.match(html, /La liquidez sube unos 2\.900 €: de 10\.100 € a 13\.000 €\./);
  assert.match(html, /Liquidez al empezar nov 26<\/span><strong>10\.100 €/);
  assert.match(html, /Liquidez al acabar dic 26<\/span><strong>13\.000 €/);
  assert.match(html, /pasan unos 1\.400 € de la cuenta corriente al ahorro: no salen de vuestro dinero, así que no restan\. Al acabar, 6\.400 € están en el ahorro\./);
  assert.match(html, /Lo más bajo del periodo: <strong class="">unos 6\.600 €<\/strong>/);
  assert.match(html, /data-resultado>2900</);
  const baja = cargar().periodoResumenHtml(resumen({ end: 9000 }), "unos 6.600 €");
  assert.match(baja, /La liquidez baja unos 1\.100 €: de 10\.100 € a 9\.000 €\./);
});

test("FX-15 · Previsión lo usa, la tabla mensual lleva neto y saldo final y el script está registrado", () => {
  const { codigoApp } = require("./helpers/codigo-app.cjs");
  const app = codigoApp();
  assert.match(app, /bodyEl\.innerHTML = periodoResumenHtml\(summary, previsionLowText\(summary\)\);/);
  assert.match(app, /<th>Neto<\/th><th>Saldo final<\/th>/);
  assert.match(app, /prevision-fila-detalle/);
  assert.match(read("index.html"), /<script defer src="periodo-ui\.js\?v=/);
  assert.match(read("service-worker.js"), /"\.\/periodo-ui\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"periodo-ui\.js"/);
});
