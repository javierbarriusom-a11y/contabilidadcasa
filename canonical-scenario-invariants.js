(function attachCanonicalScenarioInvariants(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalScenarioInvariants = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalScenarioInvariantsFactory() {
  "use strict";

  const SCHEMA_ID = "finance-e19-scenario-invariants/v1";

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Catálogo de las 15 invariantes del motor (doc "Esquemas validables y dataset dorado", §4).
  // `verificableHoy` distingue las que pueden comprobarse contra el código real que existe en el
  // repositorio ahora mismo de las que exigen el motor de Escenario unificado (E20). Documentarlo
  // como dato, no solo en prosa, es lo que permite que T-META compruebe que ninguna se queda
  // silenciosamente sin cubrir cuando E20 aterrice.
  const INVARIANTS = Object.freeze([
    { id: "I-01", nombre: "Determinismo", formulacion: "motor(e) === motor(e) en dos ejecuciones y en dos sesiones distintas", verificableHoy: true, motorActual: "legacy-debt-roadmap-engine, canonical-engine" },
    { id: "I-02", nombre: "Conservación de caja", formulacion: "liquidez[m] = liquidez[m-1] + ingresos - gastos - deuda - proyectos ± traspasos, error < 0,01 €", verificableHoy: true, motorActual: "canonical-engine (validateRows)" },
    { id: "I-03", nombre: "Cierre de cuentas", formulacion: "liquidezTotal = caixabank + mediolanum en todos los meses", verificableHoy: true, motorActual: "canonical-engine (validateRows)" },
    { id: "I-04", nombre: "Capital acotado", formulacion: "Para toda deuda: Σ amortizaciones ≤ principal + intereses devengados", verificableHoy: true, motorActual: "legacy-debt-roadmap-engine" },
    { id: "I-05", nombre: "Neutralidad de inactivas", formulacion: "Una decisión con activa:false produce el mismo resultado que su ausencia", verificableHoy: true, motorActual: "canonical-scenario-engine (E20-0 día 1: estado de deudas, sin la serie mensual del forecast todavía)" },
    { id: "I-06", nombre: "Conmutatividad de independientes", formulacion: "Reordenar dos decisiones que no comparten deudaId, mes ni cuenta no cambia el resultado", verificableHoy: true, motorActual: "canonical-scenario-engine (E20-0 día 1: estado de deudas, sin la serie mensual del forecast todavía)" },
    { id: "I-07", nombre: "Monotonía de amortización", formulacion: "Aumentar el importe de una amortización nunca aumenta costeFinancieroTotal ni retrasa fechaLibreDeuda", verificableHoy: true, motorActual: "legacy-debt-roadmap-engine" },
    { id: "I-08", nombre: "Monotonía de tipo", formulacion: "Aumentar el TIN de una deuda nunca reduce costeFinancieroTotal", verificableHoy: true, motorActual: "legacy-debt-roadmap-engine" },
    { id: "I-09", nombre: "Escenario vacío ≡ base", formulacion: "Un escenario con 0 decisiones reproduce exactamente la proyección del Plan canónico", verificableHoy: true, motorActual: "canonical-scenario-engine (E20-0 día 2: resolveEscenario delega en canonical-engine.buildRows sin tocar nada)" },
    { id: "I-10", nombre: "Guardarraíl duro respetado", formulacion: "El modo óptimo nunca resuelve un mes que viole un guardarraíl duro", verificableHoy: false, motorActual: null },
    { id: "I-11", nombre: "Rebase idempotente", formulacion: "Rebasar sobre el mismo datasetVersion no cambia nada", verificableHoy: false, motorActual: null },
    { id: "I-12", nombre: "Reversión exacta", formulacion: "aplicar(e) seguido de revertir(e) devuelve el Plan a un estado con hash idéntico al previo", verificableHoy: false, motorActual: null },
    { id: "I-13", nombre: "Convergencia Monte Carlo", formulacion: "El P50 del Monte Carlo converge al determinista con error relativo < 2% para N=1000", verificableHoy: false, motorActual: null },
    { id: "I-14", nombre: "Suma presupuestaria", formulacion: "Σ techos de bloque = techo total en todos los meses y en el anual", verificableHoy: false, motorActual: null },
    { id: "I-15", nombre: "Provisión no disponible", formulacion: "El saldo disponible para amortizar ≤ mediolanum − Σ saldos de fondos de provisión", verificableHoy: false, motorActual: null },
  ]);

  function invariant(id) {
    return INVARIANTS.find((item) => item.id === id) || null;
  }

  // I-01 · Determinismo: dos resultados producidos por la misma entrada deben ser idénticos
  // campo a campo (dentro de tolerancia numérica), no solo "parecidos".
  function checkDeterminism(resultA, resultB, tolerance = 0.01) {
    const differences = [];
    function compare(a, b, path) {
      if (typeof a === "number" || typeof b === "number") {
        if (Math.abs(number(a) - number(b)) > tolerance) differences.push(`${path}: ${a} != ${b}`);
        return;
      }
      if (Array.isArray(a) || Array.isArray(b)) {
        const arrA = Array.isArray(a) ? a : [];
        const arrB = Array.isArray(b) ? b : [];
        if (arrA.length !== arrB.length) { differences.push(`${path}: longitudes distintas (${arrA.length} vs ${arrB.length})`); return; }
        arrA.forEach((item, index) => compare(item, arrB[index], `${path}[${index}]`));
        return;
      }
      if (a && typeof a === "object") {
        Object.keys(a).forEach((key) => compare(a[key], b?.[key], `${path}.${key}`));
        return;
      }
      if (a !== b) differences.push(`${path}: ${a} != ${b}`);
    }
    compare(resultA, resultB, "$");
    return { valid: differences.length === 0, differences };
  }

  // I-04 · Capital acotado: el saldo financiado nunca debe volverse negativo (se pagaría más
  // capital del que existe) y el total de capital amortizado no debe superar el principal
  // financiado original.
  function checkBoundedPrincipal(result, accountIndex, financedPrincipal) {
    const issues = [];
    const balances = result.rows.map((row) => row.balances[accountIndex]);
    balances.forEach((balance, index) => {
      if (balance < -0.01) issues.push(`balance negativo en la fila ${index}: ${balance}`);
    });
    const finalBalance = balances[balances.length - 1];
    const principalRepaid = number(financedPrincipal) - number(finalBalance);
    if (principalRepaid > number(financedPrincipal) + 0.01) {
      issues.push(`capital amortizado (${principalRepaid}) supera el principal financiado (${financedPrincipal})`);
    }
    return { valid: issues.length === 0, issues };
  }

  // I-07 · Monotonía de amortización: una amortización mayor nunca debe encarecer el coste total
  // ni retrasar el mes en que la deuda queda liquidada.
  function checkAmortizationMonotonicity(baseResult, higherAmortizationResult) {
    const issues = [];
    if (higherAmortizationResult.totalPaid > baseResult.totalPaid + 0.01) {
      issues.push(`el coste total sube al amortizar más: ${baseResult.totalPaid} -> ${higherAmortizationResult.totalPaid}`);
    }
    if (higherAmortizationResult.durationMonths > baseResult.durationMonths) {
      issues.push(`la duración se alarga al amortizar más: ${baseResult.durationMonths} -> ${higherAmortizationResult.durationMonths}`);
    }
    return { valid: issues.length === 0, issues };
  }

  // I-08 · Monotonía de tipo: subir el TIN de una deuda nunca debe reducir su coste financiero
  // total.
  function checkRateMonotonicity(baseResult, higherRateResult) {
    const issues = [];
    if (higherRateResult.totalPaid < baseResult.totalPaid - 0.01) {
      issues.push(`el coste total baja al subir el TIN: ${baseResult.totalPaid} -> ${higherRateResult.totalPaid}`);
    }
    return { valid: issues.length === 0, issues };
  }

  return {
    SCHEMA_ID,
    INVARIANTS,
    invariant,
    checkDeterminism,
    checkBoundedPrincipal,
    checkAmortizationMonotonicity,
    checkRateMonotonicity,
  };
});
