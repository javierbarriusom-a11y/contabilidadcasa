const test = require("node:test");
const assert = require("node:assert/strict");
const Cushion = require("../canonical-cushion.js");

// F1 · Cimientos: "colchón por mes" y "peor mes" vivían como lógica de vista embebida en
// mapaCalorFloor/mapaCalorTone/renderMapaCalor (app.js). Este módulo las extrae como cálculo puro
// y compartido -- sin DOM, sin estado global -- para que Hoy, Plan y Análisis lean la misma
// función en vez de reimplementarla cada una a su manera.

test("cushionFloor · con reserva operativa configurada, el suelo es la reserva", () => {
  const floor = Cushion.cushionFloor([{ coreSpend: 900 }], 1200);
  assert.equal(floor.value, 1200);
  assert.equal(floor.basis, "operating-reserve");
  assert.equal(floor.basisValue, 1200);
});

test("cushionFloor · sin reserva, el suelo es un mes de salidas del primer mes del horizonte", () => {
  const floor = Cushion.cushionFloor([{ coreSpend: 500, car: 120, refi: 30 }], 0);
  assert.equal(floor.basis, "one-month-outflow");
  assert.equal(floor.basisValue, 650);
  assert.equal(floor.value, 650);
});

test("cushionFloor · sin reserva y sin filas, el suelo nunca baja de 1 (evita dividir tonos por cero)", () => {
  const floor = Cushion.cushionFloor([], 0);
  assert.equal(floor.basis, "one-month-outflow");
  assert.equal(floor.basisValue, 0);
  assert.equal(floor.value, 1);
});

test("cushionTone · negativo, por debajo del suelo, holgado y muy holgado, en los cuatro tramos", () => {
  assert.equal(Cushion.cushionTone(-5, 1000), "is-negative");
  assert.equal(Cushion.cushionTone(500, 1000), "is-tight");
  assert.equal(Cushion.cushionTone(1500, 1000), "is-ok");
  assert.equal(Cushion.cushionTone(3500, 1000), "is-good");
});

test("cushionTone · los límites de tramo son estrictos: justo en el suelo ya no es \"tight\"", () => {
  assert.equal(Cushion.cushionTone(1000, 1000), "is-ok");
  assert.equal(Cushion.cushionTone(3000, 1000), "is-good");
});

test("worstMonthOf · encuentra el mes con menor liquidez, no el primero ni el último", () => {
  const rows = [
    { detailMonthKey: "2026-09", totalLiquidity: 1800 },
    { detailMonthKey: "2026-10", totalLiquidity: 400 },
    { detailMonthKey: "2026-11", totalLiquidity: 900 },
  ];
  const worst = Cushion.worstMonthOf(rows);
  assert.equal(worst.key, "2026-10");
  assert.equal(worst.value, 400);
  assert.equal(worst.row, rows[1]);
});

test("worstMonthOf · sin filas, no hay peor mes que inventar", () => {
  assert.equal(Cushion.worstMonthOf([]), null);
  assert.equal(Cushion.worstMonthOf(null), null);
});

test("cushionLevel · negativo, ajustado y holgado, en los tres tramos (P-9/A-2)", () => {
  assert.equal(Cushion.cushionLevel(-5, 1000), "negativo");
  assert.equal(Cushion.cushionLevel(500, 1000), "ajustado");
  assert.equal(Cushion.cushionLevel(3500, 1000), "holgado");
});

test("cushionLevel · el límite es estricto: justo en el suelo ya es \"holgado\"", () => {
  assert.equal(Cushion.cushionLevel(1000, 1000), "holgado");
});

test("worstMonthOf · admite nombres de campo distintos, para reutilizarse con otros horizontes", () => {
  const rows = [
    { month: "2026-01", liquidity: 200 },
    { month: "2026-02", liquidity: 50 },
  ];
  const worst = Cushion.worstMonthOf(rows, { liquidityField: "liquidity", monthKeyField: "month" });
  assert.equal(worst.key, "2026-02");
  assert.equal(worst.value, 50);
});

// TT1 · Bloque 1: reparto del colchón entre corriente (acceso inmediato) y remunerado (rendimiento).
// Reutiliza el mismo cálculo de salidas mensuales que cushionFloor, no un umbral aparte.

