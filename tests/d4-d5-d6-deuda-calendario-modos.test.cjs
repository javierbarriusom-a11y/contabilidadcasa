const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const engine = require(path.join(root, "canonical-scenario-engine.js"));
const schema = require(path.join(root, "canonical-scenario-schema.js"));

// D-4/D-5/D-6 · calendario de amortización, ocho modos de liquidación migrados de la heredada
// `#debt-control`, y comparativa de esos ocho sobre un contrato. Mismo truco que en
// `tests/d1-d2-deuda-tabs-contratos.test.cjs`: `app.js` es un script de navegador y no se puede
// `require`, así que se extraen las funciones por nombre balanceando llaves y se ejecutan contra
// dobles de las piezas que consultan; los tramos que tocan de verdad el motor de decisiones se
// prueban contra `canonical-scenario-engine.js`/`canonical-scenario-schema.js` reales.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// Balanceada por paréntesis/corchetes/llaves (respetando cadenas y plantillas) en vez de buscar el
// primer ";\n": ESCENARIO_MOTOR_TYPES tiene un `params()` de «Cambio de gasto» con cuerpo de bloque
// (`{ const params = {...}; ... }`), así que el primer ";\n" del fichero cae dentro de la propia
// constante, mucho antes de su cierre real.
function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  let index = app.indexOf("=", start) + 1;
  while (!"([{".includes(app[index])) index += 1;
  let depth = 0;
  let inString = null;
  for (; index < app.length; index += 1) {
    const ch = app[index];
    if (inString) {
      if (ch === "\\") { index += 1; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        if (app[end] === ";") end += 1;
        return app.slice(start, end);
      }
    }
  }
  throw new Error(`No se pudo balancear la constante ${name}`);
}

const round2Src = extractFunction("round2");
const debtConsolidationMonthlyPaymentSrc = extractFunction("debtConsolidationMonthlyPayment");
const escenarioMotorTypesSrc = extractConst("ESCENARIO_MOTOR_TYPES");
const escenarioMotorTypeByIdSrc = extractFunction("escenarioMotorTypeById");
const debtModeDefinitionsSrc = extractConst("DEBT_MODE_DEFINITIONS");

const CONTRACT_ACTIVE = { id: "cetelem", entity: "Cetelem", type: "Préstamo", currentPrincipal: 6000, currentPayment: 250, apr: 19, paymentStatus: "active" };
const CONTRACT_SUSPENDED = { id: "santander", entity: "Santander", type: "Tarjeta", currentPrincipal: 2000, currentPayment: 0, originalPayment: 80, apr: 22, paymentStatus: "suspended" };
const MONTHS = Array.from({ length: 12 }, (_, index) => {
  const month = String(index + 1).padStart(2, "0");
  return { monthKey: `2026-${month}`, month: `Mes ${index + 1}` };
});

// Sandbox de las funciones puras de construcción de decisiones (D-5): ESCENARIO_MOTOR_TYPES real
// (con su params()/mes()/titulo() reales) más dobles de todo lo que consulta el DOM o el estado del
// hogar.
function sandboxBuilders({ contracts = [CONTRACT_ACTIVE], months = MONTHS, missingDeps = [] } = {}) {
  const context = {
    Math,
    Number,
    String,
    Array,
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "0.00 €"),
    escenarioMotorDebtOptions: () => contracts,
    escenarioMotorDebtLabel: (contract) => `${contract.entity} ${contract.type}`,
    escenarioMotorDebtLabelById: (id) => id,
    escenarioMotorBaseInput: () => ({ months }),
    escenarioMotorNewDecisionId: () => "dec_ABCDEFGHJKMNPQRSTVWXYZ0123",
    escenarioMotorTrim: (value, max = 60) => {
      const text = String(value ?? "").trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    },
    escenarioMotorPct: (value) => (Number.isFinite(value) ? Math.round((value * 100 + Number.EPSILON)) / 10000 : undefined),
    escenarioMotorInt: (value) => (Number.isFinite(value) ? Math.round(value) : undefined),
    missingScenarioDependencies: () => missingDeps,
    debtStrategyEffectiveReserve: (value) => (Number.isFinite(value) && value > 0 ? value : 0.01),
    runEscenarioMotor: (baseInput, decisions, guardrailValue) => engine.resolveEscenario(decisions, {
      baseInput: { months: months.map((month) => ({ ...month, income: 3000, coreSpend: 2000, variableOperationalSpend: 0, car: 0, refi: 0, projectOutflow: 0 })), openingBalances: { checking: 5000, savings: 0 }, policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 0, autoCapSavings: false } },
      debtContracts: contracts,
      guardarrailes: Number.isFinite(guardrailValue) && guardrailValue > 0 ? { saldoMinimoAbsoluto: guardrailValue } : undefined,
    }),
  };
  vm.createContext(context);
  [
    round2Src,
    debtConsolidationMonthlyPaymentSrc,
    escenarioMotorTypesSrc,
    escenarioMotorTypeByIdSrc,
    debtModeDefinitionsSrc,
    extractFunction("debtModeVisibleCampos"),
    extractFunction("debtModeDefaultValues"),
    extractFunction("debtModeDecisionForContract"),
    extractFunction("debtModeResultForContract"),
    extractFunction("debtModeUnavailableNote"),
    extractFunction("debtModeDefById"),
  ].forEach((source) => vm.runInContext(source, context));
  // `const`/`let` de nivel superior no quedan como propiedad del objeto de contexto (a diferencia
  // de `function`, que sí): sin este empujón, `context.DEBT_MODE_DEFINITIONS` se vería `undefined`
  // desde aquí aunque el propio script sí la vea como variable léxica.
  vm.runInContext("globalThis.DEBT_MODE_DEFINITIONS = DEBT_MODE_DEFINITIONS; globalThis.ESCENARIO_MOTOR_TYPES = ESCENARIO_MOTOR_TYPES;", context);
  return context;
}

// --- D-5: catálogo de los ocho modos -----------------------------------------------------------

