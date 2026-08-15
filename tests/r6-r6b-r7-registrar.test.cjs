const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-6 · una sola regla de guardado, acotada a Registrar (decisión explícita de la sesión: no se
// retira el panel de «Guardar cambios/Descartar» de Cuadro de mandos ni la carga por lote de
// Datos — retirar una pantalla en uso se consulta siempre, y aquí se eligió no tocarlas). R-6b ·
// el previsto solo se edita en Plan. R-7 · pie de impacto de la sesión completa en Registrar.

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
    escenarioMotorMonthLabel: (value) => `mes-${value}`,
    HOME_MISSING_VALUE: "—",
    debtStrategyLibreDeDeudaRank: (label) => {
      const text = String(label || "");
      if (text === "sin deuda pendiente" || text.startsWith("sin fecha estimable")) return "0000-00";
      if (text === "fuera de horizonte") return "9999-99";
      const match = text.match(/^(\d{4}-\d{2})/);
      return match ? match[1] : "9999-98";
    },
    state: null,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// ---------------------------------------------------------------------------------------------
// R-6 · una sola regla de guardado (acotada a Registrar)
// ---------------------------------------------------------------------------------------------

test("R-6 · el saldo y los reales de Registrar guardan al evento «change» (salir de la casilla), no con un botón de confirmar", () => {
  assert.match(app, /qs\(id\)\?\.addEventListener\("change", handleRegistrarBalanceControlChange\)/);
  assert.match(app, /qs\(id\)\?\.addEventListener\("change", handleRegistrarAccountBalanceInput\)/);
  assert.match(app, /qs\("registrarActualsBody"\)\?\.addEventListener\("change", \(event\) => \{\s*const input = event\.target\.closest\("\[data-registrar-actuals-actual\]"\);\s*if \(input\) handleRegistrarActualsChange\(input\);/);
});

test("R-6 · ninguna de las dos pestañas construidas de Registrar tiene un paso de «confirmar por bloque»", () => {
  const section = html.slice(html.indexOf('id="registrar"'), html.indexOf("</section>", html.indexOf('id="registrar"')));
  const balancesPanel = section.slice(section.indexOf('data-registrar-panel="balances"'), section.indexOf('data-registrar-panel="actuals"'));
  const actualsPanel = section.slice(section.indexOf('data-registrar-panel="actuals"'), section.indexOf('data-registrar-panel="import"'));
  assert.doesNotMatch(balancesPanel, /data-cuadro-save|data-cuadro-discard|Confirmar cambios/);
  assert.doesNotMatch(actualsPanel, /data-cuadro-save|data-cuadro-discard|Confirmar cambios/);
});

test("R-8 · la pestaña Importar de Registrar tiene su propio asistente, pero no fabrica un segundo motor de importación: reutiliza el mismo estado y las mismas funciones que #datos-importar", () => {
  const section = html.slice(html.indexOf('id="registrar"'), html.indexOf("</section>", html.indexOf('id="registrar"')));
  const importPanel = section.slice(section.indexOf('data-registrar-panel="import"'), section.indexOf('data-registrar-panel="batch"'));
  assert.doesNotMatch(importPanel, /data-home-nav="datos-importar"/, "ya no reenvía a la heredada: tiene contenido propio");
  assert.match(importPanel, /id="registrarImportPanel"/);
  assert.match(app, /function datosImportarTarget\(\) \{\s*return activeViewId === "registrar" \? DATOS_IMPORTAR_TARGETS\.registrar : DATOS_IMPORTAR_TARGETS\.data;/);
  assert.match(app, /qs\(target\.panelId\)/);
});

test("R-9 · la pestaña Lote y Excel tiene sus propios controles, pero no fabrica un segundo motor de importación: reutiliza stageE7Import/stageE7Workbook", () => {
  const section = html.slice(html.indexOf('id="registrar"'), html.indexOf("</section>", html.indexOf('id="registrar"')));
  const batchPanel = section.slice(section.indexOf('data-registrar-panel="batch"'), section.indexOf('registrarImpactBar'));
  assert.match(batchPanel, /id="registrarBatchInput"/);
  assert.match(batchPanel, /id="registrarExcelDataFile"/);
  assert.doesNotMatch(batchPanel, /data-home-nav="data-entry"/, "ya no reenvía a la heredada: tiene contenido propio");
  const importHandler = extractFunction("handleRegistrarBatchImport");
  assert.match(importHandler, /stageE7Import\(records, "lote pegado", "registrar"\)/);
  const excelHandler = extractFunction("processRegistrarExcelFile");
  assert.match(excelHandler, /stageE7Import\(records, file\.name, "registrar"\)/);
  assert.match(excelHandler, /stageE7Workbook\(buildFinanceDataFromWorkbook\(workbook, file\.name\), file\.name, "registrar"\)/);
});

test("R-6 · decisión de la sesión: el panel de Guardar cambios/Descartar de Cuadro de mandos sigue intacto (no se retira nada fuera de Registrar)", () => {
  assert.match(app, /qs\("visualSaveChanges"\)\.addEventListener\("click", saveVisualChanges\);/);
  assert.match(app, /qs\("visualDiscardChanges"\)\.addEventListener\("click", discardVisualChanges\);/);
  assert.match(app, /function handleBatchImport\(\)/);
});

// ---------------------------------------------------------------------------------------------
// R-6b · el previsto solo se edita en Plan
// ---------------------------------------------------------------------------------------------

test("R-6b · la celda de previsto de Reales del mes es de solo lectura: ningún input en toda la fila salvo el real", () => {
  const source = extractFunction("registrarActualsRowHtml");
  const plannedCell = source.slice(source.indexOf("<td>${money(entry.planned"), source.indexOf("</td>", source.indexOf("<td>${money(entry.planned")));
  assert.doesNotMatch(plannedCell, /<input/);
});

test("R-6b · handleRegistrarActualsChange nunca escribe en `planned`: solo toca el almacén de reales", () => {
  const source = extractFunction("handleRegistrarActualsChange");
  assert.doesNotMatch(source, /\.planned\s*=/);
  assert.doesNotMatch(source, /planned\[/);
});

test("R-6b · cada fila enlaza a su partida en Plan (cuadro-mandos)", () => {
  const source = extractFunction("registrarActualsRowHtml");
  assert.match(source, /data-home-nav="cuadro-mandos"/);
});

test("R-6b · el enlace «Ver en Plan» de cada fila navega igual que el resto de la app (history + setActiveView)", () => {
  assert.match(
    app,
    /qs\("registrarActualsBody"\)\?\.addEventListener\("click", \(event\) => \{\s*const navButton = event\.target\.closest\("\[data-home-nav\]"\);\s*const target = navButton\?\.dataset\.homeNav;\s*if \(!target \|\| !document\.getElementById\(target\)\?\.classList\.contains\("view-section"\)\) return;\s*history\.pushState\(null, "", `#\$\{target\}`\);\s*setActiveView\(target\);/
  );
});

// ---------------------------------------------------------------------------------------------
// R-7 · pie de impacto de la sesión
// ---------------------------------------------------------------------------------------------

test("R-7 · las cuatro cifras del pie de impacto se leen de los mismos motores que R-4, sin fórmula paralela", () => {
  const source = extractFunction("registrarSessionMetrics");
  assert.match(source, /unifiedActionCenterModel\(\)/);
  assert.match(source, /homeDebtOutlook\(\)/);
  assert.match(source, /FinanceCanonicalCushion\.worstMonthOf\(/);
});

test("R-7 · sin cambios en la sesión, el pie de impacto se mantiene oculto", () => {
  const bar = { hidden: false, innerHTML: "x", classList: { toggle() {}, remove() {} } };
  const { renderRegistrarImpactFooter } = sandboxWith(["renderRegistrarImpactFooter"], {
    qs: (id) => (id === "registrarImpactBar" ? bar : null),
    registrarSessionConsolidatedNote: "",
    registrarSessionChanges: [],
    registrarSessionBaselineMetrics: null,
  });
  renderRegistrarImpactFooter();
  assert.equal(bar.hidden, true);
  assert.equal(bar.innerHTML, "");
});

test("R-7 · registrarRecordSessionChange solo guarda el valor anterior la primera vez que se toca una casilla en la sesión", () => {
  const context = sandboxWith(["registrarRecordSessionChange", "registrarBeginSessionTrackingIfNeeded", "registrarSessionMetrics"], {
    unifiedActionCenterModel: () => ({ context: { today: { requiredReserve: 1000 }, balances: { total: 2000 } }, coverage: { days: 10 } }),
    homeDebtOutlook: () => ({ libreDeDeuda: "2026-08", libreDeDeudaLabel: "ago 2026" }),
    FinanceCanonicalCushion: { worstMonthOf: () => null },
    openSimulationRows: () => [],
    lastSimulation: [],
    agentCaixaFloor: () => 0,
    accountBalancesFromState: () => ({ total: 2000 }),
  });
  context.registrarSessionChanges = [];
  vm.runInContext("registrarSessionChanges = []", context);
  vm.runInContext('registrarRecordSessionChange({ kind: "balance", field: "caixa", previous: 100 })', context);
  vm.runInContext('registrarRecordSessionChange({ kind: "balance", field: "caixa", previous: 250 })', context);
  const changes = vm.runInContext("registrarSessionChanges", context);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].previous, 100, "conserva el primer valor anterior de la sesión, no el más reciente");
});

test("R-7 · registrarImpactRows marca la reserva sobre el mínimo en aviso cuando queda en negativo", () => {
  const { registrarImpactRows } = sandboxWith(["registrarImpactRows"]);
  const baseline = { reserveMargin: 500, coverageDays: 20, debtFreeDateRank: "2026-08", worstMonthValue: 100 };
  const current = { reserveMargin: -50, coverageDays: 18, debtFreeDateRank: "2026-08", worstMonthValue: 60 };
  const rows = registrarImpactRows(baseline, current);
  const reserveRow = rows.find((row) => row.label === "Reserva sobre el mínimo");
  assert.equal(reserveRow.warn, true);
  assert.match(reserveRow.value, /-50/);
});

test("R-7 · registrarImpactRows no marca aviso cuando la reserva sobre el mínimo sigue en positivo, y no marca cambio cuando coincide con el inicio de la sesión", () => {
  const { registrarImpactRows } = sandboxWith(["registrarImpactRows"]);
  const baseline = { reserveMargin: 500, coverageDays: 20, debtFreeDateRank: "2026-08", worstMonthValue: 100 };
  const current = { reserveMargin: 500, coverageDays: 20, debtFreeDateRank: "2026-08", worstMonthValue: 100 };
  const rows = registrarImpactRows(baseline, current);
  const reserveRow = rows.find((row) => row.label === "Reserva sobre el mínimo");
  assert.equal(reserveRow.warn, false);
  assert.equal(reserveRow.note, "Sin cambios en la sesión");
});

test("R-7 · consolidar sin cambios pendientes no hace nada (no fabrica una nota de «guardado» vacía)", () => {
  let footerRendered = false;
  const context = sandboxWith(["registrarConsolidateSessionChanges", "registrarClearSessionTracking", "registrarSessionMetrics"], {
    renderRegistrarImpactFooter: () => {
      footerRendered = true;
    },
    window: { setTimeout: () => {}, confirm: () => true },
  });
  vm.runInContext("registrarSessionChanges = []", context);
  vm.runInContext("registrarConsolidateSessionChanges()", context);
  assert.equal(footerRendered, false, "sin cambios pendientes, consolidar no debe tocar el pie de impacto");
  assert.equal(vm.runInContext("registrarSessionChanges.length", context), 0);
});

test("R-7 · consolidar con la reserva bajo el mínimo pide confirmación antes de cerrar la sesión", () => {
  let confirmCalled = false;
  const context = sandboxWith(["registrarConsolidateSessionChanges", "registrarClearSessionTracking", "registrarSessionMetrics"], {
    unifiedActionCenterModel: () => ({ context: { today: { requiredReserve: 1000 }, balances: { total: 500 } }, coverage: { days: 10 } }),
    homeDebtOutlook: () => ({ libreDeDeuda: "2026-08", libreDeDeudaLabel: "ago 2026" }),
    FinanceCanonicalCushion: { worstMonthOf: () => null },
    openSimulationRows: () => [],
    lastSimulation: [],
    agentCaixaFloor: () => 0,
    accountBalancesFromState: () => ({ total: 500 }),
    renderRegistrarImpactFooter: () => {},
    window: {
      setTimeout: () => {},
      confirm: () => {
        confirmCalled = true;
        return false;
      },
    },
  });
  vm.runInContext('registrarSessionChanges = [{ kind: "balance", field: "caixa", previous: 900 }]', context);
  vm.runInContext("registrarConsolidateSessionChanges()", context);
  assert.equal(confirmCalled, true);
  assert.equal(vm.runInContext("registrarSessionChanges.length", context), 1, "si se cancela la confirmación, la sesión sigue abierta");
});

test("R-7 · el pie de impacto vive dentro de Registrar, fuera de las pestañas, para no desaparecer al cambiar de pestaña", () => {
  const section = html.slice(html.indexOf('id="registrar"'), html.indexOf("</section>", html.indexOf('id="registrar"')));
  assert.match(section, /<aside class="e19-impact-bar e19-registrar-impact" id="registrarImpactBar" hidden aria-live="polite"><\/aside>/);
  const lastPanelClose = section.lastIndexOf('data-registrar-panel="batch"');
  const barIndex = section.indexOf('id="registrarImpactBar"');
  assert.ok(barIndex > lastPanelClose, "el pie de impacto va después de las cuatro pestañas, no dentro de ninguna");
});

test("R-7 · el botón Descartar todo y Guardar cambios están cableados en registrarImpactBar", () => {
  assert.match(
    app,
    /qs\("registrarImpactBar"\)\?\.addEventListener\("click", \(event\) => \{\s*if \(event\.target\.closest\("\[data-registrar-impact-save\]"\)\) \{ registrarConsolidateSessionChanges\(\); return; \}\s*if \(event\.target\.closest\("\[data-registrar-impact-discard\]"\)\) registrarDiscardSessionChanges\(\);/
  );
});
