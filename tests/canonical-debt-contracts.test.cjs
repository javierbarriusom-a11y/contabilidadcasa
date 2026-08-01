const test = require("node:test");
const assert = require("node:assert/strict");
const DebtContracts = require("../canonical-debt-contracts.js");

test("una deuda suspendida conserva capital y atrasos sin convertirse en alivio de caja", () => {
  const contract = DebtContracts.normalizeContract({
    id: "wizink-1",
    entity: "Wizink",
    type: "Tarjeta",
    number: "5267 5209 1552 8008",
    initialPrincipal: 7381.63,
    currentPrincipal: 7381.63,
    originalPayment: 191.72,
    currentPayment: 0,
    remainingInstallments: 0,
  }, 0, { asOfMonthKey: "2026-06" });

  assert.equal(contract.paymentStatus, "suspended");
  assert.equal(contract.scheduledPayment, 0);
  assert.equal(contract.arrearsMonths, 5);
  assert.equal(contract.arrearsEstimated, 958.6);

  const resume = DebtContracts.resumePlan(contract, { startMonthKey: "2026-06" });
  assert.equal(resume.arrears, 958.6);
  assert.equal(resume.recurringAmount, 191.72);
  assert.ok(resume.recurringDuration > 0);
});

test("la reunificacion se registra como contrato agregado sin reactivar sus componentes", () => {
  const result = DebtContracts.normalizeContracts([
    {
      id: "cetelem-1",
      entity: "Cetelem",
      type: "Crédito",
      number: "1",
      initialPrincipal: 1547.08,
      currentPrincipal: 0,
      originalPayment: 262.34,
      currentPayment: 259,
      reunified: true,
      remainingInstallments: 130,
    },
    {
      id: "cetelem-2",
      entity: "Cetelem",
      type: "Tarjeta",
      number: "2",
      initialPrincipal: 8000,
      currentPrincipal: 0,
      originalPayment: 289.62,
      currentPayment: 259,
      reunified: true,
      remainingInstallments: 130,
    },
  ], {
    asOfMonthKey: "2026-06",
    reunifiedPayment: 259,
    reunifiedInstallments: 130,
  });

  assert.equal(result.contracts.every((item) => item.scheduledPayment === 0), true);
  assert.equal(result.unifiedPlan.scheduledPayment, 259);
  assert.equal(result.unifiedPlan.currentPrincipal, 9547.08);
  assert.equal(DebtContracts.summarizeContracts(result).scheduledPayment, 259);
});

test("el plan retomar suma atrasos y mantiene el vencimiento contractual", () => {
  const contract = DebtContracts.normalizeContract({
    id: "bankinter-1",
    entity: "Bankintercard",
    type: "Crédito",
    number: "0128",
    currentPrincipal: 14975.01,
    originalPayment: 426.49,
    currentPayment: 0,
    maturity: "19/8/29",
  }, 0, { asOfMonthKey: "2026-07" });

  const plan = DebtContracts.resumePlan(contract, { startMonthKey: "2026-07" });
  assert.equal(plan.arrearsMonths, 6);
  assert.equal(plan.arrears, 2558.94);
  assert.ok(plan.recurringDuration >= 37);
  assert.ok(plan.total > contract.currentPrincipal);
});

test("la calidad contractual hace visibles los datos obligatorios desconocidos", () => {
  const contract = DebtContracts.normalizeContract({
    id: "incomplete",
    entity: "Entidad",
    currentPrincipal: 1000,
    currentPayment: 100,
  });
  assert.equal(contract.dataQuality.complete, false);
  assert.ok(contract.dataQuality.missing.includes("apr"));
  assert.ok(contract.dataQuality.missing.includes("maturity"));
  assert.ok(contract.dataQuality.missing.includes("owner"));
  const validation = DebtContracts.validateContracts([contract]);
  assert.equal(validation.valid, true);
  assert.ok(validation.issues.some((item) => item.code === "missing-required-field" && item.field === "apr"));
});

test("un contrato documentado alcanza calidad completa", () => {
  const contract = DebtContracts.normalizeContract({
    id: "complete",
    entity: "Entidad",
    currentPrincipal: 1000,
    currentPayment: 100,
    apr: 7.5,
    maturityMonth: "2027-08",
    owner: "javi",
    provenance: "verified",
    source: "contract-pdf",
    agreement: { status: "none" },
  });
  assert.equal(contract.apr, 7.5);
  assert.equal(contract.dataQuality.complete, true);
  assert.equal(contract.dataQuality.confidence, "high");
});
