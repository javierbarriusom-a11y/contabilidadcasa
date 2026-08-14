const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const experience = read("e17-experience.js");
const worker = read("service-worker.js");

// Mismo truco que en el resto de la suite: `app.js` es un script de navegador y no se puede
// `require`, así que se extraen las funciones por nombre balanceando llaves y se ejecutan contra
// dobles de las piezas que consultan.
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  // Salta la lista de parámetros contando paréntesis antes de buscar la llave del cuerpo: un
  // parámetro con valor por defecto tipo `meta = {}` tiene su propio `{}` que, si se contara
  // primero, se confundiría con el cuerpo y cortaría la función a mitad de la firma.
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

function extractConst(name) {
  const match = app.match(new RegExp(`^const ${name} = .*$`, "m"));
  assert.ok(match, `No existe la constante ${name} en app.js`);
  return match[0];
}

// Un "hogar" mínimo con dos partidas (una de ingreso, una de gasto) y una cartera vacía de
// movimientos: lo justo para que las funciones de clasificación, sugerencia e impacto tengan algo
// real contra lo que comparar, sin arrastrar toda la maquinaria de la app.
const SUELDO = { kind: "income", id: "row-sueldo", label: "Nomina", sectionName: "INGRESOS" };
const LUZ = { kind: "expense", id: "row-luz", label: "Iberdrola electricidad", sectionName: "GASTOS FIJOS" };
const MONTHS = [{ key: "2026-07", label: "julio 2026" }, { key: "2026-08", label: "agosto 2026" }];