test("D-5 · DEBT_MODE_DEFINITIONS tiene exactamente los ocho modos heredados de #debt-control", () => {
  const source = extractConst("DEBT_MODE_DEFINITIONS");
  const ids = [...source.matchAll(/id: "([\w-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["optimize", "fixed", "spread-optimize", "spread", "retomar-optimize", "retomar", "refinance-optimize", "refinance"]);
});

test("D-5 · los ocho modos son cuatro tipos de decisión de deuda por dos planificaciones, sin repetir combinación", () => {
  const context = sandboxBuilders();
  const combos = new Set(context.DEBT_MODE_DEFINITIONS.map((def) => `${def.tipoId}:${def.planMode}`));
  assert.equal(combos.size, 8);
  const tipos = new Set(context.DEBT_MODE_DEFINITIONS.map((def) => def.tipoId));
  assert.deepEqual([...tipos].sort(), ["amortizacion", "amortizacion_fraccionada", "refinanciacion", "retomar_pagos"]);
  context.DEBT_MODE_DEFINITIONS.forEach((def) => {
    assert.ok(["optimo", "manual"].includes(def.planMode), `${def.id} debe declarar planMode óptimo o manual`);
    assert.ok(def.label && def.label.length > 0, `${def.id} debe tener una etiqueta`);
  });
});

test("D-5 · cada tipo de modo existe de verdad en ESCENARIO_MOTOR_TYPES (no hay un segundo catálogo)", () => {
  const context = sandboxBuilders();
  context.DEBT_MODE_DEFINITIONS.forEach((def) => {
    assert.ok(context.escenarioMotorTypeById(def.tipoId), `Falta el tipo ${def.tipoId} en ESCENARIO_MOTOR_TYPES`);
  });
});

// --- D-5: campos visibles ------------------------------------------------------------------------

test("D-5 · debtModeVisibleCampos oculta siempre deudaId (lo elige el selector de contrato)", () => {
  const context = sandboxBuilders();
  context.DEBT_MODE_DEFINITIONS.forEach((def) => {
    const campos = context.debtModeVisibleCampos(def);
    assert.ok(!campos.some((field) => field.key === "deudaId"), `${def.id} no debería mostrar deudaId`);
  });
});

test("D-5 · debtModeVisibleCampos oculta el mes manual solo en los modos óptimos", () => {
  const context = sandboxBuilders();
  const optimo = context.debtModeDefById("optimize");
  const manual = context.debtModeDefById("fixed");
  assert.ok(!context.debtModeVisibleCampos(optimo).some((field) => field.key === "mes"));
  assert.ok(context.debtModeVisibleCampos(manual).some((field) => field.key === "mes"));
  const retomarOptimo = context.debtModeDefById("retomar-optimize");
  const retomarManual = context.debtModeDefById("retomar");
  assert.ok(!context.debtModeVisibleCampos(retomarOptimo).some((field) => field.key === "mesInicio"));
  assert.ok(context.debtModeVisibleCampos(retomarManual).some((field) => field.key === "mesInicio"));
});

// --- D-5: valores por defecto ---------------------------------------------------------------------

test("D-5 · amortización óptima parte del capital pendiente del contrato", () => {
  const context = sandboxBuilders();
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, context.debtModeDefById("optimize"));
  assert.equal(values.importe, 6000);
});

test("D-5 · fraccionada parte de la cuota declarada y calcula meses suficientes para agotar el principal", () => {
  const context = sandboxBuilders();
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, context.debtModeDefById("spread"));
  assert.equal(values.importeMensual, 250);
  assert.equal(values.meses, Math.ceil(6000 / 250));
});

test("D-5 · refinanciación no inventa TIN ni plazo: parte solo del principal", () => {
  const context = sandboxBuilders();
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, context.debtModeDefById("refinance"));
  assert.equal(values.nuevoPrincipal, 6000);
  assert.equal(values.nuevoTIN, undefined);
  assert.equal(values.nuevoPlazo, undefined);
  assert.equal(values.nuevaCuota, undefined);
});

test("D-5 · retomar pagos parte de la cuota original del contrato (currentPayment es 0 en una suspendida)", () => {
  const context = sandboxBuilders();
  const values = context.debtModeDefaultValues(CONTRACT_SUSPENDED, context.debtModeDefById("retomar"));
  assert.equal(values.cuota, CONTRACT_SUSPENDED.originalPayment);
});

// --- D-5: construcción de la decisión ---------------------------------------------------------

test("D-5 · sin TIN ni plazo, refinanciación no está disponible (no manda un cero al motor)", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("refinance-optimize");
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, def);
  const built = context.debtModeDecisionForContract(CONTRACT_ACTIVE, def, values);
  assert.equal(built.available, false);
});

test("D-5 · con TIN y plazo, refinanciación óptima sí construye una decisión de tipo refinanciacion", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("refinance-optimize");
  const values = { ...context.debtModeDefaultValues(CONTRACT_ACTIVE, def), nuevoTIN: 0.07, nuevoPlazo: 48, nuevaCuota: 145 };
  const built = context.debtModeDecisionForContract(CONTRACT_ACTIVE, def, values);
  assert.equal(built.available, true);
  assert.equal(built.decision.tipo, "refinanciacion");
  assert.equal(built.decision.planificacion.modo, "optimo");
  assert.equal(built.decision.planificacion.mesManual, undefined);
  assert.equal(built.decision.params.deudaId, CONTRACT_ACTIVE.id);
});

test("D-5 · amortización manual exige un mes y lo lleva en planificacion.mesManual", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("fixed");
  const values = { ...context.debtModeDefaultValues(CONTRACT_ACTIVE, def), mes: "2026-05" };
  const built = context.debtModeDecisionForContract(CONTRACT_ACTIVE, def, values);
  assert.equal(built.available, true);
  assert.equal(built.decision.planificacion.modo, "manual");
  assert.equal(built.decision.planificacion.mesManual, "2026-05");
});

test("D-5 · retomar pagos óptimo rellena mesInicio con el primer mes del horizonte para que la decisión sea válida antes de buscar", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("retomar-optimize");
  const values = { ...context.debtModeDefaultValues(CONTRACT_SUSPENDED, def), cuota: 80 };
  const built = context.debtModeDecisionForContract(CONTRACT_SUSPENDED, def, values);
  assert.equal(built.available, true);
  assert.equal(built.decision.params.mesInicio, MONTHS[0].monthKey);
  assert.equal(built.decision.planificacion.modo, "optimo");
});

