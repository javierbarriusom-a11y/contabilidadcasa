const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-scenario-engine.js");
const canonicalEngine = require("../canonical-engine.js");
const { mulberry32, rangeFactory, intRangeFactory, pickFactory } = require("./golden/prng.cjs");

const MONTH_KEYS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

function cascadeBaseInput() {
  return {
    openingBalances: { checking: 3000, savings: 0 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 0, autoCapSavings: false },
    months: MONTH_KEYS.map((monthKey) => ({ monthKey, income: 3000, coreSpend: 2700, variableOperationalSpend: 0, car: 0, refi: 300, projectOutflow: 0 })),
  };
}

function cascadeDebtContracts() {
  return [{ id: "A", paymentStatus: "active", currentPrincipal: 900, currentPayment: 300, remainingInstallments: 12, apr: 8 }];
}

function amortizaDecision(orden) {
  return { id: "amortiza", tipo: "amortizacion", activa: true, orden, planificacion: { modo: "manual", mesManual: "2026-06" }, params: { deudaId: "A", importe: 900 } };
}

function compraDecision(orden) {
  return {
    id: "compra", tipo: "compra", activa: true, orden,
    planificacion: { modo: "manual", mesManual: "2026-09" },
    params: { nombre: "Compra", importe: 900, financiacion: { principal: 900, TIN: 0.1, cuota: 900, plazo: 3 } },
  };
}

function contract(overrides = {}) {
  return {
    id: "deuda-1",
    paymentStatus: "active",
    currentPrincipal: 1000,
    currentPayment: 100,
    remainingInstallments: 10,
    apr: 8,
    ...overrides,
  };
}

test("C005 · reunificación de tres deudas cierra las tres y abre un plan único", () => {
  const debtContracts = [
    contract({ id: "A", currentPrincipal: 2000 }),
    contract({ id: "B", currentPrincipal: 1500 }),
    contract({ id: "C", currentPrincipal: 900 }),
  ];
  const decisiones = [{
    id: "d1", tipo: "reunificacion", activa: true, orden: 0,
    params: { deudaIds: ["A", "B", "C"], nuevoPrincipal: 4200, nuevoTIN: 0.09, nuevaCuota: 150, nuevoPlazo: 36 },
  }];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  assert.equal(result.valid, true);
  assert.equal(result.resultados[0].resultado, "aplicada");
  const byId = new Map(result.debtStateFinal.map((item) => [item.id, item]));
  ["A", "B", "C"].forEach((id) => {
    assert.equal(byId.get(id).paymentStatus, "reunified");
    assert.equal(byId.get(id).currentPrincipal, 0);
    assert.equal(byId.get(id).reunifiedInto, "reunificada-d1");
  });
  const nueva = byId.get("reunificada-d1");
  assert.ok(nueva, "debe existir la deuda reunificada nueva");
  assert.equal(nueva.currentPrincipal, 4200);
  assert.deepEqual(nueva.componentIds, ["A", "B", "C"]);
});

test("C042 · segunda amortización sobre una deuda ya cerrada por la primera es un conflicto bloqueante", () => {
  const debtContracts = [contract({ id: "A", currentPrincipal: 1000 })];
  const decisiones = [
    { id: "d1", tipo: "amortizacion", activa: true, orden: 0, params: { deudaId: "A", importe: 1000 } },
    { id: "d2", tipo: "amortizacion", activa: true, orden: 1, params: { deudaId: "A", importe: 200 } },
  ];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  assert.equal(result.valid, true);
  const [r1, r2] = result.resultados;
  assert.equal(r1.resultado, "aplicada");
  assert.equal(r2.resultado, "conflicto-bloqueante");
  assert.equal(r2.cerradaPor, "d1");
  // la segunda decisión no debe haber mutado el estado ya cerrado por la primera
  const debtA = result.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.currentPrincipal, 0);
  assert.equal(debtA.closedByDecisionId, "d1");
});

