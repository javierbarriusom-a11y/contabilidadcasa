const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const notifications = require(path.join(root, "canonical-e9-notifications.js"));

// O-2/O-3 (BACKLOG_OPERACION.md): recordatorio de reales pendientes en Hoy y aviso al cerrar el mes
// con huecos conocidos. Ambos reutilizan la misma fuente — pendingActualsForMonthKey, que a su vez
// reutiliza registrarActualsEntries de «Registrar el mes» — para no mantener dos cálculos distintos
// de lo mismo, tal y como quedó documentado en el backlog.

// Balancea primero los paréntesis de la firma antes de buscar la llave de apertura del cuerpo:
// homeDecisionCandidates({ actionCenter, ... }) tiene su propia llave de desestructuración en los
// parámetros, así que buscar la primera "{" a secas la confundiría con el cuerpo de la función.
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- canonical-e9-notifications.js: categoría reales-pendientes -------------------------------

test("O-2 · reales-pendientes es una categoría segura, sin importes ni nombres de partida en el push", () => {
  const payload = notifications.safePayload({ id: "alert-1", category: "reales-pendientes", target: "update-data", amount: 1234, label: "Nómina" });
  assert.equal(payload.category, "reales-pendientes");
  assert.equal(payload.body, "Tienes partidas del mes sin registrar.");
  assert.equal(payload.containsSensitiveAmounts, false);
  assert.doesNotMatch(JSON.stringify(payload), /1234|Nómina/);
});

test("O-2 · una categoría desconocida sigue cayendo a general (reales-pendientes no la desplaza por accidente)", () => {
  const payload = notifications.safePayload({ id: "alert-1", category: "inventada" });
  assert.equal(payload.category, "general");
});

test("O-2 · update-data sigue siendo un target válido para la categoría nueva (Registrar › Reales del mes)", () => {
  const payload = notifications.safePayload({ category: "reales-pendientes", target: "update-data" });
  assert.equal(payload.target, "update-data");
});

// --- pendingActualsForMonthKey: fuente única compartida por O-2 y O-3 --------------------------

function sandboxPendingActuals(monthsWithEntries) {
  const context = sandboxWith(["pendingActualsForMonthKey"], {
    baseData: { monthlyPlanning: { months: monthsWithEntries.map(({ key }) => ({ key })) } },
    registrarActualsEntries: (month) => monthsWithEntries.find((item) => item.key === month.key)?.entries || [],
  });
  return context;
}

test("O-2/O-3 · pendingActualsForMonthKey cuenta solo las entradas sin real", () => {
  const context = sandboxPendingActuals([
    { key: "2026-08", entries: [{ label: "Nómina", hasActual: true }, { label: "Ocio", hasActual: false }, { label: "Transporte", hasActual: false }] },
  ]);
  const result = context.pendingActualsForMonthKey("2026-08");
  assert.equal(result.count, 2);
  assert.deepEqual(result.labels, ["Ocio", "Transporte"]);
});

test("O-2/O-3 · un mes sin partidas pendientes devuelve count 0", () => {
  const context = sandboxPendingActuals([{ key: "2026-08", entries: [{ label: "Nómina", hasActual: true }] }]);
  assert.equal(context.pendingActualsForMonthKey("2026-08").count, 0);
});

test("O-2/O-3 · un mes que no existe en baseData no revienta, devuelve count 0", () => {
  const context = sandboxPendingActuals([{ key: "2026-08", entries: [] }]);
  assert.equal(context.pendingActualsForMonthKey("2099-01").count, 0);
});

// --- O-2: homePendingActualsReminder, la candidata en Hoy ---------------------------------------

function sandboxHomeReminder({ monthKey, pending }) {
  return sandboxWith(["homePendingActualsReminder"], {
    registrarActualsDefaultMonthKey: () => monthKey,
    pendingActualsForMonthKey: () => pending,
  });
}

test("O-2 · sin mes seleccionable (sin datos), no hay candidata", () => {
  const context = sandboxHomeReminder({ monthKey: "", pending: { count: 0, labels: [] } });
  assert.equal(context.homePendingActualsReminder(), null);
});

test("O-2 · con el mes al día, no hay candidata (no se fabrica un aviso sin motivo)", () => {
  const context = sandboxHomeReminder({ monthKey: "2026-08", pending: { count: 0, labels: [] } });
  assert.equal(context.homePendingActualsReminder(), null);
});