test("D-5 · las ocho decisiones construidas con valores completos pasan la validación real del esquema", () => {
  const context = sandboxBuilders();
  const samples = {
    optimize: {},
    fixed: { mes: "2026-04" },
    "spread-optimize": {},
    spread: { mes: "2026-03" },
    "retomar-optimize": { cuota: 80 },
    retomar: { cuota: 80, mesInicio: "2026-02" },
    "refinance-optimize": { nuevoTIN: 0.08, nuevoPlazo: 36, nuevaCuota: 190 },
    refinance: { nuevoTIN: 0.08, nuevoPlazo: 36, nuevaCuota: 190, mes: "2026-06" },
  };
  context.DEBT_MODE_DEFINITIONS.forEach((def) => {
    const contract = def.tipoId === "retomar_pagos" ? CONTRACT_SUSPENDED : CONTRACT_ACTIVE;
    const values = { ...context.debtModeDefaultValues(contract, def), ...samples[def.id] };
    const built = context.debtModeDecisionForContract(contract, def, values);
    assert.equal(built.available, true, `${def.id} debería construir una decisión disponible`);
    const issues = [];
    schema.validateDecision(built.decision, "$", issues);
    const errors = issues.filter((issue) => issue.severity === "error");
    assert.deepEqual(errors, [], `${def.id} debería validar sin errores de esquema: ${JSON.stringify(errors)}`);
  });
});

// --- D-5: resultado contra el motor real --------------------------------------------------------

test("D-5 · debtModeResultForContract dice «no-suspendida» si se pide retomar sobre una deuda activa", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("retomar-optimize");
  const result = context.debtModeResultForContract(CONTRACT_ACTIVE, def, {}, { months: MONTHS }, null);
  assert.equal(result.available, false);
  assert.equal(result.reason, "no-suspendida");
});

test("D-5 · debtModeResultForContract dice «sin-motor» cuando faltan las dependencias del escenario", () => {
  const context = sandboxBuilders({ missingDeps: ["forecast"] });
  const def = context.debtModeDefById("optimize");
  const result = context.debtModeResultForContract(CONTRACT_ACTIVE, def, context.debtModeDefaultValues(CONTRACT_ACTIVE, def), { months: MONTHS }, null);
  assert.equal(result.available, false);
  assert.equal(result.reason, "sin-motor");
});

test("D-5 · amortización óptima de un contrato con caja de sobra se resuelve «aplicada» en el motor real", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("optimize");
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, def);
  const result = context.debtModeResultForContract(CONTRACT_ACTIVE, def, values, { months: MONTHS }, null);
  assert.equal(result.available, true);
  assert.equal(result.viable, true);
  assert.equal(result.resultado.resultado, "aplicada");
  assert.match(String(result.mesResuelto), /^2026-\d{2}$/);
});

test("D-5 · fraccionada óptima también se resuelve «aplicada» contra el motor real", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("spread-optimize");
  const values = context.debtModeDefaultValues(CONTRACT_ACTIVE, def);
  const result = context.debtModeResultForContract(CONTRACT_ACTIVE, def, values, { months: MONTHS }, null);
  assert.equal(result.available, true);
  assert.equal(result.decision.tipo, "amortizacion_fraccionada");
  assert.equal(result.viable, true);
});

test("D-5 · retomar pagos óptimo sobre una deuda suspendida se resuelve «aplicada» contra el motor real", () => {
  const context = sandboxBuilders({ contracts: [CONTRACT_SUSPENDED] });
  const def = context.debtModeDefById("retomar-optimize");
  const values = { ...context.debtModeDefaultValues(CONTRACT_SUSPENDED, def), cuota: 80 };
  const result = context.debtModeResultForContract(CONTRACT_SUSPENDED, def, values, { months: MONTHS }, null);
  assert.equal(result.available, true);
  assert.equal(result.decision.tipo, "retomar_pagos");
  assert.equal(result.viable, true);
});

test("D-5 · refinanciación óptima con oferta completa se resuelve «aplicada» contra el motor real", () => {
  const context = sandboxBuilders();
  const def = context.debtModeDefById("refinance-optimize");
  const values = { ...context.debtModeDefaultValues(CONTRACT_ACTIVE, def), nuevoTIN: 0.07, nuevoPlazo: 48, nuevaCuota: 145 };
  const result = context.debtModeResultForContract(CONTRACT_ACTIVE, def, values, { months: MONTHS }, null);
  assert.equal(result.available, true);
  assert.equal(result.decision.tipo, "refinanciacion");
  assert.equal(result.viable, true);
});

// --- D-5: la cuota de refinanciación sugerida sale de la fórmula francesa, nunca de un cero -----

test("D-5 · debtModeEffectiveValues sugiere la cuota de refinanciación con la misma fórmula francesa que Consolidar", () => {
  const context = sandboxBuilders();
  vm.runInContext(
    [
      "let debtModeContractId = 'cetelem';",
      "let debtModeId = 'refinance';",
      "let debtModeValues = { nuevoTIN: 6, nuevoPlazo: 60 };",
      extractFunction("debtModeSelectedContract"),
      extractFunction("debtModeEffectiveValues"),
    ].join("\n"),
    context
  );
  const values = context.debtModeEffectiveValues();
  // 6.000 € al 6 % en 60 meses: 115,99 €/mes en cualquier cuadro de amortización (misma cifra que
  // valida `debtConsolidationMonthlyPayment` en tests/v3-3-estrategia-consolidar.test.cjs).
  assert.equal(values.nuevaCuota, context.debtConsolidationMonthlyPayment(6000, 6, 60));
});

test("D-5 · si el usuario ya escribió una cuota, la sugerencia automática no la pisa", () => {
  const context = sandboxBuilders();
  vm.runInContext(
    [
      "let debtModeContractId = 'cetelem';",
      "let debtModeId = 'refinance';",
      "let debtModeValues = { nuevoTIN: 6, nuevoPlazo: 60, nuevaCuota: 300 };",
      extractFunction("debtModeSelectedContract"),
      extractFunction("debtModeEffectiveValues"),
    ].join("\n"),
    context
  );
  assert.equal(context.debtModeEffectiveValues().nuevaCuota, 300);
});

