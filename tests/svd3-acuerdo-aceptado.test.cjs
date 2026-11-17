// SVD-3 (17/11/2026): un acuerdo aceptado con la entidad, marcado a mano por el hogar en el simulador visual de deuda (D-N21),
// se guarda en el contrato (lo que se debe y cómo se paga), lleva su dinero a una decisión del plan y Ruta lo respeta.
// Contratos inventados («Banco FICTICIO»): nunca datos del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");

const DebtContracts = require("../canonical-debt-contracts.js");
const PayoffPath = require("../canonical-debt-payoff-path.js");
const Adapter = require("../canonical-e14-debt-adapter.js");

const START = "2026-12";

function contract(overrides = {}) {
  return {
    id: "debt-custom-1", entity: "Banco FICTICIO", type: "Préstamo", paymentStatus: "active",
    currentPrincipal: 3000, currentPayment: 150, apr: 12, remainingInstallments: 24, ...overrides,
  };
}

function row(result, id = "debt-custom-1") {
  return result.included.find((item) => item.id === id);
}

test("SVD-3 · el contrato guarda el rastro del acuerdo aceptado y los acuerdos de antes no cambian", () => {
  const { contracts } = DebtContracts.normalizeContracts([
    { id: "a", entity: "Banco FICTICIO", currentPrincipal: 1000, currentPayment: 50, agreement: { status: "accepted", settlementAmount: 600, startMonth: "2027-01", type: "settlement", acceptedAt: "2026-11-17T10:00:00.000Z", documentId: "svd-acuerdo-a-1", documentName: "carta.pdf", decisionId: "debt-1", principalAtAcceptance: 1000 } },
    { id: "b", entity: "Caja FICTICIA", currentPrincipal: 500, currentPayment: 25, settlementAmount: 300 },
  ]);
  const a = contracts.find((item) => item.id === "a").agreement;
  assert.equal(a.status, "accepted");
  assert.equal(a.type, "settlement");
  assert.equal(a.documentId, "svd-acuerdo-a-1");
  assert.equal(a.documentName, "carta.pdf");
  assert.equal(a.decisionId, "debt-1");
  assert.equal(a.principalAtAcceptance, 1000);
  const b = contracts.find((item) => item.id === "b").agreement;
  assert.deepEqual(Object.keys(b).sort(), ["duration", "payment", "settlementAmount", "source", "startMonth", "status"]);
  assert.equal(b.status, "proposed");
});

test("SVD-3 · sin acuerdo aceptado, Ruta da exactamente lo mismo que antes (un acuerdo propuesto no cuenta)", () => {
  const base = PayoffPath.project([contract()], { startMonthKey: START });
  const proposed = PayoffPath.project([contract({ agreement: { status: "proposed", settlementAmount: 1000, startMonth: "2027-01" } })], { startMonthKey: START });
  assert.deepEqual(proposed, base);
  assert.equal(row(base).agreement, undefined);
});

test("SVD-3 · quita: la cuota de hoy hasta el mes del acuerdo, ese mes el pago pactado y la deuda queda saldada", () => {
  const result = PayoffPath.project([contract({ agreement: { status: "accepted", settlementAmount: 1800, startMonth: "2027-02" } })], { startMonthKey: START });
  const debt = row(result);
  assert.equal(debt.payoffMonthKey, "2027-02");
  assert.equal(result.debtFreeMonthKey, "2027-02");
  assert.equal(result.totalPaid, 150 + 150 + 1800);
  assert.deepEqual(debt.agreement, { startMonthKey: "2027-02", lump: 1800, payment: 0, duration: 0 });
  assert.equal(debt.declaredGapMonths, null);
});

test("SVD-3 · refinanciación de un contrato suspendido: entra en Ruta y acaba con la última cuota pactada", () => {
  const suspended = contract({ paymentStatus: "suspended", currentPayment: 0, currentPrincipal: 5000, apr: null, remainingInstallments: null });
  assert.equal(PayoffPath.project([suspended], { startMonthKey: START }).included.length, 0);
  const result = PayoffPath.project([{ ...suspended, agreement: { status: "accepted", settlementAmount: 0, payment: 200, duration: 12, startMonth: START } }], { startMonthKey: START });
  assert.equal(result.excluded.length, 0);
  const debt = row(result);
  assert.equal(debt.payoffIndex, 11);
  assert.equal(result.totalPaid, 2400);
  assert.equal(debt.stalled, false);
  assert.equal(debt.rateSource, "acuerdo");
});

