const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// P-2 del "plan de mejora corregido" (ver BACKLOG.md §9): deslizadores sobre el motor de escenarios
// ya existente. Ningún motor nuevo — `cambio_ingreso`/`cambio_gasto` ya calculaban el impacto exacto
// vía `canonical-scenario-engine.js`; esto añade un <input type="range"> enlazado al campo numérico
// que ya existía (`escenarioMotorFieldControlHtml`) y una vista previa en vivo (debounce de 120ms,
// mismo patrón que ya usaba el guardarraíl) que reutiliza tal cual `runEscenarioMotor`/
// `escenarioMotorSummaryFor` — no un cálculo nuevo, un `<div>` propio aparte de la comparativa de
// seis KPI ya verificada.

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

// Balanceada por corchetes (respetando cadenas) — igual que en tests/p1-eje-tipo-de-accion.test.cjs.
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
  throw new Error(`La constante ${name} no cierra`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- catálogo: los tres campos con deslizador ---------------------------------------------------

test("P-2 · cambio_ingreso.deltaMensual lleva rango ±1.000€ en pasos de 10", () => {
  const source = extractConst("ESCENARIO_MOTOR_TYPES");
  const ingresoBlock = source.slice(source.indexOf('id: "cambio_ingreso"'), source.indexOf('id: "cambio_gasto"'));
  assert.match(ingresoBlock, /key: "deltaMensual"[\s\S]{0,120}range: \{ min: -1000, max: 1000, step: 10 \}/);
});

test("P-2 · cambio_gasto.deltaMensual y deltaPct llevan su propio rango, cada uno en su unidad", () => {
  const source = extractConst("ESCENARIO_MOTOR_TYPES");
  const gastoBlock = source.slice(source.indexOf('id: "cambio_gasto"'));
  assert.match(gastoBlock, /key: "deltaMensual"[\s\S]{0,200}range: \{ min: -1000, max: 1000, step: 10 \}/);
  assert.match(gastoBlock, /key: "deltaPct"[\s\S]{0,150}range: \{ min: -50, max: 50, step: 1 \}/);
});

test("P-2 · ningún otro campo numérico del catálogo lleva `range` colado por error", () => {
  const source = extractConst("ESCENARIO_MOTOR_TYPES");
  const rangeCount = [...source.matchAll(/range: \{/g)].length;
  assert.equal(rangeCount, 3, "solo deltaMensual (×2) y deltaPct deben declarar range");
});

// --- escenarioMotorFieldControlHtml: el deslizador solo aparece si el campo lo declara -----------

function sandboxFieldControl() {
  return sandboxWith(["escenarioMotorFieldControlHtml", "escenarioMotorFieldElementId", "escenarioMotorRangeElementId"], {
    escapeHtml: (v) => String(v ?? ""),
    escenarioMotorMonthOptionsHtml: () => "",
    escenarioMotorDebtOptions: () => [],
  });
}

test("P-2 · un campo `number` sin `range` sigue pintando un único <input>, sin deslizador (regresión)", () => {
  const context = sandboxFieldControl();
  const result = context.escenarioMotorFieldControlHtml({ key: "deltaMensual", kind: "number" }, [], {});
  assert.equal((result.match(/<input/g) || []).length, 1);
  assert.doesNotMatch(result, /type="range"/);
});

test("P-2 · un campo `number` con `range` pinta el número y el deslizador, con el mismo data-attr", () => {
  const context = sandboxFieldControl();
  const result = context.escenarioMotorFieldControlHtml(
    { key: "deltaMensual", kind: "number", range: { min: -1000, max: 1000, step: 10 }, label: "Cambio mensual" },
    [],
    {},
  );
  assert.match(result, /<input id="escenarioMotorField_deltaMensual" data-escenario-motor-field="deltaMensual" type="number"/);
  assert.match(
    result,
    /<input id="escenarioMotorField_deltaMensual_range" data-escenario-motor-field="deltaMensual" type="range" class="escenario-motor-field-range" min="-1000" max="1000" step="10" value="0"/,
  );
});

test("P-2 · sin valor todavía, el número queda vacío pero el deslizador se posiciona en 0 (no fabrica un valor distinto)", () => {
  const context = sandboxFieldControl();
  const result = context.escenarioMotorFieldControlHtml(
    { key: "deltaPct", kind: "number", range: { min: -50, max: 50, step: 1 }, label: "Cambio (%)" },
    [],
    {},
  );
  assert.match(result, /<input id="escenarioMotorField_deltaPct" data-escenario-motor-field="deltaPct" type="number" step="0\.01" placeholder="€" value=""/);
  assert.match(result, /type="range"[^>]*value="0"/);
});

test("P-2 · con un valor ya puesto, el número y el deslizador muestran la misma cifra", () => {
  const context = sandboxFieldControl();
  const result = context.escenarioMotorFieldControlHtml(
    { key: "deltaMensual", kind: "number", range: { min: -1000, max: 1000, step: 10 }, label: "Cambio mensual" },
    [],
    { deltaMensual: 250 },
  );
  assert.match(result, /type="number"[^>]*value="250"/);
  assert.match(result, /type="range"[^>]*value="250"/);
});

test("P-2 · escenarioMotorRangeElementId genera un id propio, distinto del campo numérico", () => {
  const context = sandboxWith(["escenarioMotorRangeElementId", "escenarioMotorFieldElementId"]);
  assert.equal(context.escenarioMotorRangeElementId("deltaMensual"), "escenarioMotorField_deltaMensual_range");
  assert.notEqual(context.escenarioMotorRangeElementId("deltaMensual"), context.escenarioMotorFieldElementId("deltaMensual"));
});

// --- escenarioMotorSyncRangePairValue -------------------------------------------------------------

function fakeInput(value) {
  return { value: String(value ?? "") };
}

test("P-2 · escribir en el número mueve el deslizador a la misma cifra", () => {
  const numberEl = fakeInput("300");
  const rangeEl = fakeInput("0");
  const context = sandboxWith(["escenarioMotorSyncRangePairValue", "escenarioMotorFieldElementId", "escenarioMotorRangeElementId"], {
    qs: (id) => ({ escenarioMotorField_deltaMensual: numberEl, escenarioMotorField_deltaMensual_range: rangeEl }[id] || null),
    document: { activeElement: null },
  });
  context.escenarioMotorSyncRangePairValue({ key: "deltaMensual" }, numberEl);
  assert.equal(rangeEl.value, "300");
});

test("P-2 · borrar el número dentro del rango de un deslizador lo devuelve a 0, no lo deja en un valor fantasma", () => {
  const numberEl = fakeInput("");
  const rangeEl = fakeInput("300");
  const context = sandboxWith(["escenarioMotorSyncRangePairValue", "escenarioMotorFieldElementId", "escenarioMotorRangeElementId"], {
    qs: (id) => ({ escenarioMotorField_deltaMensual: numberEl, escenarioMotorField_deltaMensual_range: rangeEl }[id] || null),
    document: { activeElement: null },
  });
  context.escenarioMotorSyncRangePairValue({ key: "deltaMensual" }, numberEl);
  assert.equal(rangeEl.value, "0");
});

test("P-2 · arrastrar el deslizador escribe la misma cifra en el número", () => {
  const numberEl = fakeInput("0");
  const rangeEl = fakeInput("-150");
  const context = sandboxWith(["escenarioMotorSyncRangePairValue", "escenarioMotorFieldElementId", "escenarioMotorRangeElementId"], {
    qs: (id) => ({ escenarioMotorField_deltaMensual: numberEl, escenarioMotorField_deltaMensual_range: rangeEl }[id] || null),
    document: { activeElement: null },
  });
  context.escenarioMotorSyncRangePairValue({ key: "deltaMensual" }, rangeEl);
  assert.equal(numberEl.value, "-150");
});

test("P-2 · nunca pisa el control que el usuario tiene enfocado ahora mismo", () => {
  const numberEl = fakeInput("300");
  const rangeEl = fakeInput("999");
  const context = sandboxWith(["escenarioMotorSyncRangePairValue", "escenarioMotorFieldElementId", "escenarioMotorRangeElementId"], {
    qs: (id) => ({ escenarioMotorField_deltaMensual: numberEl, escenarioMotorField_deltaMensual_range: rangeEl }[id] || null),
    document: { activeElement: rangeEl },
  });
  context.escenarioMotorSyncRangePairValue({ key: "deltaMensual" }, numberEl);
  assert.equal(rangeEl.value, "999", "el deslizador enfocado no se sobrescribe con lo que llega del número");
});

// --- handleEscenarioMotorFieldChange: solo dispara el debounce para campos con `range` -----------

function sandboxFieldChange(extra = {}) {
  return sandboxWith(["handleEscenarioMotorFieldChange"], {
    escenarioMotorDraftTipo: "cambio_ingreso",
    escenarioMotorDraftValues: {},
    escenarioMotorTypeOrCustomById: (tipo) => ({
      id: tipo,
      campos: [{ key: "deltaMensual", kind: "number", range: { min: -1000, max: 1000, step: 10 } }],
    }),
    escenarioMotorReadFieldValue: (field, element) => Number(element.value),
    escenarioMotorSyncFieldVisibility: () => {},
    escenarioMotorSyncRangePairValue: () => {},
    escenarioMotorPreviewDebounceTimer: null,
    ...extra,
  });
}

test("P-2 · mover el deslizador programa la vista previa con 120ms de debounce, mismo patrón que el guardarraíl", () => {
  const calls = [];
  const context = sandboxFieldChange({
    clearTimeout: (id) => calls.push(["clearTimeout", id]),
    setTimeout: (fn, ms) => {
      calls.push(["setTimeout", ms]);
      return "timer-1";
    },
    renderEscenarioMotorLivePreview: () => {},
  });
  context.handleEscenarioMotorFieldChange({ target: { dataset: { escenarioMotorField: "deltaMensual" }, value: "400" } });
  assert.equal(context.escenarioMotorDraftValues.deltaMensual, 400);
  assert.deepEqual(calls, [["clearTimeout", null], ["setTimeout", 120]]);
  assert.equal(context.escenarioMotorPreviewDebounceTimer, "timer-1");
});

test("P-2 · un campo sin `range` no programa ninguna vista previa (sin regresión sobre el resto del formulario)", () => {
  const calls = [];
  const context = sandboxWith(["handleEscenarioMotorFieldChange"], {
    escenarioMotorDraftTipo: "cambio_ingreso",
    escenarioMotorDraftValues: {},
    escenarioMotorTypeOrCustomById: () => ({ id: "cambio_ingreso", campos: [{ key: "titular", kind: "select" }] }),
    escenarioMotorReadFieldValue: (field, element) => element.value,
    escenarioMotorSyncFieldVisibility: () => {},
    setTimeout: () => calls.push("setTimeout"),
    clearTimeout: () => calls.push("clearTimeout"),
  });
  context.handleEscenarioMotorFieldChange({ target: { dataset: { escenarioMotorField: "titular" }, value: "javi" } });
  assert.deepEqual(calls, []);
});

// --- escenarioMotorDraftPreviewDecision -----------------------------------------------------------

function sandboxDraftPreview(extra = {}) {
  return sandboxWith(["escenarioMotorDraftPreviewDecision"], {
    escenarioMotorDraftTipo: "cambio_ingreso",
    escenarioMotorDecisions: [],
    escenarioMotorTypeOrCustomById: (tipo) => extra.types?.[tipo] ?? null,
    escenarioMotorEffectiveValues: (type, values) => values,
    ...extra,
  });
}

test("P-2 · sin tipo cambio_ingreso/cambio_gasto seleccionado, no hay vista previa que construir", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftTipo: "imprevisto",
    types: { imprevisto: { id: "imprevisto", campos: [] } },
  });
  assert.equal(context.escenarioMotorDraftPreviewDecision(), null);
});

