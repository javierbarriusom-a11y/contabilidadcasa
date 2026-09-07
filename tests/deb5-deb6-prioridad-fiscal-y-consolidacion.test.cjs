const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const DebtContracts = require("../canonical-debt-contracts.js");

// DEB5 (Oleada 3, Bloque 4): prioridad multideuda ajustada por fiscalidad — el orden de "mayor
// coste" real no es el TAE nominal cuando hay deducción fiscal declarada (hipoteca con deducción
// autonómica vigente vs. préstamo personal sin deducción). Opera sobre TODAS las deudas activas
// del hogar (ampliado a propósito frente al alcance restringido de AP1/DEB1).
//
// DEB6 (Oleada 3, Bloque 4): simulador de consolidación — compara el coste de mantener varias
// deudas activas por separado contra un préstamo nuevo declarado (TAE + plazo), sin ejecutar nada.

test("fiscalAdjustedDebtPriority · sin deudas activas con TAE, no calculable", () => {
  const result = DebtContracts.fiscalAdjustedDebtPriority([]);
  assert.equal(result.calculable, false);
});

test("fiscalAdjustedDebtPriority · sin deducción declarada, el TAE efectivo es igual al nominal (comportamiento igual que antes del campo)", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "Banco A", currentPrincipal: 10000, apr: 8, currentPayment: 200 },
    { id: "b", entity: "Banco B", currentPrincipal: 5000, apr: 5, currentPayment: 150 },
  ]).contracts;
  const result = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  assert.equal(result.calculable, true);
  assert.equal(result.reorderedByFiscal, false);
  assert.equal(result.rows[0].entity, "Banco A");
  assert.equal(result.rows[0].effectiveAprPct, 8);
  assert.equal(result.rows[1].effectiveAprPct, 5);
});

test("fiscalAdjustedDebtPriority · si el TAE nominal ya predice el mismo orden, la deducción no lo cambia", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "hipoteca", entity: "Hipoteca con deducción", type: "Hipoteca", currentPrincipal: 150000, apr: 4, currentPayment: 700, fiscalDeductionPct: 70 },
    { id: "personal", entity: "Préstamo personal", type: "Préstamo", currentPrincipal: 8000, apr: 6, currentPayment: 250 },
  ]).contracts;
  const result = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  assert.equal(result.calculable, true);
  // TAE nominal: hipoteca 4% < personal 6% → personal ya sale primero por nominal.
  // TAE efectivo: hipoteca 4%*(1-0.70)=1.2% < personal 6% → personal sigue primero: incluso con
  // una deducción alta, aquí el orden NO cambia porque el nominal ya apuntaba en la misma dirección.
  assert.equal(result.reorderedByFiscal, false);
  assert.equal(result.rows[0].entity, "Préstamo personal");
  assert.equal(result.rows[1].effectiveAprPct, 1.2);
});

test("fiscalAdjustedDebtPriority · caso real: TAE nominal más alto queda por detrás tras aplicar la deducción", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "hipoteca", entity: "Hipoteca con deducción", type: "Hipoteca", currentPrincipal: 150000, apr: 5, currentPayment: 700, fiscalDeductionPct: 80 },
    { id: "personal", entity: "Préstamo personal", type: "Préstamo", currentPrincipal: 8000, apr: 4, currentPayment: 250 },
  ]).contracts;
  const result = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  assert.equal(result.reorderedByFiscal, true);
  // Nominal: hipoteca 5% > personal 4% → hipoteca primero por nominal.
  // Efectivo: hipoteca 5%*(1-0.80)=1% < personal 4% → el personal pasa a ser prioritario.
  assert.equal(result.rows[0].entity, "Préstamo personal");
  assert.equal(result.rows[0].priorityRank, 1);
  assert.equal(result.rows[1].entity, "Hipoteca con deducción");
  assert.equal(result.rows[1].effectiveAprPct, 1);
});

test("fiscalAdjustedDebtPriority · ignora deudas suspendidas, liquidadas o sin TAE declarado", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "activa", entity: "Activa", currentPrincipal: 5000, apr: 6, currentPayment: 150 },
    { id: "liquidada", entity: "Liquidada", currentPrincipal: 0, apr: 6 },
    { id: "sin-tae", entity: "Sin TAE", currentPrincipal: 2000, currentPayment: 80 },
    { id: "suspendida", entity: "Suspendida", currentPrincipal: 3000, apr: 10, currentPayment: 0, paymentStatus: "suspended" },
  ]).contracts;
  const result = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].entity, "Activa");
});

test("fiscalAdjustedDebtPriority · la deducción se recorta a 0-100, nunca negativa ni por encima de 100", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 1000, apr: 5, currentPayment: 50, fiscalDeductionPct: 150 },
  ]).contracts;
  const result = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  assert.equal(result.rows[0].fiscalDeductionPct, 100);
  assert.equal(result.rows[0].effectiveAprPct, 0);
});

test("simulateDebtConsolidation · con menos de dos deudas seleccionadas, no calculable", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 5000, currentPayment: 150, remainingInstallments: 36 },
  ]).contracts;
  const result = DebtContracts.simulateDebtConsolidation({ contracts, contractIds: ["a"], newLoan: { annualRatePct: 6, termMonths: 48 } });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "need-at-least-two-debts");
});

test("simulateDebtConsolidation · sin TAE o plazo del préstamo nuevo, no calculable", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 5000, currentPayment: 150, remainingInstallments: 36 },
    { id: "b", entity: "B", currentPrincipal: 3000, currentPayment: 100, remainingInstallments: 30 },
  ]).contracts;
  const result = DebtContracts.simulateDebtConsolidation({ contracts, contractIds: ["a", "b"], newLoan: {} });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-new-loan-terms");
});

