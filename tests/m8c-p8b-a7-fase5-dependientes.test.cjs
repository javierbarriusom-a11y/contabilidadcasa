const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/analisis.js"), "utf8");

// M-8c (saldo recalculado en Movimientos), P-8b (editar un mes cerrado en Plan · Mes, con aviso) y
// A-7 (¿acierta el plan?, en Análisis) — las tres dependían de Cierre (Fase 5), que ya está
// construido, así que ninguna inventa cálculo financiero nuevo: reutilizan piezas ya hechas
// (`cierreAccountReconciliation` de C-2, `cuadroMandosStageCell` de Cuadro de mandos/P-3, y
// `partidaDeviationThreshold`/`registrarMesDeviationPercent` del umbral de Ajustes que ya usa
// Registrar).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    ...extra,
  };
}

// --- M-8c · saldo declarado y su cuadre, también en Movimientos --------------------------------

test("M-8c · index.html trae el contenedor del cuadre, dentro de la vista de Movimientos", () => {
  const start = html.indexOf('id="movements"');
  const end = html.indexOf('id="movementRows"', start);
  const section = html.slice(start, end);
  assert.match(section, /id="movementsReconciliation"/);
});

test("M-8c · renderMovementsReconciliation no hace nada sin el motor de ledger", () => {
  const container = { innerHTML: "no tocar" };
  const context = sandboxWith(["renderMovementsReconciliation"], baseHelpers({
    qs: () => container,
    window: {},
  }));
  context.renderMovementsReconciliation();
  assert.equal(container.innerHTML, "no tocar");
});

test("M-8c · sin contenedor en el DOM, no llama al ledger", () => {
  const calls = [];
  const context = sandboxWith(["renderMovementsReconciliation"], baseHelpers({
    qs: () => null,
    window: { FinanceCanonicalLedger: {} },
    refreshCanonicalLedger: () => calls.push("refresh"),
  }));
  context.renderMovementsReconciliation();
  assert.deepEqual(calls, []);
});

// Repaso pixel-perfect del 20 de agosto: Movimientos.pdf pinta el cuadre como una insignia en
// línea, solo de CaixaBank (la misma cuenta de la que ya es la columna Saldo de la tabla), no como
// una tabla con las dos cuentas.
test("M-8c · reutiliza cierreAccountReconciliation (C-2), no un segundo cálculo de saldo — insignia solo de CaixaBank", () => {
  const calls = [];
  const container = { innerHTML: "" };
  const rows = [
    { id: "caixabank", label: "CaixaBank", declared: 1000, calculated: 950, diff: 50, status: "descuadra" },
    { id: "mediolanum", label: "Mediolanum", declared: 500, calculated: null, diff: null, status: "sin-conciliar" },
  ];
  const context = sandboxWith(["renderMovementsReconciliation"], baseHelpers({
    qs: (id) => (id === "movementsReconciliation" ? container : null),
    window: { FinanceCanonicalLedger: {} },
    refreshCanonicalLedger: (reason) => {
      calls.push(reason);
      return { entries: ["e1", "e2"] };
    },
    cierreAccountReconciliation: (entries) => {
      calls.push(entries.join(","));
      return rows;
    },
  }));
  context.renderMovementsReconciliation();
  assert.deepEqual(calls, ["movements-view", "e1,e2"]);
  assert.match(container.innerHTML, /diferencia de 50\.00 €/);
  assert.doesNotMatch(container.innerHTML, /Mediolanum/);
  assert.match(container.innerHTML, /Cierre/);
});

test("M-8c · cuando el saldo cuadra, la insignia lo dice sin enlazar a Cierre", () => {
  const container = { innerHTML: "" };
  const rows = [{ id: "caixabank", label: "CaixaBank", declared: 1000, calculated: 1000, diff: 0, status: "cuadra" }];
  const context = sandboxWith(["renderMovementsReconciliation"], baseHelpers({
    qs: (id) => (id === "movementsReconciliation" ? container : null),
    window: { FinanceCanonicalLedger: {} },
    refreshCanonicalLedger: () => ({ entries: [] }),
    cierreAccountReconciliation: () => rows,
  }));
  context.renderMovementsReconciliation();
  assert.match(container.innerHTML, /Saldo recalculado cuadra con el declarado: 1000\.00 €/);
  assert.doesNotMatch(container.innerHTML, /Cierre/);
});

