const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// H-10 · "ninguna cifra se estima en silencio: si falta el dato de origen, se muestra «—» y su
// motivo". Una prueba por cada indicador de Hoy (H-1, H-3/H-3b, H-4, H-5, H-6) que puede llegar
// a faltarle su dato de origen, comprobando que responde con un valor honesto, no fabricado.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
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
  const context = {
    money: (value) => `€${Number(value || 0).toFixed(2)}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    sumRows: (rows, fn) => (rows || []).reduce((sum, row) => sum + Number(fn(row) || 0), 0),
    escapeHtml: (value) => String(value ?? ""),
    registrarMesMonthName: (key) => `mes-${key}`,
    debtTargetDisplayName: (target) => String(target || "deuda"),
    escenarioMotorMonthLabel: (value) => String(value || ""),
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("H-10 · H-1 cabecera: sin ningún indicador en rojo o ámbar, el estado agregado no inventa un aviso", () => {
  const { homeOverallStatus } = sandboxWith(["homeOverallStatus"]);
  assert.equal(homeOverallStatus(["good", "good"]).tone, "good");
  assert.equal(homeOverallStatus(["good", "good"]).label, "Estable");
  assert.equal(homeOverallStatus([]).tone, "good");
});

test("H-10 · H-1 cabecera: un solo indicador en peligro basta para que el estado agregado lo diga", () => {
  const { homeOverallStatus } = sandboxWith(["homeOverallStatus"]);
  assert.equal(homeOverallStatus(["good", "danger", "warn"]).tone, "danger");
  assert.equal(homeOverallStatus(["good", "warn"]).tone, "warn");
});

test("H-10 · H-3 cobertura: sin fecha de ingreso o sin gasto diario, la cifra es «—» y la insignia lo dice", () => {
  const { homeCoverageBadge } = sandboxWith(["homeCoverageBadge"]);
  const noDate = homeCoverageBadge({ days: null, dailyOutflow: null, confidence: "estimated" });
  assert.equal(noDate.tone, "warn");
  assert.equal(noDate.label, "Datos insuficientes");
  const noOutflow = homeCoverageBadge({ days: 5, dailyOutflow: null, confidence: "estimated" });
  assert.equal(noOutflow.label, "Datos insuficientes");
});

test("H-10 · H-3 cobertura: con dato suficiente, la insignia refleja la confianza real, no un valor fijo", () => {
  const { homeCoverageBadge } = sandboxWith(["homeCoverageBadge"]);
  assert.equal(homeCoverageBadge({ days: 12, dailyOutflow: 30, confidence: "observed" }).label, "Dato observado");
  assert.equal(homeCoverageBadge({ days: 12, dailyOutflow: 30, confidence: "rule" }).label, "Regla aprendida");
});

test("H-10 · H-3 cobertura: con fecha pero sin gasto diario, la necesidad no se rellena con 0 €", () => {
  const captured = [];
  const stubQs = (id) => {
    const el = { textContent: "", className: "", innerHTML: "" };
    captured.push([id, el]);
    return el;
  };
  const context = sandboxWith(["renderHomeCoverageCard", "homeCoverageBadge"], {
    qs: stubQs,
    shortDate: (v) => `fecha:${v}`,
    HOME_MISSING_VALUE: "—",
  });
  context.renderHomeCoverageCard({ days: 25, dailyOutflow: null, required: null, margin: null, nextIncomeDate: "2026-09-08", confidence: "estimated" });
  const summaryEl = captured.find(([id]) => id === "e6CoverageSummary")[1];
  assert.match(summaryEl.innerHTML, /necesidad —, sin gasto diario conocido/);
  assert.ok(!/necesidad 0,00/.test(summaryEl.innerHTML), "no debe fabricar una necesidad de 0 € cuando el gasto diario es desconocido");
});

test("H-10 · H-3b editor: sin guardado propio ni aprendizaje suficiente, pide el dato en vez de fingirlo aprendido", () => {
  const { homeCoverageEditorBadge } = sandboxWith(["homeCoverageEditorBadge"]);
  const noData = homeCoverageEditorBadge({ days: null, dailyOutflow: null }, { nextIncomeDate: "", dailyOutflow: null });
  assert.equal(noData.tone, "warn");
  assert.equal(noData.label, "Requiere tu dato");
});

test("H-10 · H-3b editor: distingue guardado del usuario frente a aprendido de movimientos", () => {
  const { homeCoverageEditorBadge } = sandboxWith(["homeCoverageEditorBadge"]);
  const saved = homeCoverageEditorBadge({ days: 5, dailyOutflow: 20 }, { nextIncomeDate: "2026-09-01", dailyOutflow: null });
  assert.equal(saved.label, "Guardado");
  const learned = homeCoverageEditorBadge({ days: 5, dailyOutflow: 20 }, { nextIncomeDate: "", dailyOutflow: null });
  assert.equal(learned.label, "Aprendido");
});

// H-6 (auditoría del 15 de agosto): stubs comunes de previsto para homeMonthAtAGlance — sin mes
// encontrado, plannedExpense es null y las filas nuevas responden con "—", no con un 0 fabricado.
function homeMonthAtAGlanceStubs({ month = null, plannedExpenseRows = [] } = {}) {
  return {
    monthByKey: () => month,
    baseData: { monthlyPlanning: { months: month ? [month] : [] } },
    planningSectionsForMonth: () => [{ rows: plannedExpenseRows }],
    plannedValueForVisualRow: (row) => Number(row.planned || 0),
    registrarMesSignedMoney: (value) => `${value > 0 ? "+" : ""}€${Number(value).toFixed(2)}`,
  };
}

test("H-10 · H-6 mes en una línea: sin movimientos este mes, ninguna fila finge un dato — lo dice la nota de confianza", () => {
  const { homeMonthAtAGlance } = sandboxWith(["homeMonthAtAGlance"], {
    p2MovementRows: () => [],
    ...homeMonthAtAGlanceStubs(),
  });
  const glance = homeMonthAtAGlance("2026-08-14", 250);
  assert.equal(glance.movementCount, 0);
  assert.equal(glance.confidenceLabel, "sin movimientos todavía");
  const unclassifiedRow = glance.rows.find((row) => row.label === "Sin clasificar");
  assert.equal(unclassifiedRow.value, "Ninguno");
});

test("H-10 · H-6 mes en una línea: movimientos sin clasificar se cuentan y se dice cuántos, no se ocultan", () => {
  const movements = [
    { month: "2026-08", amount: 1200, reconciled: true },
    { month: "2026-08", amount: -400, reconciled: true },
    { month: "2026-08", amount: -60, reconciled: false },
  ];
  const { homeMonthAtAGlance } = sandboxWith(["homeMonthAtAGlance"], {
    p2MovementRows: () => movements,
    ...homeMonthAtAGlanceStubs(),
  });
  const glance = homeMonthAtAGlance("2026-08-14", 250);
  assert.equal(glance.movementCount, 3);
  assert.equal(glance.reconciledCount, 2);
  const unclassifiedRow = glance.rows.find((row) => row.label === "Sin clasificar");
  assert.match(unclassifiedRow.value, /^1 ·/);
});

test("H-10 · H-6 (auditoría 15 de agosto) · sin mes encontrado en el plan, Gasto previsto y Desviación dicen «—», no fabrican un previsto de 0€", () => {
  const { homeMonthAtAGlance } = sandboxWith(["homeMonthAtAGlance"], {
    p2MovementRows: () => [],
    ...homeMonthAtAGlanceStubs({ month: null }),
  });
  const glance = homeMonthAtAGlance("2026-08-14", 250);
  const planned = glance.rows.find((row) => row.label === "Gasto previsto");
  const deviation = glance.rows.find((row) => row.label === "Desviación");
  assert.equal(planned.value, "—");
  assert.equal(deviation.value, "—");
});

test("H-10 · H-6 (auditoría 15 de agosto) · con mes encontrado, Ingresos/Gasto previsto/Gasto real a hoy/Desviación comparan lo previsto contra lo real, no solo cifras reales", () => {
  const movements = [
    { month: "2026-08", amount: 4320, reconciled: true },
    { month: "2026-08", amount: -1412, reconciled: true },
  ];
  const { homeMonthAtAGlance } = sandboxWith(["homeMonthAtAGlance"], {
    p2MovementRows: () => movements,
    ...homeMonthAtAGlanceStubs({ month: { key: "2026-08" }, plannedExpenseRows: [{ planned: 2000 }, { planned: 1075 }] }),
  });
  const glance = homeMonthAtAGlance("2026-08-14", 250);
  assert.equal(glance.rows.find((row) => row.label === "Ingresos").value, "€4320.00");
  assert.equal(glance.rows.find((row) => row.label === "Gasto previsto").value, "€3075.00");
  assert.equal(glance.rows.find((row) => row.label === "Gasto real a hoy").value, "€1412.00");
  const deviation = glance.rows.find((row) => row.label === "Desviación");
  assert.equal(deviation.value, "€-1663.00");
  assert.equal(deviation.tone, "positive", "gastar menos de lo previsto es una desviación buena");
  assert.equal(glance.rows.some((row) => row.label === "Ingresos reales" || row.label === "Gastos reales" || row.label === "Margen del mes" || row.label === "Movimientos registrados"), false, "las etiquetas antiguas de solo-real ya no están");
});

test("H-10 · H-5 decisiones abiertas: sin ofertas, alertas, deuda candidata ni proyectos, no se fabrica una decisión", () => {
  const { homeOpenOfferInsight, homeDecisionCandidates } = sandboxWith(["homeOpenOfferInsight", "homeDecisionCandidates"], {
    evaluatedUxAlerts: () => [],
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [],
    homeImportSessionCandidate: () => null,
  });
  const decisions = homeDecisionCandidates({
    actionCenter: { actions: [] },
    offer: null,
    debtPriorities: [],
    loadedDecisions: [],
    debtRatioStatus: "good",
  });
  assert.equal(decisions.length, 0);
  assert.equal(homeOpenOfferInsight(null), null);
});

test("H-10 · H-5 decisiones abiertas: una oferta con vencimiento real se antepone a las que no tienen fecha", () => {
  const { homeDecisionCandidates } = sandboxWith(["homeOpenOfferInsight", "homeDecisionCandidates"], {
    evaluatedUxAlerts: () => [],
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [],
    homeImportSessionCandidate: () => null,
  });
  const decisions = homeDecisionCandidates({
    actionCenter: { actions: [{ id: "a1", rank: 1, tone: "neutral", title: "Acción de rango fijo", text: "x" }] },
    offer: { counterpart: "Banco", amount: 5000, expiresAt: "2026-09-01" },
    debtPriorities: [],
    loadedDecisions: [],
    debtRatioStatus: "good",
  });
  assert.equal(decisions[0].title, "Decisión de deuda abierta");
  assert.equal(decisions[0].expiresAt, "2026-09-01");
});
