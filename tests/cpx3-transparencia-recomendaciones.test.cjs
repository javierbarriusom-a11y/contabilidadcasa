const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// CPX3 (Oleada 2, Bloque 2): transparencia de recomendaciones ignoradas. CP1 (p2-ui.js) es efímera —
// se recalcula en cada render sin guardar nunca cuánto lleva mostrándose la misma recomendación.
// Este registro (scenarioSettings.cpx3RecommendationLog) no cambia qué recomienda CP1: solo hace
// visible cuánto lleva abierta, para que ignorarla sea una decisión consciente. Investigación previa
// confirmó que no existía nada de esto en el repo (ni recommendationLog, ni dismissRecommendation).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
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
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = { scenarioSettings: {}, saveScenarioSettings: () => { context.saved = true; } };
  vm.createContext(context);
  ["cpx3RecommendationLog", "cpx3SignatureFor", "cpx3TrackRecommendation", "cpx3DismissRecommendation"].forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const ACTION_A = { label: "Revisar la caja prevista", severity: "critical", citations: ["alert:cash-2026-10"] };
const ACTION_B = { label: "Revisar el ratio de deuda", severity: "high", citations: ["alert:debt-2026-11"] };

test("cpx3TrackRecommendation · sin acción, no crea ninguna entrada", () => {
  const ctx = sandbox();
  assert.equal(ctx.cpx3TrackRecommendation(null), null);
  assert.equal(ctx.cpx3RecommendationLog().length, 0);
});

test("cpx3TrackRecommendation · una recomendación nueva abre una entrada con firstShownAt == lastShownAt", () => {
  const ctx = sandbox();
  const entry = ctx.cpx3TrackRecommendation(ACTION_A);
  assert.equal(entry.signature, "alert:cash-2026-10");
  assert.equal(entry.label, "Revisar la caja prevista");
  assert.equal(entry.firstShownAt, entry.lastShownAt);
  assert.equal(entry.dismissedAt, null);
  assert.equal(ctx.saved, true);
});

test("cpx3TrackRecommendation · la misma recomendación seguida actualiza lastShownAt, no crea una segunda entrada", async () => {
  const ctx = sandbox();
  const first = ctx.cpx3TrackRecommendation(ACTION_A);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = ctx.cpx3TrackRecommendation(ACTION_A);
  assert.equal(ctx.cpx3RecommendationLog().length, 1);
  assert.equal(second.firstShownAt, first.firstShownAt); // se conserva desde cuándo lleva abierta
  assert.ok(new Date(second.lastShownAt).getTime() >= new Date(first.lastShownAt).getTime());
});

test("cpx3TrackRecommendation · una recomendación distinta abre una segunda entrada, sin tocar la primera", () => {
  const ctx = sandbox();
  ctx.cpx3TrackRecommendation(ACTION_A);
  ctx.cpx3TrackRecommendation(ACTION_B);
  const log = ctx.cpx3RecommendationLog();
  assert.equal(log.length, 2);
  assert.equal(log[0].signature, "alert:cash-2026-10");
  assert.equal(log[1].signature, "alert:debt-2026-11");
});

test("cpx3DismissRecommendation · marca dismissedAt y deja de coincidir con nuevos seguimientos", () => {
  const ctx = sandbox();
  ctx.cpx3TrackRecommendation(ACTION_A);
  const dismissed = ctx.cpx3DismissRecommendation("alert:cash-2026-10");
  assert.ok(dismissed.dismissedAt);
  // Si la misma alerta vuelve a aparecer después de descartada, abre una entrada nueva (no reutiliza
  // la descartada) — así queda constancia de que se ignoró explícitamente una vez.
  const again = ctx.cpx3TrackRecommendation(ACTION_A);
  assert.equal(ctx.cpx3RecommendationLog().length, 2);
  assert.equal(again.dismissedAt, null);
});

test("cpx3DismissRecommendation · sin ninguna entrada activa con esa firma, no hace nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.cpx3DismissRecommendation("alert:no-existe"), null);
  assert.equal(ctx.scenarioSettings.cpx3RecommendationLog, undefined);
});

test("cpx3SignatureFor · usa las citas como firma estable, no la etiqueta (que puede cambiar de redacción)", () => {
  const ctx = sandbox();
  assert.equal(ctx.cpx3SignatureFor(ACTION_A), "alert:cash-2026-10");
  assert.equal(ctx.cpx3SignatureFor({ label: "Sin citas", citations: [] }), "Sin citas");
  assert.equal(ctx.cpx3SignatureFor(null), "");
});

test("window.FinanceP2Bridge expone trackRecommendation y dismissRecommendation para p2-ui.js", () => {
  assert.match(app, /trackRecommendation: cpx3TrackRecommendation,/);
  assert.match(app, /dismissRecommendation: cpx3DismissRecommendation,/);
});
