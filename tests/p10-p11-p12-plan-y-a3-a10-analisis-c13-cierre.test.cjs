const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/cierre.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/analisis.js"), "utf8");

// Bloque 2 del plan de cierre (docs/BACKLOG_NUEVE_PANTALLAS.md §7): seis tareas sueltas sin bloqueo
// real — P-10/P-11/P-12 (Plan), A-3/A-10 (Análisis) y C-13 (Cierre). Ninguna dependía de trabajo sin
// construir; ninguna fabrica un cálculo financiero nuevo — todas reutilizan piezas ya existentes
// (A-4 cascada, A-5 hitos, C-2 cuadre, A-7 precisión, D-6/E-7 veredicto en prosa).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

function baseContext(extra = {}) {
  return {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `€${v}`,
    round2: (v) => Math.round(Number(v) * 100) / 100,
    ...extra,
  };
}

// --- P-10 · Descomposición del peor mes -------------------------------------------------------------

test("P-10 · planPrevisionWorstMonthBlockImpacts reutiliza analisisCascadaRows por mes, no reimplementa el desglose", () => {
  const source = extractFunction("planPrevisionWorstMonthBlockImpacts");
  assert.match(source, /analisisCascadaRows\(\[month\]\)/);
});

test("P-10 · planPrevisionWorstMonthBlockImpacts calcula el impacto como media de los otros meses menos el valor del peor", () => {
  const fixtures = {
    "2026-01": { rows: [{ label: "Ingresos", value: 2000 }, { label: "Gastos fijos", value: -800 }] },
    "2026-02": { rows: [{ label: "Ingresos", value: 2000 }, { label: "Gastos fijos", value: -820 }] },
    "2026-03": { rows: [{ label: "Ingresos", value: 2000 }, { label: "Gastos fijos", value: -1400 }] },
  };
  const context = baseContext({ analisisCascadaRows: ([month]) => fixtures[month.key] });
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionWorstMonthBlockImpacts"), context);
  const months = [{ key: "2026-01" }, { key: "2026-02" }, { key: "2026-03" }];
  const impacts = context.planPrevisionWorstMonthBlockImpacts(months, "2026-03");
  const gastos = impacts.find((item) => item.label === "Gastos fijos");
  assert.equal(gastos.avgValue, -810);
  assert.equal(gastos.worstValue, -1400);
  assert.equal(gastos.impact, 590);
  const ingresos = impacts.find((item) => item.label === "Ingresos");
  assert.equal(ingresos.impact, 0);
});

test("P-10 · sin worstKey o con un único mes, no hay impactos que calcular (nada que comparar)", () => {
  const context = baseContext({ analisisCascadaRows: () => ({ rows: [] }) });
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionWorstMonthBlockImpacts"), context);
  assert.equal(context.planPrevisionWorstMonthBlockImpacts([{ key: "a" }], "").length, 0);
  assert.equal(context.planPrevisionWorstMonthBlockImpacts([{ key: "a" }], "a").length, 0);
});

test("P-10 · planPrevisionWorstMonthBreakdownHtml nombra el bloque con mayor impacto, mismo patrón que D-6", () => {
  const context = baseContext({
    analisisCascadaRows: () => ({ rows: [{ label: "Gastos fijos", value: -1400, tone: "is-gasto" }] }),
    analisisCascadaHtml: () => "<cascada/>",
  });
  vm.createContext(context);
  vm.runInContext(
    `${extractFunction("planPrevisionWorstMonthBlockImpacts")}\n${extractFunction("planPrevisionWorstMonthBreakdownHtml")}`,
    context,
  );
  // Sustituye la función real por una versión controlada para aislar el HTML del cálculo de impactos.
  context.planPrevisionWorstMonthBlockImpacts = () => [{ label: "Gastos fijos", worstValue: -1400, avgValue: -810, impact: 590 }];
  const out = context.planPrevisionWorstMonthBreakdownHtml([{ key: "2026-03", label: "Marzo" }], "2026-03");
  assert.match(out, /Gastos fijos fue el bloque que más empujó Marzo/);
  assert.match(out, /<cascada\/>/);
});

test("P-10 · sin worstKey, no pinta nada (ningún peor mes marcado todavía)", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionWorstMonthBreakdownHtml"), context);
  assert.equal(context.planPrevisionWorstMonthBreakdownHtml([], ""), "");
});

// --- P-11 · Proyección de horizonte -----------------------------------------------------------------

