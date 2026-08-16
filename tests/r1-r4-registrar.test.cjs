const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-1 a R-4 · Registrar: cabecera, armazón de cuatro pestañas, pestaña Saldo de cuentas y la
// tarjeta de recálculo siempre visible. R-8/R-9 (Importar/Lote) quedan pendientes; sus pestañas
// enlazan de vuelta a la heredada en vez de fabricar un contenido que no existe (R-5 se prueba en
// tests/r5-registrar-reales.test.cjs).

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
    escenarioMotorMonthLabel: (value) => `mes-${value}`,
    HOME_MISSING_VALUE: "—",
    isoLocalDate: (date) => date.toISOString().slice(0, 10),
    state: null,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("R-2 · el menú lateral abre Registrar bajo «Día a día», entre Hoy y Movimientos", () => {
  const home = html.indexOf('href="#home" class="nav-primary-link');
  const registrar = html.indexOf('href="#registrar" class="nav-primary-link');
  const movements = html.indexOf('href="#movements" class="nav-primary-link');
  assert.ok(home >= 0 && registrar > home && movements > registrar, "Registrar va entre Hoy y Movimientos");
  assert.match(html, /<section class="view-section e19-registrar" id="registrar">/);
});

test("R-2 · las cuatro pestañas existen y abre en Saldo de cuentas", () => {
  ["balances", "actuals", "import", "batch"].forEach((id) => {
    assert.match(html, new RegExp(`data-registrar-tab="${id}"`));
  });
  const balancesTab = html.match(/<button type="button" class="e19-registrar-tab" data-registrar-tab="balances" aria-selected="true">/);
  assert.ok(balancesTab, "Saldo de cuentas es la pestaña seleccionada por defecto");
  assert.match(html, /<p class="e19-registrar-crumb" id="registrarCrumb"/);
});

test("R-8 · Importar extracto ya no enlaza a la heredada: tiene su propio asistente de cuatro pasos", () => {
  const start = html.indexOf('data-registrar-panel="import"');
  const panel = html.slice(start, html.indexOf('data-registrar-panel="batch"', start));
  assert.doesNotMatch(panel, /Pestaña todavía no construida/);
  assert.match(panel, /id="registrarImportSteps"/);
  assert.match(panel, /id="registrarImportPanel"/);
});

test("R-9 · Lote y Excel ya no enlaza a la heredada: tiene su propio contenido en Registrar", () => {
  const start = html.indexOf('data-registrar-panel="batch"');
  const panel = html.slice(start, html.indexOf("registrarImpactBar", start));
  assert.doesNotMatch(panel, /Pestaña todavía no construida/);
  assert.match(panel, /id="registrarBatchInput"/);
});

test("R-1 · la cabecera trae fuente del libro, guía del flujo y la regla previsto/real/usado en tres celdas", () => {
  assert.match(html, /<p class="e19-registrar-meta" id="registrarSourceNote">/);
  assert.match(html, /<h3 id="registrarRuleTitle">Previsto, real y usado<\/h3>/);
  const ruleGrid = html.slice(html.indexOf('id="registrarRuleTitle"'), html.indexOf('id="registrarTabs"'));
  ["Previsto", "Real", "Usado"].forEach((label) => assert.match(ruleGrid, new RegExp(`<span>${label}</span>`)));
});

