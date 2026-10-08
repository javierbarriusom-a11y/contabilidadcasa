const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-debt-payoff-path.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const START = "2026-10";
const contract = (overrides = {}) => ({
  id: "c1", entity: "Banco", type: "Préstamo", paymentStatus: "active",
  currentPrincipal: 1200, currentPayment: 100, apr: 0, remainingInstallments: 12, ...overrides,
});
const run = (contracts, options = {}) => engine.project(contracts, { startMonthKey: START, extraMonthly: 0, ...options });

// WP-19 (NDB-01): «¿cuándo acabamos y qué cambia con más?». El extra al mes se aplica sobre el calendario francés que ya enseña
// Deuda › Ruta (capital, cuota y TAE declarados); las cuotas que se liberan NO se redirigen (convención conservadora, dicha en la tarjeta).

test("WP-19 · sin intereses: 1.200 € a 100 €/mes acaban en 12 cuotas, es decir, en septiembre de 2027", () => {
  const result = run([contract()]);
  assert.equal(result.ok, true);
  assert.equal(result.included.length, 1);
  assert.equal(result.included[0].payoffMonthKey, "2027-09");
  assert.equal(result.debtFreeMonthKey, "2027-09");
  assert.equal(result.monthsToDebtFree, 12);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.complete, true);
});

test("WP-19 · con TAE el resultado coincide con la recursión del saldo hecha a mano", () => {
  // 1.000 € al 12 % (1 %/mes) con 100 €/mes: 11 cuotas, la última parcial.
  const result = run([contract({ currentPrincipal: 1000, apr: 12, remainingInstallments: 11 })]);
  let balance = 1000;
  let interest = 0;
  let months = 0;
  while (balance > 0.005 && months < 600) {
    const monthInterest = Math.round(balance * 0.01 * 100) / 100;
    interest += monthInterest;
    balance = Math.round((balance + monthInterest - 100) * 100) / 100;
    months += 1;
  }
  assert.equal(months, 11);
  assert.equal(result.monthsToDebtFree, 11);
  assert.ok(Math.abs(result.totalInterest - interest) < 0.02, `${result.totalInterest} frente a ${interest}`);
  assert.equal(result.debtFreeMonthKey, "2027-08");
});

test("WP-19 · extra 0 es el calendario actual y un extra positivo acorta plazo y reduce intereses, sin pasarse", () => {
  const contracts = [contract({ currentPrincipal: 5000, currentPayment: 150, apr: 9, remainingInstallments: 40 })];
  const base = run(contracts);
  const more = run(contracts, { extraMonthly: 100 });
  const most = run(contracts, { extraMonthly: 300 });
  assert.ok(more.monthsToDebtFree < base.monthsToDebtFree);
  assert.ok(most.monthsToDebtFree < more.monthsToDebtFree);
  assert.ok(more.totalInterest < base.totalInterest);
  assert.ok(most.totalInterest < more.totalInterest);
  assert.equal(run(contracts, { extraMonthly: 0 }).totalInterest, base.totalInterest);
  // Lo pagado al final es siempre capital + intereses: ni un euro de más ni de menos.
  assert.ok(Math.abs(more.totalPaid - (5000 + more.totalInterest)) < 0.05);
});

test("WP-19 · el extra va a la deuda de mayor TAE y, al saldarla, sigue a la siguiente (las cuotas liberadas no se redirigen)", () => {
  const cheap = contract({ id: "barata", currentPrincipal: 3000, currentPayment: 100, apr: 4, remainingInstallments: 36 });
  const dear = contract({ id: "cara", currentPrincipal: 1000, currentPayment: 50, apr: 20, remainingInstallments: 24 });
  const base = run([cheap, dear]);
  const withExtra = run([cheap, dear], { extraMonthly: 200 });
  assert.equal(withExtra.firstTarget.id, "cara", "avalancha: la de mayor TAE primero");
  const dearBase = base.included.find((row) => row.id === "cara");
  const dearExtra = withExtra.included.find((row) => row.id === "cara");
  assert.ok(dearExtra.payoffIndex < dearBase.payoffIndex);
  // Sin redirigir la cuota liberada, la barata no se acelera por la cuota de la cara, solo por el extra que le llega después.
  const cheapExtra = withExtra.included.find((row) => row.id === "barata");
  const cheapBase = base.included.find((row) => row.id === "barata");
  assert.ok(cheapExtra.payoffIndex < cheapBase.payoffIndex, "el extra pasa a la siguiente cuando la primera acaba");
  const order = engine.project([cheap, dear], { startMonthKey: START, extraMonthly: 200, order: ["barata", "cara"] });
  assert.equal(order.firstTarget.id, "barata", "el orden DEB5 (TAE efectivo tras deducción) manda sobre el nominal");
});