test("P-11 · planPrevisionHorizonMilestones detecta el cruce por debajo del mínimo operativo, no solo por debajo de cero", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionHorizonMilestones"), context);
  const months = [
    { key: "m1", label: "Mes 1" },
    { key: "m2", label: "Mes 2" },
    { key: "m3", label: "Mes 3" },
  ];
  const milestones = context.planPrevisionHorizonMilestones(months, [3000, 1500, 4000], 2000);
  assert.equal(milestones.hoy.key, "m1");
  assert.equal(milestones.cruce.key, "m2");
  assert.equal(milestones.finDeHorizonte.key, "m3");
});

test("P-11 · si el colchón nunca baja del mínimo, no inventa un cruce", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionHorizonMilestones"), context);
  const months = [{ key: "m1" }, { key: "m2" }];
  const milestones = context.planPrevisionHorizonMilestones(months, [3000, 3500], 2000);
  assert.equal(milestones.cruce, null);
});

test("P-11 · planPrevisionHorizonMilestonesHtml dice explícitamente cuando el cruce no ocurre en el horizonte", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planPrevisionHorizonMilestonesHtml"), context);
  const out = context.planPrevisionHorizonMilestonesHtml(
    { hoy: { value: 100, label: "Hoy" }, cruce: null, finDeHorizonte: { value: 200, label: "Fin" } },
    "3 meses de gasto medio",
  );
  assert.match(out, /No ocurre en este horizonte/);
  assert.match(out, /3 meses de gasto medio/);
});

// --- P-12 · Semáforo de ahorro -----------------------------------------------------------------------

test("P-12 · planAhorroMonthlyRows colorea contra la media del propio horizonte, no un objetivo fabricado", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planAhorroMonthlyRows"), context);
  const months = [{ key: "m1", label: "Mes 1" }, { key: "m2", label: "Mes 2" }, { key: "m3", label: "Mes 3" }];
  const rows = context.planAhorroMonthlyRows(months, [300, -50, 900]);
  assert.equal(rows[0].level, "warn"); // 300 < media (383.33)
  assert.equal(rows[1].level, "danger"); // negativo
  assert.equal(rows[2].level, "good"); // 900 >= media
});

test("P-12 · sin meses, no hay filas (nada que colorear)", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planAhorroMonthlyRows"), context);
  assert.equal(context.planAhorroMonthlyRows([], []).length, 0);
});

test("P-12 · planAhorroHtml explica la leyenda de los tres colores y enlaza a la heredada como complemento", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("planAhorroHtml"), context);
  const out = context.planAhorroHtml([{ key: "m1", label: "Mes 1", value: 300, avg: 300, level: "good" }]);
  assert.match(out, /is-good/);
  assert.match(out, /data-home-nav="savings-plan"/);
});

test("P-12 · renderPlan() orquesta renderPlanAhorro(), igual que hace con Mes y Previsión", () => {
  const source = extractFunction("renderPlan");
  assert.match(source, /renderPlanAhorro\(\);/);
});

// --- A-3 · Peor mes explicado --------------------------------------------------------------------------

test("A-3 · analisisWorstMonthCulprit reutiliza projectsForForecastIndex, el mismo desglose que ya usa el gráfico de deuda", () => {
  const source = extractFunction("analisisWorstMonthCulprit");
  assert.match(source, /projectsForForecastIndex\(index\)/);
});

test("A-3 · nombra la decisión con mayor impacto ese mes", () => {
  const context = baseContext({
    forecastMonths: () => [{ key: "2026-01" }, { key: "2026-02" }],
    projectsForForecastIndex: (index) =>
      index === 1 ? [{ name: "Reforma cocina", monthlyAmount: 400 }, { name: "Viaje", monthlyAmount: 900 }] : [],
  });
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisWorstMonthCulprit"), context);
  const culprit = context.analisisWorstMonthCulprit("2026-02");
  assert.equal(culprit.name, "Viaje");
});

test("A-3 · sin ninguna decisión activa ese mes, no inventa una culpable", () => {
  const context = baseContext({ forecastMonths: () => [{ key: "2026-01" }], projectsForForecastIndex: () => [] });
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisWorstMonthCulprit"), context);
  assert.equal(context.analisisWorstMonthCulprit("2026-01"), null);
});

