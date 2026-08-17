const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const Engine = require(path.join(root, "canonical-scenario-engine.js"));

// Fase 6 · Escenarios (segunda fase de cierre de huecos, 17 de agosto): E-1 añade dos tipos de
// deuda que el catálogo no cubría ("Pedir deuda nueva", "Prestar o cobrar a familia") y E-1b deja
// crear tipos propios — los tres comparten el mismo patrón de aplicador (`NON_DEBT_APPLIERS`),
// nunca tocan `debtState`, así que se prueban aquí directamente contra el motor real en vez de
// contra un doble.

function months(count, startYear = 2026, startMonth = 1) {
  return Array.from({ length: count }, (_, index) => {
    const total = startMonth - 1 + index;
    const year = startYear + Math.floor(total / 12);
    const month = (total % 12) + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    return { monthKey, income: 3000, coreSpend: 1500, car: 0, refi: 0, projectOutflow: 0 };
  });
}

function baseInput(count = 4) {
  return { openingBalances: { checking: 5000, savings: 2000 }, months: months(count) };
}

function decision(id, tipo, params, mesManual) {
  return {
    id,
    tipo,
    titulo: `Decisión ${tipo}`,
    activa: true,
    orden: 0,
    planificacion: { modo: "manual", mesManual },
    params,
  };
}

// --- deuda_nueva (E-1) -------------------------------------------------------------------------

test("E-1 · deuda_nueva suma el principal al mes de inicio y resta la cuota desde el mes siguiente", () => {
  const input = baseInput(4);
  const dec = decision("dec_1", "deuda_nueva", { principal: 1000, cuota: 100, plazo: 2, mes: "2026-01" }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });

  assert.equal(withDecision.resultados[0].resultado, "aplicada");
  // Mes 1: +1000 de principal, sin cuota todavía.
  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), 1000);
  // Meses 2 y 3: -100 de cuota cada uno, acumulado sobre el efecto del principal.
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), 900);
  assert.equal(round(withDecision.series[2].totalLiquidity - baseline.series[2].totalLiquidity), 800);
  // Mes 4: el plazo de dos meses ya terminó, no hay más cuota.
  assert.equal(round(withDecision.series[3].totalLiquidity - baseline.series[3].totalLiquidity), 800);
});

test("E-1 · deuda_nueva no crea contrato en debtStateFinal (no cuenta para fecha libre de deuda)", () => {
  const input = baseInput(2);
  const dec = decision("dec_1", "deuda_nueva", { principal: 1000, cuota: 100, plazo: 2, mes: "2026-01" }, "2026-01");
  const result = Engine.resolveEscenario([dec], { baseInput: input });
  assert.equal(result.debtStateFinal.length, 0);
});

// --- prestamo_familiar (E-1) -------------------------------------------------------------------

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

test("E-1 · prestamo_familiar «nos_prestan» suma el importe y resta la devolución desde el mes siguiente", () => {
  const input = baseInput(3);
  const dec = decision("dec_1", "prestamo_familiar", { direccion: "nos_prestan", importe: 500, mes: "2026-01", devolucionMensual: 50, meses: 2 }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });

  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), 500);
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), 450);
  assert.equal(round(withDecision.series[2].totalLiquidity - baseline.series[2].totalLiquidity), 400);
});

test("E-1 · prestamo_familiar «prestamos» resta el importe y suma la devolución desde el mes siguiente", () => {
  const input = baseInput(3);
  const dec = decision("dec_1", "prestamo_familiar", { direccion: "prestamos", importe: 300, mes: "2026-01", devolucionMensual: 50, meses: 1 }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });

  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), -300);
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), -250);
  assert.equal(round(withDecision.series[2].totalLiquidity - baseline.series[2].totalLiquidity), -250);
});

test("E-1 · prestamo_familiar sin devolución declarada no toca los meses siguientes", () => {
  const input = baseInput(2);
  const dec = decision("dec_1", "prestamo_familiar", { direccion: "prestamos", importe: 300, mes: "2026-01" }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });
  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), -300);
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), -300);
});

// --- propio (E-1b) --------------------------------------------------------------------------

test("E-1b · un tipo propio con solo importe aplica un golpe único en el mes elegido", () => {
  const input = baseInput(2);
  const dec = decision("dec_1", "propio", { definicionId: "propio-1", nombre: "Herencia", importe: 2000, mes: "2026-01" }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });
  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), -2000);
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), -2000);
});