// --- D-5: nota cuando no hay nada que enseñar ---------------------------------------------------

test("D-5 · debtModeUnavailableNote distingue las tres razones sin inventar una cuarta", () => {
  const context = sandboxBuilders();
  assert.match(context.debtModeUnavailableNote(CONTRACT_ACTIVE, { reason: "sin-motor" }), /motor de Escenario/);
  assert.match(context.debtModeUnavailableNote(CONTRACT_ACTIVE, { reason: "no-suspendida" }), /pagos suspendidos/);
  assert.match(context.debtModeUnavailableNote(CONTRACT_ACTIVE, { reason: "faltan-datos" }), /Faltan datos/);
});

// --- D-6: comparativa de los ocho modos sobre el mismo contrato ---------------------------------

test("D-6 · los ocho modos se pueden evaluar a la vez sobre el mismo contrato sin mezclar sus valores", () => {
  const context = sandboxBuilders();
  const results = context.DEBT_MODE_DEFINITIONS.map((def) => {
    const extra = def.tipoId === "refinanciacion" ? { nuevoTIN: 0.07, nuevoPlazo: 48, nuevaCuota: 145 } : {};
    const manualMonth = def.planMode === "manual" ? { mes: "2026-05", mesInicio: "2026-05" } : {};
    const values = { ...context.debtModeDefaultValues(CONTRACT_ACTIVE, def), ...extra, ...manualMonth };
    return { id: def.id, result: context.debtModeResultForContract(CONTRACT_ACTIVE, def, values, { months: MONTHS }, null) };
  });
  // Amortizar, fraccionar y refinanciar (con oferta) un contrato activo siempre son evaluables; solo
  // los dos modos de «retomar» no aplican, porque el contrato no está suspendido — la comparativa
  // debe decirlo, no ocultar la fila ni fingir un resultado.
  const byId = new Map(results.map((entry) => [entry.id, entry.result]));
  ["optimize", "fixed", "spread-optimize", "spread", "refinance-optimize", "refinance"].forEach((id) => {
    assert.equal(byId.get(id).available, true, `${id} debería poder evaluarse sobre un contrato activo`);
  });
  ["retomar-optimize", "retomar"].forEach((id) => {
    assert.equal(byId.get(id).available, false);
    assert.equal(byId.get(id).reason, "no-suspendida");
  });
});

// --- D-6 (auditoría 15 de agosto) · cinco indicadores coloreados + veredicto en prosa ------------

function sandboxCompareRender(extra = {}) {
  const context = sandboxBuilders(extra);
  context.escenarioMotorResultInfo = (result) => (result === "aplicada" ? { badge: "e19-badge-success", text: "Viable" } : { badge: "e19-badge-warning", text: "No viable" });
  context.escenarioMotorMonthLabel = (key) => key;
  context.round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  [
    extractFunction("debtModePlanBaseline"),
    extractFunction("debtModeResultingPayment"),
    extractFunction("debtModeCosteNumeric"),
    extractFunction("debtCompareToneClass"),
    extractFunction("debtModeIndicatorsHtml"),
    extractFunction("renderDeudaCompararModeInsight"),
  ].forEach((source) => vm.runInContext(source, context));
  return context;
}

test("D-6 · debtModePlanBaseline es el mismo motor sin decisiones, la misma caja mínima que ya usa «no tocar nada»", () => {
  const context = sandboxCompareRender();
  const baseline = context.debtModePlanBaseline({ months: MONTHS }, null);
  assert.ok(baseline, "el motor sin decisiones debe resolver con los fixtures de sandboxBuilders");
  assert.equal(typeof baseline.cajaMinima, "number");
});

test("D-6 · debtModeCosteNumeric lee el importe real de cada tipo de decisión, no una cifra inventada", () => {
  const context = sandboxCompareRender();
  const optimize = context.debtModeCosteNumeric(context.debtModeDefById("optimize"), { decision: { params: { importe: 6000 } } });
  assert.equal(optimize, 6000);
  const spread = context.debtModeCosteNumeric(context.debtModeDefById("spread"), { decision: { params: { importeMensual: 200, meses: 10 } } });
  assert.equal(spread, 2000);
  const refinance = context.debtModeCosteNumeric(context.debtModeDefById("refinance"), { decision: { params: { nuevoPrincipal: 5500 } } });
  assert.equal(refinance, 5500);
  const retomar = context.debtModeCosteNumeric(context.debtModeDefById("retomar"), { decision: { params: { cuota: 80 } } });
  assert.equal(retomar, 80);
});

test("D-6 · debtModeResultingPayment: amortizar salda del todo (cuota 0), fraccionar no toca la cuota declarada", () => {
  const context = sandboxCompareRender();
  assert.equal(context.debtModeResultingPayment(context.debtModeDefById("optimize"), { decision: { params: {} } }, CONTRACT_ACTIVE), 0);
  assert.equal(
    context.debtModeResultingPayment(context.debtModeDefById("spread"), { decision: { params: {} } }, CONTRACT_ACTIVE),
    CONTRACT_ACTIVE.currentPayment,
  );
  assert.equal(
    context.debtModeResultingPayment(context.debtModeDefById("refinance"), { decision: { params: { nuevaCuota: 145 } } }, CONTRACT_ACTIVE),
    145,
  );
  assert.equal(
    context.debtModeResultingPayment(context.debtModeDefById("retomar"), { decision: { params: { cuota: 80 } } }, CONTRACT_SUSPENDED),
    80,
  );
});

test("D-6 · debtCompareToneClass traduce mejor/peor a las mismas clases positive/negative que ya usa Registrar", () => {
  const context = sandboxCompareRender();
  assert.equal(context.debtCompareToneClass("mejor"), "positive");
  assert.equal(context.debtCompareToneClass("peor"), "negative");
  assert.equal(context.debtCompareToneClass(""), "");
});