test("A-3 · analisisWorstMonthHtml explica en prosa cuando hay culpable, y lo dice sin fabricar uno cuando no lo hay", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(`${extractFunction("analisisWorstMonthCulprit")}\n${extractFunction("analisisWorstMonthHtml")}`, context);
  context.analisisWorstMonthCulprit = () => ({ name: "Viaje", monthlyAmount: 900 });
  const withCulprit = context.analisisWorstMonthHtml({ key: "2026-02", label: "Febrero", monthsValue: 1.2 });
  assert.match(withCulprit, /Viaje concentra el golpe de Febrero/);
  assert.match(withCulprit, /data-home-nav="simulator"/);
  context.analisisWorstMonthCulprit = () => null;
  const withoutCulprit = context.analisisWorstMonthHtml({ key: "2026-03", label: "Marzo", monthsValue: 0.5 });
  assert.match(withoutCulprit, /Ninguna decisión cargada concentra su gasto ahí/);
  assert.equal(context.analisisWorstMonthHtml(null), `<p class="e19-kpi-note">Sin datos suficientes para marcar un peor mes en esta ventana.</p>`);
});

// --- A-10 · Confianza del dato -----------------------------------------------------------------------

test("A-10 · analisisConfianzaDatoContext llama literalmente a cierreAccountReconciliation (C-2), no la recalcula", () => {
  const source = extractFunction("analisisConfianzaDatoContext");
  assert.match(source, /cierreAccountReconciliation\(entries\)/);
});

test("A-10 · cuenta la cobertura de clasificación del mes en curso con el mismo filtro que usa Cierre", () => {
  const context = baseContext({
    window: { FinanceCanonicalLedger: {} },
    refreshCanonicalLedger: () => ({
      entries: [
        { date: "2026-08-05", mapping: { status: "classified" } },
        { date: "2026-08-10", mapping: { status: "pending" } },
        { date: "2026-07-20", mapping: { status: "pending" } }, // mes distinto, no cuenta
        { date: "2026-08-12", duplicateOf: "x", mapping: { status: "pending" } }, // duplicado, no cuenta
      ],
    }),
    cierreAccountReconciliation: () => [{ id: "caixabank", label: "CaixaBank", declared: 100, calculated: 100, diff: 0, status: "cuadra" }],
    openMonthCutoffKey: () => "2026-08",
    ledgerMonthLabel: (key) => `Mes ${key}`,
  });
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisConfianzaDatoContext"), context);
  const result = context.analisisConfianzaDatoContext();
  assert.equal(result.totalMovements, 2);
  assert.equal(result.unclassifiedCount, 1);
});

test("A-10 · sin ledger disponible, no rompe: devuelve null en vez de fabricar datos", () => {
  const context = baseContext({ window: {} });
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisConfianzaDatoContext"), context);
  assert.equal(context.analisisConfianzaDatoContext(), null);
});

test("A-10 · analisisConfianzaDatoHtml dice cuántos movimientos del mes siguen sin clasificar", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisConfianzaDatoHtml"), context);
  const out = context.analisisConfianzaDatoHtml({
    accountRows: [{ label: "CaixaBank", declared: 100, calculated: 100, diff: 0, status: "cuadra" }],
    monthKey: "2026-08",
    monthLabel: "agosto de 2026",
    totalMovements: 5,
    unclassifiedCount: 2,
  });
  assert.match(out, /2 de 5 movimiento\(s\) de agosto de 2026 sin clasificar todavía/);
  assert.match(out, /data-home-nav="cierre"/);
  // A-13: con pendientes reales el CTA deja de ser un enlace genérico — lleva ya el mes para
  // preseleccionar sus filas sin clasificar en Movimientos (M-8).
  assert.match(out, /data-analisis-actuar-confianza="2026-08"/);
});

test("A-10/A-13 · sin pendientes, el CTA vuelve a ser un enlace simple a Movimientos", () => {
  const context = baseContext();
  vm.createContext(context);
  vm.runInContext(extractFunction("analisisConfianzaDatoHtml"), context);
  const out = context.analisisConfianzaDatoHtml({
    accountRows: [{ label: "CaixaBank", declared: 100, calculated: 100, diff: 0, status: "cuadra" }],
    monthKey: "2026-08",
    monthLabel: "agosto de 2026",
    totalMovements: 5,
    unclassifiedCount: 0,
  });
  assert.match(out, /data-home-nav="movements"/);
  assert.doesNotMatch(out, /data-analisis-actuar-confianza/);
});

// --- A-10/A-3 cableado en renderAnalisis --------------------------------------------------------------

test("A-3/A-10 · renderAnalisis() pinta el peor mes explicado y la confianza del dato", () => {
  const source = extractFunction("renderAnalisis");
  assert.match(source, /analisisWorstMonthHtml\(worst\)/);
  assert.match(source, /analisisConfianzaDatoHtml\(analisisConfianzaDatoContext\(\)\)/);
});

// --- C-13 · El cierre alimenta el aprendizaje -----------------------------------------------------------