test("M-8c · sin snapshot (ledger vacío), no revienta y no pinta filas", () => {
  const container = { innerHTML: "" };
  const context = sandboxWith(["renderMovementsReconciliation"], baseHelpers({
    qs: (id) => (id === "movementsReconciliation" ? container : null),
    window: { FinanceCanonicalLedger: {} },
    refreshCanonicalLedger: () => null,
  }));
  context.renderMovementsReconciliation();
  assert.equal(container.innerHTML, "");
});

test("M-8c · renderDetailedMovements llama a renderMovementsReconciliation", () => {
  const fn = extractFunction("renderDetailedMovements");
  assert.match(fn, /renderMovementsReconciliation\(\)/);
});

// --- P-8b · editar un mes cerrado en Plan · Mes, con aviso --------------------------------------

test("P-8b · cuadroMandosStageCell sigue bloqueando un mes cerrado por defecto", () => {
  const context = sandboxWith(["cuadroMandosStageCell"], baseHelpers({
    rowForSeriesKey: () => ({ id: "r1" }),
    monthByKey: () => ({ key: "2026-01" }),
    cuadroMandosAllMonths: () => [],
    isClosedMonthKey: () => true,
    visualDraftCellKey: () => "k",
    plannedValueForVisualRow: () => 100,
    visualDisplayLabel: () => "Fila",
    visualDraftCells: {},
  }));
  assert.equal(context.cuadroMandosStageCell("r1", "2026-01", 200), null);
  assert.equal(context.cuadroMandosStageCell("r1", "2026-01", 200, {}), null);
  assert.equal(context.cuadroMandosStageCell("r1", "2026-01", 200, { allowClosedMonth: false }), null);
});

test("P-8b · cuadroMandosStageCell(..., { allowClosedMonth: true }) sí escribe en un mes cerrado", () => {
  const drafts = {};
  const context = sandboxWith(["cuadroMandosStageCell"], baseHelpers({
    rowForSeriesKey: () => ({ id: "r1" }),
    monthByKey: () => ({ key: "2026-01", label: "enero 2026" }),
    cuadroMandosAllMonths: () => [],
    isClosedMonthKey: () => true,
    visualDraftCellKey: () => "k1",
    plannedValueForVisualRow: () => 100,
    visualDisplayLabel: () => "Fila",
    visualDraftCells: drafts,
  }));
  const result = context.cuadroMandosStageCell("r1", "2026-01", 250, { allowClosedMonth: true });
  assert.equal(result.removed, false);
  assert.equal(drafts.k1.value, 250);
});

test("P-8b · un mes abierto sigue escribiendo igual, con o sin la opción", () => {
  const drafts = {};
  const context = sandboxWith(["cuadroMandosStageCell"], baseHelpers({
    rowForSeriesKey: () => ({ id: "r1" }),
    monthByKey: () => ({ key: "2026-08", label: "agosto 2026" }),
    cuadroMandosAllMonths: () => [],
    isClosedMonthKey: () => false,
    visualDraftCellKey: () => "k2",
    plannedValueForVisualRow: () => 100,
    visualDisplayLabel: () => "Fila",
    visualDraftCells: drafts,
  }));
  context.cuadroMandosStageCell("r1", "2026-08", 300);
  assert.equal(drafts.k2.value, 300);
});

test("P-8b · planMesEditLocked: cerrado y sin candado abierto para ese mes, bloqueado", () => {
  const context = sandboxWith(["planMesEditLocked"], baseHelpers({
    isClosedMonthKey: () => true,
    planMesClosedOverrideMonthKey: null,
  }));
  assert.equal(context.planMesEditLocked({ key: "2026-01" }), true);
});

test("P-8b · planMesEditLocked: cerrado pero con el candado abierto para ese mes exacto, desbloqueado", () => {
  const context = sandboxWith(["planMesEditLocked"], baseHelpers({
    isClosedMonthKey: () => true,
    planMesClosedOverrideMonthKey: "2026-01",
  }));
  assert.equal(context.planMesEditLocked({ key: "2026-01" }), false);
});

