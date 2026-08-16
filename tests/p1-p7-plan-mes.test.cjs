const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Plan (04 · backlog «Nueve pantallas»), P-1 a P-7 — solo la pestaña «Mes» de esta sesión.
// «Previsión» y «Ahorro» (P-8 en adelante) son Fase 4 y quedan como enlaces a sus heredadas
// (`#prevision`, `#savings-plan`), mismo patrón que R-2 usó para las pestañas de Registrar sin
// construir todavía. `#cuadro-mandos` sigue intacta y accesible desde «Herramientas avanzadas» —
// el previsto editable de Plan es un espejo más sobre el mismo `visualDraftCells` que ya usaba esa
// pantalla desde E11 (regla transversal 01), no una segunda puerta de escritura.

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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- P-1 · armazón: menú, migajas y tres pestañas ------------------------------------------------

test("P-1 · el menú principal «Plan» aterriza en #plan, no en la heredada #cuadro-mandos", () => {
  assert.match(html, /<a href="#plan" class="nav-primary-link">\s*<span>Plan<\/span>/);
});

test("P-1 · #cuadro-mandos sigue existiendo y accesible desde Herramientas avanzadas (no se retira nada)", () => {
  assert.match(html, /id="cuadro-mandos"/);
  assert.match(html, /<a href="#cuadro-mandos" data-e17-group="analysis">Cuadro de mandos \(nuevo\)<\/a>/);
});

test("P-1 · #plan trae sus tres pestañas y sus migajas", () => {
  assert.match(html, /<nav class="e19-registrar-tabs" id="planTabs" aria-label="Pestañas de Plan">/);
  assert.match(html, /data-plan-tab="mes"/);
  assert.match(html, /data-plan-tab="prevision"/);
  assert.match(html, /data-plan-tab="ahorro"/);
  assert.match(html, /<p class="e19-registrar-crumb" id="planCrumb"/);
});

test("P-1 · Ahorro enlaza a su heredada hasta que se construya, igual que R-2 hizo con Registrar", () => {
  assert.match(html, /data-plan-panel="ahorro" hidden>[\s\S]{0,200}data-home-nav="savings-plan"/);
});

// P-8 (15 de agosto) construyó Previsión de verdad: la pestaña ya no enlaza a su heredada como
// contenido principal, aunque conserva el enlace como complemento (ver tests/p8-p9-plan-prevision.test.cjs).
test("P-1 · Previsión ya no es un enlace a su heredada: tiene su propia tabla y selector de horizonte", () => {
  assert.match(html, /data-plan-panel="prevision" hidden>[\s\S]*?id="planPrevisionTable"/);
  assert.match(html, /data-plan-panel="prevision" hidden>[\s\S]*?data-home-nav="prevision"/);
});

