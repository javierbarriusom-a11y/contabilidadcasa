const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const E15 = require("../canonical-e15-goals.js");

// P9 (Horizonte 2): calendario financiero único dentro de la app. financialCalendar() (E15) ya
// unificaba deuda/hipoteca, seguros (SP1), objetivos, revisiones, fiscal (Renta) y aportaciones de
// cartera (IV3) — la única salida era el .ics descargable. Esta tarea añade las dos fuentes que
// faltaban (comisiones de mantenimiento, TT4; supuestos caducados, PVC15) y una vista de solo
// lectura dentro de Ajustes, sin motor nuevo: reutiliza financialCalendar() tal cual.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

const forecast = { series: [
  { monthKey: "2026-09", label: "sep 26", totals: { closingLiquidity: 1400 } },
  { monthKey: "2026-10", label: "oct 26", totals: { closingLiquidity: 1600 } },
  { monthKey: "2026-11", label: "nov 26", totals: { closingLiquidity: 1800 } },
] };

// --- Parte A: financialCalendar() (canonical-e15-goals.js) ------------------------------------

test("financialCalendar · sin maintenanceFeeAlerts/assumptionExpiry, se comporta igual que antes (compatible hacia atrás)", () => {
  const calendar = E15.financialCalendar({ forecast });
  calendar.rows.forEach((row) => {
    assert.equal(row.events.some((event) => event.type === "maintenance-fee"), false);
    assert.equal(row.events.some((event) => event.type === "assumption-expiry"), false);
  });
});

test("financialCalendar · comisiones de mantenimiento en riesgo aparecen solo en el primer mes", () => {
  const calendar = E15.financialCalendar({
    forecast,
    maintenanceFeeAlerts: [{ name: "Cuenta corriente", fee: 12.5 }],
  });
  assert.equal(calendar.rows[0].events.some((event) => event.type === "maintenance-fee" && event.amount === 12.5), true);
  assert.equal(calendar.rows[1].events.some((event) => event.type === "maintenance-fee"), false);
  assert.equal(calendar.rows[2].events.some((event) => event.type === "maintenance-fee"), false);
});

test("financialCalendar · supuestos caducados aparecen solo en el primer mes, con amount null e incertidumbre declarada", () => {
  const calendar = E15.financialCalendar({
    forecast,
    assumptionExpiry: [{ id: "incomeFactor", label: "Factor de ingresos" }],
  });
  const first = calendar.rows[0].events.find((event) => event.type === "assumption-expiry");
  assert.ok(first, "debe aparecer en el primer mes");
  assert.equal(first.amount, null);
  assert.equal(first.uncertain, true);
  assert.match(first.label, /Factor de ingresos/);
  assert.equal(calendar.rows[1].events.some((event) => event.type === "assumption-expiry"), false);
});

test("financialCalendar · ignora listas vacías o ausentes sin romper el cálculo", () => {
  assert.doesNotThrow(() => E15.financialCalendar({ forecast, maintenanceFeeAlerts: [], assumptionExpiry: [] }));
  assert.doesNotThrow(() => E15.financialCalendar({ forecast, maintenanceFeeAlerts: undefined, assumptionExpiry: undefined }));
});

// --- Parte B: cableado en app.js ---------------------------------------------------------------

test("ajustesFinancialCalendarInput() centraliza la construcción del input, incluyendo comisiones y supuestos", () => {
  const source = extractFunction("ajustesFinancialCalendarInput");
  assert.match(source, /maintenanceFeeAlerts\(\)\.atRisk/);
  assert.match(source, /assumptionExpiryAlerts/);
  assert.match(source, /api\.financialCalendar\(/);
});

test("handleAjustesExportIcs, widgetSnapshot y renderAjustesFinancialCalendar comparten el mismo helper, sin construir el input cada uno por su cuenta", () => {
  const icsSource = extractFunction("handleAjustesExportIcs");
  assert.match(icsSource, /ajustesFinancialCalendarInput\(\)/);
  assert.doesNotMatch(icsSource, /\.financialCalendar\(/);

  const widgetSource = extractFunction("widgetSnapshot");
  assert.match(widgetSource, /ajustesFinancialCalendarInput\(\)/);
  assert.doesNotMatch(widgetSource, /\.financialCalendar\(/);

  const cardSource = extractFunction("renderAjustesFinancialCalendar");
  assert.match(cardSource, /ajustesFinancialCalendarInput\(\)/);
  assert.doesNotMatch(cardSource, /\.financialCalendar\(/);
});

test("renderAjustesFinancialCalendar filtra el evento \"forecast\" (cierre previsto de todos los meses, no un vencimiento propio)", () => {
  const source = extractFunction("renderAjustesFinancialCalendar");
  assert.match(source, /event\.type !== "forecast"/);
});

test("renderAjustesFinancialCalendar sin calendario disponible, sin datos ni eventos: degrada con un mensaje, sin lanzar", () => {
  const context = sandboxWith(["ajustesFinancialCalendarInput", "renderAjustesFinancialCalendar"], {
    window: {},
    qs: () => ({ innerHTML: "" }),
    AJUSTES_FINANCIAL_CALENDAR_HORIZON_MONTHS: 12,
  });
  assert.doesNotThrow(() => context.renderAjustesFinancialCalendar());

  const emptyCalendarContext = sandboxWith(["ajustesFinancialCalendarInput", "renderAjustesFinancialCalendar"], {
    window: { FinanceCanonicalE15: { financialCalendar: () => ({ rows: [{ monthKey: "2026-09", label: "sep 26", closingLiquidity: 100, events: [{ type: "forecast", label: "Previsión canónica", amount: 100, source: "forecast canónico" }] }] }) }, FinanceP2Bridge: { goalPlanning: () => ({}) } },
    p2State: () => ({ goals: [], e15: {} }),
    insurancePolicies: () => [],
    maintenanceFeeAlerts: () => ({ atRisk: [] }),
    qs: () => ({ innerHTML: "" }),
    AJUSTES_FINANCIAL_CALENDAR_HORIZON_MONTHS: 12,
  });
  assert.doesNotThrow(() => emptyCalendarContext.renderAjustesFinancialCalendar());
});

test("renderAjustes() pinta la tarjeta del calendario financiero", () => {
  const source = extractFunction("renderAjustes");
  assert.match(source, /renderAjustesFinancialCalendar\(\)/);
});

test("index.html declara la tarjeta de Ajustes junto a Exportar, sin controles de escritura", () => {
  assert.match(html, /<h3 class="escenario-motor-panel-title">Calendario financiero<\/h3>/);
  assert.match(html, /<div id="ajustesFinancialCalendar"><\/div>/);
});
