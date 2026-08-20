const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Bloque 3 del plan de cierre (docs/BACKLOG_NUEVE_PANTALLAS.md §7): la cadena que cierra Plan ·
// Ahorro y objetivos. P-13 ("Objetivos con destino y prioridad") declara una lista de objetivos de
// ahorro gobernada por el usuario (destino + importe opcional, orden = prioridad), mismo patrón que
// `scenarioSettings.alerts`. P-16 ("Sobres · suma con los objetivos de ahorro") conecta esa lista
// con la liquidación de sobres de P-15: un sobre positivo sin cobertura puede sumar de verdad a un
// objetivo en vez de arrastrar en silencio, y el acumulado de cada objetivo se suma de los asientos
// reales que quedan firmados en `envelopeSettlements` — nunca una previsión fabricada.

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
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    ...extra,
  };
}

// --- P-13 · savingsGoalsList / savingsGoalsContributions -----------------------------------------

test("P-13 · savingsGoalsList devuelve [] sin scenarioSettings.savingsGoals, y la lista tal cual si existe", () => {
  const empty = sandboxWith(["savingsGoalsList"], baseHelpers({ scenarioSettings: {} }));
  assert.equal(empty.savingsGoalsList().length, 0);
  const goals = [{ id: "g1", label: "Coche", targetAmount: 5000 }];
  const withGoals = sandboxWith(["savingsGoalsList"], baseHelpers({ scenarioSettings: { savingsGoals: goals } }));
  assert.deepEqual(withGoals.savingsGoalsList(), goals);
});

test("P-16 · savingsGoalsContributions suma solo los asientos con destino objetivo:, del cierre vigente de cada mes", () => {
  const context = sandboxWith(
    ["savingsGoalsContributions"],
    baseHelpers({
      monthClosures: [
        {
          status: "closed",
          monthKey: "2026-06",
          closedAt: "2026-07-01T00:00:00.000Z",
          envelopeSettlements: [
            { rowKey: "ocio", destino: "objetivo:g1", saldo: 40 },
            { rowKey: "ropa", destino: "arrastra", saldo: 10 },
          ],
        },
        // Julio se cerró, se reabrió (no cuenta) y se volvió a cerrar con una elección distinta —
        // solo el cierre vigente (el más reciente) debe sumar.
        {
          status: "closed",
          monthKey: "2026-07",
          closedAt: "2026-08-01T00:00:00.000Z",
          envelopeSettlements: [{ rowKey: "ocio", destino: "objetivo:g1", saldo: 15 }],
        },
        { status: "reopened", monthKey: "2026-07", occurredAt: "2026-08-05T00:00:00.000Z" },
        {
          status: "closed",
          monthKey: "2026-07",
          occurredAt: "2026-08-06T00:00:00.000Z",
          envelopeSettlements: [{ rowKey: "ocio", destino: "objetivo:g2", saldo: 25 }],
        },
      ],
    }),
  );
  const totals = context.savingsGoalsContributions();
  assert.equal(totals.g1, 40); // solo junio; el cierre de julio vigente ya no apunta a g1
  assert.equal(totals.g2, 25);
});

test("P-16 · savingsGoalsContributions es {} sin ningún cierre con sobres", () => {
  const context = sandboxWith(["savingsGoalsContributions"], baseHelpers({ monthClosures: [] }));
  assert.equal(Object.keys(context.savingsGoalsContributions()).length, 0);
});

// --- P-13 · savingsGoalRowHtml / savingsGoalsHtml -------------------------------------------------

test("P-13 · savingsGoalRowHtml marca «Completado» cuando el acumulado alcanza el importe objetivo", () => {
  const context = sandboxWith(["savingsGoalRowHtml"], baseHelpers());
  const done = context.savingsGoalRowHtml({ id: "g1", label: "Coche" }, 0, 2, 500);
  assert.doesNotMatch(done, /Completado/); // sin importe objetivo, nunca "completado"
  const target = context.savingsGoalRowHtml({ id: "g2", label: "Fondo", targetAmount: 500 }, 1, 2, 500);
  assert.match(target, /Completado/);
  const partial = context.savingsGoalRowHtml({ id: "g3", label: "Viaje", targetAmount: 1000 }, 0, 1, 400);
  assert.doesNotMatch(partial, /Completado/);
});

