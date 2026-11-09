// FX-12 (9/11/2026) · «Lo que viene en 90 días»: los hitos por semanas, desde un umbral que se elige (150 € por defecto), sin traspasos
// ni el gasto variable, con «¿sabes el día?» en los pagos de día estimado; y los mismos hitos como marcas del gráfico. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const Kit = require("../chart-kit.js");
const Contract = require("../canonical-forecast-contract.js");

function vista(guardado = null) {
  const almacen = new Map(guardado === null ? [] : [["prevision-v2-umbral", String(guardado)]]);
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) },
    isoLocalDate: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    FinanceCanonicalForecastContract: Contract,
    state: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("views/prevision-v2.js"), sandbox);
  return sandbox;
}

const hoy = "2026-11-09";
const fila = (date, events) => ({ date, total: 5000, events });
const tramo = [
  fila("2026-11-09", []),
  fila("2026-11-12", [{ kind: "outflow", field: "fixedCoreSpend", label: "Alquiler INVENTADO", amount: 800, confidence: "estimated" }, { kind: "outflow", field: "fixedCoreSpend", label: "Luz INVENTADA", amount: 90, confidence: "rule" }]),
  fila("2026-11-20", [{ kind: "income", field: "income", label: "Nómina INVENTADA", amount: 2500, confidence: "rule" }, { kind: "transfer", field: "saving", label: "Traspaso", amount: 600, confidence: "rule" }]),
  fila("2026-11-25", [{ kind: "outflow", field: "variableOperationalSpend", label: "Gasto variable estimado", amount: 1200, confidence: "estimated" }, { kind: "outflow", field: "refi", label: "Préstamo INVENTADO", amount: 180, confidence: "observed" }]),
  fila("2027-03-01", [{ kind: "income", field: "income", label: "Fuera de los 90 días", amount: 9000, confidence: "rule" }]),
];

test("FX-12 · los hitos: desde 150 € por defecto, sin traspasos, sin gasto variable (que se suma aparte) y solo 90 días", () => {
  const v = vista();
  const { hitos, umbral, variable } = v.previsionV2Hitos(tramo, hoy);
  assert.equal(umbral, 150);
  assert.deepEqual(JSON.parse(JSON.stringify(hitos.map((h) => h.label))), ["Alquiler INVENTADO", "Nómina INVENTADA", "Préstamo INVENTADO"]);
  assert.equal(variable, 1200);
  // El umbral elegido se lee de este dispositivo; uno que no es de la lista vuelve al de serie.
  assert.deepEqual(JSON.parse(JSON.stringify(vista(1000).previsionV2Hitos(tramo, hoy).hitos.map((h) => h.label))), ["Nómina INVENTADA"]);
  assert.equal(vista(777).previsionV2Hitos(tramo, hoy).umbral, 150);
});

test("FX-12 · por semanas (de lunes a domingo), con su neto y «¿sabes el día?» solo en los pagos de día estimado", () => {
  const v = vista();
  assert.equal(v.previsionV2Lunes("2026-11-15"), "2026-11-09", "domingo: la semana empezó el lunes");
  assert.equal(v.previsionV2Lunes("2026-11-16"), "2026-11-16");
  assert.equal(v.previsionV2Semana("2026-11-09", hoy), "Esta semana");
  assert.equal(v.previsionV2Semana("2026-11-16", hoy), "La semana que viene");
  assert.match(v.previsionV2Semana("2026-11-23", hoy), /^Semana del 23 nov/);
  const html = v.previsionV2LoQueVieneHtml({ hitos: v.previsionV2Hitos(tramo, hoy), today: hoy });
  assert.match(html, /Lo que viene en 90 días · 1 cobro y 2 pagos desde 150 € · 1 con el día estimado/);
  assert.deepEqual([...html.matchAll(/<p class="prev-v2-viene-semana-titulo"><span>([^<]+)<\/span><strong[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]), [
    ["Esta semana", "−800 €"],
    ["La semana que viene", "+2.500 €"],
    ["Semana del 23 nov", "−180 €"],
  ]);
  assert.equal((html.match(/¿sabes el día\?<\/button>/g) || []).length, 1, "solo el alquiler, de día estimado");
  assert.match(html, /aria-label="¿Sabes el día de Alquiler INVENTADO\?"/);
  assert.match(html, /No incluye el gasto variable \(unos 1\.200 € en estos 90 días\), que no tiene día fijo\./);
  assert.match(html, /data-prevision-v2-umbral="150" aria-pressed="true"/);
  assert.doesNotMatch(html, /Traspaso|Fuera de los 90 días|Luz INVENTADA/);
});

test("FX-12 · las marcas del gráfico son los mismos hitos: una por punto, roja si sale más de lo que entra", () => {
  const v = vista();
  const { hitos } = v.previsionV2Hitos(tramo, hoy);
  const diario = v.previsionV2Marcadores(tramo, hitos, hoy);
  assert.deepEqual(JSON.parse(JSON.stringify(diario.map((m) => [m.index, m.kind]))), [[1, "sale"], [2, "entra"], [3, "sale"]]);
  assert.match(diario[0].label, /^12 nov: Alquiler INVENTADO −800 €$/);
  // En 12 y 24 meses los puntos van por semanas: cada hito cae en el primer punto desde su día.
  const semanal = [fila("2026-11-09", []), fila("2026-11-16", []), fila("2026-11-23", []), fila("2026-11-30", [])];
  assert.deepEqual(JSON.parse(JSON.stringify(v.previsionV2Marcadores(semanal, hitos, hoy).map((m) => [m.index, m.kind]))), [[1, "sale"], [2, "entra"], [3, "sale"]]);
});

test("FX-12 · ChartKit pinta la clase de cada marca (solo letras) y el CSS da el rojo a lo que sale", () => {
  const points = [0, 1, 2].map((i) => ({ label: `d${i}`, plan: 100 + i }));
  const r = Kit.forecastPlotHtml({ points, ariaLabel: "x", markers: [{ index: 0, label: "a", kind: "sale" }, { index: 1, label: "b", kind: "entra" }, { index: 2, label: "c", kind: "x\" onclick=\"y" }] });
  assert.equal((r.overlayHtml.match(/class="ck-hito ck-hito-sale"/g) || []).length, 1);
  assert.equal((r.overlayHtml.match(/class="ck-hito ck-hito-entra"/g) || []).length, 1);
  assert.equal((r.overlayHtml.match(/class="ck-hito"/g) || []).length, 1, "una clase que no es solo letras no entra");
  assert.match(read("chart-kit.css"), /\.ck-hito-sale \{\n  border-color: var\(--e19-danger\);/);
});