test("D-6 · debtModeIndicatorsHtml pinta los cinco indicadores, coloreados contra el plan/principal/cuota actual", () => {
  const context = sandboxCompareRender();
  const item = context.debtModeDefById("refinance");
  const itemResult = {
    available: true,
    cajaMinima: 4000,
    mesResuelto: "2026-06",
    resultado: { resultado: "aplicada" },
    decision: { params: { nuevoPrincipal: 5000, nuevaCuota: 100 } },
  };
  const html5 = context.debtModeIndicatorsHtml(item, itemResult, CONTRACT_ACTIVE, { cajaMinima: 3000 });
  const cells = [...html5.matchAll(/<td[^>]*>/g)];
  assert.equal(cells.length, 5, "mes, caja mínima, coste, cuota resultante y resultado");
  assert.match(html5, /class="positive">4000\.00 €/, "caja mínima 4000 >= plan 3000 → verde");
  assert.match(html5, /class="positive">5000\.00 €/, "coste 5000 < principal 6000 → verde");
  assert.match(html5, /class="positive">100\.00 €/, "cuota 100 < cuota actual 250 → verde");
  assert.match(html5, /e19-badge-success/);
});

test("D-6 · renderDeudaCompararModeInsight se oculta sin ningún modo viable, y nombra el modo con mejor caja mínima cuando sí hay", () => {
  const written = {};
  const context = sandboxCompareRender();
  context.qs = (id) => (id === "deudaCompararModeInsight" ? { set hidden(v) { written.hidden = v; }, set innerHTML(v) { written.innerHTML = v; } } : null);

  context.renderDeudaCompararModeInsight([], CONTRACT_ACTIVE);
  assert.equal(written.hidden, true);

  const rows = [
    { item: context.debtModeDefById("optimize"), itemResult: { available: true, viable: true, cajaMinima: 1000, mesResuelto: "2026-05" } },
    { item: context.debtModeDefById("refinance"), itemResult: { available: true, viable: true, cajaMinima: 3000, mesResuelto: "2026-06" } },
    { item: context.debtModeDefById("retomar"), itemResult: { available: false, reason: "no-suspendida" } },
  ];
  context.renderDeudaCompararModeInsight(rows, CONTRACT_ACTIVE);
  assert.equal(written.hidden, false);
  assert.match(written.innerHTML, /Refinanciación deja la mejor caja mínima/);
  assert.match(written.innerHTML, /Supuesto principal/);
});

// --- D-4: calendario de amortización -------------------------------------------------------------

function sandboxSchedule() {
  const context = { Math, Number };
  vm.createContext(context);
  vm.runInContext([round2Src, extractFunction("debtAmortizationSchedule")].join("\n"), context);
  return context;
}

test("D-4 · la cuota francesa amortiza igual que cualquier cuadro de amortización (10.000 € al 6 % en 60 meses)", () => {
  const context = sandboxSchedule();
  // Misma cifra que valida V3-3 para debtConsolidationMonthlyPayment: 193,33 €/mes.
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 10000, currentPayment: 193.33, apr: 6 }, 600);
  assert.equal(schedule.complete, true);
  assert.equal(schedule.stalled, false);
  assert.ok(schedule.rows.length >= 59 && schedule.rows.length <= 61, `Debe saldarse alrededor del mes 60, salió en el mes ${schedule.rows.length}`);
  assert.equal(schedule.rows[0].balance < 10000, true);
  assert.equal(schedule.rows.at(-1).balance, 0);
});

test("D-4 · el primer mes reparte la cuota entre interés y capital según el TAE declarado", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 6000, currentPayment: 250, apr: 12 }, 60);
  const first = schedule.rows[0];
  assert.equal(first.interest, context.round2(6000 * 0.12 / 12));
  assert.equal(first.principal, context.round2(250 - first.interest));
  assert.equal(first.balance, context.round2(6000 - first.principal));
});

test("D-4 · una cuota que no cubre ni el interés no amortiza: se dice, no se aproxima", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 6000, currentPayment: 10, apr: 24 }, 60);
  assert.equal(schedule.stalled, true);
  assert.equal(schedule.complete, false);
  assert.equal(schedule.rows.at(-1).principal, 0);
});

test("D-4 · sin cuota declarada, tampoco se inventa una amortización", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 6000, currentPayment: 0, apr: 10 }, 60);
  assert.equal(schedule.stalled, true);
});

test("D-4 · si el horizonte se acaba antes de llegar a saldo cero, se dice que no está completo", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 100000, currentPayment: 700, apr: 5 }, 12);
  assert.equal(schedule.rows.length, 12);
  assert.equal(schedule.stalled, false);
  assert.equal(schedule.complete, false);
  assert.ok(schedule.rows.at(-1).balance > 0);
});

test("D-4 · sin TAE declarado, toda la cuota va a capital (interés cero, no inventado)", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 1200, currentPayment: 100, apr: null }, 60);
  assert.equal(schedule.rows[0].interest, 0);
  assert.equal(schedule.rows[0].principal, 100);
  assert.equal(schedule.rows.length, 12);
  assert.equal(schedule.complete, true);
});

test("D-4 · un contrato sin principal pendiente no genera ninguna fila", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 0, currentPayment: 100, apr: 5 }, 60);
  assert.equal(schedule.rows.length, 0);
  assert.equal(schedule.complete, true);
});

test("D-4 · el calendario nunca supera 600 filas aunque se pida un horizonte mayor", () => {
  const context = sandboxSchedule();
  const schedule = context.debtAmortizationSchedule({ currentPrincipal: 500000, currentPayment: 400, apr: 3 }, 5000);
  assert.ok(schedule.rows.length <= 600);
});

// --- D-4: pintado del calendario -----------------------------------------------------------------

function sandboxCalendarRender() {
  const written = {};
  const context = {
    Math,
    Number,
    String,
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "0.00 €"),
    escenarioMotorDebtLabel: (contract) => `${contract.entity} ${contract.type}`,
    qs: (id) => (id === "deudaRutaCalendar" ? { set innerHTML(value) { written[id] = value; } } : null),
  };
  vm.createContext(context);
  [round2Src, extractFunction("debtAmortizationSchedule"), extractFunction("renderDeudaRutaCalendar")].forEach((source) => vm.runInContext(source, context));
  return { context, written };
}