test("C-13 · recordCierreAprendizaje reutiliza analisisAccuracyRow (A-7), no recalcula la desviación", () => {
  const source = extractFunction("recordCierreAprendizaje");
  assert.match(source, /analisisAccuracyRow\(monthObj\)/);
});

function storageStub() {
  const store = new Map();
  return {
    storageKey: (key) => key,
    storageGet: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    storageSet: (key, value) => store.set(key, value),
    _store: store,
  };
}

test("C-13 · recordCierreAprendizaje guarda un registro por mes, sin duplicar si el mismo mes se cierra otra vez", () => {
  const storage = storageStub();
  const context = baseContext({
    ...storage,
    cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
    analisisAccuracyRow: () => ({ key: "2026-07", label: "Julio", partidasCount: 4, plannedTotal: 1000, realTotal: 1050, diff: 50, deviationPct: 5 }),
  });
  vm.createContext(context);
  vm.runInContext(
    `${extractFunction("loadCierreAprendizajeHistory")}\n${extractFunction("saveCierreAprendizajeHistory")}\n${extractFunction("recordCierreAprendizaje")}`,
    context,
  );
  context.recordCierreAprendizaje("2026-07", "2026-08-19T10:00:00.000Z");
  context.recordCierreAprendizaje("2026-07", "2026-08-19T12:00:00.000Z"); // reabierto y vuelto a firmar
  const history = context.loadCierreAprendizajeHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].closedAt, "2026-08-19T12:00:00.000Z");
});

test("C-13 · un mes cerrado sin ninguna partida real no se guarda (nada que aprender todavía)", () => {
  const storage = storageStub();
  const context = baseContext({
    ...storage,
    cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
    analisisAccuracyRow: () => ({ partidasCount: 0 }),
  });
  vm.createContext(context);
  vm.runInContext(
    `${extractFunction("loadCierreAprendizajeHistory")}\n${extractFunction("saveCierreAprendizajeHistory")}\n${extractFunction("recordCierreAprendizaje")}`,
    context,
  );
  context.recordCierreAprendizaje("2026-07", "2026-08-19T10:00:00.000Z");
  assert.equal(context.loadCierreAprendizajeHistory().length, 0);
});

test("C-13 · cierreAprendizajeHtml no fabrica un veredicto sin umbral configurado, y marca un mes reabierto desde entonces", () => {
  const context = baseContext({
    storageGet: () =>
      JSON.stringify([{ monthKey: "2026-07", label: "Julio", plannedTotal: 1000, realTotal: 1050, diff: 50, deviationPct: 5, closedAt: "x" }]),
    storageKey: (key) => key,
    partidaDeviationThreshold: () => 0,
    cierreMonthsCurrentlyReopened: () => new Set(["2026-07"]),
  });
  vm.createContext(context);
  vm.runInContext(`${extractFunction("loadCierreAprendizajeHistory")}\n${extractFunction("cierreAprendizajeHtml")}`, context);
  const out = context.cierreAprendizajeHtml();
  assert.match(out, />—<\/td>/);
  assert.match(out, /Reabierto desde entonces/);
});

test("C-13 · sin ningún cierre firmado todavía, lo dice explícitamente en vez de una tabla vacía", () => {
  const context = baseContext({ storageGet: () => "[]", storageKey: (key) => key });
  vm.createContext(context);
  vm.runInContext(`${extractFunction("loadCierreAprendizajeHistory")}\n${extractFunction("cierreAprendizajeHtml")}`, context);
  assert.match(context.cierreAprendizajeHtml(), /Todavía no hay ningún cierre firmado/);
});

test("C-13 · closeCurrentMonthTransaction llama a recordCierreAprendizaje tras cerrar, sin tocar el RPC transaccional", () => {
  const source = extractFunction("closeCurrentMonthTransaction");
  assert.match(source, /recordCierreAprendizaje\(month, closedAt\);/);
});

test("C-13 · renderCierre() pinta el historial de aprendizaje", () => {
  const source = extractFunction("renderCierre");
  assert.match(source, /cierreAprendizajeHtml\(\)/);
});

// --- Cableado en index.html --------------------------------------------------------------------------

test("Bloque 2 · los seis contenedores nuevos existen en index.html", () => {
  ["planPrevisionWorstBreakdown", "planPrevisionMilestones", "planAhorroPanel", "analisisWorstMonthExplained", "analisisConfianzaDato", "cierreAprendizaje"].forEach(
    (id) => assert.match(html, new RegExp(`id="${id}"`), `Falta #${id} en index.html`),
  );
});