function baseSandbox({ transactions = [], mappings = {}, ignored = {}, closedMonths = [] } = {}) {
  const storage = new Map();
  storage.set("datos-importar-ignorados:test", JSON.stringify(ignored));
  const incomeActuals = {};
  const expenseActuals = {};
  const context = {
    Math, Number, JSON, Array, String, Boolean, Date, Map, Set, console,
    // V6-2 · datosImportarBuildRows pasa ahora la ventana configurable de Ajustes en vez del valor
    // por defecto implícito de la función; `state` vacío reproduce «sin configurar» → 7 días.
    state: {},
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    normalizedText: (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(),
    storageKey: (name) => `${name}:test`,
    storageGet: (key, fallback = "") => storage.get(key) ?? fallback,
    storageSet: (key, value) => storage.set(key, value),
    baseData: { transactions, monthlyPlanning: { months: MONTHS } },
    movementMappings: mappings,
    incomeActuals,
    expenseActuals,
    actualsForKind: (kind) => (kind === "income" ? incomeActuals : expenseActuals),
    isClosedMonthKey: (key) => closedMonths.includes(key),
    availableSeriesRows: (kind) => [SUELDO, LUZ].filter((row) => row.kind === kind),
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    monthByKey: (key, months) => (months || MONTHS).find((month) => month.key === key) || null,
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
  };
  vm.createContext(context);
  [
    extractConst("DATOS_IMPORTAR_DRAFT_KEY"),
    extractConst("DATOS_IMPORTAR_IGNORED_KEY"),
    extractConst("DATOS_IMPORTAR_HISTORY_KEY"),
    extractConst("DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS"),
    extractFunction("datosImportarContentHash"),
    extractFunction("datosImportarLoadIgnored"),
    extractFunction("datosImportarSaveIgnored"),
    extractFunction("datosImportarLoadAppliedHashes"),
    extractFunction("datosImportarRecordAppliedHash"),
    extractFunction("datosImportarFindAppliedHash"),
    extractFunction("datosImportarLoadDraft"),
    extractFunction("datosImportarSaveDraft"),
    extractFunction("datosImportarClearDraft"),
    extractFunction("daysBetweenIsoDates"),
    extractFunction("datosImportarDuplicateCandidates"),
    extractFunction("duplicateWindowDays"),
    extractFunction("movementKindFromAmount"),
    extractFunction("movementMappingKey"),
    extractFunction("planningRowBySeriesKey"),
    extractFunction("exactMovementPlanningMatch"),
    extractFunction("mappingForMovement"),
    extractFunction("transactionIdentity"),
    extractFunction("mergeTransactions"),
    extractFunction("datosImportarPriorClassification"),
    extractFunction("datosImportarSuggestionFor"),
    extractFunction("datosImportarBuildRows"),
    extractFunction("datosImportarCounters"),
    extractFunction("datosImportarRowsPendingClassification"),
    extractFunction("datosImportarRowsPendingDuplicate"),
    extractFunction("datosImportarIncludedTransactions"),
    extractFunction("datosImportarSessionMappingsDelta"),
    extractFunction("datosImportarComputeActuals"),
    extractFunction("datosImportarImpactRows"),
    extractFunction("movementCsvHeaderKey"),
    extractFunction("splitDataLine"),
    extractFunction("parseAmount"),
    extractFunction("isoFromWorkbookValue"),
    extractFunction("classifyTransaction"),
    extractFunction("parseMovementsFromCsvText"),
    extractFunction("datosImportarFileSummary"),
  ].forEach((source) => vm.runInContext(source, context));
  return { context, storage, incomeActuals, expenseActuals };
}

const TX = (overrides) => ({ date: "2026-08-01", movement: "SUPERMERCADO", details: "", amount: -50, balance: 900, month: "2026-08", ...overrides });

test("V4-4 · la huella de contenido es estable y distingue ficheros distintos", () => {
  const { context } = baseSandbox();
  const a = context.datosImportarContentHash(JSON.stringify([TX()]));
  const b = context.datosImportarContentHash(JSON.stringify([TX()]));
  const c = context.datosImportarContentHash(JSON.stringify([TX({ amount: -51 })]));
  assert.equal(a, b, "el mismo contenido produce siempre la misma huella");
  assert.notEqual(a, c, "un contenido distinto produce una huella distinta");
});

test("V4-4 · el historial de huellas recuerda un fichero ya importado", () => {
  const { context } = baseSandbox();
  assert.equal(context.datosImportarFindAppliedHash("abc123"), null);
  context.datosImportarRecordAppliedHash("abc123", { fileName: "agosto.csv", appliedAt: "2026-08-01T00:00:00.000Z", batchId: "import-1" });
  const found = context.datosImportarFindAppliedHash("abc123");
  assert.equal(found.fileName, "agosto.csv");
  assert.equal(found.batchId, "import-1");
});

test("V4-4 · el historial de huellas se acota a las últimas 50, no crece sin límite", () => {
  const { context, storage } = baseSandbox();
  for (let i = 0; i < 60; i += 1) context.datosImportarRecordAppliedHash(`hash-${i}`);
  const list = JSON.parse(storage.get("datos-importar-historial-huellas:test"));
  assert.equal(list.length, 50);
  assert.equal(list[0].hash, "hash-10", "se descartan las más antiguas, no las más recientes");
});

test("V4-4 · un borrador corrupto en el almacén se lee como «sin borrador»", () => {
  const { context, storage } = baseSandbox();
  storage.set("datos-importar-borrador:test", "{esto no es json");
  assert.equal(context.datosImportarLoadDraft(), null);
});

test("V4-4 · daysBetweenIsoDates cuenta días de calendario, no horas", () => {
  const { context } = baseSandbox();
  assert.equal(context.daysBetweenIsoDates("2026-08-01", "2026-08-08"), 7);
  assert.equal(context.daysBetweenIsoDates("2026-08-08", "2026-08-01"), 7, "el orden no importa");
  assert.equal(context.daysBetweenIsoDates("2026-08-01", "2026-08-01"), 0);
  assert.equal(context.daysBetweenIsoDates("", "2026-08-01"), Infinity, "una fecha vacía no compara como próxima");
});

test("V4-4 · un candidato a duplicado exige mismo importe y estar dentro de la ventana de 7 días", () => {
  const existentes = [
    TX({ date: "2026-08-03", movement: "MERCADONA", amount: -50 }), // dentro de la ventana, mismo importe
    TX({ date: "2026-08-20", movement: "MERCADONA", amount: -50 }), // fuera de la ventana
    TX({ date: "2026-08-02", movement: "CARREFOUR", amount: -30 }), // dentro de la ventana, importe distinto
  ];
  const { context } = baseSandbox();
  const candidatos = context.datosImportarDuplicateCandidates(TX({ date: "2026-08-01", amount: -50 }), existentes);
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].movement, "MERCADONA");
  assert.equal(candidatos[0].date, "2026-08-03");
});