test("C043 · amortización sobre una deuda ya absorbida por una reunificación previa es un conflicto bloqueante", () => {
  const debtContracts = [
    contract({ id: "A", currentPrincipal: 2000 }),
    contract({ id: "B", currentPrincipal: 1500 }),
  ];
  const decisiones = [
    { id: "d1", tipo: "reunificacion", activa: true, orden: 0, params: { deudaIds: ["A", "B"], nuevoPrincipal: 3500, nuevoTIN: 0.08, nuevaCuota: 140, nuevoPlazo: 30 } },
    { id: "d2", tipo: "amortizacion", activa: true, orden: 1, params: { deudaId: "A", importe: 500 } },
  ];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  const [, r2] = result.resultados;
  assert.equal(r2.resultado, "conflicto-bloqueante");
  assert.equal(r2.cerradaPor, "d1");
});

test("una decisión sobre una deuda inexistente se rechaza explícitamente", () => {
  const result = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion", activa: true, orden: 0, params: { deudaId: "fantasma", importe: 100 } }],
    { debtContracts: [contract({ id: "A" })] },
  );
  assert.equal(result.resultados[0].resultado, "deuda-desconocida");
});

test("una decisión sobre una deuda ya cerrada antes de importar el escenario usa un código distinto al conflicto entre decisiones", () => {
  const result = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion", activa: true, orden: 0, params: { deudaId: "A", importe: 100 } }],
    { debtContracts: [contract({ id: "A", paymentStatus: "settled", currentPrincipal: 0 })] },
  );
  assert.equal(result.resultados[0].resultado, "deuda-ya-cerrada");
});

test("tipos de decisión que no tocan deuda (compra, proyecto...) siguen marcados como no soportados por resolveDecisiones", () => {
  const result = engine.resolveDecisiones(
    [
      { id: "d1", tipo: "compra", activa: true, orden: 0, params: { nombre: "Coche", importe: 12000 } },
      { id: "d2", tipo: "proyecto", activa: true, orden: 1, params: { nombre: "Fondo", importeObjetivo: 3000, modalidad: "hucha", mesObjetivo: "2026-12" } },
    ],
    { debtContracts: [contract({ id: "A" })] },
  );
  assert.equal(result.resultados[0].resultado, "tipo-no-soportado-aun");
  assert.equal(result.resultados[1].resultado, "tipo-no-soportado-aun");
});

test("un ciclo de dependencias detiene la resolución sin aplicar ninguna decisión", () => {
  const result = engine.resolveDecisiones(
    [
      { id: "d1", tipo: "amortizacion", activa: true, orden: 0, dependeDe: ["d2"], params: { deudaId: "A", importe: 100 } },
      { id: "d2", tipo: "amortizacion", activa: true, orden: 1, dependeDe: ["d1"], params: { deudaId: "A", importe: 100 } },
    ],
    { debtContracts: [contract({ id: "A" })] },
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "dependency-cycle");
});

test("amortización parcial reduce el principal sin cerrar la deuda; alcanzar el principal sí la cierra", () => {
  const parcial = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion", activa: true, orden: 0, params: { deudaId: "A", importe: 300, parcial: true } }],
    { debtContracts: [contract({ id: "A", currentPrincipal: 1000 })] },
  );
  const debtA = parcial.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.paymentStatus, "active");
  assert.equal(debtA.currentPrincipal, 700);

  const total = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion", activa: true, orden: 0, params: { deudaId: "A", importe: 1000 } }],
    { debtContracts: [contract({ id: "A", currentPrincipal: 1000 })] },
  );
  const debtA2 = total.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA2.paymentStatus, "settled");
  assert.equal(debtA2.currentPrincipal, 0);
});

test("refinanciación reemplaza principal, cuota, TIN y plazo, y reactiva la deuda", () => {
  const result = engine.resolveDecisiones(
    [{ id: "d1", tipo: "refinanciacion", activa: true, orden: 0, params: { deudaId: "A", nuevoPrincipal: 5000, nuevoTIN: 0.07, nuevaCuota: 180, nuevoPlazo: 30 } }],
    { debtContracts: [contract({ id: "A", currentPrincipal: 6000, currentPayment: 250 })] },
  );
  const debtA = result.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.currentPrincipal, 5000);
  assert.equal(debtA.currentPayment, 180);
  assert.equal(debtA.apr, 0.07);
  assert.equal(debtA.remainingInstallments, 30);
  assert.equal(debtA.paymentStatus, "active");
});