test("R-1 · el título global de la vista no repite literalmente el título propio de la sección", () => {
  const globalTitleMatch = app.match(/registrar:\s*\{\s*eyebrow:\s*"([^"]+)",\s*title:\s*"([^"]+)",/);
  assert.ok(globalTitleMatch, "viewTitles.registrar existe");
  const sectionTitleMatch = html.match(/<h2 class="e19-heading">La única puerta de escritura de datos reales<\/h2>/);
  assert.ok(sectionTitleMatch, "la sección conserva su propio título");
  assert.notEqual(globalTitleMatch[2], "La única puerta de escritura de datos reales");
});

test("R-2 · renderActiveSection despacha «registrar» a renderRegistrar", () => {
  assert.match(app, /case "registrar":\s*renderRegistrar\(\);\s*break;/);
});

test("R-3 · los campos de saldo de Registrar son un espejo del mismo estado, no una segunda puerta de escritura", () => {
  assert.match(app, /registrarBalanceDate.*registrarBalanceMode.*registrarCaixaBalance.*registrarMediolanumBalance.*registrarTotalBalance/s);
  assert.match(app, /function handleRegistrarBalanceControlChange\(\)/);
  assert.match(app, /applyVisualBalanceControlChange\(\);\s*registrarRecordBalanceChanges\(before\);\s*resetRegistrarBalanceBaseline\(\);\s*renderRegistrarImpactFooter\(\);/);
  assert.match(app, /function handleRegistrarAccountBalanceInput\(\)/);
  assert.match(app, /applyVisualAccountBalanceInput\(\);\s*registrarRecordBalanceChanges\(before\);\s*resetRegistrarBalanceBaseline\(\);\s*renderRegistrarImpactFooter\(\);/);
});

test("R-11 · `#visual-detail` deja de ser una segunda puerta de escritura de saldos", () => {
  assert.match(app, /const VISUAL_DETAIL_BALANCE_LEGACY_READONLY = true;/);
  assert.match(app, /function handleVisualAccountBalanceInput\(\) \{\s*if \(VISUAL_DETAIL_BALANCE_LEGACY_READONLY\) return;\s*applyVisualAccountBalanceInput\(\);\s*\}/);
  assert.match(app, /function handleVisualBalanceControlChange\(\) \{\s*if \(VISUAL_DETAIL_BALANCE_LEGACY_READONLY\) return;\s*applyVisualBalanceControlChange\(\);\s*\}/);
  assert.match(
    app,
    /\["visualCaixaBalance", "visualMediolanumBalance", "visualBalanceDate", "visualBalanceMode"\]\.forEach\(\(id\) => \{\s*const input = qs\(id\);\s*if \(!input\) return;\s*input\.disabled = VISUAL_DETAIL_BALANCE_LEGACY_READONLY;/,
  );
});

test("R-3 · el delta frente al guardado no fabrica una cifra cuando el campo está vacío o no es numérico", () => {
  const { registrarDeltaText } = sandboxWith(["registrarDeltaText"]);
  assert.equal(registrarDeltaText(NaN, 100), "");
  assert.equal(registrarDeltaText(100, NaN), "");
});

test("R-3 · el delta frente al guardado dice «sin cambios» en vez de un signo vacío cuando coincide", () => {
  const { registrarDeltaText } = sandboxWith(["registrarDeltaText"]);
  assert.equal(registrarDeltaText(2600, 2600), "Sin cambios frente al guardado.");
});

test("R-3 · el delta frente al guardado marca el signo y usa la cifra formateada por money()", () => {
  const { registrarDeltaText } = sandboxWith(["registrarDeltaText"]);
  assert.equal(registrarDeltaText(3210.55, 6670), "€-3459.45 frente al guardado.");
  assert.equal(registrarDeltaText(6700, 6670), "+€30.00 frente al guardado.");
});

test("R-2 (Prioridad 4) · la insignia de Importar refleja el recuento vivo de la sesión en curso, no un «ausente» permanente", () => {
  const { registrarTabBadges } = sandboxWith(["registrarTabBadges", "registrarBalanceStale"], {
    state: { balanceMode: "auto", balanceDate: "2026-08-14" },
    registrarActualsSelectedMonth: () => ({ key: "2026-08" }),
    registrarActualsEntries: () => [{ hasActual: true }, { hasActual: false }],
    datosImportarSession: { rows: [{}, {}, {}] },
    datosImportarCounters: () => ({ pidenDecision: 2 }),
  });
  const badges = registrarTabBadges();
  assert.equal(badges.actuals, "1 sin real");
  assert.equal(badges.import, "2 por decidir");
  assert.equal(badges.batch, "");
});

test("R-2 (Prioridad 4) · sin sesión de importación en curso, la insignia de Importar se queda vacía en vez de fabricar un cero", () => {
  const { registrarTabBadges } = sandboxWith(["registrarTabBadges", "registrarBalanceStale"], {
    state: { balanceMode: "auto", balanceDate: "2026-08-14" },
    registrarActualsSelectedMonth: () => ({ key: "2026-08" }),
    registrarActualsEntries: () => [],
    datosImportarSession: null,
    datosImportarCounters: () => ({ pidenDecision: 0 }),
  });
  const badges = registrarTabBadges();
  assert.equal(badges.import, "");
  assert.equal(badges.batch, "");
});

// --- R-3 (Prioridad 4) · cuenta Efectivo editable, fuera del total de liquidez proyectada --------
// El mockup fija «Efectivo se mantiene como cuenta editable, con su aviso de que no tiene extracto
// que lo respalde». A diferencia de caixa/mediolanum, se guarda en `balanceSettings.efectivoBalance`
// como cifra puramente informativa, sin tocar `accountBalancesFromState()` ni el motor de proyección.

function sandboxEfectivo(extra = {}) {
  return sandboxWith(["efectivoBalanceValue", "saveEfectivoBalance", "handleRegistrarEfectivoBalanceInput"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    balanceSettings: {},
    storageKey: (k) => k,
    storageSet: () => {},
    queueRemoteSave: () => {},
    qs: () => null,
    renderAccountBalancePanels: () => {},
    parseAmount: (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    ...extra,
  });
}

test("R-3 (Prioridad 4) · efectivoBalanceValue lee balanceSettings.efectivoBalance, 0 si no hay nada guardado", () => {
  const ctx = sandboxEfectivo({ balanceSettings: {} });
  assert.equal(ctx.efectivoBalanceValue(), 0);
  const ctx2 = sandboxEfectivo({ balanceSettings: { efectivoBalance: 123.456 } });
  assert.equal(ctx2.efectivoBalanceValue(), 123.46);
});

test("R-3 (Prioridad 4) · saveEfectivoBalance guarda y sincroniza solo cuando el valor cambia de verdad", () => {
  let saved = 0;
  let synced = 0;
  const ctx = sandboxEfectivo({
    balanceSettings: { efectivoBalance: 50 },
    storageSet: () => {
      saved += 1;
    },
    queueRemoteSave: () => {
      synced += 1;
    },
  });
  ctx.saveEfectivoBalance(50);
  assert.equal(saved, 0);
  assert.equal(synced, 0);
  ctx.saveEfectivoBalance(75.5);
  assert.equal(saved, 1);
  assert.equal(synced, 1);
  assert.equal(ctx.balanceSettings.efectivoBalance, 75.5);
});

test("R-3 (Prioridad 4) · handleRegistrarEfectivoBalanceInput lee el campo, guarda y repinta los paneles", () => {
  const input = { value: "340" };
  let rendered = 0;
  const ctx = sandboxEfectivo({
    balanceSettings: {},
    qs: (id) => (id === "registrarEfectivoBalance" ? input : null),
    renderAccountBalancePanels: () => {
      rendered += 1;
    },
  });
  ctx.handleRegistrarEfectivoBalanceInput();
  assert.equal(ctx.balanceSettings.efectivoBalance, 340);
  assert.equal(rendered, 1);
});

test("R-3 (Prioridad 4) · handleRegistrarEfectivoBalanceInput no revienta si el campo todavía no existe en el DOM", () => {
  const ctx = sandboxEfectivo({ qs: () => null });
  assert.doesNotThrow(() => ctx.handleRegistrarEfectivoBalanceInput());
});

test("R-3 (Prioridad 4) · Efectivo se queda fuera del total de liquidez: accountBalancesFromState no lo toca", () => {
  const source = extractFunction("accountBalancesFromState");
  assert.doesNotMatch(source, /efectivo/i);
});

test("R-3 (Prioridad 4) · la pestaña Saldo de cuentas trae Efectivo como tercera fila editable, con su aviso", () => {
  const balancesStart = html.indexOf('data-registrar-panel="balances"');
  const panel = html.slice(balancesStart, html.indexOf('data-registrar-panel="actuals"', balancesStart));
  assert.match(panel, /<span>Efectivo<\/span>\s*<input id="registrarEfectivoBalance"/);
  assert.match(panel, /Efectivo no tiene extracto que lo respalde/);
});

test("R-4 · las cuatro cifras de recálculo se leen de los mismos motores que Hoy, sin fórmula paralela", () => {
  const figuresSource = extractFunction("registrarRecalcFigures");
  assert.match(figuresSource, /unifiedActionCenterModel\(\)/);
  assert.match(figuresSource, /homeDebtOutlook\(\)/);
  assert.match(figuresSource, /FinanceCanonicalCushion\.worstMonthOf\(/);
});

test("R-4 · sin peor mes calculable, la tarjeta muestra «—» en vez de un 0 € fabricado", () => {
  const { registrarRecalcFigures } = sandboxWith(["registrarRecalcFigures"], {
    unifiedActionCenterModel: () => ({ context: { today: {}, immediateTransfer: {} }, coverage: { days: null } }),
    homeDebtOutlook: () => ({ libreDeDeudaLabel: "" }),
    FinanceCanonicalCushion: { worstMonthOf: () => null },
    openSimulationRows: () => [],
    lastSimulation: [],
    agentCaixaFloor: () => 0,
  });
  const figures = registrarRecalcFigures();
  const worst = figures.find((item) => item.label === "Peor mes del horizonte");
  const coverage = figures.find((item) => item.label === "Cobertura hasta el siguiente ingreso");
  const debtFree = figures.find((item) => item.label === "Fecha libre de deuda");
  assert.equal(worst.value, "—");
  assert.equal(coverage.value, "—");
  assert.equal(debtFree.value, "—");
});

test("R-4 · con datos completos, la tarjeta muestra las cuatro cifras reales", () => {
  const { registrarRecalcFigures } = sandboxWith(["registrarRecalcFigures"], {
    unifiedActionCenterModel: () => ({
      context: { today: { requiredReserve: 7230 }, immediateTransfer: {} },
      coverage: { days: 25 },
    }),
    homeDebtOutlook: () => ({ libreDeDeudaLabel: "jul 29" }),
    FinanceCanonicalCushion: { worstMonthOf: () => ({ key: "2026-08", value: 6080.55 }) },
    openSimulationRows: () => [{}],
    lastSimulation: [{}],
    agentCaixaFloor: () => 2500,
  });
  const figures = registrarRecalcFigures();
  assert.equal(figures.find((item) => item.label === "Reserva protegida").value, "€7230.00");
  assert.equal(figures.find((item) => item.label === "Cobertura hasta el siguiente ingreso").value, "25 día(s)");
  assert.equal(figures.find((item) => item.label === "Fecha libre de deuda").value, "jul 29");
  assert.equal(figures.find((item) => item.label === "Peor mes del horizonte").value, "mes-2026-08 · €6080.55");
});
