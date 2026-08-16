const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// E-11 (Escenarios.pdf, auditoría del 16 de agosto): "Misma barra que Deuda: motivo obligatorio,
// revisión opcional que genera recordatorio en Hoy." El motivo obligatorio ya funcionaba
// (handleEscenarioAplicarConfirm no dejaba confirmar sin él); faltaba la fecha de revisión opcional
// y su recordatorio en Hoy — homeEscenarioReviewReminders() replica homeDebtReviewReminders() (D-8),
// que ya hace justo esto para las ofertas de deuda aplicadas, pero leyendo escenario-motor-saved en
// vez de debtLiquidations.

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

function fakeQs(values) {
  return (id) => (Object.prototype.hasOwnProperty.call(values, id) ? values[id] : null);
}

// --- homeEscenarioReviewReminders ---------------------------------------------------------------

test("E-11 · homeEscenarioReviewReminders ignora los escenarios sin fecha de revisión", () => {
  const context = sandboxWith(["homeEscenarioReviewReminders"], {
    loadEscenarioMotorSaved: () => [{ nombre: "Base", estado: "aplicado", reviewDate: "" }],
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
  });
  assert.deepEqual(context.homeEscenarioReviewReminders(), []);
});

test("E-11 · homeEscenarioReviewReminders ignora los escenarios guardados que no están aplicados", () => {
  const context = sandboxWith(["homeEscenarioReviewReminders"], {
    loadEscenarioMotorSaved: () => [{ nombre: "Coche", estado: "guardado", reviewDate: "2026-09-01" }],
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
  });
  assert.deepEqual(context.homeEscenarioReviewReminders(), []);
});

test("E-11 · homeEscenarioReviewReminders marca en rojo (danger) una revisión ya vencida", () => {
  const context = sandboxWith(["homeEscenarioReviewReminders"], {
    loadEscenarioMotorSaved: () => [{ nombre: "Amortizar Entidad C", estado: "aplicado", reviewDate: "2026-08-01" }],
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
  });
  const [reminder] = context.homeEscenarioReviewReminders();
  assert.equal(reminder.status, "danger");
  assert.equal(reminder.target, "escenario-guardados");
  assert.equal(reminder.expiresAt, "2026-08-01");
  assert.match(reminder.text, /Amortizar Entidad C/);
});

test("E-11 · homeEscenarioReviewReminders marca en ámbar (warn) una revisión todavía futura", () => {
  const context = sandboxWith(["homeEscenarioReviewReminders"], {
    loadEscenarioMotorSaved: () => [{ nombre: "Amortizar Entidad C", estado: "aplicado", reviewDate: "2026-09-01" }],
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
  });
  const [reminder] = context.homeEscenarioReviewReminders();
  assert.equal(reminder.status, "warn");
});

// --- homeDecisionCandidates integra el recordatorio -----------------------------------------------

test("E-11 · homeDecisionCandidates incluye el recordatorio de escenario entre las candidatas con fecha", () => {
  const context = sandboxWith(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => null,
    homeOpenOfferInsight: () => null,
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [
      { title: "Revisar escenario aplicado", expiresAt: "2026-08-20", expiryLabel: "20 ago", status: "warn", target: "escenario-guardados", cta: "Revisar" },
    ],
    evaluatedUxAlerts: () => [],
    escenarioMotorMonthLabel: (v) => v,
    shortDate: (v) => v,
    debtTargetDisplayName: () => "",
    money: () => "",
  });
  const decisions = context.homeDecisionCandidates({ actionCenter: {}, offer: null, debtPriorities: [], loadedDecisions: [], debtRatioStatus: "good" });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].title, "Revisar escenario aplicado");
  assert.equal(decisions[0].target, "escenario-guardados");
});

// --- handleEscenarioAplicarConfirm guarda la fecha opcional -----------------------------------

function aplicarConfirmContext(fields) {
  const domValues = {
    escenarioAplicarMotivo: { value: fields.motivo ?? "", focus() { this.focused = true; } },
    escenarioAplicarReviewDate: { value: fields.reviewDate ?? "" },
  };
  const saved = [];
  return {
    context: sandboxWith(["handleEscenarioAplicarConfirm"], {
      qs: fakeQs(domValues),
      loadEscenarioMotorSaved: () => fields.existingSaved || [],
      saveEscenarioMotorSavedList: (list) => saved.push(...list),
      escenarioMotorDecisions: fields.decisions || [{ id: "dec_1" }],
      escenarioMotorGuardrailValue: null,
      escenarioMotorSavedSeq: 0,
      escenarioMotorDraftName: () => "Amortizar Entidad C",
      escenarioMotorNavigate: () => {},
    }),
    domValues,
    saved,
  };
}

test("E-11 · confirmar sin motivo no guarda nada y devuelve el foco al campo", () => {
  const { context, domValues, saved } = aplicarConfirmContext({ motivo: "  " });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 0);
  assert.equal(domValues.escenarioAplicarMotivo.focused, true);
});

test("E-11 · confirmar con motivo pero sin fecha de revisión guarda reviewDate vacío (sin recordatorio)", () => {
  const { context, saved } = aplicarConfirmContext({ motivo: "Acuerdo firmado el 6/8", reviewDate: "" });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].motivo, "Acuerdo firmado el 6/8");
  assert.equal(saved[0].reviewDate, "");
  assert.equal(saved[0].estado, "aplicado");
});

test("E-11 · confirmar con fecha de revisión la guarda en el escenario aplicado", () => {
  const { context, saved } = aplicarConfirmContext({ motivo: "Acuerdo firmado el 6/8", reviewDate: "2026-09-15" });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].reviewDate, "2026-09-15");
});

test("E-11 · el escenario aplicado anteriormente pasa a «guardado» al aplicar uno nuevo (solo uno aplicado a la vez)", () => {
  const existing = [{ id: "old", estado: "aplicado", reviewDate: "2026-08-10" }];
  const { context, saved } = aplicarConfirmContext({ motivo: "Nuevo acuerdo", existingSaved: existing });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 2);
  const old = saved.find((entry) => entry.id === "old");
  assert.equal(old.estado, "guardado");
});
