const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-9 · Lote y Excel: pegar tabla, subir o arrastrar un fichero, con plantilla descargable y el
// mismo recorrido de cuatro fases que Importar extracto. No es una segunda puerta de escritura
// (regla transversal 01): reutiliza tal cual stageE7Import/stageE7Workbook/processDataRecords/
// applyImportedWorkbookData, los mismos que ya usaba #data-entry — solo cambia dónde se pinta la
// vista previa (`target`, por defecto "data", nuevo valor "registrar").

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

function registrarBatchPanel() {
  const start = html.indexOf('data-registrar-panel="batch"');
  return html.slice(start, html.indexOf("registrarImpactBar", start));
}

test("R-9 · el panel trae tabla de pegado, botones de importar/limpiar/plantilla y el file-drop de Excel", () => {
  const panel = registrarBatchPanel();
  assert.match(panel, /<textarea id="registrarBatchInput"/);
  assert.match(panel, /<button id="registrarBatchImportBtn" type="button">Importar lote<\/button>/);
  assert.match(panel, /<button id="registrarBatchClearBtn" type="button">Limpiar<\/button>/);
  assert.match(panel, /<button id="registrarBatchTemplateBtn"[^>]*>Descargar plantilla<\/button>/);
  assert.match(panel, /<label class="file-drop" id="registrarExcelDrop">/);
  assert.match(panel, /<input id="registrarExcelDataFile" type="file"/);
  assert.match(panel, /<div class="data-import-log" id="registrarBatchLog"/);
});

test("R-9 · el panel trae el mismo stepper de cuatro fases que Importar extracto", () => {
  const panel = registrarBatchPanel();
  ["Origen", "Columnas", "Comparación", "Confirmación"].forEach((step) => {
    assert.match(panel, new RegExp(step));
  });
});

test("R-9 · los controles de Registrar están cableados a sus propios manejadores, no a los de #data-entry", () => {
  assert.match(app, /qs\("registrarBatchImportBtn"\)\?\.addEventListener\("click", handleRegistrarBatchImport\)/);
  assert.match(app, /qs\("registrarBatchClearBtn"\)\?\.addEventListener\("click", handleRegistrarBatchClear\)/);
  assert.match(app, /qs\("registrarBatchTemplateBtn"\)\?\.addEventListener\("click", downloadRegistrarBatchTemplate\)/);
  assert.match(app, /qs\("registrarExcelDataFile"\)\?\.addEventListener\("change", handleRegistrarExcelImport\)/);
});

test("R-9 · el file-drop de Registrar tiene arrastre real (dragover/dragleave/drop), algo que #data-entry nunca tuvo", () => {
  assert.match(app, /registrarExcelDrop\.addEventListener\("dragover", handleRegistrarExcelDragOver\)/);
  assert.match(app, /registrarExcelDrop\.addEventListener\("dragleave", handleRegistrarExcelDragLeave\)/);
  assert.match(app, /registrarExcelDrop\.addEventListener\("drop", handleRegistrarExcelDrop\)/);
});

test("R-9 · pegar y confirmar un lote llama a parseTabularText sobre registrarBatchInput y a stageE7Import con destino «registrar»", () => {
  const calls = [];
  const { handleRegistrarBatchImport } = sandboxWith(["handleRegistrarBatchImport"], {
    qs: (id) => (id === "registrarBatchInput" ? { value: "tipo;mes\ngasto;2026-09" } : null),
    parseTabularText: (text) => {
      calls.push(["parseTabularText", text]);
      return [{ kind: "expense" }];
    },
    stageE7Import: (...args) => calls.push(["stageE7Import", ...args]),
    showImportLog: (...args) => calls.push(["showImportLog", ...args]),
  });
  handleRegistrarBatchImport();
  assert.deepEqual(calls, [
    ["parseTabularText", "tipo;mes\ngasto;2026-09"],
    ["stageE7Import", [{ kind: "expense" }], "lote pegado", "registrar"],
  ]);
});

test("R-9 · un lote pegado vacío avisa en registrarBatchLog, no en el dataImportLog de #data-entry", () => {
  const calls = [];
  const { handleRegistrarBatchImport } = sandboxWith(["handleRegistrarBatchImport"], {
    qs: (id) => (id === "registrarBatchInput" ? { value: "" } : null),
    parseTabularText: () => [],
    stageE7Import: () => calls.push("stageE7Import"),
    showImportLog: (...args) => calls.push(["showImportLog", ...args]),
  });
  handleRegistrarBatchImport();
  assert.deepEqual(calls, [
    ["showImportLog", "No hay datos importables", "Pega una tabla con cabeceras y al menos una línea.", "danger", "registrarBatchLog"],
  ]);
});