test("E-1b · un tipo propio con mensualidad y plazo aplica un recurrente desde el mes elegido (inclusive)", () => {
  const input = baseInput(3);
  const dec = decision("dec_1", "propio", { definicionId: "propio-2", nombre: "Cuota club", mensualidad: 40, plazo: 2, mes: "2026-01" }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });
  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), -40);
  assert.equal(round(withDecision.series[1].totalLiquidity - baseline.series[1].totalLiquidity), -80);
  assert.equal(round(withDecision.series[2].totalLiquidity - baseline.series[2].totalLiquidity), -80);
});

test("E-1b · un tipo propio con importe y mensualidad combina el golpe inicial con el recurrente", () => {
  const input = baseInput(2);
  const dec = decision("dec_1", "propio", { definicionId: "propio-3", nombre: "Mudanza a plazos", importe: 300, mensualidad: 50, plazo: 2, mes: "2026-01" }, "2026-01");
  const withDecision = Engine.resolveEscenario([dec], { baseInput: input });
  const baseline = Engine.resolveEscenario([], { baseInput: input });
  assert.equal(round(withDecision.series[0].totalLiquidity - baseline.series[0].totalLiquidity), -350);
});

// --- app.js: funciones puras de presentación (E-1b, E-6b, E-7, E-8, E-9, E-12) -------------------

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

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

function baseHelpers(extra = {}) {
  return {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    escenarioMotorTrim: (v) => String(v || ""),
    ...extra,
  };
}

// E-7 · veredicto en prosa con la palanca

test("E-7 · sin decisiones no hay veredicto", () => {
  const context = sandboxWith(["escenarioMotorVerdictText"], baseHelpers());
  assert.equal(context.escenarioMotorVerdictText([], [], []), "");
});

test("E-7 · reserva rota nombra la decisión que la rompe como la palanca", () => {
  const context = sandboxWith(["escenarioMotorVerdictText", "escenarioMotorDecisionTitle", "escenarioMotorTrim"], baseHelpers({
    canonicalDebtContractRows: () => [],
  }));
  const checks = [{ id: "reserva", status: "fail" }, { id: "capacidad", status: "ok" }, { id: "condiciones", status: "ok" }];
  const decisions = [{ id: "dec_1", titulo: "Imprevisto de 500,00 €" }];
  const rejected = [{ id: "dec_1", resultado: "guardarril-incumplido" }];
  const text = context.escenarioMotorVerdictText(checks, decisions, rejected);
  assert.match(text, /rompe la reserva mínima/);
  assert.match(text, /Imprevisto de 500,00 €/);
});

test("E-7 · capacidad libre negativa nombra esa palanca cuando la reserva no ha fallado", () => {
  const context = sandboxWith(["escenarioMotorVerdictText"], baseHelpers());
  const checks = [{ id: "reserva", status: "ok" }, { id: "capacidad", status: "fail" }, { id: "condiciones", status: "ok" }];
  const text = context.escenarioMotorVerdictText(checks, [{ id: "dec_1" }], []);
  assert.match(text, /capacidad libre real queda en negativo/);
});

test("E-7 · sin ningún fallo, el veredicto confirma que no rompe límites", () => {
  const context = sandboxWith(["escenarioMotorVerdictText"], baseHelpers());
  const checks = [{ id: "reserva", status: "ok" }, { id: "capacidad", status: "ok" }, { id: "condiciones", status: "ok" }];
  const text = context.escenarioMotorVerdictText(checks, [{ id: "dec_1" }], []);
  assert.match(text, /no rompe ningún límite conocido/);
});

// E-8 · banda de doce meses por cuenta

test("E-8 · la banda por cuenta marca bajoMinimo cuando CaixaBank (checking) queda en negativo", () => {
  const context = sandboxWith(["escenarioMotorAccountBand", "escenarioMotorAccountBandNote"], baseHelpers({
    escenarioMotorMonthLabel: (key) => key,
  }));
  const series = [
    { checking: 500, savings: 200 },
    { checking: -50, savings: 300 },
  ];
  const monthsArg = [{ key: "2026-01", month: "ene 26" }, { key: "2026-02", month: "feb 26" }];
  const band = context.escenarioMotorAccountBand(series, monthsArg);
  assert.equal(band[0].bajoMinimo, false);
  assert.equal(band[1].bajoMinimo, true);
  assert.equal(band[1].checking, -50);
  const note = context.escenarioMotorAccountBandNote(band);
  assert.match(note, /feb 26/);
  assert.match(note, /en negativo/);
});