test("P-8b · planMesEditLocked: el candado abierto de OTRO mes no desbloquea este", () => {
  const context = sandboxWith(["planMesEditLocked"], baseHelpers({
    isClosedMonthKey: () => true,
    planMesClosedOverrideMonthKey: "2026-02",
  }));
  assert.equal(context.planMesEditLocked({ key: "2026-01" }), true);
});

test("P-8b · planMesEditLocked: mes abierto nunca está bloqueado, con o sin candado", () => {
  const context = sandboxWith(["planMesEditLocked"], baseHelpers({
    isClosedMonthKey: () => false,
    planMesClosedOverrideMonthKey: "2026-08",
  }));
  assert.equal(context.planMesEditLocked({ key: "2026-08" }), false);
});

test("P-8b · handlePlanMesClosedOverrideToggle solo actúa sobre un mes cerrado", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesClosedOverrideToggle"], baseHelpers({
    planMesSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    planMesClosedOverrideMonthKey: null,
    renderPlanMes: () => calls.push("render"),
  }));
  context.handlePlanMesClosedOverrideToggle(true);
  assert.deepEqual(calls, []);
});

test("P-8b · handlePlanMesClosedOverrideToggle(true) abre el candado del mes cerrado en curso", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesClosedOverrideToggle"], baseHelpers({
    planMesSelectedMonth: () => ({ key: "2026-01" }),
    isClosedMonthKey: () => true,
    planMesClosedOverrideMonthKey: null,
    renderPlanMes: () => calls.push("render"),
  }));
  context.handlePlanMesClosedOverrideToggle(true);
  assert.equal(context.planMesClosedOverrideMonthKey, "2026-01");
  assert.deepEqual(calls, ["render"]);
});

test("P-8b · handlePlanMesClosedOverrideToggle(false) vuelve a bloquear", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesClosedOverrideToggle"], baseHelpers({
    planMesSelectedMonth: () => ({ key: "2026-01" }),
    isClosedMonthKey: () => true,
    planMesClosedOverrideMonthKey: "2026-01",
    renderPlanMes: () => calls.push("render"),
  }));
  context.handlePlanMesClosedOverrideToggle(false);
  assert.equal(context.planMesClosedOverrideMonthKey, null);
  assert.deepEqual(calls, ["render"]);
});

test("P-8b · planMesClosedFootHtml: mes abierto delega en planMesCopyHtml, sin nada de candados", () => {
  const context = sandboxWith(["planMesClosedFootHtml"], baseHelpers({
    planMesCopyHtml: () => "<button>copiar</button>",
  }));
  assert.equal(context.planMesClosedFootHtml({ key: "2026-08", label: "agosto 2026" }, false, false), "<button>copiar</button>");
});

test("P-8b · planMesClosedFootHtml: cerrado y sin abrir, ofrece el botón para editar igualmente", () => {
  const context = sandboxWith(["planMesClosedFootHtml"], baseHelpers({
    planMesCopyHtml: () => "no debería llamarse",
  }));
  const out = context.planMesClosedFootHtml({ key: "2026-01", label: "enero 2026" }, true, false);
  assert.match(out, /cerrado/);
  assert.match(out, /data-plan-mes-closed-override-on/);
  assert.doesNotMatch(out, /data-plan-mes-closed-override-off/);
});

test("P-8b · planMesClosedFootHtml: candado abierto, avisa de forma permanente y ofrece volver a bloquear", () => {
  const context = sandboxWith(["planMesClosedFootHtml"], baseHelpers({
    planMesCopyHtml: () => "no debería llamarse",
  }));
  const out = context.planMesClosedFootHtml({ key: "2026-01", label: "enero 2026" }, true, true);
  assert.match(out, /enero 2026/);
  assert.match(out, /firmados e intocables/);
  assert.match(out, /data-plan-mes-closed-override-off/);
  assert.doesNotMatch(out, /data-plan-mes-closed-override-on\b/);
});

