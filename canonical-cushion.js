(function attachCanonicalCushion(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCushion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCushion() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-cushion/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // El suelo de referencia del color: la reserva operativa si está configurada; si no, un mes de
  // salidas del primer mes del horizonte. Se devuelve de qué se compone (basis/basisValue), no un
  // texto ya formateado — cada pantalla que lo consuma decide cómo lo dice.
  function cushionFloor(rows, reserve) {
    const configuredReserve = number(reserve);
    if (configuredReserve > 0) {
      return { value: configuredReserve, basis: "operating-reserve", basisValue: configuredReserve };
    }
    const first = Array.isArray(rows) ? rows[0] : null;
    const outflow = first ? number(first.coreSpend) + number(first.car) + number(first.refi) : 0;
    return { value: Math.max(outflow, 1), basis: "one-month-outflow", basisValue: outflow };
  }

  function cushionTone(value, floor) {
    const v = number(value);
    const f = number(floor);
    if (v < 0) return "is-negative";
    if (v < f) return "is-tight";
    if (v < f * 3) return "is-ok";
    return "is-good";
  }

  // P-9 (Plan · Previsión) / A-2 (Análisis, pendiente): escala de tres niveles, más compacta que
  // cushionTone (4 niveles) — pensada para una fila por mes, no una rejilla con espacio para
  // matices. El mínimo operativo se dibuja como línea aparte en quien la use; el nivel intermedio
  // ya significa "por debajo de ese mínimo", no hace falta deducirlo del color.
  function cushionLevel(value, floor) {
    const v = number(value);
    const f = number(floor);
    if (v < 0) return "negativo";
    if (v < f) return "ajustado";
    return "holgado";
  }

  // Un solo punto de verdad para "cuál es el peor mes de un horizonte", con el campo de liquidez y
  // de clave de mes parametrizados: Plan, Análisis y Hoy leen horizontes con nombres de fila
  // distintos, pero ninguno debería reimplementar este reduce.
  function worstMonthOf(rows, { liquidityField = "totalLiquidity", monthKeyField = "detailMonthKey" } = {}) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const worst = rows.reduce((lowest, row) => {
      const value = number(row?.[liquidityField]);
      const lowestValue = lowest ? number(lowest[liquidityField]) : Infinity;
      return value < lowestValue ? row : lowest;
    }, null);
    if (!worst) return null;
    const key = String(worst[monthKeyField] || worst.month || "");
    return { key, value: number(worst[liquidityField]), row: worst };
  }

  // TT1: reparto del colchón entre la cuenta corriente (acceso inmediato, sin remuneración) y una
  // cuenta remunerada (rendimiento, pero con el retraso de un traspaso entre cuentas propias). Solo
  // necesita quedarse en corriente lo que se pudiera necesitar antes de que ese traspaso llegue —
  // no el colchón entero. Reutiliza el mismo cálculo de salidas mensuales que ya usa cushionFloor
  // (rows[0].coreSpend/car/refi, vía cushionFloor(rows, 0) para forzar la rama "un mes de salidas"
  // aunque haya una reserva operativa configurada) en vez de inventar un segundo umbral aparte.
  function cushionAccountSplit(total, rows, { instantAccessDays = 7 } = {}) {
    const totalSafe = Math.max(0, number(total));
    const monthlyOutflow = cushionFloor(rows, 0).basisValue;
    const dailyOutflow = monthlyOutflow / 30;
    const instantAccessAmount = round2(Math.max(0, dailyOutflow * instantAccessDays));
    const corriente = round2(Math.min(totalSafe, instantAccessAmount));
    const remunerado = round2(Math.max(0, totalSafe - corriente));
    return {
      total: round2(totalSafe),
      corriente,
      remunerado,
      instantAccessDays,
      instantAccessAmount,
    };
  }

  // TT5: la reserva operativa configurada (Ajustes) es un número fijo que la persona escribe una
  // vez — `cushionFloor` la usa tal cual, para siempre, aunque el gasto real actual haya cambiado
  // mucho desde entonces. `cushionFloorDrift` no toca `cushionFloor` (nada deja de funcionar como
  // antes): compara el suelo configurado con lo que las salidas del mes actual sugerirían ahora
  // mismo (el mismo cálculo "un mes de salidas" que ya usa cushionFloor cuando no hay reserva, vía
  // cushionFloor(rows, 0) para forzarlo) y marca `stale` cuando se han separado un 20% o más — ni
  // "casi igual" ni ruido de un mes suelto. Sin reserva configurada no hay nada que comparar.
  const CUSHION_DRIFT_THRESHOLD = 0.2;

  function cushionFloorDrift(configuredReserve, rows) {
    const configured = Math.max(0, number(configuredReserve));
    const live = round2(cushionFloor(rows, 0).basisValue);
    if (configured <= 0) return { configured: 0, live, driftRatio: null, stale: false };
    const driftRatio = live > 0 ? round2((configured - live) / live) : null;
    const stale = driftRatio !== null && Math.abs(driftRatio) >= CUSHION_DRIFT_THRESHOLD;
    return { configured: round2(configured), live, driftRatio, stale };
  }

  // SP5: la franquicia (deducible) de un seguro es una apuesta calculada — cuanto más alta, menor
  // la prima, pero mayor el golpe de caja si hay un siniestro. optimalDeductibleFor no dice "elige
  // la más alta posible": dice cuál es la mayor franquicia, de las opciones habituales, que la
  // holgura del colchón (lo que sobra por encima del suelo protegido, no el colchón entero — el
  // suelo sigue siendo para lo que ya protege) podría absorber sin caer por debajo de ese suelo.
  const DEFAULT_DEDUCTIBLE_OPTIONS = [150, 300, 500, 1000];

  function optimalDeductibleFor(cushion, floor, deductibleOptions = DEFAULT_DEDUCTIBLE_OPTIONS) {
    const available = round2(Math.max(0, number(cushion)));
    const protectedFloor = round2(Math.max(0, number(floor)));
    const slack = round2(Math.max(0, available - protectedFloor));
    const options = (Array.isArray(deductibleOptions) ? deductibleOptions : DEFAULT_DEDUCTIBLE_OPTIONS)
      .map((value) => round2(number(value)))
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    const affordable = options.filter((value) => value <= slack);
    return {
      cushion: available,
      floor: protectedFloor,
      slack,
      options,
      affordable,
      // null cuando ninguna franquicia habitual cabe en la holgura disponible: no forzar la más
      // baja como "óptima" cuando en realidad ninguna es segura todavía.
      optimal: affordable.length ? affordable[affordable.length - 1] : null,
    };
  }

  // TT2: escalera de vencimientos para el exceso sobre el colchón (depende de CP2, que ya identifica
  // ese exceso como "dinero parado", y de TT1 — mismo patrón de repartir por plazo, no por
  // rentabilidad). No es una previsión de mercado ni inventa ningún tipo de interés: reparte el
  // importe en tramos iguales con vencimientos escalonados cada `intervalMonths` — pura estructura
  // de plazos, para no dejarlo todo bloqueado al mismo vencimiento ni todo en el mismo día de
  // acceso. Sin importe que escalonar, no hay tramos que inventar.
  const DEFAULT_LADDER_RUNGS = 4;
  const DEFAULT_LADDER_INTERVAL_MONTHS = 3;

  function cushionMaturityLadder(amount, { rungs = DEFAULT_LADDER_RUNGS, intervalMonths = DEFAULT_LADDER_INTERVAL_MONTHS } = {}) {
    const total = round2(Math.max(0, number(amount)));
    const rungCount = Math.max(1, Math.floor(number(rungs, DEFAULT_LADDER_RUNGS)));
    const months = Math.max(1, Math.floor(number(intervalMonths, DEFAULT_LADDER_INTERVAL_MONTHS)));
    if (total <= 0) return { total: 0, rungCount, intervalMonths: months, rungs: [] };
    const base = Math.floor((total / rungCount) * 100) / 100;
    let assigned = 0;
    const ladderRungs = [];
    for (let index = 1; index <= rungCount; index += 1) {
      const isLast = index === rungCount;
      const rungAmount = isLast ? round2(total - assigned) : base;
      assigned = round2(assigned + rungAmount);
      ladderRungs.push({ index, months: months * index, amount: rungAmount });
    }
    return { total, rungCount, intervalMonths: months, rungs: ladderRungs };
  }

  // DLX1: guardarraíl de colchón antes de amortizar deuda con caja disponible. Mismos tres estados y
  // el mismo margen de aviso temprano (20%) que ya usa AP6 (canonical-leverage-sustainability.js,
  // EARLY_WARNING_MARGIN) para la deuda de apalancamiento tomada — aquí aplicado a una amortización
  // puntual en vez de a una cuota recurrente. No es el mismo umbral que CUSHION_DRIFT_THRESHOLD (ese
  // mide si la reserva configurada se ha quedado desfasada; este mide cuánto margen queda tras
  // gastar). Motor puro: nunca bloquea nada por sí solo, solo informa del estado resultante — quien
  // lo use decide si avisa, si pide confirmación extra, o ambas cosas.
  const AMORTIZE_EARLY_WARNING_MARGIN = 0.2;

  function amortizeCushionGuardrail({ amount, liquidity, floor } = {}) {
    const amountSafe = round2(Math.max(0, number(amount)));
    const liquiditySafe = round2(number(liquidity));
    const floorSafe = round2(Math.max(0, number(floor)));
    const remaining = round2(liquiditySafe - amountSafe);
    const earlyWarningFloor = round2(floorSafe * (1 + AMORTIZE_EARLY_WARNING_MARGIN));
    const status = remaining < floorSafe ? "insostenible" : remaining < earlyWarningFloor ? "ajustado" : "sostenible";
    return {
      amount: amountSafe,
      liquidity: liquiditySafe,
      floor: floorSafe,
      remaining,
      status,
      shortfall: status === "insostenible" ? round2(floorSafe - remaining) : 0,
    };
  }

  // DLX2: reparto automático del excedente mensual. Depende de DLX1 (mismo suelo y liquidez de
  // amortizeCushionGuardrail) y del veredicto que ya calcula AP1 (compareAmortizeVsInvest,
  // canonical-debt-comparator.js): primero protege el colchón hasta su suelo con la parte del
  // excedente que haga falta, y solo lo que sobra por encima del suelo queda libre para amortizar
  // o invertir, según lo que ya diga AP1. Sin un veredicto claro de AP1 (empate o sin rentabilidad
  // de cartera calculable), la parte libre queda "unassigned" — nunca se inventa un reparto 50/50
  // sin criterio real.
  function surplusAllocationRule({ amount, liquidity, floor, assessment } = {}) {
    const amountSafe = round2(Math.max(0, number(amount)));
    if (amountSafe <= 0) return { calculable: false };
    const liquiditySafe = round2(number(liquidity));
    const floorSafe = round2(Math.max(0, number(floor)));
    const headroom = Math.max(0, round2(liquiditySafe - floorSafe));
    const toCushion = round2(Math.min(amountSafe, Math.max(0, amountSafe - headroom)));
    const spendable = round2(amountSafe - toCushion);
    let toDebt = 0;
    let toInvestment = 0;
    let unassigned = 0;
    if (spendable > 0) {
      if (assessment === "amortizar") toDebt = spendable;
      else if (assessment === "invertir") toInvestment = spendable;
      else unassigned = spendable;
    }
    return {
      calculable: true,
      amount: amountSafe,
      liquidity: liquiditySafe,
      floor: floorSafe,
      toCushion,
      spendable,
      assessment: assessment || null,
      toDebt,
      toInvestment,
      unassigned,
    };
  }

  // DLX3: retrospectiva "¿me habría quedado sin colchón?". Reconstruye la liquidez de cada mes ya
  // conciliado (mismo historial real que ya expone PVX1, reconciledMonthlyNetHistory en app.js)
  // caminando hacia atrás desde la liquidez de HOY: balance_del_mes = balance_del_mes_siguiente -
  // flujo_neto_real de ese mes. Compara esa liquidez reconstruida contra el suelo VIGENTE
  // (cushionFloor, misma función que ya usan DLX1/AP6) — nunca un suelo histórico, porque la
  // reserva operativa no se guarda versionada en el tiempo. Es una aproximación explícita: no
  // reconstruye traspasos puntuales entre cuentas (aportaciones a inversión, amortizaciones extra)
  // que también movieron la liquidez real de esos meses — solo el flujo neto agregado que PVX1 ya
  // usa, nunca una cifra con apariencia de precisión histórica que la app no tiene.
  function cushionRetrospective(history, { currentLiquidity, floor } = {}) {
    const rows = (Array.isArray(history) ? history : [])
      .filter((record) => Number.isFinite(record?.actual))
      .slice()
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
    if (!rows.length) return { calculable: false };
    const floorSafe = round2(Math.max(0, number(floor)));
    let runningBalance = round2(number(currentLiquidity));
    const months = rows.map((record) => {
      const estimatedBalance = runningBalance;
      const netFlow = round2(number(record.actual));
      runningBalance = round2(runningBalance - netFlow);
      return { monthKey: record.monthKey, netFlow, estimatedBalance, status: cushionLevel(estimatedBalance, floorSafe) };
    });
    const worstMonth = months.reduce((worst, month) => (!worst || month.estimatedBalance < worst.estimatedBalance ? month : worst), null);
    return {
      calculable: true,
      floor: floorSafe,
      currentLiquidity: round2(number(currentLiquidity)),
      months,
      worstMonth,
      breachCount: months.filter((month) => month.status !== "holgado").length,
    };
  }

  return {
    SCHEMA_ID,
    cushionFloor,
    cushionTone,
    cushionLevel,
    worstMonthOf,
    cushionAccountSplit,
    CUSHION_DRIFT_THRESHOLD,
    cushionFloorDrift,
    DEFAULT_DEDUCTIBLE_OPTIONS,
    optimalDeductibleFor,
    DEFAULT_LADDER_RUNGS,
    DEFAULT_LADDER_INTERVAL_MONTHS,
    cushionMaturityLadder,
    AMORTIZE_EARLY_WARNING_MARGIN,
    amortizeCushionGuardrail,
    surplusAllocationRule,
    cushionRetrospective,
  };
});