test("R-9 · Limpiar solo vacía registrarBatchInput, nunca el batchDataInput de la heredada", () => {
  const registrarInput = { value: "algo pegado" };
  const legacyInput = { value: "no debe tocarse" };
  const logCalls = [];
  const { handleRegistrarBatchClear } = sandboxWith(["handleRegistrarBatchClear"], {
    qs: (id) => (id === "registrarBatchInput" ? registrarInput : id === "batchDataInput" ? legacyInput : null),
    showImportLog: (...args) => logCalls.push(args),
  });
  handleRegistrarBatchClear();
  assert.equal(registrarInput.value, "");
  assert.equal(legacyInput.value, "no debe tocarse");
  assert.deepEqual(logCalls, [["Lote limpio", "Puedes pegar una nueva tabla cuando quieras.", "", "registrarBatchLog"]]);
});

test("R-9 · un CSV/TXT arrastrado o elegido pasa por parseTabularText y stageE7Import con destino «registrar»", async () => {
  const calls = [];
  const { processRegistrarExcelFile } = sandboxWith(["processRegistrarExcelFile"], {
    qs: (id) => (id === "registrarExcelFileName" ? { textContent: "" } : null),
    parseTabularText: (text) => {
      calls.push(["parseTabularText", text]);
      return [{ kind: "income" }];
    },
    stageE7Import: (...args) => calls.push(["stageE7Import", ...args]),
    showImportLog: (...args) => calls.push(["showImportLog", ...args]),
  });
  const file = { name: "movimientos.csv", text: async () => "tipo;mes\ningreso;2026-09" };
  await processRegistrarExcelFile(file);
  assert.deepEqual(calls, [
    ["parseTabularText", "tipo;mes\ningreso;2026-09"],
    ["stageE7Import", [{ kind: "income" }], "movimientos.csv", "registrar"],
  ]);
});

test("R-9 · un XLSX arrastrado o elegido pasa por stageE7Workbook con destino «registrar»", async () => {
  const calls = [];
  const { processRegistrarExcelFile } = sandboxWith(["processRegistrarExcelFile"], {
    qs: (id) => (id === "registrarExcelFileName" ? { textContent: "" } : null),
    window: { XLSX: { read: () => ({ SheetNames: [] }) } },
    buildFinanceDataFromWorkbook: (workbook, name) => ({ workbook, name }),
    stageE7Workbook: (...args) => calls.push(["stageE7Workbook", ...args]),
    showImportLog: (...args) => calls.push(["showImportLog", ...args]),
  });
  const file = { name: "libro.xlsx", arrayBuffer: async () => new ArrayBuffer(4) };
  await processRegistrarExcelFile(file);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "stageE7Workbook");
  assert.deepEqual(calls[0][1], { workbook: { SheetNames: [] }, name: "libro.xlsx" });
  assert.equal(calls[0][2], "libro.xlsx");
  assert.equal(calls[0][3], "registrar");
});

test("R-9 · sin la librería XLSX disponible, el aviso se pinta en registrarBatchLog, no en dataImportLog", async () => {
  const calls = [];
  const { processRegistrarExcelFile } = sandboxWith(["processRegistrarExcelFile"], {
    qs: (id) => (id === "registrarExcelFileName" ? { textContent: "" } : null),
    window: {},
    showImportLog: (...args) => calls.push(args),
  });
  const file = { name: "libro.xlsx", arrayBuffer: async () => new ArrayBuffer(4) };
  await processRegistrarExcelFile(file);
  assert.deepEqual(calls, [
    ["No se pudo leer Excel", "La librería de lectura de Excel no está disponible todavía.", "danger", "registrarBatchLog"],
  ]);
});

test("R-9 · stageE7Import/stageE7Workbook siguen apuntando por defecto a #data-entry cuando no se pasa destino (cero regresión)", () => {
  assert.match(app, /function stageE7Import\(records, sourceLabel, target = "data"\) \{/);
  assert.match(app, /function stageE7Workbook\(nextData, fileName, target = "data"\) \{/);
  assert.match(app, /data: \{\s*logId: "dataImportLog",\s*confirmId: "confirmE7Import",\s*cancelId: "cancelE7Import",/);
});

test("R-9 · la plantilla descargable usa las mismas cabeceras que ya anunciaba #data-entry para el lote pegado", () => {
  const source = extractFunction("downloadRegistrarBatchTemplate");
  assert.match(source, /tipo;mes;bloque;concepto;previsto;real;duracion;modo/);
  assert.match(source, /type: "text\/csv;charset=utf-8"/);
  assert.match(source, /plantilla-lote-registrar\.csv/);
});

test("R-9 · #data-entry sigue intacto: su textarea, botones y file input no se han tocado", () => {
  assert.match(html, /<textarea id="batchDataInput"/);
  assert.match(html, /<button id="importBatchData">Importar lote<\/button>/);
  assert.match(html, /<input id="excelDataFile" type="file"/);
  assert.match(app, /qs\("importBatchData"\)\.addEventListener\("click", handleBatchImport\)/);
  assert.match(app, /qs\("excelDataFile"\)\.addEventListener\("change", handleExcelImport\)/);
});