test("D-4 · renderDeudaRutaCalendar pinta un <details> por contrato, con la tabla mes a mes dentro", () => {
  const { context, written } = sandboxCalendarRender();
  context.renderDeudaRutaCalendar([{ ...CONTRACT_ACTIVE, currentPayment: 250, apr: 12 }], MONTHS);
  const out = written.deudaRutaCalendar;
  assert.match(out, /<details class="deuda-ruta-calendar-item">/);
  assert.match(out, /<summary>/);
  assert.match(out, /<th>Mes<\/th><th>Cuota<\/th><th>Interés<\/th><th>Capital<\/th><th>Saldo<\/th>/);
  assert.match(out, /<tbody>/);
});

test("D-4 · sin deudas vivas, el calendario lo dice en vez de dejar la tabla vacía sin explicación", () => {
  const { context, written } = sandboxCalendarRender();
  context.renderDeudaRutaCalendar([], MONTHS);
  assert.match(written.deudaRutaCalendar, /Sin deudas vivas/);
});

test("D-4 · una deuda que no llega a saldo cero dentro del horizonte lo dice en el resumen", () => {
  const { context, written } = sandboxCalendarRender();
  context.renderDeudaRutaCalendar([{ id: "x", entity: "Banco", type: "Hipoteca", currentPrincipal: 100000, currentPayment: 700, apr: 5 }], MONTHS);
  assert.match(written.deudaRutaCalendar, /no llega a saldo cero/);
});

test("D-4 · una deuda sin cuota declarada (currentPayment 0, como dos de la cartera demo) lo distingue de una cuota insuficiente", () => {
  const { context, written } = sandboxCalendarRender();
  context.renderDeudaRutaCalendar([{ id: "b", entity: "Entidad B", type: "Tarjeta", currentPrincipal: 3500, currentPayment: 0, apr: 19 }], MONTHS);
  assert.match(written.deudaRutaCalendar, /sin cuota declarada: no hay calendario que proyectar/);
});

// --- D-4 (auditoría 15 de agosto) · calendario agregado con la estrategia activa ----------------

function sandboxAggregate() {
  const context = {
    Math,
    Number,
    String,
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "0.00 €"),
    escenarioMotorDebtLabel: (contract) => `${contract.entity} ${contract.type}`,
  };
  vm.createContext(context);
  [
    round2Src,
    extractFunction("debtAmortizationSchedule"),
    extractFunction("debtStrategyPayoffPlan"),
    extractFunction("debtAmortizationScheduleForPlan"),
    extractFunction("debtStrategyAggregateCalendar"),
    extractFunction("debtAmortizationTotalInterest"),
    extractFunction("debtRutaAmortChartHtml"),
    extractFunction("debtRutaAmortStatsHtml"),
  ].forEach((source) => vm.runInContext(source, context));
  return context;
}

// Contratos de cero intereses (apr null) para que la amortización sea aritmética simple y
// predecible: 1.200 € a 200 €/mes se salda exacto en 6 meses, 2.400 € a 200 €/mes en 12.
const CONTRACT_A = { id: "a", entity: "Banco A", type: "Préstamo", currentPrincipal: 1200, currentPayment: 200, apr: null };
const CONTRACT_B = { id: "b", entity: "Banco B", type: "Préstamo", currentPrincipal: 2400, currentPayment: 200, apr: null };

test("D-4 · debtStrategyPayoffPlan solo recuerda las decisiones aplicadas con mes resuelto", () => {
  const context = sandboxAggregate();
  const decisions = [
    { id: "d1", tipo: "amortizacion", params: { deudaId: "a" } },
    { id: "d2", tipo: "amortizacion", params: { deudaId: "b" } },
  ];
  const resultadosById = new Map([
    ["d1", { resultado: "aplicada", mesResuelto: "2026-03" }],
    ["d2", { resultado: "sin-mes-viable" }],
  ]);
  const plan = context.debtStrategyPayoffPlan(MONTHS, decisions, resultadosById);
  assert.equal(plan.payoffMonthByDebt.get("a"), "2026-03");
  assert.equal(plan.payoffMonthByDebt.has("b"), false);
  assert.equal(plan.nuevosPrestamos.length, 0);
});

test("D-4 · debtStrategyPayoffPlan construye el préstamo nuevo de una reunificación (TIN en fracción, se convierte a porcentaje)", () => {
  const context = sandboxAggregate();
  const decisions = [
    {
      id: "d1",
      tipo: "reunificacion",
      params: { deudaIds: ["a", "b"], nuevoPrincipal: 3000, nuevaCuota: 120, nuevoTIN: 0.041, nuevoPlazo: 36 },
    },
  ];
  const resultadosById = new Map([["d1", { resultado: "aplicada", mesResuelto: "2026-05" }]]);
  const plan = context.debtStrategyPayoffPlan(MONTHS, decisions, resultadosById);
  assert.equal(plan.payoffMonthByDebt.get("a"), "2026-05");
  assert.equal(plan.payoffMonthByDebt.get("b"), "2026-05");
  assert.equal(plan.nuevosPrestamos.length, 1);
  const nuevo = plan.nuevosPrestamos[0];
  assert.equal(nuevo.currentPrincipal, 3000);
  assert.equal(nuevo.currentPayment, 120);
  assert.equal(nuevo.apr, 4.1);
  assert.equal(nuevo.desde, "2026-05");
});

test("D-4 · debtAmortizationScheduleForPlan sin mes de liquidación deja el calendario natural intacto", () => {
  const context = sandboxAggregate();
  const schedule = context.debtAmortizationScheduleForPlan(CONTRACT_A, MONTHS, null);
  assert.equal(schedule.rows.length, 6);
  assert.equal(schedule.payoffIndex, null);
});