test("P-8b · el manejador de clics de planMesTables reconoce el candado de abrir y cerrar", () => {
  const start = app.indexOf('qs("planMesTables")?.addEventListener("click"');
  assert.ok(start >= 0);
  const snippet = app.slice(start, start + 1200);
  assert.match(snippet, /data-plan-mes-closed-override-on/);
  assert.match(snippet, /handlePlanMesClosedOverrideToggle\(true\)/);
  assert.match(snippet, /data-plan-mes-closed-override-off/);
  assert.match(snippet, /handlePlanMesClosedOverrideToggle\(false\)/);
});

test("P-8b · renderPlanMes cierra el candado solo si el mes seleccionado cambió", () => {
  const fn = extractFunction("renderPlanMes");
  assert.match(fn, /planMesClosedOverrideMonthKey && planMesClosedOverrideMonthKey !== month\.key/);
});

// --- A-7 · ¿acierta el plan? --------------------------------------------------------------------

function planMesEntry(overrides) {
  return { hasActual: true, planned: 0, usado: 0, variance: 0, ...overrides };
}

test("A-7 · un mes sin ninguna partida con real queda fuera (no hay relación mes→dato fiable)", () => {
  const context = sandboxWith(["analisisAccuracyRows", "analisisAccuracyRow"], baseHelpers({
    isClosedMonthKey: () => true,
    planMesCollect: () => ({ income: [], expense: [{ ...planMesEntry({ hasActual: false, planned: 100 }) }] }),
    partidaDeviationThreshold: () => 10,
    registrarMesDeviationPercent: () => 0,
  }));
  const rows = context.analisisAccuracyRows([{ key: "2026-07", label: "jul 26" }]);
  assert.equal(rows.length, 0);
});

test("A-7 · un mes abierto nunca entra, aunque tenga reales", () => {
  const context = sandboxWith(["analisisAccuracyRows", "analisisAccuracyRow"], baseHelpers({
    isClosedMonthKey: () => false,
    planMesCollect: () => ({ income: [planMesEntry({ planned: 1000, usado: 1000 })], expense: [] }),
    partidaDeviationThreshold: () => 10,
    registrarMesDeviationPercent: () => 0,
  }));
  const rows = context.analisisAccuracyRows([{ key: "2026-08", label: "ago 26" }]);
  assert.equal(rows.length, 0);
});

test("A-7 · previsto y real coinciden: 0% de desviación, dentro del margen", () => {
  const context = sandboxWith(["analisisAccuracyRow"], baseHelpers({
    planMesCollect: () => ({
      income: [planMesEntry({ planned: 1000, usado: 1000, variance: 0 })],
      expense: [planMesEntry({ planned: 400, usado: 400, variance: 0 })],
    }),
    partidaDeviationThreshold: () => 10,
    registrarMesDeviationPercent: () => 0,
  }));
  const row = context.analisisAccuracyRow({ key: "2026-07", label: "jul 26" });
  assert.equal(row.plannedTotal, 1400);
  assert.equal(row.realTotal, 1400);
  assert.equal(row.diff, 0);
  assert.equal(row.deviationPct, 0);
  assert.equal(row.withinThreshold, true);
  assert.equal(row.partidasOver, 0);
});

test("A-7 · una desviación grande queda «se desvía» cuando supera el umbral", () => {
  const context = sandboxWith(["analisisAccuracyRow"], baseHelpers({
    planMesCollect: () => ({
      income: [],
      expense: [planMesEntry({ planned: 200, usado: 400, variance: 200 })],
    }),
    partidaDeviationThreshold: () => 10,
    registrarMesDeviationPercent: (entry) => (Math.abs(entry.variance) / Math.abs(entry.planned)) * 100,
  }));
  const row = context.analisisAccuracyRow({ key: "2026-07", label: "jul 26" });
  assert.equal(row.deviationPct, 100);
  assert.equal(row.withinThreshold, false);
  assert.equal(row.partidasOver, 1);
});

