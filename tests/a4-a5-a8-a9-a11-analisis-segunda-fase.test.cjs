const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Fase 6 · Análisis, segunda fase (17 de agosto): A-4 (cascada del resultado), A-5 (patrimonio neto
// proyectado), A-8 (reparto del ingreso), A-9 (qué se repite) y A-11 (exportar). Ningún cálculo
// financiero nuevo: A-4/A-8 reutilizan `planMesCollect` (aquí sustituida por un doble con datos
// fijos, para probar solo la agregación por bloque, no Plan · Mes otra vez); A-5 reutiliza
// `debtAmortizationSchedule` (D-4) de verdad; A-9 reutiliza `movementMappingKey` (M-7/M-8) de verdad.

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
    formatIsoDate: (v) => v,
    ledgerMonthLabel: (key) => key,
    isClosedMonthKey: () => false,
    csvValue: (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
    sumRows: (rows, fn) => rows.reduce((sum, row) => sum + fn(row), 0),
    ...extra,
  };
}

function months(keys) {
  return keys.map((key) => ({ key, label: key }));
}

// --- analisisPeriodMonths / analisisPeriodLabel (A-4) ------------------------------------------

test("A-4 · «mes en curso» devuelve solo el mes de openMonthCutoffKey", () => {
  const context = sandboxWith(["analisisPeriodMonths"], baseHelpers({
    cuadroMandosAllMonths: () => months(["2026-06", "2026-07", "2026-08"]),
    openMonthCutoffKey: () => "2026-08",
    ANALISIS_PERIOD_PRESETS: [],
  }));
  const result = context.analisisPeriodMonths("mes-actual");
  assert.equal(result.map((m) => m.key).join(","), "2026-08");
});

test("A-4 · un preset de rango recorta hacia atrás desde el mes en curso", () => {
  const context = sandboxWith(["analisisPeriodMonths"], baseHelpers({
    cuadroMandosAllMonths: () => months(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]),
    openMonthCutoffKey: () => "2026-06",
    ANALISIS_PERIOD_PRESETS: [{ id: "trimestre", label: "Último trimestre", months: 3 }],
  }));
  const result = context.analisisPeriodMonths("trimestre");
  assert.deepEqual(result.map((m) => m.key), ["2026-04", "2026-05", "2026-06"]);
});

test("A-4 · un mes concreto (cerrado o no) se selecciona por su clave", () => {
  const context = sandboxWith(["analisisPeriodMonths"], baseHelpers({
    cuadroMandosAllMonths: () => months(["2026-06", "2026-07"]),
    openMonthCutoffKey: () => "2026-07",
    ANALISIS_PERIOD_PRESETS: [],
  }));
  assert.equal(context.analisisPeriodMonths("2026-06").map((m) => m.key).join(","), "2026-06");
});

// --- analisisBlockSums / analisisSavingSum / analisisCascadaRows (A-4) --------------------------

function planMesCollectStub(fixtures) {
  return (month) => fixtures[month.key] || { income: [], expense: [] };
}

test("A-4 · suma «usado» por bloque a lo largo de varios meses, contando cuántas filas tienen real", () => {
  const fixtures = {
    "2026-06": {
      income: [{ sectionName: "Ingresos", usado: 3000, hasActual: true }],
      expense: [{ sectionName: "Gastos fijos", usado: 1000, hasActual: true }],
    },
    "2026-07": {
      income: [{ sectionName: "Ingresos", usado: 3200, hasActual: false }],
      expense: [{ sectionName: "Gastos fijos", usado: 1100, hasActual: false }],
    },
  };
  const context = sandboxWith(["analisisBlockSums"], baseHelpers({ planMesCollect: planMesCollectStub(fixtures) }));
  const totals = context.analisisBlockSums(months(["2026-06", "2026-07"]));
  assert.equal(totals.get("Ingresos").sum, 6200);
  assert.equal(totals.get("Ingresos").hasActual, 1);
  assert.equal(totals.get("Gastos fijos").sum, 2100);
});