test("P-13 · savingsGoalRowHtml deshabilita subir en el primero y bajar en el último", () => {
  const context = sandboxWith(["savingsGoalRowHtml"], baseHelpers());
  const first = context.savingsGoalRowHtml({ id: "g1", label: "Coche" }, 0, 3, 0);
  assert.match(first, /data-savings-goal-action="up"[^>]*disabled/);
  assert.doesNotMatch(first, /data-savings-goal-action="down"[^>]*disabled/);
  const last = context.savingsGoalRowHtml({ id: "g1", label: "Coche" }, 2, 3, 0);
  assert.match(last, /data-savings-goal-action="down"[^>]*disabled/);
});

test("P-13 · savingsGoalsHtml dice explícitamente que no hay objetivos, sin fabricar una fila vacía", () => {
  const context = sandboxWith(["savingsGoalsHtml", "savingsGoalRowHtml"], baseHelpers());
  const out = context.savingsGoalsHtml([], {});
  assert.match(out, /Todavía no hay ningún objetivo declarado/);
  assert.match(out, /data-savings-goal-add/);
});

// --- P-13 · CRUD (add/editar/borrar/reordenar) ----------------------------------------------------

test("P-13 · addSavingsGoal añade un objetivo nuevo al final y persiste", () => {
  let saved = null;
  const context = sandboxWith(
    ["addSavingsGoal", "savingsGoalsList", "savingsGoalId"],
    baseHelpers({
      scenarioSettings: { savingsGoals: [{ id: "g1", label: "Coche" }] },
      saveScenarioSettings: () => { saved = true; },
      renderPlanAhorro: () => {},
    }),
  );
  context.addSavingsGoal();
  assert.equal(context.scenarioSettings.savingsGoals.length, 2);
  assert.equal(context.scenarioSettings.savingsGoals[1].label, "Nuevo objetivo");
  assert.equal(saved, true);
});

test("P-13 · handleSavingsGoalAction sube/baja prioridad intercambiando el orden", () => {
  const context = sandboxWith(
    ["handleSavingsGoalAction", "savingsGoalsList"],
    baseHelpers({
      scenarioSettings: { savingsGoals: [{ id: "g1", label: "A" }, { id: "g2", label: "B" }] },
      saveScenarioSettings: () => {},
      renderPlanAhorro: () => {},
    }),
  );
  const row = { dataset: { savingsGoalId: "g2" } };
  const button = { dataset: { savingsGoalAction: "up" } };
  const event = { target: { closest: (sel) => (sel === "[data-savings-goal-action]" ? button : row) } };
  context.handleSavingsGoalAction(event);
  assert.deepEqual(context.scenarioSettings.savingsGoals.map((g) => g.id), ["g2", "g1"]);
});

test("P-13 · handleSavingsGoalAction borra el objetivo tras confirmar", () => {
  const context = sandboxWith(
    ["handleSavingsGoalAction", "savingsGoalsList"],
    baseHelpers({
      scenarioSettings: { savingsGoals: [{ id: "g1", label: "A" }, { id: "g2", label: "B" }] },
      saveScenarioSettings: () => {},
      renderPlanAhorro: () => {},
      window: { confirm: () => true },
    }),
  );
  const row = { dataset: { savingsGoalId: "g1" } };
  const button = { dataset: { savingsGoalAction: "delete" } };
  const event = { target: { closest: (sel) => (sel === "[data-savings-goal-action]" ? button : row) } };
  context.handleSavingsGoalAction(event);
  assert.deepEqual(context.scenarioSettings.savingsGoals.map((g) => g.id), ["g2"]);
});

test("P-13 · handleSavingsGoalFieldChange edita destino e importe objetivo", () => {
  const context = sandboxWith(
    ["handleSavingsGoalFieldChange", "savingsGoalsList"],
    baseHelpers({
      scenarioSettings: { savingsGoals: [{ id: "g1", label: "Coche", targetAmount: 0 }] },
      saveScenarioSettings: () => {},
      renderPlanAhorro: () => {},
    }),
  );
  const row = { dataset: { savingsGoalId: "g1" } };
  const labelInput = { dataset: { savingsGoalField: "label" }, value: "Coche nuevo", closest: () => row };
  context.handleSavingsGoalFieldChange(labelInput);
  assert.equal(context.scenarioSettings.savingsGoals[0].label, "Coche nuevo");
  const amountInput = { dataset: { savingsGoalField: "targetAmount" }, value: "3000", closest: () => row };
  context.handleSavingsGoalFieldChange(amountInput);
  assert.equal(context.scenarioSettings.savingsGoals[0].targetAmount, 3000);
});

// --- P-16 · cierreSobresResolved gana un tercer destino para sobres positivos --------------------

