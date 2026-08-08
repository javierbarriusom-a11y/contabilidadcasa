const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = require("../canonical-engine.js");
const debtContracts = require("../canonical-debt-contracts.js");

const DATASETS_DIR = path.join(__dirname, "golden", "datasets");
const FORBIDDEN_TERMS = ["CaixaBank", "Mediolanum", "Javi", "Tere", "Wizink", "Cetelem", "Cofidis"];

function loadDataset(id) {
  const file = path.join(DATASETS_DIR, `${id}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const DATASET_IDS = ["D1-hogar-base", "D2-hogar-apalancado", "D3-hogar-holgado"];

test("los tres datasets D1-D3 existen y declaran su versión y horizonte", () => {
  DATASET_IDS.forEach((id) => {
    const data = loadDataset(id);
    assert.equal(data.id, id);
    assert.equal(data.synthetic, true);
    assert.equal(data.horizonteMeses, 120);
    assert.equal(data.engineInput.months.length, 120);
  });
});

test("ningún dataset contiene nombres reales de entidades o titulares (privacidad, doc §5.1)", () => {
  DATASET_IDS.forEach((id) => {
    const raw = fs.readFileSync(path.join(DATASETS_DIR, `${id}.json`), "utf8");
    FORBIDDEN_TERMS.forEach((term) => {
      assert.ok(!raw.includes(term), `${id} contiene el término no anonimizado «${term}»`);
    });
  });
});

test("los meses de cada dataset son consecutivos y sin huecos", () => {
  DATASET_IDS.forEach((id) => {
    const { months } = loadDataset(id).engineInput;
    for (let index = 1; index < months.length; index += 1) {
      const [prevYear, prevMonth] = months[index - 1].monthKey.split("-").map(Number);
      const [year, month] = months[index].monthKey.split("-").map(Number);
      const expected = prevMonth === 12 ? { year: prevYear + 1, month: 1 } : { year: prevYear, month: prevMonth + 1 };
      assert.equal(year, expected.year, `${id}[${index}] salto de año inesperado`);
      assert.equal(month, expected.month, `${id}[${index}] salto de mes inesperado`);
    }
  });
});

test("cada dataset se ejecuta contra canonical-engine.js sin romper conservación de caja (I-02/I-03)", () => {
  DATASET_IDS.forEach((id) => {
    const data = loadDataset(id);
    const scenario = engine.buildScenario(data.engineInput, null, { generatedAt: data.generatedAt });
    assert.equal(scenario.invariants.valid, true, `${id}: ${JSON.stringify(scenario.invariants.issues)}`);
    assert.equal(scenario.invariants.checks.accountConservation, true);
    assert.equal(scenario.invariants.checks.continuity, true);
  });
});

test("las deudas de cada dataset validan contra canonical-debt-contracts.js sin errores", () => {
  DATASET_IDS.forEach((id) => {
    const data = loadDataset(id);
    const { quality } = debtContracts.normalizeContracts(data.debtContracts);
    assert.equal(quality.valid, true, `${id}: ${JSON.stringify(quality.issues)}`);
  });
});

test("D1 · hogar-base sirve su deuda sin romper la reserva operativa objetivo", () => {
  const data = loadDataset("D1-hogar-base");
  const scenario = engine.buildScenario(data.engineInput, null, { generatedAt: data.generatedAt });
  const minChecking = Math.min(...scenario.rows.map((row) => row.checking));
  assert.ok(minChecking >= 0, `El saldo operativo de D1 llega a ${minChecking}, no debería ser negativo`);
  assert.equal(data.debtContracts.length, 2);
});

test("D2 · hogar-apalancado arranca con menos de dos meses de colchón y cuatro deudas activas", () => {
  const data = loadDataset("D2-hogar-apalancado");
  assert.equal(data.debtContracts.length, 4);
  const openingLiquidity = data.engineInput.openingBalances.checking + data.engineInput.openingBalances.savings;
  const firstMonth = data.engineInput.months[0];
  const nonDebtSpend = firstMonth.coreSpend;
  assert.ok(openingLiquidity / nonDebtSpend < 2, `El colchón inicial de D2 cubre ${(openingLiquidity / nonDebtSpend).toFixed(2)} meses, debería ser < 2`);
});

test("D3 · hogar-holgado no tiene deuda viva y mantiene superávit todos los meses", () => {
  const data = loadDataset("D3-hogar-holgado");
  assert.equal(data.debtContracts.length, 0);
  const scenario = engine.buildScenario(data.engineInput, null, { generatedAt: data.generatedAt });
  const monthsInDeficit = scenario.rows.filter((row) => row.income - row.outflowsBeforeSaving < 0);
  assert.equal(monthsInDeficit.length, 0, "D3 no debería tener ningún mes con margen negativo antes de ahorrar");
});
