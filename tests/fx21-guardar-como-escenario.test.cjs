// FX-21 · «Guardar como escenario»: la prueba de estrés de la Previsión nueva pasa a Escenarios con los tipos de fábrica y,
// recalculada allí, da los mismos meses que la prueba. Cifras INVENTADAS: ninguna sale del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const S = require("../canonical-stress-scenarios.js");
const engine = require("../canonical-engine.js");
const scenarioEngine = require("../canonical-scenario-engine.js");
const schema = require("../canonical-scenario-schema.js");
const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");

const hoy = "2026-11-07";
function mes(monthKey, { paga = 0 } = {}) {
  const nomina = 2100 + paga;
  return {
    month: monthKey, monthKey, income: nomina + 900, coreSpend: 2000, variableOperationalSpend: 600, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0,
    incomeEvents: [{ concept: "Nómina INVENTADA", amount: nomina, date: `${monthKey}-25` }, { concept: "Otro sueldo INVENTADO", amount: 900, date: `${monthKey}-28` }],
    expenseEvents: [],
  };
}
function input() {
  return {
    openingBalances: { checking: 4000, savings: 6000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 300, autoCapSavings: true },
    months: [mes("2026-11"), mes("2026-12", { paga: 2100 }), mes("2027-01"), mes("2027-02"), mes("2027-03"), mes("2027-04"), mes("2027-05")],
  };
}
let seq = 0;
const conId = (decisions) => decisions.map((decision, orden) => ({ ...decision, id: `dec_${String(seq++).padStart(26, "0")}`, orden }));

/** Lo que da Escenarios con esas decisiones frente a lo que da la prueba con el motor mensual. */
function paridad(base, cambiado, decisions) {
  const prueba = engine.buildRows(cambiado);
  const escenario = scenarioEngine.resolveEscenario(conId(decisions), { baseInput: base, debtContracts: [] });
  assert.equal(escenario.valid, true);
  escenario.resultados.forEach((item) => assert.equal(item.resultado, "aplicada", `${item.tipo}: se aplica en Escenarios`));
  assert.equal(escenario.series.length, prueba.length);
  escenario.series.forEach((row, index) => {
    assert.equal(row.checking, prueba[index].checking, `${row.detailMonthKey || index}: la misma cuenta corriente`);
    assert.equal(row.totalLiquidity, prueba[index].totalLiquidity, `${row.detailMonthKey || index}: la misma liquidez`);
  });
}

function validas(decisions) {
  conId(decisions).forEach((decision) => {
    const issues = [];
    schema.validateDecision(decision, "$", issues);
    assert.deepEqual(issues.filter((issue) => issue.severity === "error"), [], `${decision.tipo} pasa el esquema de Escenarios`);
  });
}

test("FX-21 · un sueldo menos pasa como «Cambio de ingreso» por tramos: la paga extra no se promedia", () => {
  const base = input();
  const changed = S.applySueldoMenos(base, { today: hoy, months: 3, concept: "Nómina INVENTADA" });
  const decisions = S.toDecisions({ preset: { id: "sueldo-menos" }, applied: true, info: changed.info }, base);
  assert.deepEqual(decisions.map((d) => [d.tipo, d.params.deltaMensual, d.params.mesInicio, d.params.mesFin]), [
    ["cambio_ingreso", -2100, "2026-11", "2026-11"],
    ["cambio_ingreso", -4200, "2026-12", "2026-12"],
    ["cambio_ingreso", -2100, "2027-01", "2027-01"],
  ]);
  decisions.forEach((d) => {
    assert.equal(d.titulo, "Sin «Nómina INVENTADA»");
    assert.deepEqual(d.planificacion, { modo: "manual", mesManual: d.params.mesInicio }, "el mes fijado: «óptimo» lo movería");
  });
  validas(decisions);
  paridad(base, changed.input, decisions);
  // Seis meses: los tramos de igual importe seguidos se juntan en uno.
  const seis = S.applySueldoMenos(base, { today: hoy, months: 6, concept: "Nómina INVENTADA" });
  const juntos = S.toDecisions({ preset: { id: "sueldo-menos" }, applied: true, info: seis.info }, base);
  assert.deepEqual(juntos.map((d) => [d.params.mesInicio, d.params.mesFin]), [["2026-11", "2026-11"], ["2026-12", "2026-12"], ["2027-01", "2027-04"]]);
  paridad(base, seis.input, juntos);
});

test("FX-21 · el Euribor pasa como «Cambio de gasto» de la cuota, de la revisión a su último plazo dentro del plan", () => {
  const base = input();
  const shocks = [{ date: "2027-02-01", from: 700, to: 812.4, extra: 112.4, rate: 4.1, months: 300 }, { date: "2027-02-01", from: 300, to: 290, extra: -10, rate: 4.1, months: 100 }];
  const changed = S.applyEuribor(base, { shocks });
  const decisions = S.toDecisions({ preset: { id: "euribor" }, applied: true, info: changed.info }, base);
  assert.equal(decisions.length, 1, "si la cuota no sube no hay nada que guardar");
  assert.deepEqual(decisions[0].params, { bloque: "Cuota de la hipoteca", deltaMensual: 112.4, mesInicio: "2027-02", mesFin: "2027-05" });
  assert.equal(decisions[0].titulo, "Hipoteca: cuota de 700 € a 812 €");
  validas(decisions);
  paridad(base, changed.input, decisions);
  // Una revisión fuera del plan no deja nada que guardar.
  assert.deepEqual(S.toDecisions({ preset: { id: "euribor" }, applied: true, info: { shocks: [{ ...shocks[0], date: "2028-02-01" }] } }, base), []);
});

test("FX-21 · el imprevisto pasa como «Imprevisto» del mismo importe en su mes", () => {
  const base = input();
  const changed = S.applyImprevisto(base, { date: "2027-01-24", amount: 6000 });
  const decisions = S.toDecisions({ preset: { id: "imprevisto" }, applied: true, info: changed.info }, base);
  assert.deepEqual(decisions.map((d) => [d.tipo, d.titulo, d.params]), [["imprevisto", "Imprevisto de 6.000 €", { importe: 6000, mes: "2027-01" }]]);
  validas(decisions);
  paridad(base, changed.input, decisions);
  // Sin prueba aplicada no hay nada que guardar.
  assert.deepEqual(S.toDecisions({ preset: { id: "imprevisto" }, applied: false }, base), []);
  assert.deepEqual(S.toDecisions(null, base), []);
});

test("FX-21 · cableado: la Previsión nueva guarda en Escenarios › Guardados sin aplicar nada y respeta los diez vivos", () => {
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /function previsionV2GuardarEscenario\(/);
  assert.match(vista, /S\.toDecisions\(result, input\)/);
  assert.match(vista, /data-prevision-v2-guardar/);
  // Se valida contra el esquema de Escenarios antes de guardar, como cualquier decisión.
  assert.match(vista, /validateDecision\(decision, "\$", issues\)/);
  // El mismo almacén que Deuda › Comparar y la pantalla de Escenarios, con estado «guardado» (no se aplica nada).
  assert.match(vista, /saveEscenarioMotorSavedList\(/);
  assert.match(vista, /estado: "guardado"/);
  // E-11b: diez escenarios vivos como máximo.
  assert.match(vista, /filter\(\(entry\) => !entry\.archived\)\.length >= 10/);
  // La misma prueba no se guarda dos veces.
  assert.match(vista, /entry\.firma === firma/);
});
