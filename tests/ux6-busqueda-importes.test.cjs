const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// UX6 · Bloque 5: extiende el lanzador A12-3 para reconocer preguntas de importe, reutilizando la
// misma caja disponible y reserva protegida que ya calcula Hoy — sin motor nuevo.

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

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    formatIsoDate: (v) => {
      const [year, month, day] = String(v).slice(0, 10).split("-");
      return day && month && year ? `${day}/${month}/${year}` : String(v);
    },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("UX6_AMOUNT_QUESTION_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_EXPENSE_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_INCOME_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_MONTHS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_RELATIVE_DAYS"), context);
  vm.runInContext(extractFunction("normalizedText"), context);
  vm.runInContext(extractFunction("e17ExtractNaturalDate"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("e17ParseAmountQuery · un importe con € se reconoce sin necesitar palabra clave", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("300€"), 300);
  assert.equal(ctx.e17ParseAmountQuery("300 euros"), 300);
});

test("e17ParseAmountQuery · un importe con una palabra clave de pregunta se reconoce sin €", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("¿me puedo permitir 300?"), 300);
  assert.equal(ctx.e17ParseAmountQuery("cuánto me queda"), null); // sin número, no hay importe que responder
});

test("e17ParseAmountQuery · un número suelto sin € ni palabra clave no se interpreta como importe", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("12"), null); // podría ser un mes, una fecha...
  assert.equal(ctx.e17ParseAmountQuery("deuda"), null);
});

test("e17ParseAmountQuery · acepta coma decimal", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("125,50€"), 125.5);
});

test("e17AmountAnswerHtml · con margen suficiente, dice que sí y cuánto quedaría", () => {
  const ctx = sandboxWith(["e17AmountAnswerHtml"], {
    accountBalancesFromState: () => ({ caixa: 5000 }),
    agentCaixaFloor: () => 1000,
  });
  const html2 = ctx.e17AmountAnswerHtml(300);
  assert.match(html2, /Sí te lo puedes permitir/);
  assert.match(html2, /3700\.00/); // 5000 - 1000 - 300
});

test("e17AmountAnswerHtml · sin margen suficiente, dice que no y cuánto faltaría", () => {
  const ctx = sandboxWith(["e17AmountAnswerHtml"], {
    accountBalancesFromState: () => ({ caixa: 1200 }),
    agentCaixaFloor: () => 1000,
  });
  const html2 = ctx.e17AmountAnswerHtml(300);
  assert.match(html2, /No te lo puedes permitir/);
  assert.match(html2, /100\.00/); // faltarían 100 (disponible 200 - 300)
});

const RENDER_LAUNCHER_NAMES = ["renderE17Launcher", "e17ParseAmountQuery", "e17AmountAnswerHtml", "e17ParseQuickCaptureQuery", "e17QuickCaptureHtml"];

test("renderE17Launcher · con una pregunta de importe, antepone la respuesta a las tareas encontradas", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
    accountBalancesFromState: () => ({ caixa: 5000 }),
    agentCaixaFloor: () => 1000,
  });
  ctx.renderE17Launcher("¿puedo gastar 300€?");
  assert.match(results.innerHTML, /Sí te lo puedes permitir/);
  assert.doesNotMatch(results.innerHTML, /No encuentro esa tarea/); // hay respuesta, no hace falta el vacío
});

test("renderE17Launcher · sin pregunta de importe, mantiene el comportamiento de siempre", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
  });
  ctx.renderE17Launcher("algo que no existe");
  assert.match(results.innerHTML, /No encuentro esa tarea/);
});

test("el lanzador sigue definido y el motor de importes vive junto a él", () => {
  assert.match(app, /function renderE17Launcher/);
  assert.match(app, /function e17ParseAmountQuery/);
  assert.match(app, /function e17AmountAnswerHtml/);
});

// ---------------------------------------------------------------------------------------------
// DEX1/DEX2 (Oleada 2, Bloque 1) · barra de captura rápida en lenguaje natural — tercer tipo de
// resultado del lanzador, junto a la navegación (A12-3) y la respuesta de importe (UX6): «gasto
// 12,50 mercadona» ofrece crear ese movimiento, sin escribir nada hasta que se pulse el botón.
// DEX2 amplía DEX1: más vocabulario y fecha (relativa o explícita) — misma interfaz, sin voz.
// ---------------------------------------------------------------------------------------------