test("D-4 · debtAmortizationScheduleForPlan marca el mes de liquidación de golpe sin recortar las filas (eso lo hace quien agrega)", () => {
  const context = sandboxAggregate();
  // CONTRACT_A se saldaría solo en el mes 6 (índice 5); la ruta lo liquida antes, en el mes 3
  // (índice 2, MONTHS[2].monthKey = "2026-03"). Las filas naturales quedan intactas: el corte real
  // de meses vive en debtStrategyAggregateCalendar, no aquí — así el mismo campo `payoffIndex` sirve
  // igual para un contrato con calendario real y para uno «stalled» con una sola fila.
  const schedule = context.debtAmortizationScheduleForPlan(CONTRACT_A, MONTHS, "2026-03");
  assert.equal(schedule.rows.length, 6);
  assert.equal(schedule.payoffIndex, 2);
});

test("D-4 · debtAmortizationScheduleForPlan ignora un mes de liquidación que llega después del fin natural", () => {
  const context = sandboxAggregate();
  const schedule = context.debtAmortizationScheduleForPlan(CONTRACT_A, MONTHS, "2026-12");
  assert.equal(schedule.rows.length, 6);
  assert.equal(schedule.payoffIndex, null);
});

test("D-4 · debtAmortizationTotalInterest suma el interés de todos los contratos, sin decisión alguna", () => {
  const context = sandboxAggregate();
  const total = context.debtAmortizationTotalInterest([CONTRACT_A, CONTRACT_B], MONTHS.length);
  // apr:null → interés cero en ambos.
  assert.equal(total, 0);
  const withInterest = context.debtAmortizationTotalInterest([{ ...CONTRACT_A, apr: 12 }], MONTHS.length);
  assert.ok(withInterest > 0);
});

test("D-4 · debtStrategyAggregateCalendar sin decisiones (no-tocar) coincide exactamente con solo mínimos", () => {
  const context = sandboxAggregate();
  const aggregate = context.debtStrategyAggregateCalendar([], new Map(), [CONTRACT_A, CONTRACT_B], MONTHS);
  const baseline = context.debtAmortizationTotalInterest([CONTRACT_A, CONTRACT_B], MONTHS.length);
  assert.equal(aggregate.totalInterest, baseline);
  // CONTRACT_A se salda en el mes 6 (el primero de los dos, natural).
  assert.equal(aggregate.firstPayoff.label, "Banco A Préstamo");
  assert.equal(aggregate.firstPayoff.monthKey, "2026-06");
});

test("D-4 · debtStrategyAggregateCalendar adelanta el hito de liquidación cuando la ruta amortiza un contrato de golpe", () => {
  const context = sandboxAggregate();
  const decisions = [{ id: "d1", tipo: "amortizacion", params: { deudaId: "a" } }];
  const resultadosById = new Map([["d1", { resultado: "aplicada", mesResuelto: "2026-02" }]]);
  const aggregate = context.debtStrategyAggregateCalendar(decisions, resultadosById, [CONTRACT_A, CONTRACT_B], MONTHS);
  // Liquidado de golpe en el mes 2 (índice 1) en vez de en el mes 6 natural.
  assert.equal(aggregate.firstPayoff.monthKey, "2026-02");
  const baseline = context.debtAmortizationTotalInterest([CONTRACT_A, CONTRACT_B], MONTHS.length);
  assert.equal(aggregate.totalInterest, baseline, "apr:null en ambos contratos: el interés total sigue siendo cero, solo cambia el hito");
  // El capital de "a" desaparece de la serie agregada a partir del mes de liquidación; en el mes 1
  // los dos contratos aún amortizan su cuota normal (200 € cada uno).
  assert.equal(aggregate.series[0].capital, CONTRACT_A.currentPrincipal + CONTRACT_B.currentPrincipal - 200 * 2);
});

test("D-4 · debtStrategyAggregateCalendar añade el préstamo nuevo de una reunificación desde el mes en que se firma", () => {
  const context = sandboxAggregate();
  const decisions = [
    {
      id: "d1",
      tipo: "reunificacion",
      params: { deudaIds: ["a", "b"], nuevoPrincipal: 3000, nuevaCuota: 300, nuevoTIN: 0, nuevoPlazo: 10 },
    },
  ];
  const resultadosById = new Map([["d1", { resultado: "aplicada", mesResuelto: "2026-02" }]]);
  const aggregate = context.debtStrategyAggregateCalendar(decisions, resultadosById, [CONTRACT_A, CONTRACT_B], MONTHS);
  // Mes 1 (antes de firmar): los dos contratos originales siguen vivos, sin préstamo nuevo todavía.
  assert.equal(aggregate.series[0].capital, CONTRACT_A.currentPrincipal + CONTRACT_B.currentPrincipal - 200 * 2);
  // Mes 2 (se firma la reunificación): los dos contratos originales desaparecen, entra el nuevo ya
  // con su primera cuota aplicada (3.000 € − 300 €/mes sin interés, nuevoTIN 0).
  assert.equal(aggregate.series[1].capital, 2700);
});

test("D-4 · debtStrategyAggregateCalendar mantiene el saldo de una deuda sin cuota declarada en todos los meses, no solo en el primero", () => {
  const context = sandboxAggregate();
  const stalled = { id: "s", entity: "Banco S", type: "Tarjeta", currentPrincipal: 3500, currentPayment: 0, apr: null };
  const aggregate = context.debtStrategyAggregateCalendar([], new Map(), [stalled], MONTHS);
  // Sin cuota que la amortice, el saldo se queda congelado en 3.500 € todos los meses del horizonte
  // — no puede desaparecer del agregado solo porque su propio calendario corta en una sola fila.
  MONTHS.forEach((month, index) => {
    if (index < aggregate.series.length) assert.equal(aggregate.series[index].capital, 3500, `Mes ${month.month}`);
  });
  assert.equal(aggregate.firstPayoff, null, "una deuda estancada nunca cuenta como liquidada");
});

test("D-4 · debtStrategyAggregateCalendar libera el saldo congelado si la ruta la liquida de golpe", () => {
  const context = sandboxAggregate();
  const stalled = { id: "s", entity: "Banco S", type: "Tarjeta", currentPrincipal: 3500, currentPayment: 0, apr: null };
  const decisions = [{ id: "d1", tipo: "amortizacion", params: { deudaId: "s" } }];
  const resultadosById = new Map([["d1", { resultado: "aplicada", mesResuelto: "2026-03" }]]);
  const aggregate = context.debtStrategyAggregateCalendar(decisions, resultadosById, [stalled], MONTHS);
  assert.equal(aggregate.series[0].capital, 3500);
  assert.equal(aggregate.series[1].capital, 3500);
  assert.equal(aggregate.firstPayoff.monthKey, "2026-03");
});

