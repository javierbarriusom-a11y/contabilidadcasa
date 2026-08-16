const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-8 · Importar extracto en Registrar es el mismo asistente de cuatro pasos que ya tenía
// #datos-importar, no una copia (regla transversal 01): `datosImportarSession` sigue siendo la
// única fuente de verdad, y todas las funciones del asistente leen sus ids de
// `datosImportarTarget()`, que decide según la vista activa. #datos-importar sigue intacta y
// accesible por su cuenta; nada se le retiró.

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

function extractConst(name) {
  const start = app.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf("\n};", start);
  assert.ok(end >= 0, `No se encontró el final de ${name}`);
  return app.slice(start, end + 3);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  if (names.includes("datosImportarTarget")) vm.runInContext(extractConst("DATOS_IMPORTAR_TARGETS"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function registrarImportPanel() {
  const start = html.indexOf('data-registrar-panel="import"');
  return html.slice(start, html.indexOf('data-registrar-panel="batch"', start));
}

test("R-8 · el panel de Registrar trae el mismo stepper de cuatro fases, el contenedor del asistente y la barra Atrás/Continuar", () => {
  const panel = registrarImportPanel();
  assert.match(panel, /<ol class="datos-importar-steps" id="registrarImportSteps"/);
  ["Cargar", "Clasificar", "Duplicados", "Incorporar"].forEach((step) => assert.match(panel, new RegExp(step)));
  assert.match(panel, /<div id="registrarImportPanel"><\/div>/);
  assert.match(panel, /<p class="e19-kpi-note" id="registrarImportBlockNote"/);
  assert.match(panel, /<button type="button"[^>]*id="registrarImportBack">Atrás<\/button>/);
  assert.match(panel, /<button type="button"[^>]*id="registrarImportNext">Continuar<\/button>/);
});

test("R-8 · #datos-importar sigue intacta: mismos ids de siempre, ningún control retirado", () => {
  assert.match(html, /<ol class="datos-importar-steps" id="datosImportarSteps"/);
  assert.match(html, /<div id="datosImportarPanel"><\/div>/);
  assert.match(html, /id="datosImportarBack">Atrás<\/button>/);
  assert.match(html, /id="datosImportarNext">Continuar<\/button>/);
});

test("R-8 · datosImportarTarget() decide por la vista activa: «registrar» solo cuando activeViewId es «registrar»", () => {
  const { datosImportarTarget } = sandboxWith(["datosImportarTarget"], { activeViewId: "registrar" });
  const target = datosImportarTarget();
  assert.equal(target.panelId, "registrarImportPanel");
  assert.equal(target.stepsId, "registrarImportSteps");
  assert.equal(target.nextId, "registrarImportNext");
  assert.equal(target.backId, "registrarImportBack");
  assert.equal(target.blockNoteId, "registrarImportBlockNote");
  assert.equal(target.fileInputId, "registrarImportFileInput");
  assert.equal(target.confirmId, "registrarImportConfirm");
});

["datos-importar", "home", "", "registrar-mes"].forEach((viewId) => {
  test(`R-8 · datosImportarTarget() vuelve a los ids de #data-importar cuando la vista activa es «${viewId || "(vacía)"}»`, () => {
    const { datosImportarTarget } = sandboxWith(["datosImportarTarget"], { activeViewId: viewId });
    const target = datosImportarTarget();
    assert.equal(target.panelId, "datosImportarPanel");
    assert.equal(target.confirmId, "datosImportarConfirm");
  });
});

test("R-8 · datosImportarStep1Markup() apunta el input de fichero y la nota al id del target activo, sin fabricar ids fijos", () => {
  const { datosImportarStep1Markup } = sandboxWith(["datosImportarStep1Markup", "datosImportarTarget"], {
    activeViewId: "registrar",
    datosImportarSession: null,
    escapeHtml: (value) => String(value ?? ""),
  });
  const markup = datosImportarStep1Markup();
  assert.match(markup, /id="registrarImportFileInput"/);
  assert.match(markup, /id="registrarImportStep1Note"/);
  assert.doesNotMatch(markup, /id="datosImportarFileInput"/);
});

// --- M-2/M-6 (Prioridad 4) · etiquetar la cuenta del extracto al importar --------------------------
// El criterio del PDF pide «concepto con cuenta» en Movimientos y un campo «cuenta» en el detalle.
// No existe ningún atributo de cuenta por movimiento en el modelo, y no hay forma honesta de
// reconstruirlo para el histórico ya cargado — se etiqueta solo hacia delante, al importar.

test("M-2/M-6 · datosImportarStep1Markup() ofrece elegir la cuenta del extracto, sin preseleccionar ninguna por defecto", () => {
  const { datosImportarStep1Markup } = sandboxWith(["datosImportarStep1Markup", "datosImportarTarget"], {
    activeViewId: "registrar",
    escapeHtml: (value) => String(value ?? ""),
    formatIsoDate: (value) => String(value || ""),
    datosImportarFileSummary: () => ({ from: "2026-08-01", to: "2026-08-10", closedMonths: [] }),
    datosImportarCounters: () => ({ conReglaPrevia: 2, pidenDecision: 1, posiblesDuplicados: 0 }),
    DATOS_IMPORTAR_ACCOUNTS: ["CaixaBank", "Mediolanum", "Efectivo"],
    datosImportarSession: { fileMeta: { fileName: "extracto.csv", bankAccount: "" }, rows: [{}, {}, {}] },
  });
  const markup = datosImportarStep1Markup();
  assert.match(markup, /id="registrarImportAccount"/);
  assert.match(markup, /<option value="">Sin especificar<\/option>/);
  ["CaixaBank", "Mediolanum", "Efectivo"].forEach((account) =>
    assert.match(markup, new RegExp(`<option value="${account}">${account}</option>`)),
  );
  assert.equal((markup.match(/ selected/g) || []).length, 0, "sin cuenta elegida, ninguna opción va preseleccionada de más");
});

test("M-2/M-6 · datosImportarStep1Markup() marca la cuenta ya elegida como seleccionada", () => {
  const { datosImportarStep1Markup } = sandboxWith(["datosImportarStep1Markup", "datosImportarTarget"], {
    activeViewId: "registrar",
    escapeHtml: (value) => String(value ?? ""),
    formatIsoDate: (value) => String(value || ""),
    datosImportarFileSummary: () => ({ from: "2026-08-01", to: "2026-08-10", closedMonths: [] }),
    datosImportarCounters: () => ({ conReglaPrevia: 0, pidenDecision: 0, posiblesDuplicados: 0 }),
    DATOS_IMPORTAR_ACCOUNTS: ["CaixaBank", "Mediolanum", "Efectivo"],
    datosImportarSession: { fileMeta: { fileName: "extracto.csv", bankAccount: "Mediolanum" }, rows: [] },
  });
  const markup = datosImportarStep1Markup();
  assert.match(markup, /<option value="Mediolanum" selected>Mediolanum<\/option>/);
});

test("M-2/M-6 · handleDatosImportarAccountChange guarda la cuenta elegida en la sesión y persiste el borrador", () => {
  const select = { value: "Efectivo" };
  const session = { fileMeta: { fileName: "x.csv", bankAccount: "" } };
  let persisted = 0;
  const { handleDatosImportarAccountChange } = sandboxWith(["handleDatosImportarAccountChange", "datosImportarTarget"], {
    activeViewId: "registrar",
    qs: (id) => (id === "registrarImportAccount" ? select : null),
    datosImportarSession: session,
    datosImportarPersistDraft: () => {
      persisted += 1;
    },
  });
  handleDatosImportarAccountChange();
  assert.equal(session.fileMeta.bankAccount, "Efectivo");
  assert.equal(persisted, 1);
});

test("M-2/M-6 · handleDatosImportarAccountChange no revienta sin sesión activa", () => {
  const { handleDatosImportarAccountChange } = sandboxWith(["handleDatosImportarAccountChange", "datosImportarTarget"], {
    activeViewId: "registrar",
    qs: () => ({ value: "CaixaBank" }),
    datosImportarSession: null,
  });
  assert.doesNotThrow(() => handleDatosImportarAccountChange());
});

test("M-2/M-6 · datosImportarIncludedTransactions estampa la cuenta elegida solo cuando se indica", () => {
  const { datosImportarIncludedTransactions } = sandboxWith(["datosImportarIncludedTransactions"]);
  const rows = [
    { duplicateDecision: null, transaction: { id: "a" } },
    { duplicateDecision: "distinto", transaction: { id: "b" } },
    { duplicateDecision: "duplicado", transaction: { id: "c" } },
  ];
  const withoutAccount = datosImportarIncludedTransactions(rows);
  assert.equal(withoutAccount.length, 2);
  assert.equal(withoutAccount[0].account, undefined);

  const withAccount = datosImportarIncludedTransactions(rows, "CaixaBank");
  assert.equal(withAccount[0].account, "CaixaBank");
  assert.equal(withAccount[1].account, "CaixaBank");
  assert.equal(withAccount[1].duplicateReviewed, true);
});

test("R-8 · datosImportarUpdateBar() lee y escribe los botones del target activo, no siempre los de #datos-importar", () => {
  const registrarNext = { hidden: false, disabled: false };
  const registrarBack = { hidden: false };
  const registrarNote = { textContent: "" };
  const elements = { registrarImportNext: registrarNext, registrarImportBack: registrarBack, registrarImportBlockNote: registrarNote };
  const { datosImportarUpdateBar } = sandboxWith(
    ["datosImportarUpdateBar", "datosImportarTarget"],
    {
      activeViewId: "registrar",
      qs: (id) => elements[id] || null,
      datosImportarSession: { step: 2, rows: [{ decision: null }] },
      datosImportarRowsPendingClassification: (rows) => rows.filter((row) => !row.decision),
      datosImportarRowsPendingDuplicate: () => [],
    },
  );
  datosImportarUpdateBar();
  assert.equal(registrarNext.disabled, true, "un movimiento sin decidir bloquea Continuar en el panel de Registrar");
  assert.equal(registrarNote.textContent, "1 movimiento(s) sin decidir.");
});

test("R-8 · setRegistrarTab pinta el asistente al entrar en la pestaña Importar (si no, la primera visita vería el panel vacío)", () => {
  assert.match(
    app,
    /function setRegistrarTab\(tabId\) \{[\s\S]*?renderRegistrarTabs\(\);[\s\S]*?if \(registrarActiveTab === "import"\) renderDatosImportar\(\);[\s\S]*?\}/,
  );
});

test("R-8 · refreshAllSectionsAfterDataChange también refresca el asistente cuando Registrar está en la pestaña Importar", () => {
  assert.match(
    app,
    /if \(viewFromHash\(\) === "registrar" && registrarActiveTab === "import"\) renderDatosImportar\(\);/,
  );
});

test("R-8 · los botones estáticos de Registrar (Atrás/Continuar) están cableados a los mismos manejadores que #datos-importar", () => {
  assert.match(app, /qs\("registrarImportNext"\)\?\.addEventListener\("click", handleDatosImportarNextClick\)/);
  assert.match(app, /qs\("registrarImportBack"\)\?\.addEventListener\("click", handleDatosImportarBackClick\)/);
});

test("R-8 · renderDatosImportarStep4 inyecta el botón de confirmar con el id del target, evitando dos elementos con el mismo id a la vez", () => {
  const source = extractFunction("renderDatosImportarStep4");
  assert.match(source, /id="\$\{target\.confirmId\}"/);
  assert.match(source, /qs\(target\.confirmId\)\?\.addEventListener\("click", handleDatosImportarConfirmar\)/);
});

test("R-8 · datosImportarSession es la única fuente de verdad: ninguna función del asistente declara un segundo estado para Registrar", () => {
  assert.doesNotMatch(app, /registrarImportSession/);
  assert.doesNotMatch(app, /let registrarImportState/);
});