test("E-8 · sin ningún mes bajo mínimo la nota queda vacía", () => {
  const context = sandboxWith(["escenarioMotorAccountBand", "escenarioMotorAccountBandNote"], baseHelpers());
  const band = context.escenarioMotorAccountBand([{ checking: 100, savings: 50 }], [{ key: "2026-01", month: "ene 26" }]);
  assert.equal(context.escenarioMotorAccountBandNote(band), "");
});

test("E-8 · el html de la banda marca la columna is-bajo-minimo y pinta el segmento is-bajo", () => {
  const context = sandboxWith(["escenarioMotorAccountBandHtml"], baseHelpers());
  const html = context.escenarioMotorAccountBandHtml([
    { key: "2026-01", label: "ene 26", checking: 100, savings: 50, bajoMinimo: false },
    { key: "2026-02", label: "feb 26", checking: -20, savings: 60, bajoMinimo: true },
  ]);
  assert.match(html, /is-bajo-minimo/);
  assert.match(html, /is-bajo/);
  assert.match(html, /is-checking/);
});

// E-6b · guardar un rechazado como aviso

test("E-6b · el motivo de aviso reutiliza el texto de rechazo ya calculado, sin duplicar el prefijo", () => {
  const context = sandboxWith(["escenarioMotorAvisoReason", "escenarioMotorRejectionInfo", "escenarioMotorResultInfo"], baseHelpers());
  const rejected = [{ resultado: "guardarril-incumplido" }];
  const reason = context.escenarioMotorAvisoReason(rejected);
  assert.equal(reason, "Rechazada: rompe el saldo mínimo indicado.");
});

test("E-6b · sin rechazos, el motivo dice que no hay motivo declarado", () => {
  const context = sandboxWith(["escenarioMotorAvisoReason", "escenarioMotorRejectionInfo", "escenarioMotorResultInfo"], baseHelpers());
  assert.equal(context.escenarioMotorAvisoReason([]), "Rechazado sin motivo declarado.");
});

// E-1b · derivación de un tipo propio guardado

test("E-1b · escenarioMotorCustomTypeEntry solo incluye los campos elegidos, más mes siempre", () => {
  const constStart = app.indexOf("const ESCENARIO_MOTOR_CUSTOM_FIELD_DEFS");
  const constEnd = app.indexOf("});", constStart) + 3;
  const context = sandboxWith(["escenarioMotorCustomTypeEntry", "escenarioMotorTrim"], baseHelpers());
  vm.runInContext(app.slice(constStart, constEnd), context);
  const entry = context.escenarioMotorCustomTypeEntry({ id: "propio-1", familia: "Vida", label: "Herencia esperada", campos: ["importe"] });
  const keys = entry.campos.map((field) => field.key);
  assert.deepEqual(keys, ["importe", "mes"]);
  assert.equal(entry.id, "propio_propio-1");
  assert.equal(entry.engineTipo, "propio");
  assert.equal(entry.grupo, "Propios");
  const params = entry.params({ importe: 500, mes: "2026-01" });
  assert.equal(params.definicionId, "propio-1");
  assert.equal(params.importe, 500);
  assert.equal(params.mensualidad, undefined);
});

// E-12 · comparar dos escenarios guardados

test("E-12 · escenarioMotorCompareThreeHtml pinta las tres columnas con los nombres de A y B", () => {
  const context = sandboxWith(["escenarioMotorCompareThreeHtml", "escenarioMotorMonthLabel"], baseHelpers());
  const summary = { liquidezFinal: 1000, mesesColchon: 2, libreDeDeuda: null, ahorroAnual: 500, peorMesClave: null, peorMesValor: null, capacidadLibre: 300 };
  const html = context.escenarioMotorCompareThreeHtml(summary, summary, summary, "Escenario A", "Escenario B");
  assert.match(html, /Escenario A/);
  assert.match(html, /Escenario B/);
  assert.match(html, /Reserva protegida/);
  assert.match(html, /Capacidad libre real/);
});