test("retomar pagos exige que la deuda esté suspendida", () => {
  const rejected = engine.resolveDecisiones(
    [{ id: "d1", tipo: "retomar_pagos", activa: true, orden: 0, params: { deudaId: "A", cuota: 150, mesInicio: "2026-09" } }],
    { debtContracts: [contract({ id: "A", paymentStatus: "active" })] },
  );
  assert.equal(rejected.resultados[0].resultado, "rechazada");
  assert.equal(rejected.resultados[0].motivo, "deuda-no-suspendida");

  const resumed = engine.resolveDecisiones(
    [{ id: "d1", tipo: "retomar_pagos", activa: true, orden: 0, params: { deudaId: "A", cuota: 150, mesInicio: "2026-09" } }],
    { debtContracts: [contract({ id: "A", paymentStatus: "suspended", currentPayment: 0 })] },
  );
  const debtA = resumed.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.paymentStatus, "active");
  assert.equal(debtA.currentPayment, 150);
});

test("I-05 · neutralidad de inactivas — una decisión con activa:false nunca muta el estado de deudas", () => {
  const rng = mulberry32(505);
  const range = rangeFactory(rng);
  for (let trial = 0; trial < 40; trial += 1) {
    const principal = Math.round(range(500, 20000));
    const debtContracts = [contract({ id: "A", currentPrincipal: principal })];
    const importe = Math.round(range(1, principal * 2));
    const result = engine.resolveDecisiones(
      [{ id: "d1", tipo: "amortizacion", activa: false, orden: 0, params: { deudaId: "A", importe } }],
      { debtContracts },
    );
    assert.equal(result.resultados[0].resultado, "inactiva", `trial ${trial}`);
    const debtA = result.debtStateFinal.find((item) => item.id === "A");
    assert.equal(debtA.currentPrincipal, principal, `trial ${trial}: la deuda no debía cambiar`);
    assert.equal(debtA.paymentStatus, "active", `trial ${trial}: la deuda no debía cerrarse`);
  }
});

test("I-06 · conmutatividad de independientes — dos decisiones sobre deudas distintas sin dependeDe dan el mismo estado final en cualquier orden declarado", () => {
  const rng = mulberry32(606);
  const range = rangeFactory(rng);
  const intRange = intRangeFactory(rng);
  const pick = pickFactory(rng);
  for (let trial = 0; trial < 40; trial += 1) {
    const principalA = Math.round(range(1000, 20000));
    const principalB = Math.round(range(1000, 20000));
    const importeA = Math.round(range(1, principalA));
    const importeB = Math.round(range(1, principalB));
    const ordenA = intRange(0, 5);
    const ordenB = intRange(0, 5);
    const baseDecisiones = [
      { id: "dA", tipo: "amortizacion", activa: true, orden: ordenA, params: { deudaId: "A", importe: importeA, parcial: true } },
      { id: "dB", tipo: "amortizacion", activa: true, orden: ordenB, params: { deudaId: "B", importe: importeB, parcial: true } },
    ];
    const forward = engine.resolveDecisiones(baseDecisiones, {
      debtContracts: [contract({ id: "A", currentPrincipal: principalA }), contract({ id: "B", currentPrincipal: principalB })],
    });
    const reversed = engine.resolveDecisiones(pick([baseDecisiones.slice().reverse(), baseDecisiones]), {
      debtContracts: [contract({ id: "A", currentPrincipal: principalA }), contract({ id: "B", currentPrincipal: principalB })],
    });
    const normalize = (res) => Object.fromEntries(res.debtStateFinal.map((item) => [item.id, { principal: item.currentPrincipal, status: item.paymentStatus }]));
    assert.deepEqual(normalize(forward), normalize(reversed), `trial ${trial}`);
  }
});

test("I-09 · escenario vacío ≡ Plan canónico — con 0 decisiones, resolveEscenario reproduce exactamente Engine.buildRows(baseInput)", () => {
  const baseInput = cascadeBaseInput();
  const result = engine.resolveEscenario([], { debtContracts: cascadeDebtContracts(), baseInput });
  assert.equal(result.valid, true);
  const expected = canonicalEngine.buildRows(baseInput);
  assert.deepEqual(result.series, expected);
  assert.deepEqual(result.months, baseInput.months);
});

