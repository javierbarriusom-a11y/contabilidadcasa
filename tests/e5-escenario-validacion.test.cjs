const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// E-5 (Escenarios.pdf, auditoría del 16 de agosto): "Cuatro comprobaciones: origen de fondos,
// reserva protegida, umbral de capacidad y condiciones registradas. Cada una con su estado."
// El motor ya validaba cada decisión contra el contrato (Schema.validateDecision, motivo visible
// si la rechaza — E-6), pero solo por decisión, no como un panel agregado de la simulación. Estas
// pruebas cubren `escenarioMotorValidationChecks`, que reutiliza señales que E-3/E-6/Registrar ya
// calculan (capacidadLibre, el resultado de cada decisión, el modo de saldo) en vez de inventar
// una comprobación paralela.

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

function baseContext(extra = {}) {
  return sandboxWith(["escenarioMotorValidationChecks", "escenarioMotorValidationChecklistHtml"], {
    state: { balanceMode: "manual", balanceDate: "2026-08-10" },
    formatIsoDate: (v) => v,
    defaultBalanceDate: () => "2026-08-16",
    money: (v) => `${v}€`,
    escapeHtml: (v) => v,
    ...extra,
  });
}

function checkById(checks, id) {
  return checks.find((check) => check.id === id);
}

// --- escenarioMotorValidationChecks -------------------------------------------------------------

test("E-5 · origen de fondos: ok con saldo manual, warn con saldo automático", () => {
  const manual = baseContext();
  const manualChecks = manual.escenarioMotorValidationChecks({ resultados: [] }, {}, null);
  assert.equal(checkById(manualChecks, "origen").status, "ok");

  const auto = baseContext({ state: { balanceMode: "auto" } });
  const autoChecks = auto.escenarioMotorValidationChecks({ resultados: [] }, {}, null);
  assert.equal(checkById(autoChecks, "origen").status, "warn");
});

test("E-5 · reserva protegida: pending sin guardarraíl indicado", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [{ resultado: "aplicada" }] }, {}, null);
  assert.equal(checkById(checks, "reserva").status, "pending");
});

test("E-5 · reserva protegida: fail si alguna decisión rompe el guardarraíl", () => {
  const context = baseContext();
  const result = { resultados: [{ resultado: "guardarril-incumplido" }] };
  const checks = context.escenarioMotorValidationChecks(result, {}, 500);
  assert.equal(checkById(checks, "reserva").status, "fail");
});

test("E-5 · reserva protegida: ok si hay guardarraíl y ninguna decisión lo rompe", () => {
  const context = baseContext();
  const result = { resultados: [{ resultado: "aplicada" }] };
  const checks = context.escenarioMotorValidationChecks(result, {}, 500);
  assert.equal(checkById(checks, "reserva").status, "ok");
});

test("E-5 · umbral de capacidad: pending sin capacidadLibre calculada", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [] }, { capacidadLibre: null }, null);
  assert.equal(checkById(checks, "capacidad").status, "pending");
});

test("E-5 · umbral de capacidad: fail si la capacidad libre es negativa", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [] }, { capacidadLibre: -120 }, null);
  assert.equal(checkById(checks, "capacidad").status, "fail");
});

test("E-5 · umbral de capacidad: ok si la capacidad libre es cero o positiva", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [] }, { capacidadLibre: 0 }, null);
  assert.equal(checkById(checks, "capacidad").status, "ok");
});

test("E-5 · condiciones registradas: pending sin ninguna decisión todavía", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [] }, {}, null);
  assert.equal(checkById(checks, "condiciones").status, "pending");
});

test("E-5 · condiciones registradas: fail si una decisión se rechaza por un motivo que no es el guardarraíl", () => {
  const context = baseContext();
  const result = { resultados: [{ resultado: "sin-mes-viable" }, { resultado: "aplicada" }] };
  const checks = context.escenarioMotorValidationChecks(result, {}, null);
  assert.equal(checkById(checks, "condiciones").status, "fail");
});

test("E-5 · condiciones registradas: el rechazo por guardarraíl no cuenta como condición incumplida", () => {
  const context = baseContext();
  const result = { resultados: [{ resultado: "guardarril-incumplido" }] };
  const checks = context.escenarioMotorValidationChecks(result, {}, 500);
  assert.equal(checkById(checks, "condiciones").status, "ok");
  assert.equal(checkById(checks, "reserva").status, "fail");
});

test("E-5 · condiciones registradas: ignora las decisiones desactivadas", () => {
  const context = baseContext();
  const result = { resultados: [{ resultado: "aplicada" }, { resultado: "inactiva" }] };
  const checks = context.escenarioMotorValidationChecks(result, {}, null);
  assert.equal(checkById(checks, "condiciones").status, "ok");
});

test("E-5 · las cuatro comprobaciones están siempre presentes, en el mismo orden", () => {
  const context = baseContext();
  const checks = context.escenarioMotorValidationChecks({ resultados: [] }, {}, null);
  assert.equal(checks.length, 4);
  assert.equal(checks[0].id, "origen");
  assert.equal(checks[1].id, "reserva");
  assert.equal(checks[2].id, "capacidad");
  assert.equal(checks[3].id, "condiciones");
});

// --- escenarioMotorValidationChecklistHtml ------------------------------------------------------

test("E-5 · escenarioMotorValidationChecklistHtml traduce cada estado a su clase", () => {
  const context = baseContext();
  const html = context.escenarioMotorValidationChecklistHtml([
    { id: "a", label: "A", status: "ok", detail: "va bien" },
    { id: "b", label: "B", status: "fail", detail: "va mal" },
    { id: "c", label: "C", status: "warn", detail: "atención" },
    { id: "d", label: "D", status: "pending", detail: "sin dato" },
  ]);
  assert.match(html, /class="deuda-ruta-check is-ok"[^<]*<strong>A<\/strong><span>va bien<\/span>/);
  assert.match(html, /class="deuda-ruta-check is-danger"[^<]*<strong>B<\/strong><span>va mal<\/span>/);
  assert.match(html, /class="deuda-ruta-check is-warn"[^<]*<strong>C<\/strong><span>atención<\/span>/);
  assert.match(html, /class="deuda-ruta-check is-neutral"[^<]*<strong>D<\/strong><span>sin dato<\/span>/);
});
