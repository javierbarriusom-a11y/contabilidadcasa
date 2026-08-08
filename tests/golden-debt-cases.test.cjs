const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const legacy = require("../legacy-debt-roadmap-engine.js");
const parity = require("../canonical-e14-parity.js");
const comparator = require("../canonical-debt-comparator.js");

const CASOS_DIR = path.join(__dirname, "golden", "casos");
const ESPERADOS_DIR = path.join(__dirname, "golden", "esperados");
const CASE_IDS = ["C001", "C002", "C003", "C004", "C005", "C006", "C007", "C008", "C009", "C010"];
const TOLERANCIA = 0.01;

function loadCaso(id) {
  return JSON.parse(fs.readFileSync(path.join(CASOS_DIR, `${id}.json`), "utf8"));
}

function loadEsperado(id) {
  return JSON.parse(fs.readFileSync(path.join(ESPERADOS_DIR, `${id}.expected.json`), "utf8"));
}

function close(actual, expected, label) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= TOLERANCIA, `${label}: ${actual} != ${expected} (tolerancia ${TOLERANCIA})`);
}

test("T-META-02 · los 10 casos C001-C010 existen y declaran un estado válido", () => {
  CASE_IDS.forEach((id) => {
    const caso = loadCaso(id);
    assert.equal(caso.id, id);
    assert.ok(["computable", "gap_funcional"].includes(caso.estado), `${id}: estado desconocido «${caso.estado}»`);
    const esperadoFile = path.join(ESPERADOS_DIR, `${id}.expected.json`);
    if (caso.estado === "computable") {
      assert.ok(fs.existsSync(esperadoFile), `${id} es computable y debería tener esperado`);
    } else {
      assert.ok(!fs.existsSync(esperadoFile), `${id} es un hueco funcional y no debería tener esperado`);
      assert.ok(caso.motivo && caso.motivo.length > 0, `${id}: un hueco funcional debe documentar su motivo`);
    }
  });
});

test("los casos computables reproducen exactamente su KPI dorado contra legacy-debt-roadmap-engine", () => {
  CASE_IDS.filter((id) => loadCaso(id).estado === "computable").forEach((id) => {
    const caso = loadCaso(id);
    const esperado = loadEsperado(id);
    const result = legacy.simulate(caso.entrada);
    close(result.totalPaid, esperado.kpisEsperados.totalPaid, `${id}.totalPaid`);
    close(result.totalLump, esperado.kpisEsperados.totalLump, `${id}.totalLump`);
    close(result.peak, esperado.kpisEsperados.peak, `${id}.peak`);
    assert.equal(result.durationMonths, esperado.kpisEsperados.durationMonths, `${id}.durationMonths`);
  });
});

test("los casos computables mantienen paridad legado vs. canónico dentro de la tolerancia de E14", () => {
  CASE_IDS.filter((id) => loadCaso(id).estado === "computable").forEach((id) => {
    const caso = loadCaso(id);
    const esperado = loadEsperado(id);
    const result = parity.compare(caso.entrada, TOLERANCIA);
    assert.equal(result.valid, esperado.paridadLegadoVsCanonico.valid, `${id}: ${JSON.stringify(result.differences)}`);
    assert.deepEqual(result.differences, esperado.paridadLegadoVsCanonico.differences, id);
  });
});

test("C001 · amortización total cierra la deuda y libera la cuota en el mes indicado", () => {
  const caso = loadCaso("C001");
  const result = legacy.simulate(caso.entrada);
  assert.equal(result.durationMonths, 6);
  assert.equal(result.rows[result.rows.length - 1].balances[0], 0);
});

test("C002 · amortización parcial reduce el coste total sin cerrar la deuda", () => {
  const caso = loadCaso("C002");
  const conAmortizacion = legacy.simulate(caso.entrada);
  const sinAmortizar = legacy.simulate({
    baseMonth: "2026-08", months: 46, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 9.5, term: 46, financePct: 100 }],
  });
  assert.ok(conAmortizacion.totalPaid < sinAmortizar.totalPaid, "la amortización parcial debería reducir el coste total");
  assert.ok(conAmortizacion.rows[5].balances[0] > 0, "la deuda no debe cerrarse en el propio mes de la amortización parcial (mes 6)");
  assert.equal(conAmortizacion.rows[conAmortizacion.rows.length - 1].balances[0], 0, "la deuda sí debe quedar en 0 al final de su cuadro recortado");
});

test("C006 · alargar el plazo baja la cuota pero sube el coste total (caso contraintuitivo)", () => {
  const original = legacy.simulate({
    baseMonth: "2026-08", months: 60, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 9.5, term: 46, financePct: 100 }],
  });
  const alargado = legacy.simulate({
    baseMonth: "2026-08", months: 90, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 9.5, term: 72, financePct: 100 }],
  });
  assert.ok(alargado.peak < original.peak, "la cuota mensual debería bajar al alargar el plazo");
  assert.ok(alargado.totalPaid > original.totalPaid, "el coste total debería subir al alargar el plazo");
});

test("C008 · canonical-debt-comparator recomienda la quita cuando respeta la reserva", () => {
  const caso = loadCaso("C008");
  const esperado = loadEsperado("C008");
  const result = comparator.compareAgreements({
    contractId: "d2-entidad-b",
    principal: 5600,
    reserve: 3000,
    alternatives: [{
      id: "quita-pactada",
      strategy: "settlement",
      label: "Quita pactada",
      totalCost: esperado.kpisEsperados.totalPaid,
      remainingDebt: 0,
      minChecking: 3400,
      closeIndex: 3,
    }],
  });
  assert.equal(result.recommendedId, "quita-pactada");
  assert.equal(result.recommended.reserveSafe, true);
});

test("C009 · una deuda sin TIN no hace fallar al motor y su coste financiero es cero", () => {
  const caso = loadCaso("C009");
  const result = legacy.simulate(caso.entrada);
  assert.equal(result.totalPaid, 2400, "sin interés, el total pagado debe ser exactamente el principal");
});

test("C010 · subir el tipo variable nunca reduce el coste total (evidencia real de I-08)", () => {
  const base = legacy.simulate({
    baseMonth: "2026-08", months: 46, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 9.5, term: 46, financePct: 100 }],
  });
  const conDelta = legacy.simulate(loadCaso("C010").entrada);
  assert.ok(conDelta.totalPaid > base.totalPaid, "un TIN más alto debería aumentar el coste total, nunca reducirlo");
});

test("C003 y C004 quedan documentados como hueco funcional, no como caso inventado", () => {
  ["C003", "C004"].forEach((id) => {
    const caso = loadCaso(id);
    assert.equal(caso.estado, "gap_funcional");
    assert.ok(caso.motoresConsultados.length >= 2, `${id}: debe declarar qué motores se consultaron antes de concluir que no lo cubren`);
  });
});

test("C005 · el motor legado no modela reunificación de varias deudas en una", () => {
  const caso = loadCaso("C005");
  assert.equal(caso.estado, "gap_funcional");
  assert.match(caso.motivo, /reunificacion/i);
});
