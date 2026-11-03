const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Clasificar · «+ Nueva partida» (2/11/2026): crear una partida sin salir de Clasificar cuando no encaja ninguna de
// las que hay. Comprueba (1) que se ofrece bajo el selector «Elige una partida…», (2) que sale con previsto 0 € en
// TODOS los meses del plan desde el primer movimiento del grupo, sin los firmados (una partida personalizada solo existe
// en los meses con fila: con una sola, los reales de los demás meses no contarían), (3) que queda elegida y «Aceptar»
// crea la regla hacia ella, (4) que un nombre repetido elige la que ya hay y (5) que sin nombre no crea nada.
// Cifras inventadas.

const { codigoApp } = require("./helpers/codigo-app.cjs");
const root = path.resolve(__dirname, "..");
const appCode = codigoApp();
// El rango de meses es el mismo que usa Cierre (customSeriesMonthsFrom, app.js): se prueba el de verdad.
const mesesDesde = appCode.slice(appCode.indexOf("function customSeriesMonthsFrom("), appCode.indexOf("function bankActualTotals() {"));
const clas = fs.readFileSync(path.join(root, "views/clasificar-v2.js"), "utf8");
const css = fs.readFileSync(path.join(root, "tema-v2.css"), "utf8");

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map((key) => ({ key, label: key }));

function sandbox({ transactions = [], signed = [], closed = [] } = {}) {
  const calls = [];
  const dialog = { open: false, innerHTML: "", dataset: {}, addEventListener() {}, querySelector: () => null, showModal() { this.open = true; }, close() { this.open = false; } };
  const fixed = [
    { id: "super", kind: "expense", sectionName: "Gastos variables", label: "Supermercado" },
    { id: "hogar", kind: "expense", sectionName: "Gastos fijos", label: "Gastos del hogar" },
  ];
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value) => `${Number(value).toFixed(2).replace(".", ",")} €`,
    round2: (value) => Math.round(Number(value) * 100) / 100,
    movementKindFromAmount: (amount) => (Number(amount) >= 0 ? "income" : "expense"),
    movementMappingKey: (row) => `${Number(row.amount) >= 0 ? "income" : "expense"}|${String(row.movement).toLowerCase()}|`,
    movementDisplayName: (row) => row.movement,
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    normalizedText: (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    monthByKey: (key) => MONTHS.find((m) => m.key === key) || null,
    isClosedMonthKey: (key) => closed.includes(key) || signed.includes(key),
    isSignedClosedMonthKey: (key) => signed.includes(key),
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    applyMovementMappingsToActuals: () => 0,
    buildPendingMovementMappings: () => [],
    datosImportarRefreshRowsForMappings: () => {},
    saveIncomeActuals: () => {},
    saveExpenseActuals: () => {},
    saveCustomPlanningRows: () => calls.push("saveCustomPlanningRows"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAll"),
    showUndoToast: () => {},
    announceStatus: (message) => calls.push(`status:${message}`),
    baseData: {
      transactions,
      monthlyPlanning: {
        months: MONTHS,
        sections: [
          { name: "Gastos fijos", kind: "expense", rows: [] },
          { name: "Gastos variables", kind: "expense", rows: [] },
          { name: "Ingresos", kind: "income", rows: [] },
        ],
      },
    },
    customPlanningRows: [],
    movementMappings: {},
    incomeActuals: {},
    expenseActuals: {},
    pendingMovementMappings: [],
    qs: (id) => (id === "clasificarV2" ? dialog : null),
    Intl,
    globalThis: {},
  };
  // Como availableSeriesRows de app.js: las del plan y una por cada serie personalizada.
  context.availableSeriesRows = (kind) => {
    const seen = new Set();
    const custom = context.customPlanningRows.filter((row) => row.kind === kind && !seen.has(row.id) && seen.add(row.id));
    return fixed.filter((row) => row.kind === kind).concat(custom);
  };
  context.planningRowBySeriesKey = (kind, key) => context.availableSeriesRows(kind).find((row) => `${row.kind}|${row.id}` === key) || null;
  context.mappingForMovement = (row) => {
    const stored = context.movementMappings[context.movementMappingKey(row)];
    return stored ? { row: context.planningRowBySeriesKey(stored.kind, stored.rowKey) } : null;
  };
  vm.createContext(context);
  vm.runInContext(mesesDesde, context);
  vm.runInContext(clas, context);
  return { context, dialog, calls };
}

