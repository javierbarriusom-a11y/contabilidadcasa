const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const Cushion = require("../canonical-cushion.js");

// P-8/P-9 (Plan › pestaña Previsión). Backlog_Global.pdf (V4, 14 de agosto de 2026 — el backlog
// operativo vigente) especifica P-8 como "una fila por bloque y una columna por mes del horizonte;
// los meses cerrados se distinguen visualmente y llevan candado" — no lo que se había construido
// antes en #prevision a partir del mockup 2c (que se queda, es una pantalla distinta). P-9 añade
// una fila final de colchón con una escala de tres niveles nueva, compartida con A-2 (Análisis,
// pendiente) — ver canonical-cushion.js `cushionLevel`.

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

const PLAN_PREVISION_HORIZONS = {
  "12m": { label: "12 meses", months: 12 },
  "24m": { label: "24 meses", months: 24 },
  "48m": { label: "48 meses", months: 48 },
  full: { label: "Horizonte completo", months: Infinity },
};

const stubMoney = (value) => `€${Math.round((Number(value) || 0) * 100) / 100}`;
const stubEscapeHtml = (value) => String(value ?? "");
const stubRound2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

// --- planPrevisionMonths -----------------------------------------------------------------------

test("P-8 · planPrevisionMonths recorta 12/24/48/completo desde el primer mes del plan (incluye cerrados)", () => {
  const allMonths = Array.from({ length: 60 }, (_, i) => ({ key: `m${i}`, label: `mes ${i}` }));
  const context = sandboxWith(["planPrevisionMonths"], {
    PLAN_PREVISION_HORIZONS,
    cuadroMandosAllMonths: () => allMonths,
  });
  assert.equal(context.planPrevisionMonths("12m").length, 12);
  assert.equal(context.planPrevisionMonths("24m").length, 24);
  assert.equal(context.planPrevisionMonths("full").length, 60);
  assert.equal(context.planPrevisionMonths("12m")[0].key, "m0");
});

// --- planPrevisionSimulationByMonth -------------------------------------------------------------

test("P-8 · planPrevisionSimulationByMonth empareja cada mes con su fila de simulación, o null si no existe", () => {
  const context = sandboxWith(["planPrevisionSimulationByMonth"], {
    lastSimulation: [
      { detailMonthKey: "2026-08", totalLiquidity: 1000 },
      { detailMonthKey: "2026-09", totalLiquidity: 500 },
    ],
  });
  const months = [{ key: "2026-08" }, { key: "2026-09" }, { key: "2026-10" }];
  const rows = context.planPrevisionSimulationByMonth(months);
  assert.equal(rows[0].totalLiquidity, 1000);
  assert.equal(rows[1].totalLiquidity, 500);
  assert.equal(rows[2], null);
});

// --- planPrevisionSectionTotal / planPrevisionResultByMonth -------------------------------------

test("P-8 · planPrevisionSectionTotal suma solo las filas que existen ese mes", () => {
  const context = sandboxWith(["planPrevisionSectionTotal"], {
    cuadroMandosRowExists: (row, month) => !(row.id === "b" && month.key === "2026-09"),
    plannedValueForVisualRow: (row) => (row.id === "a" ? 100 : 50),
  });
  const section = { rows: [{ id: "a" }, { id: "b" }] };
  assert.equal(context.planPrevisionSectionTotal(section, { key: "2026-08" }), 150);
  assert.equal(context.planPrevisionSectionTotal(section, { key: "2026-09" }), 100);
});

test("P-9 · planPrevisionResultByMonth resta gastos y ahorro de los ingresos, mes a mes", () => {
  const context = sandboxWith(["planPrevisionResultByMonth", "planPrevisionSectionTotal"], {
    round2: stubRound2,
    cuadroMandosRowExists: () => true,
    plannedValueForVisualRow: (row) => row.value,
  });
  const months = [{ key: "2026-08" }, { key: "2026-09" }];
  const sections = [
    { kind: "income", rows: [{ value: 3000 }] },
    { kind: "expense", rows: [{ value: 1200 }] },
  ];
  const result = context.planPrevisionResultByMonth(months, sections, [500, 0]);
  assert.deepEqual(result, [1300, 1800]);
});

// --- planPrevisionRowHtml -----------------------------------------------------------------------

