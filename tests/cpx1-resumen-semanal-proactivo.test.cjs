const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/estado-semana.js");
const app = appSrc + "\n" + viewSrc;

// CPX1 (Oleada 2 Bloque 3): resumen semanal proactivo. "Estado de la semana" (TRACK-3) ya fundía
// tres lecturas pasivas (E16/ritmo de presupuesto/E15) sin ninguna prioridad. CPX1 añade la próxima
// mejor acción de CP1 (misma selección que p2-ui.js: catálogo E9 + validador de citas CP3) como
// cabecera, para que el hogar sepa por dónde empezar en vez de leer tres paneles planos.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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
  throw new Error(`${name} no cierra sus llaves`);
}

function prioritySandbox({ assistantApi, citationApi }) {
  const context = {
    window: { FinanceCanonicalE9Assistant: assistantApi, FinanceCanonicalRecommendationCitation: citationApi },
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    CPX1_SEVERITY_RANK: { critical: 0, high: 1, medium: 2 },
    CPX1_ALERT_LABELS: { cash: "Revisar la caja prevista", variation: "Revisar la variación prevista", debt: "Revisar el ratio de deuda" },
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("cpx1WeeklyPriorityAction"), extractFunction("cpx1WeeklyPriorityHtml")].join("\n"),
    context,
    { filename: "views/estado-semana.js#cpx1" },
  );
  return context;
}

test("cpx1WeeklyPriorityAction · sin motores disponibles o sin alertas, no hay acción — nunca inventada", () => {
  const context = prioritySandbox({ assistantApi: null, citationApi: null });
  assert.equal(context.cpx1WeeklyPriorityAction([]), null);
  assert.equal(context.cpx1WeeklyPriorityAction([{ id: "a1", type: "cash", severity: "high", message: "x" }]), null);
});

test("cpx1WeeklyPriorityAction · elige la alerta más urgente entre las citables, con su evidencia y confianza", () => {
  const context = prioritySandbox({
    assistantApi: { sourceCatalog: (input) => input.alerts.map((a) => ({ id: a.id })) },
    citationApi: { validateRecommendations: (candidates) => ({ results: candidates.map(() => ({ valid: true })) }) },
  });
  const alerts = [
    { id: "a1", type: "debt", severity: "medium", message: "Ratio de deuda alto", evidence: ["e1"], confidence: "media" },
    { id: "a2", type: "cash", severity: "critical", message: "Caja negativa en marzo", evidence: ["e2"], confidence: "alta" },
  ];
  const action = context.cpx1WeeklyPriorityAction(alerts);
  assert.equal(action.message, "Caja negativa en marzo");
  assert.equal(action.label, "Revisar la caja prevista");
  assert.deepEqual(action.evidence, ["e2"]);
  assert.equal(action.confidence, "alta");
});

test("cpx1WeeklyPriorityAction · si la más urgente no pasa la validación de citas (CP3), cae a la siguiente citable", () => {
  const context = prioritySandbox({
    assistantApi: { sourceCatalog: (input) => input.alerts.map((a) => ({ id: a.id })) },
    citationApi: { validateRecommendations: (candidates) => ({ results: candidates.map((c) => ({ valid: c.citations[0] !== "alert:a2" })) }) },
  });
  const alerts = [
    { id: "a1", type: "debt", severity: "medium", message: "Ratio de deuda alto" },
    { id: "a2", type: "cash", severity: "critical", message: "Caja negativa en marzo" },
  ];
  const action = context.cpx1WeeklyPriorityAction(alerts);
  assert.equal(action.message, "Ratio de deuda alto", "la crítica sin cita válida se descarta, no se inventa su evidencia");
});

test("cpx1WeeklyPriorityHtml · sin E16 disponible, lo dice explícitamente", () => {
  const context = prioritySandbox({ assistantApi: null, citationApi: null });
  assert.match(context.cpx1WeeklyPriorityHtml(null), /no está disponible todavía/);
});

test("cpx1WeeklyPriorityHtml · sin ninguna acción citable, lo dice sin fallar", () => {
  const context = prioritySandbox({ assistantApi: null, citationApi: null });
  assert.match(context.cpx1WeeklyPriorityHtml([]), /Sin ninguna alerta que priorizar/);
});

test("cpx1WeeklyPriorityHtml · con acción disponible, incluye mensaje, evidencia en <details> y nunca decide por el hogar", () => {
  const context = prioritySandbox({
    assistantApi: { sourceCatalog: (input) => input.alerts.map((a) => ({ id: a.id })) },
    citationApi: { validateRecommendations: (candidates) => ({ results: candidates.map(() => ({ valid: true })) }) },
  });
  const html = context.cpx1WeeklyPriorityHtml([{ id: "a1", type: "cash", severity: "critical", message: "Caja negativa en marzo", evidence: ["saldo proyectado"], confidence: "alta" }]);
  assert.match(html, /Caja negativa en marzo/);
  assert.match(html, /<details class="p2-details">/);
  assert.match(html, /saldo proyectado/);
  assert.doesNotMatch(html, /debes|deberías|hazlo/i);
});

test("app.js: renderEstadoSemana pinta la prioridad semanal antes de las tres lecturas pasivas", () => {
  const block = extractFunction("renderEstadoSemana");
  const order = ["estadoSemanaPriorityHtml", "estadoSemanaCashAlertsHtml", "estadoSemanaBudgetRhythmHtml", "estadoSemanaGoalDeadlinesHtml"].map((name) => block.indexOf(name));
  assert.ok(order.every((index) => index >= 0), "las cuatro tarjetas deben estar presentes");
  assert.ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], "la prioridad va primero, luego el orden original de TRACK-3");
});