test("cushionAccountSplit · deja en corriente solo los días de acceso inmediato, el resto va a remunerado", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }]; // 900/mes -> 30/día
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 7 });
  assert.equal(split.total, 3000);
  assert.equal(split.instantAccessAmount, 210); // 30 * 7
  assert.equal(split.corriente, 210);
  assert.equal(split.remunerado, 2790);
});

test("cushionAccountSplit · el colchón nunca llega a cubrir ni el acceso inmediato: todo se queda en corriente", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(100, rows, { instantAccessDays: 7 });
  assert.equal(split.corriente, 100);
  assert.equal(split.remunerado, 0);
});

test("cushionAccountSplit · admite un número de días de acceso inmediato distinto del valor por defecto", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 14 });
  assert.equal(split.instantAccessAmount, 420); // 30 * 14
  assert.equal(split.corriente, 420);
  assert.equal(split.remunerado, 2580);
});

test("cushionAccountSplit · por defecto usa 7 días de acceso inmediato", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(3000, rows);
  assert.equal(split.instantAccessDays, 7);
  assert.equal(split.instantAccessAmount, 210);
});

test("cushionAccountSplit · sin salidas conocidas (sin filas), el acceso inmediato es cero y todo va a remunerado", () => {
  const split = Cushion.cushionAccountSplit(1000, []);
  assert.equal(split.instantAccessAmount, 0);
  assert.equal(split.corriente, 0);
  assert.equal(split.remunerado, 1000);
});

test("cushionAccountSplit · un total negativo o inválido no reparte de más: se trata como cero", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(-500, rows);
  assert.equal(split.total, 0);
  assert.equal(split.corriente, 0);
  assert.equal(split.remunerado, 0);
});

test("cushionAccountSplit · ignora una reserva operativa configurada: usa siempre las salidas mensuales para el acceso inmediato", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  // cushionFloor con reserva devolvería basis "operating-reserve"; cushionAccountSplit no debe heredarlo.
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 7 });
  assert.equal(split.instantAccessAmount, 210);
});

// TT5 · Bloque 1: el suelo del colchón (reserva operativa) como parámetro vivo — cushionFloorDrift
// no cambia cushionFloor, solo compara el número fijo configurado con lo que el gasto real actual
// sugeriría ahora mismo.

test("cushionFloorDrift · sin reserva configurada, no hay nada que comparar", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(0, rows);
  assert.equal(drift.configured, 0);
  assert.equal(drift.live, 900);
  assert.equal(drift.driftRatio, null);
  assert.equal(drift.stale, false);
});

test("cushionFloorDrift · reserva alineada con el gasto real actual: no está desfasada", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(950, rows); // ~5.6% de diferencia
  assert.equal(drift.configured, 950);
  assert.equal(drift.live, 900);
  assert.equal(drift.stale, false);
});

test("cushionFloorDrift · reserva muy por debajo del gasto real actual: desfasada (stale)", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(600, rows); // -33%
  assert.equal(drift.driftRatio, -0.33);
  assert.equal(drift.stale, true);
});

test("cushionFloorDrift · reserva muy por encima del gasto real actual: también desfasada", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(1500, rows); // +67%
  assert.equal(drift.driftRatio, 0.67);
  assert.equal(drift.stale, true);
});