test("día 2 · una amortización total libera la cuota mensual desde el mes siguiente al resuelto", () => {
  const result = engine.resolveEscenario([amortizaDecision(1)], { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput() });
  assert.equal(result.valid, true);
  assert.equal(result.resultados[0].resultado, "aplicada");
  const byMonth = Object.fromEntries(result.months.map((month) => [month.monthKey, month.refi]));
  assert.equal(byMonth["2026-05"], 300, "mayo (antes de amortizar) no debe cambiar");
  assert.equal(byMonth["2026-06"], 1200, "junio paga la cuota normal (300) más el pago único (900)");
  assert.equal(byMonth["2026-07"], 0, "julio ya no arrastra la cuota: la deuda quedó cerrada en junio");
});

test("C040/C041 · las mismas dos decisiones (amortizar + comprar financiado) dan resultados distintos y correctos según el orden de resolución", () => {
  const guardarrailes = { saldoMinimoAbsoluto: 600 };

  // C040: se resuelve primero la amortización (orden 1) y después la compra (orden 2). Para
  // cuando se comprueba la compra contra el guardarraíl, la deuda ya está cerrada y la cuota
  // liberada desde julio hace que la liquidez mínima resultante (900 €) sea suficiente.
  const ordenAmortizaPrimero = engine.resolveEscenario(
    [amortizaDecision(1), compraDecision(2)],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput(), guardarrailes },
  );
  const resultadosA = Object.fromEntries(ordenAmortizaPrimero.resultados.map((item) => [item.id, item.resultado]));
  assert.equal(resultadosA.amortiza, "aplicada");
  assert.equal(resultadosA.compra, "aplicada");
  assert.equal(Math.min(...ordenAmortizaPrimero.series.map((row) => row.totalLiquidity)), 900);

  // C041: mismas dos decisiones, orden de resolución invertido (la compra se resuelve primero).
  // En ese punto la deuda todavía no se ha amortizado, así que la misma compra financiada rompe
  // el guardarraíl (liquidez mínima resultante 300 € < 600 €) y se rechaza explícitamente — nunca
  // se aplica en silencio con un número peor del que el usuario aprobaría.
  const ordenCompraPrimero = engine.resolveEscenario(
    [amortizaDecision(2), compraDecision(1)],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput(), guardarrailes },
  );
  const resultadosB = Object.fromEntries(ordenCompraPrimero.resultados.map((item) => [item.id, item.resultado]));
  assert.equal(resultadosB.compra, "guardarril-incumplido");
  assert.equal(resultadosB.amortiza, "aplicada", "la amortización en solitario sigue siendo viable");
  assert.equal(Math.min(...ordenCompraPrimero.series.map((row) => row.totalLiquidity)), 2100);

  // El mismo par de decisiones, en los dos órdenes: resultados distintos (la compra se aplica en
  // un caso y se rechaza en el otro) y ambos correctos respecto al guardarraíl declarado.
  assert.notDeepEqual(ordenAmortizaPrimero.months, ordenCompraPrimero.months);
});

test("C004 · amortización fraccionada (día 1): agota el principal antes de completar los meses declarados y cierra la deuda", () => {
  const result = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion_fraccionada", activa: true, orden: 0, params: { deudaId: "A", importeMensual: 500, meses: 6 } }],
    { debtContracts: [contract({ id: "A", currentPrincipal: 1200 })] },
  );
  assert.equal(result.resultados[0].resultado, "aplicada");
  assert.equal(result.resultados[0].efecto, "cierre-total-fraccionado");
  const debtA = result.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.paymentStatus, "settled");
  assert.equal(debtA.currentPrincipal, 0);
});

test("C004 · amortización fraccionada (día 1): si no alcanza el principal en los meses declarados, la deuda sigue activa con el principal reducido", () => {
  const result = engine.resolveDecisiones(
    [{ id: "d1", tipo: "amortizacion_fraccionada", activa: true, orden: 0, params: { deudaId: "A", importeMensual: 200, meses: 6 } }],
    { debtContracts: [contract({ id: "A", currentPrincipal: 5000 })] },
  );
  const debtA = result.debtStateFinal.find((item) => item.id === "A");
  assert.equal(debtA.paymentStatus, "active");
  assert.equal(debtA.currentPrincipal, 3800);
});