test("P-8 · planPrevisionRowHtml marca meses cerrados, negativos y el peor mes", () => {
  const context = sandboxWith(["planPrevisionRowHtml"], {
    money: stubMoney,
    escapeHtml: stubEscapeHtml,
    isClosedMonthKey: (key) => key === "2026-07",
  });
  const months = [{ key: "2026-07" }, { key: "2026-08" }];
  const rowHtml = context.planPrevisionRowHtml("Colchón", [-50, 900], months, { worstKey: "2026-08", emphasize: true });
  assert.match(rowHtml, /class="cuadro-mandos-closed negative"/);
  assert.match(rowHtml, /plan-prevision-worst/);
  assert.match(rowHtml, /<strong>/);
});

test("P-8 · planPrevisionRowHtml admite una celda personalizada (cellHtml) para el colchón", () => {
  const context = sandboxWith(["planPrevisionRowHtml"], {
    money: stubMoney,
    escapeHtml: stubEscapeHtml,
    isClosedMonthKey: () => false,
  });
  const rowHtml = context.planPrevisionRowHtml("Colchón", [900], [{ key: "2026-08" }], {
    cellHtml: (value) => `<span class="custom">${value}</span>`,
  });
  assert.match(rowHtml, /<span class="custom">900<\/span>/);
});

// --- planPrevisionHeaderHtml --------------------------------------------------------------------

test("P-9 · planPrevisionHeaderHtml marca los meses cerrados con candado en la cabecera", () => {
  const context = sandboxWith(["planPrevisionHeaderHtml"], {
    escapeHtml: stubEscapeHtml,
    isClosedMonthKey: (key) => key === "2026-07",
  });
  const headerHtml = context.planPrevisionHeaderHtml([{ key: "2026-07", label: "jul 26" }, { key: "2026-08", label: "ago 26" }]);
  assert.match(headerHtml, /jul 26 <span class="plan-prevision-lock"/);
  assert.doesNotMatch(headerHtml, /ago 26 <span class="plan-prevision-lock"/);
});

// --- handlePlanPrevisionHorizon -----------------------------------------------------------------

test("P-8 · handlePlanPrevisionHorizon cambia el horizonte, activa el botón correcto y repinta", () => {
  const buttons = ["12m", "24m", "48m", "full"].map((key) => ({
    dataset: { planPrevisionHorizon: key },
    classes: new Set(key === "12m" ? ["is-active"] : []),
    classList: {
      toggle(name, on) {
        if (on) this.parentClasses.add(name);
        else this.parentClasses.delete(name);
      },
    },
    setAttribute() {},
  }));
  buttons.forEach((button) => { button.classList.parentClasses = button.classes; });
  let rendered = 0;
  const context = sandboxWith(["handlePlanPrevisionHorizon"], {
    PLAN_PREVISION_HORIZONS,
    planPrevisionHorizonKey: "12m",
    document: { querySelectorAll: () => buttons },
    renderPlanPrevision: () => { rendered += 1; },
  });
  context.handlePlanPrevisionHorizon("24m");
  assert.equal(context.planPrevisionHorizonKey, "24m");
  assert.equal(rendered, 1);
  assert.ok(buttons[1].classes.has("is-active"));
  assert.ok(!buttons[0].classes.has("is-active"));
});

test("P-8 · handlePlanPrevisionHorizon ignora un horizonte inválido o repetido", () => {
  let rendered = 0;
  const context = sandboxWith(["handlePlanPrevisionHorizon"], {
    PLAN_PREVISION_HORIZONS,
    planPrevisionHorizonKey: "12m",
    document: { querySelectorAll: () => [] },
    renderPlanPrevision: () => { rendered += 1; },
  });
  context.handlePlanPrevisionHorizon("bogus");
  context.handlePlanPrevisionHorizon("12m");
  assert.equal(rendered, 0);
});

// --- HTML: la pestaña Previsión de #plan tiene su matriz, no solo un enlace ---------------------

test("P-8 · index.html declara la tabla, el selector de horizonte y la leyenda dentro de #plan", () => {
  const planSection = html.slice(html.indexOf('id="plan"'), html.indexOf('id="update-hub"'));
  assert.match(planSection, /id="planPrevisionTable"/);
  assert.match(planSection, /id="planPrevisionHorizon"/);
  assert.match(planSection, /data-plan-prevision-horizon="12m"/);
  assert.match(planSection, /data-plan-prevision-horizon="24m"/);
  assert.match(planSection, /data-plan-prevision-horizon="48m"/);
  assert.match(planSection, /data-plan-prevision-horizon="full"/);
  assert.match(planSection, /id="planPrevisionLegend"/);
});