test("O-2 · con partidas pendientes, la candidata apunta a Registrar (update-data) con el recuento en el título", () => {
  const context = sandboxHomeReminder({ monthKey: "2026-08", pending: { count: 2, labels: ["Ocio", "Transporte"] } });
  const candidate = context.homePendingActualsReminder();
  assert.equal(candidate.title, "2 partidas sin real este mes");
  assert.equal(candidate.target, "update-data");
  assert.equal(candidate.cta, "Registrar");
  assert.match(candidate.text, /Ocio, Transporte/);
});

test("O-2 · con una sola partida pendiente, el título va en singular", () => {
  const context = sandboxHomeReminder({ monthKey: "2026-08", pending: { count: 1, labels: ["Ocio"] } });
  assert.equal(context.homePendingActualsReminder().title, "1 partida sin real este mes");
});

test("O-2 · con más de tres partidas, la lista se recorta con puntos suspensivos", () => {
  const context = sandboxHomeReminder({ monthKey: "2026-08", pending: { count: 4, labels: ["A", "B", "C", "D"] } });
  assert.match(context.homePendingActualsReminder().text, /A, B, C…/);
});

test("O-2 · homeDecisionCandidates deja entrar la candidata de reales pendientes entre las sin fecha", () => {
  const context = sandboxWith(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => null,
    homePendingActualsReminder: () => ({ title: "2 partidas sin real este mes", text: "Todavía sin registrar: Ocio, Transporte.", status: "warn", target: "update-data", cta: "Registrar", expiresAt: "" }),
    homeOpenOfferInsight: () => null,
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [],
    evaluatedUxAlerts: () => [],
    escenarioMotorMonthLabel: (v) => v,
    shortDate: (v) => v,
    debtTargetDisplayName: () => "",
    money: () => "",
  });
  const decisions = context.homeDecisionCandidates({ actionCenter: {}, offer: null, debtPriorities: [], loadedDecisions: [], debtRatioStatus: "good" });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].title, "2 partidas sin real este mes");
  assert.equal(decisions[0].target, "update-data");
});

// --- O-3: monthCloseConfirmMessage, el aviso al cerrar el mes -----------------------------------

test("O-3 · sin partidas pendientes, el mensaje de cierre es exactamente el de siempre", () => {
  const context = sandboxWith(["monthCloseConfirmMessage"]);
  const message = context.monthCloseConfirmMessage("2026-08", { count: 0, labels: [] });
  assert.equal(message, "Se congelarán los datos reales de 2026-08 y se conservará una copia recuperable.");
});

test("O-3 · sin argumento de pending (compatibilidad), no revienta y no menciona nada pendiente", () => {
  const context = sandboxWith(["monthCloseConfirmMessage"]);
  const message = context.monthCloseConfirmMessage("2026-08", undefined);
  assert.equal(message, "Se congelarán los datos reales de 2026-08 y se conservará una copia recuperable.");
});

test("O-3 · con partidas pendientes, el mensaje avisa pero no impide seguir leyendo el motivo del cierre", () => {
  const context = sandboxWith(["monthCloseConfirmMessage"]);
  const message = context.monthCloseConfirmMessage("2026-08", { count: 2, labels: ["Ocio", "Transporte"] });
  assert.equal(message, "Se congelarán los datos reales de 2026-08 y se conservará una copia recuperable. Quedan 2 partidas sin real: Ocio, Transporte.");
});

test("O-3 · con una sola partida pendiente, el aviso va en singular", () => {
  const context = sandboxWith(["monthCloseConfirmMessage"]);
  const message = context.monthCloseConfirmMessage("2026-08", { count: 1, labels: ["Ocio"] });
  assert.equal(message, "Se congelarán los datos reales de 2026-08 y se conservará una copia recuperable. Queda 1 partida sin real: Ocio.");
});

test("O-3 · con más de cinco partidas pendientes, la lista se recorta con puntos suspensivos", () => {
  const context = sandboxWith(["monthCloseConfirmMessage"]);
  const message = context.monthCloseConfirmMessage("2026-08", { count: 7, labels: ["A", "B", "C", "D", "E", "F", "G"] });
  assert.match(message, /A, B, C, D, E…\.$/);
});

test("O-3 · closeCurrentMonthTransaction pasa por monthCloseConfirmMessage con pendingActualsForMonthKey del mes que cierra", () => {
  const source = extractFunction("closeCurrentMonthTransaction");
  assert.match(source, /message: monthCloseConfirmMessage\(month, pendingActualsForMonthKey\(month\)\)/);
});