test("A-4 · analisisCascadaRows resta gastos y ahorro del ingreso para el resultado", () => {
  const fixtures = {
    "2026-08": {
      income: [{ sectionName: "Ingresos", usado: 4320, hasActual: true }],
      expense: [
        { sectionName: "Gastos fijos", usado: 1352, hasActual: true },
        { sectionName: "Gastos variables", usado: 1310, hasActual: false },
        { sectionName: "Financiaciones", usado: 640, hasActual: true },
      ],
    },
  };
  const context = sandboxWith(["analisisBlockSums", "analisisSavingSum", "analisisCascadaRows"], baseHelpers({
    planMesCollect: planMesCollectStub(fixtures),
    lastSimulation: [{ detailMonthKey: "2026-08", saving: 400 }],
    ANALISIS_CASCADA_BLOCKS: ["Gastos fijos", "Gastos variables", "Financiaciones"],
  }));
  const cascada = context.analisisCascadaRows(months(["2026-08"]));
  assert.equal(cascada.resultado, 4320 - 1352 - 1310 - 640 - 400);
  const ahorroRow = cascada.rows.find((row) => row.label === "Ahorro");
  assert.equal(ahorroRow.value, -400);
  assert.equal(cascada.blocksPresent, 5);
  assert.equal(cascada.blocksWithReal, 4, "Ingresos, Gastos fijos, Financiaciones y Ahorro (con simulación) tienen real");
});

test("A-4 · un mes sin ninguna fila de simulación dice que el ahorro no tiene dato, no lo pone a cero por definición", () => {
  const context = sandboxWith(["analisisSavingSum"], baseHelpers({ lastSimulation: [] }));
  const info = context.analisisSavingSum(months(["2026-08"]));
  assert.equal(info.matched, 0);
  assert.equal(info.sum, 0);
});

// --- analisisDebtLiveSeries / analisisNetWorthSeries / milestones (A-5) --------------------------

test("A-5 · la deuda viva suma el saldo declarado de cada contrato, mes a mes", () => {
  const context = sandboxWith(["analisisDebtLiveSeries", "debtAmortizationSchedule"], baseHelpers({
    canonicalDebtContractRows: () => [{ currentPrincipal: 1000, currentPayment: 200, apr: 0 }],
  }));
  const series = context.analisisDebtLiveSeries(months(["2026-01", "2026-02", "2026-03"]));
  assert.equal(series[0], 800);
  assert.equal(series[1], 600);
  assert.equal(series[2], 400);
});

test("A-5 · el patrimonio neto es liquidez menos deuda viva, sin dato cuando falta la liquidez simulada", () => {
  const context = sandboxWith(["analisisDebtLiveSeries", "debtAmortizationSchedule", "analisisNetWorthSeries"], baseHelpers({
    canonicalDebtContractRows: () => [{ currentPrincipal: 1000, currentPayment: 200, apr: 0 }],
  }));
  const simRows = [{ detailMonthKey: "2026-01", totalLiquidity: 500 }];
  const series = context.analisisNetWorthSeries(months(["2026-01", "2026-02"]), simRows);
  assert.equal(series[0].netWorth, 500 - 800);
  assert.equal(series[1].netWorth, null);
});

test("A-5 · los hitos marcan hoy, el primer cruce a cero y el fin del plan", () => {
  const context = sandboxWith(["analisisNetWorthMilestones"], baseHelpers());
  const series = [
    { key: "2026-01", label: "ene 26", netWorth: -500 },
    { key: "2026-02", label: "feb 26", netWorth: -100 },
    { key: "2026-03", label: "mar 26", netWorth: 200 },
    { key: "2026-04", label: "abr 26", netWorth: 900 },
  ];
  const milestones = context.analisisNetWorthMilestones(series);
  assert.equal(milestones.hoy.netWorth, -500);
  assert.equal(milestones.cruce.key, "2026-03");
  assert.equal(milestones.finDelPlan.key, "2026-04");
});

test("A-5 · sin ningún mes con dato, no hay hitos que mostrar", () => {
  const context = sandboxWith(["analisisNetWorthMilestones"], baseHelpers());
  assert.equal(context.analisisNetWorthMilestones([{ key: "2026-01", netWorth: null }]), null);
});

// --- analisisIncomeSplit (A-8) -------------------------------------------------------------------

test("A-8 · los segmentos (incluido «sin asignar») suman el 100 % del ingreso", () => {
  const fixtures = {
    "2026-08": {
      income: [{ sectionName: "Ingresos", usado: 1000, hasActual: true }],
      expense: [
        { sectionName: "Gastos fijos", usado: 400, hasActual: true },
        { sectionName: "Financiaciones", usado: 100, hasActual: true },
      ],
    },
  };
  const context = sandboxWith(["analisisSavingSum", "analisisIncomeSplit"], baseHelpers({
    planMesCollect: planMesCollectStub(fixtures),
    lastSimulation: [{ detailMonthKey: "2026-08", saving: 200 }],
  }));
  const split = context.analisisIncomeSplit({ key: "2026-08", label: "ago 26" });
  const totalPct = split.groups.reduce((sum, group) => sum + group.pct, 0);
  assert.equal(Math.round(totalPct), 100);
  const sinAsignar = split.groups.find((group) => group.label === "Sin asignar");
  assert.equal(sinAsignar.value, 1000 - 400 - 100 - 200);
});