test("P-2 · sin importe todavía (campo vacío), no hay vista previa — hueco, no una cifra inventada", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftValues: {},
    types: { cambio_ingreso: { id: "cambio_ingreso", campos: [], mes: (v) => v.mesInicio, params: (v) => v } },
  });
  assert.equal(context.escenarioMotorDraftPreviewDecision(), null);
});

test("P-2 · un cambio de 0€ tampoco genera vista previa: no hay nada que comparar", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftValues: { deltaMensual: 0 },
    types: { cambio_ingreso: { id: "cambio_ingreso", campos: [], mes: (v) => v.mesInicio, params: (v) => v } },
  });
  assert.equal(context.escenarioMotorDraftPreviewDecision(), null);
});

test("P-2 · con deltaMensual puesto, cambio_ingreso construye una decisión de borrador válida", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftValues: { deltaMensual: 500, mesInicio: "2026-09" },
    types: {
      cambio_ingreso: {
        id: "cambio_ingreso",
        campos: [],
        mes: (v) => v.mesInicio,
        params: (v) => ({ deltaMensual: v.deltaMensual, mesInicio: v.mesInicio }),
      },
    },
  });
  const decision = context.escenarioMotorDraftPreviewDecision();
  assert.equal(decision.tipo, "cambio_ingreso");
  assert.equal(decision.id, "escenario-motor-preview-draft");
  assert.deepEqual({ ...decision.planificacion }, { modo: "manual", mesManual: "2026-09" });
  assert.deepEqual({ ...decision.params }, { deltaMensual: 500, mesInicio: "2026-09" });
});