test("A-7 · sin umbral configurado, no se fabrica un veredicto (regla transversal 04)", () => {
  const context = sandboxWith(["analisisAccuracyRow"], baseHelpers({
    planMesCollect: () => ({
      income: [],
      expense: [planMesEntry({ planned: 200, usado: 400, variance: 200 })],
    }),
    partidaDeviationThreshold: () => 0,
    registrarMesDeviationPercent: () => 100,
  }));
  const row = context.analisisAccuracyRow({ key: "2026-07", label: "jul 26" });
  assert.equal(row.withinThreshold, null);
  assert.equal(row.partidasOver, null);
});

test("A-7 · previsto cero con real distinto de cero es una desviación total, no una división evitada", () => {
  const context = sandboxWith(["analisisAccuracyRow"], baseHelpers({
    planMesCollect: () => ({ income: [], expense: [planMesEntry({ planned: 0, usado: 50, variance: 50 })] }),
    partidaDeviationThreshold: () => 10,
    registrarMesDeviationPercent: () => Infinity,
  }));
  const row = context.analisisAccuracyRow({ key: "2026-07", label: "jul 26" });
  assert.equal(row.deviationPct, Infinity);
  assert.equal(row.withinThreshold, false);
});

test("A-7 · analisisAccuracySummary cuenta cuántos meses cerrados están dentro del margen", () => {
  const context = sandboxWith(["analisisAccuracySummary"], baseHelpers({
    partidaDeviationThreshold: () => 10,
  }));
  const summary = context.analisisAccuracySummary([{ withinThreshold: true }, { withinThreshold: false }, { withinThreshold: true }]);
  // JSON.stringify en vez de deepEqual: el objeto lo crea código compilado dentro del sandbox `vm`,
  // en un realm distinto de este test — deepEqual falla comparando por referencia entre realms
  // aunque la estructura sea idéntica.
  assert.equal(JSON.stringify(summary), JSON.stringify({ threshold: 10, hits: 2, total: 3 }));
});

test("A-7 · analisisAccuracySummary sin umbral no fabrica un recuento de aciertos", () => {
  const context = sandboxWith(["analisisAccuracySummary"], baseHelpers({
    partidaDeviationThreshold: () => 0,
  }));
  const summary = context.analisisAccuracySummary([{ withinThreshold: null }]);
  assert.equal(JSON.stringify(summary), JSON.stringify({ threshold: 0, hits: null, total: 1 }));
});

test("A-7 · analisisAccuracyHtml sin meses cerrados lo dice, en vez de una tabla vacía", () => {
  const context = sandboxWith(["analisisAccuracyHtml", "analisisAccuracyRowsHtml"], baseHelpers({
    registrarMesSignedMoney: (v) => `${v >= 0 ? "+" : ""}${v}`,
  }));
  const out = context.analisisAccuracyHtml([], { threshold: 10, hits: 0, total: 0 });
  assert.match(out, /Ningún mes cerrado/);
});

test("A-7 · analisisAccuracyHtml con datos pinta el veredicto y el enlace a Ajustes", () => {
  const context = sandboxWith(["analisisAccuracyHtml", "analisisAccuracyRowsHtml"], baseHelpers({
    registrarMesSignedMoney: (v) => `${v >= 0 ? "+" : ""}${v}`,
  }));
  const rows = [
    { key: "2026-07", label: "jul 26", plannedTotal: 1000, realTotal: 1050, diff: 50, deviationPct: 5, partidasOver: 0, partidasCount: 3, withinThreshold: true },
  ];
  const out = context.analisisAccuracyHtml(rows, { threshold: 10, hits: 1, total: 1 });
  assert.match(out, /1 de 1 mes/);
  assert.match(out, /Ajustes/);
  assert.match(out, /Acierta/);
  assert.match(out, /jul 26/);
});

test("A-7 · renderAnalisis pinta analisisAccuracy con la misma ventana que A-2/A-5", () => {
  const fn = extractFunction("renderAnalisis");
  assert.match(fn, /analisisAccuracyRows\(months\)/);
  assert.match(fn, /analisisAccuracyHtml\(accuracyRows, analisisAccuracySummary\(accuracyRows\)\)/);
});

test("A-7 · index.html trae la tarjeta «¿Acierta el plan?» en Análisis", () => {
  assert.match(html, /¿Acierta el plan\?/);
  assert.match(html, /id="analisisAccuracy"/);
});
