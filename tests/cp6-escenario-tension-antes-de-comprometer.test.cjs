const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// CP6 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, ampliación "copiloto proactivo" — sin documento de
// detalle propio, resumen en su Nota): "pasa cada decisión grande por el escenario de tensión una
// vez" antes de comprometer dinero — en la pantalla «Decidir · aplicar escenario», antes de
// confirmar. No bloquea la confirmación: solo la informa (regla transversal 04, ninguna
// automatización silenciosa).

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe ${name} en app.js`);
  const end = app.indexOf("\nfunction ", start + 1);
  assert.ok(end > start);
  return app.slice(start, end);
}

function extractFunction(name, source) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra sus llaves`);
}

test("escenarioMotorTensionInput reutiliza el factor de tensión de E13 (ingresos ×0,9, gastos ×1,1), no un umbral nuevo", () => {
  const body = functionBody("escenarioMotorTensionInput");
  assert.match(body, /CP6_TENSION_INCOME_FACTOR/);
  assert.match(body, /CP6_TENSION_EXPENSE_FACTOR/);
  assert.match(app, /CP6_TENSION_INCOME_FACTOR = 0\.9/);
  assert.match(app, /CP6_TENSION_EXPENSE_FACTOR = 1\.1/);
});

test("escenarioMotorTensionInput escala los campos que el motor de escenario realmente lee, no policy.incomeFactor", () => {
  const context = { round2: (value) => Math.round(value * 100) / 100, CP6_TENSION_INCOME_FACTOR: 0.9, CP6_TENSION_EXPENSE_FACTOR: 1.1 };
  vm.createContext(context);
  vm.runInContext(extractFunction("escenarioMotorTensionInput", app), context);
  const input = { policy: { incomeFactor: 1 }, months: [{ monthKey: "2026-09", income: 1000, coreSpend: 500, variableOperationalSpend: 200, endOfMonthOutflows: 50 }] };
  const tension = context.escenarioMotorTensionInput(input);
  assert.equal(tension.months[0].income, 900);
  assert.equal(tension.months[0].coreSpend, 550);
  assert.equal(tension.months[0].variableOperationalSpend, 220);
  assert.equal(tension.months[0].endOfMonthOutflows, 55);
  // No debe mutar el input original (el mismo baseInput se usa después para el resultado normal).
  assert.equal(input.months[0].income, 1000);
});

test("renderEscenarioAplicar calcula el escenario de tensión con las mismas decisiones y guardarraíl, sin bloquear la confirmación", () => {
  const body = functionBody("renderEscenarioAplicar");
  assert.match(body, /runEscenarioMotor\(escenarioMotorTensionInput\(baseInput\), escenarioMotorDecisions, escenarioMotorGuardrailValue\)/);
  assert.doesNotMatch(body, /confirmButton\.disabled = .*tensionR/, "la tensión no debe bloquear el botón de confirmar, solo informar");
});

test("existe la tarjeta de tensión en la pantalla de aplicar, antes del formulario de confirmación", () => {
  const cardIndex = html.indexOf('id="escenarioAplicarTensionCard"');
  const formIndex = html.indexOf('id="escenarioAplicarForm"');
  assert.ok(cardIndex > 0, "falta la tarjeta de tensión");
  assert.ok(formIndex > cardIndex, "la tarjeta de tensión debe ir antes del formulario de confirmación");
  assert.match(html, /id="escenarioAplicarTensionNote"/);
});