test("P-16 · un sobre positivo sin cobertura puede elegir un objetivo en vez de arrastrar", () => {
  const context = sandboxWith(
    ["cierreSobresResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "objetivo:g1" } }),
  );
  const rows = [{ rowKey: "ocio", label: "Ocio", saldo: 40, rule: "arrastra" }];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved[0].destino, "objetivo:g1");
  assert.equal(resolved[0].resolved, true);
});

test("P-16 · la cobertura entre sobres gana siempre sobre una elección de objetivo", () => {
  const context = sandboxWith(
    ["cierreSobresResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "sobre:ropa", ropa: "objetivo:g1" } }),
  );
  const rows = [
    { rowKey: "ocio", label: "Ocio", saldo: -30, rule: "arrastra" },
    { rowKey: "ropa", label: "Ropa", saldo: 50, rule: "arrastra" },
  ];
  const resolved = context.cierreSobresResolved(rows);
  const ropa = resolved.find((row) => row.rowKey === "ropa");
  assert.equal(ropa.destino, "sobre:ocio");
});

test("P-16 · sobresSettlementsForSign no arrastra nada de un sobre enviado a un objetivo", () => {
  const context = sandboxWith(
    ["sobresSettlementsForSign", "sobresMonthBalances", "sobresVariableRows", "sobresCarryoverBefore", "sobresPreviousMonthKey", "sobresRuleForRow", "cierreSobresResolved", "sobresEnabled"],
    baseHelpers({
      state: { envelopes: { enabled: true } },
      monthClosures: [],
      cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
      cierreSobresChoices: { ocio: "objetivo:g1" },
      seriesKeyForRow: (row) => row.key,
      planMesCollect: () => ({
        expense: [{ row: { key: "ocio" }, sectionName: "Gastos variables", label: "Ocio", planned: 100, usado: 60 }],
      }),
    }),
  );
  const settlements = context.sobresSettlementsForSign({ key: "2026-07", label: "Julio" });
  const ocio = settlements.find((row) => row.rowKey === "ocio");
  assert.equal(ocio.saldo, 40);
  assert.equal(ocio.destino, "objetivo:g1");
  assert.equal(ocio.carryOut, 0);
});

test("P-16 · cierreSobresDestinoLabel nombra el objetivo elegido", () => {
  const context = sandboxWith(
    ["cierreSobresDestinoLabel", "savingsGoalsList"],
    baseHelpers({ scenarioSettings: { savingsGoals: [{ id: "g1", label: "Fondo de emergencia" }] } }),
  );
  const row = { saldo: 40, destino: "objetivo:g1" };
  assert.equal(context.cierreSobresDestinoLabel(row, [row]), "Objetivo: «Fondo de emergencia»");
});

// --- P-16 · sobresGoalDestinoOptions oculta objetivos ya completados ------------------------------

test("P-16 · sobresGoalDestinoOptions ofrece los objetivos incompletos y oculta los ya completados", () => {
  const context = sandboxWith(
    ["sobresGoalDestinoOptions", "savingsGoalsList", "savingsGoalsContributions"],
    baseHelpers({
      scenarioSettings: {
        savingsGoals: [
          { id: "g1", label: "Coche", targetAmount: 500 },
          { id: "g2", label: "Viaje", targetAmount: 0 },
        ],
      },
      monthClosures: [
        { status: "closed", monthKey: "2026-05", closedAt: "2026-06-01T00:00:00.000Z", envelopeSettlements: [{ rowKey: "x", destino: "objetivo:g1", saldo: 500 }] },
      ],
    }),
  );
  const options = context.sobresGoalDestinoOptions("arrastra");
  assert.doesNotMatch(options, /Coche/);
  assert.match(options, /Viaje/);
  assert.match(options, /Arrastra al mes siguiente/);
});

test("P-16 · cierreSobresDestinoSelectHtml genera un select con el destino actual marcado", () => {
  const context = sandboxWith(
    ["cierreSobresDestinoSelectHtml", "sobresGoalDestinoOptions", "savingsGoalsList", "savingsGoalsContributions"],
    baseHelpers({
      scenarioSettings: { savingsGoals: [{ id: "g1", label: "Coche", targetAmount: 0 }] },
      monthClosures: [],
      cierreSobresChoices: { ocio: "objetivo:g1" },
    }),
  );
  const out = context.cierreSobresDestinoSelectHtml({ rowKey: "ocio", label: "Ocio" });
  assert.match(out, /data-sobres-destino="ocio"/);
  assert.match(out, /value="objetivo:g1" selected/);
});