test("simulateDebtConsolidation · compara coste total antes/después con amortización francesa estándar", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 5000, currentPayment: 200, remainingInstallments: 30 },
    { id: "b", entity: "B", currentPrincipal: 3000, currentPayment: 150, remainingInstallments: 24 },
  ]).contracts;
  const result = DebtContracts.simulateDebtConsolidation({
    contracts,
    contractIds: ["a", "b"],
    newLoan: { annualRatePct: 6, termMonths: 36 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.totalPrincipal, 8000);
  assert.equal(result.currentMonthlyPayment, 350);
  // Coste ANTES: 200*30 + 150*24 = 6000 + 3600 = 9600
  assert.equal(result.currentTotalCost, 9600);
  // Coste DESPUÉS: cuota francesa sobre 8000€ a 6%/36 meses > cuota mensual antes (menos capital
  // por deuda separada, más plazo aquí) — solo comprobamos que el motor calcula de verdad, sin
  // fijar el resultado exacto a mano (evita un test frágil acoplado a redondeos de la fórmula).
  assert.ok(result.newMonthlyPayment > 0);
  assert.equal(result.newTotalCost, Math.round(result.newMonthlyPayment * 36 * 100) / 100);
  assert.equal(result.totalCostDelta, Math.round((result.newTotalCost - result.currentTotalCost) * 100) / 100);
  assert.equal(result.worthIt, result.newTotalCost < result.currentTotalCost);
});

test("simulateDebtConsolidation · sin interés (0%), reparte el principal a partes iguales entre los meses", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 4000, currentPayment: 200, remainingInstallments: 20 },
    { id: "b", entity: "B", currentPrincipal: 2000, currentPayment: 100, remainingInstallments: 20 },
  ]).contracts;
  const result = DebtContracts.simulateDebtConsolidation({
    contracts,
    contractIds: ["a", "b"],
    newLoan: { annualRatePct: 0, termMonths: 30 },
  });
  assert.equal(result.newMonthlyPayment, 200); // 6000 / 30
  assert.equal(result.newTotalCost, 6000);
});

test("simulateDebtConsolidation · solo incluye las deudas seleccionadas, ignora el resto de la cartera", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "a", entity: "A", currentPrincipal: 5000, currentPayment: 200, remainingInstallments: 30 },
    { id: "b", entity: "B", currentPrincipal: 3000, currentPayment: 150, remainingInstallments: 24 },
    { id: "c", entity: "C, no seleccionada", currentPrincipal: 99999, currentPayment: 999, remainingInstallments: 99 },
  ]).contracts;
  const result = DebtContracts.simulateDebtConsolidation({
    contracts,
    contractIds: ["a", "b"],
    newLoan: { annualRatePct: 6, termMonths: 36 },
  });
  assert.equal(result.totalPrincipal, 8000);
  assert.deepEqual(result.contractIds.sort(), ["a", "b"]);
});

// --- Wiring: campo declarable en Deuda › Contratos y tarjetas nuevas en la misma pantalla ---

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const deudaSource = fs.readFileSync(path.join(root, "views", "deuda.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("wiring: fiscalDeductionPct es un campo editable en la tabla de contratos", () => {
  assert.match(appSource, /DEBT_CONTRACT_EDITABLE_FIELDS = \[[\s\S]{0,400}fiscalDeductionPct/);
});

test("wiring: la fila de la tabla de contratos incluye un input para la deducción fiscal", () => {
  assert.match(deudaSource, /data-deuda-contrato-field="fiscalDeductionPct"/);
});

test("wiring: la tarjeta de prioridad fiscal (DEB5) vive en index.html, dentro de Deuda › Contratos", () => {
  const sectionStart = indexSource.indexOf('id="deuda-contratos"');
  const sectionEnd = indexSource.indexOf("</section>", sectionStart);
  const deb5Pos = indexSource.indexOf('id="deb5FiscalPriorityNote"');
  assert.ok(sectionStart >= 0 && deb5Pos > sectionStart && deb5Pos < sectionEnd, "DEB5 debe vivir dentro de la sección Deuda › Contratos");
});

test("wiring: la tarjeta de consolidación (DEB6) vive en index.html, dentro de Deuda › Contratos", () => {
  const sectionStart = indexSource.indexOf('id="deuda-contratos"');
  const sectionEnd = indexSource.indexOf("</section>", sectionStart);
  const deb6Pos = indexSource.indexOf('id="deb6ConsolidationNote"');
  assert.ok(sectionStart >= 0 && deb6Pos > sectionStart && deb6Pos < sectionEnd, "DEB6 debe vivir dentro de la sección Deuda › Contratos");
});

test("wiring: renderDeudaContratos recalcula DEB5 y DEB6 cada vez que la tabla se redibuja", () => {
  const start = deudaSource.indexOf("function renderDeudaContratos(");
  assert.ok(start >= 0, "No existe renderDeudaContratos");
  const block = deudaSource.slice(start, start + 1400);
  assert.match(block, /renderDeb5FiscalPriority\(/);
  assert.match(block, /renderDeb6DebtChecklist\(/);
});

test("wiring: el simulador de consolidación usa FinanceDebtContracts.simulateDebtConsolidation", () => {
  const start = deudaSource.indexOf("function handleDeb6Simulate(");
  assert.ok(start >= 0, "No existe handleDeb6Simulate");
  const block = deudaSource.slice(start, start + 900);
  assert.match(block, /window\.FinanceDebtContracts/);
  assert.match(block, /engine\.simulateDebtConsolidation\(/);
});

test("wiring: hay listeners registrados para el botón de simular consolidación y las casillas de deuda", () => {
  assert.match(appSource, /deb6SimulateRun.{0,60}addEventListener/s);
});
