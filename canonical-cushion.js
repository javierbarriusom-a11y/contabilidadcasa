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

  return {
    SCHEMA_ID,
    cushionFloor,
    cushionTone,
    cushionLevel,
    worstMonthOf,
    cushionAccountSplit,
    CUSHION_DRIFT_THRESHOLD,
    cushionFloorDrift,
  };
});