const tx = (date, movement, amount) => ({ date, month: date.slice(0, 7), movement, details: "", amount });
const RECIBOS = [tx("2026-08-05", "RECIBO FINANCIERA", -40), tx("2026-09-05", "RECIBO FINANCIERA", -40), tx("2026-10-05", "RECIBO FINANCIERA", -120)];

test("sin propuesta, bajo «Elige una partida…» se ofrece «+ Nueva partida»; el formulario pide nombre y bloque", () => {
  const { context, dialog } = sandbox({ transactions: RECIBOS });
  context.clasificarV2Open();
  assert.match(dialog.innerHTML, /<select id="clasificarV2Otra"[\s\S]*data-clas-v2-nueva>¿No está\? \+ Nueva partida<\/button>/);
  vm.runInContext("clasV2NewOpen = true; clasV2Render();", context);
  const html = dialog.innerHTML;
  assert.ok(!html.includes('id="clasificarV2Otra"'), "el formulario sustituye al selector");
  assert.match(html, /Nueva partida de gasto/);
  assert.match(html, /<input id="clasificarV2NuevaNombre" data-clas-v2-nueva-nombre type="text" maxlength="60"/);
  assert.match(html, /<select id="clasificarV2NuevaBloque" data-clas-v2-nueva-bloque><option value="Gastos fijos" selected>Gastos fijos<\/option><option value="Gastos variables">/, "solo los bloques de gasto");
  assert.ok(!html.includes(">Ingresos<"));
  assert.match(html, /Sale con previsto 0 € en todos los meses abiertos: no cambia el plan/);
  assert.match(html, /«Gastos fijos» ya tiene una partida: mira antes si alguna sirve\./);
  assert.match(html, /data-clas-v2-nueva-cancelar>Cancelar<\/button>[\s\S]*data-clas-v2-nueva-crear>Crear y elegir<\/button>/);
});

test("crear: previsto 0 € en cada mes del plan desde el primer movimiento del grupo, sin los firmados; queda elegida y Aceptar crea la regla", () => {
  const { context, dialog, calls } = sandbox({ transactions: RECIBOS, signed: ["2026-07", "2026-08"], closed: ["2026-09"] });
  context.clasificarV2Open();
  vm.runInContext('clasV2NewOpen = true; clasV2NewName = "  Financiaciones  "; clasV2NewSection = "Gastos fijos"; clasV2CreatePartida();', context);
  const rows = context.customPlanningRows;
  assert.deepEqual(rows.map((row) => row.monthKey), ["2026-09", "2026-10", "2026-11", "2026-12"], "agosto está firmado; septiembre, cerrado por fecha pero sin firmar, sí (sus reales se recalculan)");
  assert.equal(new Set(rows.map((row) => row.id)).size, 1, "una sola serie");
  rows.forEach((row) => assert.deepEqual({ ...row, id: "x" }, { id: "x", custom: true, kind: "expense", sectionName: "Gastos fijos", label: "Financiaciones", monthKey: row.monthKey, plannedValue: 0 }));
  assert.ok(calls.includes("saveCustomPlanningRows"));
  assert.match(calls.find((c) => c.startsWith("status:")), /Partida «Financiaciones» creada en Gastos fijos con previsto 0 €, de 2026-09 a 2026-12\. Está elegida/);
  assert.match(dialog.innerHTML, /Elegida · Gastos fijos<\/span><b>Financiaciones<\/b>/);
  assert.ok(!dialog.innerHTML.includes("clasificarV2NuevaNombre"), "el formulario se cierra");
  context.clasV2Accept();
  assert.equal(context.movementMappings["expense|recibo financiera|"].rowKey, `expense|${rows[0].id}`);
  assert.equal(context.movementMappings["expense|recibo financiera|"].label, "Gastos fijos · Financiaciones");
});