test("P-1 · viewTitles.plan existe y el despachador de vistas activa Plan al entrar", () => {
  assert.match(app, /plan: \{\s*eyebrow: "Plan",/);
  assert.match(app, /case "plan":\s*\n\s*renderPlan\(\);/);
});

test("setPlanTab/renderPlanTabs actualizan aria-selected, ocultan los paneles inactivos y pintan las migajas", () => {
  const buttons = [
    { dataset: { planTab: "mes" }, classList: { toggle() {} }, setAttribute() {} },
    { dataset: { planTab: "prevision" }, classList: { toggle() {} }, setAttribute() {} },
  ];
  const panels = [
    { dataset: { planPanel: "mes" }, hidden: false },
    { dataset: { planPanel: "prevision" }, hidden: true },
  ];
  const crumb = { textContent: "" };
  const nav = { querySelectorAll: (selector) => (selector === "[data-plan-tab]" ? buttons : []) };
  const context = sandboxWith(["setPlanTab", "renderPlanTabs"], {
    PLAN_TABS: [
      { id: "mes", label: "Mes" },
      { id: "prevision", label: "Previsión" },
    ],
    qs: (id) => (id === "planTabs" ? nav : id === "planCrumb" ? crumb : null),
    document: { querySelectorAll: (selector) => (selector === "[data-plan-panel]" ? panels : []) },
  });
  context.setPlanTab("prevision");
  assert.equal(context.planActiveTab, "prevision");
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
  assert.equal(crumb.textContent, "Plan › Previsión");
});

// --- P-2/P-3/P-4 · tabla del mes, previsto editable, gastado con procedencia --------------------

function sandboxCollect(sections, cellByRowId, infoByRowId) {
  return sandboxWith(["planMesCollect"], {
    planningSectionsForMonth: (kind) => sections.filter((section) => section.kind === kind),
    cuadroMandosCellValue: (row) => cellByRowId[row.id],
    actualAwareInfo: (row) => infoByRowId[row.id],
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => row.id,
    round2: (value) => Math.round(value * 100) / 100,
  });
}

test("P-3 · planMesCollect usa el previsto en borrador (draft-aware) para Previsto y para Usado sin real", () => {
  const row = { id: "r1", kind: "expense", label: "Vivienda" };
  const { planMesCollect } = sandboxCollect(
    [{ kind: "expense", name: "Gastos fijos", rows: [row] }],
    { r1: { value: 500, draft: true, before: 400 } },
    { r1: { hasActual: false, actual: null } },
  );
  const entries = planMesCollect({ key: "2026-08" });
  assert.equal(entries.expense.length, 1);
  const entry = entries.expense[0];
  assert.equal(entry.planned, 500);
  assert.equal(entry.plannedDraft, true);
  assert.equal(entry.usado, 500);
  assert.equal(entry.hasActual, false);
  assert.equal(entry.variance, null);
});

test("P-4 · con real, planMesCollect usa el real para Usado y compara la desviación contra el previsto en borrador", () => {
  const row = { id: "r1", kind: "income", label: "Nómina" };
  const { planMesCollect } = sandboxCollect(
    [{ kind: "income", name: "Ingresos", rows: [row] }],
    { r1: { value: 500, draft: false, before: null } },
    { r1: { hasActual: true, actual: 550 } },
  );
  const entries = planMesCollect({ key: "2026-08" });
  const entry = entries.income[0];
  assert.equal(entry.usado, 550);
  assert.equal(entry.variance, 50);
});

test("P-5 · planMesTotals suma el previsto de ingresos y de gastos por separado", () => {
  const { planMesTotals } = sandboxWith(["planMesTotals"], { round2: (v) => Math.round(v * 100) / 100 });
  const totals = planMesTotals({ income: [{ planned: 100 }, { planned: 50 }], expense: [{ planned: 30 }] });
  assert.equal(totals.incomePlanned, 150);
  assert.equal(totals.expensePlanned, 30);
  assert.equal(totals.lines, 3);
});

test("P-5 · el techo de asignación avisa cuando el previsto de gastos supera el de ingresos", () => {
  const fn = extractFunction("renderPlanMes");
  assert.match(fn, /const overCeiling = totals\.expensePlanned > totals\.incomePlanned;/);
  assert.match(fn, /Previsto gastos supera previsto ingresos/);
});

function sandboxRowHtml(entry, monthClosed) {
  const context = sandboxWith(["planMesRowHtml"], {
    escapeHtml: (v) => String(v),
    seriesKeyForRow: (row) => row.id,
    money: (v) => `€${v}`,
    varianceClassForKind: () => "",
    registrarMesSignedMoney: (v) => String(v),
  });
  return context.planMesRowHtml(entry, monthClosed, "2026-08");
}

test("P-2 · la fila de Plan · Mes no ofrece borrar la partida (no hay altas propias en esta pantalla)", () => {
  const entry = { key: "expense:r1", row: { id: "r1" }, sectionName: "Gastos fijos", label: "Vivienda", planned: 750, plannedDraft: false, hasActual: false, usado: 750, variance: null, kind: "expense" };
  const rowHtml = sandboxRowHtml(entry, false);
  assert.doesNotMatch(rowHtml, /registrar-mes-row-remove/);
  assert.match(rowHtml, /data-plan-mes-planned="r1"/);
  assert.match(rowHtml, /data-plan-mes-month="2026-08"/);
});

test("P-2 · el previsto se deshabilita en un mes cerrado, igual que el resto de la aplicación", () => {
  const entry = { key: "expense:r1", row: { id: "r1" }, sectionName: "Gastos fijos", label: "Vivienda", planned: 750, plannedDraft: false, hasActual: false, usado: 750, variance: null, kind: "expense" };
  const openHtml = sandboxRowHtml(entry, false);
  const closedHtml = sandboxRowHtml(entry, true);
  assert.doesNotMatch(openHtml, /disabled/);
  assert.match(closedHtml, /disabled/);
});

test("P-4 · la celda «Usado» declara su procedencia (real o previsto), regla transversal 05", () => {
  const draftEntry = { key: "income:r1", row: { id: "r1" }, sectionName: "Ingresos", label: "Nómina", planned: 3000, plannedDraft: false, hasActual: false, usado: 3000, variance: null, kind: "income" };
  const realEntry = { ...draftEntry, hasActual: true, usado: 3050, variance: 50 };
  assert.match(sandboxRowHtml(draftEntry, false), /previsto/);
  assert.match(sandboxRowHtml(realEntry, false), />real</);
});

// --- P-3 · previsto editable escribe en cuadroMandosStageCell, el mismo que Cuadro de mandos ------

test("P-3 · handlePlanMesPlannedChange no hace nada en un mes cerrado", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesPlannedChange"], {
    planMesSelectedMonth: () => ({ key: "2026-01" }),
    isClosedMonthKey: () => true,
    planMesIsFinancingRowKey: () => false,
    cuadroMandosStageCell: (...args) => calls.push(args),
    renderPlanMes: () => calls.push("renderPlanMes"),
  });
  context.handlePlanMesPlannedChange({ dataset: { planMesPlanned: "r1", planMesMonth: "2026-01" }, value: "500" });
  assert.deepEqual(calls, []);
});