test("C004 · amortización fraccionada (día 2): la cuota extra aparece solo mientras dura, y la deuda cierra en el mes real (no en el declarado)", () => {
  const result = engine.resolveEscenario(
    [{ id: "frac", tipo: "amortizacion_fraccionada", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-03" }, params: { deudaId: "A", importeMensual: 300, meses: 6 } }],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput() },
  );
  assert.equal(result.resultados[0].resultado, "aplicada");
  assert.equal(result.resultados[0].efecto, "cierre-total-fraccionado", "900€ de principal se agotan en 3 meses, no en los 6 declarados");
  const byMonth = Object.fromEntries(result.months.map((month) => [month.monthKey, month.refi]));
  assert.equal(byMonth["2026-02"], 300, "febrero, antes de empezar, no cambia");
  assert.equal(byMonth["2026-03"], 600, "cuota normal (300) + extra fraccionada (300)");
  assert.equal(byMonth["2026-04"], 600);
  assert.equal(byMonth["2026-05"], 600, "tercer y último mes de la fraccionada: el principal se agota aquí");
  assert.equal(byMonth["2026-06"], 0, "la deuda ya está cerrada, no llega a los 6 meses declarados");
});

test("C003 · mes óptimo sin guardarraíles declarados usa directamente el primer mes del horizonte", () => {
  const result = engine.resolveEscenario(
    [{ id: "compra", tipo: "compra", activa: true, orden: 1, planificacion: { modo: "optimo" }, params: { nombre: "Compra", importe: 500 } }],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput() },
  );
  assert.equal(result.resultados[0].resultado, "aplicada");
  assert.equal(result.resultados[0].mesResuelto, "2026-01");
});

test("C003 · mes óptimo busca el primer mes viable respetando el guardarraíl — y se beneficia de una amortización resuelta antes", () => {
  const guardarrailes = { saldoMinimoAbsoluto: 600 };
  const compraOptimo = {
    id: "compra", tipo: "compra", activa: true, orden: 2,
    planificacion: { modo: "optimo" },
    params: { nombre: "Compra", importe: 900, financiacion: { principal: 900, TIN: 0.1, cuota: 900, plazo: 3 } },
  };
  const result = engine.resolveEscenario(
    [amortizaDecision(1), compraOptimo],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput(), guardarrailes },
  );
  const resultados = Object.fromEntries(result.resultados.map((item) => [item.id, item]));
  assert.equal(resultados.amortiza.resultado, "aplicada");
  assert.equal(resultados.compra.resultado, "aplicada");
  // Ni enero (antes de amortizar, sin margen liberado) ni los meses intermedios son viables: el
  // buscador encuentra agosto, dos meses después de que julio empiece a liberar la cuota.
  assert.equal(resultados.compra.mesResuelto, "2026-08");
  assert.equal(Math.min(...result.series.map((row) => row.totalLiquidity)), 600);
});

test("C003 · mes óptimo se rechaza explícitamente (sin-mes-viable) cuando ningún mes del horizonte respeta el guardarraíl", () => {
  const result = engine.resolveEscenario(
    [{
      id: "compra", tipo: "compra", activa: true, orden: 1,
      planificacion: { modo: "optimo" },
      params: { nombre: "Compra", importe: 900, financiacion: { principal: 900, TIN: 0.1, cuota: 900, plazo: 3 } },
    }],
    { debtContracts: cascadeDebtContracts(), baseInput: cascadeBaseInput(), guardarrailes: { saldoMinimoAbsoluto: 1000000 } },
  );
  assert.equal(result.resultados[0].resultado, "sin-mes-viable");
  assert.deepEqual(result.months, cascadeBaseInput().months, "un rechazo no debe dejar ningún rastro en la serie");
});