test("V4-4 · la propia fila nunca es candidata a duplicado de sí misma", () => {
  // mergeTransactions ya resuelve la identidad exacta; si datosImportarDuplicateCandidates la
  // contara también, cada movimiento del extracto se marcaría como «posible duplicado» de sí
  // mismo en cuanto se hubiera importado una vez.
  const movimiento = TX({ date: "2026-08-01", movement: "MERCADONA", details: "", amount: -50, balance: 900 });
  const { context } = baseSandbox();
  const candidatos = context.datosImportarDuplicateCandidates(movimiento, [movimiento]);
  assert.equal(candidatos.length, 0);
});

test("V4-4 · regla-previa, ignorado-antes y pendiente son tres estados distintos", () => {
  const conRegla = TX({ movement: "NOMINA EMPRESA", amount: 1800 });
  const { context: ctxRegla } = baseSandbox();
  const keyRegla = ctxRegla.movementMappingKey(conRegla);
  const { context } = baseSandbox({ mappings: { [keyRegla]: { kind: "income", rowKey: "income|row-sueldo" } } });
  assert.equal(context.datosImportarPriorClassification(conRegla).status, "regla-previa");

  const ignorado = TX({ movement: "TABACOS VARIOS", amount: -5 });
  const { context: ctxIgnorado } = baseSandbox();
  const keyIgnorado = ctxIgnorado.movementMappingKey(ignorado);
  const conIgnorado = baseSandbox({ ignored: { [keyIgnorado]: { updatedAt: "2026-07-01" } } });
  assert.equal(conIgnorado.context.datosImportarPriorClassification(ignorado).status, "ignorado-antes");

  const pendiente = TX({ movement: "COMERCIO NUEVO", amount: -12 });
  const { context: ctxPendiente } = baseSandbox();
  assert.equal(ctxPendiente.datosImportarPriorClassification(pendiente).status, "pendiente");
});

test("V4-4 · la sugerencia es una coincidencia de subcadena de al menos 4 caracteres", () => {
  const { context } = baseSandbox();
  const conCoincidencia = TX({ movement: "RECIBO IBERDROLA ELECTRICIDAD SA", amount: -60 });
  const sugerido = context.datosImportarSuggestionFor(conCoincidencia);
  assert.equal(sugerido?.id, "row-luz");

  const sinCoincidencia = TX({ movement: "COMERCIO DESCONOCIDO", amount: -10 });
  assert.equal(context.datosImportarSuggestionFor(sinCoincidencia), null);

  // Un concepto corto no dispara ninguna sugerencia aunque coincidiera por casualidad, porque el
  // umbral de 4 caracteres nunca llega a evaluarlo.
  const corto = TX({ movement: "IVA", amount: -1 });
  assert.equal(context.datosImportarSuggestionFor(corto), null);
});

test("V4-4 · datosImportarBuildRows separa cada movimiento en su cubo sin mutar nada global", () => {
  const existentes = [TX({ date: "2026-08-05", movement: "FARMACIA", amount: -22 })];
  const { context } = baseSandbox({ transactions: existentes });
  const nuevos = [
    TX({ movement: "NOMINA EMPRESA", amount: 1800 }), // sin regla: pendiente, con sugerencia si coincide
    TX({ date: "2026-08-06", movement: "FARMACIA", amount: -22 }), // candidato a duplicado de la existente
  ];
  const rows = context.datosImportarBuildRows(nuevos);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].prior.status, "pendiente");
  assert.equal(rows[0].decision, null);
  assert.equal(rows[1].duplicates.length, 1);
  assert.equal(rows[1].duplicateDecision, null);
  // No se ha tocado el estado global: sigue habiendo solo el movimiento original.
  assert.equal(context.baseData.transactions.length, 1);
});

