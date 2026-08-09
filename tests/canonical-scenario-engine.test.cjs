const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-scenario-engine.js");
const { mulberry32, rangeFactory, intRangeFactory, pickFactory } = require("./golden/prng.cjs");

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

test("tipos de decisión aún no soportados en el día 1 (compra, amortización fraccionada) se marcan explícitamente", () => {
  const result = engine.resolveDecisiones(
    [
      { id: "d1", tipo: "compra", activa: true, orden: 0, params: { nombre: "Coche", importe: 12000 } },
      { id: "d2", tipo: "amortizacion_fraccionada", activa: true, orden: 1, params: { deudaId: "A", importeMensual: 100, meses: 6 } },
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