test("día 4 · imprevisto: de golpe en el mes declarado, o repetido cada N meses si se declara recurrencia", () => {
  const result = engine.resolveEscenario(
    [{ id: "imp", tipo: "imprevisto", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-03" }, params: { importe: 100, mes: "2026-03", recurrenciaMeses: 3 } }],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  assert.equal(result.resultados[0].resultado, "aplicada");
  const byMonth = Object.fromEntries(result.months.map((month) => [month.monthKey, month.projectOutflow]));
  assert.equal(byMonth["2026-02"], 0);
  assert.equal(byMonth["2026-03"], 100);
  assert.equal(byMonth["2026-04"], 0);
  assert.equal(byMonth["2026-05"], 0);
  assert.equal(byMonth["2026-06"], 100, "se repite cada 3 meses desde marzo");
  assert.equal(byMonth["2026-09"], 100);
  assert.equal(byMonth["2026-12"], 100);
});

test("día 4 · proyecto: la modalidad hucha reparte el objetivo en cuotas iguales; pago_unico lo carga de golpe en el mes objetivo", () => {
  const hucha = engine.resolveEscenario(
    [{ id: "proy", tipo: "proyecto", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-02" }, params: { nombre: "Viaje", importeObjetivo: 1200, modalidad: "hucha", mesObjetivo: "2026-05" } }],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  const byMonthHucha = Object.fromEntries(hucha.months.map((month) => [month.monthKey, month.projectOutflow]));
  assert.equal(byMonthHucha["2026-01"], 0);
  assert.equal(byMonthHucha["2026-02"], 300);
  assert.equal(byMonthHucha["2026-03"], 300);
  assert.equal(byMonthHucha["2026-04"], 300);
  assert.equal(byMonthHucha["2026-05"], 300, "4 cuotas de 300€ = 1200€, de febrero a mayo");

  const pagoUnico = engine.resolveEscenario(
    [{ id: "proy2", tipo: "proyecto", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-02" }, params: { nombre: "TV", importeObjetivo: 800, modalidad: "pago_unico", mesObjetivo: "2026-05" } }],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  const byMonthUnico = Object.fromEntries(pagoUnico.months.map((month) => [month.monthKey, month.projectOutflow]));
  assert.equal(byMonthUnico["2026-02"], 0);
  assert.equal(byMonthUnico["2026-05"], 800);
});

test("día 4 · cambio_ingreso y cambio_gasto: delta mensual entre mesInicio y mesFin (o hasta el final del horizonte)", () => {
  const cambioIngreso = engine.resolveEscenario(
    [{ id: "ci", tipo: "cambio_ingreso", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-03" }, params: { titular: "javi", deltaMensual: -500, mesInicio: "2026-03", mesFin: "2026-05" } }],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  const byMonthIngreso = Object.fromEntries(cambioIngreso.months.map((month) => [month.monthKey, month.income]));
  assert.equal(byMonthIngreso["2026-02"], 3000, "fuera del rango, sin cambio");
  assert.equal(byMonthIngreso["2026-03"], 2500);
  assert.equal(byMonthIngreso["2026-05"], 2500);
  assert.equal(byMonthIngreso["2026-06"], 3000, "termina en mesFin, no continúa después");

  const cambioGasto = engine.resolveEscenario(
    [{ id: "cg", tipo: "cambio_gasto", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-06" }, params: { bloque: "ocio", deltaPct: 0.1, mesInicio: "2026-06" } }],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  const byMonthGasto = Object.fromEntries(cambioGasto.months.map((month) => [month.monthKey, month.coreSpend]));
  assert.equal(byMonthGasto["2026-05"], 2700, "antes de empezar, sin cambio");
  assert.equal(byMonthGasto["2026-06"], 2970, "+10% de 2700");
  assert.equal(byMonthGasto["2026-12"], 2970, "sin mesFin, dura hasta el final del horizonte");
});

test("día 4 · traspaso y cambio_presupuesto siguen sin soportarse explícitamente (límite real del contrato de canonical-engine, no un olvido)", () => {
  const result = engine.resolveEscenario(
    [
      { id: "tr", tipo: "traspaso", activa: true, orden: 1, planificacion: { modo: "manual", mesManual: "2026-03" }, params: { origen: "caixabank", destino: "mediolanum", importe: 500, mes: "2026-03" } },
      { id: "cp", tipo: "cambio_presupuesto", activa: true, orden: 2, planificacion: { modo: "manual", mesManual: "2026-03" }, params: { bloque: "ocio", nuevoTecho: 300, desde: "2026-03" } },
    ],
    { debtContracts: [], baseInput: cascadeBaseInput() },
  );
  assert.equal(result.resultados[0].resultado, "tipo-no-soportado-aun");
  assert.equal(result.resultados[1].resultado, "tipo-no-soportado-aun");
  assert.deepEqual(result.months, cascadeBaseInput().months);
});