test("V4-4 · los contadores del paso 1 cuentan regla-previa e ignorado-antes juntos", () => {
  const { context } = baseSandbox();
  const rows = [
    { prior: { status: "regla-previa" }, duplicates: [] },
    { prior: { status: "ignorado-antes" }, duplicates: [{}] },
    { prior: { status: "pendiente" }, duplicates: [] },
    { prior: { status: "pendiente" }, duplicates: [{}, {}] },
  ];
  const counters = context.datosImportarCounters(rows);
  assert.equal(counters.conReglaPrevia, 2);
  assert.equal(counters.pidenDecision, 2);
  assert.equal(counters.posiblesDuplicados, 2);
  assert.equal(counters.total, 4);
});

test("V4-4 · «Continuar» sigue bloqueado mientras queden filas sin decidir en su paso", () => {
  const { context } = baseSandbox();
  const rows = [
    { prior: { status: "pendiente" }, decision: null },
    { prior: { status: "pendiente" }, decision: { tipo: "ignorar" } },
    { prior: { status: "regla-previa" }, decision: null },
  ];
  assert.equal(context.datosImportarRowsPendingClassification(rows).length, 1);

  const duplicateRows = [
    { duplicates: [{}], duplicateDecision: null },
    { duplicates: [{}], duplicateDecision: "distinto" },
    { duplicates: [], duplicateDecision: null },
  ];
  assert.equal(context.datosImportarRowsPendingDuplicate(duplicateRows).length, 1);
});

test("V4-4 · un duplicado confirmado no entra en el plan, un «son distintos» sí", () => {
  const { context } = baseSandbox();
  const rows = [
    { transaction: TX({ movement: "A" }), duplicateDecision: "duplicado" },
    { transaction: TX({ movement: "B" }), duplicateDecision: "distinto" },
    { transaction: TX({ movement: "C" }), duplicateDecision: null },
  ];
  const incluidos = context.datosImportarIncludedTransactions(rows).map((t) => t.movement);
  assert.deepEqual(incluidos, ["B", "C"]);
});

test("V4-4 · un movimiento duplicado tampoco genera regla nueva", () => {
  // Si se marca «Es duplicado», la decisión de clasificación (si la tuviera) no debe convertirse
  // en una regla: ese movimiento no va a entrar en el plan, así que la regla sería sobre nada.
  const { context } = baseSandbox();
  const suggestion = context.availableSeriesRows("expense")[0];
  const rows = [{ transaction: TX({ amount: -60 }), decision: { tipo: "aceptar-sugerencia" }, suggestion, duplicateDecision: "duplicado" }];
  const delta = context.datosImportarSessionMappingsDelta(rows);
  assert.deepEqual({ ...delta }, {});
});

test("V4-4 · la tabla de impacto solo enseña las partidas que de verdad cambiarían", () => {
  const { context, incomeActuals } = baseSandbox();
  // Un real manual ya existente para agosto, que la sesión no toca: no debe aparecer en el impacto.
  incomeActuals["row-sueldo|2026-08"] = 1800;
  const suggestion = context.availableSeriesRows("expense")[0]; // row-luz
  const rows = [
    { transaction: TX({ amount: -60, month: "2026-08" }), decision: { tipo: "aceptar-sugerencia" }, suggestion, duplicateDecision: null },
  ];
  const impacto = context.datosImportarImpactRows(rows);
  assert.equal(impacto.length, 1);
  assert.equal(impacto[0].row.id, "row-luz");
  assert.equal(impacto[0].before, 0);
  assert.equal(impacto[0].after, 60);
  assert.equal(impacto[0].desviacion, 60);
});

test("V4-4 · un mes ya cerrado no aparece en la tabla de impacto", () => {
  const { context } = baseSandbox({ closedMonths: ["2026-08"] });
  const suggestion = context.availableSeriesRows("expense")[0];
  const rows = [{ transaction: TX({ amount: -60, month: "2026-08" }), decision: { tipo: "aceptar-sugerencia" }, suggestion, duplicateDecision: null }];
  assert.deepEqual([...context.datosImportarImpactRows(rows)], []);
});

