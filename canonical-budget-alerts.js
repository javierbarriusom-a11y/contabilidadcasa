/**
 * canonical-budget-alerts.js
 *
 * Motor de alertas para desviaciones presupuestarias.
 * Compara gasto acumulado vs. ritmo esperado diario,
 * calcula desviación y confianza, genera alertas con severidad.
 *
 * Entrada: presupuesto mensual, movimientos hasta hoy, análisis histórico
 * Salida: { categoryId, status, severity, confidence, message, metrics }
 */

(function attachCanonicalBudgetAlerts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalBudgetAlerts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalBudgetAlertsFactory() {
  "use strict";

class CanonicalBudgetAlerts {
  /**
   * Calcula alerta de desviación para una categoría en el mes actual (o en cualquier otro periodo,
   * ver `dateContext.periodStart`/`periodEnd` más abajo).
   *
   * @param {Object} param
   * @param {number} param.budgetAmount - Presupuesto para el periodo (€)
   * @param {Array} param.movements - Movimientos hasta hoy (se filtran por periodo aquí dentro)
   * @param {number} param.stdDev - Desviación estándar histórica
   * @param {Object} param.dateContext - { today: Date, daysInMonth: number } para un mes natural
   *   (comportamiento original, sin cambios); o, para un periodo arbitrario (p. ej. una semana ISO,
   *   BUD-1), { today, periodStart: "YYYY-MM-DD", periodEnd: "YYYY-MM-DD", unitsInPeriod, unitIndex }
   *   — con los cuatro presentes, el filtrado de movimientos usa ese rango de fechas en vez del mes
   *   natural de `today`, y el ritmo esperado se calcula sobre `unitsInPeriod` unidades en vez de
   *   días del mes.
   * @returns {Object} { status, severity, confidence, message, metrics }
   */
  static calculateAlert({
    budgetAmount,
    movements = [],
    stdDev = 0,
    dateContext = {},
  }) {
    const today = dateContext.today || new Date();
    const hasCustomPeriod =
      typeof dateContext.periodStart === 'string' &&
      typeof dateContext.periodEnd === 'string' &&
      Number.isFinite(dateContext.unitsInPeriod) &&
      Number.isFinite(dateContext.unitIndex);

    const unitsInPeriod = hasCustomPeriod ? dateContext.unitsInPeriod : (dateContext.daysInMonth || this._getDaysInMonth(today));
    const unitIndex = hasCustomPeriod ? dateContext.unitIndex : today.getDate();

    // Movimientos del periodo: rango explícito de fechas si se dio (p. ej. una semana ISO),
    // si no el mes natural de `today` — comportamiento original, sin cambios.
    const periodMovements = hasCustomPeriod
      ? movements.filter(m => {
          const iso = typeof m.date === 'string' ? m.date.slice(0, 10) : this._isoDateString(new Date(m.date));
          return iso >= dateContext.periodStart && iso <= dateContext.periodEnd;
        })
      : movements.filter(m => {
          const date = new Date(m.date);
          return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        });

    const spent = periodMovements.reduce((sum, m) => sum + Math.abs(m.amount), 0);
    const expectedRate = budgetAmount / unitsInPeriod;
    const expectedAccumulated = expectedRate * unitIndex;
    const deviation = spent - expectedAccumulated;
    const deviationPercent = expectedAccumulated > 0
      ? Math.round((deviation / expectedAccumulated) * 100)
      : 0;

    // Determinar estado
    let status = 'on-track';
    if (deviationPercent > 10) status = 'overspend';
    if (deviationPercent < -10) status = 'underspend';

    // Severidad (1-5)
    let severity = 1;
    const absDev = Math.abs(deviationPercent);
    if (absDev > 5) severity = 2;
    if (absDev > 15) severity = 3;
    if (absDev > 25) severity = 4;
    if (absDev > 40) severity = 5;

    // Confianza (inversamente proporcional a stdDev)
    let confidence = 'high';
    if (stdDev > budgetAmount * 0.3) confidence = 'medium';
    if (stdDev > budgetAmount * 0.5) confidence = 'low';

    // Mensaje legible
    const message = this._generateMessage({
      status,
      spent,
      expectedAccumulated,
      budgetAmount,
      dayOfMonth: unitIndex,
      daysInMonth: unitsInPeriod,
      confidence,
    });

    return {
      status,
      severity,
      confidence,
      message,
      metrics: {
        spent: Math.round(spent * 100) / 100,
        expectedAccumulated: Math.round(expectedAccumulated * 100) / 100,
        budgetAmount: Math.round(budgetAmount * 100) / 100,
        dailyRate: Math.round(expectedRate * 100) / 100,
        deviationAmount: Math.round(deviation * 100) / 100,
        deviationPercent,
        // Nombres históricos (dayOfMonth/daysInMonth) conservados tal cual para no romper a los
        // consumidores existentes (budgetProjection() en app.js, tests) — para un periodo que no es
        // un mes natural (p. ej. una semana ISO) representan "unidad actual" y "unidades totales"
        // del periodo, no literalmente día/días del mes.
        dayOfMonth: unitIndex,
        daysInMonth: unitsInPeriod,
      },
    };
  }

  /**
   * Calcula alertas para varias categorías en lote.
   */
  static calculateBatch(budgetsByCategory, movementsByCategory, historicalStats, dateContext) {
    const alerts = {};

    for (const [categoryId, budgetAmount] of Object.entries(budgetsByCategory)) {
      const stats = historicalStats[categoryId] || {};
      alerts[categoryId] = this.calculateAlert({
        budgetAmount,
        movements: movementsByCategory[categoryId] || [],
        stdDev: stats.stdDev || 0,
        dateContext,
      });
    }

    return alerts;
  }

  /**
   * Genera mensaje descriptivo de la alerta.
   */
  static _generateMessage({
    status,
    spent,
    expectedAccumulated,
    budgetAmount,
    dayOfMonth,
    daysInMonth,
    confidence,
  }) {
    const remaining = budgetAmount - spent;
    const projectedFinalSpent = (spent / dayOfMonth) * daysInMonth;
    const projectedRemaining = budgetAmount - projectedFinalSpent;

    if (status === 'on-track') {
      return `En ritmo. Gastado ${Math.round(spent)}€ de ${Math.round(expectedAccumulated)}€ esperados. ✓`;
    }

    if (status === 'overspend') {
      const excess = Math.round(spent - expectedAccumulated);
      const confidenceText = confidence === 'low' ? ' (confianza baja)' : '';
      return `🔴 Gasto ${excess}€ arriba del ritmo${confidenceText}. Si sigues así, superarás presupuesto ${Math.round(projectedRemaining) < 0 ? `en ${Math.abs(Math.round(projectedRemaining))}€` : 'por poco'}.`;
    }

    if (status === 'underspend') {
      const savings = Math.round(expectedAccumulated - spent);
      return `🟢 Ahorras ${savings}€ vs. ritmo esperado. Al este ritmo, quedan ${Math.round(projectedRemaining)}€ sin gastar.`;
    }

    return 'Estado desconocido.';
  }

  /**
   * Retorna número de días en mes.
   */
  static _getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * "YYYY-MM-DD" en hora local, para comparar contra `dateContext.periodStart`/`periodEnd` cuando
   * `movements[].date` no es ya un string (por ejemplo, viene como objeto Date).
   */
  static _isoDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

  return { CanonicalBudgetAlerts };
});
