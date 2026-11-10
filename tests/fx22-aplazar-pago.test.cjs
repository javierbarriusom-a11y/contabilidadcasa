// FX-22 PR-2 (10/11/2026) · «¿Y si…?» con un pago aplazado: un cargo del plan se mueve 1, 2 o 3 meses al mismo día; sale de su mes por
// su partida y entra en el de destino. Guardado, Escenarios da los mismos meses con dos «Cambio de gasto». Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../canonical-stress-scenarios.js");
const engine = require("../canonical-engine.js");
const scenarioEngine = require("../canonical-scenario-engine.js");
const schema = require("../canonical-scenario-schema.js");

function mes(monthKey) {
  return {
    month: monthKey, monthKey, income: 3000, coreSpend: 2000, variableOperationalSpend: 600, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0,
    mainPayrollDate: `${monthKey}-25`,
    incomeEvents: [{ concept: "Nómina INVENTADA", amount: 3000, date: `${monthKey}-25` }],
    expenseEvents: [
      { concept: "Seguro INVENTADO", amount: 900, field: "fixedCoreSpend", date: `${monthKey}-31`.replace("-11-31", "-11-30") },
      { concept: "Gasto variable estimado", amount: 600, field: "variableOperationalSpend", date: `${monthKey}-08` },
    ],
  };
}
function input() {
  const base = {
    openingBalances: { checking: 4000, savings: 6000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 300, autoCapSavings: true },
    months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"].map(mes),
  };
  base.months[1].refi = 250;
  base.months[1].expenseEvents.push({ concept: "Préstamo INVENTADO", amount: 250, field: "refi", date: "2026-12-05" });
  base.months[2].projectOutflow = 1500;
  return base;
}
let seq = 0;
const conId = (decisions) => decisions.map((decision, orden) => ({ ...decision, id: `dec_${String(seq++).padStart(26, "0")}`, orden }));

test("FX-22 · los pagos que se pueden aplazar: fechados, sin el gasto variable, del mayor al menor, con el proyecto el día de la nómina", () => {
  const pagos = S.pagosAplazables(input(), { from: "2026-11-15", to: "2027-01-31" });
  assert.deepEqual(pagos.map((pago) => [pago.concept, pago.date, pago.amount]), [
    ["Proyecto o decisión", "2027-01-25", 1500],
    ["Seguro INVENTADO", "2026-11-30", 900],
    ["Seguro INVENTADO", "2026-12-31", 900],
    ["Seguro INVENTADO", "2027-01-31", 900],
    ["Préstamo INVENTADO", "2026-12-05", 250],
  ]);
  assert.equal(S.pagosAplazables(input(), { from: "2026-11-15", to: "2027-01-31", minAmount: 300 }).length, 4, "con el umbral, sin el de 250 €");
});

test("FX-22 · aplazar sale de su mes por su partida y entra en el de destino el mismo día; guardado, Escenarios da los mismos meses", () => {
  const base = input();
  const seguro = S.pagosAplazables(base, { from: "2026-12-01", to: "2026-12-31" }).find((pago) => pago.concept === "Seguro INVENTADO");
  const changed = S.applyYSi(base, { aplazar: { key: seguro.key, months: 2 } });
  assert.equal(changed.applied, true);
  assert.deepEqual(changed.info, { aplazar: { concept: "Seguro INVENTADO", amount: 900, from: "2026-12-31", to: "2027-02-28", months: 2, field: "fixedCoreSpend" } });
  assert.deepEqual(changed.input.months.map((month) => month.coreSpend), [2000, 1100, 2000, 2900, 2000, 2000], "el 31 dic pasa al 28 feb");
  assert.equal(changed.input.months[1].expenseEvents.some((event) => event.concept === "Seguro INVENTADO"), false);
  assert.deepEqual(changed.input.months[3].expenseEvents.at(-1), { concept: "Seguro INVENTADO (aplazado)", amount: 900, field: "fixedCoreSpend", day: 28, date: "2027-02-28", source: "¿y si…? · aplazado", confidence: "rule", role: "" });
  assert.equal(base.months[1].coreSpend, 2000, "la entrada del plan no se toca");
  const decisions = S.toDecisions({ preset: S.YSI, applied: true, info: changed.info }, base);
  assert.deepEqual(decisions.map((d) => [d.tipo, d.params.mesInicio, d.params.deltaMensual, d.params.mesFin]), [
    ["cambio_gasto", "2026-12", -900, "2026-12"],
    ["cambio_gasto", "2027-02", 900, "2027-02"],
  ]);
  const prueba = engine.buildRows(changed.input);
  const escenario = scenarioEngine.resolveEscenario(conId(decisions), { baseInput: base, debtContracts: [] });
  assert.equal(escenario.valid, true);
  escenario.series.forEach((row, index) => assert.equal(row.totalLiquidity, prueba[index].totalLiquidity, `${index}: la misma liquidez`));
  conId(decisions).forEach((decision) => {
    const issues = [];
    schema.validateDecision(decision, "$", issues);
    assert.deepEqual(issues.filter((issue) => issue.severity === "error"), [], "pasa el esquema");
  });
});