test("cushionFloorDrift · el umbral del 20% es el límite exacto: justo en el 20% ya cuenta como desfasada", () => {
  const rows = [{ coreSpend: 1000, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(1200, rows); // exactamente +20%
  assert.equal(drift.driftRatio, 0.2);
  assert.equal(drift.stale, true);
  assert.equal(Cushion.CUSHION_DRIFT_THRESHOLD, 0.2);
});

test("cushionFloorDrift · sin gasto real conocido (sin filas) y con reserva configurada, no divide por cero", () => {
  const drift = Cushion.cushionFloorDrift(500, []);
  assert.equal(drift.live, 0);
  assert.equal(drift.driftRatio, null);
  assert.equal(drift.stale, false);
});

// SP5 · Bloque 2: la mayor franquicia habitual que la holgura del colchón (lo que sobra por encima
// del suelo protegido, no el colchón entero) podría absorber sin caer por debajo de ese suelo.

test("optimalDeductibleFor · con holgura de sobra, la óptima es la mayor de las opciones habituales", () => {
  const result = Cushion.optimalDeductibleFor(3000, 1000, [150, 300, 500, 1000]);
  assert.equal(result.slack, 2000);
  assert.equal(result.optimal, 1000);
  assert.deepEqual(result.affordable, [150, 300, 500, 1000]);
});

test("optimalDeductibleFor · con holgura ajustada, solo caben las franquicias más bajas", () => {
  const result = Cushion.optimalDeductibleFor(1400, 1000, [150, 300, 500, 1000]);
  assert.equal(result.slack, 400);
  assert.equal(result.optimal, 300);
  assert.deepEqual(result.affordable, [150, 300]);
});

test("optimalDeductibleFor · sin holgura (colchón en el suelo o por debajo), ninguna franquicia es segura (null, no la más baja)", () => {
  const result = Cushion.optimalDeductibleFor(800, 1000, [150, 300, 500, 1000]);
  assert.equal(result.slack, 0);
  assert.equal(result.optimal, null);
  assert.deepEqual(result.affordable, []);
});

test("optimalDeductibleFor · sin lista de opciones, usa las habituales por defecto (150/300/500/1000)", () => {
  assert.deepEqual(Cushion.DEFAULT_DEDUCTIBLE_OPTIONS, [150, 300, 500, 1000]);
  const result = Cushion.optimalDeductibleFor(5000, 1000);
  assert.deepEqual(result.options, [150, 300, 500, 1000]);
});

test("optimalDeductibleFor · colchón o suelo negativos se tratan como cero, no rompen el cálculo", () => {
  const result = Cushion.optimalDeductibleFor(-500, -200, [150]);
  assert.equal(result.cushion, 0);
  assert.equal(result.floor, 0);
  assert.equal(result.slack, 0);
});

// TT2 · Bloque 11: escalera de vencimientos para el exceso sobre el colchón. Depende de CP2 (el
// exceso ya identificado como dinero parado) y de TT1 (mismo patrón de repartir por plazo, no por
// rentabilidad). No inventa ningún tipo de interés: solo reparte el importe en tramos iguales con
// vencimientos escalonados cada intervalMonths.

test("cushionMaturityLadder · sin importe, no hay tramos que inventar", () => {
  const ladder = Cushion.cushionMaturityLadder(0);
  assert.equal(ladder.total, 0);
  assert.deepEqual(ladder.rungs, []);
});

test("cushionMaturityLadder · importe negativo se trata como cero", () => {
  const ladder = Cushion.cushionMaturityLadder(-500);
  assert.equal(ladder.total, 0);
  assert.deepEqual(ladder.rungs, []);
});

test("cushionMaturityLadder · reparte en 4 tramos de 3 meses por defecto, la suma exacta cae en el último tramo", () => {
  const ladder = Cushion.cushionMaturityLadder(1000);
  assert.equal(ladder.rungCount, 4);
  assert.equal(ladder.intervalMonths, 3);
  assert.equal(ladder.rungs.length, 4);
  assert.deepEqual(ladder.rungs.map((rung) => rung.months), [3, 6, 9, 12]);
  assert.deepEqual(ladder.rungs.map((rung) => rung.amount), [250, 250, 250, 250]);
  const sum = ladder.rungs.reduce((acc, rung) => acc + rung.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, 1000);
});

test("cushionMaturityLadder · un importe que no divide exacto no pierde ni un céntimo: el resto va al último tramo", () => {
  const ladder = Cushion.cushionMaturityLadder(1000.01);
  const sum = ladder.rungs.reduce((acc, rung) => acc + rung.amount, 0);
  assert.equal(Math.round(sum * 100) / 100, 1000.01);
  assert.equal(ladder.rungs[3].amount, 250.01);
});

test("cushionMaturityLadder · número de tramos e intervalo personalizables", () => {
  const ladder = Cushion.cushionMaturityLadder(600, { rungs: 3, intervalMonths: 2 });
  assert.equal(ladder.rungCount, 3);
  assert.deepEqual(ladder.rungs.map((rung) => rung.months), [2, 4, 6]);
  assert.deepEqual(ladder.rungs.map((rung) => rung.amount), [200, 200, 200]);
});

test("cushionMaturityLadder · valores por defecto expuestos (4 tramos, cada 3 meses)", () => {
  assert.equal(Cushion.DEFAULT_LADDER_RUNGS, 4);
  assert.equal(Cushion.DEFAULT_LADDER_INTERVAL_MONTHS, 3);
});

// DLX1 (Oleada 2, Bloque 2): guardarraíl de colchón antes de amortizar deuda con caja disponible.
// Mismo margen de aviso temprano (20%) y los mismos tres estados que ya usa AP6
// (canonical-leverage-sustainability.js) para la deuda de apalancamiento tomada — aquí aplicado a
// una amortización puntual, no a una cuota recurrente.

test("amortizeCushionGuardrail · sostenible: tras amortizar sobra más de un 20% por encima del suelo", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 1000, liquidity: 5000, floor: 2000 });
  // remaining = 4000, suelo 2000, aviso temprano a partir de 2400 -> 4000 está claramente por encima
  assert.equal(result.remaining, 4000);
  assert.equal(result.status, "sostenible");
  assert.equal(result.shortfall, 0);
});

