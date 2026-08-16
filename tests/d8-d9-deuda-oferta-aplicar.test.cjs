const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const E14DebtOperations = require(path.join(root, "canonical-e14-operations.js"));

// D-8/D-9 (auditoría del 15 de agosto, Prioridad 2) · la tarjeta «Oferta en curso» de Deuda › Ruta
// deja de enrutar a la heredada #debt-roadmap para aplicar: aplica in situ, detrás de un checklist
// de cuatro requisitos (D-9) y una barra de confirmación con motivo obligatorio + fecha de revisión
// opcional que genera un recordatorio en Hoy (D-8). Mismo truco de extracción por llaves que el
// resto de la suite: app.js es un script de navegador, no un módulo.

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
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

// --- requestOperationConfirmation · campo de fecha de revisión opcional (D-8) ---------------------

function fakeConfirmDialog() {
  const listeners = {};
  return {
    dialog: {
      returnValue: "cancel",
      addEventListener(type, cb) {
        listeners[type] = cb;
      },
      showModal() {},
      close(value) {
        this.returnValue = value;
        listeners.close?.();
      },
    },
  };
}

test("D-8 · sin allowReviewDate (las cinco llamadas ya existentes), el campo de fecha queda oculto y reviewDate siempre vacío", async () => {
  const { dialog } = fakeConfirmDialog();
  const reasonInput = { value: "", focus() {}, select() {} };
  const reviewDateField = { hidden: false };
  const reviewDateHint = { hidden: false };
  const reviewDateInput = { value: "2026-09-01" };
  const context = sandboxWith(["requestOperationConfirmation"], {
    qs: (id) =>
      ({
        operationConfirmDialog: dialog,
        operationConfirmReason: reasonInput,
        operationConfirmReviewDateField: reviewDateField,
        operationConfirmReviewDateHint: reviewDateHint,
        operationConfirmReviewDate: reviewDateInput,
        operationConfirmTitle: { textContent: "" },
        operationConfirmMessage: { textContent: "" },
        operationConfirmSubmit: { textContent: "" },
      })[id],
  });
  const promise = context.requestOperationConfirmation({ title: "t", message: "m" });
  assert.equal(reviewDateField.hidden, true);
  assert.equal(reviewDateHint.hidden, true);
  assert.equal(reviewDateInput.value, "");
  reasonInput.value = "Motivo cualquiera";
  reviewDateInput.value = "2026-09-01"; // el usuario no debería poder rellenarlo, pero aunque lo hiciera...
  dialog.close("confirm");
  const result = await promise;
  assert.equal(result.reason, "Motivo cualquiera");
  assert.equal(result.reviewDate, "", "reviewDate se ignora cuando allowReviewDate no se pidió");
});

test("D-8 · con allowReviewDate, el campo se muestra y la fecha rellenada se resuelve junto al motivo", async () => {
  const { dialog } = fakeConfirmDialog();
  const reasonInput = { value: "", focus() {}, select() {} };
  const reviewDateField = { hidden: false };
  const reviewDateHint = { hidden: false };
  const reviewDateInput = { value: "" };
  const context = sandboxWith(["requestOperationConfirmation"], {
    qs: (id) =>
      ({
        operationConfirmDialog: dialog,
        operationConfirmReason: reasonInput,
        operationConfirmReviewDateField: reviewDateField,
        operationConfirmReviewDateHint: reviewDateHint,
        operationConfirmReviewDate: reviewDateInput,
        operationConfirmTitle: { textContent: "" },
        operationConfirmMessage: { textContent: "" },
        operationConfirmSubmit: { textContent: "" },
      })[id],
  });
  const promise = context.requestOperationConfirmation({ title: "t", message: "m", allowReviewDate: true });
  assert.equal(reviewDateField.hidden, false);
  assert.equal(reviewDateHint.hidden, false);
  reasonInput.value = "Oferta aceptada";
  reviewDateInput.value = "2026-09-15";
  dialog.close("confirm");
  const result = await promise;
  assert.equal(result.reason, "Oferta aceptada");
  assert.equal(result.reviewDate, "2026-09-15");
});

