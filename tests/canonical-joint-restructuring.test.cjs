const test = require("node:test");
const assert = require("node:assert/strict");
const Restructuring = require("../canonical-joint-restructuring.js");

// DI5 · Bloque 4: reestructuración conjunta ante una caída de ingresos. A diferencia de tratar cada
// deuda por separado, mira todos los contratos activos juntos frente al ingreso reducido y propone
// en qué orden aliviarlos (el tipo más caro primero) hasta cubrir el alivio necesario.

function contractsFixture() {
  return [
    { id: "a", label: "Préstamo A", balance: 10000, rate: 10, monthsRemaining: 24, monthlyPayment: 461.45 },
    { id: "b", label: "Préstamo B", balance: 5000, rate: 5, monthsRemaining: 12, monthlyPayment: 428.04 },
  ];
}

test("jointRestructuringPlan · sin ingreso por debajo del ratio seguro, no propone ningún cambio", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: contractsFixture(), monthlyIncome: 4000 });
  // 889,49 / 4000 = 0,2224, por debajo del 0,35 por defecto
  assert.equal(result.overBudget, false);
  assert.equal(result.reliefNeeded, 0);
  result.proposals.forEach((proposal) => assert.equal(proposal.action, "sin cambios"));
  assert.equal(result.totalReliefAchieved, 0);
  assert.equal(result.sufficient, true);
});

test("jointRestructuringPlan · con el ingreso reducido, prioriza el tipo más caro primero", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: contractsFixture(), monthlyIncome: 1500 });
  assert.equal(result.currentTotalPayment, 889.49);
  assert.equal(result.currentRatio, 0.59); // 889.49/1500
  assert.equal(result.overBudget, true);
  assert.equal(result.maxSustainablePayment, 525);
  assert.equal(result.reliefNeeded, 364.49);
  assert.equal(result.proposals[0].id, "a"); // 10% antes que 5%
  assert.equal(result.proposals[0].action, "alargar plazo");
  assert.equal(result.proposals[0].extendedMonths, 36); // 24 * 1.5
  assert.equal(result.proposals[0].newMonthlyPayment, 322.67);
  assert.equal(result.proposals[0].relief, 138.78);
});

test("jointRestructuringPlan · si el primer contrato ya cubre el alivio necesario, el segundo queda sin cambios", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: contractsFixture(), monthlyIncome: 2200 });
  // 889.49/2200 = 0.404, por encima de 0.35 -> overBudget; maxSustainable=770; reliefNeeded=119.49
  assert.equal(result.overBudget, true);
  assert.equal(result.reliefNeeded, 119.49);
  assert.equal(result.proposals[0].relief, 138.78); // el primero (10%) ya cubre de sobra el alivio necesario
  assert.equal(result.proposals[1].action, "sin cambios"); // el segundo no hace falta tocarlo
  assert.equal(result.sufficient, true);
});

test("jointRestructuringPlan · aun agotando todos los contratos, puede no ser suficiente — lo dice explícitamente", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: contractsFixture(), monthlyIncome: 1500 });
  assert.equal(result.totalReliefAchieved, 277.92);
  assert.equal(result.sufficient, false); // 277.92 < 364.49
});

test("jointRestructuringPlan · sin ingreso declarado, no fabrica un ratio (null, no 0 ni Infinity)", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: contractsFixture(), monthlyIncome: 0 });
  assert.equal(result.currentRatio, null);
  assert.equal(result.overBudget, false); // sin ratio, no hay comparación posible
});

test("jointRestructuringPlan · sin contratos activos, no hay nada que reestructurar", () => {
  const result = Restructuring.jointRestructuringPlan({ contracts: [], monthlyIncome: 2000 });
  assert.equal(result.currentTotalPayment, 0);
  assert.equal(result.proposals.length, 0);
  assert.equal(result.sufficient, true);
});