test("amortizeCushionGuardrail · ajustado: por encima del suelo pero dentro del margen de aviso (20%)", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 2900, liquidity: 5000, floor: 2000 });
  // remaining = 2100, suelo 2000, aviso temprano hasta 2400 -> 2100 cae en el tramo "ajustado"
  assert.equal(result.remaining, 2100);
  assert.equal(result.status, "ajustado");
  assert.equal(result.shortfall, 0);
});

test("amortizeCushionGuardrail · insostenible: amortizar deja el colchón por debajo del suelo, con la diferencia exacta", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 3500, liquidity: 5000, floor: 2000 });
  // remaining = 1500, por debajo del suelo de 2000 -> shortfall 500
  assert.equal(result.remaining, 1500);
  assert.equal(result.status, "insostenible");
  assert.equal(result.shortfall, 500);
});

test("amortizeCushionGuardrail · el límite es estricto: justo en el suelo ya no es insostenible", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 3000, liquidity: 5000, floor: 2000 });
  assert.equal(result.remaining, 2000);
  assert.equal(result.status, "ajustado"); // en el suelo exacto, pero por debajo del aviso temprano (2400)
});

test("amortizeCushionGuardrail · justo en el margen de aviso temprano ya es sostenible (límite estricto)", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 2600, liquidity: 5000, floor: 2000 });
  assert.equal(result.remaining, 2400); // exactamente floor * 1.2
  assert.equal(result.status, "sostenible");
});

test("amortizeCushionGuardrail · nunca bloquea el cálculo: siempre devuelve un resultado, incluso amortizando más de lo disponible", () => {
  const result = Cushion.amortizeCushionGuardrail({ amount: 6000, liquidity: 5000, floor: 2000 });
  assert.equal(result.remaining, -1000);
  assert.equal(result.status, "insostenible");
  assert.equal(result.shortfall, 3000);
});

test("amortizeCushionGuardrail · margen de aviso temprano expuesto (20%, mismo que AP6)", () => {
  assert.equal(Cushion.AMORTIZE_EARLY_WARNING_MARGIN, 0.2);
});

// ---------------------------------------------------------------------------------------------
// DLX2 (Oleada 2, Bloque 4) · reparto automático del excedente — primero protege el colchón hasta
// su suelo, y solo lo que sobra por encima queda libre para amortizar o invertir, según AP1.
// ---------------------------------------------------------------------------------------------

test("surplusAllocationRule · sin excedente, no calculable", () => {
  assert.deepEqual(Cushion.surplusAllocationRule({ amount: 0, liquidity: 5000, floor: 2000, assessment: "amortizar" }), { calculable: false });
});

test("surplusAllocationRule · con margen de sobra por encima del suelo, todo el excedente queda libre", () => {
  const result = Cushion.surplusAllocationRule({ amount: 300, liquidity: 5000, floor: 2000, assessment: "invertir" });
  assert.equal(result.toCushion, 0);
  assert.equal(result.spendable, 300);
  assert.equal(result.toInvestment, 300);
  assert.equal(result.toDebt, 0);
  assert.equal(result.unassigned, 0);
});

test("surplusAllocationRule · liquidez ya en el suelo, todo el excedente refuerza el colchón", () => {
  const result = Cushion.surplusAllocationRule({ amount: 300, liquidity: 2000, floor: 2000, assessment: "amortizar" });
  assert.equal(result.toCushion, 300);
  assert.equal(result.spendable, 0);
  assert.equal(result.toDebt, 0);
});

