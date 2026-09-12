/**
 * canonical-budget-forecast-category.js
 *
 * Forecast granular por categoría de gasto.
 * Similar a E12 (forecast de caja) pero a nivel de categoría.
 * Detecta patrones estacionales y retorna predicción mes a mes.
 *
 * Entrada: movimientos de categoría últimos 12 meses
 * Salida: { categoryId, monthlyForecast: { "2026-09": 250±30, ... }, confidence, seasonality }
 */

(function attachCanonicalBudgetForecastCategory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalBudgetForecastCategory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalBudgetForecastCategoryFactory() {
  "use strict";

class CanonicalBudgetForecastCategory {
  /**
   * Genera forecast por categoría para próximos 6-12 meses.
   *
   * @param {Array} historicalMovements - Movimientos últimos 12 meses
   * @param {Object} options - { months: 12, forecastMonths: 6 }
   * @returns {Object|null} { monthlyForecast, confidence, seasonality, stats }
   */
  static forecast(historicalMovements, options = {}) {
    const { months = 12, forecastMonths = 6 } = options;

    if (!historicalMovements || historicalMovements.length < 6) {
      return null; // Datos insuficientes
    }

    // Agrupar histórico por mes
    const monthlyHistory = this._aggregateByMonth(historicalMovements, months);
    if (monthlyHistory.length < 6) {
      return null;
    }

    // Detectar estacionalidad (patrón por mes del año)
    const seasonality = this._detectMonthlySeasonality(monthlyHistory);

    // Forecast base: promedio + estacionalidad
    const forecast = this._generateForecast(monthlyHistory, seasonality, forecastMonths);

    // Calcular confianza basada en estabilidad
    const confidence = this._calculateConfidence(monthlyHistory, seasonality);

    return {
      monthlyForecast: forecast,
      confidence,
      seasonality,
      stats: {
        historicalMonths: monthlyHistory.length,
        forecastMonths,
        avgMonthly: Math.round(
          monthlyHistory.reduce((s, m) => s + m.total, 0) / monthlyHistory.length * 100
        ) / 100,
      },
    };
  }

  /**
   * Agrupa movimientos por mes (últimos N meses).
   */
  static _aggregateByMonth(movements, months) {
    const now = new Date();
    const monthMap = new Map();

    movements.forEach(m => {
      const date = new Date(m.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthMap.get(key) || { month: key, total: 0, count: 0 };
      current.total += Math.abs(m.amount);
      current.count += 1;
      monthMap.set(key, current);
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-months);
  }

  /**
   * PVC12 (Oleada 4, consolidación confirmada por VER-6): el algoritmo de "¿qué meses de
   * calendario se salen de la media?" ya existe, validado y VISIBLE al hogar, en
   * `budgetSeasonalPatterns` (ML-1, `views/presupuesto-mes.js`, tarjeta "Patrones estacionales").
   * Este método extrae esa misma lógica aquí, como función pura sobre pares mes/gasto (sin
   * depender de `budgetAlertForRow` ni de ningún estado de la app), para que ML-1 y este motor de
   * forecast dejen de mantener dos cálculos de estacionalidad distintos sobre datos casi idénticos
   * — nunca fusiona esto con `categoryDriftWindows` (PVC4), que mide sesgo previsto/real sobre
   * meses cerrados y conciliados, una pregunta distinta sobre una fuente de datos distinta que
   * `VER-6` ya confirmó que debía seguir separada.
   */
  static seasonalPatternsFromCalendarSpend(spendEntries, options = {}) {
    const minDeviationPct = Number.isFinite(options.minDeviationPct) ? options.minDeviationPct : 10;
    const minSamplesPerMonth = Number.isFinite(options.minSamplesPerMonth) ? options.minSamplesPerMonth : 2;
    const minTotalSamples = Number.isFinite(options.minTotalSamples) ? options.minTotalSamples : 6;
    const spendByCalendarMonth = {};
    (spendEntries || []).forEach(({ monthKey, spent }) => {
      if (!(spent > 0)) return;
      const calendarMonth = Number(String(monthKey).split('-')[1]);
      (spendByCalendarMonth[calendarMonth] ||= []).push(spent);
    });
    const allValues = Object.values(spendByCalendarMonth).flat();
    if (allValues.length < minTotalSamples) return [];
    const overallAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    if (overallAvg <= 0) return [];
    return Object.entries(spendByCalendarMonth)
      .filter(([, values]) => values.length >= minSamplesPerMonth)
      .map(([calendarMonth, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { calendarMonth: Number(calendarMonth), avg, samples: values.length, deviationPct: Math.round(((avg - overallAvg) / overallAvg) * 100) };
      })
      .filter((pattern) => Math.abs(pattern.deviationPct) >= minDeviationPct)
      .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
  }

  /**
   * Detecta patrones por mes del año (enero siempre alto, julio bajo, etc.)
   */
  static _detectMonthlySeasonality(monthlyHistory) {
    const byMonthNum = new Map();

    monthlyHistory.forEach(({ month, total }) => {
      const monthNum = parseInt(month.split('-')[1]);
      const current = byMonthNum.get(monthNum) || { months: [], totals: [] };
      current.months.push(month);
      current.totals.push(total);
      byMonthNum.set(monthNum, current);
    });

    // Calcular índice estacional por mes (promedio / promedio global)
    const globalAvg = monthlyHistory.reduce((s, m) => s + m.total, 0) / monthlyHistory.length;
    const seasonalIndex = {};

    for (const [monthNum, data] of byMonthNum.entries()) {
      const monthAvg = data.totals.reduce((s, x) => s + x, 0) / data.totals.length;
      seasonalIndex[monthNum] = monthAvg / globalAvg; // Índice: 1.0 = promedio, 1.2 = 20% arriba
    }

    // PVC12: donde el criterio ya validado de arriba (mismos umbrales de materialidad que ML-1)
    // encuentra un patrón real para ese mes de calendario, ese factor sustituye al índice interno
    // — nunca al revés. Los meses sin patrón materialmente significativo conservan el índice
    // interno de siempre (fallback; nunca se deja un mes sin factor, mismo criterio de "solo
    // ensancha, nunca estrecha" ya usado en PVC13).
    const validated = this.seasonalPatternsFromCalendarSpend(monthlyHistory.map((m) => ({ monthKey: m.month, spent: m.total })));
    validated.forEach((pattern) => { seasonalIndex[pattern.calendarMonth] = 1 + pattern.deviationPct / 100; });

    return seasonalIndex;
  }

  /**
   * Genera forecast para próximos meses usando estacionalidad.
   */
  static _generateForecast(monthlyHistory, seasonalIndex, forecastMonths) {
    const baseAvg = monthlyHistory.reduce((s, m) => s + m.total, 0) / monthlyHistory.length;
    const lastMonth = monthlyHistory[monthlyHistory.length - 1];
    const lastMonthDate = new Date(`${lastMonth.month}-01`);

    const forecast = {};

    for (let i = 1; i <= forecastMonths; i++) {
      const futureDate = new Date(lastMonthDate);
      futureDate.setMonth(futureDate.getMonth() + i);

      const monthNum = futureDate.getMonth() + 1;
      const seasonalFactor = seasonalIndex[monthNum] || 1.0;
      const predicted = baseAvg * seasonalFactor;
      const stdDev = Math.sqrt(
        monthlyHistory.reduce((s, m) => s + Math.pow(m.total - baseAvg, 2), 0) /
          monthlyHistory.length
      );
      const range = Math.round(stdDev * 100) / 100;

      const monthKey = `${futureDate.getFullYear()}-${String(monthNum).padStart(2, '0')}`;
      forecast[monthKey] = {
        predicted: Math.round(predicted * 100) / 100,
        range: `±${range}`,
        confidence: range / predicted < 0.2 ? 'high' : range / predicted < 0.4 ? 'medium' : 'low',
      };
    }

    return forecast;
  }

  /**
   * Calcula confianza basada en variabilidad.
   */
  static _calculateConfidence(monthlyHistory, seasonalIndex) {
    const totals = monthlyHistory.map(m => m.total);
    const avg = totals.reduce((s, x) => s + x, 0) / totals.length;
    const stdDev = Math.sqrt(totals.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / totals.length);
    const cv = stdDev / avg; // Coeficiente de variación

    if (cv < 0.15) return 'high';
    if (cv < 0.35) return 'medium';
    return 'low';
  }

  /**
   * Integración simple: dado análisis histórico, retorna forecast.
   * Usado en P-1 para mostrar "Forecast inteligente" junto a p75.
   */
  static suggestedBudget(historicalAnalysis, forecastData) {
    if (!historicalAnalysis || !forecastData) return historicalAnalysis?.recommendation || null;

    // Usar forecast si confianza es alta, sino usar p75 histórico
    if (forecastData.confidence === 'high') {
      // Promedio del forecast (primeros 3 meses)
      const forecastValues = Object.values(forecastData.monthlyForecast)
        .slice(0, 3)
        .map(f => f.predicted);
      if (forecastValues.length > 0) {
        return Math.round(
          (forecastValues.reduce((s, x) => s + x, 0) / forecastValues.length) * 100
        ) / 100;
      }
    }

    return historicalAnalysis.recommendation;
  }
}

  return { CanonicalBudgetForecastCategory };
});