test("WP-19 · bola de nieve: el extra va al menor capital", () => {
  const a = contract({ id: "a", currentPrincipal: 3000, apr: 18 });
  const b = contract({ id: "b", currentPrincipal: 500, apr: 3, currentPayment: 50, remainingInstallments: 10 });
  assert.equal(run([a, b], { extraMonthly: 50, strategy: "bola-nieve" }).firstTarget.id, "b");
  assert.equal(run([a, b], { extraMonthly: 50, strategy: "avalancha" }).firstTarget.id, "a");
});

test("WP-19 · dato ausente no es cero: sin cuota activa o sin TAE ni plazo, la deuda sale de la cuenta y la fecha se dice incompleta", () => {
  const ok = contract({ id: "ok" });
  const suspended = contract({ id: "susp", paymentStatus: "suspended", currentPayment: 0, currentPrincipal: 800 });
  const noRate = contract({ id: "sinTae", apr: null, remainingInstallments: 0 });
  const result = run([ok, suspended, noRate]);
  assert.equal(result.included.length, 1);
  assert.deepEqual(result.excluded.map((row) => [row.id, row.reason]).sort(), [["sinTae", "sin-tae-ni-plazo"], ["susp", "sin-cuota-activa"]]);
  assert.equal(result.complete, false);
  assert.equal(result.excludedPrincipal, 2000);
  assert.equal(result.debtFreeMonthKey, "2027-09", "la fecha es la de lo que sí se puede calcular");
  const settled = run([contract({ id: "z", currentPrincipal: 0 })]);
  assert.equal(settled.included.length, 0);
  assert.equal(settled.excluded.length, 0, "una deuda saldada no es un dato ausente");
  assert.equal(settled.debtFreeMonthKey, null);
  assert.equal(settled.nothingToProject, true);
});

test("WP-19 · sin TAE pero con plazo: se deduce el tipo implícito de capital, cuota y plazo y se marca como deducido", () => {
  const plan = contract({ id: "plan", currentPrincipal: 6000, currentPayment: 180, apr: null, remainingInstallments: 36 });
  const result = run([plan]);
  const row = result.included[0];
  assert.equal(row.rateSource, "implied");
  assert.equal(result.monthsToDebtFree, 36, "reproduce exactamente su propio plazo declarado");
  assert.ok(Math.abs(result.totalInterest - (180 * 36 - 6000)) < 1, `intereses ${result.totalInterest} ≈ 480`);
  assert.equal(engine.project([contract({ currentPrincipal: 6000, currentPayment: 100, apr: null, remainingInstallments: 36 })], { startMonthKey: START }).excluded[0].reason, "plazo-incoherente", "cuota × plazo no llega al capital");
  assert.equal(run([contract({ apr: 7 })]).included[0].rateSource, "declared");
});

test("WP-19 · una cuota que no cubre el interés no avanza: sin extra no hay fecha, con extra suficiente sí", () => {
  const stuck = contract({ id: "atascada", currentPrincipal: 10000, currentPayment: 50, apr: 24, remainingInstallments: 0 });
  const base = run([stuck]);
  assert.equal(base.included[0].stalled, true);
  assert.equal(base.included[0].payoffMonthKey, null);
  assert.equal(base.debtFreeMonthKey, null);
  assert.equal(base.beyondHorizon, true);
  assert.ok(run([stuck], { extraMonthly: 400 }).debtFreeMonthKey, "con 400 € más sí acaba");
});

