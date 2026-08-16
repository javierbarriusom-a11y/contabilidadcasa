const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-5 · Reales del mes: tabla unificada (ingresos + gastos) reutilizando el mismo modelo de datos
// y la misma puerta de escritura que ya tenía «Registrar el mes» (registrarMesCollect /
// actualsForKind / saveActualsForKind) — solo cambia la presentación: filtro por bloque en vez de
// por estado, columna Estado y fila de totales, que registrar-mes no tenía.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
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
  const context = {
    money: (value) => `€${Number(value || 0).toFixed(2)}`,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (value) => String(value ?? ""),
    HOME_MISSING_VALUE: "—",
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("R-5 · la pestaña trae mes, filtro por bloque, tabla con las siete columnas y fila de totales", () => {
  assert.match(html, /<select id="registrarActualsMonth">/);
  assert.match(html, /<div class="registrar-actuals-filters" id="registrarActualsFilters"/);
  assert.match(html, /<p class="e19-registrar-pending" id="registrarActualsClosedNote" hidden>/);
  const table = html.slice(html.indexOf('id="registrarActualsPanel"'), html.indexOf("</article>", html.indexOf('id="registrarActualsPanel"')));
  ["Bloque", "Concepto", "Previsto", "Real", "Usado", "Desviación", "Estado"].forEach((label) => {
    assert.match(table, new RegExp(`<th>${label}</th>`));
  });
  assert.match(table, /<tbody id="registrarActualsBody">/);
  assert.match(table, /<tfoot id="registrarActualsTotals">/);
});

test("R-5 · renderRegistrar llama a renderRegistrarActuals antes de las pestañas, para que la insignia lea el mes ya poblado", () => {
  assert.match(app, /function renderRegistrar\(\) \{\s*if \(!qs\("registrarBalancePanel"\)\) return;\s*renderRegistrarHeaderMeta\(\);\s*renderRegistrarActuals\(\);\s*renderRegistrarTabs\(\);/);
});

test("R-5 · el real editable escribe en el mismo almacén que ya usaba «Registrar el mes» (actualsForKind/saveActualsForKind)", () => {
  const source = extractFunction("handleRegistrarActualsChange");
  assert.match(source, /actualsForKind\(kind\)/);
  assert.match(source, /saveActualsForKind\(kind\)\(\)/);
  assert.match(source, /isClosedMonthKey\(month\.key\)/);
});

test("R-5 · un mes cerrado no guarda el real (protección aunque el input llegara habilitado)", () => {
  const saveCalls = [];
  const { handleRegistrarActualsChange } = sandboxWith(["handleRegistrarActualsChange"], {
    registrarActualsSelectedMonth: () => ({ key: "2026-07" }),
    isClosedMonthKey: () => true,
    actualsForKind: () => ({}),
    saveActualsForKind: () => () => saveCalls.push("saved"),
    render: () => saveCalls.push("rendered"),
    registrarRecordSessionChange: () => {},
  });
  handleRegistrarActualsChange({ dataset: { registrarActualsKind: "expense", registrarActualsActual: "x|2026-07" }, value: "50" });
  assert.equal(saveCalls.length, 0, "un mes cerrado no debe guardar ni volver a renderizar");
});

test("R-5 · vaciar el real lo borra del almacén (vuelve a «sin real», no a un cero)", () => {
  const actuals = { "x|2026-08": 42 };
  const { handleRegistrarActualsChange } = sandboxWith(["handleRegistrarActualsChange"], {
    registrarActualsSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    actualsForKind: () => actuals,
    saveActualsForKind: () => () => {},
    render: () => {},
    registrarRecordSessionChange: () => {},
  });
  handleRegistrarActualsChange({ dataset: { registrarActualsKind: "expense", registrarActualsActual: "x|2026-08" }, value: "" });
  assert.equal("x|2026-08" in actuals, false);
});

test("R-5 · escribir un real guarda el número, incluido un 0 explícito («ocurrió por cero»)", () => {
  const actuals = {};
  const { handleRegistrarActualsChange } = sandboxWith(["handleRegistrarActualsChange"], {
    registrarActualsSelectedMonth: () => ({ key: "2026-08" }),
    isClosedMonthKey: () => false,
    actualsForKind: () => actuals,
    saveActualsForKind: () => () => {},
    render: () => {},
    registrarRecordSessionChange: () => {},
  });
  handleRegistrarActualsChange({ dataset: { registrarActualsKind: "income", registrarActualsActual: "y|2026-08" }, value: "0" });
  assert.equal(actuals["y|2026-08"], 0);
});

test("R-5 · el estado de una fila sin real no fabrica un juicio: es «Sin real», no «Desviación»", () => {
  const { registrarActualsStatus } = sandboxWith(["registrarActualsStatus", "registrarMesIsBad", "registrarMesIsOff", "varianceClassForKind"]);
  const status = registrarActualsStatus({ hasActual: false, kind: "expense", variance: null });
  assert.equal(status.label, "Sin real");
  assert.equal(status.tone, "warn");
});

test("R-5 · un gasto real por encima del previsto es Estado «Desviación», tono danger", () => {
  const { registrarActualsStatus } = sandboxWith(["registrarActualsStatus", "registrarMesIsBad", "registrarMesIsOff", "varianceClassForKind"]);
  const status = registrarActualsStatus({ hasActual: true, kind: "expense", variance: 50 });
  assert.equal(status.label, "Desviación");
  assert.equal(status.tone, "danger");
});

test("R-5 · un gasto real por debajo del previsto es «A favor», no una desviación negativa", () => {
  const { registrarActualsStatus } = sandboxWith(["registrarActualsStatus", "registrarMesIsBad", "registrarMesIsOff", "varianceClassForKind"]);
  const status = registrarActualsStatus({ hasActual: true, kind: "expense", variance: -50 });
  assert.equal(status.label, "A favor");
  assert.equal(status.tone, "good");
});

test("R-5 · un real que coincide con el previsto es «Registrado», sin desviación", () => {
  const { registrarActualsStatus } = sandboxWith(["registrarActualsStatus", "registrarMesIsBad", "registrarMesIsOff", "varianceClassForKind"]);
  const status = registrarActualsStatus({ hasActual: true, kind: "expense", variance: 0 });
  assert.equal(status.label, "Registrado");
  assert.equal(status.tone, "good");
});

test("R-5 · los bloques se deduplican y ordenan, para el filtro", () => {
  const { registrarActualsBlocks } = sandboxWith(["registrarActualsBlocks"]);
  const blocks = registrarActualsBlocks([
    { sectionName: "Gastos fijos" },
    { sectionName: "Ingresos" },
    { sectionName: "Gastos fijos" },
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0], "Gastos fijos");
  assert.equal(blocks[1], "Ingresos");
});

test("R-5 · la fila de totales solo suma la desviación de lo que sí tiene real (no fabrica una cifra sobre partidas sin dato)", () => {
  const { registrarActualsTotals } = sandboxWith(["registrarActualsTotals"]);
  const totals = registrarActualsTotals([
    { planned: 100, used: 100, hasActual: false, variance: null },
    { planned: 50, used: 60, hasActual: true, variance: 10 },
  ]);
  assert.equal(totals.planned, 150);
  assert.equal(totals.used, 160);
  assert.equal(totals.variance, 10);
  assert.equal(totals.lines, 2);
  assert.equal(totals.captured, 1);
});

test("R-5 · sin ninguna partida con real, la desviación total no se rellena con 0 fabricado en la vista (se pinta «—»)", () => {
  const rowHtmlSource = extractFunction("renderRegistrarActuals");
  assert.match(rowHtmlSource, /totals\.captured \? registrarMesSignedMoney\(totals\.variance\) : "—"/);
});

test("R-5 · la insignia de la pestaña dice «Al día» en vez de un «0 sin real» cuando no falta ningún real", () => {
  const { registrarTabBadges } = sandboxWith(["registrarTabBadges", "registrarBalanceStale"], {
    state: { balanceMode: "auto", balanceDate: "2026-08-14" },
    registrarActualsSelectedMonth: () => ({ key: "2026-08" }),
    registrarActualsEntries: () => [{ hasActual: true }, { hasActual: true }],
    datosImportarSession: null,
    datosImportarCounters: () => ({ pidenDecision: 0 }),
  });
  assert.equal(registrarTabBadges().actuals, "Al día");
});
