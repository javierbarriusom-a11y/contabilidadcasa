// SVD-4 (17/11/2026): «Guardar esta estrategia como escenario». La estrategia del simulador pasa a Escenarios › Guardados con los
// tipos de decisión de siempre, válidos para su esquema y su motor. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Adapter = require("../canonical-e14-debt-adapter.js");
const Schema = require("../canonical-scenario-schema.js");
const Engine = require("../canonical-scenario-engine.js");

const contracts = [
  { id: "debt-custom-1", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "debt-custom-2", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const canonical = Adapter.buildReadModel({ contracts });
const key1 = Adapter.dynamicAccountKey("debt-custom-1");
const key2 = Adapter.dynamicAccountKey("debt-custom-2");

function build(accounts, baseMonthKey = "2026-11") {
  return Adapter.scenarioDecisionsFromRoadmap({ canonical, baseMonthKey, accounts });
}

function withIds(decisions) {
  return decisions.map((decision, orden) => ({ ...decision, id: `dec_01ARZ3NDEKTSV4RRFFQ69G5FA${orden}`, orden }));
}

test("SVD-4 · quita → acuerdo_quita en su mes, con vigencia hasta el último día de ese mes", () => {
  const { decisions, skipped } = build([{ accountKey: key1, account: { strategy: "settlement", lump: 1500, start: 4 } }]);
  assert.deepEqual(skipped, []);
  assert.deepEqual(decisions, [{
    tipo: "acuerdo_quita", titulo: "Quita · Banco FICTICIO", activa: true, planificacion: { modo: "manual", mesManual: "2027-02" },
    params: { deudaId: "debt-custom-1", importePactado: 1500, modalidad: "pago-unico", vigenciaHasta: "2027-02-28" },
  }]);
});

test("SVD-4 · híbrido → amortización parcial por el pago único y refinanciación de lo financiado; «Esperar» no guarda nada", () => {
  const { decisions } = build([
    { accountKey: key1, account: { strategy: "hybrid", lump: 500, financed: 1900, monthly: 110.5, term: 18, apr: 6, start: 2 } },
    { accountKey: key2, account: { strategy: "hold" } },
  ]);
  assert.deepEqual(decisions.map((decision) => decision.tipo), ["amortizacion", "refinanciacion"]);
  assert.deepEqual(decisions[0].params, { deudaId: "debt-custom-1", importe: 500, parcial: true });
  assert.deepEqual(decisions[1].params, { deudaId: "debt-custom-1", nuevoPrincipal: 1900, nuevoTIN: 0.06, nuevaCuota: 110.5, nuevoPlazo: 18 });
  assert.equal(decisions[1].titulo, "Quita + refinanciación · Banco FICTICIO");
});

test("SVD-4 · lo que no se puede guardar se deja fuera con el motivo, nunca se inventa", () => {
  const { decisions, skipped } = build([
    { accountKey: "acct_otro", account: { strategy: "settlement", lump: 100 } },
    { accountKey: key1, account: { strategy: "settlement", lump: 0 } },
    { accountKey: key2, account: { strategy: "refi", financed: 0, monthly: 0, term: 12 } },
  ]);
  assert.deepEqual(decisions, []);
  assert.deepEqual(skipped.map((item) => item.reason), ["sin-contrato", "sin-importe", "sin-refinanciacion"]);
  assert.deepEqual(build([{ accountKey: key1, account: { strategy: "settlement", lump: 1 } }], "").skipped, [{ accountKey: "", reason: "sin-mes-base" }]);
});

test("SVD-4 · las decisiones pasan el esquema de Escenarios y su motor las aplica sobre los contratos", () => {
  const { decisions } = build([
    { accountKey: key1, account: { strategy: "hybrid", lump: 500, financed: 1900, monthly: 110.5, term: 18, apr: 6, start: 2 } },
    { accountKey: key2, account: { strategy: "settlement", lump: 3000, start: 3 } },
  ]);
  const issues = [];
  withIds(decisions).forEach((decision) => Schema.validateDecision(decision, "$", issues));
  assert.deepEqual(issues.filter((issue) => issue.severity === "error"), []);
  const resolved = Engine.resolveDecisiones(withIds(decisions), { debtContracts: contracts });
  assert.equal(resolved.resultados.length, 3);
  assert.ok(resolved.resultados.every((item) => item.resultado === "aplicada"), JSON.stringify(resolved.resultados));
});

test("SVD-4 · el puente guarda como FX-21: mismo almacén, firma, diez vivos y esquema", () => {
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  assert.match(puente, /function receiveDebtRoadmapScenario\(payload\)/);
  assert.match(puente, /entry\.firma === firma/);
  assert.match(puente, />= 10\)/);
  assert.match(puente, /schema\.validateDecision\(decision, "\$", issues\)/);
  assert.match(puente, /origen: "simulador-deuda"/);
  assert.match(puente, /"finance-debt-roadmap-save-scenario"\) \{ receiveDebtRoadmapScenario/);
});

// SVD-4 · «Lo hemos propuesto»: las propuestas que esperan respuesta llegan a Hoy y al calendario.
const Reminders = require("../canonical-reminders.js");

test("SVD-4 · propuestas pendientes: solo contratos reales sin acuerdo aceptado, ordenadas por lo que falta para la respuesta", () => {
  const model = Adapter.buildReadModel({ contracts: [...contracts, { id: "debt-custom-3", entity: "Otra FICTICIA", paymentStatus: "active", currentPrincipal: 800, agreement: { status: "accepted", settlementAmount: 400, startMonth: "2026-12" } }] });
  const state = {
    [`${key1}_propuesta`]: "2026-11-10", [`${key1}_respuesta`]: "2026-11-25",
    [`${key2}_propuesta`]: "2026-11-01", [`${key2}_respuesta`]: "2026-11-15",
    [`${Adapter.dynamicAccountKey("debt-custom-3")}_propuesta`]: "2026-11-01",
  };
  const pendientes = Adapter.pendingProposals({ roadmapState: state, canonical: model, today: "2026-11-17" });
  assert.deepEqual(pendientes.map((item) => [item.id, item.dias]), [["debt-custom-2", -2], ["debt-custom-1", 8]]);
  assert.equal(pendientes[1].entity, "Banco FICTICIO");
  assert.deepEqual(Adapter.pendingProposals({ roadmapState: { [`${key1}_propuesta`]: "no es fecha" }, canonical: model, today: "2026-11-17" }), []);
  // Sin día de respuesta: se sabe que está propuesto, pero no cuándo avisar.
  assert.equal(Adapter.pendingProposals({ roadmapState: { [`${key1}_propuesta`]: "2026-11-10" }, canonical: model, today: "2026-11-17" })[0].dias, null);
});

test("SVD-4 · las fechas de la propuesta son del estado operativo del simulador, no supuestos", () => {
  assert.equal(Adapter.classifyField(`${key1}_propuesta`), "operational");
  assert.equal(Adapter.classifyField(`${key1}_respuesta`), "operational");
});

test("SVD-4 · el calendario tiene su tipo «debtProposal»: el día de la respuesta, sin nombres en el título, y se puede apagar", () => {
  const input = { today: "2026-11-17", incomes: [], outflows: [], proposals: [{ id: "debt-custom-1", date: "2026-11-25", title: "Deuda: ¿ha contestado la entidad a la propuesta?", description: "Banco FICTICIO: propuesta del 10/11/26" }] };
  const built = Reminders.build({ ...input, options: { kinds: Object.fromEntries(Reminders.KINDS.map((kind) => [kind, kind === "debtProposal"])) } });
  assert.deepEqual(built.events.map((event) => [event.kind, event.date, event.title]), [["debtProposal", "2026-11-25", "Deuda: ¿ha contestado la entidad a la propuesta?"]]);
  assert.doesNotMatch(built.events[0].title, /FICTICIO/);
  assert.equal(Reminders.build({ ...input, options: { kinds: { debtProposal: false } } }).counts.debtProposal, 0);
  assert.equal(Reminders.DEFAULTS.kinds.debtProposal, true);
});

test("SVD-4 · Hoy y el calendario leen las propuestas del puente", () => {
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  const hoy = fs.readFileSync(path.join(__dirname, "..", "views", "hoy-v2.js"), "utf8");
  const recordatorios = fs.readFileSync(path.join(__dirname, "..", "recordatorios-ui.js"), "utf8");
  assert.match(puente, /function svdPropuestasHoy\(/);
  assert.match(puente, /item\.dias !== null && item\.dias <= 7/);
  assert.match(hoy, /typeof svdPropuestasHoy === "function" \? svdPropuestasHoy\(hoy\) : \[\]/);
  assert.match(recordatorios, /proposals: globalThis\.svdPropuestasCalendario\?\.\(today\) \|\| \[\]/);
  // Se apaga desde la pantalla como los demás tipos: su casilla y su nombre.
  assert.match(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), /<input type="checkbox" data-recordatorios-kind="debtProposal" checked \/>/);
  assert.match(recordatorios, /debtProposal: "respuestas a propuestas de deuda"/);
});
