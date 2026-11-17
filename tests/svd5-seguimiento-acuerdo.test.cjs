// SVD-5 (17/11/2026, «la vuelta»): lo que pasa fuera del simulador con un acuerdo aceptado. Si su decisión desaparece del plan
// hay que decirlo (Ruta lo sigue, la previsión ya no lo paga); si el pago pactado sale en el extracto, se propone liquidar.
// Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");

const { agreementFollowUp } = require("../canonical-debt-contracts.js");
const Adapter = require("../canonical-e14-debt-adapter.js");

function contract(agreement = {}, overrides = {}) {
  return {
    id: "c1", entity: "Banco FICTICIO", type: "Préstamo", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90,
    agreement: { status: "accepted", settlementAmount: 1500, payment: 0, duration: 0, startMonth: "2026-12", decisionId: "d1", ...agreement },
    ...overrides,
  };
}

function follow(rows, options) {
  return agreementFollowUp(rows, { decisions: [{ id: "d1" }], todayKey: "2027-01", movements: [], ...options })[0];
}

test("SVD-5 · solo los acuerdos aceptados; uno propuesto no se sigue", () => {
  assert.deepEqual(agreementFollowUp([contract({ status: "proposed" })], { decisions: [], movements: [] }), []);
});

test("SVD-5 · si su decisión ya no está en el plan, lo dice (también la reconoce por targetId)", () => {
  assert.equal(follow([contract()], { decisions: [] }).plan, "sin-decision");
  assert.equal(follow([contract()]).plan, "en-plan");
  const porDestino = follow([contract({ decisionId: "" })], { decisions: [{ id: "otra", svdAcuerdo: true, targetId: "c1" }] });
  assert.equal(porDestino.plan, "en-plan");
  assert.equal(porDestino.decisionId, "otra");
});

test("SVD-5 · el pago único en el extracto, en su mes o uno al lado, por importe y nombre: cumplido", () => {
  const result = follow([contract()], { movements: [{ date: "2027-01-03", amount: -1499, label: "TRANSF A BANCO FICTICIO SA" }] });
  assert.equal(result.estado, "cumplido");
  assert.deepEqual(result.pago, { date: "2027-01-03", amount: 1499, label: "TRANSF A BANCO FICTICIO SA", match: "por-nombre" });
});

test("SVD-5 · sin el nombre, solo si hay un único movimiento con ese importe; dos dudosos no valen", () => {
  const solo = follow([contract()], { movements: [{ date: "2026-12-10", amount: -1500, label: "TRANSFERENCIA" }] });
  assert.equal(solo.pago.match, "por-importe");
  const dos = follow([contract()], { movements: [{ date: "2026-12-10", amount: -1500, label: "A" }, { date: "2026-12-11", amount: -1500, label: "B" }] });
  assert.equal(dos.pago, null);
});

test("SVD-5 · ingresos, otros importes y meses lejanos no cuentan como el pago", () => {
  const result = follow([contract()], { todayKey: "2026-12", movements: [
    { date: "2026-12-05", amount: 1500, label: "BANCO FICTICIO" },
    { date: "2026-12-05", amount: -1400, label: "BANCO FICTICIO" },
    { date: "2027-03-05", amount: -1500, label: "BANCO FICTICIO" },
  ] });
  assert.equal(result.pago, null);
  assert.equal(result.estado, "en-curso");
});

test("SVD-5 · pendiente antes de su mes; sin pago si el mes ya pasó y no se ve", () => {
  assert.equal(follow([contract()], { todayKey: "2026-11" }).estado, "pendiente");
  assert.equal(follow([contract()], { todayKey: "2027-02" }).estado, "sin-pago");
});

test("SVD-5 · refinanciación: cuenta las cuotas pactadas vistas, una por mes, y se cumple con todas", () => {
  const refi = contract({ settlementAmount: 0, payment: 100, duration: 3, startMonth: "2026-10" });
  const movements = [
    { date: "2026-10-05", amount: -100, label: "Recibo Ficticio" },
    { date: "2026-10-20", amount: -100, label: "Recibo Ficticio" },
    { date: "2026-11-05", amount: -100, label: "Recibo Ficticio" },
  ];
  const parcial = follow([refi], { movements });
  assert.deepEqual(parcial.cuotas, { vistas: 2, pactadas: 3 });
  assert.equal(parcial.estado, "en-curso");
  const todas = follow([refi], { movements: [...movements, { date: "2026-12-05", amount: -100, label: "Recibo Ficticio" }] });
  assert.equal(todas.estado, "cumplido");
});

test("SVD-5 · un contrato ya liquidado lo dice", () => {
  assert.equal(follow([contract({}, { paymentStatus: "settled", currentPrincipal: 0 })]).estado, "ya-liquidado");
});

test("SVD-5 · el modelo de lectura del simulador lleva el seguimiento a cada acuerdo", () => {
  const rows = [contract({ type: "settlement" })];
  const followUp = agreementFollowUp(rows, { decisions: [], todayKey: "2027-01", movements: [] });
  const model = Adapter.buildReadModel({ contracts: rows, agreementFollowUp: followUp });
  assert.deepEqual(model.extraDebts[0].acuerdo.seguimiento, { plan: "sin-decision", estado: "en-curso", pagoFecha: "" });
  assert.equal(Adapter.buildReadModel({ contracts: rows }).extraDebts[0].acuerdo.seguimiento, undefined);
});