test("SVD-3 · híbrido: pago único y cuotas desde el mismo mes, como en el simulador", () => {
  const result = PayoffPath.project([contract({ agreement: { status: "accepted", settlementAmount: 500, payment: 100, duration: 6, startMonth: "2027-01" } })], { startMonthKey: START });
  const debt = row(result);
  assert.equal(debt.payoffMonthKey, "2027-06");
  assert.equal(result.totalPaid, 150 + 500 + 600);
});

test("SVD-3 · un acuerdo que empezó antes del mes de partida da por pagados el pago único y las cuotas ya vencidas", () => {
  const result = PayoffPath.project([contract({ agreement: { status: "accepted", settlementAmount: 400, payment: 100, duration: 12, startMonth: "2026-09" } })], { startMonthKey: START });
  const debt = row(result);
  assert.equal(debt.payoffIndex, 8);
  assert.equal(result.totalPaid, 900);
});

test("SVD-3 · el extra de Ruta no va a una deuda con acuerdo aceptado: va a la siguiente", () => {
  const agreed = contract({ apr: 25, agreement: { status: "accepted", settlementAmount: 2000, startMonth: "2027-06" } });
  const other = contract({ id: "debt-custom-2", entity: "Caja FICTICIA", apr: 8, currentPrincipal: 2000, currentPayment: 100 });
  const result = PayoffPath.project([agreed, other], { startMonthKey: START, extraMonthly: 200 });
  assert.equal(row(result).extraApplied, 0);
  assert.ok(row(result, "debt-custom-2").extraApplied > 0);
  assert.equal(row(result).payoffMonthKey, "2027-06");
  assert.equal(result.firstTarget.id, "debt-custom-2");
});

function canonicalWith(rows, extra = {}) {
  return Adapter.buildReadModel({ contracts: rows, payoffPath: PayoffPath, startMonthKey: START, ...extra });
}

test("SVD-3 · buildAcceptedAgreement: convierte la cuenta en el acuerdo del contrato (mes = mes base + inicio − 1)", () => {
  const canonical = canonicalWith([contract()]);
  const key = Adapter.dynamicAccountKey("debt-custom-1");
  const settled = Adapter.buildAcceptedAgreement({ accountKey: key, canonical, baseMonthKey: START, todayKey: START, account: { strategy: "settlement", lump: 1800, start: 3 } });
  assert.equal(settled.ok, true);
  assert.equal(settled.contractId, "debt-custom-1");
  assert.deepEqual(settled.agreement, { status: "accepted", type: "settlement", settlementAmount: 1800, payment: 0, duration: 0, startMonth: "2027-02", source: "simulador-visual-de-deuda", principalAtAcceptance: 3000 });
  assert.equal(settled.totalAgreed, 1800);
  assert.equal(settled.saving, 1200);
  const refi = Adapter.buildAcceptedAgreement({ accountKey: key, canonical, baseMonthKey: START, todayKey: START, account: { strategy: "refi", lump: 0, monthly: 140.5, term: 24, start: 1 } });
  assert.equal(refi.agreement.type, "refinancing");
  assert.equal(refi.agreement.startMonth, START);
  assert.equal(refi.saving, Math.round((3000 - 140.5 * 24) * 100) / 100);
});

