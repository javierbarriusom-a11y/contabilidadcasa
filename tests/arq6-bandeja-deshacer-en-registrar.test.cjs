const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ARQ-6 (25 de septiembre de 2026, decisión del hogar): la bandeja «Revisar antes de incorporar», su
// registro y «Deshacer último lote» vivían en #data-entry, que desde el 15 de agosto redirige a
// Registrar y nunca se muestra. Registrar › Lote y Excel prometía «una sola entrada revertible por
// lote» e Importar extracto «un lote que se puede deshacer después», sin un solo botón visible que lo
// hiciera. El flujo de navegador que lo vigila de punta a punta está en QA-1
// («deshacer un lote importado desde Registrar»); esta prueba fija la estructura en `npm test`.

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sectionHtml(id) {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `No existe la sección #${id}`);
  const open = html.lastIndexOf("<section", start);
  const end = html.indexOf("</section>", start);
  return html.slice(open, end);
}

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const bodyStart = app.indexOf("{", app.indexOf(")", start));
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`Cuerpo sin cerrar: ${name}`);
}

const MOVED_IDS = ["dataInboxTitle", "toggleDataInbox", "dataInboxSummary", "updateFreshness", "dataImportLog", "undoLastImport"];

test("ARQ-6 · la bandeja, su registro y «Deshacer último lote» viven en Registrar, no en #data-entry", () => {
  const registrar = sectionHtml("registrar");
  const dataEntry = sectionHtml("data-entry");
  MOVED_IDS.forEach((id) => {
    assert.match(registrar, new RegExp(`id="${id}"`), `#${id} tiene que estar en Registrar`);
    assert.doesNotMatch(dataEntry, new RegExp(`id="${id}"`), `#${id} no puede volver a #data-entry`);
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `#${id} tiene que ser único`);
  });
});

test("ARQ-6 · el bloque acompaña a las dos pestañas que crean lotes y Registrar lo pinta al abrirse", () => {
  const block = html.match(/<div[^>]*data-registrar-panels="([^"]+)"[^>]*>/);
  assert.ok(block, "falta el bloque compartido de Registrar");
  assert.deepEqual(block[1].split(" ").sort(), ["batch", "import"]);
  assert.match(block[0], /\bhidden\b/, "arranca oculto hasta que renderRegistrarTabs decida");
  assert.match(extractFunction("renderRegistrarTabs"), /\[data-registrar-panels\]/);
  assert.match(extractFunction("renderRegistrar"), /renderE11bStatus\(\)/);
});

test("ARQ-6 · un lote confirmado desde Registrar deja su justificante en Registrar", () => {
  const stage = extractFunction("stageE7Import");
  assert.match(stage, /processDataRecords\(pending\.records, pending\.sourceLabel, cfg\.logId\)/);
  assert.match(stage, /applyE11bReceipt\([^;]*cfg\.logId\)/);
  // Sin ninguna línea incorporada no hay justificante que anuncie «incorporados».
  assert.match(stage, /if \(!result\.imported\)/);
  const workbook = extractFunction("stageE7Workbook");
  assert.match(workbook, /applyImportedWorkbookData\(pending\.nextData, pending\.sourceLabel, cfg\.logId\)/);
  assert.match(workbook, /applyE11bReceipt\([^;]*cfg\.logId\)/);
});

test("ARQ-6 · el mes de un real sale de detrás del último «|», no del primer dddd-dd de la clave", () => {
  const sandbox = {};
  vm.runInNewContext(`${extractFunction("actualKeyMonth")}; this.actualKeyMonth = actualKeyMonth;`, sandbox);
  // id real de partida propia: Date.now() seguido de hex aleatorio que empieza por dos cifras.
  assert.equal(sandbox.actualKeyMonth("custom-expense-1790334175-03af9|2026-09"), "2026-09");
  assert.equal(sandbox.actualKeyMonth("luz|2026-01"), "2026-01");
  assert.equal(sandbox.actualKeyMonth("custom-expense-1790334175-03af9"), "");
  assert.equal(sandbox.actualKeyMonth("fila|sin-mes"), "");
});