test("P-3 · handlePlanMesPlannedChange escribe con cuadroMandosStageCell, el mismo motor que ya usaba Cuadro de mandos", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesPlannedChange"], {
    planMesSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    planMesIsFinancingRowKey: () => false,
    parseAmount: (v) => Number(v),
    cuadroMandosStageCell: (...args) => calls.push(["cuadroMandosStageCell", ...args]),
    renderPlanMes: () => calls.push("renderPlanMes"),
  });
  context.handlePlanMesPlannedChange({ dataset: { planMesPlanned: "income-a", planMesMonth: "2026-08" }, value: "500" });
  assert.deepEqual(calls, [["cuadroMandosStageCell", "income-a", "2026-08", 500], "renderPlanMes"]);
});

test("P-3 · vaciar la casilla la deja en 0, no en NaN ni sin tocar", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesPlannedChange"], {
    planMesSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    planMesIsFinancingRowKey: () => false,
    parseAmount: () => null,
    cuadroMandosStageCell: (...args) => calls.push(args),
    renderPlanMes: () => {},
  });
  context.handlePlanMesPlannedChange({ dataset: { planMesPlanned: "r1", planMesMonth: "2026-08" }, value: "" });
  assert.deepEqual(calls, [["r1", "2026-08", 0]]);
});

// --- P-3 (auditoría 15 de agosto) · las cuotas de deuda son de solo lectura en Plan · Mes --------

test("P-3 · planMesIsFinancingRowKey identifica las filas del bloque Financiaciones por su seriesKeyForRow", () => {
  const context = sandboxWith(["planMesIsFinancingRowKey"], {
    seriesKeyForRow: (row) => row.id,
    baseData: {
      monthlyPlanning: {
        sections: [
          { name: "Gastos fijos", rows: [{ id: "vivienda" }] },
          { name: "Financiaciones", rows: [{ id: "coche" }, { id: "hipoteca" }] },
        ],
      },
    },
  });
  assert.equal(context.planMesIsFinancingRowKey("coche"), true);
  assert.equal(context.planMesIsFinancingRowKey("hipoteca"), true);
  assert.equal(context.planMesIsFinancingRowKey("vivienda"), false);
  assert.equal(context.planMesIsFinancingRowKey("no-existe"), false);
});

test("P-3 · handlePlanMesPlannedChange bloquea las cuotas de deuda incluso llamando a la función a mano", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesPlannedChange"], {
    planMesSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    planMesIsFinancingRowKey: (rowKey) => rowKey === "coche",
    parseAmount: (v) => Number(v),
    cuadroMandosStageCell: (...args) => calls.push(args),
    renderPlanMes: () => calls.push("renderPlanMes"),
  });
  context.handlePlanMesPlannedChange({ dataset: { planMesPlanned: "coche", planMesMonth: "2026-08" }, value: "300" });
  assert.deepEqual(calls, []);
});

