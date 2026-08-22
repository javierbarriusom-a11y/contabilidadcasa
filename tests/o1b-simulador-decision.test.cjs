const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const schema = require(path.join(root, "canonical-scenario-schema.js"));
const engine = require(path.join(root, "canonical-scenario-engine.js"));

// O-1b (22 de agosto de 2026): Simulador de decisión en Planificación de partidas — compra o
// crédito nuevo hipotéticos, ad-hoc, con impacto en vivo y barrido de meses candidatos ("mejor
// fecha"). Dos piezas:
//   1. Esquema: titular opcional en compra/deuda_nueva, mismo criterio aditivo que titularOrigen/
//      titularDestino en refinanciación/reunificación (O-1) — puro metadato, no cambia ningún
//      cálculo de caja (a diferencia de refinanciación, aquí no hay contrato de deuda al que
//      anotarle nada, así que ni siquiera se propaga al motor: solo viaja en decision.params).
//   2. app.js: el propio simulador, que reutiliza ESCENARIO_MOTOR_TYPES (compra/deuda_nueva) y el
//      trío escenarioMotorBaseInput/runEscenarioMotor/escenarioMotorSummaryFor tal cual.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function makeId(prefix, seed) {
  let out = "";
  for (let index = 0; index < 26; index += 1) out += ALPHABET[(seed * (index + 7) + index * 13) % ALPHABET.length];
  return `${prefix}_${out}`;
}

function baseEscenario(decisiones) {
  return {
    schemaVersion: "1.0",
    id: makeId("scn", 1),
    nombre: "Escenario de prueba O-1b",
    estado: "borrador",
    base: { datasetVersion: "v2026-08-cierre", fechaCorte: "2026-08-01", hashIntegridad: `sha256:${"a".repeat(64)}`, horizonteMeses: 24 },
    supuestos: { inflacionAnual: 0.025, derivaIngresosAnual: 0.01, derivaGastosAnual: 0.02, rentabilidadAhorroAnual: 0.021, deltaTipoVariable: 0, modoTraspaso: "prudente" },
    guardarrailes: { reservaOperativaCaixaBank: 3000, colchonMinimoMeses: 3, ratioCuotaIngresoMax: 0.35, saldoMinimoAbsoluto: 500 },
    decisiones,
  };
}