test("surplusAllocationRule · parte protege el colchón y el resto sigue el veredicto de AP1 (amortizar)", () => {
  // liquidez 2100, suelo 2000 -> solo 100 € de margen; excedente de 300 -> 200 al colchón, 100 libres
  const result = Cushion.surplusAllocationRule({ amount: 300, liquidity: 2100, floor: 2000, assessment: "amortizar" });
  assert.equal(result.toCushion, 200);
  assert.equal(result.spendable, 100);
  assert.equal(result.toDebt, 100);
  assert.equal(result.toInvestment, 0);
});

test("surplusAllocationRule · sin veredicto claro de AP1 (empate o sin cartera), la parte libre queda sin repartir", () => {
  const result = Cushion.surplusAllocationRule({ amount: 300, liquidity: 5000, floor: 2000, assessment: "neutral" });
  assert.equal(result.spendable, 300);
  assert.equal(result.toDebt, 0);
  assert.equal(result.toInvestment, 0);
  assert.equal(result.unassigned, 300);
  assert.equal(result.assessment, "neutral");
});

// ---------------------------------------------------------------------------------------------
// DLX3 (Oleada 2, Bloque 4) · retrospectiva "¿me habría quedado sin colchón?" — reconstrucción
// hacia atrás desde la liquidez de hoy, con el flujo neto real ya conciliado (mismo historial que
// PVX1) y el suelo VIGENTE (nunca uno histórico, que la app no guarda versionado).
// ---------------------------------------------------------------------------------------------

test("cushionRetrospective · sin meses conciliados, no calculable", () => {
  assert.deepEqual(Cushion.cushionRetrospective([], { currentLiquidity: 3000, floor: 2000 }), { calculable: false });
});

test("cushionRetrospective · descarta registros sin flujo real numérico", () => {
  const result = Cushion.cushionRetrospective([{ monthKey: "2026-01", actual: NaN }], { currentLiquidity: 3000, floor: 2000 });
  assert.equal(result.calculable, false);
});

test("cushionRetrospective · reconstruye hacia atrás desde la liquidez de hoy, mes más reciente primero", () => {
  // Hoy: 3000 €. En 2026-02 el flujo neto real fue +500 -> a cierre de 2026-01 había 2500.
  // En 2026-01 el flujo neto real fue -800 -> antes de ese mes había 3300.
  const history = [
    { monthKey: "2026-01", actual: -800 },
    { monthKey: "2026-02", actual: 500 },
  ];
  const result = Cushion.cushionRetrospective(history, { currentLiquidity: 3000, floor: 2000 });
  assert.equal(result.calculable, true);
  assert.deepEqual(result.months[0], { monthKey: "2026-02", netFlow: 500, estimatedBalance: 3000, status: "holgado" });
  assert.deepEqual(result.months[1], { monthKey: "2026-01", netFlow: -800, estimatedBalance: 2500, status: "holgado" });
});

test("cushionRetrospective · marca el mes en que la liquidez reconstruida habría caído por debajo del suelo vigente", () => {
  // Hoy: 3000 €, suelo 2000 €. A cierre de 2026-02 la liquidez reconstruida es 3000 (holgado); un
  // mes antes (fin de 2026-01, antes del flujo de +1500 de febrero) sería 1500 -> ajustado.
  const history = [
    { monthKey: "2026-01", actual: -100 },
    { monthKey: "2026-02", actual: 1500 },
  ];
  const result = Cushion.cushionRetrospective(history, { currentLiquidity: 3000, floor: 2000 });
  assert.equal(result.months[0].estimatedBalance, 3000);
  assert.equal(result.months[0].status, "holgado");
  assert.equal(result.months[1].estimatedBalance, 1500);
  assert.equal(result.months[1].status, "ajustado");
  assert.equal(result.breachCount, 1);
  assert.equal(result.worstMonth.monthKey, "2026-01");
});

test("cushionRetrospective · usa el suelo vigente (cushionLevel), no uno histórico, y cuenta las brechas", () => {
  const history = [{ monthKey: "2026-01", actual: 2000 }];
  // Hoy 1500 €, suelo 2000 € -> antes de este único mes conciliado había 1500-2000=-500 € (negativo)
  const result = Cushion.cushionRetrospective(history, { currentLiquidity: 1500, floor: 2000 });
  assert.equal(result.months[0].estimatedBalance, 1500);
  assert.equal(result.months[0].status, "ajustado");
  assert.equal(result.breachCount, 1);
});