test("FX-22 · aplazar una financiación o un proyecto: sale de su partida; con otra palanca se suman; fuera del plan no se aplica", () => {
  const base = input();
  const refi = S.applyAplazar(base, { key: "2026-12-05|refi|Préstamo INVENTADO", months: 1 });
  assert.equal(refi.applied, true);
  assert.equal(refi.input.months[1].refi, 0);
  assert.equal(refi.input.months[2].coreSpend, 2250);
  const proyecto = S.applyAplazar(base, { key: "2027-01-25|projectOutflow|", months: 3 });
  assert.deepEqual([proyecto.input.months[2].projectOutflow, proyecto.input.months[5].coreSpend, proyecto.info.to], [0, 3500, "2027-04-25"]);
  // Las dos palancas: el gasto único y el aplazado, en el mismo motor.
  const juntas = S.applyYSi(base, { unico: { amount: 500, date: "2027-01-10" }, aplazar: { key: "2026-12-05|refi|Préstamo INVENTADO", months: 1 } });
  assert.equal(juntas.input.months[2].coreSpend, 2750);
  assert.equal(S.toDecisions({ preset: S.YSI, applied: true, info: juntas.info }, base).length, 3);
  // El destino fuera del plan (abr 2027 + 3 meses), un pago que no existe o el gasto variable: nada.
  assert.equal(S.applyAplazar(base, { key: "2027-04-30|fixedCoreSpend|Seguro INVENTADO", months: 3 }).applied, false);
  assert.equal(S.applyAplazar(base, { key: "2026-12-31|fixedCoreSpend|No existe", months: 1 }).applied, false);
  assert.equal(S.applyAplazar(base, { key: "2026-12-08|variableOperationalSpend|Gasto variable estimado", months: 1 }).applied, false);
  assert.deepEqual(S.applyYSi(base, { aplazar: { key: "nada" } }).missing, ["un importe o un pago que aplazar en alguna de las palancas"]);
});

test("FX-22 · la vista: la frase del pago aplazado, sin veredicto si solo se aplaza, y los atajos del panel del día", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: () => null, setItem() {} },
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    FinanceCanonicalForecastContract: require("../canonical-forecast-contract.js"),
    FinanceCanonicalStressScenarios: S,
    state: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "views/prevision-v2.js"), "utf8"), sandbox);
  const info = { aplazar: { concept: "Seguro INVENTADO", amount: 900, from: "2026-12-31", to: "2027-02-28", months: 2 } };
  assert.equal(sandbox.previsionV2YSiTexto(info, "2026-11-10").join(" y "), "«Seguro INVENTADO» (900 €) aplazado del 31 dic al 28 feb 2027");
  const solo = { preset: S.YSI, info };
  assert.equal(sandbox.previsionV2Veredicto(solo, { crossesFloor: false }, false), "", "aplazar no es un gasto que permitirse");
  assert.equal(sandbox.previsionV2Veredicto({ preset: S.YSI, info: { ...info, unico: { amount: 1, date: "2026-12-01" } } }, { crossesFloor: false }, false), "Sí, os lo podéis permitir. ");
  // Los atajos del panel del día, en una línea: un gasto ese día (desde mañana) y aplazar el pago mayor que se pueda aplazar.
  vm.runInContext(`previsionV2Aplazables = () => [{ key: "2026-12-31|fixedCoreSpend|Seguro INVENTADO" }];`, sandbox);
  const eventos = [
    { kind: "outflow", field: "variableOperationalSpend", label: "Gasto variable estimado", amount: 1200 },
    { kind: "outflow", field: "fixedCoreSpend", label: "Seguro INVENTADO", amount: 900 },
  ];
  assert.equal(sandbox.previsionV2AtajosDiaHtml(eventos, "2026-12-31", "2026-11-10"), '<p class="e19-kpi-note prev-v2-dia-atajos">¿Y si…? <button type="button" class="hoy-v2-link" data-prevision-v2-ysi-dia="2026-12-31">un gasto este día</button> · <button type="button" class="hoy-v2-link" data-prevision-v2-aplazar="2026-12-31|fixedCoreSpend|Seguro INVENTADO" aria-label="Aplazar un pago de este día: Seguro INVENTADO">aplazar un pago</button></p>');
  assert.doesNotMatch(sandbox.previsionV2AtajosDiaHtml(eventos, "2026-11-10", "2026-11-10"), /un gasto este día/, "hoy no: el gasto único es desde mañana");
  assert.equal(sandbox.previsionV2AtajosDiaHtml(eventos.slice(0, 1), "2026-11-10", "2026-11-10"), "", "sin pago que aplazar ni día futuro, nada");
  assert.equal(sandbox.previsionV2ClaveDia({ field: "projectOutflow", label: "Proyecto o decisión", date: "2027-01-25" }, "x"), "2027-01-25|projectOutflow|");
});