function decision(tipo, params, __seed = 1) {
  return { id: makeId("dec", __seed), tipo, titulo: `Decisión ${tipo}`, activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-09" }, params };
}

// --- Esquema ---------------------------------------------------------------------------------

test("O-1b · compra sin titular sigue siendo válida (aditivo, no rompe I-09)", () => {
  const result = schema.validateEscenario(baseEscenario([decision("compra", { nombre: "Coche", importe: 3000 })]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1b · deuda_nueva sin titular sigue siendo válida", () => {
  const result = schema.validateEscenario(baseEscenario([decision("deuda_nueva", { principal: 8000, cuota: 180, plazo: 48, mes: "2026-10" })]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1b · compra acepta titular javi/tere/hogar", () => {
  ["hogar", "javi", "tere"].forEach((titular) => {
    const result = schema.validateEscenario(baseEscenario([decision("compra", { nombre: "Coche", importe: 3000, titular })]));
    assert.equal(result.valid, true, `${titular}: ${JSON.stringify(result.issues)}`);
  });
});

test("O-1b · deuda_nueva acepta titular javi/tere/hogar", () => {
  ["hogar", "javi", "tere"].forEach((titular) => {
    const result = schema.validateEscenario(baseEscenario([decision("deuda_nueva", { principal: 8000, cuota: 180, plazo: 48, mes: "2026-10", titular })]));
    assert.equal(result.valid, true, `${titular}: ${JSON.stringify(result.issues)}`);
  });
});

test("O-1b · titular fuera del enum TITULARES se rechaza en compra", () => {
  const result = schema.validateEscenario(baseEscenario([decision("compra", { nombre: "Coche", importe: 3000, titular: "vecino" })]));
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path.endsWith(".titular") && issue.code === "invalid-enum"));
});

test("O-1b · titular fuera del enum TITULARES se rechaza en deuda_nueva", () => {
  const result = schema.validateEscenario(baseEscenario([decision("deuda_nueva", { principal: 8000, cuota: 180, plazo: 48, mes: "2026-10", titular: "banco" })]));
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path.endsWith(".titular") && issue.code === "invalid-enum"));
});

// --- Motor: titular es puro metadato, no cambia ningún número de la serie ---------------------

function months(n) {
  const out = [];
  for (let index = 0; index < n; index += 1) {
    const m = String(index + 1).padStart(2, "0");
    out.push({ monthKey: `2026-${m}`, income: 3000, coreSpend: 2000, refi: 0, projectOutflow: 0, savingsRate: 0.1 });
  }
  return out;
}

test("O-1b · con o sin titular, resolveEscenario da exactamente la misma serie para una compra", () => {
  const baseInput = { months: months(6), checkingStart: 1000, savingsStart: 500 };
  const withoutTitular = engine.resolveEscenario([decision("compra", { nombre: "Coche", importe: 3000 })], { baseInput });
  const withTitular = engine.resolveEscenario([decision("compra", { nombre: "Coche", importe: 3000, titular: "tere" }, 2)], { baseInput });
  assert.equal(withoutTitular.valid, true);
  assert.equal(withTitular.valid, true);
  assert.deepEqual(withoutTitular.series, withTitular.series);
});

test("O-1b · con o sin titular, resolveEscenario da exactamente la misma serie para deuda_nueva", () => {
  const baseInput = { months: months(6), checkingStart: 1000, savingsStart: 500 };
  const d1 = decision("deuda_nueva", { principal: 8000, cuota: 180, plazo: 4, mes: "2026-02" });
  const d2 = decision("deuda_nueva", { principal: 8000, cuota: 180, plazo: 4, mes: "2026-02", titular: "javi" }, 2);
  const without = engine.resolveEscenario([d1], { baseInput });
  const withTitular = engine.resolveEscenario([d2], { baseInput });
  assert.deepEqual(without.series, withTitular.series);
});

// --- Formulario compartido de "Escenario · simular" (ESCENARIO_MOTOR_TYPES) --------------------

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
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`No se pudo balancear la constante ${name}`);
}

function sandboxEscenarioMotorTypes() {
  const context = {
    Math, Number, String, Array,
    money: (value) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "0.00 €"),
    escenarioMotorTrim: (value, max = 60) => {
      const text = String(value ?? "").trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    },
    escenarioMotorPct: (value) => (Number.isFinite(value) ? Math.round(value * 100 + Number.EPSILON) / 10000 : undefined),
    escenarioMotorInt: (value) => (Number.isFinite(value) ? Math.round(value) : undefined),
  };
  vm.createContext(context);
  vm.runInContext(extractConst("ESCENARIO_MOTOR_TYPES"), context);
  vm.runInContext("globalThis.ESCENARIO_MOTOR_TYPES = ESCENARIO_MOTOR_TYPES;", context);
  return context;
}

function typeById(context, id) {
  return context.ESCENARIO_MOTOR_TYPES.find((entry) => entry.id === id);
}

test("O-1b · compra ofrece un campo titular opcional en su catálogo", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "compra");
  const keys = type.campos.map((field) => field.key);
  assert.ok(keys.includes("titular"));
  const opciones = type.campos.find((field) => field.key === "titular").opciones.map(([value]) => value);
  assert.equal(Array.from(opciones).join(","), "hogar,javi,tere");
});

test("O-1b · deuda_nueva ofrece un campo titular opcional en su catálogo", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "deuda_nueva");
  const keys = type.campos.map((field) => field.key);
  assert.ok(keys.includes("titular"));
});

test("O-1b · sin tocar el titular (o con «hogar»), params() de compra/deuda_nueva no añade la clave — igual que antes", () => {
  const context = sandboxEscenarioMotorTypes();
  const compra = typeById(context, "compra");
  assert.equal(compra.params({ nombre: "Coche", importe: 3000 }).titular, undefined);
  assert.equal(compra.params({ nombre: "Coche", importe: 3000, titular: "hogar" }).titular, undefined);
  const deudaNueva = typeById(context, "deuda_nueva");
  assert.equal(deudaNueva.params({ principal: 8000, cuota: 180, plazo: 48, mes: "2026-10" }).titular, undefined);
});