test("si el grupo empieza después del primer mes abierto, la partida arranca en el primer mes abierto", () => {
  const { context } = sandbox({ transactions: [tx("2026-12-01", "NUEVO COMERCIO", -9)], signed: ["2026-07", "2026-08", "2026-09"] });
  context.clasificarV2Open();
  vm.runInContext('clasV2NewName = "Cosas nuevas"; clasV2NewSection = "Gastos variables"; clasV2CreatePartida();', context);
  assert.deepEqual(context.customPlanningRows.map((row) => row.monthKey), ["2026-10", "2026-11", "2026-12"]);
});

test("un nombre que ya existe elige esa partida en vez de duplicarla; sin nombre no crea nada y lo dice", () => {
  const { context, dialog, calls } = sandbox({ transactions: RECIBOS });
  context.clasificarV2Open();
  vm.runInContext('clasV2NewOpen = true; clasV2NewName = "supermércado"; clasV2CreatePartida();', context);
  assert.equal(context.customPlanningRows.length, 0);
  assert.match(dialog.innerHTML, /Elegida · Gastos variables<\/span><b>Supermercado<\/b>/);
  assert.ok(calls.some((c) => c.includes("Ya había una partida «Supermercado» en Gastos variables")));

  vm.runInContext('clasV2NewOpen = true; clasV2NewName = "   "; clasV2CreatePartida();', context);
  assert.equal(context.customPlanningRows.length, 0);
  assert.match(dialog.innerHTML, /<p class="clas-v2-nueva-error" id="clasificarV2NuevaError" role="alert">Ponle un nombre a la partida\.<\/p>/);
  assert.match(dialog.innerHTML, /aria-invalid="true" aria-describedby="clasificarV2NuevaError"/);
});

test("pasar de grupo o saltar cierra el formulario; Esc lo cierra sin cerrar el panel y ↵ en el nombre crea", () => {
  const { context, dialog } = sandbox({ transactions: [...RECIBOS, tx("2026-10-07", "OTRO", -5)] });
  context.clasificarV2Open();
  vm.runInContext('clasV2NewOpen = true; clasV2NewName = "a medias"; clasV2Skip();', context);
  assert.equal(vm.runInContext("clasV2NewOpen || clasV2NewName", context), "");
  assert.ok(!dialog.innerHTML.includes("clasificarV2NuevaNombre"));
  assert.match(clas, /if \(clasV2NewOpen && event\.key === "Escape"\) \{\s*event\.preventDefault\(\);\s*dialog\.dataset\.escNueva = "1";/);
  assert.match(clas, /dialog\.addEventListener\("cancel", \(event\) => \{\s*if \(dialog\.dataset\.escNueva !== "1"\) return;/);
  assert.match(clas, /if \(event\.key === "Enter" && event\.target\.matches\("\[data-clas-v2-nueva-nombre\]"\)\) \{\s*event\.preventDefault\(\);\s*return clasV2CreatePartida\(\);/);
  assert.match(clas, /if \(event\.target\.matches\("\[data-clas-v2-nueva-nombre\]"\)\) clasV2NewName = event\.target\.value;/);
});

test("estilos bajo el tema v2, con objetivos táctiles de 44 px", () => {
  assert.match(css, /:root\[data-tema="v2"\] \.clas-v2-nueva-enlace \{[^}]*min-height: 44px;/);
  assert.match(css, /:root\[data-tema="v2"\] \.clas-v2-nueva input,\s*:root\[data-tema="v2"\] \.clas-v2-nueva select \{\s*min-height: 44px;/);
});