const TODAY = new Date("2026-09-10T12:00:00.000Z");
const TODAY_ISO = "2026-09-10";

// deepEqual sobre el objeto tal cual devuelve el vm falla por prototipos de distinto realm, no por
// contenido (mismo aviso que ya deja tests/m8-m8b-movimientos-lote.test.cjs) — se compara con
// {...result}, un objeto llano reconstruido en el realm del test.
test("e17ParseQuickCaptureQuery · un verbo de gasto más un importe reconoce el concepto (sin acentos), fecha de hoy por defecto", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.deepEqual({ ...ctx.e17ParseQuickCaptureQuery("gasto 12,50 mercadona", TODAY) }, { amount: 12.5, concept: "mercadona", kind: "expense", date: TODAY_ISO });
  assert.deepEqual({ ...ctx.e17ParseQuickCaptureQuery("pagué 20 luz", TODAY) }, { amount: 20, concept: "luz", kind: "expense", date: TODAY_ISO });
});

test("e17ParseQuickCaptureQuery · un verbo de ingreso reconoce kind income", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.deepEqual({ ...ctx.e17ParseQuickCaptureQuery("ingreso 50 reembolso", TODAY) }, { amount: 50, concept: "reembolso", kind: "income", date: TODAY_ISO });
});

test("e17ParseQuickCaptureQuery · concepto de varias palabras se conserva completo, con su capitalización original", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.deepEqual({ ...ctx.e17ParseQuickCaptureQuery("compra 45 El Corte Inglés", TODAY) }, { amount: 45, concept: "El Corte Inglés", kind: "expense", date: TODAY_ISO });
});

test("e17ParseQuickCaptureQuery · sin verbo de captura, no dispara (sería una búsqueda o pregunta de importe, no una orden)", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("300€"), null);
  assert.equal(ctx.e17ParseQuickCaptureQuery("¿puedo gastar 300€?"), null); // "gastar" no es "gasto": no se confunde con UX6
});

test("e17ParseQuickCaptureQuery · con verbo pero sin importe reconocible, no dispara", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("gasto mercadona"), null);
});

test("e17ParseQuickCaptureQuery · con verbo e importe pero sin concepto, no dispara (hueco, no invención)", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("gasto 20"), null);
});

// --- DEX2: vocabulario ampliado --------------------------------------------------------------

test("e17ParseQuickCaptureQuery · DEX2 amplía el vocabulario con formas naturales del mismo verbo", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("he gastado 30 en gasolina", TODAY).kind, "expense");
  assert.equal(ctx.e17ParseQuickCaptureQuery("he pagado 15 el gimnasio", TODAY).kind, "expense");
  assert.equal(ctx.e17ParseQuickCaptureQuery("he comprado 45 en el corte ingles", TODAY).kind, "expense");
  assert.equal(ctx.e17ParseQuickCaptureQuery("me han ingresado 200 la paga extra", TODAY).kind, "income");
  assert.equal(ctx.e17ParseQuickCaptureQuery("he recibido 200 de la paga extra", TODAY).kind, "income");
});

test("e17ParseQuickCaptureQuery · «abonado»/«cobrado» quedan fuera a propósito — su dirección del dinero es ambigua", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("he abonado 30 la factura de la luz", TODAY), null);
  assert.equal(ctx.e17ParseQuickCaptureQuery("me han cobrado 40 de comisión", TODAY), null);
});

// --- DEX2: fecha relativa ("hoy", "ayer", "anteayer", "mañana") -------------------------------

test("e17ParseQuickCaptureQuery · «ayer» pone la fecha un día antes de hoy, y no queda en el concepto", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  const capture = ctx.e17ParseQuickCaptureQuery("ayer gasto 20 gasolina", TODAY);
  assert.equal(capture.date, "2026-09-09");
  assert.equal(capture.concept, "gasolina");
});

test("e17ParseQuickCaptureQuery · «anteayer» pone la fecha dos días antes", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("anteayer pagué 12 parking", TODAY).date, "2026-09-08");
});

test("e17ParseQuickCaptureQuery · «mañana» pone la fecha un día después (ingreso previsto)", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("mañana ingreso 500 nomina", TODAY).date, "2026-09-11");
});