test("WP-19 · «por cada 100 € extra»: años de meses menos e intereses menos frente al calendario actual, y a qué contrato iría", () => {
  const contracts = [contract({ id: "x", currentPrincipal: 5000, currentPayment: 150, apr: 9, remainingInstallments: 40 })];
  const hundred = engine.perHundred(contracts, { startMonthKey: START });
  const direct = run(contracts, { extraMonthly: 100 });
  const base = run(contracts);
  assert.equal(hundred.monthsSaved, base.monthsToDebtFree - direct.monthsToDebtFree);
  assert.equal(hundred.interestSaved, Math.round((base.totalInterest - direct.totalInterest) * 100) / 100);
  assert.equal(hundred.targetId, "x");
  assert.ok(hundred.monthsSaved > 0 && hundred.interestSaved > 0);
  assert.equal(engine.perHundred([], { startMonthKey: START }).monthsSaved, null);
});

test("WP-19 · compara el plazo declarado con el calculado y avisa si no coinciden", () => {
  const consistent = run([contract()]).included[0];
  assert.equal(consistent.declaredGapMonths, 0);
  const off = run([contract({ id: "d", currentPrincipal: 5000, currentPayment: 150, apr: 9, remainingInstallments: 20 })]).included[0];
  assert.ok(off.declaredGapMonths > 3, `la cuota y la TAE dan más meses que el plazo declarado (${off.declaredGapMonths})`);
  assert.equal(run([contract({ remainingInstallments: 0 })]).included[0].declaredGapMonths, null, "sin plazo declarado no hay con qué comparar");
  assert.equal(run([contract()]).hasLargeGap, false);
  assert.equal(run([contract({ currentPrincipal: 5000, currentPayment: 150, apr: 9, remainingInstallments: 20 })]).hasLargeGap, true);
});

test("WP-19 · cuota total = suma de cuotas activas + extra; hitos ordenados y con capital vivo mes a mes", () => {
  const result = run([contract({ id: "a" }), contract({ id: "b", currentPrincipal: 600, currentPayment: 100, remainingInstallments: 6 })], { extraMonthly: 40 });
  assert.equal(result.monthlyPayment, 240);
  const keys = result.milestones.map((m) => m.payoffMonthKey);
  assert.deepEqual(keys, keys.slice().sort());
  assert.equal(result.series[0].monthKey, START);
  assert.ok(result.series[0].balance <= 1800);
  assert.equal(result.series.at(-1).balance, 0);
  for (let i = 1; i < result.series.length; i += 1) assert.ok(result.series[i].balance <= result.series[i - 1].balance + 0.005);
});

test("WP-19 · entradas inválidas: extra negativo o no numérico se rechaza; los datos recibidos no se modifican", () => {
  const input = [contract()];
  const snapshot = JSON.stringify(input);
  assert.equal(run(input, { extraMonthly: -5 }).ok, false);
  assert.equal(run(input, { extraMonthly: "abc" }).ok, false);
  assert.equal(run(input, { extraMonthly: "1,5" }).ok, false, "el motor solo recibe números; la coma se resuelve en la pantalla");
  assert.equal(engine.project(input, { extraMonthly: 0 }).ok, false, "sin mes de partida no se proyecta");
  run(input, { extraMonthly: 50 });
  assert.equal(JSON.stringify(input), snapshot);
});

test("WP-19 · el motor es puro (sin red, sin DOM, sin almacenamiento) y la tarjeta no ejecuta nada (A11-4)", () => {
  assert.doesNotMatch(read("canonical-debt-payoff-path.js"), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|document\.|window\.|localStorage/);
});

test("WP-19 · el desajuste con el plazo declarado se mide contra el calendario sin extra: un extra no lo provoca", () => {
  const ok = [contract({ id: "e", currentPrincipal: 1000, currentPayment: 100, apr: 12, remainingInstallments: 11 })];
  assert.equal(run(ok).hasLargeGap, false);
  const withExtra = run(ok, { extraMonthly: 300 });
  assert.equal(withExtra.hasLargeGap, false, "acortar el plazo a propósito no es un dato incoherente");
  assert.equal(withExtra.included[0].declaredGapMonths, 0);
  assert.equal(withExtra.baseline.monthsToDebtFree, 11);
  assert.ok(withExtra.monthsToDebtFree < withExtra.baseline.monthsToDebtFree);
  assert.equal(run(ok).baseline, null, "sin extra no hay con qué comparar: es el propio calendario");
});
