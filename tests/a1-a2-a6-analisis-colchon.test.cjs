const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Fase 6 · Análisis (pantalla 07, Analisis.pdf, auditado el 16 de agosto): primer incremento real —
// A-1 (pantalla de solo lectura), A-2 (banda de doce meses de colchón, misma escala de tres niveles
// que P-9) y A-6 (selector de ventana). A-2 pide el colchón EN MESES, una serie mensual que no
// existía todavía: se calcula con `escenarioMotorAverageCoreSpend` (gasto medio, ya usado por el
// resumen de Escenarios) y se colorea con `FinanceCanonicalCushion.cushionLevel` (la misma función
// de tres niveles que ya usa la fila de colchón de Plan · Previsión).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

const cushionLevel = (value, floor) => {
  if (value < 0) return "negativo";
  if (value < floor) return "ajustado";
  return "holgado";
};

function baseContext(names, extra = {}) {
  return sandboxWith(names, {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v),
    isClosedMonthKey: () => false,
    sumRows: (rows, fn) => rows.reduce((sum, row) => sum + fn(row), 0),
    FinanceCanonicalCushion: { cushionLevel },
    ...extra,
  });
}

function months(keys) {
  return keys.map((key) => ({ key, label: key }));
}

// --- analisisCushionBand --------------------------------------------------------------------------

test("A-2 · un mes sin fila de simulación queda sin dato, no en cero", () => {
  const context = baseContext(["analisisCushionBand", "escenarioMotorAverageCoreSpend"]);
  const band = context.analisisCushionBand(months(["2026-08"]), [{ detailMonthKey: "2026-09", coreSpend: 1000, totalLiquidity: 2000 }], 3);
  assert.equal(band[0].monthsValue, null);
  assert.equal(band[0].level, "sin-dato");
});

test("A-2 · sin gasto medio (todo el gasto es cero) no se divide por cero", () => {
  const context = baseContext(["analisisCushionBand", "escenarioMotorAverageCoreSpend"]);
  const rows = [{ detailMonthKey: "2026-08", coreSpend: 0, totalLiquidity: 2000 }];
  const band = context.analisisCushionBand(months(["2026-08"]), rows, 3);
  assert.equal(band[0].monthsValue, null);
});

test("A-2 · calcula liquidez ÷ gasto medio y coloca el nivel según el objetivo", () => {
  const context = baseContext(["analisisCushionBand", "escenarioMotorAverageCoreSpend"]);
  const rows = [
    { detailMonthKey: "2026-08", coreSpend: 1000, totalLiquidity: 4000 }, // 4.0 meses, sobre objetivo (3)
    { detailMonthKey: "2026-09", coreSpend: 1000, totalLiquidity: 1000 }, // 1.0 meses, ajustado
    { detailMonthKey: "2026-10", coreSpend: 1000, totalLiquidity: -500 }, // negativo
  ];
  const band = context.analisisCushionBand(months(["2026-08", "2026-09", "2026-10"]), rows, 3);
  assert.equal(band[0].monthsValue, 4);
  assert.equal(band[0].level, "holgado");
  assert.equal(band[1].monthsValue, 1);
  assert.equal(band[1].level, "ajustado");
  assert.equal(band[2].monthsValue, -0.5);
  assert.equal(band[2].level, "negativo");
});

// --- analisisCushionWorst --------------------------------------------------------------------------

test("A-2 · el peor mes es el de menor colchón, ignorando los meses sin dato", () => {
  const context = baseContext(["analisisCushionWorst"]);
  const band = [
    { key: "2026-08", monthsValue: 2.0 },
    { key: "2026-09", monthsValue: null },
    { key: "2026-10", monthsValue: 1.4 },
    { key: "2026-11", monthsValue: 1.9 },
  ];
  const worst = context.analisisCushionWorst(band);
  assert.equal(worst.key, "2026-10");
});

test("A-2 · sin ningún mes con dato no hay peor mes", () => {
  const context = baseContext(["analisisCushionWorst"]);
  assert.equal(context.analisisCushionWorst([{ key: "2026-08", monthsValue: null }]), null);
});

// --- analisisCushionBandHtml -----------------------------------------------------------------------

test("A-2 · el html de la banda marca el peor mes y usa la clase de su nivel", () => {
  const context = baseContext(["analisisCushionBandHtml"]);
  // ANALISIS_CUSHION_LEVEL_LABELS es una const del módulo; se extrae aparte porque `extractFunction`
  // solo captura funciones.
  const constStart = app.indexOf("const ANALISIS_CUSHION_LEVEL_LABELS");
  const constEnd = app.indexOf("};", constStart) + 2;
  vm.runInContext(app.slice(constStart, constEnd), context);
  const html = context.analisisCushionBandHtml(
    [
      { key: "2026-08", label: "ago 26", monthsValue: 2.0, level: "ajustado" },
      { key: "2026-09", label: "sep 26", monthsValue: 1.4, level: "negativo" },
    ],
    "2026-09"
  );
  assert.match(html, /is-worst/);
  assert.match(html, /analisis-cushion-bar is-ajustado/);
  assert.match(html, /analisis-cushion-bar is-negativo/);
});

// --- analisisWindowMonths (A-6) ----------------------------------------------------------------------

test("A-6 · la ventana de 12 meses recorta a los primeros doce", () => {
  const context = baseContext(["analisisWindowMonths"], {
    cuadroMandosAllMonths: () => months(Array.from({ length: 30 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)),
  });
  const constStart = app.indexOf("const ANALISIS_WINDOWS");
  const constEnd = app.indexOf("};", constStart) + 2;
  vm.runInContext(app.slice(constStart, constEnd), context);
  assert.equal(context.analisisWindowMonths("12m").length, 12);
  assert.equal(context.analisisWindowMonths("24m").length, 24);
  assert.equal(context.analisisWindowMonths("full").length, 30);
});
