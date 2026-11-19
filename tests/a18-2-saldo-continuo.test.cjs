const test = require("node:test");
const assert = require("node:assert/strict");

const Split = require("../canonical-household-split.js");

// A18-2 (BACKLOG_PATRIMONIO_Y_FINANZAS.md, depende de A18-1): "cálculo permanente visible para
// ambas partes, sin afectar al libro principal". Cada gasto compartido registrado ya fue pagado al
// 100% por un titular (paidBy); la regla de reparto de A18-1 (resolveRuleForCategory + splitShares)
// dice cuál era su cuota justa, así que el otro le debe esa cuota. runningBalance() acumula esa
// diferencia en un único saldo neto — nunca dos cifras que se contradigan.

function settingsWith(overrides = {}) {
  return { incomes: { p1: 0, p2: 0 }, defaultRule: { mode: "equal", payer: "p1", amount: null }, categoryRules: {}, ...overrides };
}

test("sin gastos registrados, el saldo es cero (no una cifra ausente: no hay nada que repartir)", () => {
  const balance = Split.runningBalance([], settingsWith());
  assert.equal(balance.net, 0);
  assert.equal(balance.owes, null);
  assert.equal(balance.owedTo, null);
  assert.equal(balance.amount, 0);
});

test("un único gasto a partes iguales pagado por P1: P2 le debe la mitad", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "p1", date: "2026-09-01" }], settingsWith());
  assert.equal(balance.owes, "p2");
  assert.equal(balance.owedTo, "p1");
  assert.equal(balance.amount, 50);
});

test("el mismo gasto pagado por P2 invierte la dirección de la deuda", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "p2", date: "2026-09-01" }], settingsWith());
  assert.equal(balance.owes, "p1");
  assert.equal(balance.owedTo, "p2");
  assert.equal(balance.amount, 50);
});

test("dos gastos iguales pagados uno por cada titular se cancelan: saldo en cero", () => {
  const balance = Split.runningBalance([
    { id: "1", category: "Ocio", amount: 100, paidBy: "p1" },
    { id: "2", category: "Ocio", amount: 100, paidBy: "p2" },
  ], settingsWith());
  assert.equal(balance.net, 0);
  assert.equal(balance.owes, null);
});

test("una regla de importe fijo por categoría decide la cuota, no partes iguales", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Hipoteca", amount: 1000, paidBy: "p1" }],
    settingsWith({ categoryRules: { Hipoteca: { mode: "fixed", payer: "p2", amount: 300 } } }),
  );
  // P2 cubre 300 según la regla; como P1 pagó el 100%, P2 le debe esos 300 (no la mitad).
  assert.equal(balance.owes, "p2");
  assert.equal(balance.amount, 300);
});

test("una regla proporcional a ingresos reparte según lo declarado en A18-1", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Alimentación", amount: 100, paidBy: "p2" }],
    settingsWith({ incomes: { p1: 3000, p2: 1000 }, defaultRule: { mode: "income-proportional", payer: "p1", amount: null } }),
  );
  // P1 gana 3/4 de los ingresos combinados -> su cuota es 75; como P2 pagó el 100%, P1 le debe 75.
  assert.equal(balance.owes, "p1");
  assert.equal(balance.amount, 75);
});

test("categorías sin regla propia caen a la regla por defecto (mismo criterio que A18-1)", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Sin regla propia", amount: 100, paidBy: "p1" }],
    settingsWith({ defaultRule: { mode: "fixed", payer: "p1", amount: 20 } }),
  );
  // P1 (regla) cubre 20, P2 cubre 80; como P1 pagó el 100%, P2 le debe 80.
  assert.equal(balance.amount, 80);
  assert.equal(balance.owes, "p2");
});

test("acumula varios gastos en un único saldo neto, nunca dos saldos que se contradigan", () => {
  const balance = Split.runningBalance([
    { id: "1", category: "Ocio", amount: 100, paidBy: "p1" },
    { id: "2", category: "Ocio", amount: 40, paidBy: "p1" },
    { id: "3", category: "Ocio", amount: 30, paidBy: "p2" },
  ], settingsWith());
  // Cuota ajena por transacción (partes iguales): 50 y 20 a favor de P1, 15 a favor de P2.
  // Neto: P2 debe (50 + 20) - 15 = 55 a P1.
  assert.equal(balance.owes, "p2");
  assert.equal(balance.amount, 55);
});

test("un titular desconocido en paidBy cae al valor más neutro (P1), igual que normalizeRule", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "quien-sabe" }], settingsWith());
  assert.equal(balance.entries[0].paidBy, "p1");
});

test("un importe negativo o inválido nunca genera una deuda negativa fantasma", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: -100, paidBy: "p1" }], settingsWith());
  assert.equal(balance.entries[0].amount, 0);
  assert.equal(balance.net, 0);
});

test("runningBalance está expuesta en el motor canónico", () => {
  assert.equal(typeof Split.runningBalance, "function");
});
