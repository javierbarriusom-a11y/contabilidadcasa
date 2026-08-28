/**
 * tests/uxb3-importar-presupuestos.test.cjs
 *
 * UX-B3 (FASE 7): importar presupuestos desde CSV/JSON — el camino inverso de INTEG-1 (exportar).
 * Sin motor de parseo nuevo: reutiliza splitDataLine() (ya usado por parseMovementsFromCsvText para
 * detectar el delimitador y desentrecomillar celdas) con su propio mapa de cabeceras — no
 * canonicalHeader()/parseTabularText(), que alias "categoria"/"presupuesto" a sectionName/planned
 * para un dominio distinto (lote de Registrar). Solo repone presupuestos MENSUALES del mes en curso,
 * sobre categorías ya conocidas; las filas de un objetivo (🎯, sin categoryId fiable) se omiten.
 *
 * - Parte A: parseBudgetsFromTabularText / parseBudgetsFromJsonText — parseo puro.
 * - Parte B: handlePresupuestoMesImportFile — cadena real de aplicación (upsert + fuente "imported").
 * - Parte C: wiring estático — input de fichero, listener de change, nota "importado".
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { CanonicalBudgetSchema } = require("../canonical-budget-schema.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
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

// ============================================================================
// Parte A: parseo puro
// ============================================================================

function parseSandbox() {
  const context = { normalizedText: (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), parseAmount: null };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("splitDataLine"), extractFunction("parseAmount"), extractFunction("budgetImportHeaderKey"), extractFunction("parseBudgetsFromTabularText"), extractFunction("parseBudgetsFromJsonText")].join("\n"),
    context,
    { filename: "app.js#uxb3-parse" },
  );
  return context;
}

// Array.from(rows, mapFn) evita comparar un array (y sus objetos) construidos dentro del vm, con su
// propio Object.prototype/Array.prototype, que deepEqual rechazaría por prototipo distinto aunque
// el contenido sea idéntico (mismo patrón ya usado en tests/integ1-exportar-presupuestos.test.cjs).
const rowKey = (r) => `${r.categoria}|${r.presupuesto}`;

test("UX-B3 · parsea un CSV con «;» y coma decimal (mismo formato que exporta la propia pantalla)", () => {
  const context = parseSandbox();
  const rows = context.parseBudgetsFromTabularText("Categoria;Presupuesto\ncomida;200,50\nocio;80");
  assert.deepEqual(Array.from(rows, rowKey), ["comida|200.5", "ocio|80"]);
});

test("UX-B3 · acepta cabeceras alternativas en inglés (Category/Amount)", () => {
  const context = parseSandbox();
  const rows = context.parseBudgetsFromTabularText("Category,Amount\ncomida,150");
  assert.deepEqual(Array.from(rows, rowKey), ["comida|150"]);
});

test("UX-B3 · descarta filas sin categoría o con un importe no interpretable", () => {
  const context = parseSandbox();
  const rows = context.parseBudgetsFromTabularText("Categoria;Presupuesto\n;200\ncomida;no-es-un-numero\nocio;90");
  assert.deepEqual(Array.from(rows, rowKey), ["ocio|90"]);
});

test("UX-B3 · un fichero de una sola línea (solo cabecera) no da filas", () => {
  const context = parseSandbox();
  assert.equal(Array.from(context.parseBudgetsFromTabularText("Categoria;Presupuesto")).length, 0);
});

test("UX-B3 · parsea JSON con las claves de la propia exportación (categoria/presupuesto)", () => {
  const context = parseSandbox();
  const rows = context.parseBudgetsFromJsonText(JSON.stringify([{ categoria: "comida", presupuesto: 200, gastado: 50, estado: "on-track" }]));
  assert.deepEqual(Array.from(rows, rowKey), ["comida|200"]);
});

test("UX-B3 · parsea JSON con claves alternativas (categoryId/amountCap)", () => {
  const context = parseSandbox();
  const rows = context.parseBudgetsFromJsonText(JSON.stringify([{ categoryId: "ocio", amountCap: 75 }]));
  assert.deepEqual(Array.from(rows, rowKey), ["ocio|75"]);
});

test("UX-B3 · un JSON que no es un array da una lista vacía en vez de fallar", () => {
  const context = parseSandbox();
  assert.equal(Array.from(context.parseBudgetsFromJsonText(JSON.stringify({ categoria: "comida", presupuesto: 200 }))).length, 0);
});

// ============================================================================
// Parte B: handlePresupuestoMesImportFile — cadena real de aplicación
// ============================================================================

function fileOf(name, text) {
  return { name, text: async () => text, files: undefined };
}

function importSandbox({ budgetsData = [], monthKey = "2026-08", categories = ["comida", "ocio"] } = {}) {
  const saved = [];
  const rendered = [];
  const announced = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    currentBudgetMonthKey: () => monthKey,
    budgetableCategories: () => categories,
    saveBudgets: () => saved.push(context.budgets.map((b) => ({ ...b }))),
    renderPresupuestoMes: () => rendered.push(true),
    announceStatus: (message) => announced.push(message),
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    normalizedText: (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("splitDataLine"),
      extractFunction("parseAmount"),
      extractFunction("budgetImportHeaderKey"),
      extractFunction("parseBudgetsFromTabularText"),
      extractFunction("parseBudgetsFromJsonText"),
      `async ${extractFunction("handlePresupuestoMesImportFile")}`,
    ].join("\n"),
    context,
    { filename: "app.js#uxb3-import" },
  );
  return { context, saved, rendered, announced };
}

test("UX-B3 · importa un CSV con categorías conocidas como presupuestos del mes en curso", async () => {
  const { context, saved, announced } = importSandbox();
  const input = { files: [fileOf("presupuestos.csv", "Categoria;Presupuesto\ncomida;220\nocio;60")] };
  await context.handlePresupuestoMesImportFile(input);
  const comida = context.budgets.find((b) => b.categoryId === "comida");
  assert.equal(comida.amountCap, 220);
  assert.equal(comida.monthYear, "2026-08");
  assert.equal(comida.source, "imported");
  assert.equal(context.budgets.find((b) => b.categoryId === "ocio").amountCap, 60);
  assert.equal(saved.length, 1);
  assert.match(announced[0], /Importados 2 presupuestos para 2026-08\./);
});

test("UX-B3 · importa un JSON (el mismo que exporta esta pantalla) igual que el CSV", async () => {
  const { context, announced } = importSandbox();
  const input = { files: [fileOf("presupuestos.json", JSON.stringify([{ categoria: "comida", presupuesto: 300, gastado: 10 }]))] };
  await context.handlePresupuestoMesImportFile(input);
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").amountCap, 300);
  assert.match(announced[0], /Importados 1 presupuesto para 2026-08\./);
});

test("UX-B3 · una fila con una categoría no reconocida se omite y se cuenta como omitida", async () => {
  const { context, announced } = importSandbox({ categories: ["comida"] });
  const input = { files: [fileOf("presupuestos.csv", "Categoria;Presupuesto\ncomida;100\nfantasma;50")] };
  await context.handlePresupuestoMesImportFile(input);
  assert.equal(context.budgets.length, 1);
  assert.match(announced[0], /Importados 1 presupuesto para 2026-08 \(1 fila omitida/);
});

test("UX-B3 · una fila con el nombre de un objetivo (🎯) se omite: su categoryId no es recuperable de forma fiable", async () => {
  const { context, announced } = importSandbox({ categories: ["comida"] });
  const input = { files: [fileOf("presupuestos.csv", "Categoria;Presupuesto\ncomida;100\n🎯 Vacaciones;80")] };
  await context.handlePresupuestoMesImportFile(input);
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].categoryId, "comida");
  assert.match(announced[0], /1 fila omitida/);
});

test("UX-B3 · actualiza (no duplica) un presupuesto ya existente esa categoría/mes", async () => {
  const { context } = importSandbox({ budgetsData: [{ categoryId: "comida", monthYear: "2026-08", amountCap: 100, period: "monthly", source: "manual" }] });
  const input = { files: [fileOf("presupuestos.csv", "Categoria;Presupuesto\ncomida;250")] };
  await context.handlePresupuestoMesImportFile(input);
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].amountCap, 250);
  assert.equal(context.budgets[0].source, "imported");
});

test("UX-B3 · un fichero sin filas importables avisa y no toca budgets", async () => {
  const { context, saved, rendered, announced } = importSandbox();
  const input = { files: [fileOf("presupuestos.csv", "Categoria;Presupuesto")] };
  await context.handlePresupuestoMesImportFile(input);
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 0);
  assert.equal(rendered.length, 0);
  assert.match(announced[0], /no tiene filas importables/);
});

test("UX-B3 · un JSON mal formado avisa en vez de reventar", async () => {
  const { context, announced } = importSandbox();
  const input = { files: [fileOf("presupuestos.json", "{esto no es json válido")] };
  await context.handlePresupuestoMesImportFile(input);
  assert.match(announced[0], /No se pudo leer el fichero/);
});

test("UX-B3 · sin fichero seleccionado, no hace nada", async () => {
  const { context, saved, rendered, announced } = importSandbox();
  await context.handlePresupuestoMesImportFile({ files: [] });
  assert.equal(saved.length, 0);
  assert.equal(rendered.length, 0);
  assert.equal(announced.length, 0);
});

// ============================================================================
// Parte C: wiring estático
// ============================================================================

test("UX-B3 · el input de importación vive en el HTML de Presupuesto del mes", () => {
  assert.match(viewSrc, /<input type="file" accept="\.csv,\.json,application\/json,text\/csv" data-presupuesto-mes-import-file/);
});

test("UX-B3 · el listener de change en presupuestoMesRoot despacha a handlePresupuestoMesImportFile", () => {
  assert.match(appSrc, /data-presupuesto-mes-import-file[^\n]*\n\s*if \(importFile\) handlePresupuestoMesImportFile\(importFile\);/);
});

test('UX-B3 · presupuestoMesRowHtml marca "importado" para esta fuente', () => {
  assert.match(viewSrc, /budget\.source === "imported" \? ` <small class="note">importado<\/small>`/);
});
