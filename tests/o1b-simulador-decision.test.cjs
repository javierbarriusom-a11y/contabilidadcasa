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
