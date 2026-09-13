const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

// GOB18 (Oleada 4, Bloque 7, O-10, alcance reducido): GOB10 (Oleada 3) ya generaliza el registro de
// tesis con revisión programada a cualquier decisión del hogar — a esta tarea solo le faltaba la
// capa de exportación/empaquetado para un asesor externo, no un registro nuevo. Reutiliza tal cual
// el escritor de PDF sin librería externa que ya usan A19-2/V6-4 (`P2Export.downloadPlainPdf`) y la
// misma etiqueta de estado que ya calcula `gob10ReviewStatusLabel` (GOB10) — ningún motor ni dato
// nuevo, solo reformatea una decisión ya registrada.

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox({ decisions = [], pdfCalls = [] } = {}) {
  const context = {
    gob10Decisions: () => decisions,
    gob10ReviewStatusLabel: (row, now = new Date()) => {
      if (row.reviewedAt) return `revisada el ${String(row.reviewedAt).slice(0, 10)}`;
      const overdue = new Date(row.reviewDueAt).getTime() <= now.getTime();
      return overdue ? `revisión vencida (programada para el ${String(row.reviewDueAt).slice(0, 10)})` : `revisión programada: ${String(row.reviewDueAt).slice(0, 10)}`;
    },
    window: { P2Export: { downloadPlainPdf: (lines, fileName) => pdfCalls.push({ lines, fileName }) } },
    pdfCalls,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("gob18DecisionPackageLines"), context);
  vm.runInContext(extractFunction("downloadGob18DecisionPackage"), context);
  return context;
}

const DECISION = {
  id: "gob10-1",
  description: "Cambiar de trabajo",
  thesis: { expectedGain: "Más ingreso estable", horizonMonths: 6, invalidation: "Si el sueldo baja", recordedAt: "2026-09-01T00:00:00.000Z" },
  reviewMonths: 6,
  createdAt: "2026-09-01T00:00:00.000Z",
  reviewDueAt: "2027-03-01T00:00:00.000Z",
  reviewedAt: null,
};

test("gob18DecisionPackageLines · incluye descripción, tesis completa y revisión programada, con fecha", () => {
  const ctx = sandbox();
  const lines = ctx.gob18DecisionPackageLines(DECISION).join("\n");
  assert.match(lines, /PAQUETE DE DECISIÓN — Cambiar de trabajo/);
  assert.match(lines, /Registrada: 2026-09-01/);
  assert.match(lines, /Qué se espera: Más ingreso estable/);
  assert.match(lines, /Horizonte: 6 meses/);
  assert.match(lines, /Se invalida si: Si el sueldo baja/);
  assert.match(lines, /Cada 6 meses — próxima revisión: 2027-03-01/);
});

test("gob18DecisionPackageLines · sin horizonte ni invalidación declarados, lo dice en vez de inventar una cifra", () => {
  const ctx = sandbox();
  const lines = ctx.gob18DecisionPackageLines({ ...DECISION, thesis: { expectedGain: "", horizonMonths: null, invalidation: "" } }).join("\n");
  assert.match(lines, /Qué se espera: sin declarar/);
  assert.match(lines, /Horizonte: sin declarar/);
  assert.match(lines, /Se invalida si: sin declarar/);
});

test("gob18DecisionPackageLines · reutiliza gob10ReviewStatusLabel para el estado, sin recalcularlo", () => {
  const ctx = sandbox();
  const revisada = ctx.gob18DecisionPackageLines({ ...DECISION, reviewedAt: "2026-10-01T00:00:00.000Z" }).join("\n");
  assert.match(revisada, /Estado: revisada el 2026-10-01/);
  const vencida = ctx.gob18DecisionPackageLines({ ...DECISION, reviewDueAt: "2020-01-01T00:00:00.000Z" }).join("\n");
  assert.match(vencida, /Estado: revisión vencida/);
});

test("gob18DecisionPackageLines · advierte de que no es un documento oficial, como el resto de exportaciones para asesor externo", () => {
  const ctx = sandbox();
  const lines = ctx.gob18DecisionPackageLines(DECISION).join("\n");
  assert.match(lines, /no es una certificación bancaria ni un documento oficial/);
});

test("downloadGob18DecisionPackage · encuentra la decisión por id y llama a P2Export.downloadPlainPdf", () => {
  const ctx = sandbox({ decisions: [DECISION] });
  ctx.downloadGob18DecisionPackage("gob10-1");
  assert.equal(ctx.pdfCalls.length, 1);
  assert.match(ctx.pdfCalls[0].lines.join("\n"), /Cambiar de trabajo/);
  assert.match(ctx.pdfCalls[0].fileName, /^paquete-decision-\d{4}-\d{2}-\d{2}\.pdf$/);
});

test("downloadGob18DecisionPackage · un id que no existe no genera ningún PDF", () => {
  const ctx = sandbox({ decisions: [DECISION] });
  ctx.downloadGob18DecisionPackage("no-existe");
  assert.equal(ctx.pdfCalls.length, 0);
});

test("downloadGob18DecisionPackage · sin P2Export cargado, no falla ni intenta exportar", () => {
  const ctx = sandbox({ decisions: [DECISION] });
  ctx.window.P2Export = null;
  assert.doesNotThrow(() => ctx.downloadGob18DecisionPackage("gob10-1"));
  assert.equal(ctx.pdfCalls.length, 0);
});

// --- wiring ------------------------------------------------------------------------------------

test("wiring: gob10DecisionItemHtml lleva el botón de exportar paquete, junto a los de revisar y quitar", () => {
  const block = appSource.slice(appSource.indexOf("function gob10DecisionItemHtml("), appSource.indexOf("function gob10DecisionItemHtml(") + 900);
  assert.match(block, /data-gob18-export="\$\{escapeHtml\(row\.id\)\}"/);
  assert.match(block, /Exportar paquete \(PDF\)/);
});

test("wiring: el listener delegado de #gob10DecisionList distingue exportar de quitar, antes de llegar al de quitar", () => {
  const start = appSource.indexOf('qs("gob10DecisionList")?.addEventListener');
  const block = appSource.slice(start, start + 900);
  assert.match(block, /downloadGob18DecisionPackage\(exportButton\.dataset\.gob18Export\)/);
  const exportIdx = block.indexOf("data-gob18-export");
  const removeIdx = block.indexOf("data-gob10-remove");
  assert.ok(exportIdx > 0 && removeIdx > exportIdx, "el botón de exportar debe comprobarse antes que el de quitar");
});

test("wiring: index.html menciona la exportación en la tarjeta de GOB10", () => {
  const cardStart = indexSource.indexOf("Registro de decisiones con revisión programada");
  const card = indexSource.slice(cardStart, cardStart + 2200);
  assert.match(card, /GOB18/);
  assert.match(card, /id="gob10DecisionList"/);
});
