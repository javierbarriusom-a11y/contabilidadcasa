const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-10 (NPV-08): medidor de calidad de los datos de la previsión en Plan › Previsión (no en Hoy). Tres
// barras ponderadas por importe —fechas conocidas del gasto, gasto del mes con real, ingresos del mes
// confirmados— cada una con lo que hay que hacer para subirla. Sin filas, «sin datos», nunca 0 %.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const quality = require("../canonical-forecast-quality.js");

test("fechas: porcentaje del gasto con día conocido, ponderado por importe", () => {
  const result = quality.dateQuality([
    { amount: 600, confidence: "rule" },
    { amount: 200, confidence: "observed" },
    { amount: 100, confidence: "declared" },
    { amount: 1100, confidence: "estimated" },
  ]);
  assert.equal(result.value, 45);
  assert.deepEqual(result.parts, { declared: 5, observed: 10, rule: 30, estimated: 55 });
  assert.equal(result.meets, false);
  assert.equal(result.count, 4);
  assert.equal(quality.dateQuality([{ amount: 700, confidence: "rule" }, { amount: 300, confidence: "estimated" }]).meets, true, "70 % cumple el objetivo");
});

test("fechas: confianza desconocida cuenta como estimada; importes negativos o cero, por su valor absoluto o fuera", () => {
  const result = quality.dateQuality([{ amount: -50, confidence: "observed" }, { amount: 50, confidence: "otra" }, { amount: 0, confidence: "rule" }, { confidence: "rule" }]);
  assert.equal(result.value, 50);
  assert.equal(result.count, 2);
});

test("sin filas, «sin datos»: valor nulo, nunca 0 %", () => {
  const empty = quality.measure({});
  assert.equal(empty.dates.value, null);
  assert.equal(empty.dates.meets, null);
  assert.equal(empty.amounts.value, null);
  assert.equal(empty.income.value, null);
  const html = quality.renderHtml(empty);
  assert.doesNotMatch(html, /0 %/);
  assert.match(html, /Sin datos/);
  assert.match(html, /No hay gasto previsto este mes\./);
  assert.equal(quality.summaryText(empty), "Calidad de los datos: sin gasto previsto en este horizonte");
});

test("importes e ingresos del mes: con real o cancelado ya está resuelto; pendiente, no", () => {
  const result = quality.settledQuality([
    { planned: 300, status: "realized" },
    { planned: 100, status: "cancelled" },
    { planned: 600, status: "pending" },
    { planned: 0, status: "pending" },
  ]);
  assert.deepEqual(result, { value: 40, count: 3, settledCount: 2 });
});

test("redondeo al entero más cercano", () => {
  assert.equal(quality.dateQuality([{ amount: 1, confidence: "rule" }, { amount: 2, confidence: "estimated" }]).value, 33);
  assert.equal(quality.dateQuality([{ amount: 2, confidence: "rule" }, { amount: 1, confidence: "estimated" }]).value, 67);
});

test("la tarjeta: texto e icono de estado (no solo color), acción para subir cada barra y sin importes", () => {
  const html = quality.renderHtml(quality.measure({
    monthKey: "2026-10",
    dates: [{ amount: 8123.45, confidence: "rule" }, { amount: 4321, confidence: "estimated" }],
    amounts: [{ planned: 8123.45, status: "realized" }, { planned: 4321, status: "pending" }],
    income: [{ planned: 5000, status: "pending" }],
  }));
  assert.doesNotMatch(html, /8123|4321|5000/);
  assert.match(html, /<strong>Fechas de los gastos<\/strong><span class="panel-uso-valor">65 %<\/span>/);
  assert.match(html, /<span class="status-pill warn">Por debajo<\/span> Objetivo: ≥ 70 % del gasto con día conocido\. Por regla de la casa 65 % · estimado \(día 8\) 35 %\./);
  assert.match(html, /<meter min="0" max="100" low="70" high="99" optimum="100" value="65" aria-hidden="true"><\/meter>/);
  assert.match(html, /Gastos de octubre con real<\/strong><span class="panel-uso-valor">65 %/);
  assert.match(html, /1 de 2 partidas de octubre\./);
  assert.match(html, /Ingresos de octubre confirmados<\/strong><span class="panel-uso-valor">0 %/, "0 % con datos es un dato, no un vacío");
  assert.match(html, /Para subirla: <a href="#registrar">confirmar los cobros del mes en Registrar\.<\/a>/);
  assert.match(html, /indicar el día de cargo de cada partida/);
});

// --- app.js: recoge las filas del mismo motor que la tabla --------------------------------------

function extractFunction(name) {
  const app = read("app.js");
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
}

test("app.js: fechas del mismo desglose que el panel día a día, mes a mes del horizonte; importes e ingresos del primer mes abierto, sin las borradas", () => {
  const context = {
    modelStartDate: () => new Date(2026, 9, 1),
    addMonths: (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1),
    planningMonthForDate: (date) => ({ key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` }),
    planningSectionsForMonth: (kind) => (kind === "expense"
      ? [{ name: "Hogar", rows: [{ id: "luz" }, { id: "borrada" }] }]
      : [{ name: "Ingresos", rows: [{ id: "nomina" }] }]),
    isPlanningRowDeleted: (row) => row.id === "borrada",
    forwardPlanningInfo: (row) => ({ luz: { planned: 80, status: "realized" }, nomina: { planned: 3000, status: "pending" } })[row.id],
    planningBreakdownForForecastMonth: (index) => ({ expenseEvents: [[{ amount: 80, confidence: "observed" }], [{ amount: 90, confidence: "estimated" }]][index] }),
  };
  vm.runInNewContext(`${extractFunction("forecastQualityInput")}\nresult = forecastQualityInput(items);`, Object.assign(context, {
    items: [
      { index: 0, row: {} },
      { index: 1, row: {} },
    ],
  }));
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    monthKey: "2026-10",
    dates: [{ amount: 80, confidence: "observed" }, { amount: 90, confidence: "estimated" }],
    amounts: [{ planned: 80, status: "realized" }],
    income: [{ planned: 3000, status: "pending" }],
  });
});

test("registro: Plan › Previsión (no Hoy), plegado en la cabecera; motor antes de app.js y en la caché offline", () => {
  const html = read("index.html");
  const prevision = html.slice(html.indexOf('id="prevision"'), html.indexOf('id="previsionPeriodSummaryCard"'));
  assert.match(prevision, /<details class="e19-card prevision-calidad-card" id="previsionCalidadCard">\s*<summary id="previsionCalidadResumen">/);
  const home = html.slice(html.indexOf('id="home"'), html.indexOf('id="home"') + 20000);
  assert.doesNotMatch(home, /previsionCalidad/);
  const at = html.indexOf('<script defer src="canonical-forecast-quality.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-forecast-quality\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-forecast-quality\.js",/);
  assert.match(read("app.js"), /renderPrevisionReliabilityBadge\(\);\n\s+renderPrevisionQuality\(items\);/);
});