test("P-8 · el enlace a la Previsión heredada (#prevision) se conserva como complemento, no como único contenido", () => {
  const planSection = html.slice(html.indexOf('id="plan"'), html.indexOf('id="update-hub"'));
  assert.match(planSection, /data-home-nav="prevision"/);
});

// --- Integración: renderPlanPrevision compone cabecera, bloques, ahorro, resultado y colchón ----

test("P-8/P-9 · renderPlanPrevision pinta bloques, Ahorro, Resultado (con el peor mes marcado) y Colchón con su nivel", () => {
  const months = [
    { key: "2026-08", label: "ago 26" },
    { key: "2026-09", label: "sept 26" },
  ];
  const sections = [
    { key: "income:Ingresos", name: "Ingresos", kind: "income", rows: [{ id: "income-a" }] },
    { key: "expense:Gastos fijos", name: "Gastos fijos", kind: "expense", rows: [{ id: "expense-home" }] },
  ];
  const lastSimulation = [
    { detailMonthKey: "2026-08", totalLiquidity: 4000, saving: 800, coreSpend: 750, car: 0, refi: 0 },
    { detailMonthKey: "2026-09", totalLiquidity: 200, saving: 0, coreSpend: 750, car: 0, refi: 0 },
  ];
  const tableEl = { innerHTML: "" };
  const legendEl = { textContent: "" };
  const elements = { planPrevisionTable: tableEl, planPrevisionLegend: legendEl };

  const context = sandboxWith(
    [
      "renderPlanPrevision",
      "planPrevisionMonths",
      "planPrevisionSimulationByMonth",
      "planPrevisionSectionTotal",
      "planPrevisionResultByMonth",
      "planPrevisionRowHtml",
      "planPrevisionHeaderHtml",
    ],
    {
      PLAN_PREVISION_HORIZONS,
      planPrevisionHorizonKey: "12m",
      lastSimulation,
      baseData: { monthlyPlanning: { months: [{ key: "2026-08" }, { key: "2026-09" }] } },
      qs: (id) => elements[id] || null,
      cuadroMandosAllMonths: () => months,
      cuadroMandosSections: () => sections,
      cuadroMandosRowExists: () => true,
      plannedValueForVisualRow: (row, month) => {
        if (row.id === "income-a") return month.key === "2026-08" ? 3000 : 2000;
        return 750;
      },
      mapaCalorFloor: () => ({ value: 1000, source: "la reserva operativa de €1000" }),
      // Módulo real, no un stub a medida: worstMonthOf por defecto busca `detailMonthKey`, y
      // renderPlanPrevision le pasa objetos con `key` — si no se le indica `monthKeyField: "key"`
      // explícitamente, el peor mes sale vacío en silencio. Un stub casero no habría atrapado esto
      // (ya pasó: se detectó en verificación visual con Playwright, no en las pruebas).
      FinanceCanonicalCushion: Cushion,
      isClosedMonthKey: () => false,
      escenarioMotorMonthLabel: (key) => `label(${key})`,
      round2: stubRound2,
      money: stubMoney,
      escapeHtml: stubEscapeHtml,
    },
  );

  context.renderPlanPrevision();

  assert.match(tableEl.innerHTML, /<th>Bloque<\/th>/);
  assert.match(tableEl.innerHTML, /Ingresos/);
  assert.match(tableEl.innerHTML, /Gastos fijos/);
  assert.match(tableEl.innerHTML, /Ahorro/);
  assert.match(tableEl.innerHTML, /Resultado del mes/);
  assert.match(tableEl.innerHTML, /Colchón/);
  // Peor mes (sept 26, colchón 200 < floor 1000) marcado como "ajustado" y resaltado.
  assert.match(tableEl.innerHTML, /plan-prevision-cushion is-ajustado">€200/);
  assert.match(tableEl.innerHTML, /plan-prevision-worst/);
  assert.match(legendEl.textContent, /label\(2026-09\)/);
});

test("P-8/P-9 · renderPlanPrevision no rompe sin meses en el horizonte", () => {
  const tableEl = { innerHTML: "<algo>" };
  const context = sandboxWith(["renderPlanPrevision", "planPrevisionMonths"], {
    PLAN_PREVISION_HORIZONS,
    planPrevisionHorizonKey: "12m",
    lastSimulation: [{ detailMonthKey: "2026-08" }],
    baseData: { monthlyPlanning: { months: [{ key: "2026-08" }] } },
    qs: (id) => (id === "planPrevisionTable" ? tableEl : null),
    cuadroMandosAllMonths: () => [],
  });
  context.renderPlanPrevision();
  assert.equal(tableEl.innerHTML, "");
});