test("SVD-3 · buildAcceptedAgreement se niega con el motivo: sin contrato, «Esperar», sin importe, mes pasado o acuerdo ya aceptado", () => {
  const canonical = canonicalWith([contract()]);
  const key = Adapter.dynamicAccountKey("debt-custom-1");
  const ask = (account, extra = {}) => Adapter.buildAcceptedAgreement({ accountKey: key, canonical, baseMonthKey: START, todayKey: START, account, ...extra });
  assert.match(Adapter.buildAcceptedAgreement({ accountKey: "acct_otro", canonical, baseMonthKey: START, account: { strategy: "settlement", lump: 10 } }).message, /contrato real único/);
  assert.match(ask({ strategy: "hold" }).message, /Esperar/);
  assert.match(ask({ strategy: "settlement", lump: 0 }).message, /no tiene importe/);
  assert.match(ask({ strategy: "refi", monthly: 0, term: 12 }).message, /cuota o plazo/);
  assert.match(ask({ strategy: "settlement", lump: 100, start: 1 }, { todayKey: "2027-01" }).message, /ya ha pasado/);
  const already = canonicalWith([contract({ agreement: { status: "accepted", settlementAmount: 100, startMonth: START } })]);
  assert.match(Adapter.buildAcceptedAgreement({ accountKey: key, canonical: already, baseMonthKey: START, account: { strategy: "settlement", lump: 100 } }).message, /ya tiene un acuerdo aceptado/);
});

test("SVD-3 · la decisión del plan lleva solo el dinero, y la cuota de hoy deja de restarse solo si está en el plan", () => {
  const agreement = { status: "accepted", type: "hybrid", settlementAmount: 500, payment: 100, duration: 6, startMonth: "2027-01", principalAtAcceptance: 3000 };
  const decision = Adapter.agreementPlanDecision({ agreement, contract: contract(), monthIndex: 1, cuotasEnPlan: true });
  assert.equal(decision.amount, 500);
  assert.equal(decision.recurringAmount, 100);
  assert.equal(decision.recurringDuration, 6);
  assert.equal(decision.recurringStartOffset, 0);
  assert.equal(decision.duration, 1);
  assert.equal(decision.monthIndex, 1);
  assert.equal(decision.monthlyRelief, 150);
  assert.equal(decision.targetId, "debt-custom-1");
  assert.equal(decision.discount, 3000 - 500 - 600);
  assert.equal(decision.svdAcuerdo, true);
  assert.equal(Adapter.agreementPlanDecision({ agreement, contract: contract(), monthIndex: 1, cuotasEnPlan: false }).monthlyRelief, 0);
  assert.equal(Adapter.agreementPlanDecision({ agreement, contract: contract({ paymentStatus: "suspended" }), monthIndex: 1, cuotasEnPlan: true }).monthlyRelief, 0);
});

test("SVD-3 · no contar dos veces: el contrato sigue con su capital, el plan lleva lo pactado y Ruta paga lo mismo desde el acuerdo", () => {
  const canonical = canonicalWith([contract()]);
  const built = Adapter.buildAcceptedAgreement({ accountKey: Adapter.dynamicAccountKey("debt-custom-1"), canonical, baseMonthKey: START, todayKey: START, account: { strategy: "hybrid", lump: 500, monthly: 100, term: 6, start: 1 } });
  const decision = Adapter.agreementPlanDecision({ agreement: built.agreement, contract: built.contract, monthIndex: 0, cuotasEnPlan: false });
  const cashOut = decision.amount + decision.recurringAmount * decision.recurringDuration;
  assert.equal(cashOut, built.totalAgreed);
  const stored = { ...contract(), agreement: built.agreement };
  assert.equal(stored.currentPrincipal, 3000);
  const ruta = PayoffPath.project([stored], { startMonthKey: START });
  assert.equal(ruta.totalPaid, built.totalAgreed);
});

test("SVD-3 · el modelo de lectura dice qué cuentas tienen acuerdo, y la comparación con «todas en Esperar» los deja fuera", () => {
  const agreed = contract({ agreement: { status: "accepted", type: "settlement", settlementAmount: 1800, startMonth: "2027-02", documentId: "doc-1", documentName: "carta.pdf", acceptedAt: "2026-11-17T10:00:00.000Z" } });
  const canonical = canonicalWith([agreed]);
  assert.deepEqual(canonical.extraDebts[0].acuerdo, { type: "settlement", startMonth: "2027-02", settlementAmount: 1800, payment: 0, duration: 0, acceptedAt: "2026-11-17T10:00:00.000Z", documentName: "carta.pdf", hasDocument: true });
  const plain = canonicalWith([contract()]);
  assert.deepEqual(canonical.ruta, plain.ruta);
  assert.equal(plain.extraDebts[0].acuerdo, null);
});
