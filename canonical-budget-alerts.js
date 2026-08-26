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
   * Calcula alerta de desviación para una categoría en el mes actual.
   *
   * @param {Object} param
   * @param {number} param.budgetAmount - Presupuesto para el mes (€)
   * @param {Array} param.movements - Movimientos del mes hasta hoy
   * @param {number} param.stdDev - Desviación estándar histórica
   * @param {Object} param.dateContext - { today: Date, daysInMonth: number }
   * @returns {Object} { status, severity, confidence, message, metrics }
   */
  static calculateAlert({
    budgetAmount,
    movements = [],
    stdDev = 0,
    dateContext = {},
  }) {
    const today = dateContext.today || new Date();
    const daysInMonth = dateContext.daysInMonth || this._getDaysInMonth(today);
    const dayOfMonth = today.getDate();

    // Movimientos del mes actual
    const monthMovements = movements.filter(m => {
      const date = new Date(m.date);
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    });

    const spent = monthMovements.reduce((sum, m) => sum + Math.abs(m.amount), 0);
    const expectedRate = budgetAmount / daysInMonth;
    const expectedAccumulated = expectedRate * dayOfMonth;
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
      dayOfMonth,
      daysInMonth,
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
        dayOfMonth,
        daysInMonth,
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
}

  return { CanonicalBudgetAlerts };
});