test("P-2 · sin mes elegido todavía, la decisión de borrador cae a planificación óptima (no inventa una fecha)", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftValues: { deltaMensual: 500 },
    types: { cambio_ingreso: { id: "cambio_ingreso", campos: [], mes: (v) => v.mesInicio, params: (v) => v } },
  });
  const decision = context.escenarioMotorDraftPreviewDecision();
  assert.deepEqual({ ...decision.planificacion }, { modo: "optimo" });
});

test("P-2 · cambio_gasto en modo porcentaje lee deltaPct, no deltaMensual", () => {
  const context = sandboxDraftPreview({
    escenarioMotorDraftTipo: "cambio_gasto",
    escenarioMotorDraftValues: { modoCambio: "porcentaje", deltaPct: -10, deltaMensual: 999, mesInicio: "2026-09" },
    types: {
      cambio_gasto: {
        id: "cambio_gasto",
        campos: [],
        mes: (v) => v.mesInicio,
        params: (v) => ({ modoCambio: v.modoCambio, deltaPct: v.deltaPct }),
      },
    },
  });
  const decision = context.escenarioMotorDraftPreviewDecision();
  assert.deepEqual({ ...decision.params }, { modoCambio: "porcentaje", deltaPct: -10 });
});

// --- renderEscenarioMotorLivePreview --------------------------------------------------------------