test("A-8 · un mes que gasta más que su ingreso deja «sin asignar» en negativo, no lo recorta a cero", () => {
  const fixtures = {
    "2026-08": {
      income: [{ sectionName: "Ingresos", usado: 500, hasActual: true }],
      expense: [{ sectionName: "Gastos fijos", usado: 700, hasActual: true }],
    },
  };
  const context = sandboxWith(["analisisSavingSum", "analisisIncomeSplit"], baseHelpers({
    planMesCollect: planMesCollectStub(fixtures),
    lastSimulation: [],
  }));
  const split = context.analisisIncomeSplit({ key: "2026-08", label: "ago 26" });
  const sinAsignar = split.groups.find((group) => group.label === "Sin asignar");
  assert.equal(sinAsignar.value, -200);
});

// --- analisisRecurringWindow / analisisRecurringItems (A-9) ---------------------------------------

function movementHelpers() {
  return sandboxWith(
    ["analisisRecurringWindow", "analisisRecurringItems", "analisisRecurringGrowthNote", "movementMappingKey", "movementDisplayName", "movementKindFromAmount", "normalizedText", "dateFromMonthKey", "addMonths", "monthKey"],
    baseHelpers()
  );
}

test("A-9 · la ventana son dos trimestres consecutivos terminando en el mes de referencia", () => {
  const context = movementHelpers();
  const ventana = context.analisisRecurringWindow("2026-08");
  assert.equal(ventana.current.join(","), "2026-06,2026-07,2026-08");
  assert.equal(ventana.previous.join(","), "2026-03,2026-04,2026-05");
});

test("A-9 · un concepto solo cuenta como recurrente si aparece en los dos trimestres", () => {
  const context = movementHelpers();
  const transactions = [
    { date: "2026-08-01", amount: -20, movement: "Netflix", details: "" },
    { date: "2026-07-01", amount: -20, movement: "Netflix", details: "" },
    { date: "2026-04-01", amount: -20, movement: "Netflix", details: "" },
    { date: "2026-08-05", amount: -50, movement: "Compra unica", details: "" },
  ];
  const items = context.analisisRecurringItems(transactions, "2026-08");
  const labels = items.map((item) => item.label);
  assert.ok(labels.some((label) => label.includes("Netflix")));
  assert.ok(!labels.some((label) => label.includes("Compra unica")), "una compra sin equivalente en el trimestre anterior no es recurrente");
});

test("A-9 · un gasto que sube frente al trimestre anterior se marca «creció sin decisión»", () => {
  const context = movementHelpers();
  const transactions = [
    { date: "2026-08-01", amount: -30, movement: "Luz", details: "" },
    { date: "2026-04-01", amount: -20, movement: "Luz", details: "" },
  ];
  const items = context.analisisRecurringItems(transactions, "2026-08");
  assert.equal(items[0].grewWithoutDecision, true);
  assert.equal(items[0].pct, 50);
  const note = context.analisisRecurringGrowthNote(items);
  assert.match(note, /Luz/);
  assert.match(note, /Nadie decidió eso/);
});

test("A-9 · sin ningún concepto que crezca, no hay nota de aviso", () => {
  const context = movementHelpers();
  const transactions = [
    { date: "2026-08-01", amount: -20, movement: "Alquiler", details: "" },
    { date: "2026-04-01", amount: -20, movement: "Alquiler", details: "" },
  ];
  const items = context.analisisRecurringItems(transactions, "2026-08");
  assert.equal(context.analisisRecurringGrowthNote(items), "");
});

// --- analisisExportCsvContent (A-11) ---------------------------------------------------------------

test("A-11 · el CSV incluye la banda de colchón, el patrimonio neto y la cascada del periodo", () => {
  const context = sandboxWith(["analisisExportCsvContent"], baseHelpers());
  const csv = context.analisisExportCsvContent({
    periodLabel: "Mes en curso",
    cushion: [{ label: "ago 26", monthsValue: 2.5, level: "ajustado" }],
    netWorth: [{ label: "ago 26", netWorth: -500 }],
    cascada: { rows: [{ label: "Ingresos", value: 1000 }], resultado: 200 },
    split: { ingreso: 1000, groups: [{ label: "Gastos fijos", value: 400, pct: 40 }] },
    recurring: [{ label: "Netflix", current: 20, pct: 0 }],
  });
  assert.match(csv, /Colchón \(meses\)/);
  assert.match(csv, /Patrimonio neto/);
  assert.match(csv, /Ingresos/);
  assert.match(csv, /Netflix/);
});
