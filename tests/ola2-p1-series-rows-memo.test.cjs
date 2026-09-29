const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ola 2 · prioridad 1: con ~3.000 movimientos, abrir la app o editar un importe bloqueaba ~2 s porque
// mappingForMovement reconstruía y reordenaba availableSeriesRows(kind) por CADA movimiento
// (21.004 reconstrucciones en el arranque). Ahora availableSeriesRows se memoiza dentro del alcance
// acotado de withPlanningBreakdownMemo (que envuelve p2MovementRows y canonicalLedgerTransactions).
// Estas pruebas fijan que el resultado es idéntico al de la implementación original y que fuera del
// alcance nunca se cachea.

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

// Referencia: implementación original previa a esta tarea (dos bucles, sin memoria).
const REFERENCE = `
function availableSeriesRowsReference(kind) {
  const seen = new Set();
  const rows = [];
  baseData.monthlyPlanning.sections
    .filter((section) => section.kind === kind)
    .forEach((section) => {
      section.rows.forEach((row) => {
        if (isPlanningRowSeriesDeleted(row, section.name)) return;
        const key = seriesKeyForRow(row);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ ...row, sectionName: section.name });
      });
    });
  customPlanningRows
    .filter((row) => row.kind === kind)
    .forEach((row) => {
      if (isPlanningRowSeriesDeleted(row, row.sectionName)) return;
      const key = seriesKeyForRow(row);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
  return rows.sort((a, b) =>
    \`\${a.sectionName} \${displayLabelForRow(a)}\`.localeCompare(\`\${b.sectionName} \${displayLabelForRow(b)}\`, "es"),
  );
}`;

function sandboxWith(fixture) {
  const source = [
    block("let planningBreakdownMemo", "const HEAVY_RENDER_VIEWS"),
    block("function withPlanningBreakdownMemo", "function planningBreakdownMemoized"),
    block("function seriesKeyForRow", "function seriesDeletionKeyForRow"),
    block("function seriesDeletionKeyForRow", "function isPlanningRowDeleted"),
    block("function displayLabelForRow", "function overrideKeyForRow"),
    block("function normalizedText", "function isCarPlanningRow"),
    block("function availableSeriesRows", "function selectedSeriesRow").replace(/\n+$/, ""),
    REFERENCE,
  ].join("\n");
  const sandbox = { ...fixture, Map, Set, String, Boolean };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.api = { availableSeriesRows, availableSeriesRowsReference, withPlanningBreakdownMemo, memoActive: () => planningBreakdownMemo !== null };`, sandbox);
  return sandbox;
}

function fixtureData() {
  const row = (id, label, kind) => ({ id, label, kind, planned: [1, 2, 3] });
  return {
    baseData: {
      monthlyPlanning: {
        sections: [
          { name: "GASTOS FIJOS", kind: "expense", rows: [row("e1", "Alquiler", "expense"), row("e2", "Luz", "expense"), row("e1", "Alquiler duplicado", "expense"), row("e9", "Cuota Cetelem", "expense")] },
          { name: "GASTOS VARIABLES", kind: "expense", rows: [row("e3", "Supermercado", "expense"), row("e2", "Luz otra sección", "expense"), row("e7", "Ócio ñandú", "expense")] },
          { name: "INGRESOS", kind: "income", rows: [row("i1", "Nómina", "income"), row("i2", "Extra", "income")] },
        ],
      },
    },
    customPlanningRows: [
      { id: "c1", kind: "expense", label: "Curso", sectionName: "GASTOS VARIABLES" },
      { id: "e3", kind: "expense", label: "Choca con e3", sectionName: "GASTOS VARIABLES" },
      { id: "c2", kind: "income", label: "Venta", sectionName: "INGRESOS" },
      { id: "c3", kind: "expense", label: "Borrada", sectionName: "GASTOS FIJOS" },
    ],
    rowLabelOverrides: { "expense|e2": "Suministro luz" },
    deletedPlanningRows: {
      // borrado de la serie completa por sección+etiqueta normalizada (mismo formato que seriesDeletionKeyForRow)
      "series-delete|expense|gastos fijos|cuota cetelem": true,
      "series-delete|expense|gastos fijos|borrada": true,
    },
  };
}

test("availableSeriesRows con la refactorización coincide con la implementación original (con y sin memoria)", () => {
  const sb = sandboxWith(fixtureData());
  const plain = (value) => JSON.parse(JSON.stringify(value));
  for (const kind of ["expense", "income", "otro"]) {
    const expected = plain(sb.api.availableSeriesRowsReference(kind));
    assert.deepEqual(plain(sb.api.availableSeriesRows(kind)), expected, `sin memoria (${kind})`);
    sb.api.withPlanningBreakdownMemo(() => {
      assert.deepEqual(plain(sb.api.availableSeriesRows(kind)), expected, `con memoria, 1.ª llamada (${kind})`);
      assert.deepEqual(plain(sb.api.availableSeriesRows(kind)), expected, `con memoria, 2.ª llamada (${kind})`);
    });
  }
  const names = sb.api.availableSeriesRows("expense").map((row) => row.label);
  assert.ok(!names.includes("Cuota Cetelem") && !names.includes("Borrada"), "las series borradas no aparecen");
  assert.ok(names.includes("Curso"), "las filas personalizadas sí");
});

test("dentro del alcance se construye una sola vez por tipo; fuera nunca se cachea y ve los cambios", () => {
  const fixture = fixtureData();
  const sb = sandboxWith(fixture);
  let first;
  sb.api.withPlanningBreakdownMemo(() => {
    first = sb.api.availableSeriesRows("expense");
    for (let i = 0; i < 20; i += 1) assert.equal(sb.api.availableSeriesRows("expense"), first, "misma instancia dentro del alcance");
    assert.notEqual(sb.api.availableSeriesRows("income"), first, "la clave incluye el tipo");
  });
  assert.equal(sb.api.memoActive(), false);
  // fuera del alcance: cada llamada refleja el estado actual (sin caché obsoleta)
  const before = sb.api.availableSeriesRows("expense").length;
  fixture.customPlanningRows.push({ id: "c9", kind: "expense", label: "Nueva", sectionName: "GASTOS FIJOS" });
  assert.equal(sb.api.availableSeriesRows("expense").length, before + 1);
});

test("p2MovementRows y canonicalLedgerTransactions ejecutan su bucle dentro del alcance acotado", () => {
  assert.match(app, /function p2MovementRows\(\) \{\n  return withPlanningBreakdownMemo\(\(\) => \(baseData\?\.transactions \|\| \[\]\)\.map\(/);
  assert.match(app, /function canonicalLedgerTransactions\(\) \{\n  return withPlanningBreakdownMemo\(\(\) => \(baseData\?\.transactions \|\| \[\]\)\.map\(/);
  assert.match(app, /\n  \}\)\);\n\}\n\nfunction p2DebtRows/);
});