test("D-8 · cancelar el diálogo resuelve motivo y fecha vacíos aunque allowReviewDate esté activo", async () => {
  const { dialog } = fakeConfirmDialog();
  const reasonInput = { value: "", focus() {}, select() {} };
  const reviewDateInput = { value: "2026-09-15" };
  const context = sandboxWith(["requestOperationConfirmation"], {
    qs: (id) =>
      ({
        operationConfirmDialog: dialog,
        operationConfirmReason: reasonInput,
        operationConfirmReviewDateField: { hidden: false },
        operationConfirmReviewDateHint: { hidden: false },
        operationConfirmReviewDate: reviewDateInput,
        operationConfirmTitle: { textContent: "" },
        operationConfirmMessage: { textContent: "" },
        operationConfirmSubmit: { textContent: "" },
      })[id],
  });
  const promise = context.requestOperationConfirmation({ title: "t", message: "m", allowReviewDate: true });
  reasonInput.value = "no debería contar";
  dialog.close("cancel");
  const result = await promise;
  assert.equal(result.reason, "");
  assert.equal(result.reviewDate, "");
});

test("D-8 · index.html trae el campo de fecha de revisión, oculto por defecto, en el mismo diálogo compartido", () => {
  assert.match(html, /<label id="operationConfirmReviewDateField" hidden>/);
  assert.match(html, /<input id="operationConfirmReviewDate" type="date" \/>/);
  assert.match(html, /Si la rellenas, aparecerá como recordatorio en Hoy/);
});