test("V4-4 · el CSV de movimientos se interpreta con las mismas cabeceras que la hoja del Excel", () => {
  const { context } = baseSandbox();
  const csv = [
    "Fecha;Movimiento;Importe;Saldo",
    "01/08/2026;NOMINA EMPRESA;1800,00;2500,00",
    "03/08/2026;RECIBO IBERDROLA;-60,00;2440,00",
  ].join("\n");
  const rows = context.parseMovementsFromCsvText(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-08-01");
  assert.equal(rows[0].amount, 1800);
  assert.equal(rows[0].balance, 2500);
  assert.equal(rows[1].category, "Suministros y telecom");
});

test("V4-4 · una fila de CSV sin fecha, concepto o importe válido se descarta, no revienta el parseo", () => {
  const { context } = baseSandbox();
  const csv = ["Fecha;Movimiento;Importe;Saldo", ";;;", "01/08/2026;NOMINA;1800,00;2500,00"].join("\n");
  const rows = context.parseMovementsFromCsvText(csv);
  assert.equal(rows.length, 1);
});

test("V4-4 · la ficha del fichero avisa si solapa con un mes ya cerrado", () => {
  const { context } = baseSandbox({ closedMonths: ["2026-07"] });
  const resumen = context.datosImportarFileSummary([TX({ date: "2026-07-15", month: "2026-07" }), TX({ date: "2026-08-01", month: "2026-08" })], "extracto.csv");
  assert.deepEqual([...resumen.closedMonths], ["2026-07"]);
  assert.equal(resumen.from, "2026-07-15");
  assert.equal(resumen.to, "2026-08-01");
});

test("V4-4 · las decisiones de clasificación se escriben en el mismo diccionario que #data-entry", () => {
  // Comprobación de contrato, no de comportamiento: si `movementMappings` cambiara de nombre en
  // #data-entry sin tocar aquí, esta prueba lo detectaría por texto antes de que lo hiciera un
  // usuario en producción.
  assert.match(app, /movementMappings\[key\] = \{ kind, rowKey: seriesKeyForRow\(row\.suggestion\)/);
  assert.match(app, /movementMappings\[key\] = \{ kind, rowKey: row\.decision\.rowKey/);
});

test("V4-4 · la pantalla está en el menú, en el lanzador y en el orden del flujo", () => {
  assert.match(html, /<a href="#datos-importar" data-e17-group="data">Importar extracto en 4 pasos \(nuevo\)<\/a>/);
  assert.match(html, /<section class="e19-datos-importar view-section" id="datos-importar">/);
  assert.match(html, /id="datosImportarSteps"/);
  assert.match(html, /id="datosImportarPanel"/);
  assert.match(html, /id="datosImportarNext"/);
  assert.match(html, /id="datosImportarBack"/);
  assert.match(experience, /target: "datos-importar"[^}]*group: "data"/);
  assert.match(app, /case "datos-importar":\s*renderDatosImportar\(\);/);
});

test("V4-4 · la reversibilidad reutiliza el mismo lote genérico que el resto de importaciones", () => {
  // No se pide reinventar «una sola entrada revertible del historial»: FinanceCanonicalE5 ya lo
  // resuelve para processDataRecords y el importador de extracto de #data-entry.
  const apply = extractFunction("datosImportarApply");
  assert.match(apply, /window\.FinanceCanonicalE5\.createImportBatch\(beforeState, afterState/);
  assert.match(apply, /importBatches\.push\(batch\)/);
  assert.match(apply, /datosImportarClearDraft\(\)/);
});

test("V4-4 · el «antes» del lote incluye los movimientos aunque sea la primera importación de la sesión", () => {
  // `appStatePayload` solo mete `baseData.transactions` en el snapshot cuando
  // `sourceWorkbookStatus === "Leído desde la app"`, y eso solo lo pone `refreshMovementRollups`.
  // En una sesión que arranca sin haber tocado movimientos todavía, capturar el «antes» sin forzar
  // ese campo primero produciría un lote cuyo «antes» no lleva los movimientos actuales: deshacerlo
  // no podría devolverlos, porque nunca se llegaron a guardar. Detectado con QA de navegador real
  // sobre una sesión recién cargada, no solo por inspección de código.
  const apply = extractFunction("datosImportarApply");
  const antesDeFoto = apply.slice(0, apply.indexOf("const beforeState = appStatePayload"));
  assert.match(antesDeFoto, /if \(baseData\?\.metadata\?\.sourceWorkbookStatus !== "Leído desde la app"\) refreshMovementRollups\(\);/);
});

test("V4-4 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
