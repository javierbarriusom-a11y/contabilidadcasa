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

  return { SCHEMA_ID, cushionFloor, cushionTone, cushionLevel, worstMonthOf };
});
