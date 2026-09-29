const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ola 2 · Planificación de partidas: partidasTotalsByKind recalculaba visualRowsForSection(section,
// months) dentro del bucle por mes, aunque no depende del mes (504 de 510 llamadas al abrir la
// pantalla, con ~337.000 llamadas a actualAwareInfo detrás). Se iza fuera del bucle: mismo resultado,
// una llamada por sección.

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function load(stubs) {
  const start = app.indexOf("function partidasTotalsByKind");
  const end = app.indexOf("function partidasCalculatedRowHtml", start);
  assert.ok(start >= 0 && end > start);
  const sandbox = { round2: (v) => Math.round(v * 100) / 100, ...stubs };
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(start, end)}\nthis.fn = partidasTotalsByKind;`, sandbox);
  return sandbox.fn;
}

const sections = [
  { name: "A", kind: "expense" }, { name: "B", kind: "expense" }, { name: "C", kind: "income" },
];
const months = [{ key: "2026-01" }, { key: "2026-02" }, { key: "2026-03" }];

// Referencia: la implementación original (llamada dentro del bucle por mes).
function reference(visualRowsForSection, visualSectionTotal, kind) {
  const filtered = sections.filter((section) => section.kind === kind);
  return months.map((month) =>
    Math.round(filtered.reduce((sum, section) => sum + visualSectionTotal(section, visualRowsForSection(section, months), months, "planned", month), 0) * 100) / 100,
  );
}

test("mismo resultado que la implementación original y una sola llamada a visualRowsForSection por sección", () => {
  let calls = 0;
  const visualRowsForSection = (section) => { calls += 1; return [`${section.name}-1`, `${section.name}-2`]; };
  const visualSectionTotal = (section, rows, ms, mode, month) => rows.length * 10.005 + Number(month.key.slice(-2)) + section.name.charCodeAt(0) / 7;
  const fn = load({ baseData: { monthlyPlanning: { sections } }, visualRowsForSection, visualSectionTotal });
  for (const kind of ["expense", "income"]) {
    calls = 0;
    const result = Array.from(fn(months, kind));
    const callsMade = calls;
    assert.equal(callsMade, sections.filter((section) => section.kind === kind).length, "una llamada por sección, no por sección×mes");
    assert.deepEqual(result, reference(visualRowsForSection, visualSectionTotal, kind));
  }
});

test("sin secciones del tipo pedido devuelve ceros por mes", () => {
  const fn = load({ baseData: { monthlyPlanning: { sections: [] } }, visualRowsForSection: () => [], visualSectionTotal: () => 0 });
  assert.deepEqual(Array.from(fn(months, "expense")), [0, 0, 0]);
});