test("P-3 · planMesRowHtml pinta la cuota de Financiaciones como texto de solo lectura con enlace a Deuda, no un input", () => {
  const entry = { key: "expense:coche", row: { id: "coche" }, sectionName: "Financiaciones", label: "Coche", planned: 300, plannedDraft: false, hasActual: false, usado: 300, variance: null, kind: "expense" };
  const rowHtml = sandboxRowHtml(entry, false);
  assert.doesNotMatch(rowHtml, /<input[^>]*data-plan-mes-planned/);
  assert.match(rowHtml, /class="plan-mes-financing-readonly"/);
  assert.match(rowHtml, /se cambia en <button[^>]*data-home-nav="deuda-contratos"[^>]*>Deuda<\/button>/);
});

test("P-3 · una fila que no es de Financiaciones sigue siendo editable, incluso con el mes abierto", () => {
  const entry = { key: "expense:vivienda", row: { id: "vivienda" }, sectionName: "Gastos fijos", label: "Vivienda", planned: 750, plannedDraft: false, hasActual: false, usado: 750, variance: null, kind: "expense" };
  const rowHtml = sandboxRowHtml(entry, false);
  assert.doesNotMatch(rowHtml, /plan-mes-financing-readonly/);
  assert.match(rowHtml, /<input[^>]*data-plan-mes-planned="vivienda"/);
});

test("P-3 · el enlace «Deuda» de la cuota de solo lectura está cableado en planMesTables, mismo patrón que registrarActualsBody", () => {
  assert.match(
    app,
    /qs\("planMesTables"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]*?const navButton = event\.target\.closest\("\[data-home-nav\]"\);\s*const target = navButton\?\.dataset\.homeNav;\s*if \(!target \|\| !document\.getElementById\(target\)\?\.classList\.contains\("view-section"\)\) return;\s*history\.pushState\(null, "", `#\$\{target\}`\);\s*setActiveView\(target\);/,
  );
});

// --- P-7 · copiar el previsto del mes anterior ----------------------------------------------------

test("P-7 · planMesCopyCandidates solo incluye partidas donde el previsto realmente cambia frente al mes anterior", () => {
  const months = [{ key: "2026-07", label: "Julio" }, { key: "2026-08", label: "Agosto" }];
  const rowA = { id: "a" };
  const rowB = { id: "b" };
  const context = sandboxWith(["planMesCopyCandidates"], {
    cuadroMandosAllMonths: () => months,
    seriesKeyForRow: (row) => row.id,
    planMesPreviousMonth: (month) => (month.key === "2026-08" ? months[0] : null),
    planMesCollect: (month) =>
      month.key === "2026-08"
        ? { income: [{ row: rowA, planned: 100 }], expense: [{ row: rowB, planned: 50 }] }
        : { income: [{ row: rowA, planned: 120 }], expense: [{ row: rowB, planned: 50 }] },
  });
  const candidates = JSON.parse(JSON.stringify(context.planMesCopyCandidates(months[1])));
  assert.deepEqual(candidates, [{ rowKey: "a", monthKey: "2026-08", value: 120 }]);
});

test("P-7 · sin mes anterior, no hay nada que copiar", () => {
  const context = sandboxWith(["planMesCopyCandidates"], {
    cuadroMandosAllMonths: () => [{ key: "2026-01" }],
    planMesPreviousMonth: () => null,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.planMesCopyCandidates({ key: "2026-01" }))), []);
});

test("P-7 · confirmar la copia usa cuadroMandosStageCell partida por partida, no un segundo camino de escritura", () => {
  const calls = [];
  const context = sandboxWith(["handlePlanMesCopyConfirm"], {
    planMesSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    planMesCopyCandidates: () => [
      { rowKey: "a", monthKey: "2026-08", value: 120 },
      { rowKey: "b", monthKey: "2026-08", value: 60 },
    ],
    cuadroMandosStageCell: (...args) => calls.push(args),
    planMesPreviousMonth: () => ({ label: "Julio" }),
    announceStatus: () => {},
    renderPlanMes: () => {},
  });
  context.handlePlanMesCopyConfirm();
  assert.deepEqual(calls, [
    ["a", "2026-08", 120],
    ["b", "2026-08", 60],
  ]);
});

// --- P-6 · pie de impacto compartido con Registrar -------------------------------------------------

