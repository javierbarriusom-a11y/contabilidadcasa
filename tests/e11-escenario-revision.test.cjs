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

test("E-11b · homeEscenarioReviewReminders también lee «vigente», el nuevo estado que confirma Cierre", () => {
  const context = sandboxWith(["homeEscenarioReviewReminders"], {
    loadEscenarioMotorSaved: () => [{ nombre: "Amortizar Entidad C", estado: "vigente", reviewDate: "2026-09-01" }],
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
  });
  const [reminder] = context.homeEscenarioReviewReminders();
  assert.ok(reminder, "un plan vigente con fecha de revisión debe generar recordatorio");
  assert.equal(reminder.status, "warn");
});

// --- homeDecisionCandidates integra el recordatorio -----------------------------------------------

test("E-11 · homeDecisionCandidates incluye el recordatorio de escenario entre las candidatas con fecha", () => {
  const context = sandboxWith(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => null,
    homePendingActualsReminder: () => null,
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
  let dialogShown = false;
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
      // E-11b: el límite de diez planes vivos se comprueba antes de crear — por defecto no
      // alcanzado, salvo que el propio test lo pida explícitamente.
      escenarioMotorLimitReached: () => Boolean(fields.limitReached),
      showEscenarioMotorLimitDialog: () => {
        dialogShown = true;
      },
    }),
    domValues,
    saved,
    dialogShown: () => dialogShown,
  };
}

test("E-11 · confirmar sin motivo no guarda nada y devuelve el foco al campo", () => {
  const { context, domValues, saved } = aplicarConfirmContext({ motivo: "  " });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 0);
  assert.equal(domValues.escenarioAplicarMotivo.focused, true);
});

test("E-11b · confirmar con motivo pero sin fecha de revisión guarda reviewDate vacío, como plan propuesto", () => {
  const { context, saved } = aplicarConfirmContext({ motivo: "Acuerdo firmado el 6/8", reviewDate: "" });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].motivo, "Acuerdo firmado el 6/8");
  assert.equal(saved[0].reviewDate, "");
  assert.equal(saved[0].estado, "propuesto");
});

test("E-11 · confirmar con fecha de revisión la guarda en el plan propuesto", () => {
  const { context, saved } = aplicarConfirmContext({ motivo: "Acuerdo firmado el 6/8", reviewDate: "2026-09-15" });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].reviewDate, "2026-09-15");
});

test("E-11b · aplicar no sobrescribe: los planes propuestos o vigentes anteriores se quedan exactamente igual", () => {
  const existing = [
    { id: "old-propuesto", estado: "propuesto", reviewDate: "2026-08-10" },
    { id: "old-vigente", estado: "vigente", reviewDate: "" },
  ];
  const { context, saved } = aplicarConfirmContext({ motivo: "Nuevo acuerdo", existingSaved: existing });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 3, "se añade uno nuevo, sin tocar los dos anteriores");
  const oldPropuesto = saved.find((entry) => entry.id === "old-propuesto");
  const oldVigente = saved.find((entry) => entry.id === "old-vigente");
  assert.equal(oldPropuesto.estado, "propuesto", "el propuesto anterior sigue propuesto");
  assert.equal(oldVigente.estado, "vigente", "el vigente anterior sigue vigente: aplicar no lo degrada");
  const nuevo = saved.find((entry) => entry.motivo === "Nuevo acuerdo");
  assert.equal(nuevo.estado, "propuesto");
});

test("E-11b · con diez planes vivos, Aplicar bloquea la creación del undécimo y avisa con un modal", () => {
  const existing = Array.from({ length: 10 }, (_, index) => ({ id: `plan-${index}`, estado: "guardado" }));
  const { context, saved, dialogShown } = aplicarConfirmContext({ motivo: "Undécimo plan", existingSaved: existing, limitReached: true });
  context.handleEscenarioAplicarConfirm({ preventDefault() {} });
  assert.equal(saved.length, 0, "no se crea ningún plan nuevo");
  assert.equal(dialogShown(), true, "se muestra el modal que explica el límite");
});

test("E-11b · un plan archivado no cuenta para el límite de diez", () => {
  const context = sandboxWith(["escenarioMotorLiveSavedCount"], {
    loadEscenarioMotorSaved: () => [{ id: "a", archived: true }, { id: "b" }, { id: "c", archived: false }],
  });
  assert.equal(context.escenarioMotorLiveSavedCount(), 2);
});