test("O-1b · con titular distinto de «hogar», params() de compra/deuda_nueva lo incluye", () => {
  const context = sandboxEscenarioMotorTypes();
  const compra = typeById(context, "compra");
  assert.equal(compra.params({ nombre: "Coche", importe: 3000, titular: "tere" }).titular, "tere");
  const deudaNueva = typeById(context, "deuda_nueva");
  assert.equal(deudaNueva.params({ principal: 8000, cuota: 180, plazo: 48, mes: "2026-10", titular: "javi" }).titular, "javi");
});

// --- app.js: el simulador en sí (reutilización + lógica pura) ----------------------------------

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

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

function sandboxWith(names, extra = {}) {
  const context = { round2, ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("partidasSimuladorBuildDecisionForMonth valida con Schema.validateDecision, mismo contrato que handleEscenarioMotorSubmit", () => {
  const source = extractFunction("partidasSimuladorBuildDecisionForMonth");
  assert.match(source, /type\.params\(values\)/);
  assert.match(source, /type\.titulo\(values\)/);
  assert.match(source, /schema\.validateDecision\(decision, "\$", issues\)/);
  assert.match(source, /planificacion:\s*\{\s*modo:\s*"manual",\s*mesManual:\s*monthKey\s*\}/);
});

test("partidasSimuladorBaseline/RunDecision/Evaluate reutilizan runEscenarioMotor/escenarioMotorSummaryFor, no reimplementan el cálculo", () => {
  ["partidasSimuladorBaseline", "partidasSimuladorRunDecision", "partidasSimuladorEvaluate"].forEach((name) => {
    const source = extractFunction(name);
    assert.match(source, /runEscenarioMotor\(|escenarioMotorSummaryFor\(|partidasSimuladorRunDecision\(|partidasSimuladorBaseline\(/, `${name} no reutiliza el motor`);
  });
  assert.match(extractFunction("partidasSimuladorEvaluate"), /escenarioMotorBaseInput\(\)/);
});

test("partidasSimuladorFieldsHtml/SyncValues excluyen el campo «mes» del catálogo genérico (la fecha es el eje de la búsqueda, no un campo más)", () => {
  assert.match(extractFunction("partidasSimuladorFieldsHtml"), /field\.key !== "mes"/);
  assert.match(extractFunction("partidasSimuladorSyncValues"), /field\.key === "mes"/);
});

test("renderPlanificacionPartidas cablea el simulador de decisión", () => {
  const source = extractFunction("renderPlanificacionPartidas");
  assert.match(source, /partidasSimuladorCardHtml\(\)/);
  assert.match(source, /syncPartidasSimModoUi\(\);/);
});

// partidasSimuladorScanMonths es la pieza nueva de verdad: el barrido de meses candidatos que hoy
// no existe en ningún otro sitio del motor canónico (ver la cabecera del bloque en app.js). Se
// mockean sus dos dependencias (build/run) para probar solo la lógica de "quedarse con el mejor"
// sin levantar el motor de escenarios entero — mismo criterio que partidasBulkEditContext.
function scanMonthsContext(extra = {}) {
  return sandboxWith(["partidasSimuladorScanMonths"], {
    partidasSimuladorBuildDecisionForMonth: () => ({ decision: { id: "dec_x" }, errors: [] }),
    partidasSimuladorRunDecision: () => ({ minimoLiquidez: 0 }),
    ...extra,
  });
}

test("partidasSimuladorScanMonths se queda con el mes de mayor minimoLiquidez", () => {
  const summaries = { "2026-09": 1000, "2026-10": 2500, "2026-11": 1800 };
  const context = scanMonthsContext({
    partidasSimuladorRunDecision: (decision, baseInput, monthKey) => ({ minimoLiquidez: summaries[decision.__month] }),
    partidasSimuladorBuildDecisionForMonth: (monthKey) => ({ decision: { id: "dec_x", __month: monthKey }, errors: [] }),
  });
  const months = [{ key: "2026-09", label: "sept 26" }, { key: "2026-10", label: "oct 26" }, { key: "2026-11", label: "nov 26" }];
  const { results, best } = context.partidasSimuladorScanMonths(months, {}, { minimoLiquidez: 500 });
  assert.equal(results.length, 3);
  assert.equal(best.month.key, "2026-10");
  assert.equal(best.deltaMinimo, round2(2500 - 500));
});

test("partidasSimuladorScanMonths deja best en null si ningún mes candidato pudo validarse", () => {
  const context = scanMonthsContext({
    partidasSimuladorBuildDecisionForMonth: () => ({ decision: null, errors: ["importe debe ser mayor que 0."] }),
  });
  const months = [{ key: "2026-09", label: "sept 26" }];
  const { best, results } = context.partidasSimuladorScanMonths(months, {}, { minimoLiquidez: 500 });
  assert.equal(best, null);
  assert.equal(results[0].summary, null);
  assert.deepEqual(results[0].errors, ["importe debe ser mayor que 0."]);
});

test("partidasSimuladorMoneyDelta formatea el signo y usa is-up/is-down; sin dato es un guión", () => {
  const context = sandboxWith(["partidasSimuladorMoneyDelta"], { money: (v) => `${v}€`, escapeHtml: (v) => v });
  assert.equal(context.partidasSimuladorMoneyDelta(null), "—");
  assert.match(context.partidasSimuladorMoneyDelta(120), /is-up/);
  assert.match(context.partidasSimuladorMoneyDelta(120), /\+120€/);
  assert.match(context.partidasSimuladorMoneyDelta(-50), /is-down/);
  assert.doesNotMatch(context.partidasSimuladorMoneyDelta(-50), /\+/);
});

function toggleTargetStub() {
  const state = { hidden: false, classes: new Set() };
  return {
    classList: { toggle: (cls, on) => (on ? state.classes.add(cls) : state.classes.delete(cls)) },
    has: (cls) => state.classes.has(cls),
  };
}

test("syncPartidasSimModoUi muestra el mes único en modo manual y el rango en modo best", () => {
  const monthField = toggleTargetStub();
  const startField = toggleTargetStub();
  const endField = toggleTargetStub();
  const fields = { partidasSimModo: { value: "best" }, partidasSimMonthField: monthField, partidasSimRangeStartField: startField, partidasSimRangeEndField: endField };
  const context = sandboxWith(["syncPartidasSimModoUi"], { qs: (id) => fields[id] });
  context.syncPartidasSimModoUi();
  assert.equal(monthField.has("is-hidden"), true);
  assert.equal(startField.has("is-hidden"), false);
  assert.equal(endField.has("is-hidden"), false);
  fields.partidasSimModo.value = "manual";
  context.syncPartidasSimModoUi();
  assert.equal(monthField.has("is-hidden"), false);
  assert.equal(startField.has("is-hidden"), true);
});

// --- Previsualización en la tabla de gestión (22 de agosto de 2026, 2ª vuelta) -------------------
// El usuario pidió que los importes simulados se vean en la tabla, sin afectar a ninguna otra
// pantalla ni guardarse hasta que se haga desde "Escenario · simular" — y que funcione empezando en
// cualquier mes, no solo el actual. Se resuelve con una fila de solo lectura
// (partidasSimPreviewRowHtml) que lee partidasSimPreview y alinea sus importes por CLAVE de mes
// (no por posición de columna), así que el efecto aparece en la columna real del mes elegido, sea
// cual sea, y desaparece solo con Quitar/nueva simulación/Guardar/Descartar de verdad.

function monthlyDeltasContext(extra = {}) {
  return sandboxWith(["partidasSimuladorMonthlyDeltas"], { runEscenarioMotor: () => ({ valid: false }), ...extra });
}

test("partidasSimuladorMonthlyDeltas aísla el efecto mes a mes, funcionando aunque el efecto empiece a mitad del horizonte (no solo el mes actual)", () => {
  const baseInput = { months: [{ monthKey: "2026-08" }, { monthKey: "2026-09" }, { monthKey: "2026-10" }, { monthKey: "2026-11" }] };
  const baselineSeries = [{ totalLiquidity: 100 }, { totalLiquidity: 100 }, { totalLiquidity: 100 }, { totalLiquidity: 100 }];
  // La decisión (un crédito) entra en el índice 2 ("2026-10", NO el primer mes del horizonte):
  // +500 de principal ese mes (cumulativo: +500), luego -80 de cuota el mes siguiente, que se
  // arrastra sobre el +500 anterior (cumulativo: +420 = 500 - 80).
  const decisionSeries = [{ totalLiquidity: 100 }, { totalLiquidity: 100 }, { totalLiquidity: 600 }, { totalLiquidity: 520 }];
  const context = monthlyDeltasContext({
    runEscenarioMotor: (input, decisions) => ({ valid: true, series: decisions.length ? decisionSeries : baselineSeries }),
  });
  const result = context.partidasSimuladorMonthlyDeltas({ id: "dec_x" }, baseInput);
  // Comparación por JSON.stringify: el array viene de otro realm de vm, así que deepEqual en modo
  // estricto lo rechaza por identidad de constructor Array aunque el contenido sea idéntico.
  assert.equal(JSON.stringify(result), JSON.stringify([
    { key: "2026-08", value: 0 },
    { key: "2026-09", value: 0 },
    { key: "2026-10", value: 500 },
    { key: "2026-11", value: -80 },
  ]));
});

test("partidasSimuladorMonthlyDeltas devuelve [] si el motor rechaza la base o la decisión", () => {
  const baseInput = { months: [{ monthKey: "2026-08" }] };
  const context = monthlyDeltasContext({ runEscenarioMotor: () => ({ valid: false }) });
  assert.equal(JSON.stringify(context.partidasSimuladorMonthlyDeltas({ id: "dec_x" }, baseInput)), "[]");
});

function previewRowContext(extra = {}) {
  return sandboxWith(["partidasSimPreviewRowHtml"], {
    partidasSimPreview: null,
    partidasSimuladorMoneyDelta: (v) => (v ? `<span>${v}</span>` : "—"),
    escapeHtml: (v) => v,
    ...extra,
  });
}

test("partidasSimPreviewRowHtml no pinta nada sin previsualización activa", () => {
  const context = previewRowContext();
  assert.equal(context.partidasSimPreviewRowHtml([{ key: "2026-08", label: "ago 26" }]), "");
});

test("partidasSimPreviewRowHtml alinea los importes por clave de mes, no por posición de columna — se ve en el mes elegido aunque no sea el primero visible", () => {
  const context = previewRowContext({
    partidasSimPreview: { titulo: "Crédito nuevo", monthlyDeltas: [{ key: "2026-10", value: 500 }, { key: "2026-11", value: -80 }] },
  });
  const html = context.partidasSimPreviewRowHtml([
    { key: "2026-08", label: "ago 26" },
    { key: "2026-10", label: "oct 26" },
    { key: "2026-11", label: "nov 26" },
  ]);
  assert.match(html, /Crédito nuevo/);
  assert.match(html, /Previsualización, no guardada/);
  const cells = [...html.matchAll(/<td class="planificacion-partidas-sim-preview-cell">(.*?)<\/td>/g)].map((m) => m[1]);
  assert.deepEqual(cells, ["—", "<span>500</span>", "<span>-80</span>"]);
});

test("renderPartidasGestionTable pinta la fila de previsualización del simulador", () => {
  assert.match(extractFunction("renderPartidasGestionTable"), /partidasSimPreviewRowHtml\(months\)/);
});

test("handlePartidasSimular calcula y guarda la previsualización a partir del mes elegido (manual o el mejor encontrado), y repinta la tabla", () => {
  const source = extractFunction("handlePartidasSimular");
  assert.match(source, /partidasSimuladorMonthlyDeltas\(/);
  assert.match(source, /partidasSimPreview = /);
  assert.match(source, /scan\?\.best\?\.decision/);
  assert.match(source, /renderPartidasGestionTable\(visualMonths\(\)\)/);
});

test("handlePartidasSimClearPreview limpia la previsualización sin tocar ningún borrador real", () => {
  const source = extractFunction("handlePartidasSimClearPreview");
  assert.match(source, /partidasSimPreview = null/);
  assert.doesNotMatch(source, /visualDraftCells|customPlanningRows/);
});

test("Guardar/Descartar de verdad limpian cualquier previsualización activa, para que no quede una simulación obsoleta pintada en la tabla", () => {
  assert.match(extractFunction("handlePartidasSave"), /partidasSimPreview = null/);
  assert.match(extractFunction("handlePartidasDiscard"), /partidasSimPreview = null/);
});

// --- Totales estilo pantalla legacy + quitar la lista infinita de "mejor mes" (22 de agosto, 3ª vuelta) ---
// El usuario pidió una fila de totales como en "Cuadro de mandos (heredado)" que refleje el
// resultado con y sin la decisión simulada, y que "buscar la mejor fecha" no obligue a hacer scroll
// por cada uno de los (potencialmente cientos de) meses candidatos del horizonte.

function totalsByKindContext(extra = {}) {
  return sandboxWith(["partidasTotalsByKind"], {
    baseData: { monthlyPlanning: { sections: [] } },
    visualRowsForSection: () => [],
    visualSectionTotal: () => 0,
    ...extra,
  });
}

test("partidasTotalsByKind suma visualSectionTotal de todas las secciones del kind pedido, ignorando el otro kind", () => {
  const sections = [
    { name: "Nómina", kind: "income" },
    { name: "Alquiler", kind: "expense" },
    { name: "Otro ingreso", kind: "income" },
  ];
  const months = [{ key: "2026-08", label: "ago 26" }, { key: "2026-09", label: "sept 26" }];
  const totalsBySection = { Nómina: [1000, 1000], Alquiler: [200, 200], "Otro ingreso": [50, 60] };
  const context = totalsByKindContext({
    baseData: { monthlyPlanning: { sections } },
    visualRowsForSection: (section) => [{ id: section.name }],
    visualSectionTotal: (section, rows, monthsArg, mode, month) => {
      const index = months.findIndex((m) => m.key === month.key);
      return totalsBySection[section.name][index];
    },
  });
  assert.equal(JSON.stringify(context.partidasTotalsByKind(months, "income")), JSON.stringify([1050, 1060]));
  assert.equal(JSON.stringify(context.partidasTotalsByKind(months, "expense")), JSON.stringify([200, 200]));
});

test("partidasCalculatedRowHtml pinta los valores con las mismas clases visual-calculated-row que usa la pantalla legacy", () => {
  const context = sandboxWith(["partidasCalculatedRowHtml"], { money: (v) => `${v}€`, escapeHtml: (v) => v });
  const html = context.partidasCalculatedRowHtml("result-section", "Resultado", "detalle", [100, -50]);
  assert.match(html, /class="visual-section-row visual-calculated-row result-section"/);
  assert.match(html, /<strong>Resultado<\/strong>/);
  assert.match(html, /<td>100€<\/td>/);
  assert.match(html, /<td>-50€<\/td>/);
});

function resultConSimContext(extra = {}) {
  return sandboxWith(["partidasResultConSimulacionRowHtml"], {
    partidasSimPreview: null,
    money: (v) => `${v}€`,
    escapeHtml: (v) => v,
    ...extra,
  });
}

test("partidasResultConSimulacionRowHtml no pinta nada sin previsualización activa", () => {
  const context = resultConSimContext();
  assert.equal(context.partidasResultConSimulacionRowHtml([{ key: "2026-08" }], [100]), "");
});

test("partidasResultConSimulacionRowHtml suma el delta de la previsualización al resultado base, mes a mes — así se ve el resultado con y sin impacto", () => {
  const context = resultConSimContext({
    partidasSimPreview: { titulo: "Crédito nuevo", monthlyDeltas: [{ key: "2026-08", value: 0 }, { key: "2026-09", value: -80 }] },
  });
  const months = [{ key: "2026-08" }, { key: "2026-09" }];
  const html = context.partidasResultConSimulacionRowHtml(months, [100, 100]);
  assert.match(html, /<td>100€<\/td>/);
  assert.match(html, /<td>20€<\/td>/);
});

test("renderPartidasGestionTable pinta los totales estilo pantalla legacy y el resultado con simulación", () => {
  const source = extractFunction("renderPartidasGestionTable");
  assert.match(source, /partidasTotalsByKind\(months, "income"\)/);
  assert.match(source, /partidasTotalsByKind\(months, "expense"\)/);
  assert.match(source, /partidasCalculatedRowHtml\(/);
  assert.match(source, /partidasResultConSimulacionRowHtml\(/);
});

test('el modo «buscar mejor mes» ya no lista cada mes candidato (scroll infinito con un horizonte de años) — solo el mejor, con las mismas cifras que el modo manual', () => {
  const source = extractFunction("partidasSimuladorResultHtml");
  assert.doesNotMatch(source, /planificacion-partidas-simulador-ranking/);
  assert.match(source, /asesor-decision-stats/);
});

// --- "Disponible para traspaso" heredado, en bloque aparte (22 de agosto, 4ª vuelta) -------------
// Las mismas cuatro cifras que renderVisualDetailTable en "Cuadro de mandos (heredado)", pero
// reescritas sobre datos globales (lastSimulation, accountBalancesFromState, agentCaixaFloor) sin
// tocar #visual-detail, en un bloque propio tras el Resultado.

function dateHelpers() {
  return {
    monthKey: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    addMonths: (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1),
    dateFromMonthKey: (key) => {
      const [year, month] = key.split("-").map(Number);
      return new Date(year, month - 1, 1);
    },
  };
}

function transferContext(names, extra = {}) {
  return sandboxWith(names, {
    lastSimulation: [],
    accountBalancesFromState: () => ({ caixa: 0 }),
    agentCaixaFloor: () => 0,
    baseData: { monthlyPlanning: { sections: [] } },
    visualRowsForSection: () => [],
    isVisualRowPendingDelete: () => false,
    seriesKeyForRow: (row) => row.label || "row",
    normalizedText: (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    visualDisplayLabel: (row) => row.label || "",
    visualCellValue: () => 0,
    ...dateHelpers(),
    ...extra,
  });
}

test("partidasStartingCaixaByMonth lee el saldo de la simulación de ese mes, o el saldo actual de la cuenta si no hay fila", () => {
  const context = transferContext(["partidasStartingCaixaByMonth"], {
    lastSimulation: [{ detailMonthKey: "2026-09", startChecking: 1000 }],
    accountBalancesFromState: () => ({ caixa: 250 }),
  });
  const months = [{ key: "2026-09" }, { key: "2026-10" }];
  assert.equal(JSON.stringify(context.partidasStartingCaixaByMonth(months)), JSON.stringify([1000, 250]));
});

test("partidasAvailableForTransferByMonth: caja inicial (de la simulación de ese mes) + ingresos - gastos - reserva, sin bajar de 0", () => {
  const context = transferContext(["partidasStartingCaixaByMonth", "partidasAvailableForTransferByMonth"], {
    lastSimulation: [{ detailMonthKey: "2026-09", startChecking: 1000 }],
    agentCaixaFloor: () => 300,
  });
  const months = [{ key: "2026-09" }, { key: "2026-10" }];
  const result = context.partidasAvailableForTransferByMonth(months, [500, 100], [200, 900]);
  // 2026-09: 1000 + 500 - 200 - 300 = 1000
  // 2026-10 (sin simulación para ese mes: usa el saldo de caja de accountBalancesFromState=0)
  //   0 + 100 - 900 - 300 = -1100 -> se recorta a 0
  assert.equal(JSON.stringify(result), JSON.stringify([1000, 0]));
});

test("partidasCashflowByMonth es saldo + resultado del mes, sin recorte a 0 (puede salir negativo, a diferencia de Disponible para traspaso)", () => {
  const context = transferContext(["partidasStartingCaixaByMonth", "partidasCashflowByMonth"], {
    lastSimulation: [{ detailMonthKey: "2026-09", startChecking: 1000 }],
  });
  const months = [{ key: "2026-09" }, { key: "2026-10" }];
  const result = context.partidasCashflowByMonth(months, [500, -900]);
  // 2026-09: 1000 + 500 = 1500
  // 2026-10 (sin simulación: saldo de accountBalancesFromState=0): 0 + (-900) = -900
  assert.equal(JSON.stringify(result), JSON.stringify([1500, -900]));
});

test("renderPartidasGestionTable cablea «Cashflow previsto» justo después de «Resultado»", () => {
  const source = extractFunction("renderPartidasGestionTable");
  const resultIndex = source.indexOf('"Resultado"');
  const cashflowIndex = source.indexOf("Cashflow previsto");
  assert.ok(resultIndex >= 0 && cashflowIndex > resultIndex, "Cashflow previsto debe cablearse después de Resultado");
  assert.match(source, /partidasCashflowByMonth\(months, resultTotals\)/);
});

test("partidasNextMonthPlannedExpenses lee el mes siguiente de lastSimulation aunque quede fuera del rango visible, y no baja de 0", () => {
  const context = transferContext(["partidasNextMonthPlannedExpenses"], {
    lastSimulation: [
      { detailMonthKey: "2026-09", outflowsBeforeSaving: 1200 },
      { detailMonthKey: "2026-10", outflowsBeforeSaving: 1500 },
    ],
  });
  // Solo agosto está en el rango visible; su "mes siguiente" (septiembre) sí está en lastSimulation.
  const months = [{ key: "2026-08" }, { key: "2026-10" }];
  const result = context.partidasNextMonthPlannedExpenses(months);
  // ago -> next sept (1200); oct -> next nov (sin dato en lastSimulation -> 0)
  assert.equal(JSON.stringify(result), JSON.stringify([1200, 0]));
});

test("partidasTereSalaryByMonth solo suma filas de ingresos cuyo nombre combine «tere» con «nomina»/«salario»", () => {
  const context = transferContext(["partidasTereSalaryByMonth"], {
    baseData: { monthlyPlanning: { sections: [{ name: "Ingresos", kind: "income" }, { name: "Gastos fijos", kind: "expense" }] } },
    visualRowsForSection: (section) => (section.kind === "income" ? [{ label: "Nómina Tere" }, { label: "Bonus Javi" }] : []),
    visualDisplayLabel: (row) => row.label,
    visualCellValue: (row) => (row.label === "Nómina Tere" ? 1850 : 500),
  });
  const months = [{ key: "2026-09" }];
  assert.equal(JSON.stringify(context.partidasTereSalaryByMonth(months)), JSON.stringify([1850]));
});

test("partidasTransferRowsHtml reutiliza partidasCalculatedRowHtml para las cuatro filas heredadas, en un bloque con cabecera propia", () => {
  const source = extractFunction("partidasTransferRowsHtml");
  assert.match(source, /partidasAvailableForTransferByMonth\(/);
  assert.match(source, /partidasNextMonthPlannedExpenses\(/);
  assert.match(source, /partidasTereSalaryByMonth\(/);
  assert.match(source, /partidasCalculatedRowHtml\("transfer-section"/);
  assert.match(source, /partidasCalculatedRowHtml\("transfer-adjusted-section"/);
  assert.match(source, /partidasCalculatedRowHtml\("transfer-prudent-section"/);
  assert.match(source, /partidasCalculatedRowHtml\("transfer-prudent-adjusted-section"/);
  assert.match(source, /colspan="\$\{months\.length \+ 2\}"/);
});

test("renderPartidasGestionTable cablea el bloque de «Disponible para traspaso» tras el Resultado", () => {
  const source = extractFunction("renderPartidasGestionTable");
  assert.match(source, /partidasTransferRowsHtml\(months, incomeTotals, expenseTotals\)/);
});