test("D-8 · applyE14bOffer pide allowReviewDate y guarda reviewDate en e14Application", () => {
  const fn = extractFunction("applyE14bOffer");
  assert.match(fn, /const \{ reason, reviewDate \} = await requestOperationConfirmation\(\{/);
  assert.match(fn, /allowReviewDate: true,/);
  assert.match(fn, /reviewDate,\s*\n\s*\};/);
});

test("D-8 · las otras cinco llamadas a requestOperationConfirmation siguen destructurando solo el motivo", () => {
  const occurrences = [...app.matchAll(/const \{ reason(?::\s*\w+)? \} = await requestOperationConfirmation\(\{/g)];
  assert.equal(occurrences.length, 5, "deben quedar 5 llamadas que no piden reviewDate (la sexta, la de la oferta, sí lo pide)");
});

// --- deudaRutaOfferChecklist (D-9) — misma validación que E14DebtOperations.prepareApplication ---

test("D-9 · deudaRutaOfferChecklist marca los cuatro requisitos correctos cuando todo está en orden", () => {
  const context = sandboxWith(["deudaRutaOfferChecklist"], { E14DebtOperations });
  const offer = { status: "accepted", documents: ["offer", "identity-or-authority", "payment-terms"] };
  const simulation = { minimumLiquidity: 500 };
  const checks = context.deudaRutaOfferChecklist(offer, simulation, 300);
  assert.equal(checks.length, 4);
  assert.equal(checks[0].ok, true);
  assert.equal(checks[1].ok, true);
  assert.match(checks[1].label, /Documentos: 3 de 3/);
  assert.equal(checks[2].ok, true);
  assert.equal(checks[3].ok, null, "el motivo no bloquea aquí: lo pide el diálogo de confirmación");
});

test("D-9 · una oferta no aceptada, con documentos incompletos y reserva rota, marca los tres primeros en rojo", () => {
  const context = sandboxWith(["deudaRutaOfferChecklist"], { E14DebtOperations });
  const offer = { status: "received", documents: ["offer"] };
  const simulation = { minimumLiquidity: 100 };
  const checks = context.deudaRutaOfferChecklist(offer, simulation, 300);
  assert.equal(checks[0].ok, false);
  assert.equal(checks[1].ok, false);
  assert.match(checks[1].label, /Documentos: 1 de 3/);
  assert.equal(checks[2].ok, false);
  assert.match(checks[2].label, /bajo el mínimo/);
});

test("D-9 · sin simulación todavía (forecast no disponible), la reserva queda neutra, no en rojo", () => {
  const context = sandboxWith(["deudaRutaOfferChecklist"], { E14DebtOperations });
  const checks = context.deudaRutaOfferChecklist({ status: "accepted", documents: [] }, null, 300);
  assert.equal(checks[2].ok, null);
  assert.match(checks[2].label, /sin poder calcular/);
});

// --- renderDeudaRutaOffer (D-9) — aplica in situ, ya no enruta a #debt-roadmap --------------------

function sandboxOfferCard(offer, extra = {}) {
  const elements = {};
  const document = {
    querySelectorAll: () => [],
  };
  const target = { innerHTML: "" };
  const applyButtonListeners = [];
  const editLinkListeners = [];
  const applyButton = {
    addEventListener: (type, cb) => applyButtonListeners.push([type, cb]),
  };
  const editLink = {
    addEventListener: (type, cb) => editLinkListeners.push([type, cb]),
  };
  const e14bStatusEl = { textContent: extra.e14bStatusText ?? "" };
  const qs = (id) => {
    if (id === "deudaRutaOffer") return target;
    if (id === "deudaRutaOfferApply") return applyButton;
    if (id === "deudaRutaOfferEdit") return editLink;
    if (id === "e14bStatus") return e14bStatusEl;
    return elements[id] || null;
  };
  const context = sandboxWith(["renderDeudaRutaOffer", "deudaRutaOfferChecklist"], {
    qs,
    document,
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `€${v}`,
    asesorDecisionOpenOffers: () => (offer ? [offer] : []),
    debtTargetById: () => null,
    asesorDecisionFundingHtml: () => "",
    escenarioMotorMonthLabel: (v) => v,
    e14bForecast: () => (extra.forecast ?? { series: [] }),
    e14bStrategyForOffer: () => ({}),
    agentCaixaFloor: () => extra.reserve ?? 300,
    E14DebtOperations: extra.E14DebtOperations === undefined ? E14DebtOperations : extra.E14DebtOperations,
    e14bWorkspace: extra.e14bWorkspace || (() => ({ selectedOfferId: "" })),
    applyE14bOffer: extra.applyE14bOffer || (async () => {}),
    queueRemoteSave: extra.queueRemoteSave || (() => {}),
    debtLiquidations: extra.debtLiquidations || [],
    deudaRutaOfferStatusMessage: extra.deudaRutaOfferStatusMessage || "",
  });
  context.renderDeudaRutaOffer();
  return { target, applyButton, applyButtonListeners, editLink, editLinkListeners, context };
}

test("D-9 · sin ofertas abiertas, la tarjeta lo dice y no pinta ningún checklist", () => {
  const { target } = sandboxOfferCard(null);
  assert.match(target.innerHTML, /Sin ofertas de deuda abiertas ahora mismo/);
});

test("D-9 · con una oferta lista, pinta el checklist con sus cuatro requisitos y el botón queda habilitado", () => {
  const offer = { status: "accepted", documents: ["offer", "identity-or-authority", "payment-terms"], amount: 1000, discount: 50, counterpart: "Banco" };
  const { target } = sandboxOfferCard(offer, {
    forecast: { series: [{ monthKey: "2026-08" }] },
    reserve: 0,
  });
  assert.match(target.innerHTML, /Requisitos para aplicar/);
  assert.match(target.innerHTML, /id="deudaRutaOfferChecklist"/);
  assert.doesNotMatch(target.innerHTML, /disabled/);
  assert.doesNotMatch(target.innerHTML, /href="#debt-roadmap">Revisar y aplicar en Plan de deuda/, "ya no enruta a la heredada para aplicar");
  assert.match(target.innerHTML, /Ver documentos y editar oferta/);
});

test("D-9 · con la reserva rota, el botón de aplicar sale deshabilitado (bloqueo explícito, D-9)", () => {
  const offer = { status: "accepted", documents: [], amount: 1000, discount: 0, counterpart: "Banco" };
  const { target } = sandboxOfferCard(offer, { forecast: { series: [] } });
  assert.match(target.innerHTML, /id="deudaRutaOfferApply" disabled>Aplicar al plan/);
});

test("D-9 · si la deuda ya tiene una decisión aplicada, bloquea aunque los cuatro requisitos estén en verde (caso real encontrado con Playwright)", () => {
  const offer = { contractId: "debt-1", status: "accepted", documents: ["offer", "identity-or-authority", "payment-terms"], amount: 1000, discount: 0, counterpart: "Banco" };
  const { target } = sandboxOfferCard(offer, {
    forecast: { series: [{ monthKey: "2026-08" }] },
    reserve: 0,
    debtLiquidations: [{ targetId: "debt-1" }],
  });
  assert.match(target.innerHTML, /id="deudaRutaOfferApply" disabled>Aplicar al plan/);
  assert.match(target.innerHTML, /Esta deuda ya tiene una decisión aplicada/);
});

test("D-9 · tras un intento de aplicar, el mensaje de #e14bStatus se copia a la tarjeta de Ruta (invisible si no, porque #e14bStatus solo vive en #debt-roadmap)", () => {
  const offer = { id: "offer-1", contractId: "debt-1", status: "accepted", documents: [], amount: 1000, discount: 0, counterpart: "Banco" };
  const { target } = sandboxOfferCard(offer, {
    forecast: { series: [] },
    deudaRutaOfferStatusMessage: "Esta deuda ya tiene una decisión aplicada; revísala o deshazla antes de duplicarla.",
  });
  assert.match(target.innerHTML, /id="deudaRutaOfferStatus"/);
  assert.match(target.innerHTML, /revísala o deshazla antes de duplicarla/);
});

test("D-9 · clicar «Aplicar al plan» selecciona la oferta en el workspace de E14b y llama a applyE14bOffer, la misma puerta de escritura", async () => {
  const offer = { id: "offer-1", status: "accepted", documents: ["offer", "identity-or-authority", "payment-terms"], amount: 1000, discount: 0, counterpart: "Banco" };
  const workspace = { selectedOfferId: "" };
  const applyCalls = [];
  const { applyButtonListeners, context } = sandboxOfferCard(offer, {
    forecast: { series: [{ monthKey: "2026-08" }] },
    e14bWorkspace: () => workspace,
    applyE14bOffer: async () => applyCalls.push("applyE14bOffer"),
    e14bStatusText: "Estrategia aplicada tras confirmación. Se creó una decisión recuperable y se conserva la oferta original.",
  });
  const clickHandler = applyButtonListeners.find(([type]) => type === "click")?.[1];
  assert.ok(clickHandler, "el botón de aplicar tiene un manejador de clic");
  await clickHandler();
  assert.equal(workspace.selectedOfferId, "offer-1");
  assert.deepEqual(applyCalls, ["applyE14bOffer"]);
  assert.equal(
    context.deudaRutaOfferStatusMessage,
    "Estrategia aplicada tras confirmación. Se creó una decisión recuperable y se conserva la oferta original.",
    "el resultado de #e14bStatus se recuerda para la próxima pintada de la tarjeta",
  );
});

// --- homeDebtReviewReminders / homeDecisionCandidates (D-8) — recordatorio en Hoy -----------------

test("D-8 · homeDebtReviewReminders lee reviewDate de las decisiones aplicadas y marca vencida en rojo", () => {
  const context = sandboxWith(["homeDebtReviewReminders"], {
    isoLocalDate: () => "2026-08-16",
    formatIsoDate: (v) => v,
    shortDate: (v) => v,
    debtLiquidations: [
      { name: "Reunificar tarjeta", e14Application: { reviewDate: "2026-09-01" } },
      { name: "Refinanciar coche", e14Application: { reviewDate: "2026-08-01" } },
      { name: "Sin revisión", e14Application: {} },
      { name: "Sin e14Application" },
    ],
  });
  const reminders = context.homeDebtReviewReminders();
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].status, "warn");
  assert.equal(reminders[0].target, "debt-roadmap");
  assert.equal(reminders[1].status, "danger", "una fecha ya pasada se marca vencida");
});

test("D-8 · homeDecisionCandidates incluye los recordatorios de revisión entre las candidatas con fecha", () => {
  const context = sandboxWith(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => null,
    homeOpenOfferInsight: () => null,
    homeDebtReviewReminders: () => [{ title: "Revisar oferta de deuda aplicada", expiresAt: "2026-08-20", expiryLabel: "20 ago", status: "warn", target: "debt-roadmap", cta: "Revisar" }],
    homeEscenarioReviewReminders: () => [],
    evaluatedUxAlerts: () => [],
    escenarioMotorMonthLabel: (v) => v,
    shortDate: (v) => v,
    debtTargetDisplayName: () => "",
    money: () => "",
  });
  const decisions = context.homeDecisionCandidates({ actionCenter: {}, offer: null, debtPriorities: [], loadedDecisions: [], debtRatioStatus: "good" });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].title, "Revisar oferta de deuda aplicada");
});
