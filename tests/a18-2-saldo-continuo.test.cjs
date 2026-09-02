const test = require("node:test");
const assert = require("node:assert/strict");

const Split = require("../canonical-household-split.js");

// A18-2 (BACKLOG_PATRIMONIO_Y_FINANZAS.md, depende de A18-1): "cálculo permanente visible para
// ambas partes, sin afectar al libro principal". Cada gasto compartido registrado ya fue pagado al
// 100% por un titular (paidBy); la regla de reparto de A18-1 (resolveRuleForCategory + splitShares)
// dice cuál era su cuota justa, así que el otro le debe esa cuota. runningBalance() acumula esa
// diferencia en un único saldo neto — nunca dos cifras que se contradigan.

function settingsWith(overrides = {}) {
  return { incomes: { javi: 0, tere: 0 }, defaultRule: { mode: "equal", payer: "javi", amount: null }, categoryRules: {}, ...overrides };
}

test("sin gastos registrados, el saldo es cero (no una cifra ausente: no hay nada que repartir)", () => {
  const balance = Split.runningBalance([], settingsWith());
  assert.equal(balance.net, 0);
  assert.equal(balance.owes, null);
  assert.equal(balance.owedTo, null);
  assert.equal(balance.amount, 0);
});

test("un único gasto a partes iguales pagado por Javi: Tere le debe la mitad", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "javi", date: "2026-09-01" }], settingsWith());
  assert.equal(balance.owes, "tere");
  assert.equal(balance.owedTo, "javi");
  assert.equal(balance.amount, 50);
});

test("el mismo gasto pagado por Tere invierte la dirección de la deuda", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "tere", date: "2026-09-01" }], settingsWith());
  assert.equal(balance.owes, "javi");
  assert.equal(balance.owedTo, "tere");
  assert.equal(balance.amount, 50);
});

test("dos gastos iguales pagados uno por cada titular se cancelan: saldo en cero", () => {
  const balance = Split.runningBalance([
    { id: "1", category: "Ocio", amount: 100, paidBy: "javi" },
    { id: "2", category: "Ocio", amount: 100, paidBy: "tere" },
  ], settingsWith());
  assert.equal(balance.net, 0);
  assert.equal(balance.owes, null);
});

test("una regla de importe fijo por categoría decide la cuota, no partes iguales", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Hipoteca", amount: 1000, paidBy: "javi" }],
    settingsWith({ categoryRules: { Hipoteca: { mode: "fixed", payer: "tere", amount: 300 } } }),
  );
  // Tere cubre 300 según la regla; como Javi pagó el 100%, Tere le debe esos 300 (no la mitad).
  assert.equal(balance.owes, "tere");
  assert.equal(balance.amount, 300);
});

test("una regla proporcional a ingresos reparte según lo declarado en A18-1", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Alimentación", amount: 100, paidBy: "tere" }],
    settingsWith({ incomes: { javi: 3000, tere: 1000 }, defaultRule: { mode: "income-proportional", payer: "javi", amount: null } }),
  );
  // Javi gana 3/4 de los ingresos combinados -> su cuota es 75; como Tere pagó el 100%, Javi le debe 75.
  assert.equal(balance.owes, "javi");
  assert.equal(balance.amount, 75);
});

test("categorías sin regla propia caen a la regla por defecto (mismo criterio que A18-1)", () => {
  const balance = Split.runningBalance(
    [{ id: "1", category: "Sin regla propia", amount: 100, paidBy: "javi" }],
    settingsWith({ defaultRule: { mode: "fixed", payer: "javi", amount: 20 } }),
  );
  // Javi (regla) cubre 20, Tere cubre 80; como Javi pagó el 100%, Tere le debe 80.
  assert.equal(balance.amount, 80);
  assert.equal(balance.owes, "tere");
});

test("acumula varios gastos en un único saldo neto, nunca dos saldos que se contradigan", () => {
  const balance = Split.runningBalance([
    { id: "1", category: "Ocio", amount: 100, paidBy: "javi" },
    { id: "2", category: "Ocio", amount: 40, paidBy: "javi" },
    { id: "3", category: "Ocio", amount: 30, paidBy: "tere" },
  ], settingsWith());
  // Cuota ajena por transacción (partes iguales): 50 y 20 a favor de Javi, 15 a favor de Tere.
  // Neto: Tere debe (50 + 20) - 15 = 55 a Javi.
  assert.equal(balance.owes, "tere");
  assert.equal(balance.amount, 55);
});

test("un titular desconocido en paidBy cae al valor más neutro (Javi), igual que normalizeRule", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: 100, paidBy: "quien-sabe" }], settingsWith());
  assert.equal(balance.entries[0].paidBy, "javi");
});

test("un importe negativo o inválido nunca genera una deuda negativa fantasma", () => {
  const balance = Split.runningBalance([{ id: "1", category: "Ocio", amount: -100, paidBy: "javi" }], settingsWith());
  assert.equal(balance.entries[0].amount, 0);
  assert.equal(balance.net, 0);
});

test("runningBalance está expuesta en el motor canónico", () => {
  assert.equal(typeof Split.runningBalance, "function");
});