test("e17ParseQuickCaptureQuery · «hoy» explícito da la misma fecha que el valor por defecto", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("hoy gasto 20 mercadona", TODAY).date, TODAY_ISO);
});

// --- DEX2: fecha explícita ("D de MES[ de AAAA]") ----------------------------------------------

test("e17ParseQuickCaptureQuery · fecha explícita «D de MES» dentro del año en curso", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  const capture = ctx.e17ParseQuickCaptureQuery("gasto 20 el 3 de septiembre en mercadona", TODAY);
  assert.equal(capture.date, "2026-09-03");
  assert.equal(capture.amount, 20); // el "3" de la fecha no se confunde con el importe
  assert.equal(capture.concept, "el en mercadona"); // "de septiembre" se retira; "el"/"en" no son palabras clave, se quedan
});

test("e17ParseQuickCaptureQuery · fecha explícita con año («D de MES de AAAA»)", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("pagué 15 el 20 de diciembre de 2025 luz", TODAY).date, "2025-12-20");
});

test("e17ParseQuickCaptureQuery · una fecha imposible (31 de febrero) no se reconoce — hueco, no invención", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  const capture = ctx.e17ParseQuickCaptureQuery("gasto 31 de febrero mercadona", TODAY);
  // Sin fecha válida que extraer, "31" pasa a leerse como el importe — comportamiento de DEX1 sin cambios.
  assert.equal(capture.amount, 31);
  assert.equal(capture.date, TODAY_ISO);
});

test("e17ParseQuickCaptureQuery · sin ninguna fecha reconocible, usa la fecha por defecto (hoy)", () => {
  const ctx = sandboxWith(["e17ParseQuickCaptureQuery"]);
  assert.equal(ctx.e17ParseQuickCaptureQuery("gasto 20 mercadona", TODAY).date, TODAY_ISO);
});

// --- DEX2: HTML y confirmación con fecha --------------------------------------------------------

test("e17QuickCaptureHtml · pinta importe y concepto, y avisa de que no se incorpora nada todavía", () => {
  const ctx = sandboxWith(["e17QuickCaptureHtml"]);
  const output = ctx.e17QuickCaptureHtml({ amount: 12.5, concept: "mercadona", kind: "expense", date: TODAY_ISO }, TODAY_ISO);
  assert.match(output, /data-e17-create-movement/);
  assert.match(output, /data-e17-create-amount="12\.5"/);
  assert.match(output, /data-e17-create-concept="mercadona"/);
  assert.match(output, /data-e17-create-kind="expense"/);
  assert.match(output, /data-e17-create-date="2026-09-10"/);
  assert.match(output, /nada se incorpora todavía/);
});

test("e17QuickCaptureHtml · con la fecha de hoy, no repite «hoy» en el texto (sin ruido)", () => {
  const ctx = sandboxWith(["e17QuickCaptureHtml"]);
  const output = ctx.e17QuickCaptureHtml({ amount: 12.5, concept: "mercadona", kind: "expense", date: TODAY_ISO }, TODAY_ISO);
  assert.doesNotMatch(output, /10\/09\/2026/);
});

test("e17QuickCaptureHtml · con una fecha distinta de hoy, la menciona explícitamente", () => {
  const ctx = sandboxWith(["e17QuickCaptureHtml"]);
  const output = ctx.e17QuickCaptureHtml({ amount: 20, concept: "gasolina", kind: "expense", date: "2026-09-09" }, TODAY_ISO);
  assert.match(output, /09\/09\/2026/);
});

test("e17QuickCaptureHtml · sin captura, no pinta nada", () => {
  const ctx = sandboxWith(["e17QuickCaptureHtml"]);
  assert.equal(ctx.e17QuickCaptureHtml(null), "");
});

test("renderE17Launcher · una orden de captura reconocida se ofrece como resultado, sin sustituir la búsqueda de tareas", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
  });
  ctx.renderE17Launcher("gasto 12,50 mercadona");
  assert.match(results.innerHTML, /data-e17-create-movement/);
  assert.match(results.innerHTML, /Crear gasto: 12\.50 €/);
  assert.doesNotMatch(results.innerHTML, /No encuentro esa tarea/);
});