test("D-4 · debtRutaAmortChartHtml pinta una barra por mes con eje de primero/medio/último", () => {
  const context = sandboxAggregate();
  const html = context.debtRutaAmortChartHtml([
    { monthKey: "2026-01", month: "ene 2026", capital: 1000 },
    { monthKey: "2026-02", month: "feb 2026", capital: 500 },
    { monthKey: "2026-03", month: "mar 2026", capital: 0 },
  ]);
  assert.equal((html.match(/deuda-ruta-amort-bar/g) || []).length, 3);
  assert.match(html, /<span>ene 2026<\/span>/);
  assert.match(html, /<span>mar 2026<\/span>/);
});

test("D-4 · debtRutaAmortChartHtml sin serie dice que no hay deuda viva en vez de un gráfico vacío", () => {
  const context = sandboxAggregate();
  assert.match(context.debtRutaAmortChartHtml([]), /Sin deuda viva/);
});

test("D-4 · debtRutaAmortStatsHtml nombra el primer contrato liquidado, el interés total y lo compara con solo mínimos", () => {
  const context = sandboxAggregate();
  const html = context.debtRutaAmortStatsHtml(
    { totalInterest: 80, firstPayoff: { label: "Banco A Préstamo", month: "feb 2026" } },
    100,
  );
  assert.match(html, /feb 2026 · Banco A Préstamo/);
  assert.match(html, /80\.00 €/);
  assert.match(html, /20\.00 € menos que solo mínimos/);
});

test("D-4 · debtRutaAmortStatsHtml dice explícitamente cuándo la ruta no adelanta nada frente a solo mínimos", () => {
  const context = sandboxAggregate();
  const html = context.debtRutaAmortStatsHtml({ totalInterest: 50, firstPayoff: null }, 50);
  assert.match(html, /no adelanta ningún pago/);
  assert.match(html, /Ninguno dentro de este horizonte/);
});

// --- Cableado: renderDeudaComparar/renderDeudaRuta llaman a las piezas nuevas -------------------

test("D-5/D-6 · renderDeudaComparar pinta la sección de modos", () => {
  const source = extractFunction("renderDeudaComparar");
  assert.match(source, /renderDeudaCompararModes\(\)/);
});

test("D-4 · renderDeudaRuta pinta el calendario en el mismo orden de ataque que la pestaña activa", () => {
  const source = extractFunction("renderDeudaRuta");
  assert.match(source, /renderDeudaRutaCalendar\(/);
  assert.match(source, /debtStrategyOrderedContracts\(deudaRutaSelectedStrategy\)/);
});

test("D-4 · renderDeudaRuta calcula y pinta el calendario agregado (gráfico + estadísticas)", () => {
  const source = extractFunction("renderDeudaRuta");
  assert.match(source, /debtStrategyAggregateCalendar\(summary\.decisions, resultadosById, calendarContracts, baseInput\.months\)/);
  assert.match(source, /debtAmortizationTotalInterest\(calendarContracts, baseInput\.months\.length\)/);
  assert.match(source, /qs\("deudaRutaAmortChart"\)/);
  assert.match(source, /qs\("deudaRutaAmortStats"\)/);
});

test("D-5/D-6 · index.html declara los elementos del selector de modo y de su comparativa", () => {
  [
    "deudaCompararModeContract",
    "deudaCompararModeSelect",
    "deudaCompararModeFields",
    "deudaCompararModeResult",
    "deudaCompararModeApply",
    "deudaCompararModeCompare",
    "deudaCompararModeCompareBody",
    "deudaCompararModeInsight",
  ].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `Falta id="${id}" en index.html`);
  });
});

test("D-6 · la cabecera de la comparativa trae los cinco indicadores del criterio (mes, caja mínima, coste, cuota resultante, resultado)", () => {
  assert.match(
    html,
    /<thead><tr><th>Modo<\/th><th>Mes<\/th><th>Caja mínima<\/th><th>Coste<\/th><th>Cuota resultante<\/th><th>Resultado<\/th><th><\/th><\/tr><\/thead>/,
  );
});

test("D-4 · index.html declara el contenedor del calendario dentro de #deuda-ruta", () => {
  const start = html.indexOf('id="deuda-ruta"');
  const end = html.indexOf("</section>", start);
  assert.ok(start >= 0 && end > start);
  const section = html.slice(start, end);
  assert.match(section, /id="deudaRutaCalendar"/);
  assert.match(section, /id="deudaRutaAmortChart"/);
  assert.match(section, /id="deudaRutaAmortStats"/);
});

test("D-5/D-6 · los manejadores de la sección de modos quedan enlazados en el arranque", () => {
  [
    'qs("deudaCompararModeContract")?.addEventListener("change", handleDeudaCompararModeContractChange)',
    'qs("deudaCompararModeSelect")?.addEventListener("change", handleDeudaCompararModeSelectChange)',
    'qs("deudaCompararModeFields")?.addEventListener("input", handleDeudaCompararModeFieldChange)',
    'qs("deudaCompararModeCompareBody")?.addEventListener("click", handleDeudaCompararModeCompareClick)',
    'qs("deudaCompararModeApply")?.addEventListener("click", handleDeudaCompararModeApply)',
  ].forEach((snippet) => {
    assert.ok(app.includes(snippet), `Falta el cableado: ${snippet}`);
  });
});

// --- D-5: aplicar un modo manda una única decisión al mismo flujo de "aplicar" que las estrategias

test("D-5 · handleDeudaCompararModeApply reutiliza escenarioMotorNavigate(\"escenario-aplicar\"), el mismo flujo de D-8/D-9", () => {
  const source = extractFunction("handleDeudaCompararModeApply");
  assert.match(source, /escenarioMotorDecisions = \[/);
  assert.match(source, /escenarioMotorNavigate\("escenario-aplicar"\)/);
  assert.match(source, /if \(!result\.available \|\| !result\.viable\) return;/);
});