function sandboxImpactBar(impact, extra = {}) {
  const bar = { hidden: true, innerHTML: "" };
  const context = sandboxWith(["renderPlanMesImpactBar"], {
    qs: (id) => (id === "planMesImpactBar" ? bar : null),
    cuadroMandosImpact: () => impact,
    FinanceCanonicalCushion: { worstMonthOf: (rows) => rows?.worst || null },
    openSimulationRows: (rows) => rows,
    cuadroMandosBeforeAfter: (before, after, format) => `<dd>${format(after)}</dd>`,
    cuadroMandosReserveLabel: () => "bajo la reserva",
    escapeHtml: (v) => String(v),
    money: (v) => `€${v}`,
    round2: (v) => Math.round(v * 100) / 100,
    escenarioMotorMonthLabel: (key) => key,
    ...extra,
  });
  return { bar, render: context.renderPlanMesImpactBar };
}

test("P-6 · sin borradores de previsto, el pie de impacto de Plan se oculta", () => {
  const { bar, render } = sandboxImpactBar({ drafts: [] });
  render();
  assert.equal(bar.hidden, true);
  assert.equal(bar.innerHTML, "");
});

test("P-6 · si el motor no acepta la combinación, avisa y solo ofrece Descartar", () => {
  const { bar, render } = sandboxImpactBar({ drafts: [{}], ok: false });
  render();
  assert.equal(bar.hidden, false);
  assert.match(bar.innerHTML, /No se ha podido calcular/);
  assert.match(bar.innerHTML, /data-plan-mes-impact-discard/);
  assert.doesNotMatch(bar.innerHTML, /data-plan-mes-impact-save/);
});

test("P-6 · con borradores válidos, muestra las cifras que de verdad se mueven al editar previsto y los botones de guardar/descartar", () => {
  const { bar, render } = sandboxImpactBar({
    drafts: [{ label: "Ingreso Persona A", monthLabel: "ago 26" }],
    ok: true,
    before: { minimo: 100, bajoReserva: 0, final: 200, reserve: 0 },
    after: { minimo: 150, bajoReserva: 0, final: 250, reserve: 0 },
    rowsBefore: { worst: { key: "2026-08", value: 100 } },
    rowsAfter: { worst: { key: "2026-08", value: 150 } },
  });
  render();
  assert.equal(bar.hidden, false);
  assert.match(bar.innerHTML, /Ingreso Persona A/);
  assert.match(bar.innerHTML, /data-plan-mes-impact-save/);
  assert.match(bar.innerHTML, /data-plan-mes-impact-discard/);
  assert.match(bar.innerHTML, /Mínimo de liquidez del horizonte/);
  assert.match(bar.innerHTML, /Liquidez al final del horizonte/);
  assert.match(bar.innerHTML, /Peor mes del horizonte/);
});

test("P-6 · usa cuadroMandosImpact (el mismo cálculo de antes/después que ya usaba Cuadro de mandos), no un tercer motor", () => {
  const fn = extractFunction("renderPlanMesImpactBar");
  assert.match(fn, /const impact = cuadroMandosImpact\(\);/);
});

// --- Guardar / Descartar reutilizan saveVisualChanges/discardVisualChanges, no un tercer camino ----

test("Cableado · Guardar cambios/Descartar todo del pie de Plan llaman a saveVisualChanges/discardVisualChanges, las mismas que ya usa #visual-detail", () => {
  assert.match(
    app,
    /qs\("planMesImpactBar"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]{0,260}saveVisualChanges\(\);[\s\S]{0,260}discardVisualChanges\(\); renderPlanMes\(\);/,
  );
});

test("Cableado · cambiar el mes, editar el previsto y las acciones de copiar están todos delegados", () => {
  assert.match(app, /qs\("planMesMonth"\)\?\.addEventListener\("change", renderPlanMes\);/);
  assert.match(app, /qs\("planMesTables"\)\?\.addEventListener\("change", \(event\) => \{[\s\S]{0,150}handlePlanMesPlannedChange\(input\);/);
  assert.match(app, /data-plan-mes-copy-confirm/);
  assert.match(app, /data-plan-mes-copy-cancel/);
});

test("Cableado · las pestañas de Plan delegan en setPlanTab, igual que Registrar delega en setRegistrarTab", () => {
  assert.match(app, /qs\("planTabs"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]{0,150}setPlanTab\(button\.dataset\.planTab\);/);
});