test("handleE17QuickCapture · crea el movimiento por la bandeja previa, nunca escribe directamente, y cierra el lanzador", () => {
  const calls = [];
  const dialog = { closed: false, close() { this.closed = true; } };
  const ctx = sandboxWith(["handleE17QuickCapture"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    addE11bInboxItem: (input) => { calls.push(["addE11bInboxItem", input]); return { id: "inbox-dex1-1" }; },
    applyStagedMovementImport: () => calls.push("applyStagedMovementImport"),
    pendingE11bApply: null,
    qs: (id) => (id === "e17LauncherDialog" ? dialog : null),
  });
  ctx.handleE17QuickCapture({ e17CreateAmount: "12.5", e17CreateConcept: "mercadona", e17CreateKind: "expense" });
  const [, input] = calls[0];
  assert.equal(input.source, "manual-quick-capture");
  const row = input.rows[0];
  assert.equal(row.movement, "mercadona");
  assert.equal(row.amount, -12.5);
  assert.equal(calls[1], "applyStagedMovementImport");
  assert.equal(ctx.pendingE11bApply.imported[0].movement, "mercadona");
  assert.equal(dialog.closed, true);
});

test("handleE17QuickCapture · un ingreso guarda el importe en positivo", () => {
  const calls = [];
  const ctx = sandboxWith(["handleE17QuickCapture"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    addE11bInboxItem: (input) => { calls.push(input); return { id: "inbox-dex1-2" }; },
    applyStagedMovementImport: () => {},
    pendingE11bApply: null,
    qs: () => null,
  });
  ctx.handleE17QuickCapture({ e17CreateAmount: "50", e17CreateConcept: "reembolso", e17CreateKind: "income" });
  assert.equal(calls[0].rows[0].amount, 50);
});

test("handleE17QuickCapture · DEX2 — usa la fecha reconocida (no siempre hoy) en date y valueDate", () => {
  const calls = [];
  const ctx = sandboxWith(["handleE17QuickCapture"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    addE11bInboxItem: (input) => { calls.push(input); return { id: "inbox-dex2-1" }; },
    applyStagedMovementImport: () => {},
    pendingE11bApply: null,
    qs: () => null,
  });
  ctx.handleE17QuickCapture({ e17CreateAmount: "20", e17CreateConcept: "gasolina", e17CreateKind: "expense", e17CreateDate: "2026-09-09" });
  assert.equal(calls[0].rows[0].date, "2026-09-09");
  assert.equal(calls[0].rows[0].valueDate, "2026-09-09");
});

test("handleE17QuickCapture · una fecha mal formada (o ausente) cae a hoy, nunca escribe basura", () => {
  const calls = [];
  const ctx = sandboxWith(["handleE17QuickCapture"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    addE11bInboxItem: (input) => { calls.push(input); return { id: "inbox-dex2-2" }; },
    applyStagedMovementImport: () => {},
    pendingE11bApply: null,
    qs: () => null,
  });
  const today = new Date().toISOString().slice(0, 10);
  ctx.handleE17QuickCapture({ e17CreateAmount: "20", e17CreateConcept: "gasolina", e17CreateKind: "expense", e17CreateDate: "no-es-una-fecha" });
  assert.equal(calls[0].rows[0].date, today);
});

test("handleE17QuickCapture · sin importe o concepto válido, no crea nada", () => {
  const calls = [];
  const ctx = sandboxWith(["handleE17QuickCapture"], {
    round2: (v) => v,
    addE11bInboxItem: (input) => { calls.push(input); return { id: "x" }; },
    applyStagedMovementImport: () => calls.push("applyStagedMovementImport"),
    qs: () => null,
  });
  ctx.handleE17QuickCapture({ e17CreateAmount: "0", e17CreateConcept: "mercadona", e17CreateKind: "expense" });
  ctx.handleE17QuickCapture({ e17CreateAmount: "12", e17CreateConcept: "", e17CreateKind: "expense" });
  assert.deepEqual(calls, []);
});

test("el botón de crear movimiento del lanzador está cableado en la delegación de clics de setupE17Experience", () => {
  assert.match(app, /const createMovement = event\.target\.closest\("\[data-e17-create-movement\]"\);/);
  assert.match(app, /if \(createMovement\) \{ handleE17QuickCapture\(createMovement\.dataset\); return; \}/);
});