function sandboxLivePreview(extra = {}) {
  const container = { hidden: true, innerHTML: "" };
  const context = sandboxWith(["renderEscenarioMotorLivePreview"], {
    qs: (id) => (id === "escenarioMotorLivePreview" ? container : null),
    escenarioMotorBaseInput: () => ({ months: [{ key: "2026-09" }] }),
    escenarioMotorDecisions: [],
    escenarioMotorGuardrailValue: null,
    money: (v) => `${v.toFixed(2)} €`,
    round2: (v) => Math.round((v + Number.EPSILON) * 100) / 100,
    ...extra,
  });
  return { context, container };
}

test("P-2 · sin decisión de borrador que previsualizar, la vista previa se oculta y se vacía", () => {
  const { context, container } = sandboxLivePreview({ escenarioMotorDraftPreviewDecision: () => null });
  container.hidden = false;
  container.innerHTML = "algo de antes";
  context.renderEscenarioMotorLivePreview();
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, "");
});

test("P-2 · si el motor no puede resolver el borrador (o el estado actual), tampoco se muestra nada fabricado", () => {
  const { context, container } = sandboxLivePreview({
    escenarioMotorDraftPreviewDecision: () => ({ id: "escenario-motor-preview-draft" }),
    runEscenarioMotor: () => ({ valid: false }),
  });
  context.renderEscenarioMotorLivePreview();
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, "");
});

test("P-2 · con un borrador válido, muestra la reserva protegida y los meses de colchón antes/después, con su delta", () => {
  const { context, container } = sandboxLivePreview({
    escenarioMotorDraftPreviewDecision: () => ({ id: "escenario-motor-preview-draft" }),
    runEscenarioMotor: (baseInput, decisions) =>
      decisions.some((d) => d.id === "escenario-motor-preview-draft") ? { valid: true, tag: "after" } : { valid: true, tag: "before" },
    escenarioMotorSummaryFor: (result) =>
      result.tag === "after" ? { liquidezFinal: 2900, mesesColchon: 2.9 } : { liquidezFinal: 3200, mesesColchon: 3.2 },
  });
  context.renderEscenarioMotorLivePreview();
  assert.equal(container.hidden, false);
  assert.match(container.innerHTML, /Vista previa en vivo/);
  assert.match(container.innerHTML, /3200\.00 €.*2900\.00 €/s);
  assert.match(container.innerHTML, /-300\.00 €/);
  assert.match(container.innerHTML, /3\.2.*2\.9/s);
  assert.match(container.innerHTML, /-0\.3/);
});

// --- se oculta al cambiar de tipo o al añadir la decisión -----------------------------------------

test("Cableado · cambiar el tipo de decisión oculta/actualiza la vista previa del tipo anterior", () => {
  const source = extractFunction("handleEscenarioMotorTypeChange");
  assert.match(source, /renderEscenarioMotorLivePreview\(\);/);
});

test("Cableado · añadir la decisión limpia la vista previa del borrador ya vacío", () => {
  const source = extractFunction("handleEscenarioMotorSubmit");
  assert.match(source, /escenarioMotorResetDraft\(type\);[\s\S]{0,220}renderEscenarioMotorLivePreview\(\);/);
});

// --- HTML ------------------------------------------------------------------------------------------

test("P-2 · el contenedor de la vista previa en vivo existe en el formulario de Escenario · simular, oculto por defecto", () => {
  assert.match(
    html,
    /<div class="escenario-motor-form-grid" id="escenarioMotorFields"><\/div>\s*<div class="e19-insight escenario-motor-live-preview" id="escenarioMotorLivePreview" hidden><\/div>/,
  );
});
