(function attachCanonicalLeverageSimulator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLeverageSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLeverageSimulator() {
  "use strict";

  // AP3 — simulador de apalancamiento: explorar qué pasaría si se pide deuda nueva para invertirla,
  // nunca ejecutar nada. Depende de AP4 (canonical-leverage-barrier.js), a propósito: sin sus
  // condiciones mínimas verificadas (colchón por encima del suelo, deuda actual sin incidencias
  // críticas, cuota actual contenida), este motor rechaza calcular — no hay simulación de
  // apalancamiento que mostrar sin guardarraíl superado. Motor puro, sin DOM ni estado global,
  // mismo patrón que canonical-leverage-barrier.js.

  const SCHEMA_ID = "finance-canonical-leverage-simulator/v1";
  const SAVED_SCHEMA_ID = "finance-canonical-leverage-simulator-saved/v1";

  // Los tres escenarios de rentabilidad esperada (pesimista/base/optimista) los declara el hogar —
  // este motor no inventa ninguna cifra de mercado ni de rendimiento futuro, mismo criterio que
  // A15-2 con los tramos de IRPF. La lectura favorable/desfavorable de cada escenario es una
  // sugerencia que se explica con los números de abajo, nunca una orden ni una acción automática:
  // quien simula ve el desglose completo y decide si la acepta.
  const PROFESSIONAL_WARNING =
    "Exploración con los supuestos de rentabilidad que tú has declarado, nunca garantizados. " +
    "No es una recomendación de pedir deuda: la lectura que ofrece este simulador es solo eso, " +
    "una lectura — acéptala o descártala tú, y verifica cualquier decisión con un profesional.";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function scenarioResult(label, ratePercent, debtAmount, annualDebtCost) {
    const rate = round2(number(ratePercent));
    const expectedAnnualReturn = round2(debtAmount * (rate / 100));
    const netAnnualResult = round2(expectedAnnualReturn - annualDebtCost);
    const assessment = netAnnualResult > 0 ? "favorable" : netAnnualResult < 0 ? "desfavorable" : "neutral";
    return { label, ratePercent: rate, expectedAnnualReturn, netAnnualResult, assessment };
  }

  // Sin el guardarraíl (AP4) en estado "ready" (valid === true), no se calcula nada — se devuelven
  // sus propios bloqueadores, para que quien explora sepa exactamente qué resolver antes de seguir.
  function simulateLeverage(input = {}) {
    const barrier = input.barrierResult;
    if (!barrier || typeof barrier !== "object" || barrier.valid !== true) {
      return {
        schemaId: SCHEMA_ID,
        calculable: false,
        reason: "barrier-blocked",
        blockers: Array.isArray(barrier?.blockers) ? barrier.blockers : [],
      };
    }
    const debtAmount = Math.max(0, round2(input.newDebtAmount));
    if (debtAmount <= 0) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-debt-amount", blockers: [] };
    }
    const ratePercent = Math.max(0, number(input.newDebtAnnualRatePercent));
    const annualDebtCost = round2(debtAmount * (ratePercent / 100));
    const scenarios = input.expectedReturnScenarios || {};
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      evaluatedAt: new Date().toISOString(),
      newDebtAmount: debtAmount,
      newDebtAnnualRatePercent: round2(ratePercent),
      annualDebtCost,
      scenarios: {
        pessimistic: scenarioResult("Pesimista", scenarios.pessimisticPercent, debtAmount, annualDebtCost),
        base: scenarioResult("Base", scenarios.basePercent, debtAmount, annualDebtCost),
        optimistic: scenarioResult("Optimista", scenarios.optimisticPercent, debtAmount, annualDebtCost),
      },
      warning: PROFESSIONAL_WARNING,
    };
  }

  // Guarda una exploración ya calculada — nunca una decisión tomada ni algo que se ejecuta. Mismo
  // patrón que canonical-e13-scenarios.js (saveScenario): una fotografía con schemaId propio, nunca
  // una posición real de deuda ni de inversión.
  function saveScenario(result, metadata = {}) {
    return {
      schemaId: SAVED_SCHEMA_ID,
      id: String(metadata.id || `ap3-${Date.now()}`),
      name: String(metadata.name || "").trim() || "Escenario explorado",
      createdAt: new Date().toISOString(),
      result,
    };
  }

  // APX2 — crédito con garantía de cartera (Lombard): cuánto se podría pedir prestado contra la
  // cartera de inversión real (IV1) a un LTV que declara el hogar — nunca un LTV "típico" (30-50%
  // según entidad y activo, imposible de generalizar sin inventar un dato) inventado por este motor.
  // Primer paso de APX3 (simulador de ejecución de garantía / margin call, Bloque 4): APX2 solo dice
  // la capacidad y el coste anual, sin modelar qué pasa si la cartera cae de valor — ese riesgo es
  // justo lo que añade APX3 encima de esto. No pasa por el guardarraíl AP4 de simulateLeverage(): un
  // préstamo Lombard tiene garantía real (la propia cartera) y ejecución en tiempo real por parte
  // del banco, un perfil de riesgo distinto al de la deuda sin garantizar que sí vigila AP4.
  const LOMBARD_SCHEMA_ID = "finance-canonical-lombard-credit/v1";

  function lombardCreditCapacity({ portfolioValue, ltvPct, annualRatePct } = {}) {
    const value = Math.max(0, round2(portfolioValue));
    const ltv = number(ltvPct);
    if (!(value > 0) || !(ltv > 0) || ltv > 100) {
      return { schemaId: LOMBARD_SCHEMA_ID, calculable: false };
    }
    const capacity = round2(value * (ltv / 100));
    const rate = Math.max(0, number(annualRatePct));
    return {
      schemaId: LOMBARD_SCHEMA_ID,
      calculable: true,
      portfolioValue: value,
      ltvPct: round2(ltv),
      capacity,
      annualRatePct: round2(rate),
      annualCost: round2(capacity * (rate / 100)),
      warning: "No modela el riesgo de ejecución de garantía si la cartera cae de valor (APX3, todavía sin construir) — antes de pedir un crédito así, entiende que el banco puede exigir más garantía o liquidar posiciones automáticamente si el valor de la cartera baja.",
    };
  }

  // APX3 — simulador de ejecución de garantía (margin call) sobre el crédito Lombard de APX2.
  // Depende de APX2 (capacidad de préstamo ya calculada) y sigue el mismo criterio de A8-1/AP3: el
  // hogar declara los supuestos a explorar (cuánto pidió prestado de verdad, el LTV de mantenimiento
  // que exige el banco y la caída hipotética de la cartera), nunca un valor "típico" inventado por
  // este motor. Extiende el guardarraíl AP4 al nuevo instrumento: AP4 vigila el riesgo de la deuda
  // SIN garantizar (ratio cuota/ingreso); este motor vigila el riesgo propio de la deuda CON
  // garantía real — que la cartera caiga por debajo del LTV de mantenimiento y dispare una llamada
  // de garantía — con las dos salidas reales que tendría el hogar ante esa llamada: aportar más
  // garantía o que el banco liquide posiciones. Nunca decide cuál tomar, solo calcula ambas.
  const MARGIN_CALL_SCHEMA_ID = "finance-canonical-lombard-margin-call/v1";

  function lombardMarginCallSimulation({ portfolioValue, loanAmount, maintenanceLtvPct, stressDropPct } = {}) {
    const value = Math.max(0, round2(portfolioValue));
    const loan = Math.max(0, round2(loanAmount));
    const maintenanceLtv = number(maintenanceLtvPct);
    const drop = number(stressDropPct);
    if (!(value > 0) || !(loan > 0) || !(maintenanceLtv > 0) || maintenanceLtv >= 100 || !(drop >= 0) || drop >= 100) {
      return { schemaId: MARGIN_CALL_SCHEMA_ID, calculable: false };
    }
    const maintenanceRatio = maintenanceLtv / 100;
    const stressedPortfolioValue = round2(value * (1 - drop / 100));
    const stressedLtvPct = round2((loan / stressedPortfolioValue) * 100);
    const marginCallTriggered = stressedLtvPct > maintenanceLtv;
    // Cash/garantía adicional que restauraría el LTV de mantenimiento sin vender nada:
    // loan / (stressedPortfolioValue + aportación) = maintenanceRatio.
    const additionalCollateralNeeded = marginCallTriggered
      ? round2(Math.max(0, loan / maintenanceRatio - stressedPortfolioValue))
      : 0;
    // Importe que el banco liquidaría (vendido, reduce cartera Y deuda a la vez) para restaurar el
    // mismo LTV de mantenimiento: (loan - X) / (stressedPortfolioValue - X) = maintenanceRatio.
    const forcedLiquidationAmount = marginCallTriggered
      ? round2(Math.max(0, (loan - maintenanceRatio * stressedPortfolioValue) / (1 - maintenanceRatio)))
      : 0;
    return {
      schemaId: MARGIN_CALL_SCHEMA_ID,
      calculable: true,
      portfolioValue: value,
      loanAmount: loan,
      maintenanceLtvPct: round2(maintenanceLtv),
      stressDropPct: round2(drop),
      currentLtvPct: round2((loan / value) * 100),
      stressedPortfolioValue,
      stressedLtvPct,
      marginCallTriggered,
      additionalCollateralNeeded,
      forcedLiquidationAmount,
    };
  }

  // LEV4 (Oleada 3, Bloque 3): comparador de líneas Lombard entre entidades. APX2 calcula la
  // capacidad de crédito de UNA oferta declarada; este motor registra las condiciones reales de
  // varias ofertas (LTV máximo, tipo, comisión de apertura/cancelación, LTV de mantenimiento) y las
  // compara lado a lado sobre la misma cartera real — igual criterio que el comparador de tarifas
  // (canonical-tariff-comparator.js): nunca inventa una condición "típica", solo las que el hogar
  // ha declarado de cada entidad. El margen de seguridad (`safetyMarginPts`) es la distancia en
  // puntos entre el LTV al que prestan y el LTV de mantenimiento que dispara la llamada de
  // garantía — cuanto mayor, más caída de mercado aguanta esa oferta antes de un margin call.
  const LOMBARD_COMPARISON_SCHEMA_ID = "finance-lev4-lombard-comparison/v1";

  function compareLombardOffers({ offers, portfolioValue } = {}) {
    const value = Math.max(0, round2(portfolioValue));
    const list = Array.isArray(offers) ? offers : [];
    if (!(value > 0) || !list.length) return { schemaId: LOMBARD_COMPARISON_SCHEMA_ID, calculable: false, rows: [] };
    const rows = list
      .map((offer) => {
        const maxLtvPct = Math.max(0, Math.min(100, number(offer?.maxLtvPct)));
        const annualRatePct = Math.max(0, number(offer?.annualRatePct));
        const openingFeePct = Math.max(0, number(offer?.openingFeePct));
        const cancellationFeePct = Math.max(0, number(offer?.cancellationFeePct));
        const maintenanceLtvPct = Math.max(0, Math.min(100, number(offer?.maintenanceLtvPct)));
        const capacity = round2(value * (maxLtvPct / 100));
        const annualCost = round2(capacity * (annualRatePct / 100));
        const openingFee = round2(capacity * (openingFeePct / 100));
        const cancellationFee = round2(capacity * (cancellationFeePct / 100));
        const firstYearCost = round2(annualCost + openingFee);
        return {
          id: String(offer?.id || ""),
          entity: String(offer?.entity || "").trim() || "Entidad",
          maxLtvPct, annualRatePct, openingFeePct, cancellationFeePct, maintenanceLtvPct,
          capacity, annualCost, openingFee, cancellationFee, firstYearCost,
          safetyMarginPts: maintenanceLtvPct > 0 ? round2(maintenanceLtvPct - maxLtvPct) : null,
        };
      })
      .sort((a, b) => a.firstYearCost - b.firstYearCost);
    return {
      schemaId: LOMBARD_COMPARISON_SCHEMA_ID,
      calculable: true,
      portfolioValue: value,
      rows,
      cheapestId: rows[0]?.id || null,
    };
  }

  // LEV5 (Oleada 3, Bloque 4): colchón de garantía dinámico — APX3 usa una caída hipotética
  // (`stressDropPct`) fija, declarada a mano en cada simulación. Aquí se deriva una caída estimada de
  // la cartera pignorada REAL, ponderando el valor de cada posición por una banda de volatilidad
  // (caída máxima plausible, %) que el hogar declara por clase de activo (`assetClass`, el mismo
  // campo que INV1) — igual criterio que el triángulo P10/P50/P90 de ESX1: una banda declarada a
  // mano, nunca calculada de una serie histórica que la app no guarda. Una posición sin clase
  // declarada, o cuya clase no tiene banda declarada, queda fuera del cálculo ponderado (nunca se le
  // asigna una banda por defecto) — `coveragePct` dice cuánta cartera sí entra en la estimación.
  const WEIGHTED_STRESS_SCHEMA_ID = "finance-lev5-weighted-stress-drop/v1";

  function weightedPortfolioStressDropPct({ positions, volatilityBands } = {}) {
    const bands = volatilityBands && typeof volatilityBands === "object" ? volatilityBands : {};
    const list = Array.isArray(positions) ? positions : [];
    const totalValue = round2(list.reduce((sum, position) => sum + Math.max(0, number(position?.currentValue)), 0));
    const classified = list
      .filter((position) => Math.max(0, number(position?.currentValue)) > 0 && Number.isFinite(Number(bands[position?.assetClass])))
      .map((position) => ({
        value: Math.max(0, number(position.currentValue)),
        dropPct: Math.max(0, Math.min(100, number(bands[position.assetClass]))),
      }));
    const classifiedValue = round2(classified.reduce((sum, row) => sum + row.value, 0));
    if (!(classifiedValue > 0)) return { schemaId: WEIGHTED_STRESS_SCHEMA_ID, calculable: false };
    const weightedDropPct = round2(classified.reduce((sum, row) => sum + row.value * row.dropPct, 0) / classifiedValue);
    return {
      schemaId: WEIGHTED_STRESS_SCHEMA_ID,
      calculable: true,
      weightedDropPct,
      classifiedValue,
      totalValue,
      unclassifiedValue: round2(Math.max(0, totalValue - classifiedValue)),
      coveragePct: totalValue > 0 ? Math.round((classifiedValue / totalValue) * 100) : 0,
    };
  }

  // LEV7 (Oleada 3, Bloque 4): seguro de cola frente a margin call — compone el margin call ya
  // calculado de APX3 con el P10 de liquidez mínima que YA calibra el Monte Carlo de ESX1
  // (`minCheckingPercentiles`, `canonical-e13-scenarios.js`). Decisión del hogar (sesión 159): "el
  // peor 5%" se define sobre esa banda ya calibrada, sin abrir una calibración de cola de mercado
  // nueva (que exigiría un histórico de rendimientos que esta app no guarda). Pregunta que responde:
  // si la llamada de garantía se disparase justo en el escenario de liquidez ya simulado como
  // "peor" (P10), ¿la caja mínima de ese escenario cubre la garantía adicional exigida, o falta
  // seguro de cola? Nunca decide contratar nada — solo dice si haría falta.
  const TAIL_RISK_SCHEMA_ID = "finance-lev7-tail-risk-margin-call/v1";

  function tailRiskAgainstMarginCall({ marginCallResult, minCheckingPercentiles } = {}) {
    if (!marginCallResult || marginCallResult.calculable !== true) {
      return { schemaId: TAIL_RISK_SCHEMA_ID, calculable: false, reason: "margin-call-not-calculable" };
    }
    if (!marginCallResult.marginCallTriggered) {
      return { schemaId: TAIL_RISK_SCHEMA_ID, calculable: true, marginCallTriggered: false };
    }
    const p10 = number(minCheckingPercentiles?.p10, NaN);
    if (!Number.isFinite(p10)) {
      return { schemaId: TAIL_RISK_SCHEMA_ID, calculable: false, reason: "missing-p10" };
    }
    const additionalCollateralNeeded = marginCallResult.additionalCollateralNeeded;
    const worstCaseLiquidityP10 = round2(Math.max(0, p10));
    const covered = worstCaseLiquidityP10 >= additionalCollateralNeeded;
    return {
      schemaId: TAIL_RISK_SCHEMA_ID,
      calculable: true,
      marginCallTriggered: true,
      additionalCollateralNeeded,
      worstCaseLiquidityP10,
      covered,
      shortfall: round2(Math.max(0, additionalCollateralNeeded - worstCaseLiquidityP10)),
    };
  }

  return {
    SCHEMA_ID,
    SAVED_SCHEMA_ID,
    PROFESSIONAL_WARNING,
    simulateLeverage,
    saveScenario,
    LOMBARD_SCHEMA_ID,
    lombardCreditCapacity,
    MARGIN_CALL_SCHEMA_ID,
    lombardMarginCallSimulation,
    LOMBARD_COMPARISON_SCHEMA_ID,
    compareLombardOffers,
    WEIGHTED_STRESS_SCHEMA_ID,
    weightedPortfolioStressDropPct,
    TAIL_RISK_SCHEMA_ID,
    tailRiskAgainstMarginCall,
  };
});
